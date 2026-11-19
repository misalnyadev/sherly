// Galeri publik SherlyStudio (D-155 PR 2) — feed karya live via /api/public/posts, tanpa login.
// Halaman mandiri (galeri.html): mode grid (?tanpa param) & mode detail share (?id=…).
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CATEGORY_LABEL = { foto: 'Foto', reels: 'Reels', artikel: 'Artikel' };

  function toast(msg) {
    const t = $('gToast'); if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.hidden = true; }, 2600);
  }
  function fmtDate(iso) {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function views(n) { return Number(n) ? Number(n).toLocaleString('id-ID') + '× dilihat' : ''; }
  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; }
    } catch {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch { return false; }
  }

  function cardHtml(p) {
    const cover = p.publicUrl
      ? '<img src="' + esc(p.publicUrl) + '" alt="' + esc(p.title) + '" loading="lazy">'
      : '<div class="g-ph">✦</div>';
    return '<a class="g-card" href="/galeri.html?id=' + encodeURIComponent(p.id) + '">' + cover
      + '<div class="g-info"><h3>' + esc(p.title) + '</h3>'
      + (p.caption ? '<p>' + esc(p.caption) + '</p>' : '')
      + '<div class="g-meta"><span class="g-chip">' + esc(CATEGORY_LABEL[p.category] || p.category) + '</span>'
      + '<span>' + esc(fmtDate(p.publish_at || p.created_at)) + '</span>'
      + (p.viewCount ? '<span>' + esc(views(p.viewCount)) + '</span>' : '')
      + '</div></div></a>';
  }

  function renderDetail(p) {
    const main = $('gMain'); if (!main) return;
    const bodyHtml = p.body
      ? '<div class="g-body">' + String(p.body).split(/\n{2,}/).map((par) => '<p>' + esc(par).replace(/\n/g, '<br>') + '</p>').join('') + '</div>'
      : '';
    main.innerHTML = '<article class="g-detail">'
      + '<a class="g-back" href="/galeri.html">← Semua karya</a>'
      + (p.publicUrl ? '<img class="g-hero" src="' + esc(p.publicUrl) + '" alt="' + esc(p.title) + '">' : '')
      + '<h1>' + esc(p.title) + '</h1>'
      + '<div class="g-meta"><span class="g-chip">' + esc(CATEGORY_LABEL[p.category] || p.category) + '</span>'
      + '<span>' + esc(fmtDate(p.publish_at || p.created_at)) + '</span>'
      + (p.viewCount ? '<span>' + esc(views(p.viewCount)) + '</span>' : '')
      + '</div>'
      + (p.caption ? '<p class="g-caption">' + esc(p.caption) + '</p>' : '')
      + bodyHtml
      + '<div class="g-share"><button type="button" id="gCopyBtn">Salin Link</button>'
      + (navigator.share ? '<button type="button" id="gShareBtn">Bagikan…</button>' : '')
      + '</div></article>';
    $('gCopyBtn')?.addEventListener('click', async () => {
      const ok = await copyText(location.href);
      toast(ok ? 'Link karya tersalin — tinggal dibagikan!' : 'Salin manual: ' + location.href);
    });
    $('gShareBtn')?.addEventListener('click', () => {
      try { navigator.share({ title: p.title, text: p.caption || p.title, url: location.href }).catch(() => {}); } catch {}
    });
  }

  // Catat penayangan sekali per sesi browser per karya.
  async function countView(id) {
    try {
      const key = 'sherlyPbView-' + id;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
      await fetch('/api/public/posts/' + encodeURIComponent(id) + '/view', { method: 'POST' });
    } catch {}
  }

  async function boot() {
    const params = new URLSearchParams(location.search || '');
    const id = params.get('id') || '';
    const main = $('gMain'); const feed = $('gFeed');
    try {
      if (id) {
        const res = await fetch('/api/public/posts?id=' + encodeURIComponent(id));
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || 'Karya tidak ditemukan atau belum tayang.');
        document.title = (d.post?.title ? d.post.title + ' — ' : '') + 'Galeri SherlyStudio';
        renderDetail(d.post);
        countView(id);
        return;
      }
      const res = await fetch('/api/public/posts');
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Galeri belum bisa dimuat.');
      const posts = Array.isArray(d.posts) ? d.posts : [];
      if (feed) feed.innerHTML = posts.length
        ? posts.map(cardHtml).join('')
        : '<div class="g-empty">Belum ada karya yang tayang — kembali lagi segera! ✦</div>';
    } catch (e) {
      const msg = esc(e.message || 'Galeri belum bisa dimuat.');
      if (id && main) main.innerHTML = '<article class="g-detail"><a class="g-back" href="/galeri.html">← Semua karya</a><div class="g-empty">' + msg + '</div></article>';
      else if (feed) feed.innerHTML = '<div class="g-empty">' + msg + '</div>';
    }
  }
  boot();
})();
