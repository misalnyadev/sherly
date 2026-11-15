// Planner konten — rencana & progres konten Sherly (lokal per perangkat, tanpa login).
// Data: localStorage 'sherly.planner.v1'. Dipanggil go('Planner') -> window.renderPlanner().
// Roadmap: v1 board list + filter + CRUD; berikutnya view Kalender & aliran ide dari Studio/Chat.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Kartu dirender dinamis (setelah loop injeksi [data-icon] di index.html) -> ikon dirakit manual.
  const icon = (key) => {
    const paths = (typeof ICONS !== 'undefined' && ICONS[key]) || '';
    return '<span data-icon="' + key + '">' + (paths ? '<svg viewBox="0 0 24 24" aria-hidden="true">' + paths + '</svg>' : '') + '</span>';
  };
  const KEY = 'sherly.planner.v1';
  const STATUS = [['ide', 'Ide'], ['draft', 'Draft'], ['terjadwal', 'Terjadwal'], ['tayang', 'Tayang']];
  const PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'Campaign', 'Lainnya'];
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
  function nextDay(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  const SEED = [
    { id: 'c1', title: 'Reels: rutinitas skincare malam', platform: 'Instagram', date: nextDay(2), status: 'draft', notes: 'Hook: \u201C3 langkah yang gue lakuin tiap malam\u201D \u2014 shot list: cleanser, serum, moisturizer.' },
    { id: 'c2', title: 'Carousel: 5 kesalahan pemula skincare', platform: 'Instagram', date: nextDay(4), status: 'ide', notes: 'Slide 1 masalah, slide 2-6 solusi per kesalahan, CTA save & share.' },
    { id: 'c3', title: 'Live kolaborasi brand lokal', platform: 'TikTok', date: nextDay(7), status: 'terjadwal', notes: 'Jam 20.00 \u2014 bahas produk favorit + giveaway kecil di akhir sesi.' }
  ];
  let items = [];
  let filter = 'all';
  let editingId = null;

  (function init() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw === null) { items = SEED; localStorage.setItem(KEY, JSON.stringify(items)); }
      else items = JSON.parse(raw) || [];
    } catch { items = SEED; }
    if (!Array.isArray(items)) items = [];
    const plat = $('plPlatform'), stat = $('plStatus');
    if (plat) plat.innerHTML = PLATFORMS.map((p) => '<option>' + esc(p) + '</option>').join('');
    if (stat) stat.innerHTML = STATUS.map(([k, l]) => '<option value="' + k + '">' + esc(l) + '</option>').join('');
  })();

  function save() { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {} }

  function dateBadge(date) {
    let b = '\u2014', m = 'jadwal';
    if (date) {
      const d = new Date(date + 'T00:00:00');
      if (!isNaN(d)) { b = String(d.getDate()); m = MONTHS[d.getMonth()]; }
    }
    return '<div class="pl-date"><b>' + esc(b) + '</b><small>' + esc(m) + '</small></div>';
  }

  function statusLabel(k) { const s = STATUS.find((x) => x[0] === k); return s ? s[1] : 'Ide'; }

  function renderFilters() {
    const wrap = $('plFilters'); if (!wrap) return;
    const counts = { all: items.length };
    STATUS.forEach(([k]) => { counts[k] = items.filter((i) => i.status === k).length; });
    wrap.innerHTML = [['all', 'Semua']].concat(STATUS).map(([k, l]) =>
      '<button type="button" class="pf-filter' + (k === filter ? ' active' : '') + '" data-filter="' + k + '">' + esc(l) + ' \u00b7 ' + counts[k] + '</button>').join('');
    wrap.querySelectorAll('.pf-filter').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.filter; renderPlanner(); }));
  }

  function renderList() {
    const list = $('plList'); if (!list) return;
    const shown = items.filter((i) => filter === 'all' || i.status === filter)
      .slice().sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999')));
    if (!shown.length) {
      list.innerHTML = '<div class="empty-state">Belum ada konten di kategori ini \u2014 klik \u201CTambah Konten\u201D untuk mulai merencanakan, atau minta ide dari Sherly.</div>';
      return;
    }
    list.innerHTML = shown.map((i) =>
      '<div class="pl-item" data-id="' + esc(i.id) + '" role="button" tabindex="0" aria-label="Edit ' + esc(i.title) + '">'
      + dateBadge(i.date)
      + '<div class="pl-main"><h3>' + esc(i.title) + '</h3>'
      + (i.notes ? '<p>' + esc(i.notes) + '</p>' : '')
      + (i.platform ? '<div class="pf-tags"><span class="chip">' + esc(i.platform) + '</span></div>' : '')
      + '</div>'
      + '<div class="pl-side"><span class="pl-status ' + esc(i.status) + '">' + esc(statusLabel(i.status)) + '</span>'
      + '<div class="pl-actions"><button type="button" aria-label="Edit konten">' + icon('pencil') + '</button></div>'
      + '</div></div>').join('');
    list.querySelectorAll('.pl-item').forEach((el) => {
      const open = () => openModal(el.dataset.id);
      el.addEventListener('click', open);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
  }

  window.renderPlanner = function renderPlanner() { renderFilters(); renderList(); };
  // Dibuka dari halaman Kalender: edit item (id) atau tambah baru dengan tanggal terisi.
  window.sherlyPlannerOpen = function (id, dateISO) {
    openModal(id || null);
    if (!id && dateISO && $('plDate')) $('plDate').value = dateISO;
    $('plTitle')?.focus();
  };

  // ---------- Modal tambah / edit ----------
  function openModal(id) {
    editingId = id || null;
    const it = id ? items.find((x) => x.id === id) : null;
    $('plModalTitle').textContent = it ? 'Edit Konten' : 'Tambah Konten';
    $('plTitle').value = it?.title || '';
    $('plPlatform').value = it?.platform || 'Instagram';
    $('plDate').value = it?.date || '';
    $('plStatus').value = it?.status || 'ide';
    $('plNotes').value = it?.notes || '';
    $('plDeleteBtn').hidden = !it;
    $('plModal').classList.add('open');
    $('plTitle').focus();
  }
  function closeModal() { $('plModal')?.classList.remove('open'); editingId = null; }

  $('plAddBtn')?.addEventListener('click', () => openModal(null));
  $('plCancelBtn')?.addEventListener('click', closeModal);
  $('plModal')?.addEventListener('click', (e) => { if (e.target === $('plModal')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  $('plSaveBtn')?.addEventListener('click', () => {
    const title = $('plTitle').value.trim();
    if (!title) { window.toast?.('Judul konten belum diisi ya.'); return; }
    const data = { title, platform: $('plPlatform').value, date: $('plDate').value, status: $('plStatus').value, notes: $('plNotes').value.trim() };
    const wasEdit = !!editingId;
    if (wasEdit) {
      const i = items.findIndex((x) => x.id === editingId);
      if (i > -1) items[i] = { ...items[i], ...data };
    } else {
      items.push({ id: 'c' + Date.now().toString(36), ...data });
    }
    save(); closeModal(); renderPlanner();
    window.toast?.(wasEdit ? 'Konten diperbarui.' : 'Konten masuk planner.');
  });

  $('plDeleteBtn')?.addEventListener('click', () => {
    items = items.filter((x) => x.id !== editingId);
    save(); closeModal(); renderPlanner();
    window.toast?.('Konten dihapus dari planner.');
  });

  // Minta ide dari Sherly: buka chat dengan prompt siap kirim
  $('plIdeBtn')?.addEventListener('click', () => {
    window.go?.('Chat Sherly');
    setTimeout(() => {
      const el = document.getElementById('ssChatInput');
      if (el) { el.value = 'Bantu aku menyusun ide konten minggu ini untuk niche lifestyle & beauty \u2014 format reels dan carousel, lengkap dengan hook pembuka.'; el.focus(); }
    }, 250);
  });
})();
