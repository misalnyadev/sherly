// ===== D-293: Beranda menampilkan karya asli user =====
//
// Section "Portfolio"  -> aset yang user "pindahkan ke Portfolio" di Studio
// Section "KONTEN TERBARU" (horizontal) -> aset yang user pilih jadi konten publik
//
// Data diambil dari /api/public/showcase (view publik showcase_items_public),
// jadi halaman Beranda bisa menampilkan karya user TANPA login.
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function icon(name) {
    const el = document.createElement('span');
    el.setAttribute('data-icon', name);
    return el;
  }

  // Cache agar tidak fetch berulang tiap kali user pindah halaman.
  let cache = null;
  let loading = false;

  function isLandscape(a) {
    const w = Number(a && a.width) || 0;
    const h = Number(a && a.height) || 0;
    if (w > 0 && h > 0) return w > h;
    return (a && a.mediaType) === 'video';
  }

  /** Kartu portfolio (gaya "asset" ala section Produksi lama). */
  function portfolioCard(a) {
    const url = a.publicUrl || a.signedUrl || '';
    if (!url) return '';
    const media = a.mediaType === 'video'
      ? '<video src="' + esc(url) + '#t=0.1" muted loop preload="metadata" playsinline></video>'
      : '<img src="' + esc(url) + '" alt="' + esc(a.title || 'Portfolio') + '" loading="lazy">';
    const label = a.mediaType === 'video' ? 'Video' : 'Foto';
    return '<article class="asset" data-sc-asset="' + esc(a.id) + '">'
      + media
      + '<div><b>' + esc(a.title || 'Portfolio') + '</b><small>' + label + '</small></div>'
      + '</article>';
  }

  /** Kartu konten publik (gaya "media-card" horizontal). */
  function publicCard(a) {
    const url = a.publicUrl || a.signedUrl || '';
    if (!url) return '';
    const media = a.mediaType === 'video'
      ? '<video src="' + esc(url) + '#t=0.1" muted loop preload="metadata" playsinline></video>'
      : '<img src="' + esc(url) + '" alt="' + esc(a.title || 'Konten') + '" loading="lazy">';
    return '<article class="media-card" data-sc-asset="' + esc(a.id) + '">'
      + media
      + '<span class="tag">Konten</span>'
      + '<div class="card-meta"><b>' + esc(a.title || 'Konten') + '</b><small>'
      + (a.caption ? esc(a.caption).slice(0, 60) : 'Konten publik') + '</small></div>'
      + (a.mediaType === 'video' ? '<span class="play-btn" data-icon="play"></span>' : '')
      + '</article>';
  }

  function renderPortfolio(items) {
    const box = $('homePortfolio');
    if (!box) return;
    const list = items.filter((i) => i.slot === 'portfolio');
    if (!list.length) {
      box.innerHTML = '<div class="empty-state">Portfolio masih kosong — buka Studio, pilih aset, lalu tekan "Pindahkan ke Portfolio".</div>';
      return;
    }
    box.innerHTML = list.slice(0, 6).map(portfolioCard).join('');
  }

  function renderLatest(items) {
    // "Konten Terbaru" baris VERTIKAL = konten publik yang berorientasi potret.
    const row = $('homeLatestRow');
    if (row) {
      const vert = items.filter((i) => i.slot === 'public' && !isLandscape(i));
      row.innerHTML = vert.length
        ? vert.slice(0, 8).map(publicCard).join('')
        : '<div class="empty-state">Belum ada konten publik — pilih aset di Studio lalu tekan "Jadikan Konten Publik".</div>';
    }
    // Baris HORIZONTAL = konten publik yang berorientasi landscape.
    const hrow = $('homePublicRow');
    if (hrow) {
      const horz = items.filter((i) => i.slot === 'public' && isLandscape(i));
      hrow.innerHTML = horz.length
        ? horz.slice(0, 8).map(publicCard).join('')
        : '<div class="empty-state">Belum ada konten publik horizontal — pilih aset horizontal di Studio lalu tekan "Jadikan Konten Publik".</div>';
    }
  }

  async function loadShowcase(force) {
    if (loading) return cache;
    if (cache && !force) return cache;
    loading = true;
    try {
      const res = await fetch('/api/public/showcase', { headers: { Accept: 'application/json' } });
      const d = await res.json().catch(() => ({}));
      const items = res.ok && Array.isArray(d.items) ? d.items : [];
      cache = items;
      renderPortfolio(items);
      renderLatest(items);
      return items;
    } catch {
      renderPortfolio([]);
      renderLatest([]);
      return [];
    } finally {
      loading = false;
    }
  }

  // Dipakai halaman Beranda (go('Beranda')) & saat load pertama.
  window.sherlyLoadHomeShowcase = function (force) { return loadShowcase(force === true); };

  // Muat sekali halaman siap.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { loadShowcase(false); });
  } else {
    loadShowcase(false);
  }
})();
