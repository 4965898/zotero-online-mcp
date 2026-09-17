import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, running } from './helpers.js';

test('NoteGen HTTP wire contract: 2024-11-05 handshake, session headers, notification and finite SSE response', async () => {
  const s = await running(fixture().fetcher), token = await s.connect();
  let session = '', protocol = '';
  async function send(method: string, params: any, id?: number) {
    return fetch(s.url + '/mcp', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(session ? { 'Mcp-Session-Id': session } : {}), ...(protocol ? { 'MCP-Protocol-Version': protocol } : {}) }, body: JSON.stringify({ jsonrpc: '2.0', method, params, ...(id === undefined ? {} : { id }) }) });
  }
  async function result(response: Response, id: number) {
    assert.equal(response.status, 200); const text = await response.text();
    const messages = response.headers.get('content-type')?.includes('text/event-stream') ? text.split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6))) : [JSON.parse(text)];
    const message = messages.find(m => String(m.id) === String(id)); assert.ok(message); assert.equal(message.error, undefined); return message.result;
  }
  try {
    const init = await send('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'note-gen', version: '1.0.0' } }, 1);
    session = init.headers.get('mcp-session-id')!; protocol = (await result(init, 1)).protocolVersion;
    assert.ok(session); assert.equal((await send('notifications/initialized', {})).status, 202);
    const list = await result(await send('tools/list', {}, 2), 2); assert.ok(list.tools.some((t: any) => t.name === 'search_library'));
    const read = await result(await send('tools/call', { name: 'search_library', arguments: { q: 'memory' } }, 3), 3);
    assert.match(read.content[0].text, /Memory and Learning/);
  } finally { await s.close(); }
});
