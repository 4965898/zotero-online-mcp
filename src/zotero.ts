import { AppError } from './errors.js';
import { hash } from './store.js';

export type Query = Record<string, string | number | boolean | string[] | undefined>;
export interface ApiResult<T = any> { data: T; version?: number; total?: number; nextStart?: number; }
export type Fetcher = typeof fetch;
const API = 'https://api.zotero.org';
const gates = new Map<string, { until: number; active: number; touched: number }>();
export async function readBounded(response: Response, max = 16 * 1024 * 1024): Promise<Buffer> {
  if (Number(response.headers.get('content-length')) > max) { await response.body?.cancel(); throw new AppError('RESPONSE_TOO_LARGE', 'Response exceeds configured size limit', 413); }
  if (!response.body) return Buffer.alloc(0);
  const chunks: Uint8Array[] = []; let size = 0;
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > max) { await reader.cancel(); throw new AppError('RESPONSE_TOO_LARGE', 'Response exceeds configured size limit', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
export function storageUrl(value: string): URL {
  const u = new URL(value);
  const allowed = u.hostname === 'api.zotero.org' || u.hostname === 'files.zotero.org' || u.hostname === 'zoterofilestorage.s3.amazonaws.com' || /^zoterofilestorage\.s3[.-][a-z0-9-]+\.amazonaws\.com$/.test(u.hostname);
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') || !allowed) throw new AppError('UNSAFE_STORAGE_URL', 'Zotero returned an unsupported storage host; no request was sent');
  return u;
}

export class Zotero {
  constructor(private apiKey: string, private fetcher: Fetcher = fetch) {}
  private gate() {
    const id = hash(this.apiKey); let gate = gates.get(id);
    if (!gate) {
      if (gates.size > 10000) for (const [key, val] of gates) if (!val.active && val.until < Date.now() && val.touched < Date.now() - 60000) gates.delete(key);
      gate = { until: 0, active: 0, touched: Date.now() }; gates.set(id, gate);
    }
    return gate;
  }
  async raw(path: string, query: Query = {}, init: RequestInit = {}): Promise<Response> {
    if (!/^\/[a-zA-Z][a-zA-Z0-9/_-]*$/.test(path) || path.includes('..')) throw new AppError('INVALID_PATH', 'Invalid API path');
    const gate = this.gate(); gate.touched = Date.now();
    if (gate.until > Date.now()) throw new AppError('BACKOFF', 'Zotero requested a cooldown; retry later', 429, { retryAfter: Math.ceil((gate.until - Date.now()) / 1000) });
    if (gate.active >= 4) throw new AppError('CONCURRENCY_LIMIT', 'At most four concurrent Zotero requests per key', 429);
    const url = new URL(path, API);
    for (const [k, v] of Object.entries(query)) if (v !== undefined) for (const value of Array.isArray(v) ? v : [v]) url.searchParams.append(k, String(value));
    const headers = new Headers(init.headers); headers.set('Zotero-API-Key', this.apiKey); headers.set('Zotero-API-Version', '3');
    gate.active++;
    try {
      const response = await this.fetcher(url, { ...init, headers, redirect: 'manual', signal: AbortSignal.timeout(30000) });
      const retry = response.headers.get('retry-after');
      const seconds = retry ? (/^\d+$/.test(retry) ? Number(retry) : Math.max(0, (Date.parse(retry) - Date.now()) / 1000)) : 0;
      const delay = Math.max(Number(response.headers.get('backoff')) || 0, seconds || 0, response.status === 429 ? 2 : 0);
      if (delay) gate.until = Math.max(gate.until, Date.now() + delay * 1000);
      if (!response.ok && ![301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const messages: Record<number, string> = { 401: 'Zotero API key is invalid', 403: 'Zotero key lacks permission for this operation', 404: 'Item or synchronized content is unavailable', 409: 'Library is locked', 412: 'Version conflict: fetch current data and prepare a new operation', 413: 'Zotero quota or request size exceeded', 429: 'Zotero rate limit reached' };
        throw new AppError('ZOTERO_' + response.status, messages[response.status] ?? 'Zotero rejected the request', response.status, delay ? { retryAfter: delay } : undefined);
      }
      return response;
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw new AppError('ZOTERO_UNAVAILABLE', 'Zotero request failed or timed out; writes are never automatically retried', 502);
    } finally { gate.active--; }
  }
  async request<T = any>(path: string, query: Query = {}, init: RequestInit = {}): Promise<ApiResult<T>> {
    const response = await this.raw(path, query, init);
    if (response.status >= 300) { await response.body?.cancel(); throw new AppError('UNEXPECTED_REDIRECT', 'Unexpected redirect from Zotero'); }
    const text = (await readBounded(response)).toString('utf8');
    let data: any = text;
    if (text && response.headers.get('content-type')?.includes('json')) {
      try { data = JSON.parse(text); } catch { throw new AppError('INVALID_RESPONSE', 'Zotero returned invalid JSON', 502); }
    }
    if (!text) data = null;
    const version = response.headers.get('last-modified-version') ?? response.headers.get('zotero-library-version');
    const total = response.headers.get('total-results');
    const next = /<([^>]+)>;\s*rel="next"/.exec(response.headers.get('link') ?? '');
    return { data, version: version === null ? undefined : Number(version), total: total === null ? undefined : Number(total), nextStart: next ? Number(new URL(next[1]).searchParams.get('start')) : undefined };
  }
  async json(path: string, method: string, body: unknown, version?: number, writeToken?: string, query: Query = {}) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (version !== undefined) headers['If-Unmodified-Since-Version'] = String(version);
    if (writeToken) headers['Zotero-Write-Token'] = writeToken;
    return this.request(path, query, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  }
  async download(path: string, maxBytes: number) {
    let response = await this.raw(path); let hops = 0;
    while ([301, 302, 303, 307, 308].includes(response.status)) {
      if (++hops > 3) throw new AppError('REDIRECT_LIMIT', 'Too many storage redirects');
      const location = response.headers.get('location'); await response.body?.cancel();
      if (!location) throw new AppError('INVALID_REDIRECT', 'Missing storage location');
      // Never forward Zotero credentials to storage, even to an allowed host.
      response = await this.fetcher(storageUrl(location), { redirect: 'manual', signal: AbortSignal.timeout(60000) });
    }
    if (!response.ok) { await response.body?.cancel(); throw new AppError('DOWNLOAD_FAILED', 'Storage download failed', 502); }
    return { bytes: await readBounded(response, maxBytes), contentType: response.headers.get('content-type') ?? 'application/octet-stream' };
  }
  async upload(path: string, bytes: Buffer, filename: string, md5: string, mtime: number, previousMd5?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded', ...(previousMd5 ? { 'If-Match': previousMd5 } : { 'If-None-Match': '*' }) };
    const auth = await this.request(path, {}, { method: 'POST', headers, body: new URLSearchParams({ md5, filename, filesize: String(bytes.length), mtime: String(mtime) }).toString() });
    if (auth.data.exists === 1) return { uploaded: true, deduplicated: true };
    const a = auth.data;
    if (typeof a.prefix !== 'string' || typeof a.suffix !== 'string' || typeof a.uploadKey !== 'string') throw new AppError('UPLOAD_RESPONSE', 'Invalid upload authorization');
    const result = await this.fetcher(storageUrl(a.url), { method: 'POST', headers: { 'Content-Type': a.contentType }, body: new Uint8Array(Buffer.concat([Buffer.from(a.prefix), bytes, Buffer.from(a.suffix)])), redirect: 'manual', signal: AbortSignal.timeout(120000) });
    await result.body?.cancel();
    if (result.status !== 201) throw new AppError('UPLOAD_FAILED', 'Storage upload failed; file has not been registered', 502);
    await this.request(path, {}, { method: 'POST', headers, body: new URLSearchParams({ upload: a.uploadKey }).toString() });
    return { uploaded: true, deduplicated: false };
  }
}
