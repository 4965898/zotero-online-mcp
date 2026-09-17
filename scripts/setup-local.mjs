#!/usr/bin/env node
// One-time local setup: creates .env from the local template when one does not exist yet.
// Cross-platform so `npm run setup:local` works the same on Windows, macOS and Linux.
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const target = join(root, '.env');
const template = join(root, '.env.local.example');

if (!existsSync(template)) {
  console.error(`Missing template: ${template}`);
  process.exit(1);
}
if (existsSync(target)) {
  console.log('.env already exists - left untouched');
} else {
  copyFileSync(template, target);
  console.log('Created .env from .env.local.example');
}
console.log('');
console.log('Next: open .env and paste your ZOTERO_API_KEY.');
console.log('  Create one at https://www.zotero.org/settings/keys/new');
console.log('Then run: npm ci && npm run build');
