// D-257 — Deteksi dimensi aset dari header file (server-side fallback).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectDimensions } from '../server/media-dimensions.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BRAND = path.join(ROOT, 'public/assets/brand');

test('D-257: deteksi dimensi MP4 (ISO-BMFF) dari header tkhd', () => {
  const f = path.join(BRAND, 'sherly-logo.mp4');
  assert.ok(fs.existsSync(f), 'fixture video MP4 harus ada');
  const dim = detectDimensions(fs.readFileSync(f), 'video/mp4');
  assert.ok(dim, 'dimensi MP4 harus terdeteksi');
  assert.ok(dim.width > 0 && dim.height > 0, 'dimensi harus positif');
  // Logo brand = video vertikal (780x1560).
  assert.equal(dim.width, 780, 'lebar MP4 harus 780');
  assert.equal(dim.height, 1560, 'tinggi MP4 harus 1560');
});

test('D-257: deteksi dimensi WebM (EBML) dari PixelWidth/PixelHeight', () => {
  const h = path.join(BRAND, 'fixture-horizontal.webm');
  const v = path.join(BRAND, 'fixture-vertical.webm');
  assert.ok(fs.existsSync(h) && fs.existsSync(v), 'fixture WebM harus ada');
  const hd = detectDimensions(fs.readFileSync(h), 'video/webm');
  const vd = detectDimensions(fs.readFileSync(v), 'video/webm');
  assert.deepEqual(hd, { width: 1280, height: 720 }, 'video horizontal harus 1280x720');
  assert.deepEqual(vd, { width: 720, height: 1280 }, 'video vertikal harus 720x1280');
});

test('D-257: deteksi dimensi PNG dari header IHDR', () => {
  const f = path.join(BRAND, 'sherly-logo-poster.png');
  const dim = detectDimensions(fs.readFileSync(f), 'image/png');
  assert.deepEqual(dim, { width: 390, height: 780 });
});

test('D-257: file tidak dikenal / rusak tidak melempar error', () => {
  assert.equal(detectDimensions(null, 'video/mp4'), null);
  assert.equal(detectDimensions(Buffer.alloc(0), 'image/png'), null);
  assert.equal(detectDimensions(Buffer.from('bukan file gambar sama sekali'), 'image/png'), null);
  assert.equal(detectDimensions(Buffer.from('bukan video'), 'video/mp4'), null);
});
