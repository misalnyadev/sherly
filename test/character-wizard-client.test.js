// D-110: tes regresi wizard sisi KLIEN (DOM-stub minimal).
// Akar bug D-110: sherlyWizardCollect/saveDraft meng-iterate TRAIT_FIELDS (pasangan
// [kunci, label]) seolah string kunci -> traits[pasangan] = undefined -> hanya
// gender+height (TRAIT_EXTRA, string) yang tersimpan -> "kurang: Detail fisik"
// di setiap simpan, padahal grid menampilkan 17 detail hasil analisis foto.
// Tes ini membuktikan: buka mode edit dengan traits lengkap -> collect() membawa SEMUA kunci.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const els = {};
function mkEl(id) {
  return {
    id, tagName: 'INPUT', value: '', hidden: false, disabled: false, files: null, textContent: '', _html: '',
    focus() {}, classList: { toggle() {}, add() {}, remove() {} },
    addEventListener() {}, querySelectorAll() { return []; }, querySelector() { return null; }, dataset: {},
    insertAdjacentHTML(_p, h) { this._html += h; }, removeAttribute() {},
    set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; },
  };
}
global.document = {
  getElementById: (id) => (els[id] = els[id] || mkEl(id)),
  querySelectorAll: () => [],
  createElement: () => mkEl('tmp'),
};
global.window = global;
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
Object.defineProperty(global, 'navigator', { value: { clipboard: { writeText: async () => {} } }, configurable: true });
global.Image = class { set src(_v) { setTimeout(() => this.onload && this.onload(), 0); } };
global.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
global.toast = () => {};
global.fetch = async () => ({ ok: true, json: async () => ({ providers: [] }) });

await import('../public/character-wizard.js');

test('wizard edit: collect membawa SEMUA traits — regresi D-110 (17 field + gender/height)', () => {
  const saved = {
    faceShape: 'oval', skin: 'sawo matang', eyes: 'cokelat', eyeDetail: 'almond', eyebrows: 'lengkung',
    nose: 'mancung', lips: 'natural', lipDetail: 'lembab', hair: 'hitam panjang', hairDetail: 'berlayer',
    hijab: 'tidak ada', bodyType: 'langsing', mark: 'tahi lalat pipi', outfit: 'casual', style: 'natural',
    accessories: 'anting kecil', skinTexture: 'pori terlihat', gender: 'Perempuan', height: '166 cm',
  };
  window.sherlyWizardOpen({ id: 'char-1', name: 'Novi', traits: saved, bible: 'B.' });
  const out = window.sherlyWizardCollect();
  const keys = Object.keys(out.traits);
  assert.equal(keys.length, 19, 'semua 19 kunci traits harus terkirim, actual: ' + keys.join(','));
  assert.equal(out.traits.hair, 'hitam panjang');
  assert.equal(out.traits.faceShape, 'oval');
  assert.equal(out.traits.gender, 'Perempuan');
  assert.match(out.appearance, /Perempuan/);
  assert.match(out.appearance, /hitam panjang/);
});

test('wizard baru: collect tanpa traits -> kosong, tidak meledak', () => {
  window.sherlyWizardOpen({});
  const out = window.sherlyWizardCollect();
  assert.deepEqual(Object.keys(out.traits), []);
  assert.equal(out.appearance, '');
});
