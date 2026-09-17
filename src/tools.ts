import { z } from 'zod';
import { createHash } from 'node:crypto';
import type { Config } from './config.js';
import { AppError } from './errors.js';
import type { Principal } from './store.js';
import { Zotero, type Query, type ApiResult } from './zotero.js';
import { Plans, type Command } from './plans.js';

const key = z.string().regex(/^[A-Z0-9]{8}$/);
const library = z.object({ type: z.enum(['user', 'group']), id: z.string().regex(/^[1-9]\d*$/) }).optional().describe('Defaults to your personal online library. Pass a group id explicitly for a group library.');
const page = { start: z.number().int().min(0).default(0), limit: z.number().int().min(1).max(100).default(25) };
const scope = { library };
const item = { ...scope, itemKey: key };
const collection = { ...scope, collectionKey: key };
const object = z.record(z.string(), z.unknown());
const version = z.number().int().min(0);
const keys = z.array(key).min(1).max(50).refine(v => new Set(v).size === v.length, 'Keys must be unique');
const searchFields = {
  q: z.string().max(1000).optional(), qmode: z.enum(['titleCreatorYear', 'everything']).optional(),
  tags: z.array(z.string().max(255)).max(30).optional().describe('Repeated tags use AND; use || within a tag for OR and a leading - for NOT.'),
  itemType: z.string().max(200).optional(), since: version.optional(),
  sort: z.enum(['dateAdded', 'dateModified', 'title', 'creator', 'itemType', 'date', 'publicationTitle']).optional(), direction: z.enum(['asc', 'desc']).optional(),
};
const bounded = { maxItems: z.number().int().min(1).max(5000).default(500) };
const creator = z.object({ creatorType: z.string(), firstName: z.string().optional(), lastName: z.string().optional(), name: z.string().optional() });
const nonempty = z.string().trim().min(1).max(10000);
export interface ToolContext { principal: Principal; api: Zotero; plans: Plans; config: Config; fetcher?: typeof fetch; }
export interface Tool { name: string; description: string; schema: z.ZodObject<any>; write: boolean; run: (a: any, c: ToolContext) => Promise<unknown>; }
export const tools: Tool[] = [];
function add(name: string, description: string, shape: z.ZodRawShape, run: Tool['run'], write = false) {
  tools.push({ name, description: description + (write && name !== 'execute_write' ? ' Returns an exact write preview and confirmation token; it does not write until execute_write is explicitly approved.' : ''), schema: z.object(shape).strict(), run, write });
}
export function prefix(a: any, c: ToolContext) { return a.library ? `/${a.library.type === 'group' ? 'groups' : 'users'}/${a.library.id}` : `/users/${c.principal.userId}`; }
function query(a: any): Query {
  return { start: a.start, limit: a.limit, q: a.q, qmode: a.qmode, tag: a.tags, itemType: a.itemType, since: a.since, sort: a.sort, direction: a.direction };
}
async function scan(c: ToolContext, path: string, params: Query = {}, max = 500) {
  const entries: any[] = []; let start = 0; let total: number | undefined; let last: ApiResult | undefined;
  while (entries.length < max) {
    const limit = Math.min(100, max - entries.length);
    last = await c.api.request(path, { ...params, start, limit });
    if (!Array.isArray(last.data)) throw new AppError('INVALID_RESPONSE', 'Expected a Zotero list response', 502);
    entries.push(...last.data); total = last.total;
    if (last.nextStart !== undefined) start = last.nextStart;
    else { start += last.data.length; if (last.data.length < limit || (total !== undefined && start >= total)) break; }
    if (!last.data.length) break;
  }
  return { entries, scanned: entries.length, total, truncated: last?.nextStart !== undefined || (total !== undefined ? entries.length < total : entries.length === max), nextStart: start };
}
async function current(a: any, c: ToolContext, kind = 'items') {
  const k = kind === 'collections' ? a.collectionKey : kind === 'searches' ? a.searchKey : a.itemKey;
  const result = await c.api.request(`${prefix(a, c)}/${kind}/${k}`);
  if (a.version !== undefined && a.version !== result.data.version) throw new AppError('VERSION_CONFLICT', 'The supplied object version is stale; retrieve the object again', 409);
  return result.data;
}
function validateItemData(data: Record<string, any>, creating = false) {
  if (creating && (typeof data.itemType !== 'string' || !/^[a-zA-Z]+$/.test(data.itemType))) throw new AppError('ITEM_TYPE_REQUIRED', 'Supply a valid Zotero itemType');
  const forbidden = creating ? ['key', 'version', 'deleted'] : ['key', 'version', 'deleted', 'itemType', 'linkMode', 'md5', 'mtime'];
  if (forbidden.some(k => k in data)) throw new AppError('PROTECTED_FIELD', `Use the dedicated operation for protected fields: ${forbidden.join(', ')}`);
  if (data.linkMode === 'linked_file' || 'path' in data) throw new AppError('LOCAL_FILES_UNSUPPORTED', 'Local file paths and linked_file attachments are unsupported');
  if (!Object.keys(data).length) throw new AppError('EMPTY_PATCH', 'No fields supplied');
}
function plan(c: ToolContext, tool: string, commands: Command[], preview: unknown) { return c.plans.prepare(c.principal, tool, commands, preview); }
function createItems(a: any, c: ToolContext, name: string, entries: any[]) {
  entries.forEach(d => validateItemData(d, true));
  const bodies = entries.map(d => ({ tags: [], collections: [], relations: {}, ...d }));
  return plan(c, name, [{ path: `${prefix(a, c)}/items`, method: 'POST', body: bodies }], { library: prefix(a, c), create: bodies });
}
async function patchItem(a: any, c: ToolContext, name: string, patch: any, expectedType?: string) {
  const before = await current(a, c);
  if (expectedType && before.data.itemType !== expectedType) throw new AppError('WRONG_ITEM_TYPE', `Expected ${expectedType}`);
  return plan(c, name, [{ path: `${prefix(a, c)}/items/${a.itemKey}`, method: 'PATCH', version: before.version, body: patch }], { itemKey: a.itemKey, version: before.version, before: before.data, changes: patch });
}

add('get_libraries', 'List your personal library and accessible group libraries.', page, async (a, c) => ({ personal: { type: 'user', id: c.principal.userId }, groups: await c.api.request(`/users/${c.principal.userId}/groups`, query(a)) }));
add('get_key_permissions', 'Inspect Zotero key permissions without returning the key.', {}, async (_a, c) => {
  const r = await c.api.request('/keys/current'); return { userID: r.data.userID, username: r.data.username, access: r.data.access };
});
add('search_libraries', 'Search up to 10 explicitly selected personal/group libraries. Each library reports its own results or error; no implicit cross-library selection.', { libraries: z.array(z.object({ type: z.enum(['user', 'group']), id: z.string().regex(/^[1-9]\d*$/) })).min(1).max(10), query: nonempty, ...page }, async (a, c) => {
  const results = [];
  for (const library of a.libraries) {
    try { results.push({ library, result: await c.api.request(`${prefix({ library }, c)}/items`, { q: a.query, start: a.start, limit: a.limit }) }); }
    catch (e) { if (!(e instanceof AppError)) throw e; results.push({ library, error: { code: e.code, message: e.message } }); }
  }
  return { results };
});
add('search_library', 'Search online titles, creators, years, tags, item types, or synced full text. Includes pagination metadata.', { ...scope, ...page, ...searchFields }, (a, c) => c.api.request(`${prefix(a, c)}/items`, query(a)));
add('get_recent', 'Get recently added online items.', { ...scope, ...page }, (a, c) => c.api.request(`${prefix(a, c)}/items/top`, { ...query(a), sort: 'dateAdded', direction: 'desc' }));
add('get_item_details', 'Get an item including editable metadata and version.', item, (a, c) => c.api.request(`${prefix(a, c)}/items/${a.itemKey}`));
add('get_items_batch', 'Fetch up to 50 items by their keys; compare returned keys for inaccessible or missing items.', { ...scope, itemKeys: keys }, (a, c) => c.api.request(`${prefix(a, c)}/items`, { itemKey: a.itemKeys.join(','), limit: 100 }));
add('get_item_children', 'List child attachments, notes and annotations with pagination.', { ...item, ...page }, (a, c) => c.api.request(`${prefix(a, c)}/items/${a.itemKey}/children`, query(a)));
add('get_item_abstract', 'Read the stored abstract without retrieving attachments.', item, async (a, c) => { const r = await current(a, c); return { itemKey: a.itemKey, title: r.data.title, abstract: r.data.abstractNote ?? '' }; });
add('get_trash', 'List items in the online trash.', { ...scope, ...page }, (a, c) => c.api.request(`${prefix(a, c)}/items/trash`, query(a)));
add('get_publications', 'List My Publications from your personal library.', page, (a, c) => c.api.request(`/users/${c.principal.userId}/publications/items`, query(a)));

add('get_collections', 'List collections; use topOnly for root collections.', { ...scope, ...page, topOnly: z.boolean().default(false) }, (a, c) => c.api.request(`${prefix(a, c)}/collections${a.topOnly ? '/top' : ''}`, query(a)));
add('get_collection_details', 'Get a collection and its current version.', collection, (a, c) => c.api.request(`${prefix(a, c)}/collections/${a.collectionKey}`));
add('get_collection_items', 'List items in a collection.', { ...collection, ...page, ...searchFields, topOnly: z.boolean().default(false) }, (a, c) => c.api.request(`${prefix(a, c)}/collections/${a.collectionKey}/items${a.topOnly ? '/top' : ''}`, query(a)));
add('get_subcollections', 'List direct child collections.', { ...collection, ...page }, (a, c) => c.api.request(`${prefix(a, c)}/collections/${a.collectionKey}/collections`, query(a)));
add('search_collections', 'Find collections by case-insensitive name within a bounded scan; reports incomplete scans.', { ...scope, ...bounded, query: nonempty }, async (a, c) => { const r = await scan(c, `${prefix(a, c)}/collections`, {}, a.maxItems); return { ...r, entries: r.entries.filter(e => e.data.name.toLowerCase().includes(a.query.toLowerCase())) }; });
add('get_collection_tree', 'Build collection hierarchy from a bounded remote scan; missing parents remain visible.', { ...scope, ...bounded }, async (a, c) => {
  const r = await scan(c, `${prefix(a, c)}/collections`, {}, a.maxItems);
  const nodes = new Map<string, any>(r.entries.map(e => [e.key, { key: e.key, name: e.data.name, parent: e.data.parentCollection, children: [] }]));
  const roots: any[] = [];
  for (const n of nodes.values()) { const parent = nodes.get(n.parent); if (parent && parent !== n) parent.children.push(n); else roots.push(n); }
  return { ...r, entries: undefined, roots };
});
add('get_tags', 'List library or collection tags.', { ...scope, ...page, collectionKey: key.optional(), q: z.string().max(255).optional() }, (a, c) => c.api.request(`${prefix(a, c)}${a.collectionKey ? '/collections/' + a.collectionKey : ''}/tags`, { ...query(a), q: a.q }));
add('get_item_tags', 'List tags assigned to one item.', item, (a, c) => c.api.request(`${prefix(a, c)}/items/${a.itemKey}/tags`));
add('get_saved_searches', 'List saved search definitions. Zotero Web API does not execute saved searches.', { ...scope, ...page }, (a, c) => c.api.request(`${prefix(a, c)}/searches`, query(a)));
add('get_saved_search', 'Read a saved search definition.', { ...scope, searchKey: key }, (a, c) => c.api.request(`${prefix(a, c)}/searches/${a.searchKey}`));
add('get_item_types', 'List official Zotero item types.', {}, (_a, c) => c.api.request('/itemTypes'));
add('get_item_fields', 'List valid fields for an item type.', { itemType: z.string().regex(/^[a-zA-Z]+$/) }, (a, c) => c.api.request('/itemTypeFields', { itemType: a.itemType }));
add('get_creator_types', 'List valid creator roles for an item type.', { itemType: z.string().regex(/^[a-zA-Z]+$/) }, (a, c) => c.api.request('/itemTypeCreatorTypes', { itemType: a.itemType }));
add('get_item_template', 'Get an official editable item template before creation.', { itemType: z.string().regex(/^[a-zA-Z]+$/), linkMode: z.enum(['imported_file', 'imported_url', 'linked_url']).optional(), annotationType: z.enum(['highlight', 'underline', 'note', 'image', 'ink', 'text']).optional() }, (a, c) => c.api.request('/items/new', a));
add('get_sync_versions', 'Get remote object versions since a library version.', { ...scope, since: version.default(0), kind: z.enum(['items', 'collections', 'searches']) }, (a, c) => c.api.request(`${prefix(a, c)}/${a.kind}`, { since: a.since, format: 'versions' }));
add('get_deleted', 'Get deletion log since a library version.', { ...scope, since: version }, (a, c) => c.api.request(`${prefix(a, c)}/deleted`, { since: a.since }));
add('get_fulltext_versions', 'List attachments with synced full-text changes since a version.', { ...scope, since: version.default(0) }, (a, c) => c.api.request(`${prefix(a, c)}/fulltext`, { since: a.since }));

add('get_item_fulltext', 'Read synced full text of an attachment with explicit character paging. 404 means missing or unsynced content.', { ...item, offset: z.number().int().min(0).default(0), maxChars: z.number().int().min(100).max(100000).default(20000) }, async (a, c) => {
  const r = await c.api.request(`${prefix(a, c)}/items/${a.itemKey}/fulltext`); const content = r.data.content ?? '';
  return { ...r, data: { ...r.data, content: content.slice(a.offset, a.offset + a.maxChars), totalChars: content.length, nextOffset: a.offset + a.maxChars < content.length ? a.offset + a.maxChars : null } };
});
add('search_fulltext', 'Search Zotero synced full text using its everything search mode.', { ...scope, ...page, query: nonempty }, (a, c) => c.api.request(`${prefix(a, c)}/items`, { ...query(a), q: a.query, qmode: 'everything' }));
add('get_content', 'Get abstract, notes and synced attachment text. Mode bounds output; each missing source is reported.', { ...item, mode: z.enum(['minimal', 'preview', 'standard', 'complete']).default('standard'), ...bounded }, async (a, c) => {
  const root = await current(a, c), cap = { minimal: 1000, preview: 5000, standard: 20000, complete: 100000 }[a.mode as string] ?? 20000;
  const children = root.data.itemType === 'attachment' ? { entries: [root], truncated: false } : await scan(c, `${prefix(a, c)}/items/${a.itemKey}/children`, {}, Math.min(a.maxItems, 100));
  let remaining = cap; const sources: any[] = [];
  for (const child of children.entries) {
    if (remaining <= 0) break;
    let text = child.data.note ?? '';
    if (child.data.itemType === 'attachment') {
      try { text = (await c.api.request(`${prefix(a, c)}/items/${child.key}/fulltext`)).data.content ?? ''; }
      catch (e) { if (e instanceof AppError && e.status === 404) { sources.push({ itemKey: child.key, status: 'not_synced_or_missing' }); continue; } throw e; }
    }
    if (text) { sources.push({ itemKey: child.key, type: child.data.itemType, text: text.slice(0, remaining), totalChars: text.length, truncated: text.length > remaining }); remaining -= Math.min(text.length, remaining); }
  }
  return { itemKey: a.itemKey, title: root.data.title, abstract: root.data.abstractNote ?? '', note: root.data.itemType === 'note' ? root.data.note : undefined, sources, childrenTruncated: children.truncated, budgetExhausted: remaining <= 0 };
});
add('get_notes', 'List notes; query matches note HTML/text within the scanned page set.', { ...scope, ...bounded, query: z.string().optional() }, async (a, c) => { const r = await scan(c, `${prefix(a, c)}/items`, { itemType: 'note' }, a.maxItems); return { ...r, entries: r.entries.filter(e => !a.query || String(e.data.note).toLowerCase().includes(a.query.toLowerCase())) }; });
add('get_annotations', 'List synced Zotero annotations under one attachment.', { ...item, ...page }, (a, c) => c.api.request(`${prefix(a, c)}/items/${a.itemKey}/children`, { ...query(a), itemType: 'annotation' }));
add('search_annotations', 'Filter synced annotations by text, comment, color and tags within a bounded scan.', { ...scope, ...bounded, query: z.string().optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), tag: z.string().optional() }, async (a, c) => {
  const r = await scan(c, `${prefix(a, c)}/items`, { itemType: 'annotation' }, a.maxItems);
  return { ...r, entries: r.entries.filter(e => (!a.query || `${e.data.annotationText ?? ''} ${e.data.annotationComment ?? ''}`.toLowerCase().includes(a.query.toLowerCase())) && (!a.color || e.data.annotationColor?.toLowerCase() === a.color.toLowerCase()) && (!a.tag || e.data.tags?.some((t: any) => t.tag === a.tag))) };
});
add('synthesize_annotations', 'Group synced annotation excerpts and comments by attachment for a literature digest. No AI-generated claims.', { ...scope, ...bounded }, async (a, c) => {
  const r = await scan(c, `${prefix(a, c)}/items`, { itemType: 'annotation' }, a.maxItems); const groups: Record<string, any[]> = {};
  for (const e of r.entries) (groups[e.data.parentItem] ??= []).push({ key: e.key, text: e.data.annotationText, comment: e.data.annotationComment, page: e.data.annotationPageLabel, color: e.data.annotationColor });
  return { scanned: r.scanned, truncated: r.truncated, groups };
});
add('export_items', 'Export up to 50 selected items as BibTeX, BibLaTeX, RIS, CSL JSON, CSV or other official formats.', { ...scope, itemKeys: keys, format: z.enum(['bibtex', 'biblatex', 'ris', 'csljson', 'csv', 'mods', 'tei', 'rdf_zotero', 'wikipedia']) }, (a, c) => c.api.request(`${prefix(a, c)}/items`, { itemKey: a.itemKeys.join(','), format: a.format, limit: 100 }));
add('get_bibliography', 'Generate a formatted bibliography using an official CSL style id.', { ...scope, itemKeys: keys, style: z.string().regex(/^[a-z0-9-]+$/).default('apa'), locale: z.string().regex(/^[a-z]{2}-[A-Z]{2}$/).default('en-US') }, (a, c) => c.api.request(`${prefix(a, c)}/items`, { itemKey: a.itemKeys.join(','), format: 'bib', style: a.style, locale: a.locale }));
add('get_citations', 'Get formatted in-text citations for selected items.', { ...scope, itemKeys: keys, style: z.string().regex(/^[a-z0-9-]+$/).default('apa'), locale: z.string().default('en-US') }, (a, c) => c.api.request(`${prefix(a, c)}/items`, { itemKey: a.itemKeys.join(','), include: 'citation', style: a.style, locale: a.locale, limit: 100 }));
add('download_attachment', 'Download a synced Zotero Storage attachment as base64. Size limited; no local filesystem or arbitrary URL access.', item, async (a, c) => {
  const r = await current(a, c); if (r.data.itemType !== 'attachment') throw new AppError('WRONG_ITEM_TYPE', 'Use an attachment key');
  const result = await c.api.download(`${prefix(a, c)}/items/${a.itemKey}/file`, c.config.maxFileBytes);
  return { itemKey: a.itemKey, filename: r.data.filename, contentType: result.contentType, size: result.bytes.length, base64: result.bytes.toString('base64') };
});

add('create_item', 'Create a bibliographic item from Zotero editable JSON. Use get_item_template for supported fields.', { ...scope, data: object }, async (a, c) => createItems(a, c, 'create_item', [a.data]), true);
add('create_items_batch', 'Create up to 50 items with partial-failure reporting.', { ...scope, items: z.array(object).min(1).max(50) }, async (a, c) => createItems(a, c, 'create_items_batch', a.items), true);
add('update_item', 'Patch selected metadata fields using the version from a preceding read.', { ...item, version, patch: object }, async (a, c) => { validateItemData(a.patch); return patchItem(a, c, 'update_item', a.patch); }, true);
add('update_items_batch', 'Patch up to 50 items with explicit object versions; arrays replace their entire fields.', { ...scope, updates: z.array(z.object({ key, version, patch: object })).min(1).max(50) }, async (a, c) => {
  if (new Set(a.updates.map((u: any) => u.key)).size !== a.updates.length) throw new AppError('DUPLICATE_KEYS', 'Duplicate item keys');
  a.updates.forEach((u: any) => validateItemData(u.patch));
  const entries = a.updates.map((u: any) => ({ ...u.patch, key: u.key, version: u.version }));
  return plan(c, 'update_items_batch', [{ method: 'POST', path: `${prefix(a, c)}/items`, body: entries }], { library: prefix(a, c), updates: entries });
}, true);
add('trash_item', 'Move an item to trash with version protection.', { ...item, version }, (a, c) => patchItem(a, c, 'trash_item', { deleted: 1 }), true);
add('restore_item', 'Restore a trashed item with version protection.', { ...item, version }, (a, c) => patchItem(a, c, 'restore_item', { deleted: 0 }), true);
add('delete_item', 'PERMANENTLY delete an item. Preview includes its metadata; children may also be removed by Zotero.', { ...item, version }, async (a, c) => {
  const before = await current(a, c); return plan(c, 'delete_item', [{ method: 'DELETE', path: `${prefix(a, c)}/items/${a.itemKey}`, version: before.version }], { permanentlyDelete: before, warning: 'This is irreversible and may delete child notes, attachments and annotations.' });
}, true);
add('create_note', 'Create a standalone note or child note using Zotero note HTML.', { ...scope, parentItem: key.optional(), html: z.string().min(1).max(100000), tags: z.array(z.string()).default([]) }, async (a, c) => createItems(a, c, 'create_note', [{ itemType: 'note', note: a.html, parentItem: a.parentItem, tags: a.tags.map((tag: string) => ({ tag })) }]), true);
add('update_note', 'Update an existing note, retaining other fields.', { ...item, version, html: z.string().max(100000) }, (a, c) => patchItem(a, c, 'update_note', { note: a.html }, 'note'), true);
add('create_annotation', 'Create a synced annotation under an attachment. Supply valid Zotero position JSON and sort index from the document geometry.', { ...scope, parentItem: key, type: z.enum(['highlight', 'underline', 'note', 'image', 'ink', 'text']), text: z.string().default(''), comment: z.string().default(''), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#ffd400'), pageLabel: z.string(), sortIndex: z.string().max(100), position: object }, async (a, c) => createItems(a, c, 'create_annotation', [{ itemType: 'annotation', parentItem: a.parentItem, annotationType: a.type, annotationText: a.text, annotationComment: a.comment, annotationColor: a.color, annotationPageLabel: a.pageLabel, annotationSortIndex: a.sortIndex, annotationPosition: JSON.stringify(a.position) }]), true);
add('update_annotation', 'Update annotation text, comment, color or tags.', { ...item, version, text: z.string().optional(), comment: z.string().optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), tags: z.array(z.string()).optional() }, async (a, c) => {
  const patch: any = {}; if (a.text !== undefined) patch.annotationText = a.text; if (a.comment !== undefined) patch.annotationComment = a.comment; if (a.color) patch.annotationColor = a.color; if (a.tags) patch.tags = a.tags.map((tag: string) => ({ tag }));
  if (!Object.keys(patch).length) throw new AppError('EMPTY_PATCH', 'Supply at least one change');
  return patchItem(a, c, 'update_annotation', patch, 'annotation');
}, true);
add('create_collection', 'Create a collection, optionally under a parent.', { ...scope, name: nonempty, parentCollection: key.optional() }, async (a, c) => {
  const data = { name: a.name, parentCollection: a.parentCollection ?? false };
  return plan(c, 'create_collection', [{ method: 'POST', path: `${prefix(a, c)}/collections`, body: [data] }], { create: data, library: prefix(a, c) });
}, true);
add('update_collection', 'Rename or reparent a collection; null moves it to the root.', { ...collection, version, name: nonempty.optional(), parentCollection: key.nullable().optional() }, async (a, c) => {
  const before = await current(a, c, 'collections'); const patch: any = {};
  if (a.name !== undefined) patch.name = a.name;
  if (a.parentCollection !== undefined) patch.parentCollection = a.parentCollection ?? false;
  if (!Object.keys(patch).length || a.parentCollection === a.collectionKey) throw new AppError('INVALID_PATCH', 'Supply changes and do not parent a collection to itself');
  return plan(c, 'update_collection', [{ method: 'PUT', path: `${prefix(a, c)}/collections/${a.collectionKey}`, version: before.version, body: { ...before.data, ...patch } }], { before: before.data, changes: patch });
}, true);
add('delete_collection', 'Permanently delete a collection and its subcollections; this does not delete the member items.', { ...collection, version }, async (a, c) => {
  const before = await current(a, c, 'collections'); return plan(c, 'delete_collection', [{ method: 'DELETE', path: `${prefix(a, c)}/collections/${a.collectionKey}`, version: before.version }], { permanentlyDeleteCollection: before, warning: 'Subcollections will also be deleted.' });
}, true);
add('manage_item_collections', 'Add or remove collection memberships on up to 50 items, preserving other memberships.', { ...scope, itemKeys: keys, collectionKeys: keys, action: z.enum(['add', 'remove']) }, async (a, c) => {
  const changes = [];
  for (const itemKey of a.itemKeys) {
    const before = await current({ ...a, itemKey }, c); const old: string[] = before.data.collections ?? [];
    const collections = a.action === 'add' ? [...new Set([...old, ...a.collectionKeys])] : old.filter(k => !a.collectionKeys.includes(k));
    changes.push({ key: itemKey, version: before.version, collections });
  }
  return plan(c, 'manage_item_collections', [{ method: 'POST', path: `${prefix(a, c)}/items`, body: changes }], { memberships: changes });
}, true);
add('manage_tags', 'Add or remove tags on up to 50 items, preserving untouched tags and their types.', { ...scope, itemKeys: keys, tags: z.array(z.string().min(1).max(255)).min(1).max(50), action: z.enum(['add', 'remove']) }, async (a, c) => {
  const changes = [];
  for (const itemKey of a.itemKeys) {
    const before = await current({ ...a, itemKey }, c); const old: any[] = before.data.tags ?? [];
    const tags = a.action === 'remove' ? old.filter(t => !a.tags.includes(t.tag)) : [...old, ...a.tags.filter((t: string) => !old.some(x => x.tag === t)).map((tag: string) => ({ tag }))];
    changes.push({ key: itemKey, version: before.version, tags });
  }
  return plan(c, 'manage_tags', [{ method: 'POST', path: `${prefix(a, c)}/items`, body: changes }], { changes });
}, true);
add('set_item_parent', 'Set or clear the parent of a note or attachment; null makes it standalone.', { ...item, version, parentItem: key.nullable() }, async (a, c) => {
  const before = await current(a, c); if (!['note', 'attachment'].includes(before.data.itemType) || a.parentItem === a.itemKey) throw new AppError('INVALID_PARENT', 'Only notes and attachments can be reparented');
  return patchItem(a, c, 'set_item_parent', { parentItem: a.parentItem ?? false });
}, true);
add('get_item_related', 'Read explicit item relations.', item, async (a, c) => ({ itemKey: a.itemKey, relations: (await current(a, c)).data.relations ?? {} }));
add('manage_relation', 'Add or remove a bidirectional dc:relation between two items in one library. Batch outcomes are reported per item.', { ...item, relatedItemKey: key, action: z.enum(['add', 'remove']) }, async (a, c) => {
  if (a.itemKey === a.relatedItemKey) throw new AppError('INVALID_RELATION', 'Cannot relate an item to itself');
  const changes = [];
  for (const [itemKey, other] of [[a.itemKey, a.relatedItemKey], [a.relatedItemKey, a.itemKey]]) {
    const before = await current({ ...a, itemKey }, c); const relations = { ...before.data.relations };
    const uri = `http://zotero.org${prefix(a, c)}/items/${other}`;
    const old = relations['dc:relation'] ? [relations['dc:relation']].flat() : [];
    relations['dc:relation'] = a.action === 'add' ? [...new Set([...old, uri])] : old.filter((v: string) => v !== uri);
    changes.push({ key: itemKey, version: before.version, relations });
  }
  return plan(c, 'manage_relation', [{ method: 'POST', path: `${prefix(a, c)}/items`, body: changes }], { changes });
}, true);
add('create_saved_search', 'Create a saved search definition; conditions follow Zotero API syntax.', { ...scope, name: nonempty, conditions: z.array(z.object({ condition: z.string(), operator: z.string(), value: z.string() })).min(1).max(50) }, async (a, c) => {
  const body = [{ name: a.name, conditions: a.conditions }]; return plan(c, 'create_saved_search', [{ method: 'POST', path: `${prefix(a, c)}/searches`, body }], { create: body });
}, true);
add('update_saved_search', 'Update a saved search definition using versioned batch-write semantics.', { ...scope, searchKey: key, version, name: nonempty, conditions: z.array(z.object({ condition: z.string(), operator: z.string(), value: z.string() })).min(1).max(50) }, async (a, c) => {
  const before = await current(a, c, 'searches'), data = { key: a.searchKey, version: before.version, name: a.name, conditions: a.conditions };
  return plan(c, 'update_saved_search', [{ method: 'POST', path: `${prefix(a, c)}/searches`, body: [data] }], { before, changes: data });
}, true);
add('delete_saved_search', 'Delete one saved search definition with object and library version protection.', { ...scope, searchKey: key, version }, async (a, c) => {
  const libraryState = await c.api.request(`${prefix(a, c)}/searches`, { limit: 1 });
  const before = await current(a, c, 'searches');
  if (libraryState.version === undefined) throw new AppError('MISSING_VERSION', 'Zotero did not return the library version');
  return plan(c, 'delete_saved_search', [{ method: 'DELETE', path: `${prefix(a, c)}/searches`, query: { searchKey: a.searchKey }, version: libraryState.version }], { delete: before, libraryVersion: libraryState.version });
}, true);
add('create_attachment', 'Create an attachment record. Use upload_attachment next to upload bytes for imported_file; linked_url stores only a remote link.', { ...scope, parentItem: key.optional(), title: nonempty, filename: z.string().max(255).optional(), contentType: z.string().max(100).default('application/pdf'), linkMode: z.enum(['imported_file', 'linked_url']).default('imported_file'), url: z.string().url().optional() }, async (a, c) => {
  if (a.linkMode === 'linked_url' && (!a.url || !/^https?:\/\//.test(a.url))) throw new AppError('URL_REQUIRED', 'linked_url requires an HTTP(S) URL');
  return createItems(a, c, 'create_attachment', [{ itemType: 'attachment', linkMode: a.linkMode, parentItem: a.parentItem, title: a.title, filename: a.filename, contentType: a.contentType, url: a.url }]);
}, true);
add('upload_attachment', 'Upload or replace bytes for an existing Zotero Storage attachment using authorization, storage upload, and registration. Base64 size is bounded.', { ...item, version, base64: z.string().min(4), filename: z.string().min(1).max(255).regex(/^[^/\\\x00-\x1f]+$/), mtime: z.number().int().min(0) }, async (a, c) => {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(a.base64) || a.base64.length > Math.ceil(c.config.maxFileBytes / 3) * 4) throw new AppError('INVALID_FILE', 'Invalid base64 or file too large', 413);
  const bytes = Buffer.from(a.base64, 'base64'); if (bytes.length > c.config.maxFileBytes) throw new AppError('FILE_TOO_LARGE', 'File too large', 413);
  const before = await current(a, c);
  if (before.data.itemType !== 'attachment' || !['imported_file', 'imported_url'].includes(before.data.linkMode)) throw new AppError('INVALID_ATTACHMENT', 'Use an imported Zotero Storage attachment');
  const md5 = createHash('md5').update(bytes).digest('hex');
  return plan(c, 'upload_attachment', [{ method: 'UPLOAD', path: `${prefix(a, c)}/items/${a.itemKey}/file`, base64: a.base64, filename: a.filename, md5, mtime: a.mtime, previousMd5: before.data.md5 ?? undefined }], { itemKey: a.itemKey, filename: a.filename, bytes: bytes.length, md5, replacesExistingFile: !!before.data.md5 });
}, true);
add('set_fulltext', 'Upload extracted text to the online full-text index; this does not upload the source file.', { ...item, content: z.string().max(1000000), indexedPages: z.number().int().min(0).optional(), totalPages: z.number().int().min(0).optional() }, async (a, c) => {
  const data = a.indexedPages !== undefined && a.totalPages !== undefined ? { content: a.content, indexedPages: a.indexedPages, totalPages: a.totalPages } : { content: a.content, indexedChars: a.content.length, totalChars: a.content.length };
  return plan(c, 'set_fulltext', [{ method: 'PUT', path: `${prefix(a, c)}/items/${a.itemKey}/fulltext`, body: data }], { itemKey: a.itemKey, characters: a.content.length, preview: a.content.slice(0, 500), warning: 'Zotero full-text writes do not support optimistic concurrency protection.' });
}, true);
add('execute_write', 'Execute a prepared plan ONLY after the user explicitly approves its preview. Consumes its tenant-bound token once, including on upstream failure.', { confirmationToken: z.string().min(32).max(128) }, (a, c) => c.plans.execute(c.principal, c.api, a.confirmationToken), true);

add('advanced_search', 'Apply AND/OR field filters to a bounded scan of remote items. Reports scan truncation; does not claim whole-library results when bounded.', { ...scope, ...bounded, match: z.enum(['all', 'any']).default('all'), filters: z.array(z.object({ field: z.enum(['title', 'creator', 'date', 'DOI', 'ISBN', 'abstractNote', 'extra', 'tag', 'itemType']), operator: z.enum(['contains', 'equals', 'startsWith', 'notContains']), value: nonempty })).min(1).max(20) }, async (a, c) => {
  const r = await scan(c, `${prefix(a, c)}/items/top`, {}, a.maxItems);
  return { ...r, entries: r.entries.filter(e => {
    const tests = a.filters.map((f: any) => {
      const raw = f.field === 'creator' ? (e.data.creators ?? []).map((x: any) => x.name ?? `${x.firstName ?? ''} ${x.lastName ?? ''}`).join('; ') : f.field === 'tag' ? (e.data.tags ?? []).map((t: any) => t.tag).join('; ') : e.data[f.field];
      const value = String(raw ?? '').toLowerCase(), needle = f.value.toLowerCase();
      return f.operator === 'equals' ? value === needle : f.operator === 'startsWith' ? value.startsWith(needle) : f.operator === 'notContains' ? !value.includes(needle) : value.includes(needle);
    }); return a.match === 'all' ? tests.every(Boolean) : tests.some(Boolean);
  }) };
});
add('find_duplicates', 'Identify candidate duplicates by normalized DOI or title. Does not merge; title matches require human review.', { ...scope, ...bounded, by: z.enum(['DOI', 'title']).default('DOI') }, async (a, c) => {
  const r = await scan(c, `${prefix(a, c)}/items/top`, {}, a.maxItems), groups = new Map<string, any[]>();
  for (const e of r.entries) {
    const value = String(e.data[a.by] ?? '').normalize('NFKC').toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '').replace(/[\s]+/g, ' ').trim();
    if (value) groups.set(value, [...(groups.get(value) ?? []), e]);
  }
  return { scanned: r.scanned, truncated: r.truncated, groups: [...groups].filter(([, v]) => v.length > 1).map(([value, entries]) => ({ value, entries })) };
});
add('get_library_stats', 'Compute item-type, year and tag counts for a bounded remote sample; includes total and coverage.', { ...scope, ...bounded }, async (a, c) => {
  const r = await scan(c, `${prefix(a, c)}/items/top`, {}, a.maxItems); const types: Record<string, number> = {}, years: Record<string, number> = {}, tags: Record<string, number> = {};
  for (const e of r.entries) { types[e.data.itemType] = (types[e.data.itemType] ?? 0) + 1; const year = /\d{4}/.exec(e.data.date ?? '')?.[0] ?? 'unknown'; years[year] = (years[year] ?? 0) + 1; for (const t of e.data.tags ?? []) tags[t.tag] = (tags[t.tag] ?? 0) + 1; }
  return { scanned: r.scanned, total: r.total, truncated: r.truncated, types, years, tags };
});
add('merge_duplicates', 'Consolidate two explicitly chosen same-type bibliographic items. Keep primary metadata, fill empty fields, union tags/collections/relations, move children, then trash the secondary. This is not the desktop native merge: incoming links from other items are not rewritten. Partial failures stop before trash.', { ...scope, primaryKey: key, secondaryKey: key, primaryVersion: version, secondaryVersion: version }, async (a, c) => {
  if (a.primaryKey === a.secondaryKey) throw new AppError('SAME_ITEM', 'Choose two different items');
  const primary = await current({ ...a, itemKey: a.primaryKey, version: a.primaryVersion }, c), secondary = await current({ ...a, itemKey: a.secondaryKey, version: a.secondaryVersion }, c);
  if (primary.data.itemType !== secondary.data.itemType || ['note', 'attachment', 'annotation'].includes(primary.data.itemType) || primary.data.deleted || secondary.data.deleted) throw new AppError('MERGE_TYPES', 'Choose two untrashed bibliographic items of the same type');
  const children = await scan(c, `${prefix(a, c)}/items/${a.secondaryKey}/children`, {}, 49);
  if (children.truncated) throw new AppError('MERGE_TOO_LARGE', 'At most 49 secondary children can be moved per merge; no changes were made');
  const patch: any = {};
  for (const [field, value] of Object.entries(secondary.data)) if (!['key', 'version', 'itemType', 'dateAdded', 'dateModified', 'deleted', 'parentItem', 'tags', 'collections', 'relations'].includes(field) && (primary.data[field] === '' || primary.data[field] === undefined || (Array.isArray(primary.data[field]) && primary.data[field].length === 0))) patch[field] = value;
  patch.tags = [...new Map([...(secondary.data.tags ?? []), ...(primary.data.tags ?? [])].map((t: any) => [t.tag, t])).values()];
  patch.collections = [...new Set([...(primary.data.collections ?? []), ...(secondary.data.collections ?? [])])];
  patch.relations = { ...primary.data.relations };
  for (const [name, value] of Object.entries(secondary.data.relations ?? {})) patch.relations[name] = [...new Set([...(patch.relations[name] ? [patch.relations[name]].flat() : []), ...[value].flat()])];
  const body = [{ key: a.primaryKey, version: primary.version, ...patch }, ...children.entries.map(e => ({ key: e.key, version: e.version, parentItem: a.primaryKey }))];
  return plan(c, 'merge_duplicates', [
    { method: 'POST', path: `${prefix(a, c)}/items`, body },
    { method: 'PATCH', path: `${prefix(a, c)}/items/${a.secondaryKey}`, version: secondary.version, body: { deleted: 1 } },
  ], { primary: primary.data, secondary: secondary.data, primaryChanges: patch, moveChildren: children.entries.map(e => e.key), trashAfterSuccessfulMoves: a.secondaryKey, warning: 'Not transactional. Review and repair partial outcomes. Inbound relations and existing citations to the secondary key are not rewritten; secondary remains recoverable in trash.' });
}, true);
add('search_by_citation_key', 'Look up an explicitly stored Citation Key in Extra. Better BibTeX local generated keys are not remotely available.', { ...scope, ...bounded, citationKey: nonempty }, async (a, c) => {
  const r = await scan(c, `${prefix(a, c)}/items/top`, {}, a.maxItems);
  return { ...r, entries: r.entries.filter(e => String(e.data.extra ?? '').split('\n').some(line => /^citation key:/i.test(line) && line.split(':').slice(1).join(':').trim() === a.citationKey)) };
});

export { scan, scope, bounded, key, page, add, current, createItems, creator };
