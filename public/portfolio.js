// Portfolio — grid karya (foto / video / copy) + tampilan detail.
// Sumber utama: feed live Cloud Publish (/api/public/posts, helper portfolio-live.js).
// Kalau feed live kosong/gagal → fallback demo statis portfolio-data.js. Dipanggil go('Portfolio') -> window.renderPortfolio().
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Ikon dirender manual karena kartu dibuat SETELAH loop injeksi [data-icon] di index.html berjalan.
  const icon = (key) => {
    const paths = (typeof ICONS !== 'undefined' && ICONS[key]) || '';
    return '<span data-icon="' + key + '">' + (paths ? '<svg viewBox="0 0 24 24" aria-hidden="true">' + paths + '</svg>' : '') + '</span>';
  };
  const TYPE_META = {
    photo: { label: 'Foto', icon: 'gallery' },
    video: { label: 'Video', icon: 'clapperboard' },
    copy: { label: 'Copy', icon: 'file' },
  };
  const FILTERS = [['all', 'Semua'], ['photo', 'Foto'], ['video', 'Video'], ['copy', 'Copy']];
  let filter = 'all';

  function tagsHTML(tags) {
    return (Array.isArray(tags) && tags.length)
      ? '<div class="pf-tags">' + tags.map((t) => '<span class="chip">' + esc(t) + '</span>').join('') + '</div>'
      : '';
  }

  function cardHTML(item) {
    const t = TYPE_META[item.type] || TYPE_META.photo;
    let cover;
    if (item.type === 'copy') {
      const first = String(item.copy || item.desc || '').split('\n').map((x) => x.trim()).filter(Boolean)[0] || '';
      cover = '<div class="pf-cover-copy"><b>\u201C' + esc(item.headline || item.title) + '\u201D</b><small>' + esc(first.slice(0, 90)) + '</small></div>';
    } else {
      cover = '<div class="pf-cover">'
        + (item.img ? '<img src="' + esc(item.img) + '" alt="' + esc(item.title) + '" loading="lazy">' : '')
        + '<span class="pf-badge ' + esc(item.type) + '">' + icon(t.icon) + esc(t.label) + '</span>'
        + (item.type === 'video' ? '<span class="pf-play">' + icon('play') + '</span>' : '')
        + '</div>';
    }
    const meta = [item.client, item.date].filter(Boolean).map(esc).join(' \u00b7 ');
    return '<button type="button" class="pf-card" data-id="' + esc(item.id) + '">'
      + cover
      + '<div class="pf-info"><h3>' + esc(item.title) + '</h3>'
      + (meta ? '<div class="pf-meta"><span>' + meta + '</span></div>' : '')
      + tagsHTML(item.tags)
      + '</div></button>';
  }

  function closeDetail() { $('pfDetail')?.classList.remove('open'); }

  function openDetail(id) {
    const item = currentItems().find((i) => String(i.id) === String(id));
    const wrap = $('pfDetail'), card = $('pfDetailCard');
    if (!item || !wrap || !card) return;
    const t = TYPE_META[item.type] || TYPE_META.photo;
    let media = '';
    if (item.type === 'video') {
      media = item.video
        ? '<video src="' + esc(item.video) + '" controls playsinline preload="metadata"' + (item.img ? ' poster="' + esc(item.img) + '"' : '') + '></video>'
        : (item.img ? '<img src="' + esc(item.img) + '" alt="' + esc(item.title) + '">' : '');
    } else if (item.img) {
      media = '<img src="' + esc(item.img) + '" alt="' + esc(item.title) + '">';
    }
    const body = item.type === 'copy' ? (item.copy || item.desc || '') : (item.desc || '');
    const sub = [t.label, item.client, item.date, (item.live && item.viewCount ? item.viewCount.toLocaleString('id-ID') + '\u00d7 dilihat' : '')].filter(Boolean).map(esc).join(' \u00b7 ');
    card.innerHTML = '<button type="button" class="pf-detail-close" id="pfDetailClose" aria-label="Tutup detail">' + icon('x') + '</button>'
      + (media ? '<div class="pf-detail-media">' + media + '</div>' : '')
      + '<div class="pf-detail-body">'
      + '<h2>' + esc(item.title) + '</h2>'
      + '<p class="pf-detail-sub">' + sub + '</p>'
      + (body ? '<div class="pf-detail-desc">' + esc(body) + '</div>' : '')
      + (item.type === 'video' && !item.video ? '<p class="pf-detail-note">' + (item.live ? 'Reels \u2014 versi videonya menyusul; yang tayang saat ini cover/teaser.' : 'Slot video \u2014 isi field <code>video</code> di portfolio-data.js dengan file/URL video.') + '</p>' : '')
      + tagsHTML(item.tags)
      + '</div>';
    wrap.classList.add('open');
    card.scrollTop = 0;
    $('pfDetailClose')?.addEventListener('click', closeDetail);
  }

  // Feed live Cloud Publish: null = belum termuat (coba lagi nanti), [] = kosong/gagal → fallback demo.
  let liveItems = null;
  let fetching = false;
  // D-293: showcase — aset yang user "pindahkan ke Portfolio" dari Studio.
  let showcaseItems = null;
  /**
   * Aset showcase -> item Portfolio (type photo / video).
   */
  function showcaseToItem(s) {
    if (!s || !s.publicUrl) return null;
    const isVideo = s.mediaType === 'video';
    const d = new Date(s.createdAt || '');
    const date = isNaN(d) ? '' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    return {
      id: 'sc-' + String(s.id),
      type: isVideo ? 'video' : 'photo',
      title: String(s.title || 'Portfolio'),
      client: '',
      date,
      tags: ['Portfolio'],
      img: s.publicUrl,
      desc: String(s.caption || ''),
      headline: String(s.title || ''),
      copy: '',
      video: '',
      viewCount: 0,
      live: false,
      showcase: true,
    };
  }
  function currentItems() {
    const base = (liveItems && liveItems.length) ? liveItems : (window.PORTFOLIO_ITEMS || []);
    // Item showcase (slot 'portfolio') digabung di depan — karya user sendiri.
    if (showcaseItems && showcaseItems.length) return showcaseItems.concat(base);
    return base;
  }
  async function loadShowcaseItems() {
    if (showcaseItems !== null) return;
    try {
      const res = await fetch('/api/public/showcase');
      const d = await res.json().catch(() => ({}));
      const list = res.ok && Array.isArray(d.items) ? d.items : [];
      showcaseItems = list.filter((s) => s.slot === 'portfolio').map(showcaseToItem).filter(Boolean);
    } catch { showcaseItems = []; }
  }
  async function loadLiveItems() {
    if (liveItems !== null || fetching) return;
    fetching = true;
    try {
      const res = await fetch('/api/public/posts');
      const d = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(d.posts)) {
        const toItem = window.PORTFOLIO_LIVE && window.PORTFOLIO_LIVE.postToPortfolioItem;
        liveItems = toItem ? d.posts.map((p) => window.PORTFOLIO_LIVE.postToPortfolioItem(p)).filter(Boolean) : [];
      }
    } catch {}
    fetching = false;
  }

  window.renderPortfolio = async function renderPortfolio() {
    const grid = $('pfGrid'), fWrap = $('pfFilters');
    if (!grid || !fWrap) return;
    await Promise.all([loadLiveItems(), loadShowcaseItems()]);
    const source = currentItems();
    const live = source !== (window.PORTFOLIO_ITEMS || []);
    const items = source.filter((i) => filter === 'all' || i.type === filter);
    const fl = (FILTERS.find(([k]) => k === filter) || ['', 'kategori ini'])[1];
    grid.innerHTML = items.length
      ? items.map(cardHTML).join('')
      : '<div class="empty-state">' + (live ? 'Belum ada karya ' + fl.toLowerCase() + ' yang tayang \u2014 publikasikan lewat Cloud Publish.' : 'Belum ada karya di kategori ini \u2014 tambahkan di portfolio-data.js.') + '</div>';
    grid.querySelectorAll('.pf-card').forEach((b) => b.addEventListener('click', () => openDetail(b.dataset.id)));
    fWrap.innerHTML = FILTERS.map(([k, l]) => '<button type="button" class="pf-filter' + (k === filter ? ' active' : '') + '" data-filter="' + k + '">' + esc(l) + '</button>').join('');
    fWrap.querySelectorAll('.pf-filter').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.filter; renderPortfolio(); }));
  };

  $('pfDetail')?.addEventListener('click', (e) => { if (e.target === $('pfDetail')) closeDetail(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetail(); });
})();
