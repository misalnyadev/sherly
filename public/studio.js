// ===== Studio — Generator Foto & Video + Galeri Aset =====
// Komposer generatif ala referensi Open-Generative-AI (repo Anil-matcha), disesuaikan tema SherlyStudio.
//
// D-196: multi-karakter ala Google Flow.
//   - "@nama" di prompt menyematkan karakter: potret + master sheet + profil suara (maks 3).
//   - "Lanjut Adegan" memakai frame terakhir sebagai referensi gambar (referensi lokasi
//     atau frame adegan sebelumnya) supaya adegan tetap konsisten.
//   - Rantai adegan disimpan LOKAL (localStorage) dan bisa dihapus.
//
// D-198: Galeri Aset + Engine Video.
//   - Semua media (hasil generate foto/video & hasil upload) disimpan sebagai ASET.
//   - Galeri grid di atas komposer (tanpa kotak "hasil" terpisah) -> tampilan bersih.
//   - Aset bisa di-preview, diunduh, diedit (Editor Video), atau dipakai ulang
//     sebagai referensi di komposer.
//   - Video generation berjalan sebagai task (Kie/Veo 3.1) + polling status.
//
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

  const CHAIN_KEY = 'sherly.studio.chain.v1';
  const MAX_CHARACTERS = 3;      // batas keras: maksimal 3 karakter per adegan
  const MAX_CHAIN = 6;           // maksimal frame adegan tersimpan lokal
  const ASPECTS = [['1:1', 'Persegi (1:1)'], ['4:5', 'Potret feed (4:5)'], ['9:16', 'Reels / story (9:16)'], ['16:9', 'Landscape (16:9)']];
  const VIDEO_ASPECTS = [['9:16', 'Vertikal (9:16)'], ['16:9', 'Landscape (16:9)']];
  const STYLES = {
    lifestyle: { label: 'Lifestyle', suffix: 'sehari-hari cozy dan estetik ala Bogor, cahaya alami, komposisi bersih dengan ruang bernapas' },
    beauty: { label: 'Beauty & Skincare', suffix: 'visual beauty & skincare yang bersih dan elegan, cahaya lembut, nuansa cream' },
    timeless: { label: 'Timeless Style', suffix: 'outfit elegan ala capsule wardrobe yang timeless, tidak dikendalikan tren musiman' },
    inspire: { label: 'Inspire & Grow', suffix: 'momen tumbuh menjadi kreator yang hangat dan inspiratif' },
    free: { label: 'Bebas', suffix: '' }
  };
  const DURATIONS = [['4', '4 detik'], ['6', '6 detik'], ['8', '8 detik']];
  const VIDEO_TIERS = [['veo3_fast', 'Veo 3.1 Fast (hemat)'], ['veo3', 'Veo 3.1 Quality (premium)'], ['veo3_lite', 'Veo 3.1 Lite (tercepat)']];
  const RESOLUTIONS = [['720p', '720p'], ['1080p', '1080p'], ['4k', '4K']];
  let engines = [['auto', 'Otomatis (Kie → Kustom → Gemini)'], ['gemini', 'Google Gemini'], ['kie', 'Kie AI']];
  let characters = []; // karakter user (potret + master sheet + suara)
  const SUGGESTIONS = [
    'Flatlay skincare pagi di meja kayu, cahaya jendela lembut, nuansa cream',
    'Sudut cafe cozy di Bogor, secangkir kopi latte dan buku terbuka',
    'Outfit knit beige di taman, golden hour, gaya potret timeless',
    'Meja kerja kreator rapi dengan kamera film dan moodboard'
  ];

  const state = {
    mode: 'photo', aspect: '4:5', style: 'lifestyle', duration: '8', tier: 'veo3_fast',
    resolution: '720p', engine: 'auto',
  };
  let assets = [];           // D-198: galeri aset (dari server)
  let chain = [];            // rantai adegan (lokal): frame terakhir jadi referensi gambar
  let sceneRef = null;       // { mime, data, label } gambar referensi aktif (frame adegan / aset / lokasi)
  let popOpen = null;
  let mentionOpen = false;  // dropdown mention terbuka?
  let mentionIndex = 0;     // indeks highlight di dropdown mention
  let mentionQuery = '';    // teks setelah "@" yang diketik user
  let mentionAt = -1;       // posisi karakter "@" yang memicu dropdown
  let videoTask = null;     // D-198: task video yang sedang berjalan
  let videoTimer = null;

  // Tutup popover saat klik di luar pil (sekali terdaftar di level modul).
  document.addEventListener('click', (e) => {
    if (popOpen && !e.target.closest('.st-pill-wrap')) { document.getElementById('stPop-' + popOpen)?.classList.remove('open'); popOpen = null; }
    if (mentionOpen && !e.target.closest('.st-mention-box')) closeMention();
  });

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
  /** Daftar karakter yang disebut di prompt (unik, urut kemunculan, maks 3). */
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

  // ===== D-198: Galeri aset =====
  function assetThumb(a) {
    if (!a || !a.url) return '<span class="st-gal-empty">' + icon('image') + '</span>';
    if (a.media_type === 'video') {
      return '<video src="' + esc(a.url) + '#t=0.1" muted preload="metadata" playsinline></video>'
        + '<span class="st-gal-badge">' + icon('film') + (a.duration_ms ? Math.round(a.duration_ms / 1000) + 's' : '') + '</span>';
    }
    return '<img src="' + esc(a.url) + '" alt="' + esc(String(a.file_name || '').slice(0, 60)) + '" loading="lazy">';
  }
  function assetCardHtml(a) {
    return '<button type="button" class="st-gal-item" data-asset-open="' + esc(a.id) + '" title="' + esc(a.file_name || 'aset') + '">'
      + '<span class="st-gal-thumb">' + assetThumb(a) + '</span>'
      + '<span class="st-gal-kind">' + (a.kind === 'generate' ? icon('sparkles') : icon('upload')) + '</span>'
      + '</button>';
  }
  function renderGallery() {
    const box = $('stGallery'); if (!box) return;
    const empty = $('stStageEmpty');
    if (!assets.length) {
      box.classList.add('st-hidden'); box.innerHTML = '';
      empty?.classList.remove('st-hidden');
      return;
    }
    box.classList.remove('st-hidden');
    empty?.classList.add('st-hidden');
    box.innerHTML = assets.map(assetCardHtml).join('');
    box.querySelectorAll('[data-asset-open]').forEach((b) => b.addEventListener('click', () => {
      const a = assets.find((x) => x.id === b.dataset.assetOpen);
      if (a) openPreview(a);
    }));
  }
  async function loadAssets() {
    try {
      const r = await fetch('/api/studio/assets', { headers: await authHeaders() });
      const d = await r.json();
      if (r.ok) { assets = Array.isArray(d?.assets) ? d.assets : []; renderGallery(); }
    } catch { /* galeri diam-diam */ }
  }
  /** Simpan aset hasil generate langsung ke server sebagai aset. */
  async function persistGenerated(mime, data, prompt, meta) {
    try {
      const r = await fetch('/api/studio/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ((await window.sherlyGetAccessToken?.()) || '') },
        body: JSON.stringify({ mime, data, prompt, meta, kind: 'generate' }),
      });
      if (r.ok) { const d = await r.json(); if (d?.asset) { assets.unshift(d.asset); renderGallery(); } }
    } catch { /* simpan aset gagal tidak menggagalkan generate */ }
  }

  // ===== D-198: Lightbox preview aset =====
  function openPreview(a) {
    const box = $('stLightbox'); if (!box) return;
    const isVideo = a.media_type === 'video';
    const media = isVideo
      ? '<video src="' + esc(a.url) + '" controls autoplay playsinline class="st-lb-media"></video>'
      : '<img src="' + esc(a.url) + '" alt="' + esc(a.file_name || '') + '" class="st-lb-media">';
    box.innerHTML =
      '<div class="st-lb-backdrop" data-lb-close="1"></div>'
      + '<div class="st-lb-panel" role="dialog" aria-modal="true">'
      + '<div class="st-lb-head"><div><b>' + esc(a.file_name || 'Aset') + '</b>'
      + '<span>' + esc(a.kind === 'generate' ? 'Hasil generate' : 'Upload') + (a.width ? ' · ' + a.width + '×' + a.height : '') + (a.duration_ms ? ' · ' + Math.round(a.duration_ms / 1000) + ' detik' : '') + '</span></div>'
      + '<button type="button" class="st-lb-x" data-lb-close="1" aria-label="Tutup">' + icon('x') + '</button></div>'
      + '<div class="st-lb-body">' + media + '</div>'
      + (a.prompt ? '<p class="st-lb-prompt">' + esc(a.prompt) + '</p>' : '')
      + '<div class="st-lb-actions">'
      + '<a class="st-act" href="' + esc(a.url) + '" download="' + esc(a.file_name || 'aset') + '">' + icon('download') + ' Unduh</a>'
      + '<button type="button" class="st-act" data-lb-ref="1">' + icon('layers') + ' Jadikan Referensi</button>'
      + (isVideo ? '<button type="button" class="st-act" data-lb-edit="1">' + icon('film') + ' Edit Video</button>' : '')
      + '<button type="button" class="st-act danger" data-lb-del="1">' + icon('x') + ' Hapus</button>'
      + '</div></div>';
    box.classList.add('open');
    box.querySelectorAll('[data-lb-close]').forEach((b) => b.addEventListener('click', closePreview));
    box.querySelector('[data-lb-ref]')?.addEventListener('click', () => { useAssetAsReference(a); closePreview(); });
    box.querySelector('[data-lb-edit]')?.addEventListener('click', () => { editAsset(a); closePreview(); });
    box.querySelector('[data-lb-del]')?.addEventListener('click', () => { deleteAsset(a); closePreview(); });
  }
  function closePreview() {
    const box = $('stLightbox'); if (!box) return;
    box.classList.remove('open');
    box.innerHTML = '';
  }
  /** Aset jadi referensi gambar di komposer (dipakai ulang). */
  async function useAssetAsReference(a) {
    if (!a || !a.url) return;
    if (a.media_type === 'video') {
      // Ambil frame pertama video sebagai gambar referensi.
      try {
        const dataUrl = await firstVideoFrame(a.url);
        if (!dataUrl) { window.toast?.('Gagal mengambil frame dari video.'); return; }
        sceneRef = { mime: 'image/png', data: dataUrl, label: 'Frame video: ' + (a.file_name || '').slice(0, 28), fromId: a.id };
      } catch { window.toast?.('Gagal mengambil frame dari video.'); return; }
    } else {
      try {
        const res = await fetch(a.url);
        const blob = await res.blob();
        const dataUrl = await blobToDataUrl(blob);
        sceneRef = { mime: blob.type || 'image/png', data: dataUrl, label: 'Aset: ' + (a.file_name || '').slice(0, 28), fromId: a.id };
      } catch { window.toast?.('Gagal memuat aset sebagai referensi.'); return; }
    }
    renderAssetHeader(); updatePillLabels();
    window.toast?.('Aset dipakai sebagai referensi ✨');
  }
  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }
  /** Grab frame pertama video sebagai data URL base64. */
  function firstVideoFrame(url) {
    return new Promise((resolve) => {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.crossOrigin = 'anonymous'; v.src = url;
      const done = (val) => { try { v.removeAttribute('src'); v.load(); } catch {} resolve(val); };
      v.onloadeddata = () => { try { v.currentTime = Math.min(0.5, (v.duration || 1) / 3); } catch { done(null); } };
      v.onseeked = () => {
        try {
          const c = document.createElement('canvas');
          c.width = v.videoWidth || 720; c.height = v.videoHeight || 1280;
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          done(c.toDataURL('image/png').split(',')[1] || null);
        } catch { done(null); }
      };
      v.onerror = () => done(null);
      setTimeout(() => done(null), 8000);
    });
  }
  /** Kirim aset video ke Editor Video. */
  async function editAsset(a) {
    if (!a || !a.url) return;
    try {
      const res = await fetch(a.url);
      const blob = await res.blob();
      const file = new File([blob], a.file_name || 'klip.mp4', { type: blob.type || 'video/mp4' });
      window.go?.('Editor Video');
      setTimeout(() => window.sherlyVeAddFiles?.([file]), 450);
    } catch { window.toast?.('Gagal membuka aset di Editor Video.'); }
  }
  async function deleteAsset(a) {
    if (!a || !a.id) return;
    try {
      const r = await fetch('/api/studio/assets/' + a.id, { method: 'DELETE', headers: await authHeaders() });
      if (!r.ok) throw new Error('Gagal menghapus aset.');
      assets = assets.filter((x) => x.id !== a.id);
      if (sceneRef && sceneRef.fromId === a.id) sceneRef = null;
      renderGallery(); renderAssetHeader();
      window.toast?.('Aset dihapus.');
    } catch (e) { window.toast?.(e.message || 'Gagal menghapus aset.'); }
  }
  /** Unggah aset dari perangkat. */
  async function uploadAsset(file) {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const t = (await window.sherlyGetAccessToken?.()) || '';
      const r = await fetch('/api/studio/assets', { method: 'POST', headers: { Authorization: 'Bearer ' + t }, body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Gagal mengunggah aset.');
      if (d?.asset) { assets.unshift(d.asset); renderGallery(); window.toast?.('Aset ditambahkan ke galeri ✨'); }
    } catch (e) { window.toast?.(e.message || 'Gagal mengunggah aset.'); }
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
      window.toast?.('Adegan baru — lanjutkan ceritanya.');
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

  function setMode(m) {
    state.mode = m;
    document.querySelectorAll('#studioRoot .st-tab').forEach((t) => t.classList.toggle('active', t.dataset.mode === m));
    const isVideo = m === 'video';
    // Rasio aspek video hanya 16:9 & 9:16 — kalau aspect foto (4:5/1:1) otomatis ke 9:16.
    if (isVideo && !VIDEO_ASPECTS.some((v) => v[0] === state.aspect)) state.aspect = '9:16';
    if (!isVideo && !ASPECTS.some((v) => v[0] === state.aspect)) state.aspect = '4:5';
    const ta = $('stPrompt'); if (ta) ta.placeholder = isVideo ? 'cth: opening reels — @sherly berjalan masuk cafe di Bogor, kamera slowly zoom in…' : 'cth: @sherly dan @novi sedang berjalan di GBK menikmati udara pagi…';
    $('stDurPill')?.classList.toggle('st-hidden', !isVideo);
    $('stTierPillWrap')?.classList.toggle('st-hidden', !isVideo);
    $('stResPillWrap')?.classList.toggle('st-hidden', !isVideo);
    $('stEnginePillWrap')?.classList.toggle('st-hidden', isVideo);
    $('stStylePillWrap')?.classList.toggle('st-hidden', isVideo);
    $('stGenBtn')?.classList.toggle('st-hidden', isVideo);
    $('stVideoBtn')?.classList.toggle('st-hidden', !isVideo);
    updatePillLabels();
  }

  function updatePillLabels() {
    const a = $('stAspectPill'), s = $('stStylePill'), d = $('stDurPill');
    if (a) a.querySelector('b').textContent = aspectLabel();
    if (s) s.querySelector('b').textContent = styleLabel();
    if (d) d.querySelector('b').textContent = (DURATIONS.find((x) => x[0] === state.duration) || DURATIONS[2])[1];
    const e = $('stEnginePill'); if (e) e.querySelector('b').textContent = (engines.find((x) => x[0] === state.engine) || engines[0])[1];
    const t = $('stTierPill'); if (t) t.querySelector('b').textContent = (VIDEO_TIERS.find((x) => x[0] === state.tier) || VIDEO_TIERS[0])[1];
    const r = $('stResPill'); if (r) r.querySelector('b').textContent = state.resolution;
  }

  function togglePop(which) {
    ['aspect', 'style', 'dur', 'engine', 'tier', 'res'].forEach((k) => { const el = $('stPop-' + k); if (el && k !== which) el.classList.remove('open'); });
    const el = $('stPop-' + which); if (el) el.classList.toggle('open');
    popOpen = el?.classList.contains('open') ? which : null;
  }

  function buildPop(which) {
    const el = $('stPop-' + which); if (!el) return;
    let items = '';
    if (which === 'aspect') {
      const list = state.mode === 'video' ? VIDEO_ASPECTS : ASPECTS;
      items = list.map(([v, l]) => '<button type="button" data-v="' + v + '" class="' + (state.aspect === v ? 'on' : '') + '">' + l + '</button>').join('');
    }
    else if (which === 'style') items = Object.keys(STYLES).map((k) => '<button type="button" data-v="' + k + '" class="' + (state.style === k ? 'on' : '') + '">' + STYLES[k].label + '</button>').join('');
    else if (which === 'dur') items = DURATIONS.map(([v, l]) => '<button type="button" data-v="' + esc(v) + '" class="' + (state.duration === v ? 'on' : '') + '">' + l + '</button>').join('');
    else if (which === 'engine') items = engines.map(([v, l]) => '<button type="button" data-v="' + esc(v) + '" class="' + (state.engine === v ? 'on' : '') + '">' + l + '</button>').join('');
    else if (which === 'tier') items = VIDEO_TIERS.map(([v, l]) => '<button type="button" data-v="' + esc(v) + '" class="' + (state.tier === v ? 'on' : '') + '">' + l + '</button>').join('');
    else if (which === 'res') items = RESOLUTIONS.map(([v, l]) => '<button type="button" data-v="' + esc(v) + '" class="' + (state.resolution === v ? 'on' : '') + '">' + l + '</button>').join('');
    el.innerHTML = items;
    el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      if (which === 'aspect') state.aspect = b.dataset.v;
      if (which === 'style') state.style = b.dataset.v;
      if (which === 'dur') state.duration = b.dataset.v;
      if (which === 'engine') state.engine = b.dataset.v;
      if (which === 'tier') state.tier = b.dataset.v;
      if (which === 'res') state.resolution = b.dataset.v;
      updatePillLabels();
      el.classList.remove('open'); popOpen = null;
    }));
  }

  // ===== D-196: generate foto =====
  async function generate() {
    const ta = $('stPrompt'); const raw = (ta?.value || '').trim();
    if (raw.length < 3) { window.toast?.('Ceritakan dulu gambar yang kamu mau ya.'); ta?.focus(); return; }
    const mentioned = mentionedCharacters();
    if (mentioned.length > MAX_CHARACTERS) { window.toast?.('Maksimal ' + MAX_CHARACTERS + ' karakter per adegan.'); return; }
    const btn = $('stGenBtn'); const grid = $('stGallery');
    btn.disabled = true; btn.innerHTML = icon('refresh-cw') + ' Membuat…';
    const skel = document.createElement('div');
    skel.className = 'st-gal-item st-skel';
    skel.innerHTML = '<span class="st-gal-thumb"><span class="st-skel-img"></span></span>';
    if (grid) { grid.classList.remove('st-hidden'); grid.prepend(skel); }
    try {
      const prompt = composedPrompt(raw);
      const reqBody = { prompt, provider: state.engine, aspect: state.aspect };
      if (mentioned.length) reqBody.characterMentions = mentioned.map((c) => ({ id: c.id, name: c.name }));
      if (sceneRef) reqBody.sceneRef = { mime: sceneRef.mime, data: sceneRef.data };
      const sceneNumber = chain.length ? chain.length + 1 : 0;
      if (sceneNumber) { reqBody.sceneNumber = sceneNumber; reqBody.sceneTotal = sceneNumber; }
      const r = await fetch('/api/ai/image', { method: 'POST', headers: await authHeaders(), body: JSON.stringify(reqBody) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Generator gambar gagal.');
      // D-198: hasil foto langsung disimpan sebagai aset & tampil di galeri.
      const meta = {
        aspect: state.aspect, style: state.style,
        characters: mentioned.map((c) => c.name), scene: sceneNumber || 0,
      };
      await persistGenerated(d.image?.mime || 'image/png', d.image?.data || '', raw, meta);
      // Rantai adegan: simpan frame terakhir sebagai referensi adegan berikutnya.
      if (d.image?.data) {
        const frame = { id: 'f' + Date.now(), mime: d.image?.mime || 'image/png', data: d.image.data, prompt: raw, ts: Date.now() };
        chain = chain.filter((f) => f.id !== frame.id);
        chain.push(frame); saveChain();
        renderChain();
      }
      window.toast?.('Gambar jadi ✨');
    } catch (e) {
      skel.remove();
      window.toast?.(e.message || 'Generator gambar gagal.');
    } finally {
      btn.disabled = false; btn.innerHTML = icon('image-plus') + ' Buat Gambar';
    }
  }

  // ===== D-198: generate video (task + polling) =====
  async function generateVideo() {
    const ta = $('stPrompt'); const raw = (ta?.value || '').trim();
    if (raw.length < 3) { window.toast?.('Ceritakan dulu video yang kamu mau ya.'); ta?.focus(); return; }
    const btn = $('stVideoBtn');
    btn.disabled = true; btn.innerHTML = icon('refresh-cw') + ' Menyiapkan…';
    try {
      const mentioned = mentionedCharacters();
      const body = {
        prompt: raw, tier: state.tier, aspect: state.aspect,
        duration: Number(state.duration), resolution: state.resolution,
      };
      if (sceneRef) body.sceneRef = { mime: sceneRef.mime, data: sceneRef.data };
      const r = await fetch('/api/ai/video', { method: 'POST', headers: await authHeaders(), body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Generator video gagal.');
      videoTask = { id: d.id, progress: 0, status: 'running' };
      renderVideoProgress();
      window.toast?.('Video sedang dibuat… (±1-3 menit)');
      pollVideo();
    } catch (e) {
      window.toast?.(e.message || 'Generator video gagal.');
      btn.disabled = false; btn.innerHTML = icon('film') + ' Buat Video';
    }
  }
  function renderVideoProgress() {
    const box = $('stVideoProgress');
    if (!videoTask) { box?.classList.add('st-hidden'); box?.setAttribute('data-progress', '0'); return; }
    box.classList.remove('st-hidden');
    const pct = Math.max(2, Math.min(100, Number(videoTask.progress) || 0));
    box.setAttribute('data-progress', String(pct));
    box.innerHTML = '<div class="st-vp-bar"><span style="width:' + pct + '%"></span></div>'
      + '<p>' + icon('film') + ' <b>Video sedang dibuat</b> — ' + pct + '%'
      + (videoTask.status === 'fail' ? ' · gagal: ' + esc(videoTask.error || '') : '')
      + '<button type="button" class="st-vp-cancel" id="stVideoCancel">Batalkan</button></p>';
    $('stVideoCancel')?.addEventListener('click', () => {
      if (videoTimer) clearTimeout(videoTimer);
      videoTimer = null; videoTask = null;
      renderVideoProgress();
      const b = $('stVideoBtn'); if (b) { b.disabled = false; b.innerHTML = icon('film') + ' Buat Video'; }
      window.toast?.('Pemantauan video dibatalkan.');
    });
  }
  async function pollVideo() {
    if (!videoTask) return;
    try {
      const r = await fetch('/api/ai/video/' + videoTask.id, { headers: await authHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal mengecek status video.');
      videoTask.progress = d.progress || videoTask.progress;
      videoTask.status = d.status || 'running';
      if (d.status === 'success') {
        if (d.asset) { assets.unshift(d.asset); renderGallery(); }
        videoTask = null;
        renderVideoProgress();
        const b = $('stVideoBtn'); if (b) { b.disabled = false; b.innerHTML = icon('film') + ' Buat Video'; }
        window.toast?.('Video jadi ✨');
        return;
      }
      if (d.status === 'fail') {
        videoTask.error = d.error || 'Generator video gagal.';
        videoTask = null;
        renderVideoProgress();
        const b = $('stVideoBtn'); if (b) { b.disabled = false; b.innerHTML = icon('film') + ' Buat Video'; }
        window.toast?.(d.error || 'Generator video gagal.');
        return;
      }
      renderVideoProgress();
      videoTimer = setTimeout(pollVideo, 3000);
    } catch (e) {
      videoTask = null;
      renderVideoProgress();
      const b = $('stVideoBtn'); if (b) { b.disabled = false; b.innerHTML = icon('film') + ' Buat Video'; }
      window.toast?.(e.message || 'Gagal mengecek status video.');
    }
  }

  window.renderStudio = async function renderStudio() {
    const root = $('studioRoot'); if (!root) return;
    loadChain();
    root.innerHTML =
      '<div class="st-tabs">'
      + '<button type="button" class="st-tab active" data-mode="photo">' + icon('image-plus') + ' Foto</button>'
      + '<button type="button" class="st-tab" data-mode="video">' + icon('video') + ' Video</button>'
      + '</div>'
      // D-199: area atas = galeri aset (scrollable), komposer menempel di bawah.
      + '<div class="st-stage">'
      + '<div class="st-gallery st-hidden" id="stGallery"></div>'
      + '<div class="st-stage-empty" id="stStageEmpty">' + icon('image-plus') + '<b>Hasil generate & asetmu muncul di sini</b>'
      + '<p>Ketik <b>@</b> untuk menyematkan karakter, atau unggah aset untuk dipakai ulang.</p></div>'
      + '</div>'
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
      + '<div class="st-pill-wrap" id="stStylePillWrap"><button type="button" class="st-pill" id="stStylePill">' + icon('sparkles') + ' <b>Lifestyle</b></button><div class="st-pop" id="stPop-style"></div></div>'
      + '<div class="st-pill-wrap st-hidden" id="stDurPill"><button type="button" class="st-pill">' + icon('clock') + ' <b>8 detik</b></button><div class="st-pop" id="stPop-dur"></div></div>'
      + '<div class="st-pill-wrap st-hidden" id="stTierPillWrap"><button type="button" class="st-pill" id="stTierPill">' + icon('cpu') + ' <b>Veo 3.1 Fast</b></button><div class="st-pop" id="stPop-tier"></div></div>'
      + '<div class="st-pill-wrap st-hidden" id="stResPillWrap"><button type="button" class="st-pill" id="stResPill">' + icon('sparkles') + ' <b>720p</b></button><div class="st-pop" id="stPop-res"></div></div>'
      + '<span class="st-count" id="stCount">0/1200</span>'
      + '<button type="button" class="st-upload-btn" id="stUploadBtn" title="Unggah aset">' + icon('upload') + ' Unggah</button>'
      + '<button type="button" class="pink-btn" id="stGenBtn">' + icon('image-plus') + ' Buat Gambar</button>'
      + '<button type="button" class="pink-btn st-hidden" id="stVideoBtn">' + icon('film') + ' Buat Video</button>'
      + '</div>'
      + '<div class="st-video-progress st-hidden" id="stVideoProgress" data-progress="0"></div>'
      + '<input type="file" id="stUploadInput" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime" hidden>'
      + '<div class="st-lightbox" id="stLightbox"></div>';

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
    // D-198: galeri aset dari server.
    loadAssets();
    document.querySelectorAll('#studioRoot .st-tab').forEach((t) => t.addEventListener('click', () => setMode(t.dataset.mode)));
    $('stEnginePill')?.addEventListener('click', () => { buildPop('engine'); togglePop('engine'); });
    $('stAspectPill')?.addEventListener('click', () => { buildPop('aspect'); togglePop('aspect'); });
    $('stStylePill')?.addEventListener('click', () => { buildPop('style'); togglePop('style'); });
    $('stDurPill')?.querySelector('.st-pill').addEventListener('click', () => { buildPop('dur'); togglePop('dur'); });
    $('stTierPill')?.addEventListener('click', () => { buildPop('tier'); togglePop('tier'); });
    $('stResPill')?.addEventListener('click', () => { buildPop('res'); togglePop('res'); });
    const ta = $('stPrompt');
    // D-199: auto-fit — tinggi textarea menyesuaikan isi (44px -> max 150px).
    const autoFit = () => {
      if (!ta) return;
      ta.style.height = '44px';
      const next = Math.min(Math.max(ta.scrollHeight, 44), 150);
      ta.style.height = next + 'px';
      ta.style.overflowY = ta.scrollHeight > 150 ? 'auto' : 'hidden';
    };
    ta?.addEventListener('input', () => {
      const c = $('stCount'); if (c) c.textContent = ta.value.length + '/1200';
      autoFit();
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
    $('stVideoBtn')?.addEventListener('click', generateVideo);
    $('stUploadBtn')?.addEventListener('click', () => $('stUploadInput')?.click());
    $('stUploadInput')?.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) uploadAsset(f);
      e.target.value = '';
    });
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
    renderGallery();
  };
})();
