// D-276 · Verifikasi render Remotion (server-side) dengan voice-over.
//
// Render komposisi BeatSequenceVertical memakai <Audio src={signedUrl}> lalu
// cek MP4 hasilny: durasi benar + ADA track audio (2 kotak "trak": video +
// audio, sample entry mp4a + descriptor esds).
//
// Catatan: Remotion menolak URL file:// untuk <Audio> -> audio disajikan lewat
// server HTTP kecil di 127.0.0.1 (meniru signed URL Supabase).
//
// Pemakaian: node tools/render-remotion-audio-check.mjs
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MG = path.join(ROOT, 'motion-graphics');
const OUT = '/tmp/mg-beat-audio.mp4';

/** WAV mono 24 kHz (meniru format Gemini TTS), 2 detik sinus 440 Hz. */
function makeWav(seconds = 2, sampleRate = 24000) {
  const n = Math.floor(seconds * sampleRate);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    data.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 12000), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

// Audio disajikan lewat server terpisah (spawn) supaya parent yang
// menjalankan execFileSync tetap bisa melayani request HTTP.
const wav = makeWav(2);
const wavPath = '/tmp/mg-voice-over.wav';
fs.writeFileSync(wavPath, wav);
const srvScript = '/tmp/mg-audio-server.mjs';
fs.writeFileSync(srvScript, `
import http from 'node:http';
import fs from 'node:fs';
const wav = fs.readFileSync('${wavPath}');
http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'audio/wav', 'Content-Length': wav.length});
  res.end(wav);
}).listen(8251, '127.0.0.1');
`);
const srv = spawn(process.execPath, [srvScript], {stdio: 'ignore'});
await new Promise((r) => setTimeout(r, 700));

const script = `
import {renderMedia, selectComposition} from '@remotion/renderer';
import {bundle} from '@remotion/bundler';
import path from 'node:path';

const BEATS = \`=== Hook ===
3,2x lebih cepat produksi

=== CTA ===
Coba sekarang
@sherlystudio\`;

const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), onProgress: () => {}});
const inputProps = {
  beatsText: BEATS, brand: 'SherlyStudio', durationInSeconds: 5, accent: '#f044a8',
  ctaLabel: '', audioSrc: 'http://127.0.0.1:8251/vo.wav',
};
const composition = await selectComposition({serveUrl, id: 'BeatSequenceVertical', inputProps, browserExecutable: '/tmp/chromedeps/chromium'});
await renderMedia({
  composition: {...composition, durationInFrames: 5 * 30},
  serveUrl, codec: 'h264', outputLocation: '${OUT}', inputProps,
  browserExecutable: '/tmp/chromedeps/chromium', onProgress: () => {},
});
`;
const tmp = path.join(MG, 'tmp-render-audio-check.mjs');
fs.writeFileSync(tmp, script);
try {
  execFileSync('npx', ['tsx', 'tmp-render-audio-check.mjs'], {
    cwd: MG,
    stdio: 'inherit',
    env: {...process.env, LD_LIBRARY_PATH: '/tmp/chromedeps/root/lib:' + (process.env.LD_LIBRARY_PATH || '')},
  });
} finally {
  fs.rmSync(tmp, {force: true});
  srv.kill();
}

const failures = [];
const ok = (cond, msg) => {
  console.log((cond ? '  OK   ' : '  GAGAL') + ' | ' + msg);
  if (!cond) failures.push(msg);
};

const buf = fs.readFileSync(OUT);
const mvhd = buf.indexOf(Buffer.from('mvhd'));
const ts = buf.readUInt32BE(mvhd + 16);
const du = buf.readUInt32BE(mvhd + 20);
const duration = du / ts;
ok(Math.abs(duration - 5) < 0.1, `durasi video ~5 detik (${duration.toFixed(3)} dtk)`);

let trakCount = 0;
let idx = 0;
while ((idx = buf.indexOf(Buffer.from('trak'), idx)) !== -1) { trakCount++; idx += 4; }
ok(trakCount === 2, `MP4 punya 2 track (video + audio) — dapat ${trakCount}`);
ok(buf.includes(Buffer.from('avc1')), 'MP4 punya sample entry video avc1');
ok(buf.includes(Buffer.from('mp4a')), 'MP4 punya sample entry audio mp4a');
ok(buf.includes(Buffer.from('esds')), 'MP4 punya descriptor audio esds');

console.log('');
if (failures.length) {
  console.log('GAGAL (' + failures.length + '):');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
console.log('SEMUA LOLOS — D-276 audio Remotion (server-side) OK');
