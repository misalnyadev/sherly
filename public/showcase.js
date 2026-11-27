// ===== D-293 / D-294: Beranda menampilkan karya asli user =====
//
// Section "Portfolio"  -> aset yang user "pindahkan ke Portfolio" di Studio
// Section "KONTEN TERBARU" (horizontal) -> aset yang user pilih jadi konten publik
//
// Data diambil dari /api/public/showcase (view publik showcase_items_public),
// jadi halaman Beranda bisa menampilkan karya user TANPA login.
//
// D-294: tampilan kartu diperbaiki —
//   - Portfolio & Konten sama-sama pakai kartu BESAR (.sc-card, 9:16 / 16:10),
//     bukan kartu kecil ".asset" (tinggi 112px) seperti versi pertama D-293,
//   - thumbnail VIDEO tidak lagi kotak kosong (preload metadata + placeholder),
//   - AUTOPLAY saat kursor di atas kartu (PC) / ketuk (HP),
//   - KLIK kartu -> lightbox ukuran asli.
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function svg(path, extra) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" ' + (extra || '') + '>' + path + '</svg>';
  }

  // Ikon garis (dipakai inline supaya tidak bergantung injeksi [data-icon]).
  const ICON = {
    play: '<path d="M8 5v14l11-7z"/>',
    film: '<path d="M4 4h16v16H4z"/><path d="M4 9h16M4 15h16M9 4v16M15 4v16"/>',
    image: '<path d="M4 5h16v14H4z"/><path d="M4 15l4-4 4 4 3-3 5 5"/>',
    maximize: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  };

  // Cache agar tidak fetch berulang tiap kali user pindah halaman.
  let cache = null;
  let loading = false;

  function isLandscape(a) {
    const w = Number(a && a.width) || 0;
    const h = Number(a && a.height) || 0;
    if (w > 0 && h > 0) return w > h;
    return (a && a.mediaType) === 'video';
  }

  function mediaUrl(a) {
    return a.publicUrl || a.signedUrl || '';
  }

  /** Kartu showcase (besar, rasio natural seperti galeri Studio). */
  function cardHTML(a, tagLabel, ratio) {
    const url = mediaUrl(a);
    if (!url) return '';
    const isVideo = a.mediaType === 'video';
    // Thumbnail video: <video preload="auto"> supaya frame pertama benar-benar
    // ter-decode, lalu diubah jadi poster gambar (lihat watchThumb).
    const media = isVideo
      ? '<video src="' + esc(url) + '#t=0.1" muted loop playsinline preload="auto" data-sc-video="1"></video>'
        + '<span class="sc-fallback" data-sc-fallback="1">' + svg(ICON.film) + '</span>'
      : '<img src="' + esc(url) + '" alt="' + esc(a.title || 'Karya') + '" loading="lazy" data-sc-img="1">'
        + '<span class="sc-fallback" data-sc-fallback="1">' + svg(ICON.image) + '</span>';
    const label = isVideo ? 'Video' : 'Foto';
    const meta = a.caption ? a.caption : label;
    const r = Number(ratio) > 0 ? Number(ratio) : 9 / 16;
    const style = ' style="aspect-ratio:' + (Math.round(r * 1000) / 1000) + '"';
    return '<article class="sc-card"' + style + ' data-sc-asset="' + esc(a.id) + '" data-sc-url="' + esc(url) + '"'
      + ' data-sc-video="' + (isVideo ? '1' : '0') + '" data-sc-title="' + esc(a.title || 'Karya') + '"'
      + ' data-sc-caption="' + esc(a.caption || '') + '" data-sc-label="' + esc(label) + '"'
      + ' data-sc-size="' + esc((a.width && a.height) ? a.width + ' × ' + a.height + ' px' : '') + '"'
      + ' tabindex="0" role="button" aria-label="Lihat ' + esc(a.title || 'karya') + '">'
      + media
      + '<span class="sc-tag">' + esc(tagLabel) + '</span>'
      + (isVideo ? '<span class="sc-play">' + svg(ICON.play) + '</span>' : '')
      + '<div class="sc-meta"><b>' + esc(a.title || 'Karya') + '</b><small>' + esc(meta) + '</small></div>'
      + '</article>';
  }

  /**
   * Rasio aset (lebar/tinggi). Tanpa dimensi -> 9:16 (potret).
   * Dipakai untuk MEMISAHKAN baris potret & horizontal.
   */
  function assetRatio(a) {
    const w = Number(a && a.width) || 0;
    const h = Number(a && a.height) || 0;
    if (w > 0 && h > 0) return w / h;
    return 9 / 16;
  }

  function renderPortfolio(items) {
    const box = $('homePortfolio');
    if (!box) return;
    const list = items.filter((i) => i.slot === 'portfolio');
    if (!list.length) {
      box.innerHTML = '<div class="empty-state">Portfolio masih kosong — buka Studio, pilih aset, lalu tekan "Pindahkan ke Portfolio".</div>';
      return;
    }
    // D-294: Portfolio = karya pilihan user -> kartu BESAR & SERAGAM (9:16),
    // sama seperti kartu Konten. Aset landscape tetap di-crop (object-fit:cover)
    // supaya baris rapi — tidak campur tinggi.
    box.className = 'sc-row portfolio';
    box.innerHTML = list.slice(0, 10).map((a) => cardHTML(a, 'Portfolio', 9 / 16)).join('');
  }

  function renderLatest(items) {
    // "Konten Terbaru" baris VERTIKAL = konten publik yang berorientasi potret.
    const row = $('homeLatestRow');
    if (row) {
      const vert = items.filter((i) => i.slot === 'public' && !isLandscape(i));
      row.className = 'sc-row vertical';
      row.innerHTML = vert.length
        ? vert.slice(0, 10).map((a) => cardHTML(a, 'Konten', assetRatio(a))).join('')
        : '<div class="empty-state">Belum ada konten publik — pilih aset di Studio lalu tekan "Jadikan Konten Publik".</div>';
    }
    // Baris HORIZONTAL = konten publik yang berorientasi landscape.
    const hrow = $('homePublicRow');
    if (hrow) {
      const horz = items.filter((i) => i.slot === 'public' && isLandscape(i));
      hrow.className = 'sc-row horizontal';
      hrow.innerHTML = horz.length
        ? horz.slice(0, 10).map((a) => cardHTML(a, 'Konten', assetRatio(a))).join('')
        : '<div class="empty-state">Belum ada konten publik horizontal — pilih aset horizontal di Studio lalu tekan "Jadikan Konten Publik".</div>';
    }
  }

  // ===== D-294: AUTOPLAY hover + lightbox klik =====

  const isTouch = () => window.matchMedia('(hover: none)').matches;

  function playVideo(card) {
    const v = card && card.querySelector('video');
    if (!v) return;
    const p = v.play?.();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }
  function pauseVideo(card) {
    const v = card && card.querySelector('video');
    if (!v) return;
    try { v.pause(); } catch { /* ignore */ }
  }
  function pauseAllVideos(except) {
    document.querySelectorAll('.sc-card').forEach((c) => { if (c !== except) pauseVideo(c); });
  }

  /** Thumbnail siap -> sembunyikan placeholder. */
  function watchThumb(card) {
    const fb = card.querySelector('[data-sc-fallback]');
    const v = card.querySelector('video');
    const img = card.querySelector('img[data-sc-img]');
    if (img) {
      if (img.complete && img.naturalWidth > 0) hideFallback(fb);
      else img.addEventListener('load', () => hideFallback(fb), { once: true });
      img.addEventListener('error', () => showFallback(fb), { once: true });
    }
    if (v) {
      // Video: beberapa browser TIDAK menampilkan frame pertama walau
      // preload="auto" -> thumbnail jadi kotak gelap. Jadi kita ambil SATU
      // frame sendiri lewat canvas lalu jadikan gambar (poster) di BELAKANG
      // video. Kalau video gagal tampil, poster yang terlihat.
      const grabPoster = () => {
        try {
          if (!v.videoWidth || !v.videoHeight) return;
          const c = document.createElement('canvas');
          const scale = Math.min(1, 640 / v.videoWidth);
          c.width = Math.max(1, Math.round(v.videoWidth * scale));
          c.height = Math.max(1, Math.round(v.videoHeight * scale));
          const ctx = c.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(v, 0, 0, c.width, c.height);
          const poster = c.toDataURL('image/jpeg', 0.72);
          if (!poster || poster.length < 100) return;
          if (card.querySelector('[data-sc-poster]')) return;
          const pi = document.createElement('img');
          pi.src = poster;
          pi.alt = card.dataset.scTitle || 'Karya';
          pi.loading = 'lazy';
          pi.setAttribute('data-sc-poster', '1');
          // Poster DI BELAKANG video (z-index 0) — video tetap bisa di-hover.
          pi.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0';
          card.insertBefore(pi, v);
          v.style.position = 'absolute';
          v.style.inset = '0';
          v.style.zIndex = '1';
          hideFallback(fb);
        } catch { /* abaikan — video tetap diputar saat hover */ }
      };
      if (v.readyState >= 2) grabPoster();
      else v.addEventListener('loadeddata', grabPoster, { once: true });
      // Kalau video benar-benar gagal, poster/placeholder yang tampil.
      v.addEventListener('error', () => {
        const poster = card.querySelector('[data-sc-poster]');
        if (!poster) showFallback(fb);
      }, { once: true });
    }
  }
  function hidePlaceholder(fb) { if (fb) fb.style.display = 'none'; }
  function showPlaceholder(fb) { if (fb) fb.style.display = 'grid'; }
  function hideFallback(fb) { hidePlaceholder(fb); }
  function showFallback(fb) { showPlaceholder(fb); }

  /** Lightbox: klik kartu -> lihat ukuran asli. */
  function openLightbox(card) {
    const url = card.dataset.scUrl;
    if (!url) return;
    const isVideo = card.dataset.scVideo === '1';
    const title = card.dataset.scTitle || 'Karya';
    const caption = card.dataset.scCaption || '';
    const label = card.dataset.scLabel || 'Foto';
    const size = card.dataset.scSize || '';
    const media = isVideo
      ? '<video src="' + esc(url) + '" controls autoplay loop playsinline></video>'
      : '<img src="' + esc(url) + '" alt="' + esc(title) + '">';

    let box = $('scLightbox');
    if (!box) {
      box = document.createElement('div');
      box.className = 'sc-lightbox';
      box.id = 'scLightbox';
      document.body.appendChild(box);
    }
    box.innerHTML =
      '<div class="sc-lb-backdrop" data-sc-close="1"></div>'
      + '<div class="sc-lb-panel" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">'
      + '<div class="sc-lb-head"><div><b>' + esc(title) + '</b>'
      + '<span>' + esc(label) + (size ? ' · ' + esc(size) : '') + '</span></div>'
      + '<button type="button" class="sc-lb-x" data-sc-close="1" aria-label="Tutup">' + svg(ICON.maximize) + '</button></div>'
      + '<div class="sc-lb-body">' + media + '</div>'
      + (caption ? '<div class="sc-lb-cap">' + esc(caption) + '</div>' : '')
      + '</div>';
    box.classList.add('open');
    box.querySelectorAll('[data-sc-close]').forEach((b) => b.addEventListener('click', closeLightbox));
  }
  function closeLightbox() {
    const box = $('scLightbox');
    if (!box) return;
    box.classList.remove('open');
    box.innerHTML = '';
    pauseAllVideos(null);
  }

  /** Pasang interaksi (hover autoplay + klik lightbox) pada semua kartu. */
  function bindCards(root) {
    if (!root) return;
    root.querySelectorAll('.sc-card').forEach((card) => {
      watchThumb(card);
      // PC: kursor di atas -> video diputar (loop, mute).
      card.addEventListener('pointerenter', () => {
        if (isTouch()) return;
        pauseAllVideos(card);
        playVideo(card);
      });
      card.addEventListener('pointerleave', () => {
        if (isTouch()) return;
        pauseVideo(card);
      });
      // HP: ketuk -> langsung lightbox (sama seperti PC).
      card.addEventListener('click', () => {
        openLightbox(card);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(card); }
      });
    });
  }

  function renderAll(items) {
    renderPortfolio(items);
    renderLatest(items);
    bindCards($('homePortfolio'));
    bindCards($('homeLatestRow'));
    bindCards($('homePublicRow'));
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
      renderAll(items);
      return items;
    } catch {
      renderAll([]);
      return [];
    } finally {
      loading = false;
    }
  }

  // Dipakai halaman Beranda (go('Beranda')) & saat load pertama.
  window.sherlyLoadHomeShowcase = function (force) { return loadShowcase(force === true); };
  // Lightbox bisa ditutup pakai Escape.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });

  // Muat sekali halaman siap.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { loadShowcase(false); });
  } else {
    loadShowcase(false);
  }
})();
