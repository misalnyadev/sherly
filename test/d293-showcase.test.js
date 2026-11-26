// D-293: Showcase — aset Studio yang dipilih user untuk tampil di Beranda.
//
// Dua slot:
//   'portfolio' -> "Pindahkan ke Portfolio"   -> section "Portfolio" Beranda
//   'public'    -> "Jadikan Konten Publik"    -> section "Konten Terbaru" Beranda
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');

const app = read('server/app.js');
const showcase = read('server/showcase.js');
const studioAssets = read('server/studio-assets.js');
const studio = read('public/studio.js');
const showJs = read('public/showcase.js');
const portfolioJs = read('public/portfolio.js');
const html = read('public/index.html');
const sql = read('supabase/showcase.sql');

// ===========================================================================
// 1. Modul server/showcase.js — fungsi murni
// ===========================================================================

test('D-293: normalizeSlot hanya menerima slot yang valid', async () => {
  const m = await import(path.join(ROOT, 'server/showcase.js'));
  assert.equal(m.normalizeSlot('portfolio'), 'portfolio');
  assert.equal(m.normalizeSlot('PUBLIC'), 'public');
  assert.equal(m.normalizeSlot('  public  '), 'public');
  assert.equal(m.normalizeSlot('portfolio'), 'portfolio');
  assert.equal(m.normalizeSlot('nope'), null);
  assert.equal(m.normalizeSlot(''), null);
  assert.equal(m.normalizeSlot(undefined), null);
  assert.equal(m.normalizeSlot(null), null);
});

test('D-293: sanitizeShowcaseText memangkas & merapikan', async () => {
  const m = await import(path.join(ROOT, 'server/showcase.js'));
  assert.equal(m.sanitizeShowcaseText('  halo   dunia  '), 'halo dunia');
  assert.equal(m.sanitizeShowcaseText(null), '');
  assert.equal(m.sanitizeShowcaseText(undefined), '');
  assert.equal(m.sanitizeShowcaseText('x'.repeat(300)).length, 120);
});

test('D-293: sanitizeShowcasePatch hanya memakai kunci yang ada', async () => {
  const m = await import(path.join(ROOT, 'server/showcase.js'));
  assert.deepEqual(m.sanitizeShowcasePatch({}), {});
  assert.deepEqual(m.sanitizeShowcasePatch({ is_portfolio: true }), { is_portfolio: true });
  assert.deepEqual(m.sanitizeShowcasePatch({ is_public: 'true' }), { is_public: true });
  assert.deepEqual(m.sanitizeShowcasePatch({ is_public: 'false' }), { is_public: false });
  assert.deepEqual(m.sanitizeShowcasePatch({ is_public: false }), { is_public: false });
  // Kunci yang tidak dikenal dibuang.
  assert.deepEqual(m.sanitizeShowcasePatch({ hacker: 1 }), {});
  // is_portfolio/is_public tidak ikut kalau tidak diminta (partial update).
  const p = m.sanitizeShowcasePatch({ title: ' Judul ' });
  assert.deepEqual(p, { title: 'Judul' });
  assert.ok(!('is_portfolio' in p));
});

test('D-293: showcasePath diawali userId (RLS showcase owner insert)', async () => {
  const m = await import(path.join(ROOT, 'server/showcase.js'));
  const p = m.showcasePath('user-123', 'asset-456', 'png');
  assert.ok(p.startsWith('user-123/'), 'path WAJIB diawali userId demi RLS');
  assert.ok(p.endsWith('.png'));
  // Ekstensi berbahaya dibersihkan.
  const bad = m.showcasePath('u', 'a', '../evil');
  assert.doesNotMatch(bad, /\.\./);
});

test('D-293: showcaseRow membentuk URL publik bucket showcase', async () => {
  const m = await import(path.join(ROOT, 'server/showcase.js'));
  const row = m.showcaseRow({
    id: 'r1', asset_id: 'a1', slot: 'public', title: 'T', caption: 'C',
    storage_path: 'u/x.png', media_type: 'image', width: 10, height: 20,
    created_at: '2026-01-01',
  }, 'https://proj.supabase.co/');
  assert.equal(row.assetId, 'a1');
  assert.equal(row.slot, 'public');
  assert.equal(row.publicUrl, 'https://proj.supabase.co/storage/v1/object/public/showcase/u/x.png');
  assert.equal(row.mediaType, 'image');
  assert.equal(row.width, 10);
});

test('D-293: showcaseRow tanpa baseUrl tidak menghasilkan URL rusak', async () => {
  const m = await import(path.join(ROOT, 'server/showcase.js'));
  const row = m.showcaseRow({ id: 'r', storage_path: 'u/x.png' }, '');
  assert.equal(row.publicUrl, '');
});

test('D-293: collectShowcaseItems menggabungkan aset + slot showcase', async () => {
  const m = await import(path.join(ROOT, 'server/showcase.js'));
  const assets = [
    { id: 'a1', file_name: 'satu.png', media_type: 'image', url: 'u/satu.png' },
    { id: 'a2', file_name: 'dua.png', media_type: 'image', url: 'u/dua.png' },
  ];
  const rows = [
    { asset_id: 'a1', slot: 'portfolio', title: 'PF', created_at: '2026-01-01' },
    { asset_id: 'a1', slot: 'public', title: 'PUB', created_at: '2026-01-02' },
  ];
  const out = m.collectShowcaseItems(assets, rows);
  assert.equal(out.length, 2, 'a1 punya 2 slot -> 2 item');
  assert.deepEqual(out.map((i) => i.slot).sort(), ['portfolio', 'public']);
  // Aset tanpa showcase tidak ikut.
  assert.ok(!out.some((i) => i.assetId === 'a2'));
});

// ===========================================================================
// 2. SQL / skema database
// ===========================================================================

test('D-293: SQL menambah kolom is_portfolio & is_public pada assets', () => {
  assert.match(sql, /add column if not exists is_portfolio boolean not null default false/);
  assert.match(sql, /add column if not exists is_public boolean not null default false/);
});

test('D-293: SQL membuat tabel showcase_items + view publik + bucket showcase', () => {
  assert.match(sql, /create table if not exists public\.showcase_items/);
  assert.match(sql, /slot text not null check \(slot in \('portfolio','public'\)\)/);
  assert.match(sql, /unique \(asset_id, slot\)/);
  assert.match(sql, /create or replace view public\.showcase_items_public/);
  assert.match(sql, /grant select on public\.showcase_items_public to anon, authenticated/);
  assert.match(sql, /'showcase', 'showcase', true/);
  // RLS owner untuk tabel (bukan anon).
  assert.match(sql, /create policy "showcase items owner crud"/);
  assert.match(sql, /using \(auth\.uid\(\) = user_id\)/);
});

test('D-293: SQL tidak menjadikan bucket studio-assets publik', () => {
  // Bucket studio-assets harus tetap private — hanya aset terpilih yang disalin.
  assert.doesNotMatch(sql, /'studio-assets', 'studio-assets', true/);
});

// ===========================================================================
// 3. Backend route
// ===========================================================================

test('D-293: route showcase aset tersedia (POST /api/studio/assets/:id/showcase)', () => {
  assert.match(app, /app\.post\('\/api\/studio\/assets\/:id\/showcase', requireUser, requireAdmin/);
});

test('D-293: route publik showcase tersedia tanpa login', () => {
  assert.match(app, /app\.get\('\/api\/public\/showcase', async/);
  // Route publik TIDAK boleh pakai requireUser/requireAdmin.
  const m = app.match(/app\.get\('\/api\/public\/showcase',[^\n]*/);
  assert.ok(m && !/requireUser|requireAdmin/.test(m[0]), 'route showcase publik harus terbuka');
});

test('D-293: route showcase salin file dari studio-assets ke bucket showcase', () => {
  assert.match(app, /async function copyAssetToShowcase/);
  assert.match(app, /supabase\.storage\.from\(STUDIO_BUCKET\)\.download\(src\)/);
  assert.match(app, /supabase\.storage\.from\(SHOWCASE_BUCKET\)\.upload\(dest/);
});

test('D-293: route showcase memakai view publik showcase_items_public', () => {
  assert.match(app, /from\('showcase_items_public'\)/);
});

test('D-293: supabaseConfigured dipakai sebagai boolean (bukan fungsi)', () => {
  // Bug lama: `supabaseConfigured()` — supabaseConfigured adalah boolean.
  assert.doesNotMatch(app, /supabaseConfigured\(\)/, 'supabaseConfigured itu boolean, bukan fungsi');
});

test('D-293: signedAsset mengembalikan flag showcase', () => {
  assert.match(studioAssets, /is_portfolio: asset\.is_portfolio === true/);
  assert.match(studioAssets, /is_public: asset\.is_public === true/);
});

// ===========================================================================
// 4. Frontend Studio
// ===========================================================================

test('D-293: Studio punya tombol "Pindahkan ke Portfolio" & "Jadikan Konten Publik"', () => {
  assert.match(studio, /Pindahkan ke Portfolio/);
  assert.match(studio, /Jadikan Konten Publik/);
  assert.match(studio, /data-lb-portfolio="1"/);
  assert.match(studio, /data-lb-public="1"/);
});

test('D-293: Studio mengirim slot yang benar ke server', () => {
  assert.match(studio, /setAssetShowcase\(a, 'portfolio', !a\.is_portfolio\)/);
  assert.match(studio, /setAssetShowcase\(a, 'public', !a\.is_public\)/);
  assert.match(studio, /\/api\/studio\/assets\/' \+ encodeURIComponent\(a\.id\) \+ '\/showcase'/);
});

test('D-293: badge showcase muncul di thumbnail galeri Studio', () => {
  assert.match(studio, /st-gal-showcase/);
  assert.match(html, /\.st-gal-showcase\{/);
  // Badge showcase di pojok KIRI (kanan dipakai badge asal).
  assert.match(html, /\.st-gal-showcase\{[^}]*left:4px/);
});

test('D-293: tombol showcase aktif punya gaya berbeda', () => {
  assert.match(html, /\.st-act\.is-on\{/);
});

// ===========================================================================
// 5. Frontend Beranda
// ===========================================================================

test('D-293: Beranda punya section Portfolio (bukan "Produksi Terbaru")', () => {
  assert.match(html, /id="homeProdPanel"[\s\S]{0,200}?Portfolio/);
  // "Produksi Terbaru" tidak boleh muncul sebagai judul markup lagi.
  const markup = html.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
  assert.doesNotMatch(markup, /Produksi Terbaru/, 'section lama diganti jadi Portfolio');
});

test('D-293: Beranda punya baris horizontal konten publik', () => {
  assert.match(html, /id="homePublicRow"/);
  assert.match(html, /id="homeLatestRow"/);
});

test('D-293: showcase.js dirender ke Beranda dari /api/public/showcase', () => {
  assert.match(html, /<script src="\/showcase\.js"><\/script>/);
  assert.match(showJs, /\/api\/public\/showcase/);
  assert.match(showJs, /homePortfolio/);
  assert.match(showJs, /homePublicRow/);
  assert.match(showJs, /homeLatestRow/);
});

test('D-293: showcase.js memisahkan slot portfolio & public', () => {
  assert.match(showJs, /slot === 'portfolio'/);
  assert.match(showJs, /slot === 'public'/);
  // Horizontal hanya berisi konten publik yang landscape.
  assert.match(showJs, /isLandscape/);
});

test('D-293: go("Beranda") me-refresh showcase', () => {
  assert.match(html, /sherlyLoadHomeShowcase&&window\.sherlyLoadHomeShowcase\(true\)/);
});

// ===========================================================================
// 6. Halaman Portfolio ikut menampilkan aset portfolio user
// ===========================================================================

test('D-293: halaman Portfolio mengambil item showcase (slot portfolio)', () => {
  assert.match(portfolioJs, /\/api\/public\/showcase/);
  assert.match(portfolioJs, /s\.slot === 'portfolio'/);
  assert.match(portfolioJs, /loadShowcaseItems/);
});

// ===========================================================================
// 7. Regresi — fitur lama tidak boleh rusak
// ===========================================================================

test('D-293: D-290 (hapus lipsync) tetap berlaku', () => {
  assert.doesNotMatch(studio, /lipsync/i);
  assert.doesNotMatch(html, /st-lip|st-lipsync|stLipsync|stLipFlow|stSceneHint|stLipScript/i);
  assert.doesNotMatch(app, /api\/ai\/lipsync/);
});

test('D-293: D-291/D-292 (panel Pengaturan) tetap berlaku', () => {
  assert.match(html, /\.st-pop-settings\{[^}]*position:fixed/);
  assert.match(html, /\.st-pop-settings\{[^}]*bottom:0/);
  assert.match(studio, /function syncComposerHeightVar\(\)/);
});
