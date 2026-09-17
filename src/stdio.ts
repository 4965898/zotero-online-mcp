#!/usr/bin/env node
// stdio entry point: the MCP client launches this process directly.
// Credentials come from ZOTERO_API_KEY (required) and ZOTERO_USER_ID (optional; resolved via the API).
// Nothing here listens on a port, so there is no service to deploy and no token to manage.
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadLocalConfig } from './local-config.js';
import { createLocalContext } from './local-context.js';
import { mcpServer } from './mcp.js';
import { tools } from './tools.js';

async function main() {
  const config = loadLocalConfig();
  const { context, userId } = await createLocalContext(config);
  const server = mcpServer(context);
  await server.connect(new StdioServerTransport());
  // stdout carries the JSON-RPC stream, so all diagnostics go to stderr.
  console.error(JSON.stringify({ event: 'ready', transport: 'stdio', userId, writesEnabled: config.enableWrites, tools: tools.filter(t => config.enableWrites || !t.write).length }));
}

main().catch(error => {
  console.error(JSON.stringify({ event: 'fatal', message: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
