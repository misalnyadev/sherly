// D-207: modul admin Bank Prompt (public/prompt-bank.js) — render daftar, filter, form.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const script = fs.readFileSync(new URL('../public/prompt-bank.js', import.meta.url), 'utf8');

const BANK = {
  ok: true,
  entries: [
    { id: 't1', kind: 'template', label: 'Try Outfit', category: 'umum', content: 'full-body shot { outfit }', slots: ['outfit'], is_active: true },
    { id: 'b1', kind: 'block', label: 'Drone View', category: 'kamera', content: 'aerial drone shot', slots: [], is_active: true },
    { id: 'b2', kind: 'block', label: 'Nonaktif', category: 'gaya', content: 'x', slots: [], is_active: false },
  ],
};

function build() {
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/' });
  const win = dom.window;
  win.fetch = async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(BANK)) });
  win.sherlyGetAccessToken = async () => 'test-token';
  win.sherlyStoredToken = () => null;
  const doc = win.document;
  const el = doc.createElement('script');
  el.textContent = script;
  doc.body.appendChild(el);
  doc.dispatchEvent(new win.Event('DOMContentLoaded'));
  return { win, doc };
}

test('D-207: panel admin Bank Prompt ada di Pengaturan', () => {
  assert.ok(html.includes('id="settingsPromptBankPane"'), 'pane Bank Prompt tidak ada');
  assert.ok(html.includes('data-settings-tab="promptbank"'), 'tab Bank Prompt tidak ada');
  for (const id of ['pbAddBtn', 'pbRefreshBtn', 'pbList', 'pbFormPanel', 'pbKind', 'pbCategory', 'pbLabel', 'pbSlots', 'pbContent', 'pbSaveBtn']) {
    assert.ok(html.includes('id="' + id + '"'), 'elemen admin #' + id + ' tidak ada');
  }
  assert.ok(html.includes('<script src="/prompt-bank.js"></script>'), 'script prompt-bank.js belum dimuat');
});

test('D-207: daftar entri admin ter-render lengkap', async () => {
  const { win, doc } = build();
  await win.loadPromptBankAdmin();
  await new Promise((r) => setTimeout(r, 30));
  const rows = doc.querySelectorAll('#pbList .pb-row');
  assert.equal(rows.length, 3, 'jumlah baris tidak sesuai');
  const first = rows[0];
  assert.equal(first.querySelector('b').textContent, 'Try Outfit');
  const tags = [...first.querySelectorAll('.pb-tag')].map((t) => t.textContent);
  assert.ok(tags.includes('Template'), 'tag Template hilang');
  assert.ok(tags.includes('isi: outfit'), 'tag placeholder hilang');
  // Entri nonaktif ditandai.
  const off = [...rows].find((r) => r.querySelector('b').textContent === 'Nonaktif');
  assert.ok([...off.querySelectorAll('.pb-tag')].some((t) => t.textContent === 'nonaktif'), 'entri nonaktif tidak ditandai');
});

test('D-207: filter Template/Blok bekerja', async () => {
  const { win, doc } = build();
  await win.loadPromptBankAdmin();
  await new Promise((r) => setTimeout(r, 30));
  const filter = (kind) => {
    [...doc.querySelectorAll('.pb-filter')].find((f) => f.dataset.pbFilter === kind)
      .dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  };
  filter('template');
  assert.equal(doc.querySelectorAll('#pbList .pb-row').length, 1, 'filter template salah');
  filter('block');
  assert.equal(doc.querySelectorAll('#pbList .pb-row').length, 2, 'filter block salah');
  filter('all');
  assert.equal(doc.querySelectorAll('#pbList .pb-row').length, 3, 'filter all salah');
});

test('D-207: form tambah entri terbuka & mendeteksi placeholder', async () => {
  const { win, doc } = build();
  await win.loadPromptBankAdmin();
  await new Promise((r) => setTimeout(r, 30));
  doc.getElementById('pbAddBtn').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  assert.equal(doc.getElementById('pbFormPanel').hidden, false, 'form tidak terbuka');
  assert.equal(doc.getElementById('pbFormTitle').textContent, 'Tambah Entri');
  // Kategori terisi dari daftar kategori.
  const cats = [...doc.getElementById('pbCategory').options].map((o) => o.value);
  for (const k of ['kamera', 'cahaya', 'negative']) assert.ok(cats.includes(k), 'kategori ' + k + ' hilang');
  // Deteksi placeholder otomatis.
  const ta = doc.getElementById('pbContent');
  ta.value = 'try outfit { outfit } on model { background }';
  ta.dispatchEvent(new win.Event('input', { bubbles: true }));
  const hint = doc.getElementById('pbSlotHint').textContent;
  assert.ok(/outfit/.test(hint), 'placeholder outfit tidak terdeteksi');
  assert.ok(/background/.test(hint), 'placeholder background tidak terdeteksi');
});

test('D-207: form ubah entri mengisi nilai lama', async () => {
  const { win, doc } = build();
  await win.loadPromptBankAdmin();
  await new Promise((r) => setTimeout(r, 30));
  const editBtn = doc.querySelector('[data-pb-edit="t1"]');
  assert.ok(editBtn, 'tombol ubah tidak ada');
  editBtn.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  assert.equal(doc.getElementById('pbFormTitle').textContent, 'Ubah Entri');
  assert.equal(doc.getElementById('pbLabel').value, 'Try Outfit');
  assert.equal(doc.getElementById('pbKind').value, 'template');
  assert.equal(doc.getElementById('pbSlots').value, 'outfit');
});
