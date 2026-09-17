import { randomUUID } from 'node:crypto';
import type { Config } from './config.js';
import { AppError } from './errors.js';
import { Plans, MemoryPlanStore } from './plans.js';
import { Zotero, type Fetcher } from './zotero.js';
import type { Principal } from './store.js';
import type { ToolContext } from './tools.js';

// Builds the single principal a stdio process serves. ZOTERO_USER_ID is optional: when absent we
// ask Zotero for it, which is why local setup needs only one environment variable.
export async function createLocalContext(config: Config, fetcher: Fetcher = fetch) {
  const apiKey = config.apiKey!;
  let userId = config.userId;
  if (!userId) {
    const result = await new Zotero(apiKey, fetcher).request('/keys/current');
    userId = String((result.data as any)?.userID ?? '');
    if (!/^[1-9]\d*$/.test(userId)) throw new AppError('INVALID_KEY', 'Zotero did not return a valid user ID for this API key; run: curl -H "Zotero-API-Key: $ZOTERO_API_KEY" https://api.zotero.org/keys/current', 401);
  }
  if (!/^[1-9]\d*$/.test(userId)) throw new AppError('INVALID_USER_ID', 'ZOTERO_USER_ID must be the numeric Zotero userID', 400);
  const principal: Principal = { id: randomUUID(), userId, apiKey, tokenHash: '' };
  const context: ToolContext = { principal, api: new Zotero(apiKey, fetcher), plans: new Plans(new MemoryPlanStore(), config.enableWrites), config, fetcher };
  return { context, userId };
}
