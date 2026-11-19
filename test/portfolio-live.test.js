// D-157: Cloud Publish → Portfolio & pengingat (public/portfolio-live.js, helper murni di globalThis).
import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/portfolio-live.js';

const { postToPortfolioItem, gcalEventUrl } = globalThis.PORTFOLIO_LIVE;

test('postToPortfolioItem: kategori dipetakan ke tipe portfolio + kolom live', () => {
  const foto = postToPortfolioItem({ id: 'i1', title: 'Kopi senja', caption: 'cap', category: 'foto', publish_at: '2026-11-01T03:00:00.000Z', created_at: '2026-10-30T00:00:00Z', viewCount: 12, publicUrl: 'https://x/pub/u/a.jpg' });
  assert.equal(foto.type, 'photo');
  assert.equal(foto.img, 'https://x/pub/u/a.jpg');
  assert.equal(foto.desc, 'cap');
  assert.equal(foto.viewCount, 12);
  assert.equal(foto.live, true);
  assert.deepEqual(foto.tags, ['Foto', 'Live']);
  assert.ok(foto.date.length > 3); // tanggal terformat (id-ID)

  const reels = postToPortfolioItem({ id: 'i2', title: 'T', category: 'reels', created_at: '2026-11-02T00:00:00Z' });
  assert.equal(reels.type, 'video');
  assert.equal(reels.video, '');

  const artikel = postToPortfolioItem({ id: 'i3', title: 'Naskah', category: 'artikel', caption: 'ringkas', body: 'isi panjang', created_at: '2026-11-03T00:00:00Z' });
  assert.equal(artikel.type, 'copy');
  assert.equal(artikel.headline, 'Naskah');
  assert.equal(artikel.copy, 'isi panjang');
});

test('postToPortfolioItem: input aman — kategori tak dikenal jatuh ke foto, null ditolak', () => {
  const weird = postToPortfolioItem({ id: 'i4', title: 'X', category: 'viral' });
  assert.equal(weird.type, 'photo');
  assert.equal(postToPortfolioItem(null), null);
  const kosong = postToPortfolioItem({ category: 'foto', created_at: 'bukan-tanggal' });
  assert.equal(kosong.date, '');
  assert.equal(kosong.title, 'Karya');
  assert.equal(kosong.viewCount, 0);
  assert.equal(postToPortfolioItem({ id: 'i5', title: 'Y', category: 'artikel', caption: 'c', body: null }).copy, 'c');
});

test('gcalEventUrl: format template Google Calendar (UTC dasar, durasi 1 jam)', () => {
  const url = gcalEventUrl('Reels skincare', '2026-12-01T10:00:00.000Z', 'posting manual');
  assert.ok(url.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE'));
  assert.ok(url.includes('&text=' + encodeURIComponent('Reels skincare \u2014 tayang')));
  assert.ok(url.includes('&dates=20261201T100000Z/20261201T110000Z'));
  assert.ok(url.includes('&details=' + encodeURIComponent('posting manual')));
  // tanpa details → param tidak dikirim
  const tanpa = gcalEventUrl('X', '2026-12-01T10:00:00.000Z', '');
  assert.ok(!tanpa.includes('&details='));
});

test('gcalEventUrl: input tidak valid → string kosong (tidak crash)', () => {
  assert.equal(gcalEventUrl('', '2026-12-01T10:00:00Z', 'd'), '');
  assert.equal(gcalEventUrl('T', '', 'd'), '');
  assert.equal(gcalEventUrl('T', 'bukan-tanggal', 'd'), '');
  assert.equal(gcalEventUrl('T', null, 'd'), '');
});
