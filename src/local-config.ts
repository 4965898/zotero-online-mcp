import { z } from 'zod';
import type { Config } from './config.js';

// Local (stdio) configuration. It deliberately drops everything the hosted service needs
// (ports, origins, signup secrets, encryption keys) and keeps only what a single-user
// process requires, so setup is two environment variables at most.
export function loadLocalConfig(env = process.env): Config {
  const key = (env.ZOTERO_API_KEY ?? '').trim();
  if (!key) throw new Error('Set ZOTERO_API_KEY to a Zotero API key from https://www.zotero.org/settings/keys/new');
  if (!/^[A-Za-z0-9]{16,64}$/.test(key)) throw new Error('ZOTERO_API_KEY does not look like a Zotero API key');
  const envUrl = (env.EMBEDDING_URL ?? '').trim() || undefined;
  if (envUrl && new URL(envUrl).protocol !== 'https:') throw new Error('EMBEDDING_URL requires HTTPS');
  const integer = (value: string | undefined, fallback: number, max: number) => z.coerce.number().int().min(1).max(max).parse(value ?? fallback);
  return {
    port: 0, host: '127.0.0.1', publicUrl: 'http://localhost',
    databasePath: ':memory:', encryptionKey: Buffer.alloc(32),
    origins: [], signupSecret: undefined,
    // Local writes are opt-in: the process serves one trusted user, but reads stay the safe default.
    enableWrites: env.ZOTERO_WRITE === 'true' || env.ENABLE_WRITES === 'true',
    maxSessions: 1, sessionTtlMs: 0,
    maxFileBytes: integer(env.MAX_FILE_MB, 20, 100) * 1024 * 1024,
    embeddingUrl: envUrl, embeddingKey: (env.EMBEDDING_API_KEY ?? '').trim() || undefined, embeddingModel: (env.EMBEDDING_MODEL ?? '').trim() || undefined,
    trustProxy: 0, tokenTtlMs: 0,
    // A local process holds the key itself, so key passthrough is meaningless there.
    passthroughKeys: false,
    apiKey: key, userId: (env.ZOTERO_USER_ID ?? '').trim() || undefined,
  };
}
