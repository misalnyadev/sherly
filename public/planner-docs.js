// Planner — tab Naskah: dokumen caption/artikel/script (D-153).
// Sumber: Supabase planner_documents (RLS owner, admin) via /api/planner/docs.
// Tab di dalam halaman Planner (bersama Board Rencana). Bantuan Sherly = prefill chat.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DOC_TYPES = ['Caption IG', 'Caption TikTok', 'Artikel', 'Script Video', 'Naskah Iklan', 'Catatan Bebas'];
  const STATUS_LABEL = { draft: 'Draft', review: 'Review', final: 'Final' };
  let docs = [];
  let editingId = null;
  let snapshot = '';

  (function init() {
    const t = $('pdType');
    if (t) t.innerHTML = DOC_TYPES.map((d) => '<option>' + esc(d) + '</option>').join('');
  })();

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
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function wordCount(str) {
    const t = String(str || '').trim();
    return t ? t.split(/\s+/).length : 0;
  }

  function currentDoc() {
    return {
      title: $('pdTitle')?.value.trim() || '',
      doc_type: $('pdType')?.value || 'Catatan Bebas',
      status: $('pdStatus')?.value || 'draft',
      body: $('pdBody')?.value || '',
    };
  }

  function takeSnapshot() { snapshot = JSON.stringify(currentDoc()); refreshDirty(); }

  function refreshDirty() {
    const el = $('pdDirty'); if (!el) return;
    el.hidden = JSON.stringify(currentDoc()) === snapshot;
  }

  function refreshCount() {
    const el = $('pdCount'); if (!el) return;
    const body = $('pdBody')?.value || '';
    el.textContent = wordCount(body) + ' kata · ' + body.length.toLocaleString('id-ID') + ' karakter';
  }

  function renderList() {
    const list = $('pdList'); if (!list) return;
    if (!docs.length) {
      list.innerHTML = '<div class="ed-empty">Belum ada naskah.<br>Klik \u201CNaskah Baru\u201D untuk mulai menulis, atau minta Sherly menyusun drafnya lewat chat.</div>';
      return;
    }
    list.innerHTML = docs.map((d) =>
      '<div class="ed-item' + (d.id === editingId ? ' active' : '') + '" data-id="' + esc(d.id) + '" role="button" tabindex="0" aria-label="Buka ' + esc(d.title) + '">'
      + '<b>' + esc(d.title) + '</b>'
      + '<small><span class="ed-chip">' + esc(d.doc_type) + '</span><span class="ed-chip st-' + esc(d.status) + '">' + esc(STATUS_LABEL[d.status] || d.status) + '</span></small>'
      + '<small>' + wordCount(d.body) + ' kata · ' + esc(relTime(d.updated_at)) + '</small>'
      + '</div>').join('');
    list.querySelectorAll('.ed-item').forEach((el) => {
      const open = () => loadDoc(el.dataset.id);
      el.addEventListener('click', open);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
  }

  function loadDoc(id) {
    const d = docs.find((x) => x.id === id); if (!d) return;
    editingId = id;
    $('pdTitle').value = d.title || '';
    $('pdType').value = DOC_TYPES.includes(d.doc_type) ? d.doc_type : 'Catatan Bebas';
    $('pdStatus').value = ['draft', 'review', 'final'].includes(d.status) ? d.status : 'draft';
    $('pdBody').value = d.body || '';
    $('pdDeleteBtn').hidden = false;
    takeSnapshot(); refreshCount(); renderList();
  }

  function newDoc() {
    editingId = null;
    $('pdTitle').value = ''; $('pdType').value = DOC_TYPES[0]; $('pdStatus').value = 'draft'; $('pdBody').value = '';
    $('pdDeleteBtn').hidden = true;
    takeSnapshot(); refreshCount(); renderList();
    $('pdTitle')?.focus();
  }

  async function loadDocs() {
    try {
      const res = await fetch('/api/planner/docs', { headers: await authHeaders(false) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || ('Gagal memuat naskah (' + res.status + ')'));
      docs = Array.isArray(d.docs) ? d.docs : [];
    } catch (e) {
      const list = $('pdList');
      if (list) list.innerHTML = '<div class="ed-empty">Naskah belum bisa dimuat: ' + esc(e.message) + '</div>';
      docs = []; return;
    }
    if (editingId && docs.some((x) => x.id === editingId)) { renderList(); refreshCount(); }
    else if (docs.length) loadDoc(docs[0].id);
    else newDoc();
  }

  window.renderPlannerDocs = function renderPlannerDocs() { loadDocs(); };

  // ---------- tab Planner: Board Rencana <-> Naskah ----------
  $('plTabs')?.addEventListener('click', (e) => {
    const b = e.target.closest('.pl-tab'); if (!b) return;
    const tab = b.dataset.tab;
    document.querySelectorAll('#plTabs .pl-tab').forEach((x) => {
      const on = x === b;
      x.classList.toggle('active', on);
      x.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if ($('plBoardTab')) $('plBoardTab').hidden = tab !== 'board';
    if ($('plDocsTab')) $('plDocsTab').hidden = tab !== 'docs';
    if (tab === 'docs') loadDocs();
  });

  $('pdNewBtn')?.addEventListener('click', newDoc);

  ['pdTitle', 'pdType', 'pdStatus', 'pdBody'].forEach((id) => {
    $(id)?.addEventListener('input', () => { refreshDirty(); refreshCount(); });
    $(id)?.addEventListener('change', () => { refreshDirty(); refreshCount(); });
  });

  $('pdForm')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = $('pdSaveBtn'); if (!btn || btn.disabled) return;
    const doc = currentDoc();
    if (!doc.title) { window.toast?.('Judul naskah belum diisi ya.'); $('pdTitle')?.focus(); return; }
    btn.disabled = true; btn.textContent = 'Menyimpan…';
    try {
      const res = await fetch(editingId ? '/api/planner/docs/' + encodeURIComponent(editingId) : '/api/planner/docs', {
        method: editingId ? 'PUT' : 'POST',
        headers: await authHeaders(true),
        body: JSON.stringify(doc),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || ('Gagal menyimpan (' + res.status + ')'));
      if (d.doc?.id) editingId = d.doc.id;
      window.toast?.(editingId ? 'Naskah tersimpan.' : 'Naskah baru tersimpan.');
      await loadDocs();
      takeSnapshot();
    } catch (e) { window.toast?.(e.message); }
    finally { btn.disabled = false; btn.textContent = 'Simpan Naskah'; }
  });

  $('pdDeleteBtn')?.addEventListener('click', async () => {
    if (!editingId) return;
    if (!window.confirm('Hapus naskah ini? Isinya tidak bisa dikembalikan.')) return;
    const btn = $('pdDeleteBtn'); btn.disabled = true;
    try {
      const res = await fetch('/api/planner/docs/' + encodeURIComponent(editingId), { method: 'DELETE', headers: await authHeaders(false) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Gagal menghapus naskah.');
      window.toast?.('Naskah dihapus.');
      editingId = null;
      await loadDocs();
    } catch (e) { window.toast?.(e.message); }
    finally { btn.disabled = false; }
  });

  // Bantuan Sherly: bawa konteks naskah ke chat (pola "Minta ide" Planner).
  $('pdAssistBtn')?.addEventListener('click', () => {
    const doc = currentDoc();
    const judul = doc.title || '(belum ada judul)';
    const potongan = doc.body.trim().slice(0, 700);
    const msg = 'Bantu aku dengan naskah \u201C' + judul + '\u201D (jenis: ' + doc.doc_type + '). '
      + (potongan
        ? 'Ini draft-nya:\n\n' + potongan + (doc.body.trim().length > 700 ? '\n\n(dipotong — lanjutkan dari sini)' : '') + '\n\nTolong rapikan, pertegas hook & CTA-nya, dan kasih 1 alternatif versi.'
        : 'Draft-nya masih kosong — tolong susun draf pertamanya ya, lengkap dengan hook pembuka dan CTA penutup.');
    window.go?.('Chat Sherly');
    setTimeout(() => {
      const el = document.getElementById('ssChatInput');
      if (el) { el.value = msg; el.focus(); }
    }, 250);
  });
})();
