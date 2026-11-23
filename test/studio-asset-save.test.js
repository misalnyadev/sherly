// D-273 · Dua masalah yang dilaporkan user:
//   1. "malah gak keliatan sama sekali hasilnya entah dimana? foto hasilnya gak tau
//       dimana mau dicari" — hasil generate TIDAK tersimpan ke galeri (hilang total).
//   2. "antar form Grup API Key Tersimpan, Provider Kustom — Generator Studio dan
//       Bank Suara Sherly gak bisa dipisah ya? nempel terus dari tadi" — panel-panel
//       Admin menempel karena aturan jarak hanya berlaku untuk anak langsung .page-view.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const studio = readFileSync('public/studio.js', 'utf8');
const html = readFileSync('public/index.html', 'utf8');
const app = readFileSync('server/app.js', 'utf8');
const providers = readFileSync('public/ai-providers.js', 'utf8');

test('D-273: hasil generate SELALU disimpan ke galeri & kegagalannya terlihat', () => {
  // Dulu: `if (r.ok) {...}` diam-diam mengabaikan response gagal -> gambar hilang
  // tanpa pesan apa pun. Sekarang kegagalan wajib memberi tahu user.
  const fnStart = studio.indexOf('async function persistGenerated');
  assert.ok(fnStart > 0, 'fungsi persistGenerated harus ada');
  const fn = studio.slice(fnStart, fnStart + 2600);
  assert.ok(!fn.includes('if (r.ok) { const d = await r.json(); if (d?.asset)'),
    'tidak boleh ada penulisan if (r.ok) yang menelan error');
  assert.ok(fn.includes('window.toast?.('),
    'kegagalan simpan harus memberi toast ke user');
  assert.ok(fn.includes('gagal disimpan'),
    'pesan harus menyebutkan gagal disimpan');
  // Pesan sukses hanya kalau benar-benar tersimpan.
  assert.ok(studio.includes('if (saved) window.toast?.('),
    'toast sukses hanya tampil kalau aset benar-benar tersimpan');
});

test('D-273: file besar pakai signed-upload (bypass limit body server)', () => {
  const fnStart = studio.indexOf('async function persistGenerated');
  const fn = studio.slice(fnStart, fnStart + 2600);
  // Base64 Kie 2K/4K bisa > 5 MB (limit express.json lama) -> lewat Storage.
  assert.ok(fn.includes('uploadBlobDirect('),
    'file besar harus pakai jalur signed-upload langsung ke Supabase Storage');
  assert.ok(/blob\.size > 3 \* 1024 \* 1024/.test(fn),
    'ambang signed-upload harus 3 MB');
  // Kalau JSON ditolak, tetap ada fallback signed-upload.
  assert.ok(fn.includes('uploadBlobDirect(blob, fileName, safeMime, extra)'),
    'harus ada fallback signed-upload saat JSON ditolak');
});

test('D-273: aset hasil generate ikut menyimpan dimensi (rasio galeri)', () => {
  const fnStart = studio.indexOf('async function persistGenerated');
  const fn = studio.slice(fnStart, fnStart + 2600);
  assert.ok(fn.includes('readBlobDimensions'),
    'dimensi gambar harus dibaca supaya galeri bedain vertikal/horizontal');
  assert.ok(fn.includes('width: dim?.width, height: dim?.height'),
    'dimensi harus dikirim ke server');
  assert.ok(studio.includes('function readBlobDimensions'),
    'fungsi readBlobDimensions harus ada');
});

test('D-273: limit body JSON server dinaikkan (12 MB)', () => {
  assert.ok(app.includes("express.json({ limit: '12mb' })"),
    'limit express.json harus 12 MB');
  assert.ok(!app.includes("express.json({ limit: '5mb' })"),
    'limit lama 5 MB harus diganti');
});

test('D-273: panel Admin dipisah — jarak antar panel di settingsProvidersPane', () => {
  // Aturan lama `.page-view > .panel + .panel` TIDAK kena: panel-panel ini
  // saudara di dalam #settingsProvidersPane, bukan anak langsung .page-view.
  assert.ok(html.includes('#settingsProvidersPane > * + *{margin-top:20px}'),
    'harus ada jarak antar anak settingsProvidersPane');
  assert.ok(html.includes('#settingsProvidersPane > .panel{'),
    'panel di dalam pane harus punya styling sendiri');
});

test('D-273: status memuat & kosong dibungkus kotak (bukan tulisan yatim)', () => {
  assert.ok(html.includes('.vault-loading{'),
    'harus ada gaya status memuat');
  assert.ok(html.includes('.vault-empty{'),
    'harus ada gaya status kosong');
  assert.ok(html.includes('class="vault-loading"'),
    'markup status memuat harus pakai kelas baru');
  assert.ok(!html.includes('<p style="color:var(--muted)">Memuat status provider...</p>'),
    'tulisan yatim "Memuat status provider" harus diganti');
  assert.ok(providers.includes('vault-empty'),
    'daftar provider kustom kosong harus pakai kelas vault-empty');
});
