// Finishes a build by cutting its last tie to the network.
//
// vite-plugin-singlefile already inlines the JS and CSS, but the Google Fonts
// <link> tags still point at fonts.googleapis.com. A copy someone downloads and
// double-clicks should not need the internet, so swap those links for the
// pre-downloaded @font-face rules in fonts.inline.css (latin subset, woff2
// embedded as data: URIs).
//
// Two callers, set by the arguments:
//
//   node scripts/postbuild.mjs
//     the desktop build. dist/index.html is left exactly where it is — the
//     desktop shortcut opens it and deleting it would break that — and
//     dist/MIS.html is written alongside as the one file to send someone.
//
//   node scripts/postbuild.mjs dist-netlify --replace
//     the hosted build. There is no shortcut pointing into that folder, so the
//     processed page replaces index.html: a web host needs the entry point to
//     be called index.html to serve it at the site root.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const args = process.argv.slice(2);
const outDir = args.find((a) => !a.startsWith('--')) ?? 'dist';
const replace = args.includes('--replace');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const built = join(root, outDir, 'index.html');
const targetName = replace ? 'index.html' : 'MIS.html';
const target = join(root, outDir, targetName);

const html = readFileSync(built, 'utf8');
const fonts = readFileSync(join(root, 'fonts.inline.css'), 'utf8');

const shared = html
  .replace(/<link rel="preconnect" href="https:\/\/fonts\.[^>]*>\s*/g, '')
  .replace(
    /<link\s+href="https:\/\/fonts\.googleapis\.com\/css2[^>]*>/,
    `<style>\n${fonts}\n</style>`
  );

if (shared === html) {
  throw new Error(
    'postbuild: the Google Fonts tags were not found — did index.html change?'
  );
}

// only inspect the <head>: the SheetJS bundle contains https:// URLs inside
// string literals, which are not network requests and must not trip this
const head = shared.slice(0, shared.indexOf('</head>'));
if (/(?:src|href)="https?:\/\//.test(head)) {
  throw new Error(`postbuild: ${targetName} still loads something from the network`);
}

writeFileSync(target, shared);

const kb = (Buffer.byteLength(shared) / 1024).toFixed(0);
console.log(`postbuild: wrote ${outDir}/${targetName} (${kb} kB, self-contained)`);
