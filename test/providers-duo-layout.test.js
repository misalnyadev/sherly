// D-282 · Halaman Pengaturan (Admin) → Provider & API Key:
//   - "Provider Kustom — Generator Studio" & "Bank Suara Sherly" jadi 2 KOLOM
//     kiri-kanan (bukan bertumpuk satu di bawah yang lain)
//   - font di kedua panel dikecilkan & disamakan dengan form pengaturan lain
//     (label 11px, teks 11px, isi input 12px) — jangan besar-besar
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('public/index.html', 'utf8');

/** Ambil isi aturan CSS satu blok (selector + { ... }), multi-line aman.
 *  Mendukung selector yang diakhiri koma (daftar selector baris baru). */
const rule = (selector) => {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = html.match(new RegExp(`${esc}\\s*,?[\\s\\S]{0,120}?\\{([\\s\\S]*?)\\}`));
  return m ? m[1] : '';
};

test('D-282: dua panel Provider Kustom & Bank Suara dibungkus wrapper 2 kolom', () => {
  assert.ok(html.includes('class="providers-duo"'), 'harus ada wrapper .providers-duo');
  // Kedua panel harus berada DI DALAM wrapper itu.
  const duoStart = html.indexOf('class="providers-duo"');
  const duoEnd = html.indexOf('/.providers-duo -->');
  assert.ok(duoStart !== -1 && duoEnd !== -1, 'wrapper harus ada opening & closing marker');
  const inner = html.slice(duoStart, duoEnd);
  assert.ok(inner.includes('id="customProvidersPanel"'), 'customProvidersPanel harus di dalam duo');
  assert.ok(inner.includes('id="bankSuaraPanel"'), 'bankSuaraPanel harus di dalam duo');
  // Urutan: kiri = Provider Kustom, kanan = Bank Suara.
  assert.ok(
    inner.indexOf('id="customProvidersPanel"') < inner.indexOf('id="bankSuaraPanel"'),
    'Provider Kustom harus kolom kiri, Bank Suara kolom kanan',
  );
});

test('D-282: wrapper memakai grid 2 kolom + fallback 1 kolom di layar kecil', () => {
  const r = rule('.providers-duo');
  assert.ok(r.includes('display:grid'), 'harus pakai grid');
  assert.ok(r.includes('grid-template-columns:1fr 1fr'), 'harus 2 kolom sama rata');
  assert.ok(r.includes('gap:'), 'harus ada jarak antar kolom');
  assert.ok(r.includes('align-items:start'), 'panel tidak ikut meninggi (align-items:start)');
  // Panel di dalam kolom boleh menyusut (jangan melebar keluar grid).
  const panel = rule('.providers-duo > .panel');
  assert.ok(panel.includes('min-width:0'), 'panel perlu min-width:0 agar tidak melebar');
  // Di HP/tablet columns jadi 1 kolom.
  assert.ok(
    html.includes('@media(max-width:900px){.providers-duo{grid-template-columns:1fr}}'),
    'di bawah 900px harus jadi 1 kolom',
  );
});

test('D-282: font panel duo dikecilkan & disamakan dengan form pengaturan lain', () => {
  // Judul panel: 15px (bawaan) -> 13.5px
  const h2 = rule('.providers-duo .section-head h2');
  assert.ok(h2.includes('font-size:13.5px'), `h2 harus 13.5px, dapat: ${h2}`);

  // Deskripsi/teks: 12px (inline style) -> 11px, sama seperti .form-field small.
  const p = rule('.providers-duo p');
  assert.ok(p.includes('font-size:11px'), `teks harus 11px, dapat: ${p}`);

  // Label form: 11px (sama dengan .form-field label bawaan).
  const label = rule('.providers-duo .form-field label');
  assert.ok(label.includes('font-size:11px'), `label harus 11px, dapat: ${label}`);

  // Isi input: 12px + padding lebih kecil supaya compact.
  const input = rule('.providers-duo .form-field input');
  assert.ok(input.includes('font-size:12px'), `input harus 12px, dapat: ${input}`);
  assert.ok(input.includes('padding:8px'), `input harus padding compact, dapat: ${input}`);

  // Teks kecil: 10px (sama seperti .form-field small bawaan).
  const small = rule('.providers-duo .form-field small');
  assert.ok(small.includes('font-size:10px'), `small harus 10px, dapat: ${small}`);

  // Bank Suara: judul sub, counter, dan baris upload ikut compact.
  const bhead = rule('.providers-duo .bank-upload-head h3');
  assert.ok(bhead.includes('font-size:12px'), `bank-upload h3 harus 12px, dapat: ${bhead}`);
  const bnote = rule('.providers-duo .bank-upload-head span');
  assert.ok(bnote.includes('font-size:10px'), `bank-upload span harus 10px, dapat: ${bnote}`);
  const bstat = rule('.providers-duo .bank-stat b');
  assert.ok(bstat.includes('font-size:16px'), `angka stat harus 16px, dapat: ${bstat}`);
  const bstatspan = rule('.providers-duo .bank-stat span');
  assert.ok(bstatspan.includes('font-size:10px'), `label stat harus 10px, dapat: ${bstatspan}`);
});

test('D-282: ikon di judul panel duo ikut dikecilkan', () => {
  const r = rule('.providers-duo .section-head h2 [data-icon] svg');
  assert.ok(r.includes('width:14px'), `ikon harus 14px, dapat: ${r}`);
  assert.ok(r.includes('height:14px'), `ikon harus 14px, dapat: ${r}`);
});

test('D-282: jarak antar blok di dalam panel tetap jelas (D-272/D-273 tidak hilang)', () => {
  // D-272/D-273: user minta jarak antar blok panel jelas (22px). D-282 TIDAK
  // boleh memangkas jarak itu — kompresi dilakukan lewat font + padding saja.
  assert.ok(
    html.includes('#bankSuaraPanel > * + *{margin-top:22px}'),
    'jarak antar blok Bank Suara harus tetap 22px',
  );
  assert.ok(
    html.includes('#customProvidersPanel > * + *,'),
    'jarak antar blok Provider Kustom harus ikut 22px',
  );
  assert.ok(
    !html.includes('#bankSuaraPanel > * + *{margin-top:14px}'),
    'aturan jarak kecil (14px) tidak boleh ada — D-273/+272',
  );
  // Area upload tetap dipisah dari blok sebelumnya.
  assert.ok(
    html.includes('#bankSuaraPanel .bank-upload{margin-top:22px'),
    'area upload harus tetap dipisah',
  );
});

test('D-282: aturan lama yang bentrok dengan 2 kolom dibersihkan', () => {
  // .pl-name tidak pernah dipakai — jangan pakai selector hantu.
  assert.ok(!html.includes('.providers-duo .pl-item .pl-name'), 'selector .pl-name tidak ada di DOM');
  // .providers-duo tidak boleh menimpa spacing antar panel jadi 0.
  const duoPanel = rule('.providers-duo > .panel');
  assert.ok(!duoPanel.includes('margin-top:0'), 'margin-top:0 akan Manzan Panel ke atas');
});
