import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';

const html = readFileSync('public/index.html', 'utf8');
const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));

/**
 * D-248: splashscreen khusus tampilan HP.
 * Logo neon animasi (MP4) + fallback WebM/GIF + PNG statis, hanya di HP.
 */

test('D-248: elemen splash ada di body', () => {
  assert.match(html, /id="splash"/);
  assert.match(html, /id="splashVid"/);
  assert.match(html, /id="splashImg"/);
});

test('D-248: video punya src mp4 neon logo + poster png', () => {
  const m = html.match(/<video id="splashVid"[^>]*>/);
  assert.ok(m, 'tag video splashVid harus ada');
  assert.match(m[0], /assets\/brand\/sherly-logo\.mp4/);
  assert.match(m[0], /poster="assets\/brand\/sherly-logo-poster\.png"/);
});

test('D-248: video autoplay muted loop playsinline (dibutuhkan autoplay mobile)', () => {
  const m = html.match(/<video id="splashVid"[^>]*>/);
  for (const attr of ['autoplay', 'muted', 'loop', 'playsinline']) {
    assert.match(m[0], new RegExp(attr), `video harus punya atribut ${attr}`);
  }
});

test('D-248: markup splash berada sebelum .app (agar tampil duluan)', () => {
  const iSplash = html.indexOf('id="splash"');
  const iApp = html.indexOf('class="app"');
  assert.ok(iSplash > -1 && iApp > -1);
  assert.ok(iSplash < iApp, 'splash harus sebelum container .app');
});

test('D-248: splash disembunyikan hanya di layar HP (desktop tidak tampil)', () => {
  assert.match(html, /@media\(min-width:561px\)\{#splash\{display:none!important\}\}/);
  assert.match(html, /@media\(max-width:560px\)\{body\.splash-on\{overflow:hidden\}\}/);
});

test('D-248: durasi splash cukup lama supaya efek neon terlihat', () => {
  const m = html.match(/var MIN_MS=(\d+)/);
  assert.ok(m, 'MIN_MS harus ada');
  assert.ok(Number(m[1]) >= 3000, `MIN_MS ${m[1]} minimal 3000ms agar logo neon formasi penuh`);
});

test('D-248: hide splash menunggu font + load, ada safety net', () => {
  assert.match(html, /document\.fonts/);
  assert.match(html, /window\.addEventListener\('load'/);
  assert.match(html, /setTimeout\(hide,\d+\); \/\* safety net/);
});

test('D-248: prefers-reduced-motion memakai gambar statis', () => {
  assert.match(html, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(html, /prefers-reduced-motion:reduce/);
});

test('D-248: pilihan format runtime (mp4 -> webm -> gif) ada', () => {
  assert.match(html, /canPlayType\('video\/mp4'\)/);
  assert.match(html, /canPlayType\('video\/webm'\)/);
  assert.match(html, /sherly-logo\.webm/);
  assert.match(html, /id="splashGif"/, 'harus ada elemen GIF fallback');
  assert.match(html, /assets\/brand\/sherly-logo\.gif/);
});

test('D-248: reduced-motion menyembunyikan video & GIF, menampilkan PNG', () => {
  assert.match(
    html,
    /@media\(prefers-reduced-motion:reduce\)\{#splash \.sp-media video,#splash \.sp-media #splashGif\{display:none!important\}#splash \.sp-media #splashImg\{display:block!important\}/
  );
});

test('D-248: aset brand video tersedia di disk', () => {
  for (const f of [
    'public/assets/brand/sherly-logo.mp4',
    'public/assets/brand/sherly-logo.webm',
    'public/assets/brand/sherly-logo-poster.png',
    'public/assets/brand/sherly-logo.gif',
  ]) {
    assert.ok(existsSync(f), `${f} harus ada`);
    assert.ok(statSync(f).size > 1000, `${f} jangan kosong`);
  }
});

test('D-248: logo ada di tengah layar (tagline & bar overlay absolut)', () => {
  // tagline & bar harus position:absolute supaya tidak mendorong logo dari tengah
  assert.match(html, /#splash \.sp-tag\{position:absolute/);
  assert.match(html, /#splash \.sp-bar\{position:absolute/);
  // area media punya aspect ratio eksplisit + object-fit contain (logo utuh, tidak gepencet)
  assert.match(html, /#splash \.sp-media\{[^}]*aspect-ratio:36\/38/);
  assert.match(html, /#splash \.sp-media video[^{]*\{[^}]*object-fit:contain/);
});

test('D-248: background splash PERSIS sama dengan background app (kotak video hilang)', () => {
  // body app: radial-gradient(ellipse at 56% -20%,#24142a 0,transparent 38%),var(--bg)
  // splash harus memakai gradient yang sama + #070b14 (= --bg) supaya video
  // (yang di-bake ke #070b14) menyatu tanpa kotak.
  assert.match(html, /#splash\{[^}]*background:radial-gradient\(ellipse at 56% -20%,#24142a 0,transparent 38%\),#070b14/);
  const bodyBg = html.match(/body\{margin:0;background:([^;]+);/);
  assert.ok(bodyBg, 'body harus punya background');
  assert.match(bodyBg[1], /radial-gradient\(ellipse at 56% -20%,#24142a 0,transparent 38%\)/);
  assert.match(bodyBg[1], /var\(--bg\)/);
});

test('D-248: tagline & bar jauh di bawah logo (tidak kena logo)', () => {
  // offset harus positif (turun) dan cukup besar dari titik tengah
  const tag = html.match(/#splash \.sp-tag\{position:absolute;top:calc\(50% \+ min\(42vw,180px\) \+ (\d+)px\)/);
  assert.ok(tag, 'tagline harus positioned absolut dengan offset positif');
  assert.ok(Number(tag[1]) >= 40, `offset tagline ${tag[1]}px harus >= 40px (tidak kena logo)`);
  const bar = html.match(/#splash \.sp-bar\{position:absolute;top:calc\(50% \+ min\(42vw,180px\) \+ (\d+)px\)/);
  assert.ok(bar);
  assert.ok(Number(bar[1]) > Number(tag[1]), 'progress bar harus di bawah tagline');
});

test('D-248: durasi splash >= durasi video (3,4 dtk) supaya animasi penuh', () => {
  const m = html.match(/var MIN_MS=(\d+)/);
  assert.ok(m);
  assert.ok(Number(m[1]) >= 3400, `MIN_MS ${m[1]} harus >= 3400ms (video 3,4 dtk)`);
});

test('D-248: apple-touch-startup-image ada untuk iPhone (link + media query)', () => {
  const links = [...html.matchAll(/<link rel="apple-touch-startup-image"[^>]*>/g)];
  assert.ok(links.length >= 10, `harus ada link startup image, dapat ${links.length}`);
  for (const l of links) {
    assert.match(l[0], /media="[^"]*device-width[^"]*"/);
    assert.match(l[0], /media="[^"]*orientation:portrait[^"]*"/);
  }
});

test('D-248: file splash iOS benar-benar ada dan ukurannya pas', () => {
  const links = [...html.matchAll(/<link rel="apple-touch-startup-image" href="([^"]+)"/g)];
  for (const [, href] of links) {
    const path = 'public/' + href;
    assert.ok(existsSync(path), `${path} harus ada`);
    const m = href.match(/(\d+)x(\d+)\.png$/);
    assert.ok(m, `nama file harus memuat ukuran: ${href}`);
  }
});

test('D-248: manifest Android tetap standalone + background brand', () => {
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.background_color, '#070b14');
  assert.equal(manifest.orientation, 'portrait');
});

test('D-248: z-index splash di atas lightbox (140)', () => {
  const m = html.match(/#splash\{[^}]*z-index:(\d+)/);
  assert.ok(m, 'z-index splash harus ada');
  assert.ok(Number(m[1]) > 140, `z-index splash ${m[1]} harus > 140 (lightbox)`);
});
