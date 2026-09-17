import test from 'node:test';
import assert from 'node:assert/strict';
import { tools, type ToolContext } from '../src/tools.js';
import '../src/extensions.js';
import { Store, hash } from '../src/store.js';
import { Plans } from '../src/plans.js';
import { Zotero } from '../src/zotero.js';
import { cslToZotero, cosine } from '../src/extensions.js';
import { config, fixture, json } from './helpers.js';

function context() {
  const cfg = config(), f = fixture(), store = new Store(':memory:', cfg.encryptionKey), user = store.connect('111', 'A'.repeat(24)), token = store.issue(user);
  const c: ToolContext = { config: cfg, principal: store.authenticate(token), api: new Zotero('A'.repeat(24), f.fetcher), plans: new Plans(store.planStore(), true), fetcher: f.fetcher };
  const call = async (name: string, args: unknown = {}): Promise<any> => { const t = tools.find(t => t.name === name)!; return t.run(t.schema.parse(args), c); };
  return { c, store, f, call };
}
test('tool schema validation blocks traversal, unknown fields and local files', async () => {
  const { call, store } = context();
  try {
    await assert.rejects(call('get_item_details', { itemKey: '../etc/passwd' }));
    await assert.rejects(call('search_library', { library: { type: 'group', id: '../1' } }));
    await assert.rejects(call('create_item', { data: { itemType: 'attachment', linkMode: 'linked_file', path: 'C:/private' } }));
    await assert.rejects(call('update_item', { itemKey: 'ABCD1234', version: 7, patch: { deleted: 1 } }));
    await assert.rejects(call('get_recent', { unexpected: true }));
  } finally { store.close(); }
});
test('tag and collection edits preserve untouched state and type', async () => {
  const { call, store, f } = context();
  try {
    const tags = await call('manage_tags', { itemKeys: ['ABCD1234'], tags: ['new'], action: 'add' });
    assert.deepEqual(tags.preview.changes[0].tags, [{ tag: 'keep', type: 1 }, { tag: 'new' }]);
    await call('execute_write', { confirmationToken: tags.confirmationToken });
    const memberships = await call('manage_item_collections', { itemKeys: ['ABCD1234'], collectionKeys: ['COLL5678'], action: 'add' });
    assert.deepEqual(memberships.preview.memberships[0].collections, ['COLL1234', 'COLL5678']);
    assert.equal(f.calls.filter(x => x.init.method === 'POST').length, 1);
  } finally { store.close(); }
});
test('stale versions fail before plan creation; confirmation cannot cross tenants or replay concurrently', async () => {
  const { call, store, c, f } = context();
  try {
    await assert.rejects(call('update_item', { itemKey: 'ABCD1234', version: 6, patch: { title: 'stale' } }));
    const p = await call('delete_item', { itemKey: 'ABCD1234', version: 7 });
    const other = store.authenticate(store.issue(store.connect('222', 'B'.repeat(24))));
    await assert.rejects(c.plans.execute(other, c.api, p.confirmationToken));
    const both = await Promise.allSettled([call('execute_write', { confirmationToken: p.confirmationToken }), call('execute_write', { confirmationToken: p.confirmationToken })]);
    assert.equal(both.filter(x => x.status === 'fulfilled').length, 1); assert.equal(f.calls.filter(x => x.init.method === 'DELETE').length, 1);
  } finally { store.close(); }
});
test('partial batch failures are explicit and consume confirmation', async () => {
  const { c, store } = context();
  try {
    const api = new Zotero('partial', async () => json({ successful: { 0: { key: 'NEWI1234' } }, failed: { 1: { code: 400, message: 'Invalid item type' } } }));
    const p = c.plans.prepare(c.principal, 'test', [{ method: 'POST', path: '/users/111/items', body: [{}, {}] }], {});
    const result = await c.plans.execute(c.principal, api, p.confirmationToken); assert.equal(result.status, 'partial_failure'); await assert.rejects(c.plans.execute(c.principal, api, p.confirmationToken));
  } finally { store.close(); }
});
test('fulltext character pagination, content missing status, and bounded scan coverage', async () => {
  const { call, store, c } = context();
  try {
    const text = await call('get_item_fulltext', { itemKey: 'FILE1234', offset: 5, maxChars: 100 }); assert.equal(text.data.content, 'text of a test paper.');
    c.api = new Zotero('missing-text', async (url) => { const path = new URL(String(url)).pathname; if (path.endsWith('/fulltext')) return json({}, 404); if (path.endsWith('/children')) return json([{ key: 'FILE1234', data: { itemType: 'attachment' } }], 200, { 'Total-Results': '1' }); return json({ key: 'ABCD1234', data: { itemType: 'book', title: 'Test' } }); });
    const result = await call('get_content', { itemKey: 'ABCD1234' }); assert.equal(result.sources[0].status, 'not_synced_or_missing');
    c.api = new Zotero('bounded', async () => json([{ key: 'AAAA2222', data: { title: 'test', itemType: 'book', DOI: 'x' } }], 200, { 'Total-Results': '200' }));
    const duplicates = await call('find_duplicates', { maxItems: 1 }); assert.equal(duplicates.truncated, true); assert.equal(duplicates.scanned, 1);
  } finally { store.close(); }
});
test('BibTeX, RIS and CSL imports preserve title, creator, DOI and collection membership', async () => {
  const { call, store } = context();
  try {
    const bib = await call('import_bibliography', { format: 'bibtex', text: '@article{smith2020, title={Memory and Learning}, author={Smith, John}, year={2020}, doi={10.1234/test}}', collections: ['COLL1234'] });
    assert.equal(bib.preview.create[0].title, 'Memory and Learning'); assert.equal(bib.preview.create[0].creators[0].lastName, 'Smith'); assert.deepEqual(bib.preview.create[0].collections, ['COLL1234']);
    const ris = await call('import_bibliography', { format: 'ris', text: 'TY  - JOUR\nTI  - A study\nAU  - Smith, John\nPY  - 2021\nDO  - 10.1234/ris\nER  - \n' });
    assert.equal(ris.preview.create[0].DOI, '10.1234/ris');
    assert.equal(cslToZotero({ type: 'book', title: 'Book', DOI: '10.1234/book' }).extra, 'DOI: 10.1234/book\n');
  } finally { store.close(); }
});
test('semantic search requires configuration, explicit consent and tenant-specific index; actual vectors rank results', async () => {
  const { call, store, c } = context();
  try {
    await assert.rejects(call('semantic_search', { query: 'cognition', consentToExternalProcessing: true }));
    c.config.embeddingUrl = 'https://embeddings.example/v1/embeddings'; c.config.embeddingModel = 'test-model';
    const requests: any[] = []; c.fetcher = async (_url, init) => { const b = JSON.parse(String(init?.body)); requests.push(b); return json({ data: b.input.map((_s: string, i: number) => ({ index: i, embedding: [1, 0, 0] })) }); };
    await assert.rejects(call('build_semantic_index', {}));
    await call('build_semantic_index', { consentToExternalProcessing: true });
    const result = await call('semantic_search', { query: 'cognition', consentToExternalProcessing: true }); assert.equal(result.results[0].score, 1); assert.equal(result.results[0].itemKey, 'ABCD1234');
    assert.ok(!JSON.stringify(requests).includes('A'.repeat(24))); assert.equal(cosine([1, 0], [0, 1]), 0);
    c.principal = store.authenticate(store.issue(store.connect('222', 'B'.repeat(24))));
    await assert.rejects(call('semantic_search', { query: 'cognition', consentToExternalProcessing: true }));
  } finally { store.close(); }
});
test('expired write plan fails without executing', async () => {
  const { call, store, f } = context();
  try { const p = await call('trash_item', { itemKey: 'ABCD1234', version: 7 }); store.db.prepare('UPDATE ephemeral SET expires=0 WHERE key=?').run(hash(p.confirmationToken)); await assert.rejects(call('execute_write', { confirmationToken: p.confirmationToken })); assert.equal(f.calls.filter(x => x.init.method === 'PATCH').length, 0); }
  finally { store.close(); }
});
test('collection update uses documented PUT and retains parent collection', async () => {
  const { call, store, c } = context(); let written: any;
  c.api = new Zotero('collection-put', async (_url, init = {}) => {
    if (init.method) { written = init; return new Response(null, { status: 204 }); }
    return json({ key: 'COLL1234', version: 5, data: { key: 'COLL1234', version: 5, name: 'Old', parentCollection: 'PARE1234' } });
  });
  try {
    const plan = await call('update_collection', { collectionKey: 'COLL1234', version: 5, name: 'New' }); await call('execute_write', { confirmationToken: plan.confirmationToken });
    assert.equal(written.method, 'PUT'); assert.equal(JSON.parse(written.body).parentCollection, 'PARE1234');
  } finally { store.close(); }
});
test('duplicate merge stops before trash when moving children partially fails', async () => {
  const { call, store, c } = context(); let trashCalls = 0;
  c.api = new Zotero('merge-test', async (url, init = {}) => {
    const path = new URL(String(url)).pathname;
    if (init.method === 'PATCH') { trashCalls++; return new Response(null, { status: 204 }); }
    if (init.method === 'POST') return json({ successful: { 0: { key: 'ABCD1234' } }, failed: { 1: { code: 412 } } });
    if (path.endsWith('/children')) return json([{ key: 'FILE1234', version: 3, data: { itemType: 'attachment', parentItem: 'SECO1234' } }], 200, { 'Total-Results': '1' });
    return json({ key: path.split('/').at(-1), version: 7, data: { itemType: 'book', title: 'Title', tags: [], collections: [], relations: {} } });
  });
  try {
    const p = await call('merge_duplicates', { primaryKey: 'ABCD1234', secondaryKey: 'SECO1234', primaryVersion: 7, secondaryVersion: 7 });
    assert.deepEqual(p.preview.moveChildren, ['FILE1234']); const result = await call('execute_write', { confirmationToken: p.confirmationToken }); assert.equal(result.status, 'partial_failure'); assert.equal(trashCalls, 0);
  } finally { store.close(); }
});
