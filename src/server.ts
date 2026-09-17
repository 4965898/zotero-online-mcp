import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { Config } from './config.js';
import { AppError, publicError } from './errors.js';
import { Store, type Principal } from './store.js';
import { Zotero, type Fetcher } from './zotero.js';
import { Plans } from './plans.js';
import { tools, type ToolContext } from './tools.js';
import './extensions.js';
import { authRoutes, makeAuthenticator } from './auth.js';
import { mcpServer } from './mcp.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

type Session = { principal: Principal; transport: StreamableHTTPServerTransport | SSEServerTransport; server: Server; touched: number; };

// Hosts this server answers for. Beyond the configured public origin and loopback, every local
// interface address is accepted so a phone can reach the LAN IP directly. Without this, a request
// carrying Host: 192.168.x.x:3000 is answered with 403 even though the port is open and reachable.
export function allowedHostsFor(config: Config, extra: string[] = []): Set<string> {
  const hosts = new Set<string>([new URL(config.publicUrl).host, `localhost:${config.port}`, `127.0.0.1:${config.port}`, `[::1]:${config.port}`]);
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4') hosts.add(`${address.address}:${config.port}`);
      else if (address.family === 'IPv6') hosts.add(`[${address.address}]:${config.port}`);
    }
  }
  for (const host of extra) hosts.add(host);
  return hosts;
}
export function createApp(config: Config, options: { store?: Store; fetcher?: Fetcher } = {}) {
  const store = options.store ?? new Store(config.databasePath, config.encryptionKey), fetcher = options.fetcher ?? fetch;
  const app = express(), sessions = new Map<string, Session>(), plans = new Plans(store.planStore(), config.enableWrites);
  // Accepts service tokens and, when enabled, raw Zotero API keys. Async because verifying a
  // passthrough key requires one upstream call.
  const authenticateRequest = makeAuthenticator(config, store, fetcher);
  app.disable('x-powered-by'); app.set('trust proxy', config.trustProxy);
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], formAction: ["'self'"], frameAncestors: ["'none'"], upgradeInsecureRequests: config.publicUrl.startsWith('https:') ? [] : null } } }));
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store'); res.set('Referrer-Policy', 'no-referrer');
    const host = req.get('host'), allowedHosts = allowedHostsFor(config);
    if (!host || !allowedHosts.has(host)) return res.status(403).json({ error: 'Invalid Host header' });
    const origin = req.get('origin');
    if (origin && !config.origins.includes(origin)) return res.status(403).json({ error: 'Origin is not allowed' });
    if (origin) { res.set('Access-Control-Allow-Origin', origin); res.vary('Origin'); }
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID');
    res.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.set('Access-Control-Expose-Headers', 'Mcp-Session-Id, WWW-Authenticate');
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });
  app.use(rateLimit({ windowMs: 60000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.use(express.json({ limit: Math.ceil(config.maxFileBytes * 4 / 3) + 65536 }));
  app.use(express.urlencoded({ extended: false, limit: '16kb' }));
  app.get('/healthz', (_req, res) => res.json({ status: 'ok', service: 'zotero-online-mcp', version: '0.1.0' }));
  app.get('/readyz', (_req, res) => { store.db.prepare('SELECT 1').get(); res.json({ status: 'ready' }); });
  app.get('/api/info', (_req, res) => res.json({ name: 'Zotero Online MCP', version: '0.1.0', tools: tools.filter(t => config.enableWrites || !t.write).map(t => ({ name: t.name, description: t.description, write: t.write })), inviteRequired: !!config.signupSecret, writesEnabled: config.enableWrites, semanticConfigured: !!config.embeddingUrl, tokenTtlDays: Math.round(config.tokenTtlMs / 86400000), passthroughKeys: config.passthroughKeys, publicUrl: config.publicUrl }));
  authRoutes(app, config, store, fetcher, authenticateRequest);
  const protect = async (req: Request, res: Response, next: NextFunction) => {
    try { res.locals.principal = await authenticateRequest(req); next(); } catch (e) { next(e); }
  };
  app.use(['/mcp', '/sse', '/messages'], protect);
  function context(principal: Principal): ToolContext { return { principal, api: new Zotero(principal.apiKey, fetcher), plans, config, fetcher }; }
  function capacity(principal: Principal) {
    if (sessions.size >= config.maxSessions || [...sessions.values()].filter(s => s.principal.id === principal.id).length >= 10) throw new AppError('SESSION_LIMIT', 'Session capacity reached; close unused clients', 429);
  }
  function findSession(id: string, principal: Principal) {
    const s = sessions.get(id);
    if (!s || s.principal.id !== principal.id || s.principal.tokenHash !== principal.tokenHash || !store.isActive(s.principal.tokenHash)) throw new AppError('SESSION_NOT_FOUND', 'Unknown, expired or inaccessible MCP session; initialize a new session', 404);
    s.touched = Date.now(); return s;
  }
  app.all('/mcp', async (req, res) => {
    const p = res.locals.principal as Principal, sessionId = req.get('mcp-session-id');
    if (sessionId) {
      const session = findSession(sessionId, p);
      if (!(session.transport instanceof StreamableHTTPServerTransport)) throw new AppError('WRONG_TRANSPORT', 'Session uses another transport');
      await session.transport.handleRequest(req, res, req.body); return;
    }
    if (req.method !== 'POST' || !isInitializeRequest(req.body)) throw new AppError('INITIALIZE_REQUIRED', 'Initialize a session with POST /mcp', 400);
    capacity(p);
    const id = randomUUID(), transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => id });
    const server = mcpServer(context(p), principal => store.isActive(principal.tokenHash));
    sessions.set(id, { principal: p, server, transport, touched: Date.now() });
    await server.connect(transport);
    const originalClose = transport.onclose;
    transport.onclose = () => { sessions.delete(id); originalClose?.(); };
    try { await transport.handleRequest(req, res, req.body); }
    catch (e) { sessions.delete(id); await server.close(); throw e; }
    if (!transport.sessionId) { sessions.delete(id); await server.close(); }
  });
  app.get('/sse', async (_req, res) => {
    const p = res.locals.principal as Principal; capacity(p);
    const transport = new SSEServerTransport('/messages', res), server = mcpServer(context(p), principal => store.isActive(principal.tokenHash));
    sessions.set(transport.sessionId, { principal: p, transport, server, touched: Date.now() });
    res.set('X-Accel-Buffering', 'no');
    await server.connect(transport);
    const originalClose = transport.onclose;
    transport.onclose = () => { sessions.delete(transport.sessionId); originalClose?.(); };
  });
  app.post('/messages', async (req, res) => {
    const id = z.string().uuid().parse(req.query.sessionId), s = findSession(id, res.locals.principal);
    if (!(s.transport instanceof SSEServerTransport)) throw new AppError('WRONG_TRANSPORT', 'Session uses another transport');
    await s.transport.handlePostMessage(req, res, req.body);
  });
  app.use(express.static(fileURLToPath(new URL('../public', import.meta.url)), { etag: false }));
  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) { res.end(); return; }
    if (error instanceof AppError && error.status === 401) res.set('WWW-Authenticate', `Bearer resource_metadata="${config.publicUrl}/.well-known/oauth-protected-resource", scope="zotero"`);
    const status = error instanceof AppError ? error.status : error instanceof z.ZodError ? 400 : (error as any)?.type === 'entity.too.large' ? 413 : (error as any)?.type === 'entity.parse.failed' ? 400 : 500;
    if (req.path.startsWith('/oauth/')) { res.status(status).json({ error: status === 401 ? 'invalid_token' : status === 500 ? 'server_error' : 'invalid_request', error_description: error instanceof AppError ? error.message : 'Invalid request' }); return; }
    res.status(status >= 400 && status <= 599 ? status : 502).json(error instanceof z.ZodError ? { code: 'INVALID_INPUT', message: 'Invalid input fields' } : publicError(error));
  });
  const timer = setInterval(() => {
    store.cleanup();
    for (const [id, s] of sessions) if (Date.now() - s.touched > config.sessionTtlMs || !store.isActive(s.principal.tokenHash)) { sessions.delete(id); void s.server.close(); }
  }, 30000); timer.unref();
  return { app, store, sessions, close: async () => { clearInterval(timer); await Promise.allSettled([...sessions.values()].map(s => s.server.close())); sessions.clear(); store.close(); } };
}
