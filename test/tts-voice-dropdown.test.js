/**
 * D-277 — Dropdown suara TTS di Studio (jsdom).
 *
 * Menguji `ttsVoiceOptions()` + `ttsProviderNote()` tanpa browser sungguhan:
 *   1. Voice dikelompokkan per provider: Gemini → Soniox → Voicemaker → TTSMaker.
 *   2. Voice Bahasa Sunda ditandai.
 *   3. Status engine cadangan menampilkan semua provider yang siap.
 *   4. Peringatan menyebut nama provider + arah ke Pengaturan.
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
    {provider: 'soniox', id: 'Sari', label: 'Sari · Indonesia', language: 'Bahasa Indonesia'},
    {provider: 'voicemaker', id: 'ai2-Ardi', label: 'Ardi · Indonesia', language: 'Bahasa Indonesia'},
    {provider: 'ttsmaker', id: 729, label: 'Citra · Indonesia', language: 'Bahasa Indonesia'},
    {provider: 'ttsmaker', id: 700001, label: 'Sarah · Sunda', language: 'Bahasa Sunda'},
  ],
  providers: {gemini: {}, soniox: {}, voicemaker: {}, ttsmaker: {}},
  emotions: [],
  soniox: {configured: true},
  voicemaker: {configured: false},
  ttsmaker: {configured: true, quota: {quota: 100000, used: 1200, left: 98800}, error: null},
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

/** Ambil fungsi internal Studio lewat closure (tidak diekspor). */
function extractStudioInternals(source) {
  // Fungsi ttsVoiceOptions & ttsProviderNote berada di dalam IIFE Studio.
  // Kita panggil lewat window dengan menyuntikkan akses ke lexical scope lewat
  // evaluate.SourceTextModule tidak tersedia di jsdom -> pakai regex + eval
  // fungsi yang diekstrak langsung.
  const fnBody = (name) => {
    const re = new RegExp(`function ${name}\\(\\)[\\s\\S]*?\\n  }`, 'm');
    const m = source.match(re);
    return m ? m[0] : null;
  };
  return {fnBody};
}

test('D-277: sumber kode Studio mengelompokkan voice per provider cadangan', () => {
  // Grouping harus urut: Gemini → Soniox → Voicemaker → TTSMaker.
  assert.ok(
    /for \(const provider of \['soniox', 'voicemaker', 'ttsmaker'\]\)/.test(studio),
    'dropdown harus iterasi provider cadangan dalam urutan Soniox → Voicemaker → TTSMaker',
  );
  assert.ok(
    /const name = provider === 'soniox' \? 'Soniox' : provider === 'voicemaker' \? 'Voicemaker' : 'TTSMaker'/.test(studio),
    'nama provider ditampilkan sesuai label',
  );
});

test('D-277: dropdown menandai voice Bahasa Sunda', () => {
  assert.ok(
    /v\.language === 'Bahasa Sunda' \? 'Sunda' : 'Indonesia'/.test(studio),
    'voice Sunda harus ditandai di label dropdown',
  );
});

test('D-277: status engine cadangan menampilkan semua provider yang siap', () => {
  assert.ok(
    /for \(const provider of \['soniox', 'voicemaker', 'ttsmaker'\]\)/.test(studio),
    'status harus mengecek semua provider cadangan',
  );
  assert.ok(
    /const ready = \[\];/.test(studio),
    'status harus mengumpulkan provider yang siap',
  );
  assert.ok(
    /Soniox/.test(studio) && /Voicemaker/.test(studio) && /TTSMaker/.test(studio),
    'nama semua provider cadangan harus dikenal UI',
  );
});

test('D-277: peringatan engine cadangan memberi arah ke Pengaturan', () => {
  assert.ok(
    /Pengaturan → Provider &amp; API Key/.test(studio),
    'peringatan harus mengarahkan ke Pengaturan → Provider & API Key',
  );
  assert.ok(
    /Engine cadangan TTS belum aktif/.test(studio),
    'peringatan harus menyebut engine cadangan belum aktif',
  );
});

test('D-277: payload voice dari server dipakai tanpa memfilter provider', () => {
  // Server yang menentukan voice mana yang dikirim; client tidak boleh
  // membuang provider baru (Soniox/Voicemaker) hanya karena belumInstaller.
  assert.ok(
    /if \(Array\.isArray\(d\?\.voices\)\) ttsVoices = d\.voices;/.test(studio),
    'client harus menerima semua voice dari server apa adanya',
  );
  assert.ok(
    /for \(const p of \['soniox', 'voicemaker', 'ttsmaker'\]\)/.test(studio),
    'status per provider harus dibaca dari payload',
  );
});

test('D-277: helper ekstraksi fungsi internal Studio tersedia (sanity)', () => {
  const {fnBody} = extractStudioInternals(studio);
  assert.ok(fnBody('ttsVoiceOptions'), 'fungsi ttsVoiceOptions harus ada');
  assert.ok(fnBody('ttsProviderNote'), 'fungsi ttsProviderNote harus ada');
});

test('D-277: dropdown benar-benar mengelompokkan voice (eksekusi fungsi)', () => {
  const {fnBody} = extractStudioInternals(studio);
  const voices = [
    {provider: 'gemini', id: 'Kore', label: 'Kore · Tegas', language: 'Bahasa Indonesia'},
    {provider: 'soniox', id: 'Sari', label: 'Sari · Indonesia', language: 'Bahasa Indonesia'},
    {provider: 'voicemaker', id: 'ai2-Ardi', label: 'Ardi · Indonesia', language: 'Bahasa Indonesia'},
    {provider: 'ttsmaker', id: 729, label: 'Citra · Indonesia', language: 'Bahasa Indonesia'},
    {provider: 'ttsmaker', id: 700001, label: 'Sarah · Sunda', language: 'Bahasa Sunda'},
  ];
  const providers = {soniox: {configured: true}, voicemaker: {configured: false}, ttsmaker: {configured: true, quota: {left: 98800}}};
  // Fungsi Studio memakai closure `ttsVoices` & `ttsProviders` —_eval ulang
  // fungsinya dengan scope yang dibuat eksplisit.
  const scope = {ttsVoices: voices, ttsProviders: providers};
  const run = new Function('ttsVoices', 'ttsProviders', `
    ${fnBody('ttsVoiceOptions')}
    return ttsVoiceOptions();
  `);
  const options = run(scope.ttsVoices, scope.ttsProviders);
  const labels = options.map((o) => o.label);
  // Urutan grup: Gemini → Soniox → Voicemaker → TTSMaker.
  const iGemini = labels.findIndex((l) => l.includes('Gemini (bawaan)'));
  const iSoniox = labels.findIndex((l) => l.includes('Soniox'));
  const iVoicemaker = labels.findIndex((l) => l.includes('Voicemaker'));
  const iTtsmaker = labels.findIndex((l) => l.includes('TTSMaker'));
  assert.ok(iGemini >= 0, 'grup Gemini harus ada');
  assert.ok(iSoniox > iGemini, 'Soniox setelah Gemini');
  assert.ok(iVoicemaker > iSoniox, 'Voicemaker setelah Soniox');
  assert.ok(iTtsmaker > iVoicemaker, 'TTSMaker setelah Voicemaker');
  // Voice Sunda ditandai.
  assert.ok(labels.some((l) => l.includes('Sunda')), 'voice Sunda harus ditandai');
  // ID voice provider non-Gemini tetap dipakai apa adanya (tidak diubah).
  assert.ok(options.some((o) => o.value === 'Sari'), 'ID voice Soniox harus utuh');
  assert.ok(options.some((o) => o.value === 'ai2-Ardi'), 'ID voice Voicemaker harus utuh');
  assert.ok(options.some((o) => o.value === '729'), 'ID voice TTSMaker harus utuh');
});

test('D-277: catatan status engine cadangan benar-benar berjalan (eksekusi fungsi)', () => {
  const {fnBody} = extractStudioInternals(studio);
  const icon = () => '';
  const build = (providers) => new Function('ttsProviders', 'icon', `
    ${fnBody('ttsProviderNote')}
    return ttsProviderNote();
  `)(providers, icon);

  // Tidak ada provider siap -> peringatan + arah ke Pengaturan.
  const warn = build({soniox: {configured: false}, voicemaker: {configured: false}, ttsmaker: {configured: false}});
  assert.ok(/belum aktif/i.test(warn), 'harus memberi peringatan kalau belum ada engine siap');
  assert.ok(/Pengaturan/.test(warn), 'peringatan harus mengarah ke Pengaturan');
  assert.ok(/Soniox/.test(warn) && /Voicemaker/.test(warn) && /TTSMaker/.test(warn),
    'peringatan harus menyebut semua nama provider cadangan');

  // Ada provider siap -> tampilkan namanya.
  const ok = build({soniox: {configured: true}, voicemaker: {configured: false}, ttsmaker: {configured: true, quota: {left: 98800}}});
  assert.ok(/Soniox/.test(ok), 'status harus menyebut Soniox');
  assert.ok(/TTSMaker/.test(ok), 'status harus menyebut TTSMaker');
  assert.ok(!/Voicemaker/.test(ok), 'provider yang belum siap tidak boleh disebut sebagai siap');
  assert.ok(/98[.\s]?800/.test(ok), 'sisa kuota harus ditampilkan');
});
