/**
 * D-277 / D-278 — Dropdown suara TTS di Studio (jsdom).
 *
 * Menguji `ttsVoiceOptions()` + `ttsProviderNote()` tanpa browser sungguhan:
 *   1. Voice dikelompokkan per provider: Gemini → Azure Speech → ElevenLabs.
 *   2. ID voice provider non-Gemini dipakai apa adanya.
 *   3. Status engine cadangan menampilkan semua provider yang siap.
 *   4. Peringatan menyebut nama provider + arah ke Pengaturan.
 *
 * D-278: hanya provider free tier (tanpa subscription) yang jadi cadangan.
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync('public/index.html', 'utf8');
const studio = readFileSync('public/studio.js', 'utf8');

const openWindows = [];
afterEach(() => {
  while (openWindows.length) {
    const win = openWindows.pop();
    try { win.close(); } catch { /* sudah tertutup */ }
  }
});

const TTS_VOICES_PAYLOAD = {
  ok: true,
  voices: [
    {provider: 'gemini', id: 'Kore', label: 'Kore · Tegas & hangat', language: 'Bahasa Indonesia'},
    {provider: 'gemini', id: 'Puck', label: 'Puck · Riang & akrab', language: 'Bahasa Indonesia'},
    {provider: 'azure', id: 'id-ID-ArdiNeural', label: 'Ardi · Indonesia', language: 'Bahasa Indonesia'},
    {provider: 'azure', id: 'id-ID-GadisNeural', label: 'Gadis · Indonesia', language: 'Bahasa Indonesia'},
    {provider: 'elevenlabs', id: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel', language: 'Bahasa Indonesia'},
  ],
  providers: {gemini: {}, azure: {}, elevenlabs: {}},
  azure: {configured: true},
  elevenlabs: {configured: false},
};

const MG_TEMPLATES = [{
  id: 'beat-sequence',
  label: 'Rangkaian Beat',
  hint: 'Naskah multi-bloc dengan CTA.',
  icon: 'sparkles',
  defaultDuration: 15,
  durations: [10, 12, 15, 20, 25, 30],
  aspects: ['9:16', '16:9', '1:1'],
  fields: [
    {key: 'beatsText', label: 'Isi Beat', type: 'textarea', required: true},
    {key: 'ctaLabel', label: 'Teks Tombol CTA', type: 'text'},
    {key: 'voiceoverText', label: 'Naskah Voice-over', type: 'textarea'},
    {key: 'voice', label: 'Suara', type: 'select'},
  ],
}];

function makeFetch(payload = TTS_VOICES_PAYLOAD) {
  return async (url, init = {}) => {
    const u = String(url);
    if (u.includes('/api/ai/tts/voices')) {
      return {ok: true, json: async () => payload};
    }
    if (u.includes('/api/studio/motion-graphics/templates')) {
      return {ok: true, json: async () => ({ok: true, available: true, status: 'ready', templates: MG_TEMPLATES})};
    }
    if (u.includes('/api/studio/assets')) return {ok: true, json: async () => ({ok: true, assets: []})};
    if (u.includes('/api/ai/image/models')) return {ok: true, json: async () => ({ok: true, models: []})};
    if (u.includes('/api/ai/video/models')) return {ok: true, json: async () => ({ok: true, models: []})};
    if (u.includes('/api/ai/lipsync/models')) return {ok: true, json: async () => ({ok: true, models: []})};
    if (u.includes('/api/characters')) return {ok: true, json: async () => ({characters: []})};
    if (u.includes('/api/custom-providers')) return {ok: true, json: async () => ({providers: []})};
    if (u.includes('/api/prompt-bank')) return {ok: true, json: async () => ({ok: true, entries: [], blocks: []})};
    return {ok: true, json: async () => ({ok: true})};
  };
}

/** Ekstrak fungsi internal Studio (tidak diekspor) dari source. */
function extractStudioInternals(source) {
  const fnBody = (name) => {
    const re = new RegExp(`function ${name}\\(\\)[\\s\\S]*?\\n  }`, 'm');
    const m = source.match(re);
    return m ? m[0] : null;
  };
  return {fnBody};
}

test('D-278: sumber kode Studio mengelompokkan voice per provider cadangan', () => {
  assert.ok(
    /for \(const provider of \['azure', 'elevenlabs'\]\)/.test(studio),
    'dropdown harus iterasi provider cadangan dalam urutan Azure → ElevenLabs',
  );
  assert.ok(
    /const name = provider === 'azure' \? 'Azure Speech' : 'ElevenLabs'/.test(studio),
    'nama provider ditampilkan sesuai label',
  );
  // Provider yang wajib subscribe tidak boleh muncul di client.
  for (const gone of ['soniox', 'voicemaker', 'ttsmaker']) {
    assert.ok(!studio.includes(gone), `${gone} tidak boleh ada di studio.js`);
  }
});

test('D-278: status engine cadangan menampilkan semua provider yang siap', () => {
  assert.ok(
    /for \(const provider of \['azure', 'elevenlabs'\]\)/.test(studio),
    'status harus mengecek semua provider cadangan',
  );
  assert.ok(
    /const ready = \[\];/.test(studio),
    'status harus mengumpulkan provider yang siap',
  );
  assert.ok(
    /Azure Speech/.test(studio) && /ElevenLabs/.test(studio),
    'nama semua provider cadangan harus dikenal UI',
  );
});

test('D-278: peringatan engine cadangan memberi arah ke Pengaturan', () => {
  assert.ok(
    /Pengaturan → Provider &amp; API Key/.test(studio),
    'peringatan harus mengarahkan ke Pengaturan → Provider & API Key',
  );
  assert.ok(
    /Engine cadangan TTS belum aktif/.test(studio),
    'peringatan harus menyebut engine cadangan belum aktif',
  );
});

test('D-278: payload voice dari server dipakai tanpa memfilter provider', () => {
  // Server yang menentukan voice mana yang dikirim; client tidak boleh
  // membuang provider baru hanya karena status configured belum true.
  assert.ok(
    /if \(Array\.isArray\(d\?\.voices\)\) ttsVoices = d\.voices;/.test(studio),
    'client harus menerima semua voice dari server apa adanya',
  );
  assert.ok(
    /for \(const p of \['azure', 'elevenlabs'\]\)/.test(studio),
    'status per provider harus dibaca dari payload',
  );
});

test('D-278: helper ekstraksi fungsi internal Studio tersedia (sanity)', () => {
  const {fnBody} = extractStudioInternals(studio);
  assert.ok(fnBody('ttsVoiceOptions'), 'fungsi ttsVoiceOptions harus ada');
  assert.ok(fnBody('ttsProviderNote'), 'fungsi ttsProviderNote harus ada');
});

test('D-278: dropdown benar-benar mengelompokkan voice (eksekusi fungsi)', () => {
  const {fnBody} = extractStudioInternals(studio);
  const voices = [
    {provider: 'gemini', id: 'Kore', label: 'Kore · Tegas', language: 'Bahasa Indonesia'},
    {provider: 'azure', id: 'id-ID-ArdiNeural', label: 'Ardi · Indonesia', language: 'Bahasa Indonesia'},
    {provider: 'elevenlabs', id: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel', language: 'Bahasa Indonesia'},
  ];
  const providers = {azure: {configured: true}, elevenlabs: {configured: false}};
  const run = new Function('ttsVoices', 'ttsProviders', `
    ${fnBody('ttsVoiceOptions')}
    return ttsVoiceOptions();
  `);
  const options = run(voices, providers);
  const labels = options.map((o) => o.label);
  // Urutan grup: Gemini → Azure Speech → ElevenLabs.
  const iGemini = labels.findIndex((l) => l.includes('Gemini (bawaan)'));
  const iAzure = labels.findIndex((l) => l.includes('Azure Speech'));
  const iEleven = labels.findIndex((l) => l.includes('ElevenLabs'));
  assert.ok(iGemini >= 0, 'grup Gemini harus ada');
  assert.ok(iAzure > iGemini, 'Azure setelah Gemini');
  assert.ok(iEleven > iAzure, 'ElevenLabs setelah Azure');
  // ID voice provider non-Gemini tetap dipakai apa adanya (tidak diubah).
  assert.ok(options.some((o) => o.value === 'id-ID-ArdiNeural'), 'ID voice Azure harus utuh');
  assert.ok(options.some((o) => o.value === '21m00Tcm4TlvDq8ikWAM'), 'ID voice ElevenLabs harus utuh');
});

test('D-278: catatan status engine cadangan benar-benar berjalan (eksekusi fungsi)', () => {
  const {fnBody} = extractStudioInternals(studio);
  const icon = () => '';
  const build = (providers) => new Function('ttsProviders', 'icon', `
    ${fnBody('ttsProviderNote')}
    return ttsProviderNote();
  `)(providers, icon);

  // Tidak ada provider siap -> peringatan + arah ke Pengaturan.
  const warn = build({azure: {configured: false}, elevenlabs: {configured: false}});
  assert.ok(/belum aktif/i.test(warn), 'harus memberi peringatan kalau belum ada engine siap');
  assert.ok(/Pengaturan/.test(warn), 'peringatan harus mengarah ke Pengaturan');
  assert.ok(/Azure Speech/.test(warn) && /ElevenLabs/.test(warn),
    'peringatan harus menyebut semua nama provider cadangan');

  // Ada provider siap -> tampilkan namanya.
  const ok = build({azure: {configured: true}, elevenlabs: {configured: false}});
  assert.ok(/Azure Speech/.test(ok), 'status harus menyebut Azure Speech');
  assert.ok(!/ElevenLabs/.test(ok), 'provider yang belum siap tidak boleh disebut sebagai siap');
});
