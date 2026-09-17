import { randomBytes, createHash } from 'node:crypto';
import { AppError, publicError } from './errors.js';
import type { Principal } from './store.js';
import type { Zotero, Query } from './zotero.js';

export type Command = { method: 'POST' | 'PATCH' | 'PUT' | 'DELETE'; path: string; body?: unknown; version?: number; writeToken?: string; query?: Query }
  | { method: 'UPLOAD'; path: string; base64: string; filename: string; md5: string; mtime: number; previousMd5?: string };
export interface Plan { user: string; tool: string; commands: Command[]; preview: unknown; }

const secret = () => randomBytes(32).toString('base64url');
const hash = (s: string) => createHash('sha256').update(s).digest('hex');

// Minimal persistence contract for pending write plans. The hosted server backs this with SQLite so
// plans survive restarts and are shared across processes; the stdio server uses an in-process Map.
export interface PlanStore {
  put(key: string, plan: Plan, ttlMs: number, owner: string): void;
  get(key: string): Plan | undefined;
  take(key: string): Plan | undefined;
  count(): { total: number; own: (owner: string) => number };
  sweep(): void;
  audit?(owner: string, tool: string, status: string): void;
}

export class MemoryPlanStore implements PlanStore {
  private entries = new Map<string, { plan: Plan; expires: number; owner: string }>();
  put(key: string, plan: Plan, ttlMs: number, owner: string) { this.entries.set(key, { plan, expires: Date.now() + ttlMs, owner }); }
  get(key: string) { const e = this.entries.get(key); if (!e) return undefined; if (e.expires <= Date.now()) { this.entries.delete(key); return undefined; } return e.plan; }
  take(key: string) { const plan = this.get(key); if (plan !== undefined) this.entries.delete(key); return plan; }
  count() {
    let total = 0; const owners = new Map<string, number>();
    for (const e of this.entries.values()) { total++; owners.set(e.owner, (owners.get(e.owner) ?? 0) + 1); }
    return { total, own: (owner: string) => owners.get(owner) ?? 0 };
  }
  sweep() { const now = Date.now(); for (const [k, e] of this.entries) if (e.expires <= now) this.entries.delete(k); }
}

export class Plans {
  constructor(private store: PlanStore, private enabled: boolean) {}
  prepare(principal: Principal, tool: string, commands: Command[], preview: unknown) {
    if (!this.enabled) throw new AppError('WRITES_DISABLED', 'Writes are disabled; set ZOTERO_WRITE=true or ENABLE_WRITES=true to allow them', 403);
    if (!commands.length || commands.length > 100) throw new AppError('INVALID_PLAN', 'A plan must contain 1–100 operations');
    this.store.sweep();
    const counts = this.store.count();
    if (counts.total >= 100 || counts.own(principal.id) >= 20) throw new AppError('PLAN_LIMIT', 'Too many pending plans; execute existing plans or wait for their 10-minute expiry', 429);
    const token = secret();
    for (const c of commands) if (c.method === 'POST') c.writeToken = randomBytes(16).toString('hex');
    this.store.put(hash(token), { user: principal.id, tool, commands, preview }, 10 * 60000, principal.id);
    return { status: 'awaiting_confirmation', expiresInSeconds: 600, confirmationToken: token, preview,
      nextStep: 'Show this preview to the user. Only after their explicit approval call execute_write with this token. The token is bound to this exact operation and is usable once.' };
  }
  async execute(principal: Principal, api: Zotero, token: string) {
    if (!this.enabled) throw new AppError('WRITES_DISABLED', 'Writes are disabled', 403);
    const key = hash(token), plan = this.store.get(key);
    if (!plan || plan.user !== principal.id) throw new AppError('INVALID_CONFIRMATION', 'Plan is expired, consumed, or belongs to another user', 403);
    // Consume before awaiting network I/O: concurrent execution and replays cannot duplicate writes.
    this.store.take(key);
    const results: unknown[] = [];
    for (let index = 0; index < plan.commands.length; index++) {
      const command = plan.commands[index];
      try {
        const result = command.method === 'UPLOAD'
          ? await api.upload(command.path, Buffer.from(command.base64, 'base64'), command.filename, command.md5, command.mtime, command.previousMd5)
          : await api.json(command.path, command.method, command.body, command.version, command.writeToken, command.query);
        results.push(result);
        if ('data' in result && result.data?.failed && Object.keys(result.data.failed).length) {
          this.store.audit?.(principal.id, plan.tool, 'partial_failure');
          return { status: 'partial_failure', results, stoppedAt: index, remaining: plan.commands.length - index - 1, message: 'Inspect successful and failed entries before preparing another plan. Writes are not transactional.' };
        }
      } catch (error) {
        this.store.audit?.(principal.id, plan.tool, 'failed_or_partial');
        return { status: 'failed_or_partial', results, stoppedAt: index, remaining: plan.commands.length - index - 1, error: publicError(error), message: 'The last operation may have reached Zotero. Inspect remote state before preparing another plan; never blindly repeat it.' };
      }
    }
    this.store.audit?.(principal.id, plan.tool, 'completed');
    return { status: 'completed', results };
  }
}
