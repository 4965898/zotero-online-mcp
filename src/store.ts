import { DatabaseSync } from 'node:sqlite';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { AppError } from './errors.js';
import type { Plan, PlanStore } from './plans.js';

export const hash = (s: string) => createHash('sha256').update(s).digest('hex');
// Sentinel expiry for tokens that never expire. Zero is unambiguous: real expiries are Date.now() + ttl.
export const NEVER = 0;
export const secret = () => randomBytes(32).toString('base64url');
export function equalSecret(a: string, b: string) { return timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b))); }
export interface Principal { id: string; userId: string; apiKey: string; tokenHash: string; }

export class Store {
  readonly db: DatabaseSync;
  constructor(path: string, private key: Buffer) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, identity TEXT UNIQUE NOT NULL, user_id TEXT NOT NULL, api_key TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS tokens(hash TEXT PRIMARY KEY, user TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL, kind TEXT NOT NULL, client TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ephemeral(key TEXT PRIMARY KEY, kind TEXT NOT NULL, value TEXT NOT NULL, expires INTEGER NOT NULL, owner TEXT NOT NULL DEFAULT '');
      CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, time TEXT NOT NULL, user TEXT NOT NULL, tool TEXT NOT NULL, status TEXT NOT NULL);
    `);
    if (!(this.db.prepare('PRAGMA table_info(ephemeral)').all() as any[]).some(c => c.name === 'owner')) this.db.exec("ALTER TABLE ephemeral ADD COLUMN owner TEXT NOT NULL DEFAULT ''");
    const check = this.db.prepare('SELECT api_key FROM users LIMIT 1').get() as { api_key: string } | undefined;
    if (check) this.decrypt(check.api_key); // Fail startup if the configured key cannot decrypt existing credentials.
  }
  encrypt(value: string): string {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
  }
  decrypt(value: string): string {
    const all = Buffer.from(value, 'base64'), decipher = createDecipheriv('aes-256-gcm', this.key, all.subarray(0, 12));
    decipher.setAuthTag(all.subarray(12, 28));
    return Buffer.concat([decipher.update(all.subarray(28)), decipher.final()]).toString('utf8');
  }
  connect(userId: string, apiKey: string): string {
    // Separate Zotero keys for the same account remain separate principals/permission sets.
    const identity = hash(apiKey);
    const existing = this.db.prepare('SELECT id FROM users WHERE identity=?').get(identity) as { id: string } | undefined;
    if (existing) return existing.id;
    const id = randomUUID();
    this.db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(id, identity, userId, this.encrypt(apiKey));
    return id;
  }
  issue(user: string, kind = 'access', ttl = 0, client = ''): string {
    const value = secret();
    // Any ttl <= 0 (the default) issues a token that never expires: it stays usable until explicitly
    // revoked or its connection is deleted. Callers wanting a bounded lifetime pass a positive ttl.
    const expires = ttl > 0 ? Date.now() + ttl : NEVER;
    this.db.prepare('INSERT INTO tokens VALUES(?,?,?,?,?)').run(hash(value), user, expires, kind, client);
    return value;
  }
  authenticate(token: string, kind = 'access', client?: string): Principal {
    const row = this.db.prepare('SELECT u.*,t.client FROM tokens t JOIN users u ON u.id=t.user WHERE t.hash=? AND t.kind=? AND (t.expires>? OR t.expires=?)')
      .get(hash(token), kind, Date.now(), NEVER) as { id: string; user_id: string; api_key: string; client: string } | undefined;
    if (!row || (client !== undefined && row.client !== client)) throw new AppError('UNAUTHORIZED', 'Invalid or expired service token', 401);
    return { id: row.id, userId: row.user_id, apiKey: this.decrypt(row.api_key), tokenHash: hash(token) };
  }
  isActive(tokenHash: string) {
    // An empty hash means the principal authenticated with a passthrough credential rather than a
    // stored service token, so there is no token row to check. Treat it as active: the credential is
    // re-verified against Zotero on every request by the authenticator.
    if (!tokenHash) return true;
    return !!this.db.prepare('SELECT 1 FROM tokens WHERE hash=? AND (expires>? OR expires=?)').get(tokenHash, Date.now(), NEVER);
  }
  neverExpires(tokenHash: string) { return !!this.db.prepare('SELECT 1 FROM tokens WHERE hash=? AND expires=?').get(tokenHash, NEVER); }
  revoke(token: string) { this.db.prepare('DELETE FROM tokens WHERE hash=?').run(hash(token)); }
  disconnect(user: string) { this.db.prepare('DELETE FROM ephemeral WHERE owner=?').run(user); this.db.prepare('DELETE FROM users WHERE id=?').run(user); }
  put(kind: string, key: string, value: unknown, ttl: number, owner = '') {
    this.db.prepare('INSERT OR REPLACE INTO ephemeral(key,kind,value,expires,owner) VALUES(?,?,?,?,?)').run(key, kind, this.encrypt(JSON.stringify(value)), Date.now() + ttl, owner);
  }
  get<T>(kind: string, key: string): T | undefined {
    const row = this.db.prepare('SELECT value FROM ephemeral WHERE key=? AND kind=? AND expires>?').get(key, kind, Date.now()) as { value: string } | undefined;
    return row ? JSON.parse(this.decrypt(row.value)) as T : undefined;
  }
  take<T>(kind: string, key: string): T | undefined {
    const value = this.get<T>(kind, key);
    if (value !== undefined) this.db.prepare('DELETE FROM ephemeral WHERE key=? AND kind=?').run(key, kind);
    return value;
  }
  audit(user: string, tool: string, status: string) { this.db.prepare('INSERT INTO audit(time,user,tool,status) VALUES(?,?,?,?)').run(new Date().toISOString(), user, tool, status); }
  // Adapter so the hosted server can persist write plans in SQLite while the stdio server uses memory.
  planStore(): PlanStore {
    return {
      put: (key, plan, ttl, owner) => this.put('plan', key, plan, ttl, owner),
      get: key => this.get<Plan>('plan', key),
      take: key => this.take<Plan>('plan', key),
      count: () => {
        const row = this.db.prepare("SELECT count(*) total FROM ephemeral WHERE kind='plan' AND expires>?").get(Date.now()) as { total: number };
        const own = new Map<string, number>();
        for (const r of this.db.prepare("SELECT owner, count(*) n FROM ephemeral WHERE kind='plan' AND expires>? GROUP BY owner").all(Date.now()) as { owner: string; n: number }[]) own.set(r.owner, r.n);
        return { total: row.total, own: (owner: string) => own.get(owner) ?? 0 };
      },
      sweep: () => { this.db.prepare("DELETE FROM ephemeral WHERE kind='plan' AND expires<?").run(Date.now()); },
      audit: (owner, tool, status) => this.audit(owner, tool, status),
    };
  }
  cleanup() {
    // expires=NEVER is excluded so permanent tokens survive maintenance.
    this.db.prepare('DELETE FROM tokens WHERE expires<>? AND expires<?').run(NEVER, Date.now());
    this.db.prepare('DELETE FROM ephemeral WHERE expires<?').run(Date.now());
    this.db.prepare('DELETE FROM audit WHERE time<?').run(new Date(Date.now() - 90 * 86400000).toISOString());
  }
  close() { this.db.close(); }
}
