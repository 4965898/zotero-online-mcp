import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { fixture, running } from './helpers.js';

test('OAuth consent, CSRF, PKCE, audience, code replay, refresh rotation and revocation', async () => {
  const s = await running(fixture().fetcher);
  const post = (path: string, body: any, headers = {}) => fetch(s.url + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), redirect: 'manual' });
  try {
    const metadata = await (await fetch(s.url + '/.well-known/oauth-authorization-server')).json(); assert.deepEqual(metadata.code_challenge_methods_supported, ['S256']);
    assert.equal((await post('/oauth/register', { redirect_uris: ['https://client.example/cb#bad'] })).status, 400);
    assert.equal((await post('/oauth/register', { redirect_uris: ['http://public.example/cb'] })).status, 400);
    const client = await (await post('/oauth/register', { client_name: '<img src=x onerror=evil()>', redirect_uris: ['https://client.example/cb'] })).json();
    const verifier = randomBytes(32).toString('base64url'), challenge = createHash('sha256').update(verifier).digest('base64url');
    const params = new URLSearchParams({ client_id: client.client_id, redirect_uri: 'https://client.example/cb', response_type: 'code', code_challenge: challenge, code_challenge_method: 'S256', resource: s.url + '/mcp', state: 'client-state' });
    const consent = await fetch(s.url + '/oauth/authorize?' + params, { redirect: 'manual' }); assert.equal(consent.status, 200);
    const html = await consent.text(); assert.ok(!html.includes('<img src=x')); assert.ok(html.includes('&lt;img'));
    const grant = /name="grant" value="([^"]+)"/.exec(html)![1], cookie = consent.headers.get('set-cookie')!.split(';')[0];
    const body = { grant, apiKey: 'A'.repeat(24), approved: 'yes' };
    assert.equal((await post('/oauth/authorize', body)).status, 403);
    const accepted = await post('/oauth/authorize', body, { Cookie: cookie }); assert.equal(accepted.status, 303);
    const redirect = new URL(accepted.headers.get('location')!); assert.equal(redirect.searchParams.get('state'), 'client-state');
    const exchange = { grant_type: 'authorization_code', client_id: client.client_id, code: redirect.searchParams.get('code'), redirect_uri: 'https://client.example/cb', code_verifier: verifier, resource: s.url + '/mcp' };
    assert.equal((await post('/oauth/token', { ...exchange, resource: 'https://other.example/mcp' })).status, 400);
    assert.equal((await post('/oauth/token', { ...exchange, code_verifier: 'x'.repeat(43) })).status, 400);
    const tokensResponse = await post('/oauth/token', exchange); assert.equal(tokensResponse.status, 200); const tokens = await tokensResponse.json();
    assert.equal((await post('/oauth/token', exchange)).status, 400);
    assert.ok(s.store.authenticate(tokens.access_token));
    const refresh = { grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: client.client_id, resource: s.url + '/mcp' };
    assert.equal((await post('/oauth/token', { ...refresh, client_id: 'wrong' })).status, 401);
    const rotated = await (await post('/oauth/token', refresh)).json(); assert.ok(rotated.access_token); assert.notEqual(rotated.refresh_token, tokens.refresh_token);
    assert.equal((await post('/oauth/token', refresh)).status, 401);
    await post('/oauth/revoke', { token: rotated.access_token }); assert.throws(() => s.store.authenticate(rotated.access_token));
  } finally { await s.close(); }
});
test('invite-protected enrollment rejects missing code before contacting Zotero', async () => {
  const f = fixture(), s = await running(f.fetcher, { signupSecret: 'a-long-test-invite' });
  try {
    const r = await fetch(s.url + '/api/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: 'A'.repeat(24) }) }); assert.equal(r.status, 403); assert.equal(f.calls.length, 0);
    assert.ok(await s.connect());
  } finally { await s.close(); }
});
