import { randomBytes } from 'node:crypto';
import type { Config } from '../src/config.js';
import { createApp } from '../src/server.js';
import type { Fetcher } from '../src/zotero.js';

export function config(): Config {
  return { port: 0, host: '127.0.0.1', publicUrl: 'http://localhost:3000', databasePath: ':memory:', encryptionKey: randomBytes(32), origins: [], enableWrites: true, maxSessions: 50, sessionTtlMs: 1800000, maxFileBytes: 1024 * 1024, trustProxy: 0, tokenTtlMs: 0, passthroughKeys: false };
}
export function json(data: any, status = 200, headers: Record<string, string> = {}) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } }); }
export function fixture() {
  const calls: { url: URL; init: RequestInit; headers: Headers; body: any }[] = [];
  const items: Record<string, any> = {
    ABCD1234: { key: 'ABCD1234', version: 7, data: { key: 'ABCD1234', version: 7, itemType: 'journalArticle', title: 'Memory and Learning', abstractNote: 'Research on cognition', DOI: '10.1234/test', tags: [{ tag: 'keep', type: 1 }], collections: ['COLL1234'], creators: [], relations: {} } },
    FILE1234: { key: 'FILE1234', version: 8, data: { itemType: 'attachment', linkMode: 'imported_file', filename: 'paper.pdf', contentType: 'application/pdf', parentItem: 'ABCD1234', md5: null } },
  };
  const fetcher: Fetcher = async (input, init = {}) => {
    const url = new URL(String(input)), headers = new Headers(init.headers); let body: any = init.body;
    if (typeof body === 'string' && headers.get('content-type') === 'application/json') body = JSON.parse(body);
    calls.push({ url, init, headers, body });
    if (url.hostname !== 'api.zotero.org') throw new Error('Unexpected external access');
    if (url.pathname === '/keys/current') { const apiKey = headers.get('Zotero-API-Key')!; return json({ userID: apiKey.startsWith('B') ? 222 : 111, key: apiKey, username: 'test', access: { user: { library: true, write: true } } }); }
    if (init.method === 'POST' && url.pathname.endsWith('/items')) return json({ successful: Object.fromEntries(body.map((d: any, i: number) => [String(i), { key: d.key ?? 'NEWI1234', data: d }])), unchanged: {}, failed: {} });
    if (init.method === 'PATCH' || init.method === 'DELETE' || init.method === 'PUT') return new Response(null, { status: 204, headers: { 'Last-Modified-Version': '9' } });
    if (url.pathname.endsWith('/fulltext')) return json({ content: 'Full text of a test paper.', indexedPages: 1, totalPages: 1 });
    const item = /\/items\/([A-Z0-9]{8})$/.exec(url.pathname)?.[1]; if (item) return items[item] ? json(items[item], 200, { 'Last-Modified-Version': String(items[item].version) }) : json({}, 404);
    if (url.pathname.endsWith('/children')) return json([items.FILE1234], 200, { 'Total-Results': '1' });
    if (url.pathname.endsWith('/groups')) return json([], 200, { 'Total-Results': '0' });
    return json([items.ABCD1234], 200, { 'Total-Results': '1', 'Last-Modified-Version': '9' });
  };
  return { fetcher, calls, items };
}
export async function running(fetcher: Fetcher, overrides: Partial<Config> = {}) {
  const cfg = { ...config(), ...overrides }; const service = createApp(cfg, { fetcher });
  const http = service.app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => http.once('listening', resolve));
  cfg.port = (http.address() as any).port; cfg.publicUrl = `http://127.0.0.1:${cfg.port}`;
  // The test server must allow its own origin; origins passed in by the caller are kept, not
  // replaced, so tests can exercise the ALLOWED_ORIGINS path.
  cfg.origins = [cfg.publicUrl, ...cfg.origins];
  const connect = async (key = 'A'.repeat(24)) => {
    const r = await fetch(cfg.publicUrl + '/api/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: key, signupSecret: cfg.signupSecret }) });
    if (!r.ok) throw new Error(await r.text()); return (await r.json()).access_token as string;
  };
  return { ...service, config: cfg, url: cfg.publicUrl, connect, close: async () => { await service.close(); http.closeAllConnections(); await new Promise<void>(resolve => http.close(() => resolve())); } };
}
