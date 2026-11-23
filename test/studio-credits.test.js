// D-274 · Badge kredit di komposer Studio.
//
// Permintaan user:
//   "kok banyak kali ya abis creditnya?" -> user tidak tahu berapa kredit yang
//   terpakai per generate, jadi terasa cepat habis.
//   "tampilkan informasi kredit yang akan digunakan secara komposer di samping
//    jenis konten, cukup angka saja, contoh [foto] [12]".
//
// Yang dijaga test ini:
//   1. Katalog kredit server berisi angka resmi Kie (per model & resolusi).
//   2. Estimasi frontend mengikuti model + resolusi + durasi/tier yang aktif.
//   3. Badge tampil sebagai ANGKA SAJA di samping jenis konten (tanpa USD).
//   4. Endpoint saldo kredit Kie ada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  IMAGE_CREDITS,
  VIDEO_CREDITS,
  LIPSYNC_CREDITS,
  estimateImageCredits,
  estimateVideoCredits,
  estimateLipsyncCredits,
} from '../server/kie-credits.js';
import { imageCatalog } from '../server/image-models.js';
import { videoCatalog } from '../server/video-models.js';
import { lipsyncCatalog } from '../server/lipsync-models.js';

const studio = readFileSync('public/studio.js', 'utf8');
const html = readFileSync('public/index.html', 'utf8');
const app = readFileSync('server/app.js', 'utf8');

test('D-274: tarif kredit Kie per model foto (angka resmi, per resolusi)', () => {
  // Angka dari https://kie.ai/pricing + halaman model (1 kredit ~ $0.005).
  assert.equal(estimateImageCredits('nano-banana-2', '1K'), 8);
  assert.equal(estimateImageCredits('nano-banana-2', '2K'), 12);
  assert.equal(estimateImageCredits('nano-banana-2', '4K'), 18);
  assert.equal(estimateImageCredits('gpt-image-2-text-to-image', '1K'), 6);
  assert.equal(estimateImageCredits('gpt-image-2-text-to-image', '2K'), 10);
  assert.equal(estimateImageCredits('gpt-image-2-text-to-image', '4K'), 16);
  // Model yang dipakai user berhasil: Banana 2 & GPT Image 2.6.
  assert.ok(estimateImageCredits('gpt-image-2-6/flare-text-to-image', '2K') > 0,
    'GPT Image 2.6 harus punya estimasi kredit');
  // Model tak dikenal -> 0 (tidak asal menebak).
  assert.equal(estimateImageCredits('model-hantu', '2K'), 0);
});

test('D-274: tarif kredit video mengikuti tier + resolusi + durasi', () => {
  // Omni Flash 1.2 (model yang dipakai user): 360p 4/dtk, 720p 9/dtk, 1080p 10/dtk.
  assert.equal(estimateVideoCredits('google/gemini-omni-flash-1-2', 'standard', 8, '720p'), 72);
  assert.equal(estimateVideoCredits('google/gemini-omni-flash-1-2', 'standard', 8, '1080p'), 80);
  // Seedance 2.0: fast 480p 6.8/dtk, standard 480p 11.7/dtk.
  assert.equal(estimateVideoCredits('bytedance/seedance-2', 'fast', 10, '480p'), 68);
  assert.equal(estimateVideoCredits('bytedance/seedance-2', 'standard', 10, '480p'), 117);
  // Veo 3.1 dihitung PER VIDEO (durasi tak berpengaruh).
  assert.equal(estimateVideoCredits('veo-3-1', 'veo3_lite', 8, '720p'), 30);
  assert.equal(estimateVideoCredits('veo-3-1', 'veo3_lite', 4, '720p'), 30);
  assert.equal(estimateVideoCredits('veo-3-1', 'veo3_fast', 8, '1080p'), 65);
  // Durasi minimal 1 detik (tidak boleh 0).
  assert.ok(estimateVideoCredits('google/gemini-omni-flash-1-2', 'standard', 0, '720p') > 0);
  assert.equal(estimateVideoCredits('model-hantu', 'standard', 8, '720p'), 0);
});

test('D-274: tarif kredit lipsync per detik', () => {
  assert.equal(estimateLipsyncCredits('infinitalk/from-audio', 10, '480p'), 30);
  assert.equal(estimateLipsyncCredits('infinitalk/from-audio', 10, '720p'), 120);
  assert.equal(estimateLipsyncCredits('omnihuman-2-0', 10, '720p'), 140);
  assert.equal(estimateLipsyncCredits('model-hantu', 10, '720p'), 0);
});

test('D-274: katalog model bawa tarif kredit ke frontend', () => {
  for (const m of imageCatalog().models) {
    assert.ok(m.credits && typeof m.credits === 'object',
      'model foto ' + m.id + ' harus punya tarif kredit');
    assert.ok(Object.keys(m.credits).length > 0,
      'model foto ' + m.id + ' harus punya minimal satu resolusi berharga');
  }
  for (const m of videoCatalog().models) {
    assert.ok(m.credits && typeof m.credits === 'object',
      'model video ' + m.id + ' harus punya tarif kredit');
  }
  for (const m of lipsyncCatalog().models) {
    assert.ok(m.credits && typeof m.credits === 'object',
      'model lipsync ' + m.id + ' harus punya tarif kredit');
  }
  // Tiap model di katalog WAJIB punya entri tarif (bukan model yang tak dihargai).
  for (const m of imageCatalog().models) {
    assert.ok(IMAGE_CREDITS[m.id], 'model foto ' + m.id + ' butuh entri IMAGE_CREDITS');
  }
  for (const m of videoCatalog().models) {
    assert.ok(VIDEO_CREDITS[m.id], 'model video ' + m.id + ' butuh entri VIDEO_CREDITS');
  }
  for (const m of lipsyncCatalog().models) {
    assert.ok(LIPSYNC_CREDITS[m.id], 'model lipsync ' + m.id + ' butuh entri LIPSYNC_CREDITS');
  }
});

test('D-274: badge kredit tampil di samping jenis konten, angka saja', () => {
  // Markup badge ada di baris kontrol komposer (dekat tombol jenis konten).
  assert.ok(studio.includes('id="stCreditBadge"'),
    'badge kredit harus ada di markup komposer');
  const typeIdx = studio.indexOf('id="stTypePill"');
  const badgeIdx = studio.indexOf('id="stCreditBadge"');
  assert.ok(typeIdx > 0 && badgeIdx > typeIdx && badgeIdx - typeIdx < 400,
    'badge kredit harus dekat (bersebelahan) dengan jenis konten');
  // CSS badge: hanya ANGKA (kurung lewat ::before/::after), tanpa USD/teks panjang.
  assert.ok(/\.st-credit-badge::before\{content:'\[';\}/.test(html),
    'kurung buka harus dari CSS, bukan teks panjang');
  assert.ok(/\.st-credit-badge::after\{content:'\]';\}/.test(html),
    'kurung tutup harus dari CSS, bukan teks panjang');
  assert.ok(!/st-credit-badge[^}]*\$/.test(html),
    'badge kredit tidak boleh menampilkan harga USD');
  // Isi badge = angka saja.
  const fnIdx = studio.indexOf('function updateCreditBadge');
  const fn = studio.slice(fnIdx, fnIdx + 1200);
  assert.ok(/badge\.textContent = String\(credits\)/.test(fn),
    'isi badge harus angka saja');
  assert.ok(!/badge\.textContent = .*\$/.test(fn),
    'badge tidak boleh menampilkan USD');
});

test('D-274: estimasi frontend mengikuti model + opsi generate aktif', () => {
  assert.ok(studio.includes('function imageCreditEstimate'), 'perlu fungsi estimasi foto');
  assert.ok(studio.includes('function videoCreditEstimate'), 'perlu fungsi estimasi video');
  assert.ok(studio.includes('function lipsyncCreditEstimate'), 'perlu fungsi estimasi lipsync');
  // Badge ikut ke model gambar + resolusi gambar.
  const imgIdx = studio.indexOf('function imageCreditEstimate');
  const img = studio.slice(imgIdx, imgIdx + 900);
  assert.ok(img.includes('c.imageResolution'), 'estimasi foto harus ikut resolusi terpilih');
  assert.ok(img.includes('c.imageModel'), 'estimasi foto harus ikut model terpilih');
  // Badge ikut ke tier + resolusi + durasi video.
  const vidIdx = studio.indexOf('function videoCreditEstimate');
  const vid = studio.slice(vidIdx, vidIdx + 1400);
  assert.ok(vid.includes('c.tier'), 'estimasi video harus ikut tier');
  assert.ok(vid.includes('c.resolution'), 'estimasi video harus ikut resolusi');
  assert.ok(vid.includes('c.duration'), 'estimasi video harus ikut durasi');
  // Badge di-update setiap label pill berubah (model/resolusi/durasi changed).
  const pillIdx = studio.indexOf('function updatePillLabels');
  const pill = studio.slice(pillIdx, pillIdx + 4200);
  assert.ok(pill.includes('updateCreditBadge();'),
    'badge kredit harus di-update saat label pill berubah');
});

test('D-274: endpoint saldo kredit Kie tersedia di server', () => {
  assert.ok(app.includes("/api/ai/credits"),
    'harus ada endpoint /api/ai/credits untuk saldo kredit Kie');
  assert.ok(app.includes('fetchKieCredits'),
    'endpoint harus memanggil fetchKieCredits (saldo live dari Kie)');
});

test('D-274: katalog fallback frontend juga punya tarif kredit', () => {
  // Tanpa tarif di fallback, badge kredit baru muncul setelah katalog server
  // termuat — jadi user sempat melihat composer tanpa angka.
  for (const m of imageCatalog().models) {
    assert.ok(studio.includes(`id: '${m.id}'`), 'fallback frontend harus punya ' + m.id);
    // Ada blok credits di entri fallback model itu.
    const idx = studio.indexOf(`id: '${m.id}'`);
    const block = studio.slice(idx, idx + 900);
    assert.ok(block.includes('credits:'),
      'fallback model ' + m.id + ' harus punya tarif kredit');
  }
  for (const m of videoCatalog().models) {
    const idx = studio.indexOf(`id: '${m.id}'`);
    assert.ok(idx > 0, 'fallback frontend harus punya ' + m.id);
    const block = studio.slice(idx, idx + 1400);
    assert.ok(block.includes('credits:'),
      'fallback model ' + m.id + ' harus punya tarif kredit');
  }
  for (const m of lipsyncCatalog().models) {
    const idx = studio.indexOf(`id: '${m.id}'`);
    assert.ok(idx > 0, 'fallback frontend harus punya ' + m.id);
    const block = studio.slice(idx, idx + 900);
    assert.ok(block.includes('credits:'),
      'fallback model ' + m.id + ' harus punya tarif kredit');
  }
});
