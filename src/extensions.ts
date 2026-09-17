import { z } from 'zod';
import { Worker } from 'node:worker_threads';
import { add, scope, bounded, key, scan, current, createItems, prefix, type ToolContext } from './tools.js';
import { readBounded } from './zotero.js';
import { AppError } from './errors.js';

async function externalJson(c: ToolContext, url: string, init: RequestInit = {}) {
  try {
    const response = await (c.fetcher ?? fetch)(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!response.ok) { await response.body?.cancel(); throw new AppError('PROVIDER_ERROR', 'External metadata or embedding provider returned HTTP ' + response.status, 502); }
    return JSON.parse((await readBounded(response, 8 * 1024 * 1024)).toString('utf8'));
  } catch (e) { if (e instanceof AppError) throw e; throw new AppError('PROVIDER_UNAVAILABLE', 'External provider timed out or returned invalid data', 502); }
}
export function cslToZotero(d: any) {
  const typeMap: Record<string, string> = { 'article-journal': 'journalArticle', book: 'book', chapter: 'bookSection', 'paper-conference': 'conferencePaper', thesis: 'thesis', report: 'report', webpage: 'webpage', 'article-newspaper': 'newspaperArticle', 'article-magazine': 'magazineArticle' };
  const itemType = typeMap[d.type];
  if (!itemType) throw new AppError('UNSUPPORTED_CSL_TYPE', 'Unsupported CSL type: ' + String(d.type) + '. Use create_item with an official template.');
  const out: Record<string, any> = { itemType, title: String(d.title ?? ''), creators: [], tags: [], collections: [], relations: {}, extra: '' };
  for (const [field, target] of [['author', 'author'], ['editor', 'editor']] as const) for (const p of d[field] ?? []) out.creators.push(p.literal ? { creatorType: target, name: p.literal } : { creatorType: target, firstName: p.given ?? '', lastName: p.family ?? '' });
  for (const [from, to] of [['URL', 'url'], ['abstract', 'abstractNote'], ['language', 'language']] as const) if (d[from]) out[to] = String(d[from]);
  const issued = d.issued?.['date-parts']?.[0]; if (issued) out.date = issued.join('-');
  if (d.DOI) { if (['journalArticle', 'conferencePaper'].includes(itemType)) out.DOI = d.DOI; else out.extra += `DOI: ${d.DOI}\n`; }
  if (d.ISBN && ['book', 'bookSection', 'conferencePaper'].includes(itemType)) out.ISBN = String(d.ISBN);
  if (d['container-title']) out[itemType === 'bookSection' ? 'bookTitle' : itemType === 'conferencePaper' ? 'proceedingsTitle' : 'publicationTitle'] = String(d['container-title']);
  if (['book', 'bookSection', 'conferencePaper', 'report'].includes(itemType) && d.publisher) out[itemType === 'report' ? 'institution' : 'publisher'] = String(d.publisher);
  if (d.page && ['journalArticle', 'bookSection', 'conferencePaper', 'newspaperArticle', 'magazineArticle'].includes(itemType)) out.pages = String(d.page);
  if (d.volume && ['journalArticle', 'book', 'bookSection'].includes(itemType)) out.volume = String(d.volume);
  if (d.issue && ['journalArticle', 'magazineArticle'].includes(itemType)) out.issue = String(d.issue);
  if (d.id) out.extra += `Citation Key: ${d.id}`;
  return out;
}
add('add_by_doi', 'Resolve a DOI through Crossref and preview a Zotero item. Only the identifier is sent to Crossref. Does not download publisher PDFs.', { ...scope, doi: z.string().min(7).max(300), collections: z.array(key).max(50).default([]) }, async (a, c) => {
  const doi = a.doi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  if (!/^10\.\d{4,9}\/\S+$/i.test(doi)) throw new AppError('INVALID_DOI', 'Invalid DOI');
  const r = await externalJson(c, `https://api.crossref.org/works/${encodeURIComponent(doi)}`), d = r.message;
  const types: Record<string, string> = { 'journal-article': 'article-journal', book: 'book', monograph: 'book', 'book-chapter': 'chapter', 'proceedings-article': 'paper-conference', dissertation: 'thesis', report: 'report' };
  const mapped = cslToZotero({ ...d, id: undefined, type: types[d.type] ?? 'article-journal', title: d.title?.[0], 'container-title': d['container-title']?.[0] });
  mapped.collections = a.collections; return createItems(a, c, 'add_by_doi', [mapped]);
}, true);
add('add_by_isbn', 'Resolve a book ISBN through Open Library and preview a Zotero book. Only the ISBN is sent externally.', { ...scope, isbn: z.string().max(30), collections: z.array(key).max(50).default([]) }, async (a, c) => {
  const isbn = a.isbn.replace(/[ -]/g, ''); if (!/^(\d{13}|\d{9}[\dXx])$/.test(isbn)) throw new AppError('INVALID_ISBN', 'Expected ISBN-10 or ISBN-13');
  const r = await externalJson(c, `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`), d = r[`ISBN:${isbn}`];
  if (!d) throw new AppError('ISBN_NOT_FOUND', 'Open Library has no metadata for this ISBN', 404);
  return createItems(a, c, 'add_by_isbn', [{ itemType: 'book', title: d.title, ISBN: isbn, date: d.publish_date ?? '', publisher: (d.publishers ?? []).map((x: any) => x.name).join('; '), creators: (d.authors ?? []).map((x: any) => ({ creatorType: 'author', name: x.name })), collections: a.collections }]);
}, true);
add('add_by_url', 'Create a webpage reference from a user-provided HTTP(S) URL and title. Does not scrape the URL or guess scholarly metadata.', { ...scope, url: z.string().url().refine(v => /^https?:\/\//.test(v)), title: z.string().min(1).max(10000), collections: z.array(key).max(50).default([]) }, async (a, c) => createItems(a, c, 'add_by_url', [{ itemType: 'webpage', title: a.title, url: a.url, accessDate: new Date().toISOString().replace('T', ' ').slice(0, 19), collections: a.collections }]), true);
add('import_csl_json', 'Import up to 50 CSL JSON references. Supported types and mapped fields are documented; preview all converted metadata.', { ...scope, items: z.array(z.record(z.string(), z.unknown())).min(1).max(50), collections: z.array(key).max(50).default([]) }, async (a, c) => createItems(a, c, 'import_csl_json', a.items.map((d: any) => ({ ...cslToZotero(d), collections: a.collections }))), true);
add('import_bibliography', 'Parse inline BibTeX or RIS without filesystem access or network resolution; preview converted CSL metadata before creating items.', { ...scope, text: z.string().min(1).max(250000), format: z.enum(['bibtex', 'ris']), collections: z.array(key).max(50).default([]) }, async (a, c) => {
  const { Cite } = await import('@citation-js/core');
  await import('@citation-js/plugin-bibtex'); await import('@citation-js/plugin-ris');
  let entries: any[];
  try { const cite = new Cite(a.text, { forceType: a.format === 'bibtex' ? '@bibtex/text' : '@ris/file', generateGraph: false }); entries = cite.data; }
  catch { throw new AppError('PARSE_ERROR', 'Bibliography could not be parsed'); }
  if (!entries.length || entries.length > 50) throw new AppError('IMPORT_LIMIT', 'Import 1–50 references per call');
  return createItems(a, c, 'import_bibliography', entries.map(d => ({ ...cslToZotero(d), collections: a.collections })));
}, true);

let activePdfParsers = 0;
async function pdf(c: ToolContext, a: any, mode: 'pages' | 'outline') {
  if (activePdfParsers >= 2) throw new AppError('PDF_BUSY', 'Two PDF operations are already running; retry later', 429);
  activePdfParsers++;
  try {
  const item = await current(a, c); if (item.data.itemType !== 'attachment' || item.data.contentType !== 'application/pdf') throw new AppError('NOT_PDF', 'Use a PDF attachment key');
  const file = await c.api.download(`${prefix(a, c)}/items/${a.itemKey}/file`, c.config.maxFileBytes);
  // Isolate parsing from the HTTP event loop; terminate malformed or pathological PDFs.
  return await new Promise((resolve, reject) => {
    const worker = new Worker(`
      const { parentPort, workerData } = require('node:worker_threads');
      (async () => {
        const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const task = getDocument({ data: new Uint8Array(workerData.bytes), isEvalSupported: false, useSystemFonts: false, useWorkerFetch: false, disableFontFace: true, verbosity: 0 });
        const doc = await task.promise;
        try {
          if (workerData.mode === 'outline') {
            const clean = (entries, depth = 0) => depth > 8 ? [] : (entries || []).slice(0, 200).map(e => ({ title: e.title, destination: typeof e.dest === 'string' ? e.dest : undefined, items: clean(e.items, depth + 1) }));
            parentPort.postMessage({ totalPages: doc.numPages, outline: clean(await doc.getOutline()) });
          } else {
            if (workerData.start > doc.numPages) throw new Error('PAGE_RANGE');
            const pages = []; let remaining = 100000;
            for (let p = workerData.start; p <= Math.min(workerData.end, doc.numPages); p++) {
              const page = await doc.getPage(p), content = await page.getTextContent();
              const text = content.items.map(x => 'str' in x ? x.str + (x.hasEOL ? '\\n' : ' ') : '').join('');
              pages.push({ page: p, text: text.slice(0, remaining), totalChars: text.length, truncated: text.length > remaining }); remaining = Math.max(0, remaining - text.length); page.cleanup();
            }
            parentPort.postMessage({ totalPages: doc.numPages, pages, ocrPerformed: false });
          }
        } finally { await doc.destroy(); }
      })().catch(() => { parentPort.postMessage({ error: true }); });
    `, { eval: true, workerData: { bytes: file.bytes, mode, start: a.startPage, end: a.endPage }, resourceLimits: { maxOldGenerationSizeMb: 256, stackSizeMb: 8 } });
    const timer = setTimeout(() => { void worker.terminate(); reject(new AppError('PDF_TIMEOUT', 'PDF processing exceeded 30 seconds')); }, 30000);
    worker.once('message', value => { clearTimeout(timer); void worker.terminate(); value.error ? reject(new AppError('PDF_PARSE_ERROR', 'PDF is invalid, encrypted, or the page range is unavailable')) : resolve(value); });
    worker.once('error', () => { clearTimeout(timer); reject(new AppError('PDF_PARSE_ERROR', 'PDF parser failed or exceeded its memory budget')); });
    worker.once('exit', code => { if (code !== 0) { clearTimeout(timer); reject(new AppError('PDF_WORKER_STOPPED', 'PDF parser stopped')); } });
  });
  } finally { activePdfParsers--; }
}
add('read_pdf_pages', 'Extract text from up to 10 pages of a synced PDF in an isolated parser. Scanned pages may have no text; no OCR or image rendering.', { ...scope, itemKey: key, startPage: z.number().int().min(1), endPage: z.number().int().min(1) }, async (a, c) => { if (a.endPage < a.startPage || a.endPage - a.startPage >= 10) throw new AppError('PAGE_RANGE', 'Choose 1–10 consecutive pages'); return pdf(c, a, 'pages'); });
add('get_pdf_outline', 'Extract a synced PDF table of contents. Files without bookmarks return an empty outline.', { ...scope, itemKey: key }, (a, c) => pdf(c, a, 'outline'));

interface Index { at: number; model: string; entries: { key: string; title: string; vector: number[] }[]; truncated: boolean; }
const indices = new Map<string, Index>();
const indexKey = (a: any, c: ToolContext) => `${c.principal.id}:${prefix(a, c)}:${c.config.embeddingUrl}:${c.config.embeddingModel}`;
const consent = { consentToExternalProcessing: z.literal(true).describe('User explicitly agreed to send titles, abstracts or search text to the operator-configured embedding provider.') };
function ensureEmbeddings(c: ToolContext) { if (!c.config.embeddingUrl || !c.config.embeddingModel) throw new AppError('SEMANTIC_NOT_CONFIGURED', 'Operator must configure EMBEDDING_URL and EMBEDDING_MODEL. No lexical fallback is labeled semantic search.'); }
async function embed(c: ToolContext, input: string[]) {
  ensureEmbeddings(c);
  const r = await externalJson(c, c.config.embeddingUrl!, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(c.config.embeddingKey ? { Authorization: 'Bearer ' + c.config.embeddingKey } : {}) }, body: JSON.stringify({ model: c.config.embeddingModel, input }) });
  const data = z.array(z.object({ index: z.number().int().min(0), embedding: z.array(z.number().finite()).min(1).max(8192) })).parse(r.data).sort((x, y) => x.index - y.index);
  if (data.length !== input.length || data.some((v, i) => v.index !== i || v.embedding.length !== data[0].embedding.length || !v.embedding.some(x => x !== 0))) throw new AppError('INVALID_EMBEDDINGS', 'Provider returned invalid vectors');
  return data.map(d => d.embedding);
}
export function cosine(a: number[], b: number[]) { if (a.length !== b.length) throw new AppError('INDEX_MODEL_CHANGED', 'Embedding dimensions changed; rebuild the index'); let dot = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; } return dot / (Math.sqrt(na * nb) || 1); }
add('build_semantic_index', 'Build an ephemeral, tenant-isolated semantic index of online titles and abstracts (max 500 items). Sends those texts to the configured embedding provider only with explicit consent.', { ...scope, maxItems: z.number().int().min(1).max(500).default(100), ...consent }, async (a, c) => {
  ensureEmbeddings(c); const r = await scan(c, `${prefix(a, c)}/items/top`, {}, a.maxItems); const entries: Index['entries'] = [];
  for (let i = 0; i < r.entries.length; i += 16) {
    const batch = r.entries.slice(i, i + 16), vectors = await embed(c, batch.map(e => `${e.data.title ?? ''}\n${e.data.abstractNote ?? ''}`.slice(0, 10000)));
    batch.forEach((e, j) => entries.push({ key: e.key, title: e.data.title ?? '', vector: vectors[j] }));
  }
  for (const [k, v] of indices) if (Date.now() - v.at > 3600000) indices.delete(k);
  if (indices.size >= 20) indices.delete(indices.keys().next().value!);
  indices.set(indexKey(a, c), { at: Date.now(), model: c.config.embeddingModel!, entries, truncated: r.truncated });
  return { indexed: entries.length, truncated: r.truncated, expiresInSeconds: 3600, model: c.config.embeddingModel, content: 'titles_and_abstracts', persistence: 'memory_only' };
});
add('semantic_status', 'Report semantic provider configuration and current library index coverage.', scope, async (a, c) => {
  const index = indices.get(indexKey(a, c)); return { configured: !!c.config.embeddingUrl, indexed: index?.entries.length ?? 0, stale: !index || Date.now() - index.at > 3600000, builtAt: index ? new Date(index.at).toISOString() : null, truncated: index?.truncated, model: c.config.embeddingModel };
});
async function semantic(a: any, c: ToolContext, text: string, excluded?: string) {
  ensureEmbeddings(c); const index = indices.get(indexKey(a, c));
  if (!index || Date.now() - index.at > 3600000) throw new AppError('INDEX_REQUIRED', 'Build a fresh semantic index for this library first');
  await c.api.request(`${prefix(a, c)}/items`, { limit: 1 }); // Revalidate access before consulting cached private titles.
  const [vector] = await embed(c, [text.slice(0, 10000)]);
  const ranked = index.entries.filter(e => e.key !== excluded).map(e => ({ itemKey: e.key, score: cosine(vector, e.vector) })).sort((a, b) => b.score - a.score).slice(0, a.limit);
  // Resolve candidates live: removed or inaccessible records must not leak stale cached titles.
  const live = ranked.length ? await c.api.request(`${prefix(a, c)}/items`, { itemKey: ranked.map(e => e.itemKey).join(','), limit: 100 }) : { data: [] };
  return { results: ranked.filter(e => live.data.some((r: any) => r.key === e.itemKey)).map(e => ({ ...e, item: live.data.find((r: any) => r.key === e.itemKey) })), indexed: index.entries.length, truncated: index.truncated, builtAt: new Date(index.at).toISOString() };
}
add('semantic_search', 'Rank the current online-library index with real embedding cosine similarity; requires a configured provider and fresh index.', { ...scope, query: z.string().min(1).max(10000), limit: z.number().int().min(1).max(50).default(10), ...consent }, (a, c) => semantic(a, c, a.query));
add('find_similar', 'Find semantically related online items using a source title and abstract.', { ...scope, itemKey: key, limit: z.number().int().min(1).max(50).default(10), ...consent }, async (a, c) => { const source = await current(a, c); return semantic(a, c, `${source.data.title ?? ''}\n${source.data.abstractNote ?? ''}`, a.itemKey); });
add('clear_semantic_index', 'Clear only your current library semantic index from server memory.', scope, async (a, c) => ({ cleared: indices.delete(indexKey(a, c)) }));
