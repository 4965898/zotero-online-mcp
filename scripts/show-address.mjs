#!/usr/bin/env node
// Prints the addresses this server can be reached at, plus ready-to-paste client configs.
// Run `npm start` first (or alongside), then run this to see what to type into each client.
import { networkInterfaces } from 'node:os';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function envValue(name) {
  const file = join(root, '.env');
  if (!existsSync(file)) return '';
  const line = readFileSync(file, 'utf8').split(/\r?\n/).find(l => l.trim().startsWith(`${name}=`));
  return line ? line.slice(line.indexOf('=') + 1).trim() : '';
}

const port = envValue('PORT') || '3000';
const key = envValue('ZOTERO_API_KEY');
const passthrough = envValue('PASSTHROUGH_KEYS') === 'true';
const writes = envValue('ENABLE_WRITES') === 'true' || envValue('ZOTERO_WRITE') === 'true';

// Virtual adapters (Hyper-V, WSL, Docker, VPN) carry LAN-looking addresses that no phone can reach,
// so they are filtered out to keep the printed list to addresses a user can actually type.
const VIRTUAL = /vEthernet|Hyper-V|WSL|docker|VirtualBox|VMware|Loopback|Tailscale|ZeroTier|Radmin/i;

const lans = [];
for (const [name, addrs] of Object.entries(networkInterfaces())) {
  if (VIRTUAL.test(name)) continue;
  for (const a of addrs ?? []) {
    if (a.family === 'IPv4' && !a.internal) lans.push({ name, address: a.address });
  }
}

const line = (s = '') => console.log(s);
line('Zotero Online MCP - connection info');
line('='.repeat(60));
line();
if (!key) {
  line('! ZOTERO_API_KEY is empty in .env - the server will refuse to start.');
  line('  Create one at https://www.zotero.org/settings/keys/new');
  line();
}
line(`Writes: ${writes ? 'ENABLED (82 tools)' : 'disabled (51 read-only tools)'}`);
line(`Client credentials: ${passthrough ? 'Zotero API key directly (PASSTHROUGH_KEYS=true)' : 'service token from the landing page'}`);
line();

line('This machine can be reached at:');
line(`  localhost (this PC only)     http://localhost:${port}/mcp`);
if (lans.length === 0) {
  line('  (no LAN address found - are you connected to Wi-Fi or Ethernet?)');
} else {
  // Adapter names are omitted because non-English adapter names garble in some consoles.
  lans.forEach(({ address }, i) => {
    line(`  LAN ${i + 1} (phones/other PCs)    http://${address}:${port}/mcp`);
  });
}
line();
line('Legacy SSE clients use the same host with /sse instead of /mcp.');
line();

const primary = lans[0]?.address;
if (!primary) {
  line('No LAN address, so phone configs are omitted.');
  process.exit(0);
}

const cred = passthrough ? (key || 'YOUR_ZOTERO_API_KEY') : 'YOUR_SERVICE_TOKEN';
const origin = `http://${primary}:${port}`;

line('='.repeat(60));
line('Paste into Cherry Studio (MCP server, type = streamable-http)');
line('='.repeat(60));
line(JSON.stringify({
  mcpServers: { zotero: { type: 'streamable-http', url: `${origin}/mcp`, headers: { Authorization: `Bearer ${cred}` } } },
}, null, 2));
line();

line('='.repeat(60));
line('RikkaHub: Settings > MCP > +   (settings: shezhi > MCP)');
line('='.repeat(60));
line(`Name                zotero`);
line(`Transport type      Streamable HTTP`);
line(`Server URL          ${origin}/mcp`);
line(`Header name         Authorization`);
line(`Header value        Bearer ${cred}`);
line();
line('  ^ "Bearer" and the credential are separated by ONE space.');
line('  If it will not connect, switch the transport to SSE and use /sse instead.');
line();

line('='.repeat(60));
line('Paste into NoteGen / Claude Desktop / Cursor (stdio, no server needed)');
line('='.repeat(60));
line(JSON.stringify({
  mcpServers: {
    zotero: {
      command: 'node',
      args: [join(root, 'dist', 'stdio.js').replace(/\\/g, '/')],
      env: { ZOTERO_API_KEY: cred === 'YOUR_SERVICE_TOKEN' ? 'YOUR_ZOTERO_API_KEY' : cred, ZOTERO_WRITE: 'true' },
    },
  },
}, null, 2));
line();
line('Reminder: LAN addresses only work on this network. Off Wi-Fi, phones cannot reach this PC.');
