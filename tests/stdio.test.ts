import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { loadLocalConfig } from '../src/local-config.js';
import { createLocalContext } from '../src/local-context.js';
import { mcpServer } from '../src/mcp.js';
import { MemoryPlanStore, Plans } from '../src/plans.js';
import { fixture, json } from './helpers.js';

const KEY = 'A'.repeat(24);

test('local config requires only ZOTERO_API_KEY and defaults to read-only', () => {
  const config = loadLocalConfig({ ZOTERO_API_KEY: KEY } as any);
  assert.equal(config.apiKey, KEY);
  assert.equal(config.userId, undefined);
  assert.equal(config.enableWrites, false, 'writes must be opt-in locally');
  assert.equal(config.databasePath, ':memory:');
  assert.equal(config.tokenTtlMs, 0);
});

test('local config rejects a missing or malformed key with an actionable message', () => {
  assert.throws(() => loadLocalConfig({} as any), /ZOTERO_API_KEY/);
  assert.throws(() => loadLocalConfig({ ZOTERO_API_KEY: 'short' } as any), /does not look like/);
  assert.throws(() => loadLocalConfig({ ZOTERO_API_KEY: KEY, EMBEDDING_URL: 'http://plain.example' } as any), /HTTPS/);
});

test('ZOTERO_WRITE opts local writes in and an explicit user id skips the lookup call', async () => {
  const config = loadLocalConfig({ ZOTERO_API_KEY: KEY, ZOTERO_WRITE: 'true', ZOTERO_USER_ID: '1234567' } as any);
  assert.equal(config.enableWrites, true);
  const f = fixture();
  const { userId } = await createLocalContext(config, f.fetcher);
  assert.equal(userId, '1234567');
  assert.equal(f.calls.length, 0, 'a supplied user id must not trigger /keys/current');
});

test('a missing user id is resolved from Zotero exactly once', async () => {
  const config = loadLocalConfig({ ZOTERO_API_KEY: KEY } as any);
  const f = fixture();
  const { context, userId } = await createLocalContext(config, f.fetcher);
  assert.equal(userId, '111');
  assert.equal(context.principal.apiKey, KEY);
  assert.equal(f.calls.filter(c => new URL(String(c.url)).pathname === '/keys/current').length, 1);
});

test('a key that yields no user id fails with guidance instead of starting', async () => {
  const config = loadLocalConfig({ ZOTERO_API_KEY: KEY } as any);
  const fetcher = async () => json({ userID: 0 }, 200);
  await assert.rejects(createLocalContext(config, fetcher), /keys\/current/);
});

test('stdio surface exposes all tools, reads, and previews writes without a token or store', async () => {
  const config = loadLocalConfig({ ZOTERO_API_KEY: KEY, ZOTERO_WRITE: 'true', ZOTERO_USER_ID: '111' } as any);
  const f = fixture();
  const { context } = await createLocalContext(config, f.fetcher);
  const server = mcpServer(context);
  const client = new Client({ name: 'stdio-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    const list = await client.listTools();
    assert.ok(list.tools.length >= 80, `expected the full catalog, got ${list.tools.length}`);
    const read = await client.callTool({ name: 'get_item_details', arguments: { itemKey: 'ABCD1234' } });
    assert.match((read.content as any)[0].text, /Memory and Learning/);
    // Writes still require explicit approval, but no service token is involved locally.
    const preview = await client.callTool({ name: 'update_item', arguments: { itemKey: 'ABCD1234', version: 7, patch: { title: 'Local edit' } } });
    const plan = JSON.parse((preview.content as any)[0].text);
    assert.equal(plan.status, 'awaiting_confirmation');
    assert.equal(f.calls.filter(c => c.init.method === 'PATCH').length, 0);
    const executed = await client.callTool({ name: 'execute_write', arguments: { confirmationToken: plan.confirmationToken } });
    assert.equal(JSON.parse((executed.content as any)[0].text).status, 'completed');
    assert.equal(f.calls.filter(c => c.init.method === 'PATCH').length, 1);
  } finally { await client.close(); await server.close(); }
});

test('read-only local mode hides the write tools entirely', async () => {
  const config = loadLocalConfig({ ZOTERO_API_KEY: KEY, ZOTERO_USER_ID: '111' } as any);
  const { context } = await createLocalContext(config, fixture().fetcher);
  const server = mcpServer(context);
  const client = new Client({ name: 'stdio-readonly', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    const list = await client.listTools();
    assert.ok(list.tools.every(t => t.annotations?.readOnlyHint));
    assert.equal((await client.callTool({ name: 'create_item', arguments: { data: {} } })).isError, true);
  } finally { await client.close(); await server.close(); }
});

// Gemini-family gateways compile `const: true` into `enum: [true]` and reject the whole tool list
// with a 400, which took down every chat on affected clients. The exposed schemas must therefore
// carry no non-string const values; the consent gate is expressed as an instruction instead.
test('exposed tool schemas contain no non-string const values (Gemini compatibility)', async () => {
  const config = loadLocalConfig({ ZOTERO_API_KEY: KEY, ZOTERO_WRITE: 'true', ZOTERO_USER_ID: '111' } as any);
  const { context } = await createLocalContext(config, fixture().fetcher);
  const server = mcpServer(context);
  const client = new Client({ name: 'schema-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    const list = await client.listTools();
    const offenders: string[] = [];
    const walk = (node: any, path: string, tool: string) => {
      if (!node || typeof node !== 'object') return;
      if ('const' in node && typeof node.const !== 'string') offenders.push(`${tool}@${path}`);
      for (const [k, v] of Object.entries(node)) if (k !== 'const') walk(v, `${path}.${k}`, tool);
    };
    for (const t of list.tools) walk(t.inputSchema, '$', t.name);
    assert.deepEqual(offenders, []);
    // The consent gate must survive as an instruction and stay enforced server-side.
    const consent = list.tools.find(t => t.name === 'semantic_search')!.inputSchema as any;
    assert.match(consent.properties.consentToExternalProcessing.description, /Must be exactly true/);
    const refused = await client.callTool({ name: 'semantic_search', arguments: { query: 'x', consentToExternalProcessing: false } });
    assert.equal(refused.isError, true, 'false must still be rejected by the zod consent gate');
  } finally { await client.close(); await server.close(); }
});

test('memory plan store expires, counts per owner, and consumes once', () => {
  const store = new MemoryPlanStore();
  store.put('a', { user: 'u1', tool: 't', commands: [], preview: {} }, 60000, 'u1');
  store.put('b', { user: 'u1', tool: 't', commands: [], preview: {} }, 60000, 'u1');
  store.put('c', { user: 'u2', tool: 't', commands: [], preview: {} }, 60000, 'u2');
  const counts = store.count();
  assert.equal(counts.total, 3);
  assert.equal(counts.own('u1'), 2);
  assert.equal(counts.own('u2'), 1);
  assert.equal(counts.own('absent'), 0);
  assert.ok(store.take('a'));
  assert.equal(store.take('a'), undefined, 'a plan is consumable only once');
  store.put('d', { user: 'u1', tool: 't', commands: [], preview: {} }, -1, 'u1');
  store.sweep();
  assert.equal(store.get('d'), undefined, 'an already-expired plan is swept');
});

test('local plans enforce the same pending-plan ceiling without a database', async () => {
  const config = loadLocalConfig({ ZOTERO_API_KEY: KEY, ZOTERO_WRITE: 'true', ZOTERO_USER_ID: '111' } as any);
  const { context } = await createLocalContext(config, fixture().fetcher);
  const principal = context.principal;
  for (let i = 0; i < 20; i++) context.plans.prepare(principal, 'test', [{ method: 'POST', path: '/users/111/items', body: [{}] }], {});
  assert.throws(() => context.plans.prepare(principal, 'test', [{ method: 'POST', path: '/users/111/items', body: [{}] }], {}), /Too many pending plans/);
});

test('local writes are refused while ZOTERO_WRITE is unset', () => {
  const plans = new Plans(new MemoryPlanStore(), false);
  assert.throws(() => plans.prepare({ id: 'u', userId: '1', apiKey: KEY, tokenHash: '' }, 'test', [{ method: 'POST', path: '/users/1/items', body: [{}] }], {}), /Writes are disabled/);
});
