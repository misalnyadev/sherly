// Cloud Publish → Portfolio & pengingat (D-157).
// Helper murni tanpa DOM — dipakai portfolio.js (window.PORTFOLIO_LIVE) dan
// publish.js (tombol Ingatkan), sekaligus dites unit di Node via globalThis.
(function () {
  'use strict';

  // Post feed publik (/api/public/posts) → item Portfolio (portfolio.js).
  // Kategori: foto→photo, reels→video (cover), artikel→copy.
  function postToPortfolioItem(p) {
    if (!p || typeof p !== 'object') return null;
    const cat = ['foto', 'reels', 'artikel'].includes(p.category) ? p.category : 'foto';
    const type = cat === 'reels' ? 'video' : cat === 'artikel' ? 'copy' : 'photo';
    const d = new Date(p.publish_at || p.created_at);
    const date = isNaN(d) ? '' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    const label = { foto: 'Foto', reels: 'Reels', artikel: 'Artikel' }[cat];
    return {
      id: String(p.id || ''),
      type,
      title: String(p.title || 'Karya'),
      client: '',
      date,
      tags: [label, 'Live'],
      img: String(p.publicUrl || ''),
      desc: String(p.caption || ''),
      headline: String(p.title || ''),
      copy: String(p.body || p.caption || ''),
      video: '',
      viewCount: Number(p.viewCount) || 0,
      live: true,
    };
  }

  // URL template Google Calendar — pengingat jadwal tayang (pengganti auto-post IG).
  // Durasi 1 jam; format tanggal UTC dasar YYYYMMDDTHHMMSSZ.
  function gcalUtc(d) {
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }
  function gcalEventUrl(title, startIso, details) {
    const start = new Date(startIso);
    if (!title || !startIso || isNaN(start)) return '';
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    let url = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
      + '&text=' + encodeURIComponent(title + ' \u2014 tayang')
      + '&dates=' + gcalUtc(start) + '/' + gcalUtc(end);
    if (details) url += '&details=' + encodeURIComponent(details);
    return url;
  }

  const g = typeof window !== 'undefined' ? window : globalThis;
  g.PORTFOLIO_LIVE = { postToPortfolioItem, gcalEventUrl };
})();
