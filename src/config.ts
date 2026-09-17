import { z } from 'zod';

export interface Config {
  port: number; host: string; publicUrl: string; databasePath: string; encryptionKey: Buffer;
  origins: string[]; signupSecret?: string; enableWrites: boolean; maxSessions: number;
  sessionTtlMs: number; maxFileBytes: number; embeddingUrl?: string; embeddingKey?: string;
  embeddingModel?: string; trustProxy: number; tokenTtlMs: number;
  // When true, clients may authenticate by sending a raw Zotero API key as the Bearer credential
  // instead of a service token. Convenient for single-user setups; off by default because it hands
  // every client the upstream key and removes per-client revocation.
  passthroughKeys: boolean;
  // Present only in local/stdio mode, where the process serves exactly one Zotero account.
  apiKey?: string; userId?: string;
}

export function loadConfig(env = process.env): Config {
  const publicUrl = (env.PUBLIC_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const url = new URL(publicUrl);
  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('PUBLIC_URL must be an origin');
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Public deployments require HTTPS');
  const key = env.ENCRYPTION_KEY ?? '';
  if (!/^[a-fA-F0-9]{64}$/.test(key)) throw new Error('Set ENCRYPTION_KEY to 32 random bytes in hex (see README)');
  const integer = (value: string | undefined, fallback: number, max: number) => z.coerce.number().int().min(1).max(max).parse(value ?? fallback);
  if (env.EMBEDDING_URL && new URL(env.EMBEDDING_URL).protocol !== 'https:') throw new Error('EMBEDDING_URL requires HTTPS');
  return {
    port: integer(env.PORT, 3000, 65535), host: env.HOST ?? '127.0.0.1', publicUrl,
    databasePath: env.DATABASE_PATH ?? 'data/service.sqlite', encryptionKey: Buffer.from(key, 'hex'),
    origins: [url.origin, ...(env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean)],
    signupSecret: env.SIGNUP_SECRET || undefined, enableWrites: env.ENABLE_WRITES === 'true',
    maxSessions: integer(env.MAX_SESSIONS, 500, 10000), sessionTtlMs: integer(env.SESSION_TTL_MINUTES, 30, 1440) * 60000,
    maxFileBytes: integer(env.MAX_FILE_MB, 20, 100) * 1024 * 1024,
    embeddingUrl: env.EMBEDDING_URL, embeddingKey: env.EMBEDDING_API_KEY, embeddingModel: env.EMBEDDING_MODEL,
    trustProxy: z.coerce.number().int().min(0).max(5).parse(env.TRUST_PROXY_HOPS ?? 0),
    // TOKEN_TTL_DAYS=0 (default) issues tokens that never expire. Positive values restore a fixed lifetime.
    tokenTtlMs: z.coerce.number().int().min(0).max(3650).parse(env.TOKEN_TTL_DAYS ?? 0) * 86400000,
    passthroughKeys: env.PASSTHROUGH_KEYS === 'true',
  };
}
