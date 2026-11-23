// D-276 · Render client-side Motion Graphics + voice-over TTS di Chromium.
//
// Memverifikasi jalur audio end-to-end di browser sungguhan:
//   1. /api/ai/tts dimock -> mengembalikan WAV PCM.
//   2. Client fetchTtsAudio() -> decodeAudioBuffer() -> AudioBufferSource.
//   3. Track audio di-mux ke MP4 yang sama (mediabunny addAudioTrack).
//   4. Hasil MP4 punya track audio (dibaca dari header MP4) + beat_sequence.
//
// Pemakaian: node tools/render-client-audio-check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ROOT = path.resolve(__dirname, '..');
const PORT = 8247;
const OUT = path.join(ROOT, '.tmp-render');
fs.mkdirSync(OUT, { recursive: true });

const libDir = '/tmp/chromedeps/root/lib';
const env = { ...process.env };
if (fs.existsSync(libDir)) env.LD_LIBRARY_PATH = libDir + (env.LD_LIBRARY_PATH ? ':' + env.LD_LIBRARY_PATH : '');

const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve-static.mjs'), path.join(ROOT, 'public'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));

/**
 * WAV PCM 16-bit mono 24 kHz — 1 detik sinus 440 Hz.
 * Dibuat di Node lalu dikirim sebagai Buffer ke browser lewat evaluate().
 */
function makeWav(seconds = 1, sampleRate = 24000) {
  const n = Math.floor(seconds * sampleRate);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const v = Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 12000);
    data.writeInt16LE(v, i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);            // PCM
  header.writeUInt16LE(1, 22);            // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const WAV_B64 = makeWav(1.2).toString('base64');

const puppeteer = (await import('puppeteer-core')).default;
const browser = await puppeteer.launch({
  executablePath: '/tmp/chromedeps/chromium',
  headless: true,
  args: [
    '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
    '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
  ],
  env,
});
const page = await browser.newPage();
await page.setViewport({ width: 480, height: 800 });
page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));

// Intercept: /api/ai/tts -> WAV + header provider (simulasi fallback TTSMaker).
await page.setRequestInterception(true);
page.on('request', (req) => {
  const url = req.url();
  if (url.includes('/api/ai/tts')) {
    return req.respond({
      status: 200,
      contentType: 'audio/wav',
      headers: {'X-TTS-Provider': 'azure', 'X-TTS-Source': 'fallback'},
      body: Buffer.from(WAV_B64, 'base64'),
    });
  }
  if (url.startsWith('http://127.0.0.1:' + PORT) || url.startsWith('http://localhost:' + PORT)) {
    return req.continue();
  }
  return req.respond({status: 200, contentType: 'application/json', body: '{}'});
});

// Tunggu server statis siap sebelum browser membuka halaman.
await new Promise((r) => setTimeout(r, 400));
for (let i = 0; i < 20; i++) {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/index.html`);
    if (res.ok) break;
  } catch { /* belum siap */ }
  await new Promise((r) => setTimeout(r, 300));
}

await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });

const BEATS = `=== Hook ===
3,2x lebih cepat produksi
Tanpa harus bayar lebih

=== Poin 1 ===
Template siap pakai

=== CTA ===
Coba sekarang
@sherlystudio`;

const failures = [];
const ok = (cond, msg) => {
  console.log((cond ? '  OK   ' : '  GAGAL') + ' | ' + msg);
  if (!cond) failures.push(msg);
};

// --- 1) Render beat-sequence TANPA voice-over ---
const noAudio = await page.evaluate(async (beats) => {
  const mod = await import('/motion-graphics.js');
  const out = await mod.renderMotionGraphicsOnClient(
    { template: 'beat-sequence', aspect: '9:16', duration: 5, props: {beatsText: beats, ctaLabel: ''} },
    { onProgress: () => {}},
  );
  const buf = new Uint8Array(await out.blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode(...buf.subarray(i, i + 8192));
  return {b64: btoa(s), hasAudio: out.hasAudio, ttsProvider: out.ttsProvider, bytes: out.blob.size};
}, BEATS);
ok(!noAudio.hasAudio, 'tanpa naskah voice-over -> tidak ada track audio');
ok(noAudio.bytes > 1000, `MP4 beat tanpa audio tergenerate (${noAudio.bytes} byte)`);

// --- 2) Render beat-sequence DENGAN voice-over ---
const withAudio = await page.evaluate(async (beats) => {
  const mod = await import('/motion-graphics.js');
  const out = await mod.renderMotionGraphicsOnClient(
    {
      template: 'beat-sequence', aspect: '9:16', duration: 5,
      props: {beatsText: beats, ctaLabel: '', voiceoverText: 'Halo, ini uji suara.'},
    },
    { onProgress: () => {}},
  );
  const buf = new Uint8Array(await out.blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode(...buf.subarray(i, i + 8192));
  return {b64: btoa(s), hasAudio: out.hasAudio, ttsProvider: out.ttsProvider, bytes: out.blob.size};
}, BEATS);
ok(withAudio.hasAudio === true, 'dengan naskah voice-over -> track audio TERPASANG');
ok(withAudio.ttsProvider === 'azure', `provider terbaca dari header (${withAudio.ttsProvider})`);
// Ukuran file TIDAK dipakai sebagai penanda audio (encoding video beda-beda
// tiap run) — penanda yang sahih: MP4 punya sample entry audio (lihat bawah).

const file = path.join(OUT, 'beat-sequence-with-voice.mp4');
fs.writeFileSync(file, Buffer.from(withAudio.b64, 'base64'));
console.log('  saved', file, fs.statSync(file).size, 'bytes');

// --- 3) Cek header MP4 punya track audio ---
// Codec bisa varied sesuai kemampuan browser: mp4a (AAC), mp3, Opus, atau
// raw PCM. Yang wajib: ada track video + ada track audio (trak + sample entry).
const mp4 = fs.readFileSync(file);
const hasVideoTrak = mp4.includes(Buffer.from('vide'));
const hasAudioTrak = mp4.includes(Buffer.from('trak'));
const audioCodecBox = ['mp4a', 'mp3', 'Opus', 'sowt', 'lpcm', 'raw ']
  .find((tag) => mp4.includes(Buffer.from(tag)));
ok(hasVideoTrak, 'MP4 punya track video');
ok(hasAudioTrak, 'MP4 punya kotak track tambahan (trak)');
ok(Boolean(audioCodecBox), 'MP4 punya sample entry audio (codec: ' + (audioCodecBox || 'tidak ketemu') + ')');

// --- 4) Bandingkan dengan MP4 TANPA audio ---
// Penanda paling sahih: file tanpa audio tidak punya sample entry audio.
const fileNoAudio = path.join(OUT, 'beat-sequence-no-voice.mp4');
fs.writeFileSync(fileNoAudio, Buffer.from(noAudio.b64, 'base64'));
const mp4No = fs.readFileSync(fileNoAudio);
const audioCodecNoAudio = ['mp4a', 'mp3', 'Opus', 'sowt', 'lpcm', 'raw ']
  .find((tag) => mp4No.includes(Buffer.from(tag)));
ok(
  !audioCodecNoAudio,
  'MP4 TANPA voice-over tidak punya sample entry audio (kontrol: ' + (audioCodecNoAudio || 'tidak ada') + ')',
);

await browser.close();
server.kill('SIGTERM');

console.log('');
if (failures.length) {
  console.log('GAGAL (' + failures.length + '):');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
console.log('SEMUA LOLOS — D-276 audio client-side OK');
