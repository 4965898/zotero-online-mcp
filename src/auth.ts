import type { Express, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import type { Config } from './config.js';
import { AppError } from './errors.js';
import { equalSecret, hash, secret, Store, type Principal } from './store.js';
import { Zotero, type Fetcher } from './zotero.js';

const apiKeySchema = z.string().regex(/^[A-Za-z0-9]{16,64}$/);
const escape = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
// Service tokens are 43-char base64url. Zotero API keys are 24-char alphanumerics, which is why the
// original {32,128} pattern rejected them outright; the lower bound now admits both credential kinds.
export function bearer(req: Request) {
  const match = /^Bearer ([A-Za-z0-9_-]{16,128})$/.exec(req.get('authorization') ?? '');
  if (!match) throw new AppError('UNAUTHORIZED', 'Provide a Zotero API key or a service token in Authorization: Bearer', 401);
  return match[1];
}
const looksLikeZoteroKey = (value: string) => /^[A-Za-z0-9]{16,64}$/.test(value) && !/^[A-Za-z0-9_-]{43}$/.test(value);

// Resolves a Bearer credential to a principal. Two kinds are accepted:
//  1. A service token issued by this server (looked up in the store).
//  2. A raw Zotero API key, when PASSTHROUGH_KEYS is on — the key is verified against Zotero once
//     and then registered as a normal principal, so every downstream tool path is unchanged.
// Verification results are cached briefly so each request does not cost an upstream round trip.
export function makeAuthenticator(config: Config, store: Store, fetcher: Fetcher) {
  // The cache stores the Zotero user id (numeric), NOT the internal principal id. derivePrincipal
  // needs the Zotero id on cache hits: tools that omit the library build /users/<id>/ paths from
  // principal.userId, and passing the internal id there makes Zotero answer 400.
  const checked = new Map<string, { at: number; userId: string } | null>();
  const VERIFY_TTL_MS = 5 * 60000, MAX_ENTRIES = 500;
  return async function authenticate(req: Request): Promise<Principal> {
    const credential = bearer(req);
    try { return store.authenticate(credential); } catch (error) {
      if (!(error instanceof AppError) || !config.passthroughKeys || !looksLikeZoteroKey(credential)) throw error;
    }
    const cached = checked.get(credential);
    if (cached && Date.now() - cached.at < VERIFY_TTL_MS) {
      if (!cached.userId) throw new AppError('UNAUTHORIZED', 'This Zotero API key is not valid', 401);
      return derivePrincipal(config, store, credential, cached.userId);
    }
    let userId = '';
    try {
      const result = await new Zotero(credential, fetcher).request('/keys/current');
      userId = String((result.data as any)?.userID ?? '');
    } catch { /* Recorded as a negative cache entry below. */ }
    if (!/^[1-9]\d*$/.test(userId)) {
      if (checked.size >= MAX_ENTRIES) checked.clear();
      checked.set(credential, null);
      throw new AppError('UNAUTHORIZED', 'This Zotero API key is not valid', 401);
    }
    if (checked.size >= MAX_ENTRIES) checked.clear();
    checked.set(credential, { at: Date.now(), userId });
    return derivePrincipal(config, store, credential, userId);
  };
}
function derivePrincipal(config: Config, store: Store, credential: string, userId: string) {
  // connect() is idempotent per key, so the principal id is stable across requests.
  const id = store.connect(userId, credential);
  return { id, userId, apiKey: credential, tokenHash: '' } satisfies Principal;
}
interface Client { client_id: string; client_name: string; redirect_uris: string[]; }
interface Grant { client: string; redirect: string; challenge: string; state?: string; csrf: string; }
interface Code extends Grant { user: string; }
const redirectSchema = z.string().url().max(2000).refine(s => {
  const u = new URL(s);
  return !u.hash && !u.username && !u.password && (u.protocol === 'https:' || (u.protocol === 'http:' && ['127.0.0.1', '[::1]', 'localhost'].includes(u.hostname)));
}, 'Redirects require HTTPS or loopback HTTP and must not contain credentials or a fragment');

export function authRoutes(app: Express, config: Config, store: Store, fetcher: Fetcher, authenticate: (req: Request) => Promise<Principal>) {
  const limiter = rateLimit({ windowMs: 15 * 60000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });
  app.use(['/api/connect', '/oauth/register', '/oauth/authorize', '/oauth/token'], limiter);
  async function enroll(apiKey: string, invite: string | undefined) {
    if (config.signupSecret && !equalSecret(invite ?? '', config.signupSecret)) throw new AppError('INVITE_REQUIRED', 'A valid operator invitation code is required', 403);
    const result = await new Zotero(apiKey, fetcher).request('/keys/current');
    const userId = String(result.data.userID ?? '');
    if (!/^[1-9]\d*$/.test(userId)) throw new AppError('INVALID_KEY', 'Zotero did not return a valid user ID', 401);
    return { user: store.connect(userId, apiKey), userId, access: result.data.access };
  }
  app.post('/api/connect', async (req, res) => {
    if (!req.is('application/json')) throw new AppError('JSON_REQUIRED', 'Use application/json', 415);
    const a = z.object({ apiKey: apiKeySchema, signupSecret: z.string().optional() }).strict().parse(req.body);
    const result = await enroll(a.apiKey, a.signupSecret);
    // In passthrough mode the client is told to send its Zotero key directly, so no service token is
    // minted at all. Callers that want the token flow can still get one by ignoring access_token.
    const token = config.passthroughKeys ? a.apiKey : store.issue(result.user, 'access', config.tokenTtlMs);
    res.json({
      access_token: token, token_type: 'Bearer',
      expires_in: config.passthroughKeys ? null : Math.floor(config.tokenTtlMs / 1000) || null,
      expires_at: config.passthroughKeys || !config.tokenTtlMs ? null : new Date(Date.now() + config.tokenTtlMs).toISOString(),
      token_kind: config.passthroughKeys ? 'zotero-api-key' : 'service-token',
      userId: result.userId, permissions: result.access,
      endpoints: { streamableHttp: `${config.publicUrl}/mcp`, sse: `${config.publicUrl}/sse` },
    });
  });
  app.get('/api/account', async (req, res) => { const p = await authenticate(req); res.json({ userId: p.userId, writesEnabled: config.enableWrites }); });
  app.delete('/api/account', async (req, res) => { const p = await authenticate(req); store.disconnect(p.id); res.status(204).end(); });
  // Only service tokens can be revoked; a passthrough Zotero key is revoked in Zotero itself.
  app.post('/api/revoke', async (req, res) => { const p = await authenticate(req); if (p.tokenHash) store.revoke(bearer(req)); res.status(204).end(); });

  app.get(['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp', '/.well-known/oauth-protected-resource/sse'], (_req, res) => res.json({ resource: `${config.publicUrl}/mcp`, authorization_servers: [config.publicUrl], scopes_supported: ['zotero'], bearer_methods_supported: ['header'], resource_name: 'Zotero Online MCP' }));
  app.get('/.well-known/oauth-authorization-server', (_req, res) => res.json({
    issuer: config.publicUrl, authorization_endpoint: `${config.publicUrl}/oauth/authorize`, token_endpoint: `${config.publicUrl}/oauth/token`, registration_endpoint: `${config.publicUrl}/oauth/register`, revocation_endpoint: `${config.publicUrl}/oauth/revoke`,
    response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'], token_endpoint_auth_methods_supported: ['none'], code_challenge_methods_supported: ['S256'], scopes_supported: ['zotero'],
  }));
  app.post('/oauth/register', (req, res) => {
    const a = z.object({ client_name: z.string().max(100).default('MCP client'), redirect_uris: z.array(redirectSchema).min(1).max(10), token_endpoint_auth_method: z.literal('none').optional(), grant_types: z.array(z.enum(['authorization_code', 'refresh_token'])).optional(), response_types: z.array(z.literal('code')).optional() }).passthrough().parse(req.body);
    const count = store.db.prepare("SELECT count(*) AS n FROM ephemeral WHERE kind='client' AND expires>?").get(Date.now()) as { n: number };
    if (count.n >= 5000) throw new AppError('REGISTRATION_LIMIT', 'Client registration capacity reached', 429);
    const client: Client = { client_id: secret(), client_name: a.client_name, redirect_uris: a.redirect_uris };
    store.put('client', client.client_id, client, 365 * 86400000);
    res.status(201).json({ ...client, token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] });
  });
  app.get('/oauth/authorize', (req, res) => {
    const a = z.object({ client_id: z.string(), redirect_uri: redirectSchema, response_type: z.literal('code'), code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/), code_challenge_method: z.literal('S256'), state: z.string().max(2000).optional(), resource: z.literal(`${config.publicUrl}/mcp`), scope: z.literal('zotero').optional() }).parse(req.query);
    const client = store.get<Client>('client', a.client_id);
    if (!client || !client.redirect_uris.includes(a.redirect_uri)) throw new AppError('INVALID_CLIENT', 'Unknown client or unregistered redirect URI');
    const id = secret(), csrf = secret();
    store.put('grant', hash(id), { client: a.client_id, redirect: a.redirect_uri, challenge: a.code_challenge, state: a.state, csrf } satisfies Grant, 10 * 60000);
    res.cookie('zomcp_consent', csrf, { httpOnly: true, secure: config.publicUrl.startsWith('https:'), sameSite: 'lax', maxAge: 600000, path: '/oauth/authorize' });
    res.type('html').send(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><title>授权 Zotero Online MCP</title></head><body><main class="consent"><div class="eyebrow">ZOTERO ONLINE MCP</div><h1>连接你的文献库</h1><p>应用 <strong>${escape(client.client_name)}</strong> 请求通过本服务访问你的 Zotero 在线文献库。</p><p>回调地址：<code>${escape(a.redirect_uri)}</code></p><p>权限：读取文献和附件${config.enableWrites ? '，并在工具预览确认后写入、上传及删除内容' : '（服务器已关闭写入）'}。范围同时受你提供的 Zotero key 权限限制。</p><form method="post" action="/oauth/authorize"><input type="hidden" name="grant" value="${id}"><label>Zotero API key<input name="apiKey" type="password" required autocomplete="off"></label>${config.signupSecret ? '<label>邀请码<input name="signupSecret" type="password" required></label>' : ''}<label class="check"><input type="checkbox" name="approved" value="yes" required>我信任此应用，并同意上述权限</label><button type="submit">授权连接</button></form><p class="muted">密钥在服务端加密保存，不会交给请求授权的应用。可在主页撤销连接。</p></main></body></html>`);
  });
  app.post('/oauth/authorize', async (req, res) => {
    const a = z.object({ grant: z.string(), apiKey: apiKeySchema, signupSecret: z.string().optional(), approved: z.literal('yes') }).strict().parse(req.body);
    const grant = store.get<Grant>('grant', hash(a.grant));
    const cookie = /(?:^|;\s*)zomcp_consent=([^;]+)/.exec(req.get('cookie') ?? '')?.[1] ?? '';
    if (!grant || !equalSecret(cookie, grant.csrf)) throw new AppError('INVALID_CONSENT', 'Consent expired or CSRF validation failed', 403);
    const user = await enroll(a.apiKey, a.signupSecret);
    if (!store.take('grant', hash(a.grant))) throw new AppError('INVALID_CONSENT', 'Consent already used', 403);
    const code = secret(); store.put('code', hash(code), { ...grant, user: user.user } satisfies Code, 60000, user.user);
    const redirect = new URL(grant.redirect); redirect.searchParams.set('code', code); if (grant.state) redirect.searchParams.set('state', grant.state);
    res.clearCookie('zomcp_consent', { path: '/oauth/authorize' }); res.redirect(303, redirect.toString());
  });
  const tokenResponse = (res: Response, user: string, client: string) => res.json({ access_token: store.issue(user, 'access', config.tokenTtlMs, client), token_type: 'Bearer', expires_in: Math.floor(config.tokenTtlMs / 1000) || null, refresh_token: store.issue(user, 'refresh', config.tokenTtlMs, client), scope: 'zotero' });
  app.post('/oauth/token', (req, res) => {
    const a = z.object({ grant_type: z.enum(['authorization_code', 'refresh_token']), client_id: z.string(), code: z.string().optional(), redirect_uri: z.string().optional(), code_verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/).optional(), refresh_token: z.string().optional(), resource: z.literal(`${config.publicUrl}/mcp`) }).parse(req.body);
    if (a.grant_type === 'refresh_token') {
      if (!a.refresh_token) throw new AppError('invalid_grant', 'Missing refresh token');
      const p = store.authenticate(a.refresh_token, 'refresh', a.client_id); store.revoke(a.refresh_token); tokenResponse(res, p.id, a.client_id); return;
    }
    const code = store.get<Code>('code', hash(a.code ?? ''));
    const challenge = createHash('sha256').update(a.code_verifier ?? '').digest('base64url');
    if (!code || code.client !== a.client_id || code.redirect !== a.redirect_uri || !equalSecret(code.challenge, challenge)) throw new AppError('invalid_grant', 'Authorization code, redirect URI, client, or PKCE verifier is invalid');
    store.take('code', hash(a.code!)); tokenResponse(res, code.user, a.client_id);
  });
  app.post('/oauth/revoke', (req, res) => { const a = z.object({ token: z.string().max(256) }).parse(req.body); store.revoke(a.token); res.status(200).end(); });
}
