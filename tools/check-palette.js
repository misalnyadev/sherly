// D-111: penjaga palet warna SherlyStudio.
// Tema resmi: gelap (biru-hitam/plum) + pink + putih — konsisten di semua halaman.
// Pemakaian: node tools/check-palette.js  (bagian dari `npm run check`).
// Palet berasal dari halaman Beranda (:root) — tambahkan token BARU di sini dan di :root index.html.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Token solid + varian alpha (hex 8-digit) yang diizinkan.
const HEX_ALLOW = new Set([
  // permukaan gelap
  '#070b14', '#0c1422', '#101b2c', '#111a2e', '#0f1828', '#0a1220',
  '#0c1422f2', '#0c1422f7', '#0c1422cc', '#101b2ccc',
  '#0c142299', '#0c1422b3', // D-230: badge user semi transparan (foto avatar tetap terlihat)
  // plum / tinta pink
  '#160f20', '#24142a', '#24142aa6', '#311738', '#5b1f4e', '#170f20' /* meta theme-color */,
  // garis
  '#1c2b40', '#24344e', '#49334e', '#74436c',
  // pink
  '#f044a8', '#ff72c5', '#ff9bdc', '#ffd0ec', '#d82d91', '#b02d80', '#9b1c67',
  '#f044a810', '#f044a814', '#f044a81f', '#f044a820', '#f044a825', '#f044a826', '#f044a82a',
  '#f044a833', '#f044a840', '#f044a844', '#f044a845', '#f044a866', '#f044a877', '#f044a880',
  '#ff72c533', '#ff72c536', '#ff72c552', '#ff72c580', '#ff72c599', '#ff72c5b3',
  '#d82d9126', '#d82d91aa', '#d82d91cc', '#b02d8026',
  // teks
  '#f4f5fb', '#cfd6e4', '#a9b8cd', '#91a2b9', '#5d6f88', '#fff', '#ffffff', '#ffffff38',
  // hitam / near-black (overlay & bayangan)
  '#000', '#0008', '#0009', '#000a', '#000b', '#000c', '#00000080', '#00000090',
  '#04070f60', '#04070faa', '#04070fd9', '#04070fdc', '#04070fcc', '#04070fe0',
]);

// Basis rgba() yang diizinkan (alpha bebas dalam rumpun yang sama).
const RGBA_BASE_ALLOW = new Set([
  '0,0,0', '4,7,15', '255,255,255', '240,68,168', '255,114,197', '216,45,145', '116,67,108', '169,184,205',
]);

const files = [path.join(root, 'public/index.html'), ...readdirSync(path.join(root, 'public')).filter((f) => f.endsWith('.js')).map((f) => path.join(root, 'public', f))];
const errors = [];
const re = /(?<!&)#[0-9a-fA-F]{3}\b|(?<!&)#[0-9a-fA-F]{6}\b|(?<!&)#[0-9a-fA-F]{8}\b|rgba?\([0-9., ]+\)/g;

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  let m;
  while ((m = re.exec(src))) {
    const tok = m[0].toLowerCase();
    if (tok.startsWith('#')) {
      if (!HEX_ALLOW.has(tok)) errors.push(`${path.basename(file)}: warna di luar palet → ${tok}`);
    } else {
      const base = tok.replace(/^rgba?\(/, '').replace(/,\s*[0-9.]+\s*\)$/, '').replace(/\s/g, '');
      if (!RGBA_BASE_ALLOW.has(base)) errors.push(`${path.basename(file)}: rgba di luar palet → ${tok}`);
    }
  }
}

if (errors.length) {
  console.error('✗ PALET MELEBIHI TEMA (gelap + pink + putih):');
  for (const e of [...new Set(errors)].slice(0, 20)) console.error('  - ' + e);
  process.exit(1);
}
console.log('✓ palet warna konsisten: hanya gelap + pink + putih (semua halaman & fitur)');
