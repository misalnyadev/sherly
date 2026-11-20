// ===== D-207: Bank Prompt — CRUD admin (Pengaturan → Bank Prompt) =====
//
// Dua jenis entri:
//   kind 'template' -> satu prompt lengkap siap pakai (mis. "Try Outfit", "Drone View")
//   kind 'block'    -> satu blok susunan prompt (kamera/cahaya/gaya/...) yang ditumpuk user.
//
// Modul ini hanya menangani UI Pengaturan. Preview & pemakaiannya ada di public/studio.js.
(() => {
  'use strict';
  const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $ = (id) => document.getElementById(id);

  // Urutan kategori = urutan susun prompt di Studio.
  const CATEGORIES = [
    { key: 'kamera', label: 'Kamera & Angle' },
    { key: 'cahaya', label: 'Cahaya & Mood' },
    { key: 'gaya', label: 'Gaya Visual' },
    { key: 'tekstur', label: 'Tekstur & Detail' },
    { key: 'color', label: 'Color & Tone' },
    { key: 'kualitas', label: 'Kualitas & Realisme' },
    { key: 'negative', label: 'Negative Prompt' },
    { key: 'umum', label: 'Umum' },
  ];
  const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

  let entries = [];
  let categories = CATEGORIES;
  let filter = 'all';
  let editingId = null;

  const authHeaders = async () => {
    const t = (await window.sherlyGetAccessToken?.()) || window.sherlyStoredToken?.()?.access_token || '';
    return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + t };
  };

  /** Muat daftar entri bank prompt dari server. */
  async function load() {
    const list = $('pbList');
    if (list) list.innerHTML = '<p style="color:var(--muted);font-size:12px">Memuat bank prompt...</p>';
    try {
      const r = await fetch('/api/prompt-bank', { headers: await authHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal memuat bank prompt.');
      entries = Array.isArray(d.entries) ? d.entries : [];
      if (Array.isArray(d.categories) && d.categories.length) {
        categories = d.categories;
        fillCategorySelect();
      }
      render();
    } catch (e) {
      if (list) list.innerHTML = '<p style="color:#ff9bdc;font-size:12px">Gagal memuat: ' + esc(e.message || 'cek koneksi.') + '</p>';
    }
  }

  /** Isi <select> kategori dari daftar kategori server. */
  function fillCategorySelect() {
    const sel = $('pbCategory');
    if (!sel) return;
    sel.innerHTML = categories.map((c) => '<option value="' + esc(c.key) + '">' + esc(c.label) + '</option>').join('');
  }

  /** Daftar entri (difilter) sebagai kartu. */
  function render() {
    const box = $('pbList');
    if (!box) return;
    const list = filter === 'all' ? entries : entries.filter((e) => e.kind === filter);
    if (!list.length) {
      box.innerHTML = '<p style="color:var(--muted);font-size:12px;padding:6px 0">Belum ada entri. Klik <b>Tambah Entri</b> untuk membuat.</p>';
      return;
    }
    box.innerHTML = list.map((e) => {
      const slots = Array.isArray(e.slots) ? e.slots : [];
      return '<div class="pb-row" data-pb-id="' + esc(e.id) + '">'
        + '<div class="pb-row-main">'
        + '<b>' + esc(e.label) + '</b>'
        + '<span class="pb-tag">' + esc(e.kind === 'template' ? 'Template' : 'Blok') + '</span>'
        + '<span class="pb-tag">' + esc(CAT_LABEL[e.category] || e.category) + '</span>'
        + (e.is_active === false ? '<span class="pb-tag pb-tag-off">nonaktif</span>' : '')
        + (slots.length ? '<span class="pb-tag">isi: ' + esc(slots.join(', ')) + '</span>' : '')
        + '<p>' + esc(e.content) + '</p>'
        + '</div>'
        + '<div class="pb-row-actions">'
        + '<button type="button" class="link" data-pb-edit="' + esc(e.id) + '"><span data-icon="pencil"></span> Ubah</button>'
        + '<button type="button" class="link" data-pb-toggle="' + esc(e.id) + '">' + (e.is_active === false ? 'Aktifkan' : 'Nonaktifkan') + '</button>'
        + '<button type="button" class="link pb-del" data-pb-del="' + esc(e.id) + '"><span data-icon="trash-2"></span> Hapus</button>'
        + '</div></div>';
    }).join('');

    box.querySelectorAll('[data-pb-edit]').forEach((b) => b.addEventListener('click', () => openForm(b.dataset.pbEdit)));
    box.querySelectorAll('[data-pb-toggle]').forEach((b) => b.addEventListener('click', () => toggleActive(b.dataset.pbToggle)));
    box.querySelectorAll('[data-pb-del]').forEach((b) => b.addEventListener('click', () => remove(b.dataset.pbDel)));
  }

  /** Buka form tambah/ubah. */
  function openForm(id) {
    editingId = id || null;
    const panel = $('pbFormPanel');
    if (panel) panel.hidden = false;
    const title = $('pbFormTitle');
    if (title) title.textContent = id ? 'Ubah Entri' : 'Tambah Entri';
    const msg = $('pbMsg'); if (msg) msg.textContent = '';

    const e = id ? entries.find((x) => x.id === id) : null;
    if ($('pbKind')) $('pbKind').value = e ? e.kind : 'block';
    if ($('pbCategory')) $('pbCategory').value = e ? e.category : 'umum';
    if ($('pbLabel')) $('pbLabel').value = e ? e.label : '';
    if ($('pbSlots')) $('pbSlots').value = e && Array.isArray(e.slots) ? e.slots.join(', ') : '';
    if ($('pbContent')) $('pbContent').value = e ? e.content : '';
    updateSlotHint();
    $('pbLabel')?.focus();
    try { panel?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }); } catch { /* browser tanpa scrollIntoView */ }
  }

  function closeForm() {
    editingId = null;
    const panel = $('pbFormPanel');
    if (panel) panel.hidden = true;
  }

  /** Petunjuk placeholder yang terdeteksi otomatis dari isi prompt. */
  function updateSlotHint() {
    const hint = $('pbSlotHint');
    if (!hint) return;
    const content = $('pbContent')?.value || '';
    const found = [...content.matchAll(/\{([a-z0-9_ -]{1,40})\}/gi)].map((m) => m[1].trim());
    const uniq = [...new Set(found)];
    hint.textContent = uniq.length
      ? 'Placeholder terdeteksi: ' + uniq.join(', ') + ' — user akan prompted mengisinya.'
      : 'Gunakan {nama} untuk bagian yang diisi user (mis. { outfit }).';
  }

  /** Simpan entri (tambah atau ubah). */
  async function save() {
    const msg = $('pbMsg'); if (msg) msg.textContent = 'Menyimpan...';
    const body = {
      kind: $('pbKind')?.value || 'block',
      category: $('pbCategory')?.value || 'umum',
      label: $('pbLabel')?.value || '',
      slots: $('pbSlots')?.value || '',
      content: $('pbContent')?.value || '',
    };
    try {
      const url = editingId ? '/api/prompt-bank/' + encodeURIComponent(editingId) : '/api/prompt-bank';
      const r = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal menyimpan.');
      if (msg) msg.textContent = 'Tersimpan.';
      closeForm();
      await load();
      window.toast?.('Entri prompt tersimpan.');
    } catch (e) {
      if (msg) msg.textContent = e.message || 'Gagal menyimpan.';
    }
  }

  /** Aktifkan / nonaktifkan sebuah entri. */
  async function toggleActive(id) {
    const e = entries.find((x) => x.id === id);
    if (!e) return;
    try {
      const r = await fetch('/api/prompt-bank/' + encodeURIComponent(id), {
        method: 'PUT',
        headers: await authHeaders(),
        body: JSON.stringify({ ...e, is_active: e.is_active === false }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal mengubah status.');
      await load();
    } catch (err) {
      window.toast?.(err.message || 'Gagal mengubah status.');
    }
  }

  /** Hapus sebuah entri. */
  async function remove(id) {
    const e = entries.find((x) => x.id === id);
    if (!e) return;
    if (!window.confirm?.('Hapus prompt "' + e.label + '"?')) return;
    try {
      const r = await fetch('/api/prompt-bank/' + encodeURIComponent(id), { method: 'DELETE', headers: await authHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal menghapus.');
      await load();
      window.toast?.('Entri prompt dihapus.');
    } catch (err) {
      window.toast?.(err.message || 'Gagal menghapus.');
    }
  }

  // ===== init =====
  document.addEventListener('DOMContentLoaded', () => {
    fillCategorySelect();
    $('pbAddBtn')?.addEventListener('click', () => openForm(null));
    $('pbCancelBtn')?.addEventListener('click', closeForm);
    $('pbSaveBtn')?.addEventListener('click', save);
    $('pbRefreshBtn')?.addEventListener('click', () => load());
    $('pbContent')?.addEventListener('input', updateSlotHint);
    document.querySelectorAll('.pb-filter').forEach((b) => b.addEventListener('click', () => {
      filter = b.dataset.pbFilter;
      document.querySelectorAll('.pb-filter').forEach((x) => x.classList.toggle('active', x === b));
      render();
    }));
  });

  // Dipanggil dari go('Pengaturan') -> window.loadPromptBankAdmin()
  window.loadPromptBankAdmin = function loadPromptBankAdmin() { load(); };
})();
