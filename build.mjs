// Builds index.html: encrypts src/content.html with the access code (AES-GCM,
// key derived via PBKDF2-SHA256) so the portfolio is unreadable without it.
//
// Usage:  WEBADI_CODE=yourcode node build.mjs          encrypt src/content.html -> index.html
//         WEBADI_CODE=yourcode node build.mjs unpack   decrypt index.html -> src/content.html
//
// src/content.html is git-ignored so the plain-text content never lands in the
// public repo. Run "unpack" on a fresh clone to get an editable copy back.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { webcrypto as crypto } from 'node:crypto';

const args = process.argv.slice(2);
const unpack = args[0] === 'unpack';
const code = process.env.WEBADI_CODE || args.find((a) => a !== 'unpack');
if (!code) {
  console.error('Missing access code. Run: WEBADI_CODE=yourcode node build.mjs');
  process.exit(1);
}

const ITERATIONS = 250000;
const enc = new TextEncoder();
const b64 = (buf) => Buffer.from(buf).toString('base64');

async function deriveKey(salt, iterations, usage) {
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage],
  );
}

if (unpack) {
  const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
  const m = html.match(/<script id="payload" type="application\/json">([\s\S]*?)<\/script>/);
  const p = JSON.parse(m[1]);
  const key = await deriveKey(Buffer.from(p.salt, 'base64'), p.it, 'decrypt');
  let plain;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(p.iv, 'base64') }, key, Buffer.from(p.ct, 'base64'));
  } catch {
    console.error('Wrong access code.');
    process.exit(1);
  }
  await mkdir(new URL('./src/', import.meta.url), { recursive: true });
  await writeFile(new URL('./src/content.html', import.meta.url), Buffer.from(plain));
  console.log('Wrote src/content.html');
  process.exit(0);
}

const [content, shell] = await Promise.all([
  readFile(new URL('./src/content.html', import.meta.url), 'utf8'),
  readFile(new URL('./src/shell.html', import.meta.url), 'utf8'),
]);

const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const key = await deriveKey(salt, ITERATIONS, 'encrypt');
const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(content));

const payload = JSON.stringify({ v: 1, it: ITERATIONS, salt: b64(salt), iv: b64(iv), ct: b64(ct) });
await writeFile(new URL('./index.html', import.meta.url), shell.replace('__PAYLOAD__', payload));
console.log(`Built index.html (${(payload.length / 1024).toFixed(1)} KB encrypted payload).`);
