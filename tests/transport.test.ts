import test from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { fixture, running } from './helpers.js';

for (const mode of ['http', 'sse']) test(`official SDK ${mode}: initialize, discover, read, preview, execute, replay rejection`, async () => {
  const f = fixture(), s = await running(f.fetcher), token = await s.connect();
  const headers = { Authorization: `Bearer ${token}` };
  const transport = mode === 'http' ? new StreamableHTTPClientTransport(new URL(s.url + '/mcp'), { requestInit: { headers } }) : new SSEClientTransport(new URL(s.url + '/sse'), { requestInit: { headers } });
  const client = new Client({ name: 'integration-test', version: '1.0.0' });
  try {
    await client.connect(transport);
    const list = await client.listTools(); assert.ok(list.tools.length >= 70); assert.equal(new Set(list.tools.map(t => t.name)).size, list.tools.length);
    const read = await client.callTool({ name: 'get_item_details', arguments: { itemKey: 'ABCD1234' } });
    assert.match((read.content as any)[0].text, /Memory and Learning/);
    const preview = await client.callTool({ name: 'update_item', arguments: { itemKey: 'ABCD1234', version: 7, patch: { title: 'Updated title' } } });
    const plan = JSON.parse((preview.content as any)[0].text); assert.equal(plan.status, 'awaiting_confirmation'); assert.equal(f.calls.filter(c => c.init.method === 'PATCH').length, 0);
    const execute = await client.callTool({ name: 'execute_write', arguments: { confirmationToken: plan.confirmationToken } });
    assert.equal(JSON.parse((execute.content as any)[0].text).status, 'completed');
    const write = f.calls.find(c => c.init.method === 'PATCH')!; assert.equal(write.headers.get('If-Unmodified-Since-Version'), '7'); assert.equal(write.body.title, 'Updated title');
    const replay = await client.callTool({ name: 'execute_write', arguments: { confirmationToken: plan.confirmationToken } }); assert.equal(replay.isError, true);
    assert.equal((await client.listResources()).resources.length, 1); assert.equal((await client.listPrompts()).prompts.length, 2);
    const resource = await client.readResource({ uri: 'zotero://capabilities' }); assert.ok('text' in resource.contents[0]); assert.match(resource.contents[0].text, /remoteOnly/);
    if (transport instanceof StreamableHTTPClientTransport) await transport.terminateSession();
  } finally { await client.close(); await s.close(); }
});

test('authentication, origin, Host, tenant and same-user token isolation', async () => {
  const s = await running(fixture().fetcher);
  try {
    const unauth = await fetch(s.url + '/mcp'); assert.equal(unauth.status, 401); assert.match(unauth.headers.get('www-authenticate')!, /resource_metadata/);
    assert.equal((await fetch(s.url + '/healthz', { headers: { Origin: 'https://evil.example' } })).status, 403);
    const hostileHost = await new Promise<number | undefined>((resolve, reject) => { const req = httpRequest(s.url + '/healthz', { headers: { Host: 'evil.example' } }, res => { res.resume(); resolve(res.statusCode); }); req.on('error', reject); req.end(); });
    assert.equal(hostileHost, 403);
    assert.equal((await fetch(s.url + '/api/account?token=leak')).status, 401);
    const a = await s.connect(), b = await s.connect('B'.repeat(24)), a2 = await s.connect();
    const client = new Client({ name: 'a', version: '1' }); const transport = new StreamableHTTPClientTransport(new URL(s.url + '/mcp'), { requestInit: { headers: { Authorization: `Bearer ${a}` } } });
    await client.connect(transport);
    for (const token of [b, a2]) {
      const response = await fetch(s.url + '/mcp', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'mcp-session-id': transport.sessionId!, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'tools/list' }) });
      assert.equal(response.status, 404);
    }
    await fetch(s.url + '/api/revoke', { method: 'POST', headers: { Authorization: `Bearer ${a}` } });
    assert.equal((await fetch(s.url + '/api/account', { headers: { Authorization: `Bearer ${a}` } })).status, 401);
    await client.close();
  } finally { await s.close(); }
});
test('read-only mode removes all write tools', async () => {
  const s = await running(fixture().fetcher, { enableWrites: false }), token = await s.connect();
  const client = new Client({ name: 'readonly', version: '1' });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(s.url + '/mcp'), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
    const list = await client.listTools(); assert.ok(list.tools.every(t => t.annotations?.readOnlyHint));
    assert.equal((await client.callTool({ name: 'create_item', arguments: { data: {} } })).isError, true);
  } finally { await client.close(); await s.close(); }
});
test('connection never exposes upstream key and stores ciphertext, disconnect cascades tokens', async () => {
  const s = await running(fixture().fetcher), token = await s.connect();
  try {
    const row = s.store.db.prepare('SELECT api_key FROM users').get()!; assert.ok(!String(row.api_key).includes('A'.repeat(24)));
    const account = await fetch(s.url + '/api/account', { headers: { Authorization: `Bearer ${token}` } }); assert.ok(!(await account.text()).includes('A'.repeat(24)));
    await fetch(s.url + '/api/account', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    assert.throws(() => s.store.authenticate(token)); assert.equal(s.store.db.prepare('SELECT count(*) n FROM users').get()!.n, 0);
  } finally { await s.close(); }
});
