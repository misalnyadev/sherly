// Cloud Publish — galeri karya & jadwal tayang admin (D-155).
// Sumber: Supabase published_posts (RLS owner) + bucket publik 'published' via /api/publish/posts.
// Dipanggil go('Cloud Publish') -> window.loadPublish().
// Editor & Planner memanggil window.sherlyPublishOpen({...}) untuk buka modal terisi (PR 2).
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const STATUS_LABEL = { draft: 'Draft', scheduled: 'Terjadwal', live: 'Live', archived: 'Arsip' };
  const CATEGORY_LABEL = { foto: 'Foto', reels: 'Reels', artikel: 'Artikel' };
  let posts = [];
  let filter = 'all';
  let editingId = null;
  let pendingImage = null; // dataURL gambar baru (create / ganti gambar)

  function authHeaders(json) {
    return (async () => {
      const h = json ? { 'Content-Type': 'application/json' } : {};
      const t = await window.sherlyGetAccessToken?.(); if (t) h.Authorization = 'Bearer ' + t;
      return h;
    })();
  }

  function relTime(iso) {
    if (!iso) return '';
    const d = new Date(iso); if (isNaN(d)) return '';
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return 'baru saja';
    if (s < 3600) return Math.floor(s / 60) + ' mnt lalu';
    if (s < 86400) return Math.floor(s / 3600) + ' jam lalu';
    if (s < 604800) return Math.floor(s / 86400) + ' hari lalu';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }
  function whenLabel(p) {
    if (p.status === 'scheduled' && p.publish_at) return 'tayang ' + new Date(p.publish_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    return 'diperbarui ' + relTime(p.updated_at);
  }
  // Karya yang sudah terlihat di halaman publik (live, atau terjadwal yang waktunya tiba).
  function isPubliclyVisible(p) {
    if (p.status === 'live') return true;
    if (p.status === 'scheduled' && p.publish_at) { const d = new Date(p.publish_at); return !isNaN(d) && d.getTime() <= Date.now(); }
    return false;
  }
  function shareUrl(id) { return (location.origin || '') + '/galeri.html?id=' + encodeURIComponent(id); }
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

  function renderFilters() {
    const wrap = $('pbFilters'); if (!wrap) return;
    const counts = { all: posts.length, draft: 0, scheduled: 0, live: 0, archived: 0 };
    posts.forEach((p) => { if (counts[p.status] !== undefined) counts[p.status]++; });
    wrap.innerHTML = [['all', 'Semua'], ['draft', 'Draft'], ['scheduled', 'Terjadwal'], ['live', 'Live'], ['archived', 'Arsip']]
      .map(([k, l]) => '<button type="button" class="pf-filter' + (k === filter ? ' active' : '') + '" data-filter="' + k + '">' + l + ' · ' + counts[k] + '</button>').join('');
    wrap.querySelectorAll('.pf-filter').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.filter; renderFilters(); renderList(); }));
  }

  function renderList() {
    const list = $('pbList'); if (!list) return;
    const shown = posts.filter((p) => filter === 'all' || p.status === filter);
    if (!shown.length) {
      list.innerHTML = '<div class="empty-state">Belum ada karya di sini. Klik \u201CPublikasikan Karya\u201D untuk mengunggah hasil Editor/Studio-mu — atur jadwal tayangnya sekalian.</div>';
      return;
    }
    list.innerHTML = shown.map((p) => {
      const pub = isPubliclyVisible(p);
      return '<div class="pb-card" data-id="' + esc(p.id) + '">'
      + (p.publicUrl ? '<img class="pb-thumb" src="' + esc(p.publicUrl) + '" alt="' + esc(p.title) + '" loading="lazy">' : '<div class="pb-thumb"></div>')
      + '<div class="pb-main"><h3>' + esc(p.title) + '</h3>'
      + (p.caption ? '<p>' + esc(p.caption) + '</p>' : '')
      + '<div class="pb-meta"><span class="chip">' + esc(CATEGORY_LABEL[p.category] || p.category) + '</span>'
      + '<span class="pb-st st-' + esc(p.status) + '">' + esc(STATUS_LABEL[p.status] || p.status) + '</span>'
      + '<span class="pb-when">' + esc(whenLabel(p)) + (pub && p.viewCount ? ' · ' + Number(p.viewCount).toLocaleString('id-ID') + '× dilihat' : '') + '</span></div></div>'
      + '<div class="pb-side">'
      + (p.status !== 'live' ? '<button type="button" class="pb-act pb-live-act" data-act="live">Tayangkan</button>' : '')
      + (p.status === 'live' ? '<button type="button" class="pb-act" data-act="archive">Arsipkan</button>' : '')
      + (pub ? '<button type="button" class="pb-act" data-act="share">Salin Link</button>' : '')
      + '<button type="button" class="pb-act" data-act="edit">Edit</button>'
      + '</div></div>';
    }).join('');
  }

  async function loadPublish() {
    const list = $('pbList');
    try {
      const res = await fetch('/api/publish/posts', { headers: await authHeaders(false) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || ('Gagal memuat karya (' + res.status + ')'));
      posts = Array.isArray(d.posts) ? d.posts : [];
    } catch (e) {
      if (list) list.innerHTML = '<div class="empty-state">Karya belum bisa dimuat: ' + esc(e.message) + '</div>';
      posts = []; renderFilters(); return;
    }
    renderFilters(); renderList();
  }
  window.loadPublish = loadPublish;

  // ---------- modal ----------
  function applyFormUi() {
    const st = $('pbStatus')?.value || 'draft';
    if ($('pbScheduleRow')) $('pbScheduleRow').hidden = st !== 'scheduled';
    if ($('pbBodyRow')) $('pbBodyRow').hidden = ($('pbCategory')?.value || 'foto') !== 'artikel';
  }
  function openModal(id, prefill) {
    editingId = id || null;
    const p = id ? posts.find((x) => x.id === id) : null;
    $('pbModalTitle').textContent = p ? 'Edit Karya' : 'Publikasikan Karya';
    $('pbTitle').value = (p?.title ?? prefill?.title ?? '') || '';
    $('pbCaption').value = (p?.caption ?? prefill?.caption ?? '') || '';
    $('pbCategory').value = p?.category || prefill?.category || 'foto';
    $('pbStatus').value = p?.status || 'draft';
    if (p?.publish_at) {
      const d = new Date(p.publish_at);
      $('pbPublishAt').value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    } else $('pbPublishAt').value = '';
    $('pbBody').value = (p?.body ?? prefill?.body ?? '') || '';
    pendingImage = prefill?.image || null;
    if ($('pbImage')) $('pbImage').value = '';
    const hint = $('pbImageHint');
    if (hint) hint.textContent = p ? 'Biarkan kosong untuk memakai gambar yang sudah ada.' : (pendingImage ? 'Gambar sudah terlampir dari ' + (prefill?.from || 'karya') + ' — bisa diganti kalau mau.' : 'JPG/PNG/WebP maks 5 MB — hasil unduhan dari Editor juga bisa langsung diunggah.');
    if (pendingImage) {
      if ($('pbPreview')) $('pbPreview').src = pendingImage;
      if ($('pbPreviewRow')) $('pbPreviewRow').hidden = false;
    } else {
      if ($('pbPreviewRow')) $('pbPreviewRow').hidden = true;
      if ($('pbPreview')) $('pbPreview').removeAttribute('src');
    }
    $('pbDeleteBtn').hidden = !p;
    applyFormUi();
    $('pbModal').classList.add('open');
    $('pbTitle')?.focus();
  }
  function closeModal() { $('pbModal')?.classList.remove('open'); editingId = null; pendingImage = null; }

  // pintasan global: Editor (gambar hasil export) & Planner (naskah -> artikel).
  window.sherlyPublishOpen = function sherlyPublishOpen(opts) { openModal(null, opts || {}); };

  $('pbAddBtn')?.addEventListener('click', () => openModal(null));
  $('pbPublicLinkBtn')?.addEventListener('click', () => window.open('/galeri.html', '_blank'));
  $('pbCancelBtn')?.addEventListener('click', closeModal);
  $('pbModal')?.addEventListener('click', (e) => { if (e.target === $('pbModal')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  $('pbStatus')?.addEventListener('change', applyFormUi);
  $('pbCategory')?.addEventListener('change', applyFormUi);
  $('pbImage')?.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) { pendingImage = null; if ($('pbPreviewRow')) $('pbPreviewRow').hidden = true; return; }
    if (!/^image\/(png|jpeg|webp)$/i.test(f.type)) { window.toast?.('Format gambar harus JPG, PNG, atau WebP.'); e.target.value = ''; return; }
    if (f.size > 5 * 1024 * 1024) { window.toast?.('Gambar terlalu besar — maksimal 5 MB.'); e.target.value = ''; return; }
    const r = new FileReader();
    r.onload = () => {
      pendingImage = String(r.result);
      if ($('pbPreview')) { $('pbPreview').src = pendingImage; }
      if ($('pbPreviewRow')) $('pbPreviewRow').hidden = false;
    };
    r.readAsDataURL(f);
  });

  $('pbSaveBtn')?.addEventListener('click', async () => {
    const btn = $('pbSaveBtn'); if (!btn || btn.disabled) return;
    const payload = {
      title: $('pbTitle').value.trim(),
      caption: $('pbCaption').value.trim(),
      category: $('pbCategory').value,
      status: $('pbStatus').value,
      publish_at: $('pbPublishAt').value || null,
      body: ($('pbBody')?.value || '').trim() || null,
    };
    if (!payload.title) { window.toast?.('Judul karya belum diisi ya.'); $('pbTitle')?.focus(); return; }
    if (payload.status === 'scheduled' && !payload.publish_at) { window.toast?.('Pilih tanggal & jam tayangnya dulu.'); return; }
    if (!editingId && !pendingImage) { window.toast?.('Pilih gambarnya dulu (JPG/PNG/WebP).'); return; }
    if (pendingImage) payload.image_data = pendingImage;
    btn.disabled = true; btn.textContent = 'Menyimpan…';
    try {
      const res = await fetch(editingId ? '/api/publish/posts/' + encodeURIComponent(editingId) : '/api/publish/posts', {
        method: editingId ? 'PUT' : 'POST',
        headers: await authHeaders(true),
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || ('Gagal menyimpan (' + res.status + ')'));
      window.toast?.(payload.status === 'live' ? 'Karya tayang! Link publiknya bisa dibagikan.' : payload.status === 'scheduled' ? 'Karya terjadwal — tayang otomatis di waktunya.' : 'Karya tersimpan.');
      closeModal();
      await loadPublish();
    } catch (e) { window.toast?.(e.message); }
    finally { btn.disabled = false; btn.textContent = 'Simpan'; }
  });

  $('pbDeleteBtn')?.addEventListener('click', async () => {
    if (!editingId) return;
    if (!window.confirm('Hapus karya ini? Gambar di cloud juga ikut terhapus.')) return;
    const btn = $('pbDeleteBtn'); btn.disabled = true;
    try {
      const res = await fetch('/api/publish/posts/' + encodeURIComponent(editingId), { method: 'DELETE', headers: await authHeaders(false) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Gagal menghapus karya.');
      window.toast?.('Karya dihapus.');
      closeModal();
      await loadPublish();
    } catch (e) { window.toast?.(e.message); }
    finally { btn.disabled = false; }
  });

  // aksi cepat kartu: Tayangkan / Arsipkan / Salin Link / Edit
  $('pbList')?.addEventListener('click', async (e) => {
    const b = e.target.closest('.pb-act'); if (!b) return;
    const card = b.closest('.pb-card'); const id = card?.dataset.id || '';
    const act = b.dataset.act;
    if (act === 'edit') { openModal(id); return; }
    if (act === 'share') {
      const ok = await copyText(shareUrl(id));
      window.toast?.(ok ? 'Link publik tersalin — tinggal dibagikan!' : 'Link: ' + shareUrl(id));
      return;
    }
    const p = posts.find((x) => x.id === id); if (!p) return;
    const next = act === 'live' ? 'live' : 'archived';
    b.disabled = true;
    try {
      const res = await fetch('/api/publish/posts/' + encodeURIComponent(id), {
        method: 'PUT',
        headers: await authHeaders(true),
        body: JSON.stringify({ title: p.title, caption: p.caption || '', category: p.category, status: next, publish_at: p.publish_at || null, body: p.body || null }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Gagal mengubah status.');
      window.toast?.(next === 'live' ? 'Karya tayang! Link publiknya bisa dibagikan.' : 'Karya diarsipkan.');
      await loadPublish();
    } catch (e) { window.toast?.(e.message); b.disabled = false; }
  });
})();
