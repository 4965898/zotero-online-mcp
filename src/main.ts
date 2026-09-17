import { loadConfig } from './config.js';
import { createApp } from './server.js';

const config = loadConfig(), service = createApp(config);
const http = service.app.listen(config.port, config.host, () => {
  console.log(JSON.stringify({ event: 'started', service: 'zotero-online-mcp', publicUrl: config.publicUrl, writesEnabled: config.enableWrites }));
});
http.requestTimeout = 180000;
http.headersTimeout = 15000;
let closing = false;
async function shutdown() {
  if (closing) return; closing = true;
  const deadline = setTimeout(() => process.exit(1), 10000); deadline.unref();
  await service.close(); http.close(() => { clearTimeout(deadline); process.exit(0); });
}
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
