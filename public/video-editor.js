// Editor Video ala CapCut/IG Edits (D-158) — HP-friendly, semua diproses di perangkat.
// Multi-klip + trim + filter + teks + ekspor via MediaRecorder (webm/mp4).
// Helper murni ada di video-editor-core.js (window.VE_CORE). Dipanggil go('Editor Video') -> window.renderVideoEditor().
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const CORE = () => window.VE_CORE || {};
  const COLORS = ['#ffffff', '#0a1220', '#ffd0ec', '#f044a8'];
  const PX_PER_SEC = 90; // lebar kartu klip per detik di timeline
  const MAX_CLIPS = 12;

  let V = { clips: [], ratio: '9:16', filter: 'normal', texts: [], selItem: null, selClip: null, playing: false, cur: -1, curLocal: 0, underIdx: -1, underEpoch: -1, tlEpoch: 0, exporting: false, cancelExport: false };
  let uid = 0;

  const readyClips = () => V.clips.filter((c) => c.ready);
  const fmtT = (x) => (CORE().fmtTime ? CORE().fmtTime(x) : String(x));
  const filterCss = () => ((CORE().VE_FILTERS || []).find((f) => f[0] === V.filter) || ['', '', ''])[2];

  // ---------- tambah klip ----------
  function addFiles(files) {
    const list = Array.from(files || []).filter((f) => f && /^video\//i.test(f.type || ''));
    if (!list.length) { window.toast?.('Pilih file video ya (MP4/MOV/WebM).'); return; }
    for (const f of list) {
      if (V.clips.length >= MAX_CLIPS) { window.toast?.('Maksimal ' + MAX_CLIPS + ' klip per video — ekspor dulu sisanya.'); break; }
      const url = URL.createObjectURL(f);
      const clip = { id: 'c' + (++uid), url, name: f.name || 'klip', dur: 0, start: 0, end: 0, muted: false, thumb: '', vw: 0, vh: 0, ready: false };
      V.clips.push(clip);
      loadMeta(clip);
    }
    renderAll();
  }
  window.sherlyVeAddFiles = addFiles;

  function loadMeta(clip) {
    const el = document.createElement('video');
    el.preload = 'metadata'; el.muted = true; el.playsInline = true; el.src = clip.url;
    let settled = false;
    const fail = (msg) => { if (settled) return; settled = true; window.toast?.(msg); V.clips = V.clips.filter((c) => c !== clip); renderAll(); };
    el.addEventListener('error', () => fail('Klip "' + clip.name + '" gagal dibuka — coba MP4/MOV/WebM.'), { once: true });
    el.addEventListener('loadedmetadata', () => {
      if (settled) return;
      const dur = el.duration;
      if (!isFinite(dur) || dur < (CORE().MIN_SEG || 0.5)) return fail('Klip "' + clip.name + '" terlalu pendek / formatnya belum didukung.');
      settled = true;
      clip.dur = dur; clip.vw = el.videoWidth || 720; clip.vh = el.videoHeight || 1280;
      const t = CORE().clampTrim ? CORE().clampTrim(dur, 0, dur) : { start: 0, end: dur };
      clip.start = t.start; clip.end = t.end; clip.ready = true;
      // thumbnail: seek 0.1s lalu gambar ke kanvas kecil
      const grab = () => {
        try {
          const cv = document.createElement('canvas'); cv.width = 160; cv.height = 90;
          const cx = cv.getContext && cv.getContext('2d');
          if (cx) { const f = CORE().coverFit ? CORE().coverFit(clip.vw, clip.vh, 160, 90) : { dx: 0, dy: 0, dw: 160, dh: 90 }; cx.drawImage(el, f.dx, f.dy, f.dw, f.dh); clip.thumb = cv.toDataURL('image/jpeg', 0.6); }
        } catch {}
        el.removeAttribute('src'); el.load?.();
        renderAll();
      };
      el.addEventListener('seeked', grab, { once: true });
      try { el.currentTime = Math.min(0.1, dur / 2); } catch { grab(); }
      setTimeout(grab, 2500); // jaga-jaga seeked tak terpicu
    });
    setTimeout(() => { if (!settled && !clip.ready) fail('Klip "' + clip.name + '" terlalu lama dimuat — dilewati.'); }, 12000);
  }

  // ---------- pratinjau ----------
  function loadClip(i, opts = {}) {
    const ready = readyClips();
    if (i < 0 || i >= ready.length) { V.cur = -1; return; }
    const c = ready[i];
    V.cur = i;
    V.curLocal = opts.localT || 0;
    const el = $('veVideo');
    if (!el) return;
    el.muted = !!c.muted;
    if (el.dataset.veSrc !== c.url) {
      el.dataset.veSrc = c.url;
      el.src = c.url;
      el.onloadedmetadata = () => { try { el.currentTime = c.start + (opts.localT || 0); } catch {} const pr = el.play?.(); if (pr && pr.catch) pr.catch(() => {}); };
    } else {
      try { el.currentTime = c.start + (opts.localT || 0); } catch {}
      if (V.playing) { const pr = el.play?.(); if (pr && pr.catch) pr.catch(() => {}); }
    }
  }
  function globalTime() {
    const ready = readyClips();
    if (V.cur < 0 || !ready[V.cur]) return 0;
    let acc = 0;
    for (let i = 0; i < V.cur; i++) acc += ready[i].end - ready[i].start;
    const el = $('veVideo');
    const len = Math.round((ready[V.cur].end - ready[V.cur].start) * 1000) / 1000;
    const local = el && el.readyState >= 1
      ? Math.min(Math.max(el.currentTime - ready[V.cur].start, 0), len)
      : Math.min(Math.max(V.curLocal || 0, 0), len);
    return acc + local;
  }
  function tick() {
    const vEl = $('videoView');
    if (vEl && !vEl.classList.contains('active')) { requestAnimationFrame(tick); return; } // hemat CPU saat halaman lain
    const ready = readyClips();
    const total = CORE().timelineDuration ? CORE().timelineDuration(ready) : 0;
    const t = globalTime();
    const timeEl = $('veTime'); if (timeEl) timeEl.textContent = fmtT(t) + ' / ' + fmtT(total);
    const pos = $('vePos'); if (pos) pos.style.width = (total > 0 ? Math.min(100, (t / total) * 100) : 0) + '%';
    // penggaris: garis playhead + gelembung waktu + klip tersorot (target ✂ Bagi)
    const pl = $('vePlayline');
    if (pl) {
      pl.style.left = (total > 0 ? Math.min(100, (t / total) * 100) : 0) + '%';
      const bub = $('vePlTime'); if (bub) bub.textContent = fmtT(t);
      const at = (CORE().clipAt && total > 0) ? CORE().clipAt(ready, t) : null;
      const idx = at ? at.index : -1;
      if (idx !== V.underIdx || V.underEpoch !== V.tlEpoch) {
        V.underIdx = idx;
        V.underEpoch = V.tlEpoch;
        document.querySelectorAll('#veTimeline .ve-clip').forEach((card) => {
          card.classList.toggle('under', Number(card.dataset.i) === V.clips.indexOf(ready[idx]));
        });
      }
      if (V.playing) {
        const wrap = $('veTlWrap');
        if (wrap && pl.offsetLeft > wrap.scrollLeft + wrap.clientWidth - 48) wrap.scrollLeft = pl.offsetLeft - 80;
      }
    }
    if (V.playing && V.cur >= 0 && ready[V.cur]) {
      const el = $('veVideo');
      const c = ready[V.cur];
      if (el && (el.currentTime >= c.end - 0.03 || el.ended)) {
        if (V.cur + 1 < ready.length) loadClip(V.cur + 1, { localT: 0 });
        else { el.pause?.(); V.playing = false; updatePlayBtn(); loadClip(0, { localT: 0 }); }
      }
    }
    requestAnimationFrame(tick);
  }

  // Lompat pratinjau ke waktu global t (detik) di timeline.
  function seekGlobal(t) {
    const ready = readyClips();
    if (!ready.length) return;
    const total = CORE().timelineDuration ? CORE().timelineDuration(ready) : 0;
    const tt = Math.min(Math.max(Number(t) || 0, 0), Math.max(0, total - 0.05));
    const at = CORE().clipAt ? CORE().clipAt(ready, tt) : null;
    if (!at) return;
    if (V.cur !== at.index) loadClip(at.index, { localT: at.localT });
    else {
      const el = $('veVideo');
      V.curLocal = at.localT;
      if (el) { try { el.currentTime = at.clip.start + at.localT; } catch {} }
    }
  }

  function updatePlayBtn() {
    const b = $('vePlayBtn'); if (!b) return;
    b.textContent = V.playing ? '⏸' : '▶';
    b.setAttribute('aria-label', V.playing ? 'Jeda' : 'Putar');
  }

  // ---------- overlay teks ----------
  function renderOverlays() {
    const stage = $('veStage'); if (!stage) return;
    stage.querySelectorAll('.ve-it').forEach((n) => n.remove());
    const H = stage.clientHeight || 1;
    for (const it of V.texts) {
      const d = document.createElement('div');
      d.className = 've-it' + (V.selItem === it.id ? ' sel' : '');
      d.dataset.veId = it.id;
      d.textContent = it.str;
      const F = CORE().VFONTS || { family: {}, weight: {} };
      d.style.fontFamily = F.family[it.font] || 'Inter, Arial, sans-serif';
      d.style.fontWeight = F.weight[it.font] || 700;
      d.style.color = it.color;
      d.style.fontSize = Math.max(10, Math.round(it.size * H)) + 'px';
      d.style.left = (it.x * 100) + '%';
      d.style.top = (it.y * 100) + '%';
      stage.appendChild(d);
      bindDrag(d, it);
    }
    renderItemBar();
  }

  function bindDrag(node, it) {
    node.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      V.selItem = it.id;
      V.selClip = null;
      renderOverlays(); renderClipBar();
      node.setPointerCapture?.(e.pointerId);
      const move = (ev) => {
        const stage = $('veStage'); if (!stage) return;
        const r = stage.getBoundingClientRect();
        it.x = Math.min(0.98, Math.max(0.02, (ev.clientX - r.left) / r.width));
        it.y = Math.min(0.98, Math.max(0.02, (ev.clientY - r.top) / r.height));
        node.style.left = (it.x * 100) + '%';
        node.style.top = (it.y * 100) + '%';
      };
      const up = () => { node.removeEventListener('pointermove', move); node.removeEventListener('pointerup', up); node.removeEventListener('pointercancel', up); };
      node.addEventListener('pointermove', move);
      node.addEventListener('pointerup', up);
      node.addEventListener('pointercancel', up);
    });
  }

  function selectedItem() {
    return V.texts.find((x) => x.id === V.selItem) || null;
  }
  function renderItemBar() {
    const bar = $('veItemBar'); if (!bar) return;
    const it = selectedItem();
    bar.hidden = !it;
    if (!it) return;
    if ($('veItemText') && document.activeElement !== $('veItemText')) $('veItemText').value = it.str;
    if ($('veItemFont')) $('veItemFont').value = it.font;
    if ($('veItemSize')) $('veItemSize').value = String(Math.round(it.size * 1000) / 1000);
  }

  // ---------- timeline ----------
  function clipCard(c, i) {
    const len = Math.round(Math.max(0, c.end - c.start) * 1000) / 1000;
    const w = Math.round(len * PX_PER_SEC);
    const sel = V.selClip === c.id ? ' sel' : '';
    const inner = c.ready
      ? (c.thumb ? '<img src="' + c.thumb + '" alt="" draggable="false">' : '')
        + (c.muted ? '<span class="ve-mute-badge">🔇</span>' : '')
        + '<span class="ve-clip-len">' + fmtT(len) + '</span>'
      : '<span class="ve-clip-len">Memuat…</span>';
    return '<div class="ve-clip' + sel + '" data-i="' + i + '" style="width:' + w + 'px">' + inner
      + (c.ready ? '<span class="ve-grip grip-l" data-grip="l" title="Tarik untuk potong awal">⋮⋮</span><span class="ve-grip grip-r" data-grip="r" title="Tarik untuk potong akhir">⋮⋮</span>' : '')
      + '</div>';
  }
  // Penggaris waktu ala CapCut di atas timeline + garis playhead.
  function renderRuler() {
    const ruler = $('veRuler'); const pl = $('vePlayline');
    const total = CORE().timelineDuration ? CORE().timelineDuration(readyClips()) : 0;
    const body = $('veTlBody');
    if (body) body.style.width = Math.max(0, Math.round(total * PX_PER_SEC)) + 'px';
    if (!ruler) return;
    if (pl) pl.hidden = total <= 0;
    if (total <= 0) { ruler.innerHTML = ''; return; }
    const labelStep = total <= 30 ? 5 : total <= 120 ? 10 : 30;
    const tickStep = total <= 120 ? 1 : 5;
    let html = '';
    for (let t = 0; t <= total + 0.001; t += tickStep) {
      const pct = (t / total) * 100;
      const isLabel = Math.abs(t / labelStep - Math.round(t / labelStep)) < 1e-6;
      html += '<span class="ve-tick' + (isLabel ? ' big' : '') + '" style="left:' + pct + '%"></span>';
      if (isLabel) {
        const lbl = Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
        html += '<span class="ve-tick-label" style="left:' + pct + '%">' + lbl + '</span>';
      }
    }
    ruler.innerHTML = html;
  }

  function renderTimeline() {
    const tl = $('veTimeline'); if (!tl) return;
    V.tlEpoch++;
    tl.innerHTML = V.clips.map(clipCard).join('');
    // pilih klip (bukan grip)
    tl.querySelectorAll('.ve-clip').forEach((card) => {
      card.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.ve-grip')) return;
        const i = Number(card.dataset.i);
        const c = V.clips[i]; if (!c || !c.ready) return;
        V.selClip = c.id; V.selItem = null;
        const ri = readyClips().indexOf(c);
        loadClip(ri, { localT: 0 });
        renderTimeline(); renderOverlays(); renderClipBar();
      });
      // trim: drag grip
      card.querySelectorAll('.ve-grip').forEach((grip) => {
        grip.addEventListener('pointerdown', (e) => {
          e.preventDefault(); e.stopPropagation();
          const i = Number(card.dataset.i);
          const c = V.clips[i]; if (!c || !c.ready) return;
          V.selClip = c.id; V.selItem = null;
          grip.setPointerCapture?.(e.pointerId);
          const side = grip.dataset.grip;
          const x0 = e.clientX;
          const s0 = c.start, e0 = c.end;
          const lenEl = card.querySelector('.ve-clip-len');
          const move = (ev) => {
            const ds = (ev.clientX - x0) / PX_PER_SEC;
            if (side === 'l') c.start = Math.min(s0 + ds, e0 - (CORE().MIN_SEG || 0.5));
            else c.end = Math.max(e0 + ds, s0 + (CORE().MIN_SEG || 0.5));
            c.start = Math.max(0, c.start); c.end = Math.min(c.dur, c.end);
            if (lenEl) lenEl.textContent = fmtT(Math.round(Math.max(0, c.end - c.start) * 1000) / 1000);
            card.style.width = Math.round(Math.max(0, c.end - c.start) * PX_PER_SEC) + 'px';
          };
          const up = () => {
            grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up);
            const t = CORE().clampTrim ? CORE().clampTrim(c.dur, c.start, c.end) : { start: c.start, end: c.end };
            c.start = t.start; c.end = t.end;
            renderTimeline(); renderClipBar();
            const ri = readyClips().indexOf(c);
            if (ri >= 0 && ri === V.cur) { try { $('veVideo').currentTime = c.start; } catch {} }
          };
          grip.addEventListener('pointermove', move);
          grip.addEventListener('pointerup', up);
          grip.addEventListener('pointercancel', up);
        });
      });
    });
    renderClipBar();
    renderRuler();
  }

  function renderClipBar() {
    const bar = $('veClipBar'); if (!bar) return;
    const c = V.clips.find((x) => x.id === V.selClip);
    bar.hidden = !c;
    if (!c) return;
    if ($('veClipMute')) $('veClipMute').textContent = c.muted ? '🔇 Suara mati' : '🔊 Ada suara';
  }

  // ---------- bars & rows ----------
  function renderFilterRow() {
    const sel = $('veFilter'); if (!sel) return;
    sel.innerHTML = (CORE().VE_FILTERS || []).map(([k, l]) =>
      '<option value="' + k + '"' + (k === V.filter ? ' selected' : '') + '>' + l + '</option>').join('');
  }
  function applyStage() {
    const stage = $('veStage'); const el = $('veVideo');
    if (stage) {
      const [rw, rh] = String(V.ratio).split(':').map(Number);
      const avail = (stage.parentElement && stage.parentElement.clientWidth) || 360;
      const maxW = rw >= 1 ? avail : Math.min(400, avail);
      // Tinggi pratinjau dibatasi biar video & penggaris timeline terlihat bersamaan:
      // desktop (layout 2 kolom ala CapCut/OpenCut, D-162) ±60% layar, HP ±44% (D-161).
      const desktop = (window.innerWidth || 0) >= 1024;
      const maxH = Math.max(200, Math.round((window.innerHeight || 700) * (desktop ? 0.6 : 0.44)));
      const w = Math.max(120, Math.min(maxW, Math.round(maxH * rw / rh)));
      stage.style.width = w + 'px';
      stage.style.aspectRatio = String(V.ratio).replace(':', ' / ');
      stage.style.maxWidth = 'none';
    }
    if (el) el.style.filter = filterCss() || 'none';
  }

  function renderAll() {
    const empty = $('veEmpty'); const wrap = $('veWrap');
    const has = V.clips.length > 0;
    if (empty) empty.hidden = has;
    if (wrap) wrap.hidden = !has;
    applyStage();
    renderOverlays();
    renderTimeline();
    renderFilterRow();
    const ex = $('veExportBtn'); if (ex) ex.disabled = !readyClips().length || V.exporting;
    const sp = $('veSplitBtn'); if (sp) sp.hidden = !readyClips().length;
    if (V.cur < 0 && readyClips().length) loadClip(0, { localT: 0 });
  }
  window.renderVideoEditor = function renderVideoEditor() { renderAll(); };

  // ---------- ekspor ----------
  function seekTo(el, t) {
    return new Promise((res) => {
      let done = false;
      const fin = () => { if (done) return; done = true; el.removeEventListener('seeked', fin); res(); };
      el.addEventListener('seeked', fin);
      try { el.currentTime = t; } catch { fin(); }
      setTimeout(fin, 8000);
    });
  }
  function drawFrame(ctx, el, W, H) {
    ctx.fillStyle = '#0a1220';
    ctx.fillRect(0, 0, W, H);
    const vw = el.videoWidth || 720, vh = el.videoHeight || 1280;
    const f = CORE().coverFit ? CORE().coverFit(vw, vh, W, H) : { dx: 0, dy: 0, dw: W, dh: H };
    const css = filterCss();
    if (css && 'filter' in ctx) { try { ctx.filter = css; } catch {} }
    try { ctx.drawImage(el, f.dx, f.dy, f.dw, f.dh); } catch {}
    if ('filter' in ctx) { try { ctx.filter = 'none'; } catch {} }
    const F = CORE().VFONTS || { family: {}, weight: {} };
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    V.texts.forEach((it) => {
      ctx.font = (F.weight[it.font] || 700) + ' ' + Math.round(it.size * H) + 'px ' + (F.family[it.font] || 'Inter, Arial, sans-serif');
      ctx.fillStyle = it.color;
      it.str.split('\n').forEach((line, i, arr) => ctx.fillText(line, it.x * W, it.y * H + (i - (arr.length - 1) / 2) * it.size * H * 1.15));
    });
  }
  async function exportVideo() {
    if (V.exporting) { V.cancelExport = true; return; }
    const ready = readyClips();
    if (!ready.length) { window.toast?.('Tambahkan klip dulu ya.'); return; }
    if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) {
      window.toast?.('Browser ini belum mendukung ekspor video — coba Chrome/Edge Android terbaru.');
      return;
    }
    const picked = CORE().pickMime ? CORE().pickMime((m) => { try { return MediaRecorder.isTypeSupported(m); } catch { return false; } }) : null;
    if (!picked) { window.toast?.('Browser ini belum mendukung perekaman video — coba Chrome/Edge Android terbaru.'); return; }
    // hentikan pratinjau dulu
    const pv = $('veVideo'); try { pv && pv.pause(); } catch {}
    V.playing = false; updatePlayBtn();
    V.exporting = true; V.cancelExport = false;
    const btn = $('veExportBtn'); if (btn) { btn.disabled = false; btn.textContent = 'Batalkan'; }
    const progWrap = $('veProgWrap'); const progBar = $('veProgBar'); const progLabel = $('veProgLabel');
    if (progWrap) progWrap.hidden = false;

    const [W, H] = (CORE().VE_RATIOS || {})[V.ratio] || [1080, 1920];
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext && canvas.getContext('2d');
    const stream = canvas.captureStream(30);
    let ac = null, dest = null;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { ac = new AC(); dest = ac.createMediaStreamDestination(); if (ac.state === 'suspended') ac.resume?.().catch(() => {}); }
    } catch {}
    const tracks = [...stream.getVideoTracks()];
    if (dest && dest.stream.getAudioTracks().length) tracks.push(...dest.stream.getAudioTracks());
    let rec = null; const chunks = [];
    try {
      rec = new MediaRecorder(new MediaStream(tracks), { mimeType: picked.mime, videoBitsPerSecond: 8000000 });
    } catch {
      try { rec = new MediaRecorder(new MediaStream(tracks)); } catch { rec = null; }
    }
    if (!rec) {
      V.exporting = false; if (btn) { btn.textContent = 'Ekspor Video'; } if (progWrap) progWrap.hidden = true;
      window.toast?.('Perekaman tidak bisa dimulai di browser ini.');
      return;
    }
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise((res) => { rec.onstop = res; });
    const els = ready.map((c) => {
      const el = document.createElement('video');
      el.src = c.url; el.muted = !!c.muted; el.preload = 'auto'; el.playsInline = true;
      return { c, el };
    });
    const total = CORE().timelineDuration ? CORE().timelineDuration(ready) : 0;
    let doneSec = 0;
    const setProg = (sec) => {
      const p = total > 0 ? Math.min(100, Math.round((sec / total) * 100)) : 0;
      if (progBar) progBar.style.width = p + '%';
      if (progLabel) progLabel.textContent = (V.cancelExport ? 'Membatalkan… ' : 'Merekrender… ') + p + '% — biarkan halaman tetap terbuka ya';
    };
    rec.start(500);
    try {
      for (const { c, el } of els) {
        if (V.cancelExport) break;
        if (ac && !c.muted) { try { const src = ac.createMediaElementSource(el); src.connect(dest); src.connect(ac.destination); } catch {} }
        await seekTo(el, c.start);
        try { await el.play(); } catch {}
        await new Promise((resolve) => {
          const step = () => {
            if (V.cancelExport) { resolve(); return; }
            if (ctx) drawFrame(ctx, el, W, H);
            setProg(doneSec + Math.min(Math.max(el.currentTime - c.start, 0), c.end - c.start));
            if (el.currentTime >= c.end - 0.02 || el.ended) { resolve(); return; }
            requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        });
        el.pause?.();
        doneSec += c.end - c.start;
      }
    } finally {
      try { rec.stop(); } catch {}
      await stopped;
      els.forEach(({ el }) => { try { el.pause(); } catch {} el.removeAttribute('src'); try { el.load(); } catch {} });
      try { ac && ac.close(); } catch {}
    }
    if (progWrap) progWrap.hidden = true;
    V.exporting = false;
    if (btn) { btn.textContent = 'Ekspor Video'; btn.disabled = !readyClips().length; }
    if (V.cancelExport) { V.cancelExport = false; window.toast?.('Ekspor dibatalkan.'); return; }
    const blob = new Blob(chunks, { type: picked.mime.split(';')[0] });
    if (!blob.size) { window.toast?.('Ekspor gagal — coba lagi atau ganti browser.'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = CORE().exportName ? CORE().exportName(picked.ext) : 'sherly-video.webm';
    document.body.appendChild(a); a.click(); a.remove();
    window.toast?.('Video jadi (' + fmtT(total) + ', ' + (picked.ext === 'mp4' ? 'MP4' : 'WebM') + ') — cek folder Download-mu. Kalau mau tayang, unggah manual ke IG/editsmu.');
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 60000);
    loadClip(Math.max(0, V.cur), { localT: 0 });
  }

  // ---------- event ----------
  // scrub playhead: ketuk/geser bar posisi untuk pindah titik potong
  (() => {
    const wrap = $('vePosWrap'); if (!wrap) return;
    const frac = (ev) => {
      const r = wrap.getBoundingClientRect();
      return Math.min(1, Math.max(0, (ev.clientX - r.left) / Math.max(1, r.width)));
    };
    wrap.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const ready = readyClips();
      if (!ready.length) return;
      if (V.playing) { $('veVideo')?.pause?.(); V.playing = false; updatePlayBtn(); }
      const total = CORE().timelineDuration ? CORE().timelineDuration(ready) : 0;
      wrap.setPointerCapture?.(e.pointerId);
      const seek = (ev) => seekGlobal(frac(ev) * total);
      seek(e);
      const move = (ev) => seek(ev);
      const up = () => { wrap.removeEventListener('pointermove', move); wrap.removeEventListener('pointerup', up); wrap.removeEventListener('pointercancel', up); };
      wrap.addEventListener('pointermove', move);
      wrap.addEventListener('pointerup', up);
      wrap.addEventListener('pointercancel', up);
    });
  })();

  // Scrub ala CapCut: tarik garis playhead / ketuk-geser penggaris di atas timeline.
  (() => {
    const wrap = $('veTlWrap'); const body = $('veTlBody');
    if (!wrap || !body) return;
    const scrub = (ev) => {
      const r = body.getBoundingClientRect();
      if (r.width < 2) return;
      const frac = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
      const total = CORE().timelineDuration ? CORE().timelineDuration(readyClips()) : 0;
      seekGlobal(frac * total);
    };
    const begin = (e) => {
      if (!readyClips().length) return;
      if (e.target.closest && e.target.closest('.ve-clip')) return; // area kartu klip punya aksinya sendiri
      e.preventDefault();
      if (V.playing) { $('veVideo')?.pause?.(); V.playing = false; updatePlayBtn(); }
      wrap.setPointerCapture?.(e.pointerId);
      scrub(e);
      const move = (ev) => {
        scrub(ev);
        const wr = wrap.getBoundingClientRect();
        if (ev.clientX > wr.right - 34) wrap.scrollLeft += 10;
        else if (ev.clientX < wr.left + 34) wrap.scrollLeft -= 10;
      };
      const up = () => { wrap.removeEventListener('pointermove', move); wrap.removeEventListener('pointerup', up); wrap.removeEventListener('pointercancel', up); };
      wrap.addEventListener('pointermove', move);
      wrap.addEventListener('pointerup', up);
      wrap.addEventListener('pointercancel', up);
    };
    $('vePlayline')?.addEventListener('pointerdown', begin);
    $('veRuler')?.addEventListener('pointerdown', begin);
  })();

  // ✂ Bagi: potong klip di posisi garis playhead (tombol selalu terlihat di baris putar)
  $('veSplitBtn')?.addEventListener('click', () => {
    const ready = readyClips();
    if (!ready.length) return;
    const at = CORE().clipAt ? CORE().clipAt(ready, globalTime()) : null;
    if (!at) { window.toast?.('Putar/ggeser playhead ke dalam klip dulu ya.'); return; }
    const c = at.clip;
    const parts = CORE().splitAt ? CORE().splitAt(c, c.start + at.localT) : null;
    if (!parts) { window.toast?.('Titik bagi terlalu mepet ke ujung klip — geser playhead ke tengahnya dulu.'); return; }
    const i = V.clips.indexOf(c);
    if (i < 0) return;
    c.end = parts.left.end;
    V.clips.splice(i + 1, 0, { ...c, id: 'c' + (++uid), start: parts.right.start, end: parts.right.end });
    V.selClip = c.id;
    renderAll();
    window.toast?.('Klip dibagi dua ✂ — tap bagian yang tidak perlu lalu Hapus, atau trim lagi.');
  });

  $('veAddBtn')?.addEventListener('click', () => $('veFile')?.click());
  $('veAddInline')?.addEventListener('click', () => $('veFile')?.click());
  $('veFile')?.addEventListener('change', (e) => { addFiles(e.target.files || []); e.target.value = ''; });
  $('veRatio')?.addEventListener('change', (e) => { V.ratio = e.target.value || '9:16'; applyStage(); });
  $('veFilter')?.addEventListener('change', (e) => { V.filter = e.target.value || 'normal'; applyStage(); });
  $('veExportBtn')?.addEventListener('click', () => exportVideo());
  $('vePlayBtn')?.addEventListener('click', () => {
    const ready = readyClips();
    if (!ready.length) { window.toast?.('Tambahkan klip dulu ya.'); return; }
    const el = $('veVideo');
    if (V.playing) { el?.pause?.(); V.playing = false; }
    else {
      const atEnd = V.cur === ready.length - 1 && el && el.currentTime >= ready[V.cur].end - 0.05;
      if (V.cur < 0 || atEnd) loadClip(0, { localT: 0 });
      V.playing = true;
      const pr = el?.play?.();
      if (pr && pr.catch) pr.catch(() => { V.playing = false; updatePlayBtn(); window.toast?.('Gagal memutar — coba ketuk lagi.'); });
    }
    updatePlayBtn();
  });
  $('veAddText')?.addEventListener('click', () => {
    V.texts.push({ id: 't' + (++uid), str: 'Teks baru', font: 'Inter', size: 0.06, color: '#ffffff', x: 0.5, y: 0.82 });
    V.selItem = V.texts[V.texts.length - 1].id;
    renderOverlays();
    $('veItemText')?.focus();
  });
  $('veItemText')?.addEventListener('input', (e) => {
    const it = selectedItem(); if (!it) return;
    it.str = e.target.value.slice(0, 300);
    renderOverlays();
  });
  $('veItemFont')?.addEventListener('change', (e) => {
    const it = selectedItem(); if (!it) return;
    it.font = e.target.value;
    renderOverlays();
  });
  $('veItemSize')?.addEventListener('input', (e) => {
    const it = selectedItem(); if (!it) return;
    it.size = Math.min(0.25, Math.max(0.02, Number(e.target.value) || 0.06));
    renderOverlays();
  });
  (() => {
    const row = $('veItemColors'); if (!row) return;
    row.innerHTML = COLORS.map((c) => '<button type="button" class="ve-dot" data-c="' + c + '" style="background:' + c + '" aria-label="Warna ' + c + '"></button>').join('');
    row.addEventListener('click', (e) => {
      const b = e.target.closest('.ve-dot'); if (!b) return;
      const it = selectedItem(); if (!it) return;
      it.color = b.dataset.c;
      renderOverlays();
    });
  })();
  $('veItemDel')?.addEventListener('click', () => {
    V.texts = V.texts.filter((x) => x.id !== V.selItem);
    V.selItem = null;
    renderOverlays();
  });
  $('veClipMute')?.addEventListener('click', () => {
    const c = V.clips.find((x) => x.id === V.selClip); if (!c) return;
    c.muted = !c.muted;
    renderClipBar(); renderTimeline();
    if ($('veVideo')) $('veVideo').muted = !!c.muted;
  });
  $('veClipLeft')?.addEventListener('click', () => moveClip(-1));
  $('veClipRight')?.addEventListener('click', () => moveClip(1));
  function moveClip(dir) {
    const i = V.clips.findIndex((x) => x.id === V.selClip);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= V.clips.length) return;
    [V.clips[i], V.clips[j]] = [V.clips[j], V.clips[i]];
    renderTimeline(); renderOverlays();
  }
  $('veClipDel')?.addEventListener('click', () => {
    const i = V.clips.findIndex((x) => x.id === V.selClip);
    if (i < 0) return;
    if (!window.confirm('Hapus klip ini dari timeline?')) return;
    const [gone] = V.clips.splice(i, 1);
    try { URL.revokeObjectURL(gone.url); } catch {}
    V.selClip = null;
    renderAll();
    window.toast?.('Klip dihapus.');
  });
  document.addEventListener('keydown', (e) => {
    const it = selectedItem();
    if (!it || V.exporting) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const step = e.shiftKey ? 0.05 : 0.01;
    let used = true;
    if (e.key === 'ArrowLeft') it.x = Math.max(0.02, it.x - step);
    else if (e.key === 'ArrowRight') it.x = Math.min(0.98, it.x + step);
    else if (e.key === 'ArrowUp') it.y = Math.max(0.02, it.y - step);
    else if (e.key === 'ArrowDown') it.y = Math.min(0.98, it.y + step);
    else used = false;
    if (used) { e.preventDefault(); renderOverlays(); }
  });
  window.addEventListener('resize', () => { if ($('veWrap') && !$('veWrap').hidden) { applyStage(); renderOverlays(); } });

  // label grip & hint interaktif
  (function init() {
    const sel = $('veItemFont');
    if (sel) sel.innerHTML = ((CORE().VFONTS || {}).list || []).map(([k, l]) => '<option value="' + k + '">' + l + '</option>').join('');
    renderFilterRow();
    requestAnimationFrame(tick);
  })();
})();
