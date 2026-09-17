// Explicit opt-in read-only integration probe. Never prints the key or returned private items.
import { Zotero } from '../dist/zotero.js';
const key = process.env.ZOTERO_TEST_API_KEY;
if (!key) throw new Error('Set ZOTERO_TEST_API_KEY in the ignored .env file first');
const api = new Zotero(key);
try {
  const identity = await api.request('/keys/current');
  const group = process.env.ZOTERO_TEST_GROUP_ID;
  if (group && !/^[1-9]\d*$/.test(group)) throw new Error('Invalid test group ID');
  const prefix = group ? `/groups/${group}` : `/users/${identity.data.userID}`;
  const items = await api.request(prefix + '/items', { limit: 1 });
  const collections = await api.request(prefix + '/collections', { limit: 1 });
  console.log(JSON.stringify({ authenticated: true, library: prefix, itemRead: true, collectionRead: true, libraryVersion: items.version ?? collections.version, writesPerformed: false }));
} catch (error) {
  console.error(JSON.stringify({ success: false, code: error?.code ?? 'PROBE_FAILED', message: error?.code ? error.message : 'Live probe failed' })); process.exitCode = 1;
}
