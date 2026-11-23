// D-272 · Dua perbaikan:
//   (1) Hasil generate FOTO harus masuk GALERI ASET Studio, bukan Rantai Adegan.
//       ("ini kan foto, kenapa pake rantai adegan? harusnya masuk galeri aset di studio")
//   (2) Jarak panel Admin (Provider Kustom, Bank Suara, Bank Prompt) diperbesar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const studio = readFileSync('public/studio.js', 'utf8');
const html = readFileSync('public/index.html', 'utf8');

test('D-272: generate foto TIDAK lagi mendorong frame ke Rantai Adegan', () => {
  // Blok generate() tidak boleh contain chain.push lagi.
  const genStart = studio.indexOf('async function generate() {');
  const genEnd = studio.indexOf('async function generateVideo() {');
  assert.ok(genStart > 0 && genEnd > genStart, 'fungsi generate() & generateVideo() harus ada');
  const genBody = studio.slice(genStart, genEnd);
  assert.ok(!genBody.includes('chain.push('),
    'generate() tidak boleh push frame ke rantai adegan');
  assert.ok(!genBody.includes('saveChain()'),
    'generate() tidak boleh menyimpan rantai');
  assert.ok(!genBody.includes('renderChain()'),
    'generate() tidak boleh render rantai');
  // Hasil generate tetap disimpan sebagai aset (galeri).
  assert.ok(genBody.includes('persistGenerated('),
    'hasil generate harus tetap disimpan sebagai aset');
});

test('D-272: hasil generate masuk galeri aset & toast menyebut galeri', () => {
  assert.ok(studio.includes('Gambar jadi ✨ — tersimpan di galeri aset.'),
    'toast harus menjelaskan hasil masuk galeri aset');
  // Aset hasil generate tetap punya kind "generate" (tampil di galeri).
  assert.ok(studio.includes("kind: 'generate'"),
    'aset hasil generate harus kind=generate');
});

test('D-272: Rantai Adegan tetap bisa dipakai EKSPLISIT dari aset', () => {
  // Tombol "Masukkan Rantai" di lightbox aset.
  assert.ok(studio.includes('data-lb-chain="1"'),
    'lightbox aset harus punya tombol masukkan rantai');
  assert.ok(studio.includes('addAssetToChain'),
    'harus ada fungsi addAssetToChain');
  const fnStart = studio.indexOf('async function addAssetToChain');
  assert.ok(fnStart > 0, 'fungsi addAssetToChain harus ada');
  const fnBody = studio.slice(fnStart, fnStart + 1400);
  assert.ok(fnBody.includes('chain.push(frame)'),
    'addAssetToChain harus push frame ke rantai');
  assert.ok(fnBody.includes('renderChain()'),
    'addAssetToChain harus render rantai');
});

test('D-272: rantai lokal pakai versi — rantai lama (foto otomatis) dibersihkan', () => {
  assert.ok(studio.includes('const CHAIN_VERSION = 2'),
    'harus ada versi format rantai');
  const loadStart = studio.indexOf('function loadChain()');
  assert.ok(loadStart > 0, 'loadChain harus ada');
  const loadBody = studio.slice(loadStart, loadStart + 900);
  assert.ok(loadBody.includes('parsed.v !== CHAIN_VERSION'),
    'loadChain harus membuang rantai versi lama');
  assert.ok(loadBody.includes('localStorage.removeItem(CHAIN_KEY)'),
    'loadChain harus menghapus rantai versi lama dari localStorage');
  // Format baru dipakai saat menyimpan.
  const saveStart = studio.indexOf('function saveChain()');
  const saveBody = studio.slice(saveStart, saveStart + 700);
  assert.ok(saveBody.includes('v: CHAIN_VERSION'),
    'saveChain harus menyimpan format berversi');
});

test('D-272: jarak panel Admin diperbesar (22px antar blok)', () => {
  assert.ok(html.includes('#bankSuaraPanel > * + *{margin-top:22px}'),
    'jarak antar blok panel bank suara harus 22px');
  assert.ok(html.includes('#customProvidersPanel > * + *,'),
    'jarak antar blok panel provider kustom harus ikut diperbesar');
  assert.ok(html.includes('#customProvidersPanel > .form-grid{margin-top:24px}'),
    'jarak form provider kustom harus 24px');
  assert.ok(html.includes('#pbFormPanel .form-grid .form-field.full{'),
    'baris tombol Bank Prompt harus dipisah');
  assert.ok(html.includes('#vaultGroupsPanel .vault-table-wrap + p{margin-top:18px}'),
    'catatan grup API key harus diberi jarak');
  // Tidak boleh ada jarak kecil yang tersisa di panel-panel ini.
  assert.ok(!html.includes('#bankSuaraPanel > * + *{margin-top:14px}'),
    'aturan jarak lama (14px) harus diganti');
});
