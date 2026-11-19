// Editor — naskah & dokumen konten Sherly (D-152).
// Sumber: Supabase editor_documents (RLS owner, admin) via /api/editor/docs.
// Dipanggil go('Editor') -> window.renderEditor(). Bantuan Sherly = prefill chat (pola Planner).
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
    const t = $('edType');
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
      title: $('edTitle')?.value.trim() || '',
      doc_type: $('edType')?.value || 'Catatan Bebas',
      status: $('edStatus')?.value || 'draft',
      body: $('edBody')?.value || '',
    };
  }

  function takeSnapshot() { snapshot = JSON.stringify(currentDoc()); refreshDirty(); }

  function refreshDirty() {
    const el = $('edDirty'); if (!el) return;
    el.hidden = JSON.stringify(currentDoc()) === snapshot;
  }

  function refreshCount() {
    const el = $('edCount'); if (!el) return;
    const body = $('edBody')?.value || '';
    el.textContent = wordCount(body) + ' kata · ' + body.length.toLocaleString('id-ID') + ' karakter';
  }

  function renderList() {
    const list = $('edList'); if (!list) return;
    if (!docs.length) {
      list.innerHTML = '<div class="ed-empty">Belum ada dokumen.<br>Klik \u201CDokumen Baru\u201D untuk mulai menulis, atau minta Sherly menyusun drafnya lewat chat.</div>';
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
    $('edTitle').value = d.title || '';
    $('edType').value = DOC_TYPES.includes(d.doc_type) ? d.doc_type : 'Catatan Bebas';
    $('edStatus').value = ['draft', 'review', 'final'].includes(d.status) ? d.status : 'draft';
    $('edBody').value = d.body || '';
    $('edDeleteBtn').hidden = false;
    takeSnapshot(); refreshCount(); renderList();
  }

  function newDoc() {
    editingId = null;
    $('edTitle').value = ''; $('edType').value = DOC_TYPES[0]; $('edStatus').value = 'draft'; $('edBody').value = '';
    $('edDeleteBtn').hidden = true;
    takeSnapshot(); refreshCount(); renderList();
    $('edTitle')?.focus();
  }

  async function loadDocs() {
    try {
      const res = await fetch('/api/editor/docs', { headers: await authHeaders(false) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || ('Gagal memuat dokumen (' + res.status + ')'));
      docs = Array.isArray(d.docs) ? d.docs : [];
    } catch (e) {
      const list = $('edList');
      if (list) list.innerHTML = '<div class="ed-empty">Dokumen belum bisa dimuat: ' + esc(e.message) + '</div>';
      docs = []; return;
    }
    if (editingId && docs.some((x) => x.id === editingId)) { renderList(); refreshCount(); }
    else if (docs.length) loadDoc(docs[0].id);
    else newDoc();
  }

  window.renderEditor = function renderEditor() { loadDocs(); };

  $('edNewBtn')?.addEventListener('click', newDoc);

  ['edTitle', 'edType', 'edStatus', 'edBody'].forEach((id) => {
    $(id)?.addEventListener('input', () => { refreshDirty(); refreshCount(); });
    $(id)?.addEventListener('change', () => { refreshDirty(); refreshCount(); });
  });

  $('edForm')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = $('edSaveBtn'); if (!btn || btn.disabled) return;
    const doc = currentDoc();
    if (!doc.title) { window.toast?.('Judul dokumen belum diisi ya.'); $('edTitle')?.focus(); return; }
    btn.disabled = true; btn.textContent = 'Menyimpan…';
    try {
      const res = await fetch(editingId ? '/api/editor/docs/' + encodeURIComponent(editingId) : '/api/editor/docs', {
        method: editingId ? 'PUT' : 'POST',
        headers: await authHeaders(true),
        body: JSON.stringify(doc),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || ('Gagal menyimpan (' + res.status + ')'));
      if (d.doc?.id) editingId = d.doc.id;
      window.toast?.(editingId ? 'Dokumen tersimpan.' : 'Dokumen baru tersimpan.');
      await loadDocs();
      takeSnapshot();
    } catch (e) { window.toast?.(e.message); }
    finally { btn.disabled = false; btn.textContent = 'Simpan Dokumen'; }
  });

  $('edDeleteBtn')?.addEventListener('click', async () => {
    if (!editingId) return;
    if (!window.confirm('Hapus dokumen ini? Isinya tidak bisa dikembalikan.')) return;
    const btn = $('edDeleteBtn'); btn.disabled = true;
    try {
      const res = await fetch('/api/editor/docs/' + encodeURIComponent(editingId), { method: 'DELETE', headers: await authHeaders(false) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Gagal menghapus dokumen.');
      window.toast?.('Dokumen dihapus.');
      editingId = null;
      await loadDocs();
    } catch (e) { window.toast?.(e.message); }
    finally { btn.disabled = false; }
  });

  // Bantuan Sherly: bawa konteks draft ke chat (pola "Minta ide" Planner).
  $('edAssistBtn')?.addEventListener('click', () => {
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
