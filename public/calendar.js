// ===== Kalender Konten =====
// View bulanan dari data Planner (localStorage 'sherly.planner.v1' — read-only di sini).
// Dipanggil go('Kalender') -> window.renderCalendar().
// Interaksi: klik "+" di tanggal -> tambah konten (modal Planner, tanggal terisi);
// klik chip judul -> edit konten itu di Planner.
// Kartu dirender dinamis (setelah loop injeksi [data-icon] di index.html) -> ikon dirakit manual.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (key) => {
    const paths = (typeof ICONS !== 'undefined' && ICONS[key]) || '';
    return '<span data-icon="' + key + '">' + (paths ? '<svg viewBox="0 0 24 24" aria-hidden="true">' + paths + '</svg>' : '') + '</span>';
  };

  const KEY = 'sherly.planner.v1';
  const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  const STATUS_META = { ide: ['Ide', '#8fa4bd'], draft: ['Draft', '#c9a8f2'], terjadwal: ['Terjadwal', '#ff6fc3'], tayang: ['Tayang', '#7ee2ae'] };

  function loadItems() {
    try { const arr = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(arr) ? arr : []; } catch { return []; }
  }
  function iso(y, m, d) { return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }

  function render() {
    const root = $('calendarRoot'); if (!root) return;
    const items = loadItems();
    const byDate = {};
    items.forEach((it) => { if (it && it.date) (byDate[it.date] = byDate[it.date] || []).push(it); });
    const now = new Date();
    const todayISO = iso(now.getFullYear(), now.getMonth(), now.getDate());
    const startOffset = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // Senin = hari pertama
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const monthPrefix = iso(viewYear, viewMonth, 1).slice(0, 7);
    const monthItems = items.filter((it) => it && it.date && String(it.date).slice(0, 7) === monthPrefix);
    const counts = { ide: 0, draft: 0, terjadwal: 0, tayang: 0 };
    monthItems.forEach((it) => { if (counts[it.status] !== undefined) counts[it.status]++; });

    let cells = '';
    for (let i = 0; i < startOffset; i++) cells += '<div class="cal-cell muted" aria-hidden="true"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const dISO = iso(viewYear, viewMonth, d);
      const dayItems = byDate[dISO] || [];
      const chips = dayItems.slice(0, 3).map((it) =>
        '<button type="button" class="cal-chip" data-id="' + esc(it.id) + '" title="' + esc(it.title) + ' \u2014 ' + (STATUS_META[it.status] ? STATUS_META[it.status][0] : 'Konten') + '"><i style="background:' + (STATUS_META[it.status] ? STATUS_META[it.status][1] : '#8fa4bd') + '"></i><span>' + esc(it.title) + '</span></button>').join('');
      const more = dayItems.length > 3 ? '<span class="cal-more">+' + (dayItems.length - 3) + ' lagi</span>' : '';
      cells += '<div class="cal-cell' + (dISO === todayISO ? ' today' : '') + '">'
        + '<span class="cal-num">' + d + '</span>'
        + '<button type="button" class="cal-add" data-date="' + dISO + '" title="Tambah konten di tanggal ini" aria-label="Tambah konten tanggal ' + d + '">' + icon('plus') + '</button>'
        + chips + more
        + '</div>';
    }

    root.innerHTML =
      '<div class="cal-toolbar">'
      + '<div class="cal-title"><h2>' + MONTHS[viewMonth] + ' ' + viewYear + '</h2>'
      + '<div class="cal-legend">' + Object.keys(STATUS_META).map((k) => '<span><i style="background:' + STATUS_META[k][1] + '"></i>' + STATUS_META[k][0] + '</span>').join('') + '</div></div>'
      + '<div class="cal-nav"><button type="button" class="cal-nav-btn" id="calPrev" title="Bulan sebelumnya" aria-label="Bulan sebelumnya">' + icon('chevron-left') + '</button>'
      + '<button type="button" class="cal-today-btn" id="calToday">Hari ini</button>'
      + '<button type="button" class="cal-nav-btn" id="calNext" title="Bulan berikutnya" aria-label="Bulan berikutnya">' + icon('chevron-right') + '</button></div>'
      + '</div>'
      + '<div class="cal-board">'
      + DAYS.map((d) => '<span class="cal-dow">' + d + '</span>').join('')
      + cells
      + '</div>'
      + '<p class="cal-sum">Bulan ini: <b>' + monthItems.length + ' konten</b> \u2014 '
      + Object.keys(counts).map((k) => counts[k] + ' ' + STATUS_META[k][0].toLowerCase()).join(' \u00b7 ')
      + '. Klik <b>+</b> pada tanggal untuk menambah konten; klik judulnya untuk mengedit.</p>';

    $('calPrev')?.addEventListener('click', () => { viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; } render(); });
    $('calNext')?.addEventListener('click', () => { viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; } render(); });
    $('calToday')?.addEventListener('click', () => { const t = new Date(); viewYear = t.getFullYear(); viewMonth = t.getMonth(); render(); });
    root.querySelectorAll('.cal-add').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      window.go?.('Planner');
      window.sherlyPlannerOpen?.(null, b.dataset.date);
    }));
    root.querySelectorAll('.cal-chip').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      window.go?.('Planner');
      window.sherlyPlannerOpen?.(b.dataset.id, null);
    }));
  }

  let viewYear = 0, viewMonth = 0;
  window.renderCalendar = function renderCalendar() {
    const t = new Date();
    viewYear = t.getFullYear(); viewMonth = t.getMonth();
    render();
  };
})();
