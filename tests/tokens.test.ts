import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Store, NEVER, hash } from '../src/store.js';
import { fixture, running } from './helpers.js';

function store() { return new Store(':memory:', randomBytes(32)); }

const expiryOf = (s: Store, token: string) =>
  (s.db.prepare('SELECT expires FROM tokens WHERE hash=?').get(hash(token)) as { expires: number } | undefined)?.expires;

test('ttl=0 issues a permanent token that survives maintenance and stays active', () => {
  const s = store();
  try {
    const user = s.connect('111', 'A'.repeat(24));
    const token = s.issue(user, 'access', 0);
    assert.equal(expiryOf(s, token), NEVER);
    s.cleanup();
    assert.ok(s.isActive(hash(token)));
    assert.ok(s.neverExpires(hash(token)));
    assert.equal(s.authenticate(token).userId, '111');
  } finally { s.close(); }
});

test('a positive ttl still expires and is removed by maintenance', () => {
  const s = store();
  try {
    const user = s.connect('111', 'A'.repeat(24));
    const short = s.issue(user, 'access', 1);
    const expiry = expiryOf(s, short)!;
    assert.ok(expiry > 0 && expiry !== NEVER, 'bounded ttl must produce a real timestamp, not the sentinel');
    // Push the stored deadline into the past instead of sleeping, then let maintenance reap it.
    s.db.prepare('UPDATE tokens SET expires=? WHERE hash=?').run(Date.now() - 1, hash(short));
    s.cleanup();
    assert.equal(s.isActive(hash(short)), false);
    assert.throws(() => s.authenticate(short));
    assert.equal(s.neverExpires(hash(short)), false);
  } finally { s.close(); }
});

test('revoking a permanent token removes it regardless of sentinel expiry', () => {
  const s = store();
  try {
    const user = s.connect('111', 'A'.repeat(24));
    const token = s.issue(user, 'access', 0);
    s.revoke(token);
    assert.equal(expiryOf(s, token), undefined);
    assert.throws(() => s.authenticate(token));
  } finally { s.close(); }
});

test('deleting a connection removes its permanent tokens', () => {
  const s = store();
  try {
    const user = s.connect('111', 'A'.repeat(24));
    const token = s.issue(user, 'access', 0);
    s.disconnect(user);
    assert.equal(s.db.prepare('SELECT count(*) n FROM tokens').get()!.n, 0);
    assert.throws(() => s.authenticate(token));
  } finally { s.close(); }
});

test('default config issues a permanent onboarding token with null expiry', async () => {
  const s = await running(fixture().fetcher);
  try {
    const response = await fetch(s.url + '/api/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: 'A'.repeat(24) }) });
    const data = await response.json();
    assert.equal(data.expires_in, null);
    assert.equal(data.expires_at, null);
    assert.equal(expiryOf(s.store, data.access_token), NEVER);
    s.store.cleanup();
    assert.ok(s.store.isActive(hash(data.access_token)));
    const account = await fetch(s.url + '/api/account', { headers: { Authorization: `Bearer ${data.access_token}` } });
    assert.equal(account.status, 200);
  } finally { await s.close(); }
});

test('a configured ttl restores bounded lifetimes and reports expires_in', async () => {
  const s = await running(fixture().fetcher, { tokenTtlMs: 7 * 86400000 });
  try {
    const data = await (await fetch(s.url + '/api/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: 'A'.repeat(24) }) })).json();
    assert.equal(data.expires_in, 7 * 86400);
    assert.ok(data.expires_at);
    assert.notEqual(expiryOf(s.store, data.access_token), NEVER);
    const info = await (await fetch(s.url + '/api/info')).json();
    assert.equal(info.tokenTtlDays, 7);
  } finally { await s.close(); }
});

test('api info reports permanent tokens as zero days', async () => {
  const s = await running(fixture().fetcher);
  try {
    const info = await (await fetch(s.url + '/api/info')).json();
    assert.equal(info.tokenTtlDays, 0);
  } finally { await s.close(); }
});
