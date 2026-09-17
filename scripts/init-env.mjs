import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
const template = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
await writeFile(new URL('../.env', import.meta.url), template.replace('ENCRYPTION_KEY=REPLACE_WITH_64_HEX_CHARACTERS', 'ENCRYPTION_KEY=' + randomBytes(32).toString('hex')), { flag: 'wx', mode: 0o600 });
console.log('Created .env with a new encryption key. Existing files are never overwritten.');
