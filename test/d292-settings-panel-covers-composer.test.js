// D-292: panel "Pengaturan Konten" di desktop MELETAKI composer.
//
// Masalah yang dilaporkan user: di mode Motion Graphics + template "Rangkaian
// Beat", composer jadi tinggi (textarea 7 baris + textarea 3 baris). Panel
// Pengaturan yang nempel DI ATAS composer jadi tidak punya ruang -> user harus
// pindah menu dulu untuk bisa menutup panel & memilih jenis konten.
//
// Perbaikan: panel desktop menempel di BAWAH layar dan MENUTUPI composer di
// belakangnya, jadi:
//   1. ruang panel = seluruh tinggi viewport (tidak pernah terpotong),
//   2. user tidak perlu pindah menu & balik ke Studio,
//   3. panel tetap "tampil dari bawah".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
const studio = readFileSync(path.join(ROOT, 'public/studio.js'), 'utf8');
const mg = readFileSync(path.join(ROOT, 'public/motion-graphics.js'), 'utf8');

// Rule DESKTOP panel = blok .st-pop-settings yang position:fixed & TIDAK di HP.
function mediaBlocks(source, condition) {
  const out = [];
  let from = 0;
  for (;;) {
    const start = source.indexOf(condition, from);
    if (start < 0) break;
    const open = source.indexOf('{', start);
    let depth = 0;
    let end = -1;
    for (let k = open; k < source.length; k++) {
      if (source[k] === '{') depth++;
      else if (source[k] === '}') {
        depth--;
        if (depth === 0) { end = k; break; }
      }
    }
    if (end < 0) break;
    out.push(source.slice(open + 1, end));
    from = end;
  }
  return out;
}

const desktopRule = (() => {
  const blocks = [...html.matchAll(/\.st-pop-settings\{([^}]*)\}/g)];
  // Rule desktop = blok yang punya position:fixed + `display:none` (bukan rule
  // HP yang memakai !important, dan bukan rule animation:none).
  const hit = blocks.find(
    (b) => /position:fixed/.test(b[1]) && !/!important/.test(b[1]) && /display:none/.test(b[1]),
  );
  return hit ? hit[0] : null;
})();

const hpRule = (() => {
  for (const block of mediaBlocks(html, '@media(max-width:850px){')) {
    const rules = [...block.matchAll(/\.st-pop\.st-pop-settings\{([^}]*)\}/g)];
    if (rules.length) return rules.map((r) => r[0]).join('\n');
  }
  return null;
})();

// ===========================================================================
// 1. CSS desktop — panel menutupi composer
// ===========================================================================

test('D-292: panel Pengaturan desktop menempel di BAWAH layar (bottom:0)', () => {
  assert.ok(desktopRule, 'rule desktop .st-pop-settings harus ditemukan');
  assert.match(desktopRule, /bottom:0/, 'panel harus menempel di bawah layar');
  assert.doesNotMatch(
    desktopRule,
    /bottom:calc\(var\(--st-composer-h/,
    'panel TIDAK boleh dihitung dari tinggi composer (itu bikin mepet saat composer tinggi)',
  );
});

test('D-292: panel desktop memakai seluruh tinggi viewport (tidak terpotong)', () => {
  assert.ok(desktopRule);
  assert.match(desktopRule, /position:fixed/, 'harus fixed');
  assert.match(
    desktopRule,
    /max-height:calc\(100vh/,
    'tinggi panel dibatasi viewport, bukan ruang ke atas composer',
  );
});

test('D-292: panel desktop tetap "tampil dari bawah" (animasi rise)', () => {
  assert.match(html, /@keyframes stSettingsRise/, 'animasi rise harus ada');
  const kf = html.match(/@keyframes stSettingsRise\{[^}]*\}/);
  assert.ok(kf);
  assert.match(kf[0], /translateY\(1[0-9]px\)/, 'harus bergerak dari bawah');
  assert.match(html, /\.st-pop-settings\{[^}]*animation:stSettingsRise/, 'panel desktop pakai animasi');
  assert.match(
    html,
    /@media \(prefers-reduced-motion: reduce\)\{\.st-pop-settings\{animation:none\}\}/,
    'fallback reduced-motion',
  );
});

test('D-292: panel desktop punya sudut bawah rata (menempel di bawah layar)', () => {
  assert.ok(desktopRule);
  assert.match(
    desktopRule,
    /border-radius:16px 16px 0 0/,
    'panel yang menempel di bawah layar harus sudut bawah rata',
  );
});

// ===========================================================================
// 2. HP — tidak boleh ikut berubah
// ===========================================================================

test('D-292: panel HP tetap modal tengah', () => {
  assert.ok(hpRule, 'rule HP harus ada');
  assert.match(hpRule, /top:50%!important/, 'HP tetap di tengah layar');
  assert.match(hpRule, /bottom:auto!important/, 'HP tidak ikut rule desktop');
  assert.match(hpRule, /transform:translate\(-50%,-50%\)!important/, 'HP tetap center');
  assert.match(hpRule, /animation:none!important/, 'HP tidak ikut animasi rise');
});

// ===========================================================================
// 3. Akar masalah: template "Rangkaian Beat" bikin composer tinggi
// ===========================================================================

test('D-292: template "Rangkaian Beat" punya textarea panjang (akar masalah composer tinggi)', () => {
  const m = mg.match(/id:\s*'beat-sequence'/);
  assert.ok(m, 'template beat-sequence harus ada');
  // Ambil sampai template berikutnya supaya tidak kelewat.
  const start = m.index;
  const next = mg.indexOf("id: '", start + 10);
  const block = mg.slice(start, next > -1 ? next : start + 3000);
  assert.match(block, /rows:\s*7/, 'field beat textarea 7 baris');
  assert.match(block, /rows:\s*3/, 'field voiceover textarea 3 baris');
});

// ===========================================================================
// 4. JS — panel tetap bisa ditutup tanpa pindah menu
// ===========================================================================

test('D-292: klik di luar panel menutup panel Pengaturan', () => {
  // Ada handler global: kalau popOpen === 'settings' dan klik di luar panel,
  // panel ditutup (popOpen = null) -> user tidak perlu pindah menu.
  const idx = studio.indexOf("popOpen === 'settings'");
  assert.ok(idx > -1, 'harus ada handling popOpen === settings');
  const block = studio.slice(idx, idx + 900);
  assert.match(block, /closest\('#stPop-settings'\)/, 'klik di dalam panel tidak menutup');
  assert.match(block, /classList\.remove\('open'\)/, 'klik di luar panel harus menutup');
});

test('D-292: panel punya tombol Batal & Simpan untuk menutup', () => {
  assert.match(studio, /id="stSetCancel"/, 'tombol Batal harus ada');
  assert.match(studio, /id="stSetSave"/, 'tombol Simpan harus ada');
  assert.match(studio, /stSetCancel'\)\?\.addEventListener\('click'/, 'Batal harus menutup panel');
  assert.match(studio, /stSetSave'\)\?\.addEventListener\('click'/, 'Simpan harus menutup panel');
});

// ===========================================================================
// 5. D-290 & D-291 tidak rusak
// ===========================================================================

test('D-292: D-291 masih berlaku (panel fixed, tinggi dibatasi viewport)', () => {
  assert.ok(desktopRule);
  assert.match(desktopRule, /position:fixed/);
  assert.match(desktopRule, /max-height:calc\(100vh/);
  assert.doesNotMatch(desktopRule, /bottom:calc\(100%\s*\+\s*8px\)/);
});

test('D-292: fitur Karakter Bicara (lipsync) tetap dihapus total', () => {
  assert.doesNotMatch(studio, /lipsync/i);
  assert.doesNotMatch(html, /st-lip|st-lipsync|stLipsync|stLipFlow|stSceneHint|stLipScript/i);
});
