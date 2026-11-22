// D-257 — buat fixture video MP4 horizontal & portrait untuk tes deteksi dimensi.
// Dipakai tools/studio-layout-check.mjs (dimensi harus benar di DB & galeri).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] || '/home/user/sherly');
const OUT = path.join(ROOT, 'public/assets/brand');
fs.mkdirSync(OUT, { recursive: true });

const PORT = 8271;
const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve-static.mjs'), path.join(ROOT, 'public'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));

const env = { ...process.env };
const libDir = '/tmp/chromedeps/root/lib';
if (fs.existsSync(libDir)) env.LD_LIBRARY_PATH = libDir + ':' + (env.LD_LIBRARY_PATH || '');

const puppeteer = (await import('puppeteer-core')).default;
const browser = await puppeteer.launch({
  executablePath: '/tmp/chromedeps/chromium', headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  env,
});
const page = await browser.newPage();

async function record(file, width, height) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  const b64 = await page.evaluate(async (w, h) => {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    const stream = cv.captureStream(25);
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
    const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise((res) => { rec.onstop = res; });
    rec.start();
    let t = 0;
    const timer = setInterval(() => {
      t++;
      ctx.fillStyle = `hsl(${t * 20 % 360} 70% 50%)`;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 60px sans-serif';
      ctx.fillText(`${w}x${h}`, 40, h / 2);
    }, 40);
    await new Promise((r) => setTimeout(r, 1200));
    clearInterval(timer);
    rec.stop();
    await done;
    const blob = new Blob(chunks, { type: 'video/webm' });
    const buf = await blob.arrayBuffer();
    let s = ''; const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }, width, height);
  const out = path.join(OUT, file);
  fs.writeFileSync(out, Buffer.from(b64, 'base64'));
  console.log(`${file}: ${width}x${height} -> ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
}

await record('fixture-horizontal.webm', 1280, 720);
await record('fixture-vertical.webm', 720, 1280);

await browser.close();
server.kill();
