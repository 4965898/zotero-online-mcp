import test from 'node:test';
import assert from 'node:assert/strict';
import { tools, type ToolContext } from '../src/tools.js';
import '../src/extensions.js';
import { Store } from '../src/store.js';
import { Plans } from '../src/plans.js';
import { Zotero } from '../src/zotero.js';
import { config, json } from './helpers.js';

function minimalPdf() {
  const stream = 'BT /F1 12 Tf 72 720 Td (Hello online Zotero) Tj ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let text = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((o, i) => { offsets.push(Buffer.byteLength(text)); text += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(text); text += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(text);
}
test('real PDF parser extracts page text and empty outline from a remote in-memory fixture', async () => {
  const cfg = config(), store = new Store(':memory:', cfg.encryptionKey); const user = store.connect('111', 'pdf-test'), principal = store.authenticate(store.issue(user));
  const api = new Zotero('pdf-test', async url => new URL(String(url)).pathname.endsWith('/file') ? new Response(new Uint8Array(minimalPdf()), { headers: { 'Content-Type': 'application/pdf' } }) : json({ key: 'FILE1234', version: 1, data: { itemType: 'attachment', contentType: 'application/pdf' } }));
  const c: ToolContext = { config: cfg, store, principal, api, plans: new Plans(store.planStore(), true) } as ToolContext;
  try {
    const read = tools.find(t => t.name === 'read_pdf_pages')!; const output: any = await read.run(read.schema.parse({ itemKey: 'FILE1234', startPage: 1, endPage: 1 }), c);
    assert.equal(output.totalPages, 1); assert.match(output.pages[0].text, /Hello online Zotero/); assert.equal(output.ocrPerformed, false);
    const outline = tools.find(t => t.name === 'get_pdf_outline')!; const out: any = await outline.run(outline.schema.parse({ itemKey: 'FILE1234' }), c); assert.deepEqual(out.outline, []);
  } finally { store.close(); }
});
