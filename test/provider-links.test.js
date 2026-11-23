// D-270 · Halaman Pengaturan (Admin) → Provider & API Key:
//   - tiap provider punya link resmi untuk mendapatkan API key
//   - tampilan lebih compact + jarak antar form field yang tumpuk tidak nempel
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PROVIDER_INFO, PROVIDERS } from '../server/provider-keys.js';

const html = readFileSync('public/index.html', 'utf8');
const clientJs = readFileSync('public/ai-providers.js', 'utf8');
const appJs = readFileSync('server/app.js', 'utf8');
const profileJs = readFileSync('public/profile.js', 'utf8');

test('D-270: tiap provider punya link resmi ambil API key + dokumentasi', () => {
  for (const p of PROVIDERS) {
    const info = PROVIDER_INFO[p];
    assert.ok(info, `provider ${p} harus punya info`);
    assert.ok(info.label, `provider ${p} harus punya label`);
    assert.ok(/^https:\/\//.test(info.keyUrl), `provider ${p} harus punya keyUrl https`);
    assert.ok(/^https:\/\//.test(info.docsUrl), `provider ${p} harus punya docsUrl https`);
    assert.ok(info.hint && info.hint.length > 10, `provider ${p} harus punya petunjuk`);
  }
  // URL kuncinya harus benar-benar ke halaman pembuatan key.
  assert.equal(PROVIDER_INFO.groq.keyUrl, 'https://console.groq.com/keys');
  assert.equal(PROVIDER_INFO.gemini.keyUrl, 'https://aistudio.google.com/apikey');
  assert.equal(PROVIDER_INFO.openrouter.keyUrl, 'https://openrouter.ai/keys');
  assert.ok(PROVIDER_INFO.kie.keyUrl.includes('kie.ai'));
  // Kustom tidak punya link (dipakai user sendiri).
  assert.equal(PROVIDER_INFO.custom.keyUrl, '');
});

test('D-270: info provider dikirim ke client lewat API vault', () => {
  assert.ok(appJs.includes('providerInfo: PROVIDER_INFO'), 'payload API harus menyertakan providerInfo');
  assert.ok(appJs.includes('PROVIDER_INFO'), 'server harus import PROVIDER_INFO');
  assert.ok(clientJs.includes('providerInfo'), 'client harus menerima providerInfo');
  assert.ok(clientJs.includes('FALLBACK_PROVIDER_INFO'), 'client harus punya fallback bila payload lama');
  assert.ok(clientJs.includes('data.providerInfo'), 'client harus baca providerInfo dari payload');
});

test('D-270: kartu provider menampilkan link Ambil API key & Dokumentasi', () => {
  assert.ok(clientJs.includes('vault-keylinks'), 'harus ada blok link di kartu');
  assert.ok(clientJs.includes('vault-keylink'), 'harus ada kelas .vault-keylink');
  assert.ok(clientJs.includes('Ambil API key'), 'teks link ambil key');
  assert.ok(clientJs.includes('Dokumentasi'), 'teks link dokumentasi');
  // Link aman: target _blank + rel noopener.
  assert.ok(clientJs.includes('target="_blank" rel="noopener noreferrer"'), 'link harus aman (noopener)');
  // Modal Tambah API Key juga punya link dinamis per provider.
  assert.ok(html.includes('id="keyProviderLink"'), 'modal harus punya elemen link');
  assert.ok(clientJs.includes('syncProviderLink'), 'ada fungsi sync link modal');
  assert.ok(clientJs.includes("'change', () => { syncProviderLink(); resetProbeResult(); }"),
    'link modal harus ikut berubah saat provider diganti');
});

test('D-270: kartu provider lebih compact (jarak antar blok rapi)', () => {
  const card = html.match(/\.vault-card\{([^}]*)\}/);
  assert.ok(card, 'aturan .vault-card harus ada');
  assert.ok(card[1].includes('gap:'), 'kartu harus pakai gap antar blok');
  assert.ok(card[1].includes('flex-direction:column'), 'kartu harus flex column');
  // Padding lebih kecil dari sebelumnya (16px -> 13/14px).
  const pad = (card[1].match(/padding:([\d\s]+)/) || [])[1] || '';
  const values = pad.trim().split(/\s+/).map(Number);
  assert.ok(values.length >= 1 && values[0] <= 14, `padding harus lebih compact (${pad})`);
  // Bagian dalam kartu punya jarak jelas.
  assert.ok(html.includes('.vault-keylinks{display:flex;gap:'), 'blok link harus punya gap');
  assert.ok(html.includes('.vault-model{margin-top:auto'), 'blok model dianchor ke bawah (kartu sama tinggi)');
});

test('D-270: field form yang tumpuk tidak nempel (ada jarak)', () => {
  assert.ok(html.includes('form > .form-field + .form-field{margin-top:12px}'),
    'field form bertumpuk harus punya jarak');
  assert.ok(html.includes('form > .form-field + .pink-btn'), 'jarak juga ke tombol setelah field');
  // Di dalam .form-grid jarak dari grid gap (jangan dobel).
  assert.ok(html.includes('.form-grid > .form-field + .form-field{margin-top:0}'),
    'di dalam form-grid tidak boleh margin dobel');
});

test('D-270: URL Gemini di halaman kunci pribadi diperbarui', () => {
  assert.ok(profileJs.includes('https://aistudio.google.com/apikey'),
    'URL Gemini harus yang benar (aistudio.google.com/apikey)');
  assert.ok(!profileJs.includes('aistudio.google.com/app/apikey'),
    'URL Gemini lama harus hilang');
});

test('D-270: kartu provider tidak melebar di HP (grid minmax(0,1fr))', () => {
  // `grid-template-columns:1fr` membuat track melebar ke min-content
  // (input + 2 tombol nowrap) sehingga kartu keluar viewport di HP.
  assert.ok(html.includes('@media(max-width:1100px){.vault-providers{grid-template-columns:minmax(0,1fr)}}'),
    'kolom grid harus minmax(0,1fr) agar tidak melebar di HP');
  assert.ok(!html.includes('@media(max-width:1100px){.vault-providers{grid-template-columns:1fr}}'),
    'aturan lama (1fr) harus hilang');
  // Baris model boleh membungkus di layar kecil.
  assert.ok(html.includes('.vault-model-row{flex-wrap:wrap}'),
    'baris model harus boleh wrap di HP');
});

// ===== D-277: provider cadangan TTS =====

test('D-280: provider cadangan TTS punya link resmi + capability TTS', () => {
  for (const p of ['ttsforfree', 'elevenlabs']) {
    const info = PROVIDER_INFO[p];
    assert.ok(info, `provider ${p} harus punya info`);
    assert.ok(/^https:\/\//.test(info.keyUrl), `provider ${p} punya keyUrl https`);
    assert.ok(/^https:\/\//.test(info.docsUrl), `provider ${p} punya docsUrl https`);
  }
  assert.ok(PROVIDER_INFO.ttsforfree.keyUrl.includes('ttsforfree.com'));
  assert.ok(PROVIDER_INFO.elevenlabs.keyUrl.includes('elevenlabs.io'));
});

test('D-280: provider cadangan TTS terdaftar di PROVIDERS & capability tts', () => {
  for (const p of ['ttsforfree', 'elevenlabs']) {
    assert.ok(PROVIDERS.includes(p), `provider ${p} harus terdaftar`);
  }
  assert.ok(clientJs.includes("'ttsforfree'"), 'client harus mengenali ttsforfree');
  assert.ok(clientJs.includes("'elevenlabs'"), 'client harus mengenali elevenlabs');
  assert.ok(clientJs.includes("ttsforfree: ['tts']"), 'capability fallback client harus punya ttsforfree: tts');
  assert.ok(clientJs.includes("elevenlabs: ['tts']"), 'capability fallback client harus punya elevenlabs: tts');
});

test('D-280: provider yang wajib subscribe + azure tidak lagi terdaftar', () => {
  // TTSMaker/Soniox/Voicemaker/Azure dibuang — fallback TTS harus free tier
  // tanpa subscribe DAN tanpa kartu kredit.
  for (const gone of ['ttsmaker', 'soniox', 'voicemaker', 'azure']) {
    assert.ok(!PROVIDERS.includes(gone), `${gone} tidak boleh terdaftar di PROVIDERS`);
    assert.ok(!clientJs.includes(`'${gone}'`), `${gone} tidak boleh ada di client`);
  }
  assert.ok(
    !/Pro\/Studio/i.test(clientJs),
    'client tidak boleh lagi menampilkan catatan subscription TTSMaker',
  );
});

test('D-280: hint provider menyebut free tier tanpa subscribe', () => {
  assert.ok(
    /gratis|30\.000/i.test(PROVIDER_INFO.ttsforfree.hint),
    'hint TTSForFree harus menyebut free tier 30.000 karakter',
  );
  assert.ok(
    /gratis|10\.000/i.test(PROVIDER_INFO.elevenlabs.hint),
    'hint ElevenLabs harus menyebut kuota gratis',
  );
  assert.ok(
    /tanpa kartu kredit/i.test(
      PROVIDER_INFO.ttsforfree.hint + ' ' + PROVIDER_INFO.elevenlabs.hint),
    'hint harus menyebut tidak perlu kartu kredit',
  );
});

// ---------------------------------------------------------------------------
// D-280 — TTSForFree harus bisa dipilih di form key, Azure dihapus
// ---------------------------------------------------------------------------

test('D-280: dropdown provider form key memuat ttsforfree & elevenlabs', () => {
  const select = html.match(/<select id="keyProvider"[\s\S]*?<\/select>/);
  assert.ok(select, 'select#keyProvider tidak ditemukan');
  assert.match(select[0], /value="ttsforfree"/, 'opsi ttsforfree tidak ada di dropdown provider');
  assert.match(select[0], /value="elevenlabs"/, 'opsi elevenlabs tidak ada di dropdown provider');
});

test('D-280: azure dihapus dari dropdown provider', () => {
  const select = html.match(/<select id="keyProvider"[\s\S]*?<\/select>/);
  assert.doesNotMatch(select[0], /value="azure"/, 'opsi azure harus dihapus');
  assert.doesNotMatch(html, /id="keyRegion"/, 'field Region Azure harus dihapus');
});

test('D-280: server tidak menerima parameter region lagi', () => {
  assert.doesNotMatch(appJs, /probeProviderKey\(provider, api_key\.trim\(\), null, \{ region \}\)/,
    'route probe tidak boleh mengirim region');
  assert.doesNotMatch(appJs, /createKey\(req\.supabase, \{[^}]*region/s,
    'route create key tidak boleh mengirim region');
});
