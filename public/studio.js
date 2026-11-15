// ===== Studio — Generator Foto & Video =====
// Komposer generatif ala referensi Open-Generative-AI (repo Anil-matcha), disesuaikan tema SherlyStudio:
// panel komposer (textarea + pil kontrol ber-popover) + grid hasil.
// Foto: nyata via POST /api/ai/image (Gemini image generation; kunci vault dulu, env fallback).
// Video: komposer siap, mesin video menyusul — sementara arahkan storyboard via Chat Sherly.
// Dipanggil go('Studio') -> window.renderStudio().
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (key) => {
    const paths = (typeof ICONS !== 'undefined' && ICONS[key]) || '';
    return '<span data-icon="' + key + '">' + (paths ? '<svg viewBox="0 0 24 24" aria-hidden="true">' + paths + '</svg>' : '') + '</span>';
  };
  const authHeaders = async () => {
    const t = (await window.sherlyGetAccessToken?.()) || window.sherlyStoredToken?.()?.access_token || '';
    return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + t };
  };

  const HKEY = 'sherly.studio.v1';
  const ASPECTS = [['1:1', 'Persegi (1:1)'], ['4:5', 'Potret feed (4:5)'], ['9:16', 'Reels / story (9:16)'], ['16:9', 'Landscape (16:9)']];
  const STYLES = {
    lifestyle: { label: 'Lifestyle', suffix: 'sehari-hari cozy dan estetik ala Bogor, cahaya alami, komposisi bersih dengan ruang bernapas' },
    beauty: { label: 'Beauty & Skincare', suffix: 'visual beauty & skincare yang bersih dan elegan, cahaya lembut, nuansa cream' },
    timeless: { label: 'Timeless Style', suffix: 'outfit elegan ala capsule wardrobe yang timeless, tidak dikendalikan tren musiman' },
    inspire: { label: 'Inspire & Grow', suffix: 'momen tumbuh menjadi kreator yang hangat dan inspiratif' },
    free: { label: 'Bebas', suffix: '' }
  };
  const DURATIONS = ['5 detik', '10 detik'];
  const SUGGESTIONS = [
    'Flatlay skincare pagi di meja kayu, cahaya jendela lembut, nuansa cream',
    'Sudut cafe cozy di Bogor, secangkir kopi latte dan buku terbuka',
    'Outfit knit beige di taman, golden hour, gaya potret timeless',
    'Meja kerja kreator rapi dengan kamera film dan moodboard'
  ];

  const state = { mode: 'photo', aspect: '4:5', style: 'lifestyle', duration: '5 detik' };
  let history = [];
  let popOpen = null;
  // Tutup popover saat klik di luar pil (sekali terdaftar di level modul).
  document.addEventListener('click', (e) => {
    if (popOpen && !e.target.closest('.st-pill-wrap')) { document.getElementById('stPop-' + popOpen)?.classList.remove('open'); popOpen = null; }
  });

  function loadHistory() { try { const a = JSON.parse(localStorage.getItem(HKEY)); history = Array.isArray(a) ? a : []; } catch { history = []; } }
  function saveHistory() {
    while (history.length > 6) history.pop();
    for (;;) {
      try { localStorage.setItem(HKEY, JSON.stringify(history)); return; }
      catch {
        if (history.length > 1) history.pop();
        else { try { localStorage.removeItem(HKEY); } catch {} return; }
      }
    }
  }

  function composedPrompt(raw) {
    let p = raw;
    const st = STYLES[state.style];
    if (st && st.suffix) p += '\n\nGaya visual: ' + st.suffix + '.';
    p += '\n(Komposisi gambar dengan rasio aspek ' + state.aspect + '.)';
    return p;
  }

  function aspectLabel() { const a = ASPECTS.find((x) => x[0] === state.aspect); return a ? a[0] : state.aspect; }
  function styleLabel() { return (STYLES[state.style] || STYLES.free).label; }

  function cardHtml(it) {
    const dataUrl = 'data:' + (it.mime || 'image/png') + ';base64,' + it.data;
    const ext = (it.mime || '').includes('jpeg') ? 'jpg' : 'png';
    return '<div class="st-card" data-id="' + esc(it.id) + '">'
      + '<img src="' + dataUrl + '" alt="' + esc(String(it.prompt).slice(0, 80)) + '" loading="lazy">'
      + '<div class="st-card-body">'
      + '<p>' + esc(it.prompt) + '</p>'
      + '<span class="st-card-meta">' + esc(it.aspect || '') + ' · ' + esc(it.style ? (STYLES[it.style] || {}).label || '' : '') + (it.provider ? ' · ' + esc(it.provider === 'kie' ? 'Kie AI' : it.provider === 'gemini' ? 'Gemini' : it.provider) : '') + (it.model ? ' · ' + esc(String(it.model).split('/').pop()) : '') + '</span>'
      + '<div class="st-card-actions">'
      + '<a class="st-act" href="' + dataUrl + '" download="sherly-studio-' + esc(it.id) + '.' + ext + '">' + icon('cloud-upload') + ' Unduh</a>'
      + '<button type="button" class="st-act" data-act="planner">' + icon('list-checks') + ' Ke Planner</button>'
      + '<button type="button" class="st-act danger" data-act="hapus">' + icon('x') + ' Hapus</button>'
      + '</div></div></div>';
  }

  function renderGrid() {
    const grid = $('stGrid'); if (!grid) return;
    if (!history.length) {
      grid.innerHTML = '<div class="st-empty">' + icon('image-plus') + '<b>Belum ada hasil</b><p>Tulis deskripsi konten di atas, atau mulai dari contoh:</p>'
        + '<div class="st-suggest">' + SUGGESTIONS.map((s) => '<button type="button" data-suggest="' + esc(s) + '">' + esc(s.slice(0, 42)) + '\u2026</button>').join('') + '</div></div>';
      grid.querySelectorAll('[data-suggest]').forEach((b) => b.addEventListener('click', () => { const t = $('stPrompt'); if (t) { t.value = b.dataset.suggest; t.focus(); } }));
      return;
    }
    grid.innerHTML = history.map(cardHtml).join('');
    grid.querySelectorAll('.st-card [data-act]').forEach((b) => b.addEventListener('click', () => {
      const card = b.closest('.st-card'); const id = card?.dataset.id;
      if (b.dataset.act === 'hapus') { history = history.filter((x) => x.id !== id); saveHistory(); renderGrid(); window.toast?.('Hasil dihapus dari Studio.'); }
      if (b.dataset.act === 'planner') {
        const it = history.find((x) => x.id === id); if (!it) return;
        try {
          const arr = JSON.parse(localStorage.getItem('sherly.planner.v1')) || [];
          arr.push({ id: 's' + Date.now(), title: String(it.prompt).slice(0, 60), platform: 'Instagram', date: new Date().toISOString().slice(0, 10), status: 'ide', notes: 'Dibuat di Studio \u2014 prompt: ' + it.prompt });
          localStorage.setItem('sherly.planner.v1', JSON.stringify(arr));
          window.toast?.('Masuk Planner sebagai ide \u2728');
        } catch { window.toast?.('Gagal menyimpan ke Planner.'); }
      }
    }));
  }

  function setMode(m) {
    state.mode = m;
    document.querySelectorAll('#studioRoot .st-tab').forEach((t) => t.classList.toggle('active', t.dataset.mode === m));
    const isVideo = m === 'video';
    const ta = $('stPrompt'); if (ta) ta.placeholder = isVideo ? 'cth: opening reels \u2014 Sherly berjalan masuk cafe, slow motion, cahaya hangat' : 'cth: flatlay skincare pagi di meja kayu, cahaya jendela lembut, nuansa cream';
    $('stDurPill')?.classList.toggle('st-hidden', !isVideo);
    $('stEnginePillWrap')?.classList.toggle('st-hidden', isVideo);
    $('stGenBtn')?.classList.toggle('st-hidden', isVideo);
    $('stVideoNote')?.classList.toggle('st-hidden', !isVideo);
    updatePillLabels();
  }

  function updatePillLabels() {
    const a = $('stAspectPill'), s = $('stStylePill'), d = $('stDurPill');
    if (a) a.querySelector('b').textContent = aspectLabel();
    if (s) s.querySelector('b').textContent = styleLabel();
    if (d) d.querySelector('b').textContent = state.duration;
    const e = $('stEnginePill'); if (e) e.querySelector('b').textContent = state.engine === 'auto' ? 'Otomatis' : (state.engine === 'kie' ? 'Kie AI' : 'Gemini');
  }

  function togglePop(which) {
    ['aspect', 'style', 'dur', 'engine'].forEach((k) => { const el = $('stPop-' + k); if (el && k !== which) el.classList.remove('open'); });
    const el = $('stPop-' + which); if (el) el.classList.toggle('open');
    popOpen = el?.classList.contains('open') ? which : null;
  }

  function buildPop(which) {
    const el = $('stPop-' + which); if (!el) return;
    let items = '';
    if (which === 'aspect') items = ASPECTS.map(([v, l]) => '<button type="button" data-v="' + v + '" class="' + (state.aspect === v ? 'on' : '') + '">' + l + '</button>').join('');
    if (which === 'style') items = Object.keys(STYLES).map((k) => '<button type="button" data-v="' + k + '" class="' + (state.style === k ? 'on' : '') + '">' + STYLES[k].label + '</button>').join('');
    if (which === 'dur') items = DURATIONS.map((v) => '<button type="button" data-v="' + esc(v) + '" class="' + (state.duration === v ? 'on' : '') + '">' + v + '</button>').join('');
    if (which === 'engine') items = ENGINES.map(([v, l]) => '<button type="button" data-v="' + v + '" class="' + (state.engine === v ? 'on' : '') + '">' + l + '</button>').join('');
    el.innerHTML = items;
    el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      if (which === 'aspect') state.aspect = b.dataset.v;
      if (which === 'style') state.style = b.dataset.v;
      if (which === 'dur') state.duration = b.dataset.v;
      if (which === 'engine') state.engine = b.dataset.v;
      updatePillLabels();
      el.classList.remove('open'); popOpen = null;
    }));
  }

  async function generate() {
    const ta = $('stPrompt'); const raw = (ta?.value || '').trim();
    if (raw.length < 3) { window.toast?.('Ceritakan dulu gambar yang kamu mau ya.'); ta?.focus(); return; }
    const btn = $('stGenBtn'); const grid = $('stGrid');
    btn.disabled = true; btn.innerHTML = icon('refresh-cw') + ' Membuat\u2026';
    const skel = document.createElement('div');
    skel.className = 'st-card st-skel';
    skel.innerHTML = '<div class="st-skel-img"></div><div class="st-card-body"><p>Memproses \u201c' + esc(raw.slice(0, 46)) + '\u2026\u201d</p></div>';
    if (grid) { grid.querySelector('.st-empty')?.remove(); grid.prepend(skel); }
    try {
      const r = await fetch('/api/ai/image', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ prompt: composedPrompt(raw), provider: state.engine, aspect: state.aspect }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Generator gambar gagal.');
      history.unshift({ id: 'g' + Date.now(), prompt: raw, aspect: state.aspect, style: state.style, provider: d.provider, mime: d.image?.mime, data: d.image?.data, model: d.image?.model, createdAt: new Date().toISOString() });
      saveHistory(); renderGrid();
      window.toast?.('Gambar jadi \u2728');
    } catch (e) {
      skel.remove();
      window.toast?.(e.message || 'Generator gambar gagal.');
    } finally {
      btn.disabled = false; btn.innerHTML = icon('image-plus') + ' Buat Gambar';
    }
  }

  window.renderStudio = function renderStudio() {
    const root = $('studioRoot'); if (!root) return;
    loadHistory();
    root.innerHTML =
      '<div class="st-tabs">'
      + '<button type="button" class="st-tab active" data-mode="photo">' + icon('image-plus') + ' Foto</button>'
      + '<button type="button" class="st-tab" data-mode="video">' + icon('video') + ' Video</button>'
      + '</div>'
      + '<div class="st-composer">'
      + '<label for="stPrompt">Deskripsi konten yang kamu mau</label>'
      + '<textarea id="stPrompt" rows="3" maxlength="1200" placeholder="cth: flatlay skincare pagi di meja kayu, cahaya jendela lembut, nuansa cream"></textarea>'
      + '<div class="st-controls">'
      + '<div class="st-pill-wrap" id="stEnginePillWrap"><button type="button" class="st-pill" id="stEnginePill">' + icon('clapperboard') + ' Mesin <b>Otomatis</b> ' + icon('chevron-down') + '</button><div class="st-pop" id="stPop-engine"></div></div>'
      + '<div class="st-pill-wrap"><button type="button" class="st-pill" id="stAspectPill">' + icon('smartphone') + ' Aspek <b>4:5</b> ' + icon('chevron-down') + '</button><div class="st-pop" id="stPop-aspect"></div></div>'
      + '<div class="st-pill-wrap"><button type="button" class="st-pill" id="stStylePill">' + icon('sparkles') + ' Gaya <b>Lifestyle</b> ' + icon('chevron-down') + '</button><div class="st-pop" id="stPop-style"></div></div>'
      + '<div class="st-pill-wrap st-hidden" id="stDurPill"><button type="button" class="st-pill">' + icon('play') + ' Durasi <b>5 detik</b> ' + icon('chevron-down') + '</button><div class="st-pop" id="stPop-dur"></div></div>'
      + '<span class="st-count" id="stCount">0/1200</span>'
      + '<button type="button" class="pink-btn" id="stGenBtn">' + icon('image-plus') + ' Buat Gambar</button>'
      + '</div>'
      + '<div class="st-note st-hidden" id="stVideoNote">' + icon('film') + '<div><b>Generator video menyusul.</b> Mesin video (mis. Veo) belum terpasang di environment \u2014 untuk sekarang, susun storyboard &amp; brief videonya bareng Sherly; hasil foto dari tab sebelah bisa jadi referensi frame-mu.</div><button type="button" class="outline-btn" id="stStoryboardBtn">' + icon('message-circle') + ' Minta Sherly susun storyboard</button></div>'
      + '</div>'
      + '<div class="st-grid" id="stGrid"></div>';

    document.querySelectorAll('#studioRoot .st-tab').forEach((t) => t.addEventListener('click', () => setMode(t.dataset.mode)));
    $('stEnginePill')?.addEventListener('click', () => { buildPop('engine'); togglePop('engine'); });
    $('stAspectPill')?.addEventListener('click', () => { buildPop('aspect'); togglePop('aspect'); });
    $('stStylePill')?.addEventListener('click', () => { buildPop('style'); togglePop('style'); });
    $('stDurPill')?.querySelector('.st-pill').addEventListener('click', () => { buildPop('dur'); togglePop('dur'); });
    const ta = $('stPrompt');
    ta?.addEventListener('input', () => { const c = $('stCount'); if (c) c.textContent = ta.value.length + '/1200'; });
    $('stGenBtn')?.addEventListener('click', generate);
    $('stStoryboardBtn')?.addEventListener('click', () => {
      const p = (ta?.value || '').trim();
      window.go?.('Chat Sherly');
      setTimeout(() => {
        const el = document.getElementById('ssChatInput');
        if (el) { el.value = 'Bantu aku menyusun storyboard video' + (p ? ' tentang: ' + p : ' untuk konten Reels niche lifestyle & beauty') + ' \u2014 breakdown per scene, durasi tiap scene, dan shot list-nya ya.'; el.focus(); }
      }, 250);
    });
    setMode('photo');
    renderGrid();
  };
})();
