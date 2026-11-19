// Editor — finishing foto ala CapCut / ediats Instagram (D-152).
// Semua proses di browser (canvas): rasio + zoom + geser, filter preset, adjust,
// teks overlay, sticker emoji, lalu unduh hasil JPG. Tanpa server/DB.
// Dipanggil go('Editor') -> window.renderEditor(). window.sherlyEditorOpenImage(src)
// disediakan untuk integrasi berikutnya (buka hasil Studio/Aset langsung ke sini).
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (key) => {
    const paths = (typeof ICONS !== 'undefined' && ICONS[key]) || '';
    return '<span data-icon="' + key + '">' + (paths ? '<svg viewBox="0 0 24 24" aria-hidden="true">' + paths + '</svg>' : '') + '</span>';
  };

  const RATIOS = [['1:1', 'Persegi'], ['4:5', 'Feed'], ['9:16', 'Story'], ['16:9', 'Wide'], ['3:4', 'Klasik']];
  const RATIO_MAP = { '1:1': [1, 1], '4:5': [4, 5], '9:16': [9, 16], '16:9': [16, 9], '3:4': [3, 4] };
  const PRESETS = [
    ['normal', 'Normal', ''],
    ['cerah', 'Cerah', 'brightness(1.12) saturate(1.15)'],
    ['kontras', 'Kontras', 'contrast(1.22) saturate(1.05)'],
    ['hangat', 'Hangat', 'sepia(0.28) saturate(1.25) brightness(1.05)'],
    ['dingin', 'Dingin', 'hue-rotate(-12deg) saturate(1.12) brightness(1.04)'],
    ['vintage', 'Vintage', 'sepia(0.45) contrast(0.92) brightness(1.12) saturate(0.85)'],
    ['mono', 'B&W', 'grayscale(1) contrast(1.12) brightness(1.08)'],
    ['drama', 'Drama', 'contrast(1.38) saturate(1.3) brightness(0.94)'],
  ];
  const EMOJIS = ['😍', '🥰', '😂', '😎', '🤍', '✨', '🔥', '💖', '🌸', '🎀', '🦋', '💫', '🖤', '🌝', '🥂', '☕'];
  const COLORS = ['#ffffff', '#0a1220', '#ffd0ec', '#f044a8'];
  const FONTS = [
    ['Inter', 'Inter — rapi'],
    ['Caveat', 'Caveat — tulisan tangan'],
    ['Sacramento', 'Sacramento — mewah'],
    ['Bebas Neue', 'Bebas Neue — tegas'],
    ['Lora', 'Lora — serif'],
    ['Archivo Black', 'Archivo Black — tebal'],
  ];
  const CANVAS_FONT = { Inter: 'Inter, Arial, sans-serif', Caveat: 'Caveat, cursive', Sacramento: 'Sacramento, cursive', 'Bebas Neue': "'Bebas Neue', sans-serif", Lora: 'Lora, Georgia, serif', 'Archivo Black': "'Archivo Black', sans-serif" };
  const FONT_WEIGHT = { Inter: 700, Caveat: 700, Sacramento: 400, 'Bebas Neue': 400, Lora: 400, 'Archivo Black': 400 };

  let S = null;          // state editor (null = belum ada foto)
  let fw = 300, fh = 300; // ukuran panggung px terakhir (dipakai matematika drag/export)
  let uid = 0;
  let drag = null;

  function freshState(src, imgW, imgH) {
    return { src, imgW, imgH, ratio: '1:1', zoom: 1, x: 0, y: 0, filter: 'normal', adj: { b: 100, c: 100, s: 100, w: 0 }, texts: [], sticks: [], sel: null };
  }

  // Muat gambar dengan fallback: browser lambat/jsdom tetap lanjut (ukuran default).
  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(img); } };
      img.onload = finish;
      img.onerror = finish;
      setTimeout(finish, 1500);
      img.src = src;
    });
  }

  window.sherlyEditorOpenImage = async function (src) {
    if (!src) return;
    const img = await loadImage(src);
    S = freshState(src, img.naturalWidth || 800, img.naturalHeight || 600);
    const photo = $('edPhoto'); if (photo) photo.src = src;
    if ($('edEmpty')) $('edEmpty').hidden = true;
    if ($('edStage')) $('edStage').hidden = false;
    if ($('edSide')) $('edSide').hidden = false;
    if ($('edStageTools')) $('edStageTools').hidden = false;
    if ($('edExportBtn')) $('edExportBtn').disabled = false;
    if ($('edChangeBtn')) $('edChangeBtn').hidden = false;
    if ($('edResetBtn')) $('edResetBtn').hidden = false;
    if ($('edPublishBtn')) $('edPublishBtn').hidden = false;
    renderAll();
    window.toast?.('Foto masuk — atur rasio, filter, teks, dan sticker-mu.');
  };

  function buildFilter() {
    const p = PRESETS.find((x) => x[0] === S.filter);
    const a = S.adj;
    return [p ? p[2] : '', 'brightness(' + (a.b / 100) + ')', 'contrast(' + (a.c / 100) + ')', 'saturate(' + (a.s / 100) + ')', a.w ? 'sepia(' + (a.w / 100) + ')' : '']
      .filter(Boolean).join(' ') || 'none';
  }
  function baseScale() { return Math.max(fw / S.imgW, fh / S.imgH); }
  function totalScale() { return baseScale() * S.zoom; }
  function clampPan() {
    const tw = S.imgW * totalScale(), th = S.imgH * totalScale();
    const mx = Math.max(0, (tw - fw) / 2), my = Math.max(0, (th - fh) / 2);
    S.x = Math.min(mx, Math.max(-mx, S.x));
    S.y = Math.min(my, Math.max(-my, S.y));
  }

  function renderStage() {
    const stage = $('edStage'); if (!stage || !S) return;
    const rw = RATIO_MAP[S.ratio] || [1, 1];
    const wrap = $('edStageWrap');
    const availW = Math.max(140, ((wrap ? wrap.clientWidth : 520) || 520) - 28);
    const availH = Math.max(180, (window.innerHeight || 600) * 0.64);
    fw = availW; fh = fw * rw[1] / rw[0];
    if (fh > availH) { fh = availH; fw = fh * rw[0] / rw[1]; }
    stage.style.width = Math.round(fw) + 'px';
    stage.style.height = Math.round(fh) + 'px';
    clampPan();
    const t = totalScale();
    const tx = (fw - S.imgW * t) / 2 + S.x, ty = (fh - S.imgH * t) / 2 + S.y;
    const img = $('edPhoto');
    if (img) {
      img.style.width = S.imgW + 'px'; img.style.height = S.imgH + 'px';
      img.style.transform = 'translate(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px) scale(' + t.toFixed(4) + ')';
      img.style.filter = buildFilter();
    }
    if ($('edZoom')) $('edZoom').value = String(Math.round(S.zoom * 100));
    if ($('edZoomVal')) $('edZoomVal').textContent = Math.round(S.zoom * 100) + '%';
  }

  function selId() { return S && S.sel ? S.sel.id : null; }

  function renderOverlay() {
    const ol = $('edOverlay'); if (!ol || !S) return;
    let html = '';
    S.texts.forEach((t) => {
      html += '<div class="ed-it ed-text' + (S.sel && S.sel.type === 'text' && S.sel.id === t.id ? ' sel' : '') + '" data-kind="text" data-id="' + esc(t.id) + '"'
        + ' style="left:' + (t.x * 100).toFixed(2) + '%;top:' + (t.y * 100).toFixed(2) + '%;font-size:' + (t.size * fh).toFixed(1) + 'px;color:' + esc(t.color) + ';font-family:' + CANVAS_FONT[t.font] + '">'
        + esc(t.str).replace(/\n/g, '<br>') + '</div>';
    });
    S.sticks.forEach((t) => {
      html += '<div class="ed-it ed-stick' + (S.sel && S.sel.type === 'stick' && S.sel.id === t.id ? ' sel' : '') + '" data-kind="stick" data-id="' + esc(t.id) + '"'
        + ' style="left:' + (t.x * 100).toFixed(2) + '%;top:' + (t.y * 100).toFixed(2) + '%;font-size:' + (t.size * fh).toFixed(1) + 'px">' + t.ch + '</div>';
    });
    ol.innerHTML = html;
  }

  function renderRatios() {
    const row = $('edRatios'); if (!row) return;
    row.innerHTML = RATIOS.map(([k, l]) =>
      '<button type="button" class="ed-ratio' + (S && S.ratio === k ? ' active' : '') + '" data-ratio="' + k + '"><b>' + k + '</b><span>' + l + '</span></button>').join('');
  }

  function renderPresets() {
    const grid = $('edPresets'); if (!grid) return;
    if (!S) { grid.innerHTML = ''; return; }
    grid.innerHTML = PRESETS.map(([k, l, css]) =>
      '<button type="button" class="ed-preset' + (S.filter === k ? ' active' : '') + '" data-preset="' + k + '" title="Filter ' + l + '">'
      + '<img src="' + S.src + '" alt="" style="filter:' + (css || 'none') + '"><span>' + l + '</span></button>').join('');
  }

  function renderAdjust() {
    if (!S) return;
    [['edAdjB', 'b'], ['edAdjC', 'c'], ['edAdjS', 's'], ['edAdjW', 'w']].forEach(([id, k]) => {
      const el = $(id); if (el) el.value = String(S.adj[k]);
      const v = $(id + 'Val'); if (v) v.textContent = (k === 'w' ? S.adj[k] + '%' : S.adj[k] + '%');
    });
  }

  function renderSelBox() {
    const box = $('edSelBox'); if (!box) return;
    if (!S || !S.sel) { box.hidden = true; return; }
    const isText = S.sel.type === 'text';
    const it = (isText ? S.texts : S.sticks).find((x) => x.id === S.sel.id);
    if (!it) { box.hidden = true; return; }
    box.hidden = false;
    if ($('edSelTextBox')) $('edSelTextBox').hidden = !isText;
    if (isText && $('edSelText')) $('edSelText').value = it.str;
    if ($('edSelSize')) $('edSelSize').value = String(Math.round(it.size * 100));
    if ($('edSelSizeVal')) $('edSelSizeVal').textContent = Math.round(it.size * 100) + '%';
    if ($('edSelFont')) $('edSelFont').value = it.font;
    box.querySelectorAll('.ed-swatch').forEach((b) => b.classList.toggle('active', isText && b.dataset.color === it.color));
  }

  function renderAll() { renderStage(); renderOverlay(); renderRatios(); renderPresets(); renderAdjust(); renderSelBox(); }
  window.renderEditor = function renderEditor() { if (S) renderAll(); };

  // ---------- pemuatan gambar ----------
  function handleFiles(files) {
    const f = files && files[0];
    if (!f || !(/^image\//.test(f.type) || /\.(png|jpe?g|webp|gif)$/i.test(f.name || ''))) { window.toast?.('Pilih file gambar ya — JPG, PNG, atau WebP.'); return; }
    const r = new FileReader();
    r.onload = () => window.sherlyEditorOpenImage(String(r.result));
    r.onerror = () => window.toast?.('Gagal membaca file gambar.');
    r.readAsDataURL(f);
  }
  $('edPickBtn')?.addEventListener('click', () => $('edFileInput')?.click());
  $('edEmpty')?.addEventListener('click', () => $('edFileInput')?.click());
  $('edEmpty')?.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('edFileInput')?.click(); } });
  $('edChangeBtn')?.addEventListener('click', () => $('edFileInput')?.click());
  $('edFileInput')?.addEventListener('change', (e) => { handleFiles(e.target.files); e.target.value = ''; });
  const wrapEl = $('edStageWrap');
  wrapEl?.addEventListener('dragover', (e) => { e.preventDefault(); });
  wrapEl?.addEventListener('drop', (e) => { e.preventDefault(); handleFiles(e.dataTransfer?.files); });

  // ---------- interaksi panggung: geser foto, zoom, pilih & geser item ----------
  function stagePoint(e) {
    const rect = ($('edStage') || {}).getBoundingClientRect ? $('edStage').getBoundingClientRect() : { left: 0, top: 0 };
    return { x: e.clientX - (rect.left || 0), y: e.clientY - (rect.top || 0) };
  }
  function startDrag(e, kind, id) {
    if (!S) return;
    if (kind === 'img') { drag = { kind, sx: e.clientX, sy: e.clientY, ox: S.x, oy: S.y }; }
    else {
      const it = (kind === 'text' ? S.texts : S.sticks).find((x) => x.id === id);
      if (!it) return;
      S.sel = { type: kind, id };
      drag = { kind, id, sx: e.clientX, sy: e.clientY, ox: it.x * fw, oy: it.y * fh };
      renderOverlay(); renderSelBox();
    }
    e.preventDefault();
  }
  const stage = () => $('edStage');
  stage()?.addEventListener('mousedown', (e) => { if (!e.target.closest('.ed-it')) { S && (S.sel = null); renderOverlay(); renderSelBox(); startDrag(e, 'img'); } });
  $('edOverlay')?.addEventListener('mousedown', (e) => {
    const el = e.target.closest('.ed-it'); if (!el || !S) return;
    e.stopPropagation();
    startDrag(e, el.dataset.kind, el.dataset.id);
  });
  function onMove(e) {
    if (!drag || !S) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (drag.kind === 'img') { S.x = drag.ox + dx; S.y = drag.oy + dy; renderStage(); }
    else {
      const it = (drag.kind === 'text' ? S.texts : S.sticks).find((x) => x.id === drag.id);
      if (!it) return;
      it.x = Math.min(0.98, Math.max(0.02, (drag.ox + dx) / fw));
      it.y = Math.min(0.98, Math.max(0.02, (drag.oy + dy) / fh));
      renderOverlay();
    }
  }
  function onUp() { drag = null; }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  stage()?.addEventListener('touchstart', (e) => { if (!e.target.closest('.ed-it') && e.touches[0]) { S && (S.sel = null); renderOverlay(); renderSelBox(); startDrag(e.touches[0], 'img'); } }, { passive: false });
  $('edOverlay')?.addEventListener('touchstart', (e) => {
    const el = e.target.closest('.ed-it'); if (!el || !S || !e.touches[0]) return;
    e.stopPropagation();
    startDrag(e.touches[0], el.dataset.kind, el.dataset.id);
  }, { passive: false });
  document.addEventListener('touchmove', (e) => { if (drag && e.touches[0]) { onMove(e.touches[0]); e.preventDefault(); } }, { passive: false });
  document.addEventListener('touchend', onUp);

  $('edZoom')?.addEventListener('input', (e) => { if (!S) return; S.zoom = Math.min(4, Math.max(1, (Number(e.target.value) || 100) / 100)); renderStage(); });

  // ---------- panel kanan ----------
  $('edRatios')?.addEventListener('click', (e) => {
    const b = e.target.closest('.ed-ratio'); if (!b || !S) return;
    S.ratio = b.dataset.ratio; renderAll();
  });
  $('edPresets')?.addEventListener('click', (e) => {
    const b = e.target.closest('.ed-preset'); if (!b || !S) return;
    S.filter = b.dataset.preset; renderStage(); renderPresets();
  });
  [['edAdjB', 'b'], ['edAdjC', 'c'], ['edAdjS', 's'], ['edAdjW', 'w']].forEach(([id, k]) => {
    $(id)?.addEventListener('input', (e) => {
      if (!S) return;
      S.adj[k] = Math.max(0, Number(e.target.value) || 0);
      renderStage();
      const v = $(id + 'Val'); if (v) v.textContent = S.adj[k] + '%';
    });
  });
  $('edAdjReset')?.addEventListener('click', () => { if (!S) return; S.adj = { b: 100, c: 100, s: 100, w: 0 }; renderStage(); renderAdjust(); });

  $('edAddTextBtn')?.addEventListener('click', () => {
    if (!S) return;
    const id = 't' + (++uid) + Date.now().toString(36);
    S.texts.push({ id, str: 'Tulis teksmu', x: 0.5, y: 0.4, size: 0.07, color: '#ffffff', font: 'Inter' });
    S.sel = { type: 'text', id };
    renderOverlay(); renderSelBox();
    $('edSelText')?.focus(); $('edSelText')?.select();
  });
  $('edEmojis')?.addEventListener('click', (e) => {
    const b = e.target.closest('.ed-emoji'); if (!b || !S) return;
    const id = 's' + (++uid) + Date.now().toString(36);
    S.sticks.push({ id, ch: b.dataset.ch, x: 0.5, y: 0.55, size: 0.14 });
    S.sel = { type: 'stick', id };
    renderOverlay(); renderSelBox();
  });

  $('edSelText')?.addEventListener('input', (e) => {
    if (!S || !S.sel || S.sel.type !== 'text') return;
    const it = S.texts.find((x) => x.id === S.sel.id); if (!it) return;
    it.str = e.target.value.slice(0, 300); renderOverlay();
  });
  $('edSelSize')?.addEventListener('input', (e) => {
    if (!S || !S.sel) return;
    const it = (S.sel.type === 'text' ? S.texts : S.sticks).find((x) => x.id === S.sel.id); if (!it) return;
    it.size = Math.min(0.4, Math.max(0.02, (Number(e.target.value) || 5) / 100)); renderOverlay();
    const sv = $('edSelSizeVal'); if (sv) sv.textContent = Math.round(it.size * 100) + '%';
  });
  $('edSelFont')?.addEventListener('change', (e) => {
    if (!S || !S.sel || S.sel.type !== 'text') return;
    const it = S.texts.find((x) => x.id === S.sel.id); if (!it) return;
    it.font = FONTS.some(([k]) => k === e.target.value) ? e.target.value : 'Inter'; renderOverlay();
  });
  $('edSelColors')?.addEventListener('click', (e) => {
    const b = e.target.closest('.ed-swatch'); if (!b || !S || !S.sel || S.sel.type !== 'text') return;
    const it = S.texts.find((x) => x.id === S.sel.id); if (!it) return;
    it.color = b.dataset.color; renderOverlay(); renderSelBox();
  });
  // D-154: geser presisi — tombol panah (HP-friendly) & keyboard; ⊙ = tengahkan.
  function nudge(dx, dy, center) {
    if (!S || !S.sel) return;
    const it = (S.sel.type === 'text' ? S.texts : S.sticks).find((x) => x.id === S.sel.id); if (!it) return;
    if (center) { it.x = 0.5; it.y = 0.5; }
    else {
      it.x = Math.min(0.98, Math.max(0.02, it.x + dx));
      it.y = Math.min(0.98, Math.max(0.02, it.y + dy));
    }
    renderOverlay();
  }
  $('edNudge')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-nudge]'); if (!b) return;
    const n = b.dataset.nudge;
    if (n === 'left') nudge(-0.01, 0);
    else if (n === 'right') nudge(0.01, 0);
    else if (n === 'up') nudge(0, -0.01);
    else if (n === 'down') nudge(0, 0.01);
    else if (n === 'center') nudge(0, 0, true);
  });

  $('edSelDel')?.addEventListener('click', () => {
    if (!S || !S.sel) return;
    if (S.sel.type === 'text') S.texts = S.texts.filter((x) => x.id !== S.sel.id);
    else S.sticks = S.sticks.filter((x) => x.id !== S.sel.id);
    S.sel = null; renderOverlay(); renderSelBox();
    window.toast?.('Item dihapus.');
  });

  document.addEventListener('keydown', (e) => {
    if (!S) return;
    const tag = (e.target && e.target.tagName) || '';
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
    if (e.key === 'Escape') { S.sel = null; renderOverlay(); renderSelBox(); }
    if (S.sel && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      const step = e.shiftKey ? 0.05 : 0.01;
      nudge(e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0, e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0);
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) {
      if (S.sel.type === 'text') S.texts = S.texts.filter((x) => x.id !== S.sel.id);
      else S.sticks = S.sticks.filter((x) => x.id !== S.sel.id);
      S.sel = null; renderOverlay(); renderSelBox();
    }
  });

  // ---------- reset & ekspor ----------
  $('edResetBtn')?.addEventListener('click', () => {
    if (!S) return;
    S = freshState(S.src, S.imgW, S.imgH);
    renderAll();
    window.toast?.('Editing direset — foto kembali seperti awal.');
  });

  // Render hasil akhir ke canvas — dipakai Unduh Hasil & Publikasikan (D-155 PR 2).
  async function buildExportCanvas() {
    const rw = RATIO_MAP[S.ratio] || [1, 1];
    const LONG = 1440;
    let W, H;
    if (rw[0] >= rw[1]) { W = LONG; H = Math.round(LONG * rw[1] / rw[0]); } else { H = LONG; W = Math.round(LONG * rw[0] / rw[1]); }
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return { error: 'Browser ini tidak mendukung canvas — coba Chrome, Edge, atau Firefox terbaru.' };
    const base = Math.max(W / S.imgW, H / S.imgH);
    const t = base * S.zoom;
    const panScale = W / fw;
    const tx = (W - S.imgW * t) / 2 + S.x * panScale;
    const ty = (H - S.imgH * t) / 2 + S.y * panScale;
    let filterDipakai = true;
    if ('filter' in ctx) { try { ctx.filter = buildFilter(); } catch { filterDipakai = false; } }
    else filterDipakai = false;
    ctx.drawImage($('edPhoto'), tx, ty, S.imgW * t, S.imgH * t);
    if ('filter' in ctx) { try { ctx.filter = 'none'; } catch {} }
    try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch {}
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    S.texts.forEach((it) => {
      ctx.font = (FONT_WEIGHT[it.font] || 700) + ' ' + Math.round(it.size * H) + 'px ' + CANVAS_FONT[it.font];
      ctx.fillStyle = it.color;
      it.str.split('\n').forEach((line, i, arr) => ctx.fillText(line, it.x * W, it.y * H + (i - (arr.length - 1) / 2) * it.size * H * 1.15));
    });
    S.sticks.forEach((it) => {
      ctx.font = Math.round(it.size * H) + 'px serif';
      ctx.fillText(it.ch, it.x * W, it.y * H);
    });
    return { canvas, W, H, filterDipakai };
  }

  $('edExportBtn')?.addEventListener('click', async () => {
    if (!S) return;
    const btn = $('edExportBtn');
    btn.disabled = true; btn.textContent = 'Menyiapkan…';
    try {
      const out = await buildExportCanvas();
      if (out.error) { window.toast?.(out.error); return; }
      const url = out.canvas.toDataURL('image/jpeg', 0.92);
      const a = document.createElement('a');
      a.href = url; a.download = 'sherly-editor-' + new Date().toISOString().slice(0, 10) + '-' + Date.now().toString(36) + '.jpg';
      document.body.appendChild(a); a.click(); a.remove();
      window.toast?.('Hasil editing terunduh (' + out.W + '×' + out.H + ' px) — cek folder Download-mu.');
      if (!out.filterDipakai) window.toast?.('Catatan: browser ini menerapkan filter di pratinjau saja.');
    } finally {
      btn.disabled = false; btn.textContent = 'Unduh Hasil';
    }
  });

  // Publikasikan: hasil render Editor dibawa ke modal Cloud Publish (D-155 PR 2).
  $('edPublishBtn')?.addEventListener('click', async () => {
    if (!S) return;
    if (!window.sherlyPublishOpen) { window.toast?.('Modul Cloud Publish belum siap.'); return; }
    const btn = $('edPublishBtn');
    btn.disabled = true;
    try {
      const out = await buildExportCanvas();
      if (out.error) { window.toast?.(out.error); return; }
      const url = out.canvas.toDataURL('image/jpeg', 0.92);
      window.sherlyPublishOpen({ image: url, from: 'Editor' });
      window.toast?.('Hasil Editor dilampirkan — lengkapi judulnya lalu Simpan.');
    } finally { btn.disabled = false; }
  });

  // ---------- init statis ----------
  (function init() {
    const em = $('edEmojis');
    if (em) em.innerHTML = EMOJIS.map((c) => '<button type="button" class="ed-emoji" data-ch="' + c + '" title="Sticker ' + c + '">' + c + '</button>').join('');
    const cl = $('edSelColors');
    if (cl) cl.innerHTML = COLORS.map((c) => '<button type="button" class="ed-swatch' + (c === '#ffffff' ? ' active' : '') + '" data-color="' + c + '" style="background:' + c + '" aria-label="Warna ' + c + '"></button>').join('');
    const f = $('edSelFont');
    if (f) f.innerHTML = FONTS.map(([k, l]) => '<option value="' + k + '" style="font-family:' + CANVAS_FONT[k] + '">' + l + '</option>').join('');
    const pick = $('edPickIco'); if (pick) pick.innerHTML = icon('images');
    const rst = $('edResetIco'); if (rst) rst.innerHTML = icon('refresh-cw');
    const add = $('edAddIco'); if (add) add.innerHTML = icon('plus');
  })();
})();
