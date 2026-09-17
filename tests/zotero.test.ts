import test from 'node:test';
import assert from 'node:assert/strict';
import { Zotero, storageUrl, readBounded } from '../src/zotero.js';
import { publicError, AppError } from '../src/errors.js';
import { json } from './helpers.js';

test('Zotero headers, repeated tags, group routing and pagination metadata', async () => {
  let called: URL | undefined;
  const api = new Zotero('query-key', async (url, init) => {
    called = new URL(String(url)); const h = new Headers(init?.headers); assert.equal(h.get('Zotero-API-Key'), 'query-key'); assert.equal(h.get('Zotero-API-Version'), '3');
    return json([{ key: 'AAAA2222' }], 200, { 'Total-Results': '101', 'Last-Modified-Version': '19', Link: '<https://api.zotero.org/groups/123/items?start=100>; rel="next"' });
  });
  const result = await api.request('/groups/123/items', { tag: ['foo', 'bar || baz'], limit: 100 });
  assert.deepEqual(called!.searchParams.getAll('tag'), ['foo', 'bar || baz']); assert.equal(called!.pathname, '/groups/123/items'); assert.equal(result.nextStart, 100); assert.equal(result.total, 101); assert.equal(result.version, 19);
  assert.ok(!called!.search.includes('query-key')); await assert.rejects(api.request('//evil.example/path')); await assert.rejects(api.request('//evil/path'));
});
test('successful Backoff and 429 prevent immediate repeat requests', async () => {
  for (const status of [200, 429]) {
    let calls = 0; const api = new Zotero('rate-' + status, async () => { calls++; return json({}, status, status === 200 ? { Backoff: '10' } : { 'Retry-After': '20' }); });
    if (status === 200) await api.request('/items/new'); else await assert.rejects(api.request('/items/new'));
    await assert.rejects(api.request('/items/new'), (e: AppError) => e.code === 'BACKOFF'); assert.equal(calls, 1);
  }
});
test('version conflict and failed writes are never retried or echoed', async () => {
  let calls = 0;
  const api = new Zotero('never-leak-key', async () => { calls++; return new Response('never-leak-key private payload', { status: 412 }); });
  try { await api.json('/users/1/items/AAAA2222', 'PATCH', { title: 'new' }, 4); assert.fail(); }
  catch (e) { assert.equal((e as AppError).code, 'ZOTERO_412'); assert.ok(!JSON.stringify(publicError(e)).includes('never-leak')); }
  assert.equal(calls, 1);
});
test('attachment redirect strips credentials; arbitrary storage hosts are rejected', async () => {
  const calls: { url: string; headers: Headers }[] = [];
  const api = new Zotero('private-key', async (url, init) => {
    calls.push({ url: String(url), headers: new Headers(init?.headers) });
    if (calls.length === 1) return new Response(null, { status: 302, headers: { Location: 'https://zoterofilestorage.s3.amazonaws.com/file?signature=opaque' } });
    return new Response('pdf bytes', { headers: { 'Content-Type': 'application/pdf' } });
  });
  const r = await api.download('/users/1/items/AAAA2222/file', 100);
  assert.equal(r.bytes.toString(), 'pdf bytes'); assert.equal(calls[1].headers.get('Zotero-API-Key'), null); assert.equal(calls[1].headers.get('authorization'), null);
  for (const url of ['http://127.0.0.1/a', 'https://evil.example/a', 'https://zoterofilestorage.s3.amazonaws.com.evil.example/a', 'https://user:pass@api.zotero.org/a', 'https://api.zotero.org:444/a']) assert.throws(() => storageUrl(url));
});
test('three-phase upload registers only after storage returns 201', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const api = new Zotero('upload-key', async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (calls.length === 1) { assert.equal(new Headers(init.headers).get('If-Match'), 'oldhash'); return json({ url: 'https://zoterofilestorage.s3.amazonaws.com/', contentType: 'multipart/form-data; boundary=b', prefix: 'prefix', suffix: 'suffix', uploadKey: 'upload-token' }); }
    if (calls.length === 2) { assert.equal(new Headers(init.headers).get('Zotero-API-Key'), null); assert.equal(Buffer.from(init.body as Uint8Array).toString(), 'prefixFILEsuffix'); return new Response(null, { status: 201 }); }
    assert.equal(init.body, 'upload=upload-token'); assert.equal(new Headers(init.headers).get('If-Match'), 'oldhash'); return new Response(null, { status: 204 });
  });
  assert.equal((await api.upload('/users/1/items/AAAA2222/file', Buffer.from('FILE'), 'a.pdf', 'newhash', 1000, 'oldhash')).uploaded, true); assert.equal(calls.length, 3);
});
test('deduplicated upload skips storage and registration', async () => {
  let calls = 0; const api = new Zotero('dedup', async () => { calls++; return json({ exists: 1 }); });
  assert.equal((await api.upload('/users/1/items/AAAA2222/file', Buffer.from('a'), 'a', 'hash', 1)).deduplicated, true); assert.equal(calls, 1);
});
test('failed storage upload stops before registration', async () => {
  let calls = 0; const api = new Zotero('failed-upload', async () => { calls++; return calls === 1 ? json({ url: 'https://zoterofilestorage.s3.amazonaws.com/', contentType: 'text/plain', prefix: '', suffix: '', uploadKey: 'u' }) : new Response(null, { status: 500 }); });
  await assert.rejects(api.upload('/users/1/items/AAAA2222/file', Buffer.from('a'), 'a', 'hash', 1)); assert.equal(calls, 2);
});
test('bounded streaming reader cancels oversized data even without Content-Length', async () => {
  let canceled = false; const response = new Response(new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(8)); }, cancel() { canceled = true; } }));
  await assert.rejects(readBounded(response, 10)); assert.equal(canceled, true);
});
