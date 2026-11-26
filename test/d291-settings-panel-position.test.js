// D-291: verifikasi panel Pengaturan Konten di desktop tidak lagi terpotong ke atas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
const studio = fs.readFileSync(path.join(ROOT, 'public/studio.js'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'server/app.js'), 'utf8');

// Rule DESKTOP panel Pengaturan = blok `.st-pop-settings{` yang punya `position:fixed`
// dan berada DI LUAR media query max-width:850px (yang itu versi HP modal tengah).
const desktopRule = (() => {
  const blocks = [...html.matchAll(/\.st-pop-settings\{([^}]*)\}/g)];
  const hit = blocks.find((b) => /position:fixed/.test(b[1]) && /st-composer-h/.test(b[1]));
  return hit ? hit[0] : null;
})();

// Ambil isi SEMUA blok @media dengan kondisi tertentu (brace-balanced).
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

// Rule HP (modal tengah) = blok @media(max-width:850px) yang memuat .st-pop-settings.
// Semua rule .st-pop.st-pop-settings di dalam blok itu digabung.
const hpRule = (() => {
  for (const block of mediaBlocks(html, '@media(max-width:850px){')) {
    const rules = [...block.matchAll(/\.st-pop\.st-pop-settings\{([^}]*)\}/g)];
    if (!rules.length) continue;
    return rules.map((r) => r[0]).join('\n');
  }
  return null;
})();

// Rule .st-set-body global (bukan yang di dalam @media).
const setBodyRule = (() => {
  const blocks = [...html.matchAll(/\.st-set-body\{([^}]*)\}/g)];
  const hit = blocks.find((b) => /overflow-y:auto/.test(b[1]));
  return hit ? hit[0] : null;
})();

// ===========================================================================
// 1. CSS desktop
// ===========================================================================

test('D-291: panel Pengaturan desktop tidak lagi nempel di atas composer', () => {
  assert.ok(desktopRule, 'rule desktop .st-pop-settings harus ditemukan');
  assert.doesNotMatch(
    desktopRule,
    /bottom:calc\(100%\s*\+\s*8px\)/,
    'panel tidak boleh memakai bottom:calc(100% + 8px) — itu penyebabnya terpotong ke atas',
  );
});

test('D-291: panel Pengaturan desktop pakai position:fixed dengan tinggi dibatasi viewport', () => {
  assert.ok(desktopRule);
  assert.match(desktopRule, /position:fixed/, 'harus fixed agar tinggi dihitung dari viewport');
  assert.match(
    desktopRule,
    /max-height:calc\(100vh - var\(--st-composer-h/,
    'tinggi panel dibatasi viewport dikurangi tinggi composer, bukan ruang ke atas composer',
  );
  assert.match(
    desktopRule,
    /bottom:calc\(var\(--st-composer-h/,
    'panel harus nempel tepat di atas composer (bukan keluar layar)',
  );
});

test('D-291: panel desktop tampil dengan animasi dari bawah', () => {
  assert.match(html, /@keyframes stSettingsRise/, 'animasi rise harus ada');
  const kf = html.match(/@keyframes stSettingsRise\{[^}]*\}/);
  assert.ok(kf);
  assert.match(kf[0], /translateY\(1[0-9]px\)/, 'panel harus bergerak naik dari bawah');
  assert.match(html, /\.st-pop-settings\{[^}]*animation:stSettingsRise/, 'panel desktop harus pakai animasi');
  assert.match(
    html,
    /@media \(prefers-reduced-motion: reduce\)\{\.st-pop-settings\{animation:none\}\}/,
    'harus ada fallback reduced-motion',
  );
});

// ===========================================================================
// 2. CSS mobile — tidak boleh rusak
// ===========================================================================

test('D-291: panel HP tetap modal tengah (tidak diubah)', () => {
  assert.ok(hpRule, 'rule HP harus ada');
  assert.match(hpRule, /position:fixed!important/, 'HP tetap fixed');
  assert.match(hpRule, /top:50%!important/, 'HP tetap di tengah layar');
  assert.match(hpRule, /bottom:auto!important/, 'HP tidak ikut rule desktop');
  assert.match(hpRule, /transform:translate\(-50%,-50%\)!important/, 'HP tetap center');
  assert.match(
    hpRule,
    /animation:none!important/,
    'panel HP tidak memakai animasi rise (modal tengah tetap diam)',
  );
});

// ===========================================================================
// 3. Isi panel tidak boleh terpotong
// ===========================================================================

test('D-291: isi panel (st-set-body) bisa scroll dan tidak pernah terpotong', () => {
  assert.ok(setBodyRule, '.st-set-body global harus ada');
  assert.match(setBodyRule, /overflow-y:auto/, 'body panel harus bisa scroll');
  assert.match(setBodyRule, /flex:1 1 auto/, 'body harus fleksibel');
  assert.match(setBodyRule, /min-height:0/, 'min-height:0 supaya body bisa menyusut');
});

// ===========================================================================
// 4. JS: var tinggi composer
// ===========================================================================

test('D-291: fungsi syncComposerHeightVar ada', () => {
  assert.match(studio, /function syncComposerHeightVar\(\)/, 'fungsi pengukur tinggi composer wajib ada');
  assert.match(studio, /--st-composer-h/, 'fungsi harus menulis var --st-composer-h');
});

test('D-291: syncComposerHeightVar dipanggil saat panel Pengaturan dibuka', () => {
  const idx = studio.indexOf('function openSettingsPanel');
  assert.ok(idx > -1, 'openSettingsPanel harus ada');
  assert.match(studio.slice(idx, idx + 1200), /syncComposerHeightVar\(\)/);
});

test('D-291: syncComposerHeightVar dipanggil saat baris aset berubah', () => {
  const idx = studio.indexOf('function renderAssetHeader');
  assert.ok(idx > -1);
  assert.match(studio.slice(idx, idx + 600), /syncComposerHeightVar\(\)/);
});

test('D-291: syncComposerHeightVar dipanggil saat window resize', () => {
  assert.match(
    studio,
    /addEventListener\('resize'[\s\S]{0,300}syncComposerHeightVar\(\)/,
    'resize harus memperbarui var tinggi composer',
  );
});

// ===========================================================================
// 5. D-290 (hapus lipsync) tetap berlaku
// ===========================================================================

test('D-291: fitur Karakter Bicara (lipsync) tetap dihapus total', () => {
  assert.doesNotMatch(studio, /lipsync/i, 'tidak boleh ada jejak lipsync di studio.js');
  assert.doesNotMatch(
    html,
    /st-lip|st-lipsync|stLipsync|stLipFlow|stSceneHint|stLipScript/i,
    'tidak boleh ada markup/CSS lipsync',
  );
  assert.doesNotMatch(app, /api\/ai\/lipsync/, 'route lipsync harus dihapus');
});
