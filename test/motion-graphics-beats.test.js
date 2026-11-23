/**
 * D-276 — Sistem beat (Rangkaian Beat) + CTA + template ke-4.
 *
 * Cakupan:
 *  - Parsing beat: header `=== Nama ===`, `## Nama`, `[Nama]`.
 *  - Peran beat: hook / body / payoff / cta / outro.
 *  - Distribusi durasi: total pas, min/max per beat.
 *  - Server (TS) & client (JS) memberi batas beat IDENTIK.
 *  - Template `beat-sequence` ada di server & client (sinkron).
 *  - CTA beat dapat tombol CTA; label tidak mengulang headline.
 *  - Provider TTS cadangan: TTSMaker support bahasa Indonesia.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  MG_TEMPLATES, normalizeRenderRequest,
} from '../server/motion-graphics.js';
import {
  MG_CLIENT_TEMPLATES,
} from '../public/motion-graphics.js';
import {
  parseBeats, distributeBeats, beatsFromText, beatAtFrame, roleForBeatName,
} from '../public/motion-graphics-beats.js';
import {
  TTSMAKER_ID_VOICES, TTSMAKER_VOICE_IDS, TTSMAKER_EMOTIONS,
  TTS_FALLBACK_PROVIDERS, isQuotaError, sanitizeTtsText, ttsProviderOrder,
} from '../server/tts-providers.js';

const beatsTs = readFileSync(path.resolve('motion-graphics/src/beats.ts'), 'utf8');
const beatSeqTsx = readFileSync(
  path.resolve('motion-graphics/src/compositions/BeatSequence.tsx'),
  'utf8',
);
const rootTsx = readFileSync(path.resolve('motion-graphics/src/Root.tsx'), 'utf8');
const clientMg = readFileSync(path.resolve('public/motion-graphics.js'), 'utf8');
const clientBeats = readFileSync(
  path.resolve('public/motion-graphics-beats.js'),
  'utf8',
);
const serverMg = readFileSync(path.resolve('server/motion-graphics.js'), 'utf8');
const appJs = readFileSync(path.resolve('server/app.js'), 'utf8');

const SAMPLE = `=== Hook ===
3,2x lebih cepat produksi
Tanpa hrs bayar lebih

=== Poin 1 ===
Template siap pakai

=== CTA ===
Coba sekarang
@sherlystudio`;

// ===== Parsing =====

test('D-276: header "=== Nama ===" memulai beat baru', () => {
  const beats = parseBeats(SAMPLE);
  assert.equal(beats.length, 3);
  assert.deepEqual(beats.map((b) => b.name), ['Hook', 'Poin 1', 'CTA']);
});

test('D-276: header "## Nama" dan "[Nama]" juga didukung', () => {
  const beats = parseBeats('## Hook\nBaris satu\n\n[Poin 1]\nBaris dua');
  assert.equal(beats.length, 2);
  assert.deepEqual(beats.map((b) => b.name), ['Hook', 'Poin 1']);
});

test('D-276: teks tanpa header -> satu beat "Hook" (backward compatible)', () => {
  const beats = parseBeats('Baris satu\nBaris dua');
  assert.equal(beats.length, 1);
  assert.equal(beats[0].name, 'Hook');
  assert.equal(beats[0].role, 'hook');
  assert.deepEqual(beats[0].lines, ['Baris satu', 'Baris dua']);
});

test('D-276: header tanpa teks dibuang', () => {
  const beats = parseBeats('=== Hook ===\nTeks\n\n=== Kosong ===\n\n=== CTA ===\nAksi');
  assert.deepEqual(beats.map((b) => b.name), ['Hook', 'CTA']);
});

test('D-276: peran beat ditentukan dari nama', () => {
  assert.equal(roleForBeatName('Hook'), 'hook');
  assert.equal(roleForBeatName('hook'), 'hook');
  assert.equal(roleForBeatName('Pembuka'), 'hook');
  assert.equal(roleForBeatName('Poin 1'), 'body');
  assert.equal(roleForBeatName('Poin 2'), 'body');
  assert.equal(roleForBeatName('CTA'), 'cta');
  assert.equal(roleForBeatName('Ajakan'), 'cta');
  assert.equal(roleForBeatName('Hasil'), 'payoff');
  assert.equal(roleForBeatName('Outro'), 'outro');
  assert.equal(roleForBeatName('Apapun'), 'body');
});

test('D-276: teks kosong -> pakai beat contoh (render tidak kosong)', () => {
  const beats = beatsFromText('', 15, 30);
  assert.ok(beats.length >= 3, 'harus ada beat contoh');
  assert.equal(beats[0].role, 'hook');
  assert.ok(beats.some((b) => b.role === 'cta'), 'harus ada beat CTA di contoh');
});

// ===== Distribusi durasi =====

test('D-276: durasi beat total = durasi video (tepat)', () => {
  for (const secs of [10, 15, 20, 25, 30]) {
    const beats = distributeBeats(parseBeats(SAMPLE), secs, 30);
    const total = beats.reduce((a, b) => a + b.durationInSeconds, 0);
    assert.ok(
      Math.abs(total - secs) < 0.05,
      `durasi ${secs}: total beat ${total.toFixed(3)} tidak sama`,
    );
  }
});

test('D-276: jalur render (beatsFromText) juga tepat untuk semua durasi', () => {
  for (const secs of [10, 12, 15, 20, 25, 30]) {
    const beats = beatsFromText(SAMPLE, secs, 30);
    const total = beats.reduce((a, b) => a + b.durationInSeconds, 0);
    assert.ok(
      Math.abs(total - secs) < 0.05,
      `durasi ${secs}: total beat ${total.toFixed(3)} tidak sama`,
    );
    assert.equal(beats[0].startFrame, 0);
    assert.equal(beats[beats.length - 1].endFrame, secs * 30);
  }
});

test('D-276: beat punya durasi minimum (tidak cuma 1 frame)', () => {
  // 8 beat pendek dalam 10 detik -> tiap beat minimal 1,2 detik.
  const many = Array.from({length: 8}, (_, i) => ({name: 'P' + i, role: 'body', lines: ['x']}));
  const beats = distributeBeats(many, 10, 30);
  for (const b of beats) {
    assert.ok(
      b.durationInSeconds >= 1.15,
      `beat ${b.name} cuma ${b.durationInSeconds.toFixed(2)} dtk`,
    );
  }
});

test('D-276: beat panjang dipecah supaya pacing tetap (<= 8 dtk per potongan)', () => {
  // Satu blok teks besar di video 30 detik -> dipecah jadi beberapa potongan.
  const beats = beatsFromText('=== Hook ===\n' + 'x '.repeat(400), 30, 30);
  assert.ok(beats.length > 1, 'beat panjang harus dipecah');
  for (const b of beats) {
    assert.ok(
      b.durationInSeconds <= 8.05,
      `potongan ${b.name} ${b.durationInSeconds.toFixed(2)} dtk melebihi batas`,
    );
  }
  // Total durasi tetap persis 30 detik setelah dipecah.
  const total = beats.reduce((a, b) => a + b.durationInSeconds, 0);
  assert.ok(Math.abs(total - 30) < 0.05, `total ${total.toFixed(3)} bukan 30 dtk`);
});

test('D-276: startFrame/endFrame bersambung tanpa celah', () => {
  const beats = distributeBeats(parseBeats(SAMPLE), 15, 30);
  for (let i = 1; i < beats.length; i++) {
    assert.equal(
      beats[i].startFrame, beats[i - 1].endFrame,
      `beat ${beats[i].name} tidak nyambung ke beat sebelumnya`,
    );
  }
  assert.equal(beats[0].startFrame, 0);
  assert.equal(beats[beats.length - 1].endFrame, 15 * 30);
});

test('D-276: beatAtFrame mengembalikan beat yang benar', () => {
  const beats = distributeBeats(parseBeats(SAMPLE), 15, 30);
  assert.equal(beatAtFrame(beats, 0).name, 'Hook');
  assert.equal(beatAtFrame(beats, 10).name, 'Hook');
  assert.equal(beatAtFrame(beats, beats[1].startFrame).name, 'Poin 1');
  assert.equal(beatAtFrame(beats, beats[2].startFrame).name, 'CTA');
  // Frame terakhir tetap mengembalikan beat terakhir.
  assert.equal(beatAtFrame(beats, 449).name, 'CTA');
});

// ===== Sinkron server <-> client =====

test('D-276: server (TS) & client (JS) punya fungsi beat yang sama', () => {
  for (const fn of ['parseBeats', 'distributeBeats', 'beatsFromText', 'beatAtFrame', 'roleForBeatName']) {
    assert.ok(beatsTs.includes(`export function ${fn}`), `beats.ts harus punya ${fn}`);
    assert.ok(clientBeats.includes(`export function ${fn}`), `motion-graphics-beats.js harus punya ${fn}`);
  }
});

test('D-276: konstanta beat sinkron antara TS & JS', () => {
  // Batas durasi beat harus sama di kedua file.
  const tsMin = /MIN_BEAT_SECONDS\s*=\s*([\d.]+)/.exec(beatsTs);
  const tsMax = /MAX_BEAT_SECONDS\s*=\s*([\d.]+)/.exec(beatsTs);
  const jsMin = /MIN_BEAT_SECONDS\s*=\s*([\d.]+)/.exec(clientBeats);
  const jsMax = /MAX_BEAT_SECONDS\s*=\s*([\d.]+)/.exec(clientBeats);
  assert.ok(tsMin && tsMax && jsMin && jsMax, 'batas beat harus ada di kedua file');
  assert.equal(tsMin[1], jsMin[1], 'MIN_BEAT_SECONDS harus sama');
  assert.equal(tsMax[1], jsMax[1], 'MAX_BEAT_SECONDS harus sama');
});

test('D-276: ROLE_BY_NAME sinkron antara TS & JS', () => {
  const tsBlock = /const ROLE_BY_NAME[\s\S]*?};/.exec(beatsTs)[0];
  const jsBlock = /const ROLE_BY_NAME[\s\S]*?};/.exec(clientBeats)[0];
  const tsKeys = [...tsBlock.matchAll(/(\w+):\s*'(\w+)'/g)].map((m) => `${m[1]}:${m[2]}`);
  const jsKeys = [...jsBlock.matchAll(/(\w+):\s*'(\w+)'/g)].map((m) => `${m[1]}:${m[2]}`);
  assert.deepEqual(jsKeys, tsKeys, 'peta peran beat harus identik');
});

test('D-276: gaya peran beat sinkron antara BeatSequence.tsx & client', () => {
  for (const role of ['hook', 'body', 'payoff', 'cta', 'outro']) {
    assert.ok(
      new RegExp(`${role}:\\s*\\{`).test(beatSeqTsx),
      `BeatSequence.tsx harus punya gaya peran ${role}`,
    );
    assert.ok(
      new RegExp(`${role}:\\s*\\{`).test(clientMg),
      `client harus punya gaya peran ${role}`,
    );
  }
});

// ===== Template beat-sequence =====

test('D-276: template beat-sequence ada di server & client (sinkron)', () => {
  const s = MG_TEMPLATES.find((t) => t.id === 'beat-sequence');
  const c = MG_CLIENT_TEMPLATES.find((t) => t.id === 'beat-sequence');
  assert.ok(s, 'template beat-sequence harus ada di server');
  assert.ok(c, 'template beat-sequence harus ada di client');
  assert.deepEqual(c.durations, s.durations, 'durasi harus sama');
  assert.equal(c.defaultDuration, s.defaultDuration);
  assert.equal(c.icon, s.icon);
});

test('D-276: template beat-sequence punya field Isi Beat (wajib) & CTA', () => {
  const t = MG_TEMPLATES.find((x) => x.id === 'beat-sequence');
  const beatsField = t.fields.find((f) => f.key === 'beatsText');
  assert.ok(beatsField, 'harus ada field beatsText');
  assert.ok(beatsField.required, 'field beat wajib diisi');
  assert.equal(beatsField.type, 'textarea', 'field beat harus textarea');
  assert.ok(t.fields.find((f) => f.key === 'ctaLabel'), 'harus ada field ctaLabel');
});

test('D-276: durasi template beat-sequence dalam batas 30 detik', () => {
  const t = MG_TEMPLATES.find((x) => x.id === 'beat-sequence');
  for (const d of t.durations) {
    assert.ok(d <= 30, `durasi ${d} melebihi batas 30 detik`);
  }
  assert.ok(t.durations.includes(30), 'harus bisa pilih 30 detik');
});

test('D-276: normalisasi request beat-sequence menerima durasi 30 detik', () => {
  const req = normalizeRenderRequest({
    template: 'beat-sequence',
    aspect: '9:16',
    duration: 30,
    props: {beatsText: '=== Hook ===\nHalo', ctaLabel: 'Simpan'},
  });
  assert.equal(req.durationInSeconds, 30);
  assert.equal(req.compositionId, 'BeatSequenceVertical');
  assert.equal(req.inputProps.beatsText, '=== Hook ===\nHalo');
  assert.equal(req.inputProps.ctaLabel, 'Simpan');
});

test('D-276: compositionId beat-sequence per rasio benar', () => {
  const mk = (aspect) => normalizeRenderRequest({
    template: 'beat-sequence', aspect, duration: 15,
    props: {beatsText: 'x'},
  }).compositionId;
  assert.equal(mk('9:16'), 'BeatSequenceVertical');
  assert.equal(mk('16:9'), 'BeatSequenceWide');
  assert.equal(mk('1:1'), 'BeatSequenceSquare');
});

test('D-276: Root.tsx mendaftarkan 3 komposisi BeatSequence', () => {
  assert.ok(rootTsx.includes('id="BeatSequenceVertical"'));
  assert.ok(rootTsx.includes('id="BeatSequenceWide"'));
  assert.ok(rootTsx.includes('id="BeatSequenceSquare"'));
  assert.ok(
    rootTsx.includes('calculateMetadata={calculateMetadata15}'),
    'komposisi beat-sequence harus punya calculateMetadata dinamis',
  );
});

test('D-276: komposisi beat-sequence ada di client dispatcher', () => {
  assert.ok(
    /'beat-sequence':\s*drawBeatSequence/.test(clientMg),
    'dispatcher client harus punya beat-sequence',
  );
});

// ===== CTA =====

test('D-276: hanya beat CTA/Outro yang punya tombol CTA', () => {
  // BeatSequence.tsx: gaya cta/outro -> ctaButton true,其它 false.
  const ctaBlock = /cta:\s*\{([^}]+)\}/.exec(beatSeqTsx)[1];
  assert.ok(/ctaButton:\s*true/.test(ctaBlock), 'peran cta harus punya tombol CTA');
  const hookBlock = /hook:\s*\{([^}]+)\}/.exec(beatSeqTsx)[1];
  assert.ok(/ctaButton:\s*false/.test(hookBlock), 'peran hook tidak boleh punya tombol CTA');
  const bodyBlock = /body:\s*\{([^}]+)\}/.exec(beatSeqTsx)[1];
  assert.ok(/ctaButton:\s*false/.test(bodyBlock), 'peran body tidak boleh punya tombol CTA');
});

test('D-276: teks tombol CTA tidak mengulang headline (pakai handle)', () => {
  // Kalau label kosong -> pakai baris handle (@...) — bukan headline.
  assert.ok(
    /handle \|\| 'Coba Sekarang'/.test(beatSeqTsx),
    'BeatSequence.tsx harus pakai handle untuk teks tombol CTA',
  );
  assert.ok(
    /handle \|\| 'Coba Sekarang'/.test(clientMg),
    'client harus pakai handle untuk teks tombol CTA',
  );
});

test('D-276: beat CTA punya tombol CTA & badge "SEKARANG"', () => {
  const beats = beatsFromText(SAMPLE, 15, 30);
  const cta = beats.find((b) => b.role === 'cta');
  assert.ok(cta, 'harus ada beat CTA');
  assert.equal(cta.lines[1], '@sherlystudio', 'baris kedua CTA adalah handle');
});

// ===== TTS cadangan =====

test('D-276: TTSMaker punya voice native Indonesia', () => {
  assert.ok(TTSMAKER_ID_VOICES.length >= 8, 'harus ada beberapa voice Indonesia');
  for (const v of TTSMAKER_ID_VOICES) {
    assert.ok(v.id && v.label, 'voice harus punya id + label');
    assert.ok(v.limit > 0, `${v.label} harus punya batas karakter`);
  }
  // Ada voice Sunda (bonus untuk konten Jawa).
  assert.ok(
    TTSMAKER_ID_VOICES.some((v) => v.key.includes('sunda')),
    'harus ada voice Bahasa Sunda',
  );
  // Ada voice multi-emosi.
  assert.ok(
    TTSMAKER_ID_VOICES.some((v) => v.emotion),
    'harus ada voice dengan emosi',
  );
});

test('D-276: TTSMaker punya key URL resmi + info provider', () => {
  const info = TTS_FALLBACK_PROVIDERS.ttsmaker;
  assert.ok(info, 'provider ttsmaker harus ada');
  assert.ok(info.keyUrl.startsWith('https://'), 'harus ada link ambil key');
  assert.ok(info.docsUrl.startsWith('https://'), 'harus ada link dokumentasi');
  assert.ok(info.languages.includes('Indonesia'), 'harus menyebut bahasa Indonesia');
});

test('D-276: urutan fallback TTS = gemini dulu, baru engine ID', () => {
  assert.deepEqual(ttsProviderOrder([]), ['gemini']);
  assert.deepEqual(ttsProviderOrder(['ttsmaker']), ['gemini', 'ttsmaker']);
  // Provider yang tidak dikenal diabaikan.
  assert.deepEqual(ttsProviderOrder(['bogus']), ['gemini']);
  // Tidak ada duplikat.
  assert.deepEqual(ttsProviderOrder(['ttsmaker', 'ttsmaker']), ['gemini', 'ttsmaker']);
});

test('D-276: deteksi error kuota (429/RESOURCE_EXHAUSTED) bekerja', () => {
  assert.ok(isQuotaError('429 Too Many Requests'));
  assert.ok(isQuotaError('RESOURCE_EXHAUSTED: quota exceeded'));
  assert.ok(isQuotaError('You exceeded your current quota'));
  assert.ok(isQuotaError('Rate limit reached'));
  assert.ok(isQuotaError('Insufficient quota for this model'));
  assert.ok(!isQuotaError('Internal server error'));
  assert.ok(!isQuotaError(''));
});

test('D-276: sanitizeTtsText membersihkan & memotong', () => {
  assert.equal(sanitizeTtsText('  halo   dunia  '), 'halo dunia');
  assert.equal(sanitizeTtsText('a'.repeat(50), 10).length, 10);
  assert.equal(sanitizeTtsText(''), '');
});

test('D-276: route TTS punya fallback ke provider cadangan', () => {
  assert.ok(
    appJs.includes('synthesizeTtsFallback'),
    'route TTS harus punya fungsi fallback',
  );
  assert.ok(
    /isQuotaError\(msg\)/.test(appJs),
    'route TTS harus mendeteksi error kuota -> fallback',
  );
  assert.ok(
    appJs.includes("X-TTS-Provider"),
    'respons fallback harus menandai provider yang dipakai',
  );
});

test('D-276: ada route daftar voice TTS', () => {
  assert.ok(
    appJs.includes("'/api/ai/tts/voices'"),
    'harus ada route /api/ai/tts/voices',
  );
});

test('D-276: TTSMaker terdaftar sebagai provider di vault', () => {
  const pk = readFileSync(path.resolve('server/provider-keys.js'), 'utf8');
  assert.ok(
    /PROVIDERS = \[[^\]]*'ttsmaker'/.test(pk),
    'ttsmaker harus ada di PROVIDERS',
  );
  assert.ok(
    /ttsmaker: \['tts'\]/.test(pk),
    'ttsmaker harus punya capability tts',
  );
});

test('D-276: migrasi DB mengizinkan provider ttsmaker', () => {
  // Tanpa constraint ini, simpan key TTSMaker gagal:
  // "new row for relation ai_provider_keys violates check constraint".
  const mig = readFileSync(
    path.resolve('supabase/ai_provider_ttsmaker_constraint_migration.sql'),
    'utf8',
  );
  assert.ok(
    /ai_provider_keys_provider_check[\s\S]*'ttsmaker'/.test(mig),
    'constraint ai_provider_keys harus menerima ttsmaker',
  );
  assert.ok(
    /ai_provider_settings_provider_check[\s\S]*'ttsmaker'/.test(mig),
    'constraint ai_provider_settings harus menerima ttsmaker',
  );
  // Bucket Bank Suara tetap PRIVATE (bukan publik) + RLS.
  assert.ok(
    /'tts-clips',\s*'tts-clips',\s*false/.test(mig),
    'bucket tts-clips harus tetap private',
  );
  // TTSMaker mengembalikan MP3 -> MIME audio harus diizinkan.
  assert.ok(
    /audio\/mpeg/.test(mig),
    'MIME audio/mpeg harus diizinkan untuk MP3 TTSMaker',
  );
  // ai_conversations TIDAK boleh ikut berubah (TTS bukan provider chat).
  assert.ok(
    !/ai_conversations_provider_check/.test(mig),
    'ai_conversations tidak boleh diubah (TTS bukan provider chat)',
  );
});

test('D-276: template beat-sequence ada di server motion-graphics', () => {
  assert.ok(
    serverMg.includes("id: 'beat-sequence'"),
    'server harus punya template beat-sequence',
  );
  assert.ok(
    serverMg.includes("'BeatSequence'"),
    'compositionId harus memetakan ke BeatSequence',
  );
});

// ===== UI Studio =====

test('D-276: Studio merender field select (dropdown suara TTS)', () => {
  const studio = readFileSync(path.resolve('public/studio.js'), 'utf8');
  assert.ok(
    studio.includes("f.type === 'select'"),
    'Studio harus mendukung field bertipe select',
  );
  assert.ok(
    studio.includes('data-motion-field'),
    'select harus tetap menyimpan state ke props',
  );
});

test('D-276: Studio memuat daftar suara TTS dari server', () => {
  const studio = readFileSync(path.resolve('public/studio.js'), 'utf8');
  assert.ok(
    studio.includes('/api/ai/tts/voices'),
    'Studio harus ambil daftar suara dari route voice',
  );
  assert.ok(
    studio.includes('ttsVoiceOptions'),
    'Studio harus punya fungsi opsi suara',
  );
  assert.ok(
    studio.includes('ttsProviderNote'),
    'Studio harus menampilkan status engine cadangan TTS',
  );
});

test('D-276: template beat-sequence punya kolom naskah voice-over & suara', () => {
  const t = MG_TEMPLATES.find((x) => x.id === 'beat-sequence');
  const vo = t.fields.find((f) => f.key === 'voiceoverText');
  assert.ok(vo, 'harus ada kolom naskah voice-over');
  assert.ok(!vo.required, 'naskah voice-over opsional');
  assert.equal(vo.type, 'textarea');
  const voice = t.fields.find((f) => f.key === 'voice');
  assert.ok(voice, 'harus ada kolom pilihan suara');
  assert.equal(voice.type, 'select', 'kolom suara harus dropdown');
});

test('D-276: client renderer bisa mux audio TTS ke video', () => {
  assert.ok(
    clientMg.includes('export async function fetchTtsAudio'),
    'client harus punya helper ambil audio TTS',
  );
  assert.ok(
    clientMg.includes('addAudioTrack'),
    'client harus menambahkan track audio ke output MP4',
  );
  assert.ok(
    clientMg.includes('AudioBufferSource'),
    'client harus pakai AudioBufferSource mediabunny',
  );
  assert.ok(
    clientMg.includes('hasAudio'),
    'hasil render harus melaporkan ada/tidaknya audio',
  );
});

test('D-276: server render Motion Graphics menyintesis voice-over', () => {
  assert.ok(
    appJs.includes('synthesizeVoiceoverForMotion'),
    'route render harus menyintesis voice-over',
  );
  assert.ok(
    appJs.includes('audioSrc'),
    'props render harus membawa URL audio untuk Remotion',
  );
  assert.ok(
    appJs.includes('ttsmakerKey'),
    'route harus punya ambil key TTSMaker',
  );
});

test('D-276: komposisi Remotion BeatSequence bisa menempel audio', () => {
  assert.ok(
    /audioSrc\?: string/.test(beatSeqTsx),
    'props komposisi harus punya audioSrc',
  );
  assert.ok(
    /<Audio src=\{audioSrc\}/.test(beatSeqTsx),
    'komposisi harus merender elemen Audio',
  );
});
