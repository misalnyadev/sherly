// ===== Studio — Generator Foto & Video =====
// Komposer generatif ala referensi Open-Generative-AI (repo Anil-matcha), disesuaikan tema SherlyStudio:
// panel komposer (header aset + textarea + pil kontrol ber-popover) + grid hasil.
//
// D-196: multi-karakter ala Google Flow.
//   - "@nama" di prompt menyematkan karakter: membawa potret + master sheet + profil suara.
//   - Maksimal 3 karakter per adegan (batas keras sesuai keputusan user).
//   - "Lanjut Adegan" memakai frame terakhir sebagai referensi gambar (referensi lokasi
//     atau frame adegan sebelumnya) supaya adegan tetap konsisten.
//   - Rantai adegan disimpan LOKAL (localStorage) dan bisa dihapus.
//
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
  const CHAIN_KEY = 'sherly.studio.chain.v1';
  const MAX_CHARACTERS = 3;      // batas keras: maksimal 3 karakter per adegan
  const MAX_CHAIN = 6;           // maksimal frame adegan tersimpan lokal
  const ASPECTS = [['1:1', 'Persegi (1:1)'], ['4:5', 'Potret feed (4:5)'], ['9:16', 'Reels / story (9:16)'], ['16:9', 'Landscape (16:9)']];
  const STYLES = {
    lifestyle: { label: 'Lifestyle', suffix: 'sehari-hari cozy dan estetik ala Bogor, cahaya alami, komposisi bersih dengan ruang bernapas' },
    beauty: { label: 'Beauty & Skincare', suffix: 'visual beauty & skincare yang bersih dan elegan, cahaya lembut, nuansa cream' },
    timeless: { label: 'Timeless Style', suffix: 'outfit elegan ala capsule wardrobe yang timeless, tidak dikendalikan tren musiman' },
    inspire: { label: 'Inspire & Grow', suffix: 'momen tumbuh menjadi kreator yang hangat dan inspiratif' },
    free: { label: 'Bebas', suffix: '' }
  };
  const DURATIONS = ['5 detik', '10 detik'];
  let engines = [['auto', 'Otomatis (Kie → Kustom → Gemini)'], ['gemini', 'Google Gemini'], ['kie', 'Kie AI']];
  let characters = []; // karakter user (potret + master sheet + suara)
  const SUGGESTIONS = [
    'Flatlay skincare pagi di meja kayu, cahaya jendela lembut, nuansa cream',
    'Sudut cafe cozy di Bogor, secangkir kopi latte dan buku terbuka',
    'Outfit knit beige di taman, golden hour, gaya potret timeless',
    'Meja kerja kreator rapi dengan kamera film dan moodboard'
  ];

  const state = { mode: 'photo', aspect: '4:5', style: 'lifestyle', duration: '5 detik', engine: 'auto' };
  let history = [];
  let chain = [];            // rantai adegan (lokal): frame terakhir jadi referensi gambar
  let sceneRef = null;       // { mime, data, label } gambar referensi aktif (frame adegan / lokasi)
  let popOpen = null;
  let mentionOpen = false;  // dropdown mention terbuka?
  let mentionIndex = 0;     // indeks highlight di dropdown mention
  let mentionQuery = '';    // teks setelah "@" yang diketik user
  let mentionAt = -1;       // posisi karakter "@" yang memicu dropdown

  // Tutup popover saat klik di luar pil (sekali terdaftar di level modul).
  document.addEventListener('click', (e) => {
    if (popOpen && !e.target.closest('.st-pill-wrap')) { document.getElementById('stPop-' + popOpen)?.classList.remove('open'); popOpen = null; }
    if (mentionOpen && !e.target.closest('.st-mention-box')) closeMention();
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

  // ===== D-196: rantai adegan lokal =====
  function loadChain() { try { const a = JSON.parse(localStorage.getItem(CHAIN_KEY)); chain = Array.isArray(a) ? a : []; } catch { chain = []; } }
  function saveChain() {
    while (chain.length > MAX_CHAIN) chain.shift();
    for (;;) {
      try { localStorage.setItem(CHAIN_KEY, JSON.stringify(chain)); return; }
      catch {
        if (chain.length > 1) chain.shift();
        else { try { localStorage.removeItem(CHAIN_KEY); } catch {} return; }
      }
    }
  }
  function clearChain() {
    chain = [];
    sceneRef = null;
    try { localStorage.removeItem(CHAIN_KEY); } catch {}
    renderChain(); renderAssetHeader();
  }
  function removeChainFrame(id) {
    chain = chain.filter((f) => f.id !== id);
    if (sceneRef && sceneRef.fromId === id) sceneRef = null;
    saveChain(); renderChain(); renderAssetHeader();
  }

  // ===== D-196: parsing mention karakter dari prompt =====
  function slugify(v) {
    return String(v ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  }
  /** Daftar karakter yang disebut di prompt ( unik, urut kemunculan, maks 3 ). */
  function mentionedCharacters() {
    const ta = $('stPrompt'); const text = ta?.value || '';
    if (!text.includes('@')) return [];
    const bySlug = new Map();
    for (const c of characters) { const s = slugify(c.name); if (s) bySlug.set(s, c); }
    const out = []; const seen = new Set();
    const re = /@([a-z0-9][a-z0-9_-]{0,59})/gi; let m;
    while ((m = re.exec(text))) {
      const c = bySlug.get(String(m[1] || '').toLowerCase());
      if (!c || seen.has(c.id)) continue;
      seen.add(c.id); out.push(c);
      if (out.length >= MAX_CHARACTERS) break;
    }
    return out;
  }

  // ===== D-196: Header Aset (ala Google Flow) =====
  function characterThumb(c) {
    const url = c?.reference_image_url || c?.board_image_url || '';
    if (url) return '<img src="' + esc(url) + '" alt="" loading="lazy">';
    return '<span class="st-asset-initial">' + esc(String(c?.name || '?').trim().charAt(0).toUpperCase()) + '</span>';
  }
  function renderAssetHeader() {
    const box = $('stAssetHeader'); if (!box) return;
    const mentioned = mentionedCharacters();
    const parts = [];
    for (const c of mentioned) {
      const badges = [];
      const v = c.voice || {};
      if (v.name || v.style) badges.push('<span class="st-asset-badge" title="Punya profil suara">' + icon('mic') + '</span>');
      if (c.board_image_url) badges.push('<span class="st-asset-badge" title="Punya master sheet">' + icon('layers') + '</span>');
      parts.push(
        '<span class="st-asset st-asset-char" title="' + esc(c.name + (v.name ? ' — suara ' + v.name : '')) + '">'
        + '<span class="st-asset-face">' + characterThumb(c) + '</span>'
        + '<span class="st-asset-name">' + esc(c.name) + '</span>'
        + badges.join('')
        + '<button type="button" class="st-asset-x" data-mention-remove="' + esc(slugify(c.name)) + '" aria-label="Hapus ' + esc(c.name) + '">'
        + icon('x') + '</button></span>'
      );
    }
    if (sceneRef) {
      parts.push(
        '<span class="st-asset st-asset-scene" title="' + esc(sceneRef.label || 'Referensi gambar') + '">'
        + '<span class="st-asset-scene-img"><img src="data:' + esc(sceneRef.mime || 'image/png') + ';base64,' + esc(sceneRef.data) + '" alt=""></span>'
        + '<span class="st-asset-name">' + esc(sceneRef.label || 'Referensi gambar') + '</span>'
        + '<button type="button" class="st-asset-x" data-scene-remove="1" aria-label="Hapus referensi gambar">' + icon('x') + '</button></span>'
      );
    }
    // D-197: tanpa aset aktif -> header disembunyikan (bukan kotak kosong) supaya tampilan simpel.
    box.innerHTML = parts.join('');
    box.classList.toggle('st-hidden', !parts.length);
    box.querySelectorAll('[data-mention-remove]').forEach((b) => b.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      removeMentionFromPrompt(b.dataset.mentionRemove);
    }));
    box.querySelectorAll('[data-scene-remove]').forEach((b) => b.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      sceneRef = null; renderAssetHeader(); window.toast?.('Referensi gambar dilepas.');
    }));
  }
  /** Hapus @slug dari teks prompt (dan seluruh mention karakter itu). */
  function removeMentionFromPrompt(slug) {
    const ta = $('stPrompt'); if (!ta) return;
    const re = new RegExp('@' + String(slug).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
    ta.value = String(ta.value || '').replace(re, '').replace(/\s{2,}/g, ' ').trim();
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    renderAssetHeader();
  }

  // ===== D-196: Mention picker =====
  function mentionCandidates() {
    const q = mentionQuery.toLowerCase();
    const mentioned = new Set(mentionedCharacters().map((c) => c.id));
    return characters.filter((c) => {
      if (mentioned.has(c.id)) return false;
      if (!q) return true;
      return slugify(c.name).includes(q) || String(c.name || '').toLowerCase().includes(q);
    });
  }
  function openMention(at, query) {
    mentionOpen = true; mentionAt = at; mentionQuery = query; mentionIndex = 0;
    renderMention();
  }
  function closeMention() {
    mentionOpen = false; mentionAt = -1; mentionQuery = '';
    const box = $('stMentionList'); if (box) { box.innerHTML = ''; box.classList.remove('open'); }
  }
  function renderMention() {
    const box = $('stMentionList'); if (!box) return;
    if (!mentionOpen) { box.innerHTML = ''; box.classList.remove('open'); return; }
    const list = mentionCandidates();
    if (!list.length) {
      box.innerHTML = '<div class="st-mention-empty">' + (characters.length ? 'Tidak ada karakter yang cocok.' : 'Belum ada karakter. Buat dulu di menu Karakter.') + '</div>';
      box.classList.add('open'); return;
    }
    box.innerHTML = list.map((c, i) => {
      const v = c.voice || {};
      const marks = [];
      if (v.name || v.style) marks.push(icon('mic'));
      if (c.board_image_url) marks.push(icon('layers'));
      return '<button type="button" class="st-mention-item' + (i === mentionIndex ? ' on' : '') + '" data-mention-pick="' + esc(c.id) + '">'
        + '<span class="st-mention-face">' + characterThumb(c) + '</span>'
        + '<span class="st-mention-name">' + esc(c.name) + '</span>'
        + '<span class="st-mention-marks">' + marks.join('') + '</span></button>';
    }).join('');
    box.classList.add('open');
    box.querySelectorAll('[data-mention-pick]').forEach((b) => b.addEventListener('mousedown', (e) => {
      e.preventDefault();
      pickMention(b.dataset.mentionPick);
    }));
  }
  function pickMention(id) {
    const c = characters.find((x) => x.id === id); if (!c) return;
    const ta = $('stPrompt'); if (!ta) return;
    const text = String(ta.value || '');
    const before = text.slice(0, mentionAt);
    const after = text.slice(mentionAt + 1 + mentionQuery.length);
    const token = '@' + slugify(c.name);
    ta.value = (before + token + ' ' + after).replace(/\s{2,}/g, ' ');
    closeMention();
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus();
    try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch {}
  }
  /** Deteksi "@" yang diketik user -> buka dropdown mention. */
  function syncMentionFromText() {
    const ta = $('stPrompt'); if (!ta) return;
    const text = String(ta.value || '');
    const pos = ta.selectionStart ?? text.length;
    const upto = text.slice(0, pos);
    const m = /@([a-z0-9_-]*)$/i.exec(upto);
    if (!m) { if (mentionOpen) closeMention(); return; }
    const at = pos - m[1].length - 1;
    if (mentionOpen && mentionAt === at && mentionQuery === m[1]) { renderMention(); return; }
    openMention(at, m[1]);
  }

  // ===== D-196: rantai adegan (UI) =====
  function renderChain() {
    const box = $('stChain'); if (!box) return;
    if (!chain.length) { box.classList.add('st-hidden'); box.innerHTML = ''; return; }
    box.classList.remove('st-hidden');
    const frames = chain.map((f, i) => {
      const active = sceneRef && sceneRef.fromId === f.id;
      return '<div class="st-chain-frame' + (active ? ' on' : '') + '">'
        + '<img src="data:' + esc(f.mime || 'image/png') + ';base64,' + esc(f.data) + '" alt="Adegan ' + (i + 1) + '" loading="lazy">'
        + '<span class="st-chain-no">' + (i + 1) + '</span>'
        + '<button type="button" class="st-chain-x" data-chain-remove="' + esc(f.id) + '" aria-label="Hapus adegan ' + (i + 1) + '">' + icon('x') + '</button>'
        + '</div>';
    }).join('');
    box.innerHTML =
      '<div class="st-chain-head">' + icon('film') + '<b>Rantai Adegan</b><span>' + chain.length + '/' + MAX_CHAIN + '</span>'
      + '<button type="button" class="st-chain-clear" id="stChainClear">' + icon('trash-2') + ' Hapus rantai</button></div>'
      + '<div class="st-chain-strip">' + frames
      + '<button type="button" class="st-chain-add" id="stChainNew">' + icon('plus') + '<span>Adean baru</span></button>'
      + '</div>';
    box.querySelectorAll('[data-chain-remove]').forEach((b) => b.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation(); removeChainFrame(b.dataset.chainRemove);
    }));
    $('stChainClear')?.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      clearChain(); window.toast?.('Rantai adegan dihapus.');
    });
    $('stChainNew')?.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      sceneRef = null; renderChain(); renderAssetHeader();
      $('stPrompt')?.focus();
      window.toast?.('Adepsan baru — lanjutkan ceritanya.');
    });
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
    const chars = (it.characters || []).map((n) => '@' + n).join(' ');
    return '<div class="st-card" data-id="' + esc(it.id) + '">'
      + '<img src="' + dataUrl + '" alt="' + esc(String(it.prompt).slice(0, 80)) + '" loading="lazy">'
      + '<div class="st-card-body">'
      + '<p>' + esc(it.prompt) + '</p>'
      + '<span class="st-card-meta">' + esc(it.aspect || '') + ' · ' + esc(it.style ? (STYLES[it.style] || {}).label : '')
      + (it.scene ? ' · adegan ' + it.scene + (it.sceneTotal ? '/' + it.sceneTotal : '') : '') + '</span>'
      + (chars ? '<span class="st-card-chars">' + esc(chars) + '</span>' : '')
      + '<div class="st-card-actions">'
      + '<a class="st-act" href="' + dataUrl + '" download="sherly-studio-' + esc(it.id) + '.' + ext + '">' + icon('download') + ' Unduh</a>'
      + '<button type="button" class="st-act" data-act="lanjut">' + icon('film') + ' Lanjut Adegan</button>'
      + '<button type="button" class="st-act" data-act="planner">' + icon('list-checks') + ' Ke Planner</button>'
      + '<button type="button" class="st-act danger" data-act="hapus">' + icon('x') + ' Hapus</button>'
      + '</div></div></div>';
  }

  function renderGrid() {
    const grid = $('stGrid'); if (!grid) return;
    if (!history.length) {
      grid.innerHTML = '<div class="st-empty">' + icon('image-plus') + '<b>Belum ada hasil</b><p>Tulis deskripsi konten, lalu ketik <b>@</b> untuk menyematkan karakter.</p>'
        + '<div class="st-suggest">' + SUGGESTIONS.map((s) => '<button type="button" data-suggest="' + esc(s) + '">'
        + esc(s.slice(0, 42)) + '…</button>').join('') + '</div></div>';
      grid.querySelectorAll('[data-suggest]').forEach((b) => b.addEventListener('click', () => { const t = $('stPrompt'); if (t) { t.value = b.dataset.suggest; t.dispatchEvent(new Event('input', { bubbles: true })); } }));
      return;
    }
    grid.innerHTML = history.map(cardHtml).join('');
    grid.querySelectorAll('.st-card [data-act]').forEach((b) => b.addEventListener('click', () => {
      const card = b.closest('.st-card'); const id = card?.dataset.id;
      const it = history.find((x) => x.id === id); if (!it) return;
      if (b.dataset.act === 'hapus') { history = history.filter((x) => x.id !== id); saveHistory(); renderGrid(); window.toast?.('Gambar dihapus.'); return; }
      if (b.dataset.act === 'lanjut') {
        // Frame ini jadi referensi gambar adegan berikutnya + masuk rantai adegan lokal.
        const frame = { id: it.id, mime: it.mime, data: it.data, prompt: it.prompt, ts: Date.now() };
        chain = chain.filter((f) => f.id !== it.id);
        chain.push(frame); saveChain();
        sceneRef = { mime: it.mime, data: it.data, label: 'Frame adegan sebelumnya', fromId: it.id };
        renderChain(); renderAssetHeader();
        window.toast?.('Frame dipakai sebagai referensi adegan berikutnya.');
        return;
      }
      if (b.dataset.act === 'planner') {
        try {
          const arr = JSON.parse(localStorage.getItem('sherly.planner.v1')) || [];
          arr.push({ id: 's' + Date.now(), title: String(it.prompt).slice(0, 60), platform: 'Instagram', date: new Date().toISOString().slice(0, 10) });
          localStorage.setItem('sherly.planner.v1', JSON.stringify(arr));
          window.toast?.('Masuk Planner sebagai ide ✨');
        } catch { window.toast?.('Gagal menyimpan ke Planner.'); }
      }
    }));
  }

  function setMode(m) {
    state.mode = m;
    document.querySelectorAll('#studioRoot .st-tab').forEach((t) => t.classList.toggle('active', t.dataset.mode === m));
    const isVideo = m === 'video';
    const ta = $('stPrompt'); if (ta) ta.placeholder = isVideo ? 'cth: opening reels — Sherly berjalan masuk cafe di Bogor, kamera slowly zoom in…' : 'cth: @sherly dan @novi sedang berjalan di GBK sambil menikmati udara pagi…';
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
    const e = $('stEnginePill'); if (e) e.querySelector('b').textContent = (engines.find((x) => x[0] === state.engine) || engines[0])[1];
    const rn = $('stRefNote');
    if (rn) {
      const mentioned = mentionedCharacters();
      const hasScene = !!sceneRef;
      const on = mentioned.length > 0 || hasScene;
      rn.classList.toggle('st-hidden', !on);
      if (on) {
        const forced = state.engine === 'kie' || String(state.engine).startsWith('custom:');
        const parts = [];
        if (mentioned.length) parts.push(mentioned.length + ' karakter disematkan (potret + master sheet + suara)');
        if (hasScene) parts.push('referensi gambar adegan aktif');
        const forceNote = forced ? ' <b>Multi-referensi hanya didukung Gemini</b> — request ini otomatis memakai Gemini.' : '';
        rn.innerHTML = icon('eye') + ' ' + parts.join(' · ') + ' —<b> wajah & suara dijaga konsisten</b>.' + forceNote;
      }
    }
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
    else if (which === 'style') items = Object.keys(STYLES).map((k) => '<button type="button" data-v="' + k + '" class="' + (state.style === k ? 'on' : '') + '">' + STYLES[k].label + '</button>').join('');
    else if (which === 'dur') items = DURATIONS.map((v) => '<button type="button" data-v="' + esc(v) + '" class="' + (state.duration === v ? 'on' : '') + '">' + v + '</button>').join('');
    else if (which === 'engine') items = engines.map(([v, l]) => '<button type="button" data-v="' + esc(v) + '" class="' + (state.engine === v ? 'on' : '') + '">' + l + '</button>').join('');
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
    const mentioned = mentionedCharacters();
    if (mentioned.length > MAX_CHARACTERS) { window.toast?.('Maksimal ' + MAX_CHARACTERS + ' karakter per adegan.'); return; }
    const btn = $('stGenBtn'); const grid = $('stGrid');
    btn.disabled = true; btn.innerHTML = icon('refresh-cw') + ' Membuat…';
    const skel = document.createElement('div');
    skel.className = 'st-card st-skel';
    skel.innerHTML = '<div class="st-skel-img"></div><div class="st-card-body"><p>Memproses “' + esc(raw.slice(0, 60)) + '”</p></div>';
    if (grid) { grid.querySelector('.st-empty')?.remove(); grid.prepend(skel); }
    try {
      const prompt = composedPrompt(raw);
      const reqBody = { prompt, provider: state.engine, aspect: state.aspect };
      // D-196: referensikan karakter yang disebut (potret + master sheet) via "@nama" di prompt.
      if (mentioned.length) reqBody.characterMentions = mentioned.map((c) => ({ id: c.id, name: c.name }));
      // D-196: gambar referensi adegan (frame akhir adegan sebelumnya / referensi lokasi).
      if (sceneRef) reqBody.sceneRef = { mime: sceneRef.mime, data: sceneRef.data };
      // D-196: nomor adegan untuk penanda kontinuitas.
      const sceneNumber = chain.length ? chain.length + 1 : 0;
      if (sceneNumber) { reqBody.sceneNumber = sceneNumber; reqBody.sceneTotal = sceneNumber; }
      const r = await fetch('/api/ai/image', { method: 'POST', headers: await authHeaders(), body: JSON.stringify(reqBody) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Generator gambar gagal.');
      history.unshift({
        id: 'g' + Date.now(), prompt: raw, aspect: state.aspect, style: state.style,
        mime: d.image?.mime || 'image/png', data: d.image?.data || '',
        characters: mentioned.map((c) => c.name),
        scene: sceneNumber || 0, sceneTotal: sceneNumber || 0,
      });
      saveHistory(); renderGrid();
      window.toast?.('Gambar jadi ✨');
    } catch (e) {
      skel.remove();
      window.toast?.(e.message || 'Generator gambar gagal.');
    } finally {
      btn.disabled = false; btn.innerHTML = icon('image-plus') + ' Buat Gambar';
    }
  }

  window.renderStudio = async function renderStudio() {
    const root = $('studioRoot'); if (!root) return;
    loadHistory(); loadChain();
    root.innerHTML =
      '<div class="st-tabs">'
      + '<button type="button" class="st-tab active" data-mode="photo">' + icon('image-plus') + ' Foto</button>'
      + '<button type="button" class="st-tab" data-mode="video">' + icon('video') + ' Video</button>'
      + '</div>'
      // D-197: hasil generate tampil DI ATAS komposer — hasil baru langsung terlihat tanpa scroll.
      + '<div class="st-grid" id="stGrid"></div>'
      + '<div class="st-composer">'
      + '<div class="st-asset-header st-hidden" id="stAssetHeader"></div>'
      + '<div class="st-mention-box">'
      + '<label for="stPrompt">Deskripsi konten yang kamu mau</label>'
      + '<textarea id="stPrompt" rows="3" maxlength="1200" placeholder="cth: @sherly dan @novi sedang berjalan di GBK sambil menikmati udara pagi…"></textarea>'
      + '<div class="st-mention-list" id="stMentionList"></div>'
      + '</div>'
      + '<div class="st-chain st-hidden" id="stChain"></div>'
      + '<div class="st-controls">'
      + '<div class="st-pill-wrap" id="stEnginePillWrap"><button type="button" class="st-pill" id="stEnginePill">' + icon('cpu') + ' <b>Mesin</b></button><div class="st-pop" id="stPop-engine"></div></div>'
      + '<div class="st-pill-wrap"><button type="button" class="st-pill" id="stAspectPill">' + icon('smartphone') + ' <b>1:1</b></button><div class="st-pop" id="stPop-aspect"></div></div>'
      + '<div class="st-pill-wrap"><button type="button" class="st-pill" id="stStylePill">' + icon('sparkles') + ' <b>Lifestyle</b></button><div class="st-pop" id="stPop-style"></div></div>'
      + '<div class="st-pill-wrap st-hidden" id="stDurPill"><button type="button" class="st-pill">' + icon('clock') + ' <b>5 detik</b></button><div class="st-pop" id="stPop-dur"></div></div>'
      + '<span class="st-count" id="stCount">0/1200</span>'
      + '<button type="button" class="pink-btn" id="stGenBtn">' + icon('image-plus') + ' Buat Gambar</button>'
      + '</div>'
      + '<div class="st-note st-hidden" id="stRefNote"></div>'
      + '<div class="st-note st-hidden" id="stVideoNote">' + icon('film') + '<div><b>Generator video menyusul.</b> Sementara pakai Studio Foto untuk menyiapkan frame adegan, lalu bring ke sini lewat <b>Lanjut Adegan</b>.</div></div>';

    // Karakter user — dipakai untuk mention picker & header aset.
    fetch('/api/characters', { headers: await authHeaders() }).then((r) => r.json()).then((d) => {
      characters = Array.isArray(d?.characters) ? d.characters : [];
      renderAssetHeader(); updatePillLabels();
    }).catch(() => {});
    // Provider kustom dari Pengaturan otomatis jadi pilihan Mesin.
    fetch('/api/custom-providers', { headers: await authHeaders() }).then((r) => r.json()).then((d) => {
      const list = Array.isArray(d?.providers) ? d.providers : [];
      engines = [['auto', 'Otomatis (Kie → Kustom → Gemini)'], ['gemini', 'Google Gemini'], ['kie', 'Kie AI']]
        .concat(list.map((p) => ['custom:' + p.id, p.name]));
      updatePillLabels();
    }).catch(() => {});
    document.querySelectorAll('#studioRoot .st-tab').forEach((t) => t.addEventListener('click', () => setMode(t.dataset.mode)));
    $('stEnginePill')?.addEventListener('click', () => { buildPop('engine'); togglePop('engine'); });
    $('stAspectPill')?.addEventListener('click', () => { buildPop('aspect'); togglePop('aspect'); });
    $('stStylePill')?.addEventListener('click', () => { buildPop('style'); togglePop('style'); });
    $('stDurPill')?.querySelector('.st-pill').addEventListener('click', () => { buildPop('dur'); togglePop('dur'); });
    const ta = $('stPrompt');
    ta?.addEventListener('input', () => {
      const c = $('stCount'); if (c) c.textContent = ta.value.length + '/1200';
      renderAssetHeader(); updatePillLabels(); syncMentionFromText();
    });
    ta?.addEventListener('keyup', syncMentionFromText);
    ta?.addEventListener('click', syncMentionFromText);
    ta?.addEventListener('keydown', (e) => {
      if (!mentionOpen) return;
      const list = mentionCandidates();
      if (e.key === 'ArrowDown') { e.preventDefault(); mentionIndex = Math.min(mentionIndex + 1, Math.max(list.length - 1, 0)); renderMention(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); mentionIndex = Math.max(mentionIndex - 1, 0); renderMention(); }
      else if (e.key === 'Enter' && list[mentionIndex]) { e.preventDefault(); pickMention(list[mentionIndex].id); }
      else if (e.key === 'Escape') { e.preventDefault(); closeMention(); }
    });
    ta?.addEventListener('blur', () => setTimeout(() => closeMention(), 120));
    $('stGenBtn')?.addEventListener('click', generate);
    $('stStoryboardBtn')?.addEventListener('click', () => {
      const p = (ta?.value || '').trim();
      window.go?.('Chat Sherly');
      setTimeout(() => {
        const el = document.getElementById('ssChatInput');
        if (el) { el.value = 'Bantu aku menyusun storyboard video' + (p ? ' tentang: ' + p : ' untuk konten Reels negaraku'); el.dispatchEvent(new Event('input', { bubbles: true })); }
      }, 250);
    });
    const initialMode = window.__sherlyStudioMode === 'video' ? 'video' : 'photo';
    window.__sherlyStudioMode = null;
    setMode(initialMode);
    renderAssetHeader();
    renderChain();
    renderGrid();
  };
})();
