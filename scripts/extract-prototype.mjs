#!/usr/bin/env node
/**
 * One-shot extractor: split prototype index.html into Vite-friendly assets.
 * Run from repo root: node scripts/extract-prototype.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const htmlPath = path.join(root, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// --- CSS ---
const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
if (!styleMatch) throw new Error('No <style> block found');
fs.mkdirSync(path.join(root, 'src/styles'), { recursive: true });
fs.writeFileSync(path.join(root, 'src/styles/main.css'), styleMatch[1].trim() + '\n');
console.log('Wrote src/styles/main.css');

// --- Genre JPEGs ---
const genresDir = path.join(root, 'public/assets/genres');
fs.mkdirSync(genresDir, { recursive: true });

const genreConsts = [
  'JAZZ_IMG',
  'CLASSICAL_IMG',
  'LOFI_IMG',
  'ELECTRONIC_IMG',
  'LATIN_IMG',
  'SOUL_IMG',
  'REGGAE_IMG',
  'POP_IMG',
  'ROCK_IMG',
  'TECHNO_IMG',
  'CHRISTIAN_IMG',
];

const genreFileMap = {};
for (const name of genreConsts) {
  const re = new RegExp(`const ${name}='data:image/jpeg;base64,([^']+)'`);
  const m = html.match(re);
  if (!m) {
    console.warn('Missing', name);
    continue;
  }
  const file = name.replace('_IMG', '').toLowerCase() + '.jpg';
  fs.writeFileSync(path.join(genresDir, file), Buffer.from(m[1], 'base64'));
  genreFileMap[name] = `/assets/genres/${file}`;
  console.log('Wrote', file, `(${Math.round(m[1].length / 1024)}KB b64)`);
}

// --- Brand SVG (optional extract) ---
const brandDir = path.join(root, 'public/assets');
const svgMatch = html.match(/src="data:image\/svg\+xml;base64,([^"]+)"/);
if (svgMatch) {
  fs.writeFileSync(path.join(brandDir, 'logo.svg'), Buffer.from(svgMatch[1], 'base64'));
  console.log('Wrote public/assets/logo.svg');
}

// --- Script body ---
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>\s*<script>if\('serviceWorker'/);
let scriptBody;
if (scriptMatch) {
  scriptBody = scriptMatch[1];
} else {
  const all = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  scriptBody = all.find((m) => m[1].includes('const store'))?.[1];
}
if (!scriptBody) throw new Error('Main script not found');

// Replace genre consts with URL imports
let js = scriptBody;
for (const [name, url] of Object.entries(genreFileMap)) {
  js = js.replace(new RegExp(`const ${name}='data:image/jpeg;base64,[^']+'`), `const ${name}='${url}'`);
}

// Replace brand logo data URIs in remaining HTML later; for JS leave as-is if any

fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
fs.writeFileSync(path.join(root, 'scripts/_extracted-app.js'), js);
console.log('Wrote scripts/_extracted-app.js', js.length, 'chars');

// Save genre map for main.js generation
fs.writeFileSync(
  path.join(root, 'scripts/_genre-map.json'),
  JSON.stringify(genreFileMap, null, 2),
);
console.log('Done.');
