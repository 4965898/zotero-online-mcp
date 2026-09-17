import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { fixture, json, running } from './helpers.js';
import { allowedHostsFor, allowedOriginsFor } from '../src/server.js';
import type { Fetcher } from '../src/zotero.js';

// A Zotero API key is a 24-character alphanumeric string, which is shorter than the service tokens
// this server issues. These tests pin that both credential shapes are accepted at the HTTP edge.

test('passthrough off: a raw Zotero key is rejected and no upstream call is made', async () => {
  const f = fixture(), s = await running(f.fetcher, { passthroughKeys: false });
  try {
    const response = await fetch(s.url + '/mcp', {
      method: 'POST',
      headers: { Authorization: `Bearer ${'A'.repeat(24)}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    assert.equal(response.status, 401);
    assert.equal(f.calls.filter(c => c.url.pathname === '/keys/current').length, 0, 'a disabled passthrough must not reach Zotero');
  } finally { await s.close(); }
});

test('passthrough on: a real Zotero key authenticates an HTTP MCP session', async () => {
  const f = fixture(), s = await running(f.fetcher, { passthroughKeys: true });
  try {
    const key = 'B'.repeat(24);
    const client = new Client({ name: 'phone', version: '1' });
    const transport = new StreamableHTTPClientTransport(new URL(s.url + '/mcp'), { requestInit: { headers: { Authorization: `Bearer ${key}` } } });
    await client.connect(transport);
    const list = await client.listTools();
    assert.ok(list.tools.length > 0, 'tools must be discoverable with a passthrough key');
    assert.ok(list.tools.some(t => t.name === 'get_libraries'));
    await client.close();
  } finally { await s.close(); }
});

test('passthrough on: an invalid Zotero key is rejected with 401', async () => {
  const f = fixture(), s = await running(f.fetcher, { passthroughKeys: true });
  try {
    // The fixture only returns a userID when the upstream call succeeds; an unknown key yields none.
    const bad = fixture();
    bad.fetcher = async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname === '/keys/current') return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      return f.fetcher(input, init);
    };
    const alt = await running(bad.fetcher, { passthroughKeys: true });
    try {
      const response = await fetch(alt.url + '/mcp', {
        method: 'POST',
        headers: { Authorization: `Bearer ${'C'.repeat(24)}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      });
      assert.equal(response.status, 401);
    } finally { await alt.close(); }
  } finally { await s.close(); }
});

test('passthrough on: a key is verified upstream only once across repeated requests', async () => {
  const f = fixture(), s = await running(f.fetcher, { passthroughKeys: true });
  try {
    const key = 'D'.repeat(24), headers = { Authorization: `Bearer ${key}` };
    assert.equal((await fetch(s.url + '/api/account', { headers })).status, 200);
    assert.equal((await fetch(s.url + '/api/account', { headers })).status, 200);
    assert.equal((await fetch(s.url + '/api/account', { headers })).status, 200);
    const checks = f.calls.filter(c => c.url.pathname === '/keys/current').length;
    assert.equal(checks, 1, 'the verification cache must absorb repeat requests');
  } finally { await s.close(); }
});

test('passthrough on: /api/connect returns the Zotero key itself, without minting a token', async () => {
  const f = fixture(), s = await running(f.fetcher, { passthroughKeys: true });
  try {
    const key = 'A'.repeat(24);
    const response = await fetch(s.url + '/api/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: key }) });
    const body = await response.json() as any;
    assert.equal(response.status, 200);
    assert.equal(body.access_token, key);
    assert.equal(body.token_kind, 'zotero-api-key');
    assert.equal(body.expires_in, null);
    assert.equal(s.store.db.prepare('SELECT count(*) n FROM tokens').get()!['n'], 0, 'no service token should be stored');
  } finally { await s.close(); }
});

test('passthrough off: /api/connect still mints a service token', async () => {
  const f = fixture(), s = await running(f.fetcher, { passthroughKeys: false });
  try {
    const token = await s.connect();
    const body = await (await fetch(s.url + '/api/account', { headers: { Authorization: `Bearer ${token}` } })).json() as any;
    assert.equal(body.userId, '111');
    const info = await (await fetch(s.url + '/api/info')).json() as any;
    assert.equal(info.passthroughKeys, false);
    assert.equal(info.tokenTtlDays, 0);
  } finally { await s.close(); }
});

test('service tokens keep working while passthrough is enabled', async () => {
  const f = fixture(), s = await running(f.fetcher, { passthroughKeys: true });
  try {
    // /api/connect hands back the Zotero key in passthrough mode, so mint a service token directly
    // to prove the store-backed path still resolves alongside key passthrough.
    const user = s.store.connect('111', 'A'.repeat(24));
    const token = s.store.issue(user, 'access', 0);
    assert.equal(token.length, 43);
    assert.equal((await fetch(s.url + '/api/account', { headers: { Authorization: `Bearer ${token}` } })).status, 200);
    const client = new Client({ name: 'pc', version: '1' });
    await client.connect(new StreamableHTTPClientTransport(new URL(s.url + '/mcp'), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
    const list = await client.listTools();
    assert.ok(list.tools.some(t => t.name === 'get_libraries'));
    await client.close();
  } finally { await s.close(); }
});

test('a malformed Bearer value is rejected before any lookup', async () => {
  const f = fixture(), s = await running(f.fetcher, { passthroughKeys: true });
  try {
    for (const value of ['', 'short', 'has spaces in it', 'x'.repeat(200)]) {
      const response = await fetch(s.url + '/api/account', { headers: { Authorization: `Bearer ${value}` } });
      assert.equal(response.status, 401, `expected 401 for ${JSON.stringify(value)}`);
    }
    assert.equal(f.calls.filter(c => c.url.pathname === '/keys/current').length, 0);
  } finally { await s.close(); }
});

// A phone reaches the server by LAN IP, so the Host allowlist must include local interface
// addresses. Rejecting them with 403 looks exactly like "the phone cannot connect".
test('local interface addresses are accepted as Host values', async () => {
  const f = fixture(), s = await running(f.fetcher, { passthroughKeys: true });
  try {
    const hosts = allowedHostsFor(s.config);
    assert.ok(hosts.size >= 3, 'loopback and public origin must always be present');
    const lan = [...hosts].filter(h => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h));
    for (const host of lan) {
      const response = await fetch(s.url + '/healthz', { headers: { Host: host } });
      assert.equal(response.status, 200, `LAN host ${host} must be accepted`);
    }
    // The allowlist must still reject anything that is not this machine.
    assert.equal(hosts.has('evil.example'), false);
  } finally { await s.close(); }
});

// Desktop MCP clients fetch from their native runtime and present their own app origin instead of
// a web origin. NoteGen is a Tauri app: tauri://localhost on macOS/Linux, http(s)://tauri.localhost
// on Windows. With ALLOWED_ORIGINS empty every one of those was answered with 403, which looks
// exactly like "NoteGen cannot connect while Cherry Studio works" — Cherry Studio sends no Origin.
test('desktop app origins and local http origins are accepted; foreign web origins are not', async () => {
  const f = fixture(), s = await running(f.fetcher, { passthroughKeys: true });
  try {
    const origins = allowedOriginsFor(s.config);
    for (const origin of ['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost']) {
      assert.ok(origins.has(origin), `${origin} must be allowed`);
      assert.equal((await fetch(s.url + '/healthz', { headers: { Origin: origin } })).status, 200, `${origin} must be answered`);
    }
    // Local http origins, so the landing page works when opened by LAN IP.
    const lan = [...origins].find(o => /^http:\/\/(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(o));
    if (lan) assert.equal((await fetch(s.url + '/healthz', { headers: { Origin: lan } })).status, 200, `${lan} must be answered`);
    assert.ok(origins.has(`http://127.0.0.1:${s.config.port}`), 'loopback origin must be allowed');
    // A real web origin is still refused, and would-be attackers cannot borrow the desktop origins.
    assert.equal((await fetch(s.url + '/healthz', { headers: { Origin: 'https://evil.example' } })).status, 403);
    assert.equal(origins.has('https://evil.example'), false);
    // Operators can still admit extra origins explicitly.
    const alt = await running(f.fetcher, { passthroughKeys: true, origins: ['https://notes.example'] });
    try {
      assert.equal((await fetch(alt.url + '/healthz', { headers: { Origin: 'https://notes.example' } })).status, 200);
      assert.equal((await fetch(alt.url + '/healthz', { headers: { Origin: 'https://other.example' } })).status, 403);
    } finally { await alt.close(); }
  } finally { await s.close(); }
});

// The verification cache once stored the internal principal id where the Zotero user id belongs,
// so every cache-hit request within the TTL built /users/<principal-uuid>/ and Zotero answered 400
// — the "every tool fails" report. The permissive fake upstream hid the bug: real Zotero rejects
// unknown user ids with 400, so this fixture must do the same for the regression to be observable.
test('passthrough cache hits keep the Zotero user id for default-library tool calls', async () => {
  const f = fixture();
  const strict: Fetcher = async (input, init = {}) => {
    const m = /^\/users\/([^/]+)/.exec(new URL(String(input)).pathname);
    if (m && m[1] !== '222') return json({ error: 'bad user path' }, 400);
    return f.fetcher(input, init);
  };
  const s = await running(strict, { passthroughKeys: true });
  try {
    const key = 'B'.repeat(24); // the fixture maps B-keys to userID 222
    const client = new Client({ name: 'phone', version: '1' });
    await client.connect(new StreamableHTTPClientTransport(new URL(s.url + '/mcp'), { requestInit: { headers: { Authorization: `Bearer ${key}` } } }));
    // client.connect already verified the key upstream, so both calls below run on cache hits.
    for (let i = 0; i < 2; i++) {
      const r = await client.callTool({ name: 'get_recent', arguments: { start: 0, limit: 1 } });
      const text = ((r.content as any) ?? []).map((c: any) => c.text ?? '').join('');
      assert.ok(!r.isError, `call ${i + 1} must succeed on a warm verification cache${r.isError ? `: ${text.slice(0, 200)}` : ''}`);
      assert.ok(!text.includes('ZOTERO_400'), 'the default personal library must resolve to the real Zotero user id');
    }
    await client.close();
  } finally { await s.close(); }
});
