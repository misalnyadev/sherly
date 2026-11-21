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
  // D-214: `const ICONS` di index.html berada di global lexical scope yang TIDAK
  // terjangkau dari file script terpisah — jadi pakai window.ICONS sebagai fallback.
  // Tanpa ini semua ikon studio.js (upload, list-checks, dll.) tidak tampil.
  const icon = (key) => {
    const table = (typeof ICONS !== 'undefined' && ICONS) || window.ICONS || {};
    const paths = table[key] || '';
    return '<span data-icon="' + key + '">' + (paths ? '<svg viewBox="0 0 24 24" aria-hidden="true">' + paths + '</svg>' : '') + '</span>';
  };
  // D-205: ganti ikon pada sebuah pill — span[data-icon] lama diganti wholesale
  // (setAttribute pada <svg> tidak mengubah path-nya).
  const setIcon = (el, key) => {
    if (!el) return;
    const old = el.querySelector('[data-icon]');
    if (old) old.remove();
    const fresh = document.createElement('span');
    fresh.innerHTML = icon(key);
    const span = fresh.firstElementChild;
    if (span) el.insertBefore(span, el.firstChild);
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
  // D-205: rasio dengan tinggi >= lebar = vertikal (ikon smartphone), selain itu horizontal (monitor).
  const isVerticalAspect = (a) => {
    const m = String(a || '').match(/^(\d{1,2}):(\d{1,2})$/);
    if (!m) return false;
    return Number(m[1]) < Number(m[2]);
  };
  // D-200: katalog model video diambil dari server (/api/ai/video/models) agar
  // provider/model/durasi/resolusi/aspek di UI selalu sinkron dengan provider.
  // Fallback lokal: dipakai kalau endpoint katalog gagal (offline / belum login).
  const FALLBACK_VIDEO_MODELS = [
    { id: 'veo-3-1', provider: 'kie', label: 'Veo 3.1', maker: 'Google', durations: [4, 6, 8],
      resolutions: ['720p', '1080p', '4k'], aspects: ['16:9', '9:16'], audio: true, firstLastFrame: true,
      note: 'Google Veo 3.1 — kualitas tinggi + audio native.',
      tiers: [{ id: 'veo3_fast', label: 'Fast (hemat)' }, { id: 'veo3_lite', label: 'Lite (tercepat)' }, { id: 'veo3', label: 'Quality (premium)' }],
      defaultTier: 'veo3_fast', defaultDuration: 8, defaultResolution: '720p', defaultAspect: '9:16' },
    { id: 'kling-3.0/video', provider: 'kie', label: 'Kling 3.0', maker: 'Kuaishou', durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      resolutions: ['720p', '1080p'], aspects: ['16:9', '9:16', '1:1'], audio: true, firstLastFrame: true,
      note: 'Kling 3.0 — storytelling multi-shot, durasi panjang sampai 15 detik.',
      tiers: [{ id: 'std', label: 'Standar' }, { id: 'pro', label: 'Pro' }, { id: '4K', label: '4K' }],
      defaultTier: 'std', defaultDuration: 5, defaultResolution: '720p', defaultAspect: '9:16' },
    { id: 'bytedance/seedance-2', provider: 'kie', label: 'Seedance 2.0', maker: 'ByteDance', durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      resolutions: ['480p', '720p', '1080p', '4k'], aspects: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'], audio: true, firstLastFrame: true,
      note: 'Seedance 2.0 — paling konsisten & paling banyak rasio aspek.',
      tiers: [{ id: 'standard', label: 'Standard' }, { id: 'fast', label: 'Fast' }],
      defaultTier: 'standard', defaultDuration: 8, defaultResolution: '1080p', defaultAspect: '9:16' },
    { id: 'bytedance/seedance-2-fast', provider: 'kie', label: 'Seedance 2.0 Fast', maker: 'ByteDance', durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      resolutions: ['480p', '720p'], aspects: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'], audio: true, firstLastFrame: true,
      note: 'Seedance 2.0 Fast — hanya sampai 720p tapi generates lebih cepat.',
      tiers: [{ id: 'fast', label: 'Fast' }],
      defaultTier: 'fast', defaultDuration: 8, defaultResolution: '720p', defaultAspect: '9:16' },
    // D-239: Google Gemini Omni 1.2 Flash — 15 detik + audio native.
    { id: 'google/gemini-omni-flash-1-2', provider: 'kie', label: 'Omni 1.2 Flash', maker: 'Google',
      durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      resolutions: ['360p', '720p', '1080p', '4k'], aspects: ['16:9', '9:16', 'auto'], audio: true, firstLastFrame: true,
      firstLastFrameExclusive: true, maxReferences: 6,
      note: 'Google Gemini Omni 1.2 Flash — 15 detik, audio native, referensi karakter paling konsisten.',
      tiers: [{ id: 'standard', label: 'Standard' }],
      defaultTier: 'standard', defaultDuration: 8, defaultResolution: '720p', defaultAspect: '9:16' },
    // D-241: Seedance 2.5 — 30 detik, native 4K, 30 referensi, mode Draft (preview 480p).
    { id: 'bytedance/seedance-2-5', provider: 'kie', label: 'Seedance 2.5', maker: 'ByteDance',
      durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
      resolutions: ['480p', '720p', '1080p', '4k'], aspects: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', 'adaptive'],
      audio: true, firstLastFrame: true, maxReferences: 30, longForm: true,
      note: 'ByteDance Seedance 2.5 — sampai 30 detik, native 4K, 30 referensi multimodal.',
      tiers: [{ id: 'standard', label: 'Standard' }, { id: 'draft', label: 'Draft (preview 480p)' }],
      defaultTier: 'standard', defaultDuration: 10, defaultResolution: '1080p', defaultAspect: '9:16' },
    // D-241: Wan 3.0 — 2-30 detik, multimodal (dokumen/webpage/audio), paling hemat.
    { id: 'wan/3-0-video', provider: 'kie', label: 'Wan 3.0', maker: 'Alibaba',
      durations: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
      resolutions: ['480p', '720p', '1080p'], aspects: ['16:9', '4:3', '1:1', '3:4', '9:16', 'adaptive'],
      audio: true, firstLastFrame: true, maxReferences: 10, longForm: true,
      note: 'Alibaba Wan 3.0 — 2-30 detik, multimodal (dokumen/webpage/audio), paling hemat.',
      tiers: [{ id: 'standard', label: 'Standard' }],
      defaultTier: 'standard', defaultDuration: 10, defaultResolution: '720p', defaultAspect: '9:16' },
    // D-241: Kling 4.0 — 30 detik, 4K HDR, stereo audio, 15 referensi.
    { id: 'kling-4-0/reference-to-video', provider: 'kie', label: 'Kling 4.0', maker: 'Kuaishou',
      durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
      resolutions: ['720p', '1080p', '4k'], aspects: ['auto', '16:9', '9:16', '1:1', '21:9', '4:3', '3:4'],
      audio: true, firstLastFrame: true, maxReferences: 15, longForm: true,
      note: 'Kuaishou Kling 4.0 — 30 detik, 4K HDR, stereo audio, 15 referensi.',
      tiers: [{ id: 'std', label: 'Standar' }, { id: 'pro', label: 'Pro' }, { id: '4K', label: '4K' }, { id: 'hdr', label: '4K + HDR' }],
      defaultTier: 'std', defaultDuration: 10, defaultResolution: '1080p', defaultAspect: '9:16' },
  ];
  // D-203: katalog model gambar (Kie: Nano Banana / GPT Image / Seedream / FLUX).
  const FALLBACK_IMAGE_MODELS = [
    { id: 'nano-banana-2', provider: 'kie', label: 'Nano Banana 2', maker: 'Google', resolutions: ['1K', '2K', '4K'],
      aspects: ['1:1', '4:5', '9:16', '16:9'], maxReferences: 10, note: 'Google Nano Banana 2 — cepat & konsisten.',
      defaultResolution: '2K', defaultAspect: '4:5' },
    { id: 'nano-banana-pro', provider: 'kie', label: 'Nano Banana Pro', maker: 'Google', resolutions: ['1K', '2K', '4K'],
      aspects: ['1:1', '4:5', '9:16', '16:9'], maxReferences: 8, note: 'Google Nano Banana Pro — kualitas premium.',
      defaultResolution: '2K', defaultAspect: '4:5' },
    { id: 'gpt-image-2-text-to-image', provider: 'kie', label: 'GPT Image 2', maker: 'OpenAI', resolutions: ['1K', '2K', '4K'],
      aspects: ['1:1', '4:5', '9:16', '16:9'], maxReferences: 16, note: 'OpenAI GPT Image 2 — teks & fotorealisme.',
      defaultResolution: '2K', defaultAspect: '4:5' },
    { id: 'bytedance/seedream-5.0-lite', provider: 'kie', label: 'Seedream 5.0 Lite', maker: 'ByteDance', resolutions: ['1K', '2K', '4K'],
      aspects: ['1:1', '4:5', '9:16', '16:9'], maxReferences: 10, note: 'ByteDance Seedream Lite — cepat & murah.',
      defaultResolution: '1K', defaultAspect: '4:5' },
    { id: 'bytedance/seedream-5.0-pro', provider: 'kie', label: 'Seedream 5.0 Pro', maker: 'ByteDance', resolutions: ['1K', '2K', '4K'],
      aspects: ['1:1', '4:5', '9:16', '16:9'], maxReferences: 10, note: 'ByteDance Seedream Pro — detail tajam.',
      defaultResolution: '2K', defaultAspect: '4:5' },
    { id: 'flux-2-pro-text-to-image', provider: 'kie', label: 'FLUX 2 Pro', maker: 'Black Forest Labs', resolutions: ['1K', '2K', '4K'],
      aspects: ['1:1', '4:5', '9:16', '16:9'], maxReferences: 4, note: 'FLUX 2 Pro — komposisi & tipografi.',
      defaultResolution: '2K', defaultAspect: '4:5' },
    // D-241: Seedream 5.5 — background transparan, edit chain panjang.
    { id: 'bytedance/seedream-5-5', provider: 'kie', label: 'Seedream 5.5', maker: 'ByteDance', resolutions: ['1K', '2K', '4K'],
      aspects: ['1:1', '4:5', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '5:4', '21:9'], maxReferences: 10,
      note: 'ByteDance Seedream 5.5 — background transparan, edit chain panjang, teks kecil rapi.',
      defaultResolution: '2K', defaultAspect: '4:5' },
    // D-241: GPT Image 2.6 — poster & layout paling rapi, bisa SVG/GIF & transparan.
    { id: 'gpt-image-2-6/flare-text-to-image', provider: 'kie', label: 'GPT Image 2.6', maker: 'OpenAI', resolutions: ['1K', '2K', '4K'],
      aspects: ['1:1', '3:2', '2:3', '4:3', '3:4', '4:5', '5:4', '16:9', '9:16', '21:9', '2:11', '1:2'], maxReferences: 16,
      note: 'OpenAI GPT Image 2.6 — poster & layout paling rapi, bisa SVG/GIF & transparan.',
      defaultResolution: '2K', defaultAspect: '4:5' },
  ];
  let imageCatalog = { defaultModel: 'nano-banana-2', models: FALLBACK_IMAGE_MODELS };
  const imageModel = () => imageCatalog.models.find((m) => m.id === state.imageModel) || imageCatalog.models[0] || null;
  const imageResolutionOptions = () => (imageModel()?.resolutions || ['1K', '2K', '4K']).map((r) => [r, r]);
  let videoCatalog = { defaultModel: 'veo-3-1', models: FALLBACK_VIDEO_MODELS };
  const videoModel = () => videoCatalog.models.find((m) => m.id === state.videoModel) || videoCatalog.models[0] || null;
  // D-242: katalog model lipsync (potret + audio -> video karakter bicara).
  const FALLBACK_LIPSYNC_MODELS = [
    { id: 'infinitalk/from-audio', provider: 'kie', label: 'InfiniteTalk', maker: 'MeiGen-AI',
      resolutions: ['480p', '720p'], aspects: ['16:9', '9:16', '1:1'], maxSeconds: 15,
      note: 'MeiGen-AI InfiniteTalk — potret + audio jadi karakter bicara (lip-sync akurat).',
      defaultResolution: '720p', defaultAspect: '9:16' },
    { id: 'ltx/2-5-fast-audio-to-video', provider: 'kie', label: 'LTX 2.5 Fast A2V', maker: 'Lightricks',
      resolutions: ['720p', '1080p', '1440p'], aspects: ['16:9', '9:16', '1:1', '3:2', '2:3'], maxSeconds: 20,
      note: 'Lightricks LTX 2.5 Fast — durasi mengikuti audio (s/d 20 dtk), sampai 1440p.',
      defaultResolution: '1080p', defaultAspect: '9:16' },
  ];
  const FALLBACK_LIPSYNC_PROVIDERS = [
    { id: 'kie', label: 'Kie AI', note: 'Semua model lipsync via satu kunci Kie' },
  ];
  let lipsyncCatalog = {
    defaultModel: 'infinitalk/from-audio', maxSeconds: 15,
    providers: FALLBACK_LIPSYNC_PROVIDERS, models: FALLBACK_LIPSYNC_MODELS,
  };
  const lipsyncModel = () => lipsyncCatalog.models.find((m) => m.id === state.lipsyncModel) || lipsyncCatalog.models[0] || null;
  // D-231: ctx opsional -> pakai draft pengaturan (panel) bila diberikan.
  const videoModelOf = (ctx) => videoCatalog.models.find((m) => m.id === (ctx || state).videoModel) || videoCatalog.models[0] || null;
  const durationOptions = (ctx) => (videoModelOf(ctx)?.durations || [4, 6, 8]).map((d) => [String(d), d + ' detik']);
  const resolutionOptions = (ctx) => (videoModelOf(ctx)?.resolutions || ['720p']).map((r) => [r, r === '4k' ? '4K' : r]);
  const tierOptions = (ctx) => (videoModelOf(ctx)?.tiers || []).map((t) => [t.id, t.label]);
  const ASPECT_LABELS = {
    '16:9': 'Landscape (16:9)', '9:16': 'Vertikal (9:16)', '1:1': 'Persegi (1:1)',
    '4:5': 'Potret feed (4:5)', '21:9': 'Ultrawide (21:9)', '4:3': 'Layar 4:3', '3:4': 'Potret 3:4',
    '3:2': 'Layar 3:2', '2:3': 'Potret 2:3', '5:4': 'Layar 5:4', '2:11': 'Panorama 2:11', '1:2': 'Potret 1:2',
    'auto': 'Otomatis (model)', 'adaptive': 'Adaptif (ikut media)',
  };
  const aspectOptions = (ctx) => (videoModelOf(ctx)?.aspects || ['16:9', '9:16'])
    .map((a) => [a, ASPECT_LABELS[a] || a]);
  // D-200: samakan pilihan pengguna dengan kapabilitas model aktif.
  // resetToDefault=true -> pakai default model; false -> pertahankan nilai yang masih valid.
  function applyModelCaps(m, resetToDefault) {
    if (!m) return;
    // D-240: tier hanya di-reset ke default model bila `resetToDefault`.
    // Kalau tidak, tier yang sudah dipilih user dipertahankan selama masih
    // didukung model (tier model berbeda2, mis. veo3_fast vs std vs 4K).
    const tierIds = (m.tiers || []).map((t) => t.id);
    if (resetToDefault || !tierIds.includes(state.tier)) {
      state.tier = m.defaultTier;
    }
    const dur = Number(state.duration);
    if (resetToDefault && m.defaultDuration && m.durations.includes(Number(m.defaultDuration))) {
      state.duration = String(m.defaultDuration);
    } else if (!m.durations.includes(dur)) {
      state.duration = String(m.durations[m.durations.length - 1]);
    }
    if (resetToDefault && m.defaultResolution && m.resolutions.includes(m.defaultResolution)) {
      state.resolution = m.defaultResolution;
    } else if (!m.resolutions.includes(state.resolution)) {
      state.resolution = m.resolutions[0];
    }
    if (resetToDefault && m.defaultAspect && m.aspects.includes(m.defaultAspect)) {
      state.aspect = m.defaultAspect;
    } else if (!m.aspects.includes(state.aspect)) {
      state.aspect = m.aspects.includes('9:16') ? '9:16' : m.aspects[0];
    }
  }
  let engines = [['auto', 'Otomatis'], ['gemini', 'Google Gemini'], ['kie', 'Kie AI']];
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
    // D-200: provider + model video (dipilih lewat pill "Model").
    videoModel: 'veo-3-1', audio: true,
    // D-242: mode "Karakter Bicara" (lipsync) — model, karakter, resolusi.
    lipsyncModel: 'infinitalk/from-audio', lipsyncCharacterId: '', lipsyncResolution: '720p',
    // D-203: model gambar (Kie) + jenis konten (satu kotak pilihan).
    imageModel: 'nano-banana-2', imageResolution: '2K', contentType: 'photo',
  };
  let assets = [];           // D-198: galeri aset (dari server)
  let chain = [];            // rantai adegan (lokal): frame terakhir jadi referensi gambar
  let sceneRef = null;       // { mime, data, label } gambar referensi utama (dikirim ke server)
  // D-216: semua gambar referensi aktif (dipilih lewat mention @ atau tombol lightbox).
  let sceneRefs = [];        // [{ id, mime, data, label, fromId }]
  let popOpen = null;
  let mentionOpen = false;  // dropdown mention terbuka?
  let mentionIndex = 0;     // indeks highlight di dropdown mention
  let mentionQuery = '';    // teks setelah "@" yang diketik user
  let mentionAt = -1;       // posisi karakter "@" yang memicu dropdown
  let videoTask = null;     // D-198: task video yang sedang berjalan
  let videoTimer = null;
  // D-207: Bank Prompt — template utuh + blok modular.
  let promptBank = [];          // entri dari server (template & block)
  let promptBankLoaded = false;
  let selectedBlocks = [];      // id blok yang sudah dipilih user (ditumpuk di prompt)
  let promptBankTab = 'template'; // tab aktif di popover bank prompt
  let promptBankQuery = '';        // D-237: kata kunci pencarian bank prompt
  let promptBankMode = 'foto';     // D-208: mode prompt (foto|video) ikut jenis konten

  // Tutup popover saat klik di luar pil (sekali terdaftar di level modul).
  document.addEventListener('click', (e) => {
    // D-231: panel pengaturan konten punya draft — klik di dalam panel
    // (pilih setting / Simpan / Batal) TIDAK boleh menutupnya diam-diam.
    if (popOpen === 'settings') {
      // Elemen yang diklik masih di dalam panel? -> biarkan panel terbuka.
      if (e.target.closest && e.target.closest('#stPop-settings')) return;
      // Elemen sudah dilepas (mis. chip yang di-re-render saat dipilih):
      // event ini datang dari interaksi DI DALAM panel -> jangan tutup.
      if (e.target && e.target.isConnected === false) return;
    }
    if (popOpen && !e.target.closest('.st-pill-wrap')) {
      const was = popOpen;
      document.getElementById('stPop-' + was)?.classList.remove('open');
      document.getElementById('stPop-' + was)?.classList.remove('st-pop-center');
      popOpen = null;
      syncBackdrop(null);
      // D-231: panel pengaturan ditutup tanpa Save -> draft dibuang.
      if (was === 'settings') cancelSettingsDraft();
    }
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
    sceneRefs = [];
    try { localStorage.removeItem(CHAIN_KEY); } catch {}
    renderChain(); renderAssetHeader();
  }
  function removeChainFrame(id) {
    chain = chain.filter((f) => f.id !== id);
    if (sceneRef && sceneRef.fromId === id) sceneRef = null;
    sceneRefs = sceneRefs.filter((r) => r.fromId !== id);
    syncSceneRef();
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
  /**
   * D-216: aset gambar yang di-mention di prompt.
   * Token @slug-asetXx menuliskan aset gambar sebagai referensi di header komposer.
   */
  function mentionedAssetIds() {
    const ta = $('stPrompt'); const text = ta?.value || '';
    if (!text.includes('@')) return [];
    const bySlug = new Map();
    for (const a of assets) { if (!a || !a.url) continue; bySlug.set(assetTokenSlug(a), a.id); }
    const out = []; const seen = new Set();
    const re = /@([a-z0-9][a-z0-9_-]{0,59})/gi; let m;
    while ((m = re.exec(text))) {
      const raw = String(m[1] || '').toLowerCase();
      let id = bySlug.get(raw);
      if (!id) {
        // D-220: user masih mengetik di belakang token -> "@aset-kopiabcde"
        // harus tetap dikenali sebagai "@aset-kopi". Cocokkan PREFIX terpanjang.
        let bestSlug = null; let bestId = null;
        for (const [slug, aid] of bySlug) {
          if (raw.startsWith(slug) && (!bestSlug || slug.length > bestSlug.length)) { bestSlug = slug; bestId = aid; }
        }
        id = bestId;
      }
      if (!id || seen.has(id)) continue;
      seen.add(id); out.push(id);
    }
    return out;
  }
  /**
   * D-216: sinkronkan gambar referensi di header dengan mention di prompt.
   * Aset yang di-mention -> dimuat jadi referensi; aset yang dihapus dari
   * prompt -> dicabut dari header.
   */
  async function syncMentionedAssetRefs() {
    const wanted = mentionedAssetIds();
    const current = sceneRefs.map((r) => r.fromId).filter(Boolean);
    // D-220: kalau tidak ada perubahan -> jangan sentuh apa pun. Menyentuh
    // header saat mengetik = layout bergeser = kursor meloncat ke atas.
    const same = wanted.length === current.length && wanted.every((id) => current.includes(id));
    if (same) return;
    // Buang yang tidak lagi di-mention.
    let changed = false;
    for (const id of current) {
      if (!wanted.includes(id)) { sceneRefs = sceneRefs.filter((r) => r.fromId !== id); changed = true; }
    }
    // Tambah yang baru di-mention (bukan karakter -> skip).
    for (const id of wanted) {
      if (sceneRefs.some((r) => r.fromId === id)) continue;
      const a = assets.find((x) => x.id === id); if (!a) continue;
      try {
        // Video -> ambil frame pertama; gambar -> muat langsung.
        let mime = 'image/png', dataUrl = '';
        if (a.media_type === 'video') {
          dataUrl = await firstVideoFrame(a.url);
          if (!dataUrl) continue;
        } else {
          const res = await fetch(a.url);
          const blob = await res.blob();
          mime = blob.type || 'image/png';
          dataUrl = await blobToDataUrl(blob);
        }
        if (!dataUrl) continue;
        sceneRefs.push({ mime, data: dataUrl, label: 'Aset: ' + String(a.file_name || 'Aset').slice(0, 28), fromId: a.id });
        changed = true;
      } catch { /* gagal muat -> lewati */ }
    }
    if (sceneRefs.length > 4) { sceneRefs = sceneRefs.slice(sceneRefs.length - 4); changed = true; }
    if (changed) {
      syncSceneRef(); renderAssetHeader();
      // D-244: bar karakter menampilkan sumber gambar utama lipsync.
      renderLipsyncBar();
    }
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
      if (r.ok) {
        assets = Array.isArray(d?.assets) ? d.assets : [];
        renderGallery();
        // D-220: aset baru termuat -> sinkronkan dengan mention yang sudah ada
        // di prompt (sebelumnya mention aset gambar gagal karena aset belum
        // tersedia saat prompt diketik).
        await syncMentionedAssetRefs();
      }
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
        addSceneRef({ mime: 'image/png', data: dataUrl, label: 'Frame video: ' + (a.file_name || '').slice(0, 28), fromId: a.id });
      } catch { window.toast?.('Gagal mengambil frame dari video.'); return; }
    } else {
      try {
        const res = await fetch(a.url);
        const blob = await res.blob();
        const dataUrl = await blobToDataUrl(blob);
        addSceneRef({ mime: blob.type || 'image/png', data: dataUrl, label: 'Aset: ' + (a.file_name || '').slice(0, 28), fromId: a.id });
      } catch { window.toast?.('Gagal memuat aset sebagai referensi.'); return; }
    }
    updatePillLabels();
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
      sceneRefs = sceneRefs.filter((ref) => ref.fromId !== a.id);
      syncSceneRef();
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
    // D-215: referensi hanya ICON foto (tanpa nama, tanpa kapsul) supaya 3 karakter
    // + 1 gambar muat 1 baris. Info aset muncul saat kursor di-hover (tooltip).
    for (const c of mentioned) {
      // D-224: aset karakter punya 3 ikon: suara (mic), bible/naskah
      // (book-open), dan user (avatar). Di KOTAK avatar hanya ikon terakhir
      // (user) yang tampil; ikon suara & bible tampil di DAFTAR mention.
      // Detail lengkap tetap ada di tooltip saat hover.
      const badges = [];
      const v = c.voice || {};
      const notes = [];
      notes.push(c.name);
      const hasVoice = !!(v.name || v.style);
      const hasSheet = !!c.board_image_url;
      badges.push('<span class="st-asset-badge">' + icon('user') + '</span>');
      if (hasVoice) notes.push('Suara: ' + (v.name || v.style));
      if (hasSheet) notes.push('Punya master sheet');
      if (c.role) notes.push(c.role);
      // D-217/D-223: kelas has-voice / has-sheet -> outline pink di sekeliling avatar.
      const outlineCls = hasVoice ? ' has-voice' : '';
      const outlineCls2 = hasSheet ? ' has-sheet' : '';
      parts.push(
        '<span class="st-asset st-asset-char' + outlineCls + outlineCls2 + '" tabindex="0" aria-label="' + esc(c.name) + '" data-asset-tip="' + esc(notes.join(' \u00b7 ')) + '">'
        // D-226: badge user = PETAK kecil di dalam kotak avatar, sudut kanan
        // bawah. Badge adalah ANAK dari .st-asset-face (yang overflow:hidden)
        // sehingga tidak ada bagian yang keluar/meluber dari kotak referensi.
        + '<span class="st-asset-face">' + characterThumb(c) + badges.join('') + '</span>'
        + '<button type="button" class="st-asset-x" data-mention-remove="' + esc(slugify(c.name)) + '" aria-label="Hapus ' + esc(c.name) + '">'
        + icon('x') + '</button>'
        + '<span class="st-asset-tip" role="tooltip">' + esc(notes.join(' \u00b7 ')) + '</span>'
        + '</span>'
      );
    }
    // D-216: SEMUA gambar referensi (dipilih lewat mention @) ditampilkan sebagai petak.
    for (const r of sceneRefs) {
      const label = r.label || 'Referensi gambar';
      parts.push(
        '<span class="st-asset st-asset-scene" tabindex="0" aria-label="' + esc(label) + '" data-asset-tip="' + esc(label) + '">'
        + '<span class="st-asset-scene-img"><img src="data:' + esc(r.mime || 'image/png') + ';base64,' + esc(r.data) + '" alt=""></span>'
        + '<button type="button" class="st-asset-x" data-scene-remove="' + esc(r.fromId || '') + '" aria-label="Hapus referensi gambar">' + icon('x') + '</button>'
        + '<span class="st-asset-tip" role="tooltip">' + esc(label) + '</span>'
        + '</span>'
      );
    }
    // D-197: tanpa aset aktif -> header disembunyikan (bukan kotak kosong) supaya tampilan simpel.
    // D-220: HANYA re-render kalau isinya benar-benar berubah. Re-render tiap
    // ketikan mengubah DOM -> layout di atas composer bergeser -> kursor
    // meloncat ke atas (paling terasa saat ada referensi aktif).
    const html = parts.join('');
    const hidden = !parts.length;
    if (box.dataset.renderedHtml === html && box.classList.contains('st-hidden') === hidden) return;
    box.dataset.renderedHtml = html;
    box.innerHTML = html;
    box.classList.toggle('st-hidden', hidden);
    // Kursor mungkin bergeser karena DOM header berubah -> pulihkan posisinya.
    if (typeof window.__sherlyRestoreCaret === 'function') window.__sherlyRestoreCaret();
    box.querySelectorAll('[data-mention-remove]').forEach((b) => b.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      removeMentionFromPrompt(b.dataset.mentionRemove);
    }));
    box.querySelectorAll('[data-scene-remove]').forEach((b) => b.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const fid = b.dataset.sceneRemove;
      if (fid) removeSceneRef(fid);
      else { sceneRef = null; sceneRefs = []; renderAssetHeader(); }
      window.toast?.('Referensi gambar dilepas.');
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
  // ===== D-216: Mention = SATU-SATUNYA cara memuat aset =====
  // Ketik "@" -> daftar SEMUA aset: karakter + gambar dari galeri aset.
  // Pilih salah satu -> masuk ke header composer sebagai referensi & token
  // @slug ditulis ke prompt (penandaan tepat untuk generator).
  function assetTokenSlug(a) {
    // Slug unik & stabil untuk aset gambar (bukan karakter).
    // PREFIX 'aset-' mencegah tabrakan dengan slug karakter.
    // Panjang dibatasi 60 char total supaya cocok regex mention.
    const base = slugify(String(a?.file_name || 'aset').replace(/\.[a-z0-9]+$/i, '')) || 'aset';
    return ('aset-' + base).slice(0, 60);
  }
  /** Daftar kandidat mention: karakter + aset gambar, satu daftar gabungan. */
  function mentionCandidates() {
    const q = mentionQuery.toLowerCase();
    const usedChars = new Set(mentionedCharacters().map((c) => c.id));
    const out = [];
    // 1) Karakter (potret + sheet + suara) — maks 3.
    for (const c of characters) {
      if (usedChars.has(c.id)) continue;
      if (q && !slugify(c.name).includes(q) && !String(c.name || '').toLowerCase().includes(q)) continue;
      out.push({ kind: 'char', id: c.id, name: c.name, data: c });
    }
    // 2) Aset gambar dari galeri — dikecilkan ke label ringkas.
    const usedAssets = new Set(referencedAssetIds());
    for (const a of assets) {
      if (!a || !a.url) continue;
      if (usedAssets.has(a.id)) continue;
      const label = String(a.file_name || 'Aset').replace(/\.[a-z0-9]+$/i, '');
      if (q && !label.toLowerCase().includes(q) && !assetTokenSlug(a).includes(q)) continue;
      out.push({ kind: 'asset', id: a.id, name: label, data: a });
    }
    return out;
  }
  /**
   * D-219: thumbnail untuk daftar mention. Selalu <img> supaya thumbnail benar-
   * benar tampil (video memakai <img> + ikon film, bukan elemen <video>).
   */
  function mentionAssetThumb(a) {
    if (!a || !a.url) return '<span class="st-mention-empty-thumb">' + icon('image') + '</span>';
    if (a.media_type === 'video') {
      return '<img src="' + esc(a.url) + '" alt="" loading="lazy" onerror="this.classList.add(\'is-broken\')">'
        + '<span class="st-mention-video-dot">' + icon('film') + '</span>';
    }
    return '<img src="' + esc(a.url) + '" alt="' + esc(String(a.file_name || 'Aset').slice(0, 40)) + '" loading="lazy" onerror="this.classList.add(\'is-broken\')">';
  }
  /** ID aset gambar yang SEDANG aktif sebagai referensi di header. */
  function referencedAssetIds() {
    const ids = [];
    for (const r of sceneRefs) if (r.fromId) ids.push(r.fromId);
    if (sceneRef && sceneRef.fromId && !ids.includes(sceneRef.fromId)) ids.push(sceneRef.fromId);
    return ids;
  }
  /** D-216: tambah gambar referensi (dari mention @ atau tombol "Jadikan Referensi"). */
  function addSceneRef(ref) {
    if (!ref || !ref.data) return;
    // Ganti bila aset sama sudah ada (idempoten) — mention @ aset tidak boleh dobel.
    if (ref.fromId) {
      const i = sceneRefs.findIndex((r) => r.fromId === ref.fromId);
      if (i >= 0) { sceneRefs[i] = ref; syncSceneRef(); renderAssetHeader(); return; }
    }
    sceneRefs.push(ref);
    // Batas 4 gambar referensi — biar header tetap 1 baris.
    if (sceneRefs.length > 4) sceneRefs.shift();
    syncSceneRef();
    renderAssetHeader();
  }
  /** D-216: hapus satu gambar referensi. */
  function removeSceneRef(fromId) {
    sceneRefs = sceneRefs.filter((r) => r.fromId !== fromId);
    syncSceneRef();
    renderAssetHeader();
  }
  /** sceneRef utama = gambar referensi pertama (dikirim ke server). */
  function syncSceneRef() {
    sceneRef = sceneRefs.length ? { mime: sceneRefs[0].mime, data: sceneRefs[0].data, label: sceneRefs[0].label, fromId: sceneRefs[0].fromId } : null;
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
      box.innerHTML = '<div class="st-mention-empty">'
        + (characters.length || assets.length
            ? 'Tidak ada aset yang cocok.'
            : 'Belum ada aset. Buat karakter dulu atau generate/unggah gambar.')
        + '</div>';
      box.classList.add('open'); return;
    }
    // D-216: satu daftar gabungan karakter + aset gambar, dikelompokkan.
    const chars = list.filter((x) => x.kind === 'char');
    const imgs = list.filter((x) => x.kind === 'asset');
    let idx = 0;
    const renderItem = (it) => {
      const i = idx++;
      const on = i === mentionIndex ? ' on' : '';
      if (it.kind === 'char') {
        const c = it.data; const v = c.voice || {};
        // D-224: di daftar tampil 2 ikon status: suara (mic) & bible (book-open).
        const marks = [];
        if (v.name || v.style) marks.push(icon('mic'));
        if (c.board_image_url) marks.push(icon('book-open'));
        const ocls = (v.name || v.style) ? ' has-voice' : (c.board_image_url ? ' has-sheet' : '');
        return '<button type="button" class="st-mention-item' + on + ocls + '" data-mention-pick="char:' + esc(it.id) + '" data-mention-kind="char">'
          + '<span class="st-mention-face st-mention-face-box">' + characterThumb(c) + '</span>'
          + '<span class="st-mention-name">' + esc(it.name) + '</span>'
          + '<span class="st-mention-marks">' + marks.join('') + '</span></button>';
      }
      const a = it.data;
      return '<button type="button" class="st-mention-item' + on + '" data-mention-pick="asset:' + esc(it.id) + '" data-mention-kind="asset">'
        + '<span class="st-mention-face st-mention-face-box st-mention-face-asset">' + mentionAssetThumb(a) + '</span>'
        + '<span class="st-mention-name">' + esc(it.name) + '</span>'
        + '<span class="st-mention-marks">' + icon('image') + '</span></button>';
    };
    let html = '';
    if (chars.length) html += '<div class="st-mention-group">' + icon('user') + ' Karakter</div>' + chars.map(renderItem).join('');
    if (imgs.length) html += '<div class="st-mention-group">' + icon('image') + ' Aset Gambar</div>' + imgs.map(renderItem).join('');
    box.innerHTML = html;
    box.classList.add('open');
    box.querySelectorAll('[data-mention-pick]').forEach((b) => b.addEventListener('mousedown', (e) => {
      e.preventDefault();
      pickMention(b.dataset.mentionPick);
    }));
  }
  function pickMention(key) {
    const ta = $('stPrompt'); if (!ta) return;
    const raw = String(key || '');
    const kind = raw.startsWith('asset:') ? 'asset' : 'char';
    const id = raw.slice(kind.length + 1);
    const text = String(ta.value || '');
    const before = text.slice(0, mentionAt);
    const after = text.slice(mentionAt + 1 + mentionQuery.length);
    let token = '';
    if (kind === 'char') {
      const c = characters.find((x) => x.id === id); if (!c) return;
      token = '@' + slugify(c.name);
    } else {
      const a = assets.find((x) => x.id === id); if (!a) return;
      token = '@' + assetTokenSlug(a);
      // Referensi gambar dimuat oleh syncMentionedAssetRefs() (dari isi prompt),
      // jadi tidak dobel kalau user mention aset yang sama lagi.
    }
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
      sceneRef = null; sceneRefs = []; renderChain(); renderAssetHeader();
      $('stPrompt')?.focus();
      window.toast?.('Adegan baru — lanjutkan ceritanya.');
    });
  }

  function aspectLabel() { const a = ASPECTS.find((x) => x[0] === state.aspect); return a ? a[0] : state.aspect; }

  // D-203: jenis konten dipilih lewat satu kotak pilihan (pill "Jenis Konten").
  const CONTENT_TYPES = [
    ['photo', 'Foto', 'image-plus'],
    ['video', 'Video', 'video'],
    // D-242: mode lipsync — karakter bicara (potret + naskah -> video).
    ['lipsync', 'Karakter Bicara', 'mic'],
  ];
  function setMode(m) {
    // D-242: tiga mode konten — foto, video, dan karakter bicara (lipsync).
    const mode = m === 'video' ? 'video' : m === 'lipsync' ? 'lipsync' : 'photo';
    state.mode = mode;
    state.contentType = mode;
    const isVideo = mode === 'video';
    const isLip = mode === 'lipsync';
    // Rasio aspek video mengikuti kapabilitas model terpilih.
    if (isVideo) {
      const aspects = videoModel()?.aspects || ['16:9', '9:16'];
      if (!aspects.includes(state.aspect)) state.aspect = aspects.includes('9:16') ? '9:16' : aspects[0];
    } else if (isLip) {
      // Lipsync: rasio mengikuti model lipsync (16:9 / 9:16 / 1:1).
      const asp = lipsyncModel()?.aspects || ['9:16'];
      if (!asp.includes(state.aspect)) state.aspect = asp.includes('9:16') ? '9:16' : asp[0];
    } else if (!ASPECTS.some((v) => v[0] === state.aspect)) state.aspect = '4:5';
    // D-222: placeholder ringkas (tidak ada contoh panjang).
    const ta = $('stPrompt');
    if (ta) {
      ta.placeholder = isVideo ? 'Prompt video… mention @ karakter/aset dll.'
        // D-244: di mode Karakter Bicara, mention gambar = karakter di lokasi tertentu.
        : isLip ? 'Naskah… mention @ gambar karakter di lokasi tertentu'
        : 'Prompt… mention @ karakter/aset dll.';
    // D-244: di mode lipsync, textarea utama = naskah (bukan prompt adegan).
    }
    $('stModelPillWrap')?.classList.toggle('st-hidden', !isVideo);
    $('stDurPill')?.classList.toggle('st-hidden', !isVideo);
    $('stTierPillWrap')?.classList.toggle('st-hidden', !isVideo);
    $('stResPillWrap')?.classList.toggle('st-hidden', !isVideo);
    // D-245: pill resolusi lipsync hanya di mode Karakter Bicara.
    $('stLipResPillWrap')?.classList.toggle('st-hidden', !isLip);
    // D-245: mode Karakter Bicara — Provider & Resolusi ditampilkan
    // (semua model lipsync ada di Kie AI).
    $('stEnginePillWrap')?.classList.toggle('st-hidden', isVideo);
    // D-208: pill Style dihapus — semua gaya jadi template transparan di Bank Prompt.
    // Bank prompt mengikuti jenis konten (foto <-> video) supaya tidak salah pilih.
    // mode konten di Studio: 'photo' | 'video' | 'lipsync'  ->  mode prompt: 'foto' | 'video'
    const pbMode = mode === 'video' ? 'video' : 'foto';
    if (promptBankMode !== pbMode) {
      promptBankMode = pbMode;
      promptBankLoaded = false;   // muat ulang daftar untuk mode baru
      selectedBlocks = [];        // blok dari mode lama tidak relevan
    }
    // D-203: pill model gambar hanya saat foto & mesin memakai Kie.
    const kieEngine = state.engine === 'kie' || state.engine === 'auto' || state.engine.startsWith('custom:');
    $('stImgModelPillWrap')?.classList.toggle('st-hidden', isVideo || isLip || !kieEngine);
    $('stGenBtn')?.classList.toggle('st-hidden', isVideo || isLip);
    $('stVideoBtn')?.classList.toggle('st-hidden', !isVideo);
    // D-242: tombol khusus lipsync.
    $('stLipsyncBtn')?.classList.toggle('st-hidden', !isLip);
    // D-242: Bank Prompt (template foto/video) tidak relevan untuk naskah lipsync.
    document.querySelector('.st-prompt-tools')?.classList.toggle('st-hidden', isLip);
    // D-244: input "Arahan adegan" hanya untuk mode Karakter Bicara.
    $('stSceneHintBox')?.classList.toggle('st-hidden', !isLip);
    renderLipsyncBar();
    updatePillLabels();
  }

  function updatePillLabels() {
    // D-245: pakai draft bila panel Pengaturan Konten sedang dibuka,
    // supaya label pill ikut berubah saat pilihan di panel diubah.
    const ctx = settingCtx();
    const a = $('stAspectPill'), d = $('stDurPill');
    if (a) a.querySelector('b').textContent = aspectLabel();
    const durLabel = durationOptions().find((x) => x[0] === ctx.duration);
    if (d) d.querySelector('b').textContent = durLabel ? durLabel[1] : ctx.duration + ' detik';
    const e = $('stEnginePill'); if (e) e.querySelector('b').textContent = (engines.find((x) => x[0] === state.engine) || engines[0])[1];
    const m = videoModel();
    const mp = $('stModelPill'); if (mp) mp.querySelector('b').textContent = m ? m.label : 'Model';
    // D-203: label jenis konten & model gambar.
    const tp = $('stTypePill');
    if (tp) {
      const ct = CONTENT_TYPES.find((c) => c[0] === state.mode) || CONTENT_TYPES[0];
      tp.querySelector('b').textContent = ct[1];
      setIcon(tp, ct[2]);
    }
    // D-205: ikon rasio ikut pilihan — vertikal (smartphone) / horizontal (monitor).
    const ap = $('stAspectPill');
    if (ap) setIcon(ap, isVerticalAspect(state.aspect) ? 'smartphone' : 'monitor');
    // D-207/D-213/D-214: jumlah blok aktif tampil di item menu "Prompt" & di tombol menu.
    // Penting: ambil span JUDUL (bukan span ikon pertama).
    const pp = $('stPromptPill');
    if (pp) {
      const sp = pp.querySelector('span:not([data-icon])');
      if (sp) sp.textContent = promptBankLabel();
      pp.classList.toggle('st-on', selectedBlocks.length > 0);
    }
    // Tombol menu utama ikut memberi tanda saat ada blok aktif.
    const mb = $('stPromptMenuBtn');
    if (mb) {
      const b = mb.querySelector('b');
      if (b) b.textContent = promptBankLabel();
      mb.classList.toggle('st-on', selectedBlocks.length > 0);
    }
    const im = imageModel();
    const imp = $('stImgModelPill'); if (imp) imp.querySelector('b').textContent = im ? im.label : 'Model';
    const tierLabel = tierOptions().find((x) => x[0] === state.tier);
    const t = $('stTierPill'); if (t) t.querySelector('b').textContent = tierLabel ? tierLabel[1] : state.tier;
    const r = $('stResPill'); if (r) r.querySelector('b').textContent = state.resolution;
    // D-245: label resolusi lipsync + label engine/provider di mode lipsync.
    const lr = $('stLipResPill'); if (lr) lr.querySelector('b').textContent = ctx.lipsyncResolution;
    const le = $('stEnginePill');
    if (le) {
      if (ctx.mode === 'lipsync') {
        const prov = (lipsyncCatalog.providers || []).find((p) => p.id === 'kie');
        le.querySelector('b').textContent = prov ? prov.label : 'Kie AI';
      } else {
        le.querySelector('b').textContent = (engines.find((x) => x[0] === ctx.engine) || engines[0])[1];
      }
    }
  }

  /** D-210: deteksi layout HP (lebar layar kecil). */
  function isMobileLayout() {
    return window.innerWidth <= 560;
  }

  /** D-213: tutup menu aksi prompt (dipakai setelah salah satu aksi dijalankan). */
  function closeActionMenu() {
    const menu = $('stPop-actions');
    menu?.classList.remove('open');
    if (popOpen === 'actions') popOpen = null;
  }

  /**
   * D-213: popover prompt sudah jadi panel tengah di HP (`.st-pop-center`),
   * jadi tidak perlu backdrop terpisah lagi — fungsi dipertahankan sebagai
   * no-op aman supaya pemanggilan lama tidak error.
   */
  function syncBackdrop() { /* tidak ada backdrop — panel tengah suffice */ }

  function togglePop(which) {
    ['aspect', 'style', 'dur', 'engine', 'model', 'tier', 'res', 'lipres', 'type', 'imgmodel', 'prompt', 'actions', 'settings', 'lipsyncchar'].forEach((k) => { const el = $('stPop-' + k); if (el && k !== which) el.classList.remove('open'); });
    const el = $('stPop-' + which); if (el) el.classList.toggle('open');
    popOpen = el?.classList.contains('open') ? which : null;
    if (el?.classList.contains('open')) positionPop(el);
    else el?.classList.remove('st-pop-center');
    syncBackdrop();
  }

  // D-201: daftar pilihan dibuka ke ATAS (komposer di bawah). Kalau ruang di atas
  // tidak cukup, balik ke bawah supaya daftar tidak keluar dari layar.
  function positionPop(el) {
    el.classList.remove('pop-up', 'pop-down');
    const wrap = el.parentElement;
    if (!wrap) return;
    // D-210: di HP, jendela pilih Prompt jadi panel di TENGAH layar (fixed),
    // supaya daftar panjang tidak terpotong tepi kiri/kanan.
    if (el.id === 'stPop-prompt' && isMobileLayout()) {
      el.classList.add('st-pop-center');
      return;
    }
    el.classList.remove('st-pop-center');
    // D-213: menu aksi berada di dalam composer (bawah) -> daftar dibuka ke ATAS.
    if (el.id === 'stPop-actions') {
      el.classList.add('pop-up');
      el.classList.remove('pop-right');
      return;
    }
    const rect = wrap.getBoundingClientRect();
    const room = rect.top - 8;
    const need = Math.min(el.scrollHeight || 240, window.innerHeight * 0.56);
    if (room < need && room < (window.innerHeight - rect.bottom)) {
      el.classList.add('pop-down');
    } else {
      el.classList.add('pop-up');
    }
    // Samping: kalau meluber ke kanan, samakan ke tepi kanan viewport.
    el.classList.remove('pop-right');
    const w = el.offsetWidth || 200;
    if (rect.left + w > window.innerWidth - 12) el.classList.add('pop-right');
  }

  function buildPop(which) {
    const el = $('stPop-' + which); if (!el) return;
    let items = '';
    if (which === 'aspect') {
      const list = state.mode === 'video' ? aspectOptions() : ASPECTS;
      items = list.map(([v, l]) => '<button type="button" data-v="' + esc(v) + '" class="' + (state.aspect === v ? 'on' : '') + '">' + l + '</button>').join('');
    }
    else if (which === 'dur') items = durationOptions().map(([v, l]) => '<button type="button" data-v="' + esc(v) + '" class="' + (state.duration === v ? 'on' : '') + '">' + l + '</button>').join('');
    else if (which === 'engine') {
      // D-204: label pill ringkas ("Otomatis") — penjelasan lengkap tetap di popover.
      const ENGINE_NOTES = {
        auto: 'Kie → Kustom → Gemini',
        gemini: 'Google Gemini',
        kie: 'Kie AI',
      };
      // D-245: mode Karakter Bicara — semua model lipsync ada di Kie AI,
      // jadi Provider yang tersedia hanya "Kie AI" (bukan Otomatis/Gemini).
      const engineList = state.mode === 'lipsync'
        ? (lipsyncCatalog.providers || [{ id: 'kie', label: 'Kie AI', note: '' }])
            .map((p) => [p.id, p.label, p.note || ''])
        : engines;
      items = engineList.map(([v, l, note]) => '<button type="button" data-v="' + esc(v) + '" class="' + (state.engine === v ? 'on' : '') + '">'
        + '<span class="st-pop-model">' + esc(l) + (note || ENGINE_NOTES[v] ? '<small>' + esc(note || ENGINE_NOTES[v]) + '</small>' : '') + '</span></button>').join('');
    }
    else if (which === 'type') {
      // D-203: satu kotak pilihan jenis konten (Foto / Video).
      items = CONTENT_TYPES.map(([v, l, ico]) => '<button type="button" data-v="' + esc(v) + '" class="' + (state.mode === v ? 'on' : '') + '">'
        + icon(ico) + ' ' + esc(l) + '</button>').join('');
    }
    else if (which === 'imgmodel') {
      // D-203: pilih model gambar Kie (Nano Banana / GPT Image / Seedream / FLUX).
      items = imageCatalog.models.map((m) => '<button type="button" data-v="' + esc(m.id) + '" class="' + (state.imageModel === m.id ? 'on' : '') + '">'
        + '<span class="st-pop-model">' + esc(m.label) + '<small>' + esc(m.maker) + ' · ' + esc(m.resolutions.join('/')) + '</small></span></button>').join('');
    }
    else if (which === 'model') {
      // D-200: pilih model video — tiap model punya durasi/resolusi/aspek sendiri.
      items = videoCatalog.models.map((m) => '<button type="button" data-v="' + esc(m.id) + '" class="' + (state.videoModel === m.id ? 'on' : '') + '">'
        + '<span class="st-pop-model">' + esc(m.label) + '<small>' + esc(m.maker) + ' · ' + esc(m.durations[0]) + '-' + esc(m.durations[m.durations.length - 1]) + ' detik</small></span></button>').join('');
    }
    else if (which === 'tier') items = tierOptions().map(([v, l]) => '<button type="button" data-v="' + esc(v) + '" class="' + (state.tier === v ? 'on' : '') + '">' + l + '</button>').join('');
    else if (which === 'res') items = resolutionOptions().map(([v, l]) => '<button type="button" data-v="' + esc(v) + '" class="' + (state.resolution === v ? 'on' : '') + '">' + l + '</button>').join('');
    // D-245: resolusi lipsync (model InfiniteTalk / LTX 2.5 A2V).
    else if (which === 'lipres') {
      const m = lipsyncModel();
      items = (m?.resolutions || ['720p']).map((v) => '<button type="button" data-v="' + esc(v) + '" class="'
        + (state.lipsyncResolution === v ? 'on' : '') + '">' + esc(v) + '</button>').join('');
    }
    el.innerHTML = items;
    el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      if (which === 'aspect') state.aspect = b.dataset.v;
      if (which === 'dur') state.duration = b.dataset.v;
      if (which === 'engine') {
        state.engine = b.dataset.v;
        // D-203: pill model gambar hanya relevan untuk mesin Kie (atau auto/custom).
        const kieEngine = state.engine === 'kie' || state.engine === 'auto' || state.engine.startsWith('custom:');
        $('stImgModelPillWrap')?.classList.toggle('st-hidden', state.mode === 'video' || !kieEngine);
      }
      if (which === 'tier') state.tier = b.dataset.v;
      if (which === 'res') state.resolution = b.dataset.v;
      // D-245: pilih resolusi lipsync.
      if (which === 'lipres') {
        state.lipsyncResolution = b.dataset.v;
        updatePillLabels();
      }
      if (which === 'type') {
        // D-203: pilih jenis konten -> pindah mode (pilihan jenis konten tunggal).
        const next = b.dataset.v;
        if (next !== state.mode) setMode(next);
      }
      if (which === 'imgmodel') {
        // D-203: pilih model gambar -> sesuaikan resolusi ke kapabilitas model.
        state.imageModel = b.dataset.v;
        const im = imageModel();
        if (im) {
          if (!im.resolutions.includes(state.imageResolution)) state.imageResolution = im.defaultResolution || im.resolutions[0];
          if (!im.aspects.includes(state.aspect)) state.aspect = im.defaultAspect || im.aspects[0];
        }
      }
      if (which === 'model') {
        // Model baru -> samakan durasi/resolusi/aspek/tier ke capabilities model itu.
        state.videoModel = b.dataset.v;
        const m = videoModel();
        if (m) applyModelCaps(m, true);
      }
      updatePillLabels();
      el.classList.remove('open'); popOpen = null;
    }));
  }

  // ===== D-221: Panel pengaturan konten (dropdown di HP) =====
  // ===== D-231: draft -> Save (panel TIDAK menutup saat memilih) =====

  // D-231: draft pengaturan. Selama panel terbuka, semua pembacaan setting
  // memakai draft — bukan state aktif. State baru berubah setelah Save.
  let settingsDraft = null;

  /** Konteks setting yang aktif: draft kalau panel terbuka, else state. */
  function settingCtx() {
    return settingsDraft || state;
  }
  /** Salin state -> draft (dipakai saat panel dibuka). */
  function beginSettingsDraft() {
    settingsDraft = {
      mode: state.mode, aspect: state.aspect, duration: state.duration,
      tier: state.tier, resolution: state.resolution, engine: state.engine,
      videoModel: state.videoModel, imageModel: state.imageModel,
      imageResolution: state.imageResolution,
      // D-245: model & resolusi lipsync.
      lipsyncModel: state.lipsyncModel, lipsyncResolution: state.lipsyncResolution,
    };
    return settingsDraft;
  }
  /** Buang draft (Batal / tutup tanpa save). */
  function cancelSettingsDraft() { settingsDraft = null; }
  /** Terapkan draft ke state (tombol Save). */
  function commitSettingsDraft() {
    if (!settingsDraft) return;
    const d = settingsDraft;
    settingsDraft = null;
    // Assignment dulu (semua field dari draft), baru setMode — supaya
    // setMode() membaca model/provider yang sudah benar.
    state.engine = d.engine;
    state.aspect = d.aspect;
    state.imageModel = d.imageModel;
    state.imageResolution = d.imageResolution;
    state.videoModel = d.videoModel;
    state.duration = d.duration;
    state.tier = d.tier;
    state.resolution = d.resolution;
    // D-245: model & resolusi lipsync ikut tersimpan.
    state.lipsyncModel = d.lipsyncModel;
    state.lipsyncResolution = d.lipsyncResolution;
    if (d.mode !== state.mode) setMode(d.mode);
    // Rasio & resolusi mengikuti kapabilitas model terpilih.
    if (state.mode === 'photo') {
      const im = imageCatalog.models.find((m) => m.id === state.imageModel);
      if (im && !im.aspects.includes(state.aspect)) state.aspect = im.defaultAspect || im.aspects[0];
    } else if (state.mode === 'lipsync') {
      // D-245: resolusi & rasio mengikuti model lipsync terpilih.
      const lm = lipsyncCatalog.models.find((m) => m.id === state.lipsyncModel);
      if (lm) {
        if (!lm.resolutions.includes(state.lipsyncResolution)) {
          state.lipsyncResolution = lm.defaultResolution && lm.resolutions.includes(lm.defaultResolution)
            ? lm.defaultResolution : lm.resolutions[0];
        }
        if (!lm.aspects.includes(state.aspect)) {
          state.aspect = lm.defaultAspect && lm.aspects.includes(lm.defaultAspect)
            ? lm.defaultAspect : (lm.aspects.includes('9:16') ? '9:16' : lm.aspects[0]);
        }
      }
    } else {
      const vm = videoCatalog.models.find((m) => m.id === state.videoModel);
      // D-240: JANGAN reset ke default model saat menyimpan draft.
      // `resetToDefault=false` -> nilai yang sudah dipilih user (durasi, tier,
      // resolusi, rasio) DIPERTAHANKAN; hanya nilai yang tidak didukung model
      // terpilih yang diganti ke default. Sebelumnya `true` sehingga durasi
      // 10 detik yang dipilih user diam-diam balik ke default model.
      if (vm) applyModelCaps(vm, false);
    }
    // Pill "Model gambar" (Kie) ikut mengikuti provider terpilih.
    const kieEngine = state.engine === 'kie' || state.engine === 'auto' || state.engine.startsWith('custom:');
    $('stImgModelPillWrap')?.classList.toggle('st-hidden', state.mode === 'video' || state.mode === 'lipsync' || !kieEngine);
    updatePillLabels();
    // D-245: bar karakter menampilkan model/provider lipsync terbaru.
    renderLipsyncBar();
  }

  /** Daftar pilihan untuk satu jenis pengaturan (dipakai panel & popover). */
  function settingChoices(which) {
    const ctx = settingCtx();
    if (which === 'aspect') {
      const list = ctx.mode === 'video' ? aspectOptions(ctx) : ASPECTS;
      return list.map(([v, l]) => ({ v, l }));
    }
    if (which === 'dur') return durationOptions(ctx).map(([v, l]) => ({ v, l }));
    if (which === 'engine') {
      const ENGINE_NOTES = {
        auto: 'Kie → Kustom → Gemini',
        gemini: 'Google Gemini',
        kie: 'Kie AI',
      };
      // D-245: mode Karakter Bicara — Provider hanya Kie AI.
      if (ctx.mode === 'lipsync') {
        return (lipsyncCatalog.providers || [{ id: 'kie', label: 'Kie AI', note: '' }])
          .map((p) => ({ v: p.id, l: p.label, note: p.note || '' }));
      }
      return engines.map(([v, l]) => ({ v, l, note: ENGINE_NOTES[v] || '' }));
    }
    if (which === 'imgmodel') return imageCatalog.models.map((m) => ({ v: m.id, l: m.label, note: m.maker }));
    if (which === 'model') return videoCatalog.models.map((m) => ({ v: m.id, l: m.label, note: m.maker }));
    // D-245: model & resolusi lipsync.
    if (which === 'lipmodel') {
      return lipsyncCatalog.models.map((m) => ({ v: m.id, l: m.label, note: m.maker }));
    }
    if (which === 'lipres') {
      const m = lipsyncModel();
      return (m?.resolutions || ['720p']).map((r) => ({ v: r, l: r }));
    }
    if (which === 'tier') return tierOptions(ctx).map(([v, l]) => ({ v, l }));
    if (which === 'res') return resolutionOptions(ctx).map(([v, l]) => ({ v, l }));
    return [];
  }
  /** Nilai terpilih untuk satu jenis pengaturan. */
  function settingValue(which) {
    const ctx = settingCtx();
    if (which === 'aspect') return ctx.aspect;
    if (which === 'dur') return ctx.duration;
    if (which === 'engine') return ctx.engine;
    if (which === 'imgmodel') return ctx.imageModel;
    if (which === 'model') return ctx.videoModel;
    // D-245: model & resolusi lipsync.
    if (which === 'lipmodel') return ctx.lipsyncModel;
    if (which === 'lipres') return ctx.lipsyncResolution;
    if (which === 'tier') return ctx.tier;
    if (which === 'res') return ctx.resolution;
    return '';
  }
  /** Pengaturan mana yang relevan untuk mode konten saat ini. */
  function activeSettings() {
    const ctx = settingCtx();
    const isVideo = ctx.mode === 'video';
    const isLip = ctx.mode === 'lipsync';
    const kieEngine = ctx.engine === 'kie' || ctx.engine === 'auto' || ctx.engine.startsWith('custom:');
    const list = [
      { key: 'aspect', label: 'Rasio', icon: 'smartphone' },
      { key: 'engine', label: 'Provider', icon: 'cpu' },
    ];
    if (isVideo) {
      list.push({ key: 'model', label: 'Model', icon: 'video' });
      list.push({ key: 'dur', label: 'Durasi', icon: 'clock' });
      list.push({ key: 'tier', label: 'Tier', icon: 'sliders' });
      list.push({ key: 'res', label: 'Resolusi', icon: 'sparkles' });
    } else if (isLip) {
      // D-245: mode Karakter Bicara — provider, model, dan resolusi.
      list.push({ key: 'lipmodel', label: 'Model', icon: 'mic' });
      list.push({ key: 'lipres', label: 'Resolusi', icon: 'sparkles' });
    } else if (kieEngine) {
      list.push({ key: 'imgmodel', label: 'Model', icon: 'sparkles' });
    }
    return list;
  }
  /**
   * Terapkan pilihan pengaturan.
   * D-231: kalau panel sedang buka -> tulis ke DRAFT (state belum berubah,
   * panel tetap terbuka). Kalau tidak -> langsung ke state (popover biasa).
   */
  function applySetting(which, v) {
    const target = settingsDraft || state;
    const draftMode = !!settingsDraft;
    if (which === 'aspect') target.aspect = v;
    if (which === 'dur') target.duration = v;
    if (which === 'engine') {
      target.engine = v;
      // D-245: mode Karakter Bicara -> provider selalu Kie AI.
      if (settingCtx().mode === 'lipsync') target.engine = 'kie';
      if (!draftMode) {
        const kieEngine = state.engine === 'kie' || state.engine === 'auto' || state.engine.startsWith('custom:');
        $('stImgModelPillWrap')?.classList.toggle('st-hidden', state.mode === 'video' || state.mode === 'lipsync' || !kieEngine);
      }
    }
    if (which === 'tier') target.tier = v;
    if (which === 'res') target.resolution = v;
    if (which === 'imgmodel') {
      target.imageModel = v;
      const im = imageCatalog.models.find((m) => m.id === v);
      if (im) {
        if (!im.resolutions.includes(target.imageResolution)) target.imageResolution = im.defaultResolution || im.resolutions[0];
        if (!im.aspects.includes(target.aspect)) target.aspect = im.defaultAspect || im.aspects[0];
      }
    }
    if (which === 'model') {
      target.videoModel = v;
      const m = videoCatalog.models.find((x) => x.id === v);
      // D-240: kapabilitas model ikut draft — TAPI nilai yang masih didukung
      // model baru (durasi/tier/resolusi/rasio) TIDAK dipaksa balik ke default.
      // Hanya nilai yang tidak lagi valid yang diganti ke default model.
      if (m) {
        const tierIds = (m.tiers || []).map((t) => t.id);
        if (!tierIds.includes(target.tier)) target.tier = m.defaultTier;
        const dur = Number(target.duration);
        if (!m.durations.includes(dur)) {
          target.duration = String(m.defaultDuration && m.durations.includes(Number(m.defaultDuration))
            ? m.defaultDuration : m.durations[m.durations.length - 1]);
        }
        if (!m.resolutions.includes(target.resolution)) {
          target.resolution = m.defaultResolution && m.resolutions.includes(m.defaultResolution)
            ? m.defaultResolution : m.resolutions[0];
        }
        if (!m.aspects.includes(target.aspect)) {
          target.aspect = m.defaultAspect && m.aspects.includes(m.defaultAspect)
            ? m.defaultAspect : (m.aspects.includes('9:16') ? '9:16' : m.aspects[0]);
        }
      }
    }
    // D-245: model lipsync -> resolusi & rasio menyesuaikan kapabilitas model.
    if (which === 'lipmodel') {
      const prev = lipsyncCatalog.models.find((x) => x.id === target.lipsyncModel);
      target.lipsyncModel = v;
      const m = lipsyncCatalog.models.find((x) => x.id === v);
      if (m) {
        // Kalau resolusi sekarang masih sama dengan default model SEBELUM,
        // ikut pindah ke default model baru (mis. InfiniteTalk 720p -> LTX 1080p).
        // Kalau user sudah memilih sendiri, nilainya DIPERTAHANKAN (D-240).
        const wasDefault = prev && target.lipsyncResolution === prev.defaultResolution;
        if (wasDefault && m.defaultResolution && m.resolutions.includes(m.defaultResolution)) {
          target.lipsyncResolution = m.defaultResolution;
        } else if (!m.resolutions.includes(target.lipsyncResolution)) {
          target.lipsyncResolution = m.defaultResolution && m.resolutions.includes(m.defaultResolution)
            ? m.defaultResolution : m.resolutions[0];
        }
        if (!m.aspects.includes(target.aspect)) {
          target.aspect = m.defaultAspect && m.aspects.includes(m.defaultAspect)
            ? m.defaultAspect : (m.aspects.includes('9:16') ? '9:16' : m.aspects[0]);
        }
      }
    }
    if (which === 'lipres') target.lipsyncResolution = v;
    if (!draftMode) updatePillLabels();
  }
  /**
   * D-232: ikon per pilihan di panel Pengaturan Konten — biar tiap chip
   * punya identitas visual, tidak sekadar daftar teks.
   * Peta per nilai + ikon cadangan per kategori (dipakai kalau nilai baru
   * dari server belum ada di peta).
   */
  const SET_CHIP_ICONS = {
    aspect: { '16:9': 'monitor', '9:16': 'smartphone', '1:1': 'square', '4:5': 'smartphone', '4:3': 'monitor', '3:4': 'smartphone', '3:2': 'monitor', '2:3': 'smartphone', '5:4': 'monitor', '21:9': 'monitor', '2:11': 'monitor', '1:2': 'smartphone', 'auto': 'sparkles', 'adaptive': 'sparkles' },
    engine: { auto: 'sparkles', kie: 'cpu', gemini: 'sparkles' },
    dur: {},
    tier: {},
    res: {},
  };
  // Ikon cadangan per kategori.
  const SET_CHIP_FALLBACK_ICON = {
    aspect: 'square', engine: 'cpu', dur: 'clock', tier: 'gauge', res: 'sliders',
    model: 'video', imgmodel: 'sparkles',
  };
  /** Ikon untuk satu pilihan pengaturan (null kalau tak ada). */
  function setChipIcon(key, v) {
    const map = SET_CHIP_ICONS[key];
    if (map && map[String(v)]) return map[String(v)];
    return SET_CHIP_FALLBACK_ICON[key] || '';
  }

  /**
   * D-221: bangun panel pengaturan konten (dipakai di HP).
   * Panel berisi baris: nama pengaturan -> daftar pilihan (inline chip).
   * D-231: panel TIDAK menutup saat memilih. Semua pilihan ditulis ke draft;
   * hanya tombol "Simpan" yang menerapkan draft ke state lalu menutup panel.
   */
  function buildSettingsPanel() {
    const el = $('stPop-settings'); if (!el) return;
    // D-231: kalau panel dibangun tanpa draft (mis. dipanggil langsung),
    // mulai draft dari state saat ini.
    if (!settingsDraft) beginSettingsDraft();
    const ctx = settingCtx();
    // D-221: panel juga memuat pilihan jenis konten (Foto / Video) supaya
    // di HP semua pengaturan konten ada di satu panel.
    const typeChips = CONTENT_TYPES.map(([v, l, ico]) => {
      const on = ctx.mode === v;
      return '<button type="button" class="st-set-chip' + (on ? ' on' : '') + '" data-set-key="type" data-set-v="' + esc(v) + '">'
        + icon(ico) + '<span>' + esc(l) + '</span></button>';
    }).join('');
    const groups = activeSettings().map((g) => {
      const cur = settingValue(g.key);
      const opts = settingChoices(g.key);
      const chips = opts.map((o) => {
        const on = String(o.v) === String(cur);
        // D-232: tiap pilihan punya ikon sendiri -> tampilannya lebih "pro",
        // bukan sekadar daftar teks.
        // D-233: teks utama + keterangan (maker) jadi dua baris di dalam chip.
        const ico = setChipIcon(g.key, o.v);
        return '<button type="button" class="st-set-chip' + (on ? ' on' : '') + '" data-set-key="' + esc(g.key) + '" data-set-v="' + esc(o.v) + '">'
          + (ico ? icon(ico) : '')
          + '<span><span>' + esc(o.l) + '</span>' + (o.note ? '<small>' + esc(o.note) + '</small>' : '') + '</span></button>';
      }).join('');
      return '<div class="st-set-row"><div class="st-set-label">' + icon(g.icon) + '<b>' + esc(g.label) + '</b></div>'
        + '<div class="st-set-chips">' + chips + '</div></div>';
    }).join('');
    el.innerHTML = '<div class="st-set-head">'
      + '<span class="st-set-head-ico">' + icon('sliders') + '</span>'
      + '<div class="st-set-head-txt"><b>Pengaturan Konten</b>'
      + '<small>Atur semua dulu, lalu tekan Simpan</small></div>'
      // D-236: tombol X header dihapus — sudah ada tombol "Batal" di footer.
      // Judul + deskripsi jadi punya ruang penuh tanpa terpotong.
      + '</div>'
      + '<div class="st-set-body">'
      + '<div class="st-set-row"><div class="st-set-label">' + icon('image-plus') + '<b>Jenis Konten</b></div>'
      + '<div class="st-set-chips">' + typeChips + '</div></div>'
      + groups
      + '</div>'
      // D-231: footer Save -> terapkan draft + tutup panel.
      + '<div class="st-set-foot">'
      + '<button type="button" class="st-set-cancel" id="stSetCancel">Batal</button>'
      + '<button type="button" class="st-set-save" id="stSetSave">' + icon('check') + 'Simpan</button>'
      + '</div>';
    el.querySelectorAll('[data-set-key]').forEach((b) => b.addEventListener('click', () => {
      const key = b.dataset.setKey;
      if (key === 'type') {
        const next = b.dataset.setV;
        // D-231: ganti jenis konten di draft (state belum berubah).
        if (next !== settingCtx().mode) {
          settingsDraft.mode = next;
          settingsDraft.contentType = next;
          // Rasio & durasi mengikuti mode baru (dari state mode lama).
          if (next === 'video') {
            const aspects = videoModelOf(settingsDraft)?.aspects || ['16:9', '9:16'];
            if (!aspects.includes(settingsDraft.aspect)) settingsDraft.aspect = aspects.includes('9:16') ? '9:16' : aspects[0];
          } else if (!ASPECTS.some((v) => v[0] === settingsDraft.aspect)) settingsDraft.aspect = '4:5';
        }
        buildSettingsPanel();
        return;
      }
      // D-231: tulis ke draft, panel TETAP terbuka.
      applySetting(key, b.dataset.setV);
      buildSettingsPanel();
      // D-245: label pill ikut diperbarui saat draft berubah (mis. resolusi
      // lipsync ikut model lipsync terpilih).
      updatePillLabels();
    }));
    $('stSetSave')?.addEventListener('click', () => {
      commitSettingsDraft();
      el.classList.remove('open');
      popOpen = null;
      syncBackdrop();
    });
    $('stSetCancel')?.addEventListener('click', () => {
      cancelSettingsDraft();
      el.classList.remove('open');
      popOpen = null;
      syncBackdrop();
    });
    // D-236: tombol X header dihapus (tombol "Batal" di footer sudah cukup).
  }
  /** D-221: buka panel pengaturan (HP). */
  function openSettingsPanel() {
    // D-240: kalau panel sudah terbuka, JANGAN buat draft baru — pilihan
    // sementara user (mis. durasi 10 detik) harus tetap ada saat panel
    // dibuka ulang / di-render ulang.
    if (!settingsDraft) beginSettingsDraft();
    buildSettingsPanel();
    const el = $('stPop-settings');
    if (!el) return;
    ['aspect', 'style', 'dur', 'engine', 'model', 'tier', 'res', 'lipres', 'type', 'imgmodel', 'prompt', 'actions', 'lipsyncchar']
      .forEach((k) => $('stPop-' + k)?.classList.remove('open'));
    el.classList.add('open');
    el.classList.add('st-pop-center');
    popOpen = 'settings';
    syncBackdrop();
  }

  // ===== D-207: Bank Prompt (template utuh + blok modular) =====

  // Urutan kategori saat blok dirakit menjadi satu prompt.
  // Mengikuti urutan fokal hasil riset: kamera (sudut pandang) -> cahaya (realisme)
  // -> gaya -> tekstur -> color -> kualitas -> negative (penjaga, selalu akhir).
  const PROMPT_CATEGORY_ORDER = ['kamera', 'cahaya', 'gaya', 'tekstur', 'color', 'kualitas', 'negative', 'umum'];
  const PROMPT_CATEGORY_LABEL = {
    kamera: 'Kamera & Angle', cahaya: 'Cahaya & Mood', gaya: 'Gaya Visual',
    tekstur: 'Tekstur & Detail', color: 'Color & Tone', kualitas: 'Kualitas & Realisme',
    negative: 'Negative Prompt', umum: 'Umum',
  };

  /** Ambil entri bank prompt dari server (sekali saja per mode, disimpan di cache). */
  async function loadPromptBank(force) {
    if (promptBankLoaded && !force) return promptBank;
    try {
      // D-208: hanya prompt untuk jenis konten aktif (foto <-> video).
      const r = await fetch('/api/prompt-bank?mode=' + encodeURIComponent(promptBankMode), { headers: await authHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal memuat bank prompt.');
      promptBank = Array.isArray(d.entries) ? d.entries : [];
      promptBankLoaded = true;
    } catch (e) {
      promptBankLoaded = false;
      window.toast?.('Bank prompt gagal dimuat: ' + (e.message || 'cek koneksi.'));
    }
    return promptBank;
  }

  /** Entri bank prompt yang aktif saja (is_active tidak false). */
  function activeBankEntries(kind) {
    return promptBank.filter((e) => e.kind === kind && e.is_active !== false);
  }

  /** Isi placeholder { ... } pada template. */
  function fillSlots(content, values) {
    const missing = [];
    const text = String(content || '').replace(/\{([a-z0-9_ -]{1,40})\}/gi, (_m, key) => {
      const k = key.trim().toLowerCase();
      const v = String((values || {})[k] ?? '').trim();
      if (!v) { missing.push(k); return '[' + k + ']'; }
      return v;
    });
    return { text, missing };
  }

  /**
   * Terapkan sebuah template ke komposer.
   * Kalau template punya placeholder, buka dialog kecil agar user mengisinya.
   */
  function applyTemplate(entry) {
    const ta = $('stPrompt'); if (!ta) return;
    const slots = Array.isArray(entry.slots) ? entry.slots : [];
    if (!slots.length) {
      // Template utuh: isi komposer (append kalau sudah ada isi).
      const cur = ta.value.trim();
      ta.value = cur ? cur + '\n\n' + entry.content : entry.content;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      window.toast?.('Template "' + entry.label + '" ditambahkan ke prompt.');
      return;
    }
    // Template ber-placeholder: minta isian dulu.
    const names = slots.join(', ');
    const answer = window.prompt('Isi bagian untuk "' + entry.label + '" (' + names + '):');
    if (answer === null) return;
    const values = {};
    // Jawaban tunggal -> isi slot pertama; multi baris -> satu per slot.
    const lines = answer.split('\n');
    slots.forEach((s, i) => { values[s] = (lines[i] ?? lines[0] ?? '').trim(); });
    const filled = fillSlots(entry.content, values);
    const cur = ta.value.trim();
    ta.value = cur ? cur + '\n\n' + filled.text : filled.text;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    window.toast?.(filled.missing.length
      ? 'Template "' + entry.label + '" ditambahkan — belum diisi: ' + filled.missing.join(', ')
      : 'Template "' + entry.label + '" ditambahkan ke prompt.');
  }

  /** Tambah/hapus sebuah blok dari prompt yang dirakit. */
  function toggleBlock(entry) {
    const idx = selectedBlocks.findIndex((b) => b.id === entry.id);
    if (idx > -1) selectedBlocks.splice(idx, 1);
    else selectedBlocks.push(entry);
    updatePillLabels();
    // Bangun ulang isi popover (bukan buildPop generik) supaya tab & daftar blok tetap ada.
    buildPromptPop();
  }

  /**
   * Susun prompt akhir: isi komposer + blok terpilih (urutan kategori),
   * lalu gaya visual + rasio aspek seperti sebelumnya.
   */
  function composedPrompt(raw) {
    let p = String(raw || '').trim();
    const byCat = new Map();
    for (const b of selectedBlocks) {
      const cat = PROMPT_CATEGORY_ORDER.includes(b.category) ? b.category : 'umum';
      const text = String(b.content || '').trim();
      if (!text) continue;
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat).push(text);
    }
    const parts = [];
    if (p) parts.push(p);
    for (const cat of PROMPT_CATEGORY_ORDER) {
      const list = byCat.get(cat);
      if (list && list.length) parts.push(list.join(' '));
    }
    let out = parts.join('\n\n');
    // D-208: suffix gaya dihapus — gaya kini jadi template transparan di Bank Prompt.
    out += '\n(Komposisi gambar dengan rasio aspek ' + state.aspect + '.)';
    return out;
  }

  // ===== D-208: aksi prompt — optimasi susunan & copy semua isi prompt =====

  /**
   * Optimasi susunan prompt.
   * Mengelompokkan prompt bebas per kategori (kamera/cahaya/teksur/color/
   * kualitas/negative) lalu menyusun ulang sesuai alur fokus hasil riset,
   * supaya hasil generate maksimal. Anti-duplikat: frasa sama tidak diulang.
   */
  async function optimizeComposedPrompt() {
    const ta = $('stPrompt');
    const raw = (ta?.value || '').trim();
    if (!raw && !selectedBlocks.length) {
      window.toast?.('Isi prompt dulu sebelum dioptimasi.');
      ta?.focus();
      return;
    }
    const btn = $('stOptimizeBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = icon('refresh-cw') + ' Mengatur…'; }
    try {
      const r = await fetch('/api/prompt-bank/optimize', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          prompt: raw,
          blocks: selectedBlocks.map((b) => ({ category: b.category, content: b.content })),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal mengoptimasi prompt.');
      if (ta && d.prompt) {
        ta.value = d.prompt;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }
      // Blok yang sudah dipilih tetap aktif (isi-nya sudah ikut dirakit).
      window.toast?.('Prompt sudah dioptimasi & diurutkan.');
    } catch (e) {
      window.toast?.(e.message || 'Gagal mengoptimasi prompt.');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = icon('sparkles') + ' Optimasi'; }
    }
  }

  /**
   * D-212: Reset — bersihkan komposer dari prompt.
   * Mengosongkan isi textarea, melepas blok prompt yang dipilih, dan
   * menutup daftar '@mention'. Rantai adegan & aset TIDAK ikut terhapus
   * (itu bukan bagian dari prompt).
   */
  function resetPromptComposer() {
    const ta = $('stPrompt');
    const hadText = !!(ta?.value || '').trim();
    const hadBlocks = selectedBlocks.length > 0;
    if (ta) ta.value = '';
    selectedBlocks = [];
    closeMention();
    // Tutup jendela pilih prompt kalau sedang terbuka.
    const pop = $('stPop-prompt');
    if (pop) pop.classList.remove('open', 'st-pop-center');
    popOpen = null;
    syncBackdrop(null);
    updatePillLabels();
    try {
      if (hadText || hadBlocks) {
        window.toast?.('Komposer dibersihkan dari prompt.');
      } else {
        window.toast?.('Komposer sudah kosong.');
      }
    } catch (e) { /* toast tidak tersedia — abaikan */ }
  }

  /**
   * Salin SEMUA isi prompt (isi komposer + blok terpilih + keterangan rasio)
   * ke clipboard — untuk generate di luar aplikasi.
   */
  async function copyComposedPrompt() {
    const ta = $('stPrompt');
    const raw = (ta?.value || '').trim();
    if (!raw && !selectedBlocks.length) {
      window.toast?.('Belum ada prompt untuk disalin.');
      return;
    }
    const text = composedPrompt(raw);
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback untuk browser tanpa Clipboard API.
        const ta2 = document.createElement('textarea');
        ta2.value = text;
        ta2.setAttribute('readonly', '');
        ta2.style.position = 'fixed';
        ta2.style.opacity = '0';
        document.body.appendChild(ta2);
        ta2.select();
        document.execCommand?.('copy');
        ta2.remove();
      }
      window.toast?.('Prompt disalin — siap dipakai di luar aplikasi.');
    } catch (e) {
      window.toast?.('Gagal menyalin prompt.');
    }
  }

  /** Label ringkas untuk pill Bank Prompt. */
  function promptBankLabel() {
    if (selectedBlocks.length) return selectedBlocks.length + ' blok';
    return 'Prompt';
  }

  /** Isi konten popover Bank Prompt (2 tab: Template | Blok). */
  function buildPromptPop() {
    const el = $('stPop-prompt'); if (!el) return;
    const templates = activeBankEntries('template');
    const blocks = activeBankEntries('block');
    const tabs = '<div class="st-pb-tabs">'
      + '<button type="button" class="st-pb-tab' + (promptBankTab === 'template' ? ' on' : '') + '" data-pb-tab="template">Template</button>'
      + '<button type="button" class="st-pb-tab' + (promptBankTab === 'block' ? ' on' : '') + '" data-pb-tab="block">Blok</button>'
      + '</div>';
    // D-237: kotak pencarian DI BAWAH tag Template/Blok — biar prompt mudah
    // dicari saat bank prompt sudah banyak.
    const search = '<div class="st-pb-search">'
      + '<span class="st-pb-search-ico">' + icon('search') + '</span>'
      // D-238: pakai type="text" (bukan "search") — type=search brings native
      // cancel button & "fieldtext" default color yang bikin teks tak terlihat
      // di beberapa browser/WebView.
      + '<input type="text" id="stPbSearch" placeholder="Cari prompt…" value="' + esc(promptBankQuery) + '"'
      + ' autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"'
      + ' aria-label="Cari prompt">'
      + '<button type="button" class="st-pb-search-clear' + (promptBankQuery ? '' : ' st-hidden') + '" id="stPbSearchClear" aria-label="Hapus pencarian">' + icon('x') + '</button>'
      + '</div>';
    // D-237: seluruh entri dirender; penyaringan dilakukan lewat
    // applyPromptBankFilter (toggle visibility) supaya input search tidak
    // pernah di-re-render -> fokus & caret tetap aman saat mengetik.

    let body = '';
    if (promptBankTab === 'template') {
      // D-208: template dikelompokkan per "group" (gaya, kode foto-ke-video, kode produk).
      const groups = [
        { key: 'style', label: 'Gaya & Style' },
        { key: 'umum', label: 'Template Umum' },
        { key: 'fotovideo', label: 'Kode Foto ke Video' },
        { key: 'produk', label: 'Kode Video Produk' },
        // D-210: 200 cheat code Google Flow (produk foto -> video), dikelompokkan per kategori.
        { key: 'flow', label: 'Cheat Codes Google Flow', byCategory: true },
      ];
      const usedGroups = groups.filter((g) => templates.some((t) => (t.group || 'umum') === g.key));
      const renderTpl = (t) => {
        const slots = Array.isArray(t.slots) ? t.slots : [];
        return '<button type="button" class="st-pb-item" data-pb-template="' + esc(t.id) + '"'
          + ' data-pb-search="' + esc([t.label, t.content, t.group, t.category].join(' ')) + '">'
          + '<span class="st-pop-model">' + esc(t.label)
          + (slots.length ? '<small>isi: ' + esc(slots.join(', ')) + '</small>' : '<small>' + esc(t.content.slice(0, 70)) + (t.content.length > 70 ? '…' : '') + '</small>')
          + '</span></button>';
      };
      body = usedGroups.map((g) => {
        const list = templates.filter((t) => (t.group || 'umum') === g.key);
        if (!list.length) return '';
        // D-210: group 'flow' punya sub-kategori (20 kategori x 10 kode).
        if (g.byCategory) {
          const cats = [];
          list.forEach((t) => {
            const c = t.category || 'umum';
            if (!cats.some((x) => x.key === c)) cats.push({ key: c, items: [] });
            cats.find((x) => x.key === c).items.push(t);
          });
          return '<div class="st-pb-group"><b>' + esc(g.label) + '</b>'
            + cats.map((c) => '<div class="st-pb-sub"><em>' + esc(c.key) + '</em>'
              + c.items.map(renderTpl).join('') + '</div>').join('')
            + '</div>';
        }
        return '<div class="st-pb-group"><b>' + esc(g.label) + '</b>' + list.map(renderTpl).join('') + '</div>';
      }).join('');
      // Pesan kosong selalu ada di DOM; filter yang menentukan tampil/pesan.
      body += '<p class="st-pb-empty st-hidden">Belum ada template. Tambah di Pengaturan &rarr; Bank Prompt.</p>';
    } else {
      // Blok dikelompokkan per kategori, sesuai urutan susun prompt.
      body = PROMPT_CATEGORY_ORDER.map((cat) => {
        const list = blocks.filter((b) => (b.category || 'umum') === cat);
        if (!list.length) return '';
        return '<div class="st-pb-group"><b>' + esc(PROMPT_CATEGORY_LABEL[cat] || cat) + '</b>'
          + list.map((b) => {
            const on = selectedBlocks.some((s) => s.id === b.id);
            return '<button type="button" class="st-pb-item' + (on ? ' on' : '') + '" data-pb-block="' + esc(b.id) + '"'
              + ' data-pb-search="' + esc([b.label, b.content, b.category].join(' ')) + '">'
              + '<span class="st-pop-model">' + esc(b.label) + '<small>' + esc(b.content.slice(0, 70)) + (b.content.length > 70 ? '…' : '') + '</small></span></button>';
          }).join('') + '</div>';
      }).join('');
      // Pesan kosong selalu ada di DOM; filter yang menentukan tampil/pesan.
      body += '<p class="st-pb-empty st-hidden">Belum ada blok. Tambah di Pengaturan &rarr; Bank Prompt.</p>';
    }

    el.innerHTML = tabs + search + '<div class="st-pb-body">' + body + '</div>';

    el.querySelectorAll('[data-pb-tab]').forEach((t) => t.addEventListener('click', (e) => {
      e.stopPropagation();
      promptBankTab = t.dataset.pbTab;
      buildPromptPop();
    }));
    el.querySelectorAll('[data-pb-template]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const entry = templates.find((t) => t.id === b.dataset.pbTemplate);
      if (entry) applyTemplate(entry);
      el.classList.remove('open'); popOpen = null;
    }));
    el.querySelectorAll('[data-pb-block]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const entry = blocks.find((t) => t.id === b.dataset.pbBlock);
      if (entry) toggleBlock(entry);
    }));
    // D-237: pencarian bank prompt. Filter menyaring TAMPILAN item (bukan
    // re-render) supaya fokus + caret input tidak terputus saat mengetik.
    const searchInput = $('stPbSearch');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        promptBankQuery = searchInput.value;
        applyPromptBankFilter(el);
        const clear = $('stPbSearchClear');
        if (clear) clear.classList.toggle('st-hidden', !promptBankQuery);
      });
      // Enter / Escape.
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          promptBankQuery = '';
          buildPromptPop();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          const first = el.querySelector('.st-pb-item');
          if (first) first.click();
        }
      });
    }
    $('stPbSearchClear')?.addEventListener('click', (e) => {
      e.stopPropagation();
      promptBankQuery = '';
      buildPromptPop();
      $('stPbSearch')?.focus();
    });
    // Query yang sudah ada (mis. reopen popover) langsung diterapkan.
    applyPromptBankFilter(el);
  }

  /**
   * D-237: terapkan filter pencarian bank prompt pada item yang sudah dirender.
   * Item/group yang tidak cocok disembunyikan (bukan dihapus) -> input tetap
   * fokus & caret tidak terputus.
   */
  function applyPromptBankFilter(root) {
    const el = root || $('stPop-prompt');
    if (!el) return;
    const q = promptBankQuery.trim().toLowerCase();
    const emptyBox = el.querySelector('.st-pb-empty');
    let visible = 0;
    el.querySelectorAll('.st-pb-item').forEach((it) => {
      const hay = (it.dataset.pbSearch || it.textContent || '').toLowerCase();
      const ok = !q || hay.includes(q);
      it.classList.toggle('st-hidden', !ok);
      if (ok) visible++;
    });
    // Group & sub-kategori kosong disembunyikan.
    el.querySelectorAll('.st-pb-group, .st-pb-sub').forEach((g) => {
      const any = [...g.querySelectorAll('.st-pb-item')].some((it) => !it.classList.contains('st-hidden'));
      g.classList.toggle('st-hidden', !any);
    });
    // Pesan: "tidak ada yang cocok" (kalau ada kata kunci) atau "bank kosong".
    const total = el.querySelectorAll('.st-pb-item').length;
    const kind = promptBankTab === 'template' ? 'template' : 'blok';
    if (emptyBox) {
      const isNone = !!q && visible === 0;
      emptyBox.classList.remove('st-hidden');
      if (isNone) {
        emptyBox.textContent = 'Tidak ada ' + kind + ' yang cocok dengan "' + promptBankQuery + '".';
      } else {
        emptyBox.textContent = total === 0
          ? (kind === 'template'
            ? 'Belum ada template. Tambah di Pengaturan → Bank Prompt.'
            : 'Belum ada blok. Tambah di Pengaturan → Bank Prompt.')
          : '';
        if (total > 0) emptyBox.classList.add('st-hidden');
      }
    }
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
      // D-203: kirim model gambar terpilih + resolusi ke server.
      const reqBody = { prompt, provider: state.engine, aspect: state.aspect, model: state.imageModel, resolution: state.imageResolution };
      if (mentioned.length) reqBody.characterMentions = mentioned.map((c) => ({ id: c.id, name: c.name }));
      if (sceneRef) reqBody.sceneRef = { mime: sceneRef.mime, data: sceneRef.data };
      const sceneNumber = chain.length ? chain.length + 1 : 0;
      if (sceneNumber) { reqBody.sceneNumber = sceneNumber; reqBody.sceneTotal = sceneNumber; }
      const r = await fetch('/api/ai/image', { method: 'POST', headers: await authHeaders(), body: JSON.stringify(reqBody) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Generator gambar gagal.');
      // D-198: hasil foto langsung disimpan sebagai aset & tampil di galeri.
      const meta = {
        aspect: state.aspect,
        // D-208: gaya tidak lagi jadi pilihan terpisah — sudah menyatu di prompt template.
        promptBankMode,
        characters: mentioned.map((c) => c.name), scene: sceneNumber || 0,
        // D-203: catat model gambar yang dipakai.
        model: d.model || state.imageModel, modelLabel: d.model_label || null,
        resolution: d.resolution || state.imageResolution,
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
      btn.disabled = false; btn.innerHTML = icon('image-plus') + ' Buat';
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
        prompt: raw, model: state.videoModel, tier: state.tier, aspect: state.aspect,
        duration: Number(state.duration), resolution: state.resolution, audio: state.audio,
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
      btn.disabled = false; btn.innerHTML = icon('film') + ' Buat';
    }
  }

  // ===== D-242: mode "Karakter Bicara" (lipsync) =====
  // Alur: pilih karakter -> tulis naskah -> server (TTS + upload Kie) ->
  // task InfiniteTalk -> polling -> video tersimpan di galeri aset.
  function lipsyncCharacters() {
    return (characters || []).filter((c) => c && (c.reference_image_path || c.referenceImagePath));
  }
  function lipsyncCharacterById(id) {
    return lipsyncCharacters().find((c) => c.id === id) || null;
  }
  // D-244: karakter punya potret (dipakai sebagai gambar cadangan).
  function lipsyncCharacterHasPortrait() {
    const c = lipsyncCharacterById(state.lipsyncCharacterId);
    return !!(c && (c.reference_image_path || c.referenceImagePath));
  }
  // D-243: durasi lipsync TIDAK bisa diset di awal — dia mengikuti panjang naskah
  // (TTS membacakan naskah, InfiniteTalk maksimal 15 detik audio).
  // Estimasi kasar: ~13 karakter/detik untuk bahasa Indonesia (naskah 15 detik
  // ≈ 195 karakter). Server juga membatasi naskah maksimal 1.500 karakter.
  function estimateLipsyncSeconds(script) {
    const chars = String(script || '').trim().length;
    if (!chars) return 0;
    return Math.max(1, Math.ceil(chars / 13));
  }
  function renderLipsyncBar() {
    const bar = $('stLipsyncBar'); if (!bar) return;
    const isLip = state.mode === 'lipsync';
    bar.classList.toggle('st-hidden', !isLip);
    if (!isLip) return;
    const ch = lipsyncCharacterById(state.lipsyncCharacterId);
    const nameEl = $('stLipsyncCharName');
    if (nameEl) nameEl.textContent = ch ? ch.name : 'Pilih karakter';
    const meta = $('stLipsyncMeta');
    if (meta) {
      const model = lipsyncModel();
      const max = model?.maxSeconds || lipsyncCatalog.maxSeconds || 15;
      const est = estimateLipsyncSeconds(($('stPrompt') || {}).value);
      // D-244: sumber gambar utama = mention gambar (karakter di lokasi
      // tertentu) atau potret karakter sebagai cadangan.
      const src = sceneRefs.length ? 'gambar mention' : (lipsyncCharacterHasPortrait() ? 'potret karakter' : 'belum ada gambar');
      // D-245: info provider + model ikut ditampilkan (ringkas, 2 baris).
      const prov = (lipsyncCatalog.providers || []).find((p) => p.id === 'kie');
      const provLabel = prov ? prov.label : 'Kie AI';
      const modelLabel = model ? model.label : '';
      // Durasi lipsync mengikuti naskah, bukan diset di awal.
      // Baris 1: durasi (otomatis dari naskah). Baris 2: provider + model + sumber gambar.
      meta.textContent = (est ? '±' + est + ' dtk (maks ' + max + ')' : 'maks ' + max + ' dtk')
        + '\n' + provLabel + ' · ' + modelLabel.replace(' Fast A2V', '') + ' · ' + src;
      meta.classList.toggle('st-lipsync-meta-warn', est > max);
    }
  }
  function buildLipsyncCharPop() {
    const pop = $('stPop-lipsyncchar'); if (!pop) return;
    const list = lipsyncCharacters();
    if (!list.length) {
      pop.innerHTML = '<div class="st-pop-empty">Belum ada karakter dengan potret. Buat karakter dulu di menu Karakter.</div>';
      return;
    }
    pop.innerHTML = list.map((c) => '<button type="button" data-lip-char="' + esc(c.id) + '" class="'
      + (state.lipsyncCharacterId === c.id ? 'on' : '') + '">'
      + icon('user') + ' ' + esc(c.name) + '</button>').join('');
    pop.querySelectorAll('[data-lip-char]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      state.lipsyncCharacterId = b.dataset.lipChar;
      renderLipsyncBar();
      buildLipsyncCharPop();
      pop.classList.remove('open');
      popOpen = null;
      syncBackdrop();
    }));
  }
  async function generateLipsync() {
    const ta = $('stPrompt'); const script = (ta?.value || '').trim();
    if (!state.lipsyncCharacterId) {
      window.toast?.('Pilih karakter yang mau bicara dulu ya.');
      $('stLipsyncCharBtn')?.focus();
      return;
    }
    if (script.length < 3) {
      window.toast?.('Tulis naskah yang mau dibacakan karakter.');
      ta?.focus();
      return;
    }
    // D-244: wajib ada gambar referensi (gambar karakter di lokasi tertentu).
    // Kalau karakter punya potret, potret itu dipakai sebagai cadangan.
    if (!sceneRefs.length && !lipsyncCharacterHasPortrait()) {
      window.toast?.('Mention gambar karakter (lokasi tertentu) dulu ya, atau upload potret karakter.');
      ta?.focus();
      return;
    }
    const btn = $('stLipsyncBtn');
    btn.disabled = true; btn.innerHTML = icon('refresh-cw') + ' Menyiapkan…';
    try {
      const model = lipsyncModel();
      // D-244: arahan adegan (lokasi/kamera/aksi) -> prompt Kie.
      const sceneHint = ($('stSceneHint')?.value || '').trim();
      // D-244: gambar @mention = karakter di lokasi tertentu -> image_url.
      // Kalau tidak ada mention -> backend pakai potret karakter.
      const refImg = sceneRefs.find((r) => r && r.mime && r.data) || null;
      const body = {
        characterId: state.lipsyncCharacterId,
        script,
        prompt: sceneHint,
        model: model?.id || state.lipsyncModel,
        // D-245: resolusi & provider mengikuti pilihan user.
        resolution: state.lipsyncResolution || model?.defaultResolution || '720p',
        provider: 'kie',
        aspect: state.aspect,
      };
      if (refImg) body.referenceImage = { mime: refImg.mime, data: refImg.data };
      const r = await fetch('/api/ai/lipsync', {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Generator karakter bicara gagal.');
      videoTask = { id: d.id, progress: 0, status: 'running' };
      renderVideoProgress();
      window.toast?.('Karakter sedang bicara… (±1-3 menit)');
      pollVideo();
    } catch (e) {
      window.toast?.(e.message || 'Generator karakter bicara gagal.');
      resetGenerateButtons();
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
      resetGenerateButtons();
      window.toast?.('Pemantauan video dibatalkan.');
    });
  }
  // D-243: semua tombol generate berlabel "Buat" + ikon per mode (tidak melebar di HP).
  function resetGenerateButtons() {
    const b = $('stVideoBtn');
    if (b) { b.disabled = false; b.innerHTML = icon('film') + ' Buat'; }
    const l = $('stLipsyncBtn');
    if (l) { l.disabled = false; l.innerHTML = icon('mic') + ' Buat'; }
    const g = $('stGenBtn');
    if (g) { g.disabled = false; g.innerHTML = icon('image-plus') + ' Buat'; }
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
        resetGenerateButtons();
        window.toast?.('Video jadi ✨');
        return;
      }
      if (d.status === 'fail') {
        videoTask.error = d.error || 'Generator video gagal.';
        videoTask = null;
        renderVideoProgress();
        resetGenerateButtons();
        window.toast?.(d.error || 'Generator video gagal.');
        return;
      }
      renderVideoProgress();
      videoTimer = setTimeout(pollVideo, 3000);
    } catch (e) {
      videoTask = null;
      renderVideoProgress();
      resetGenerateButtons();
      window.toast?.(e.message || 'Gagal mengecek status video.');
    }
  }

  window.renderStudio = async function renderStudio() {
    const root = $('studioRoot'); if (!root) return;
    loadChain();
    root.innerHTML =
      // D-202: judul & deskripsi halaman dihapus; tombol Unggah naik ke sudut kanan
      // area Studio (diposisikan absolute di luar grid), grid jadi lebih luas.
      '<button type="button" class="st-upload-btn st-upload-corner" id="stUploadBtn" title="Unggah aset">' + icon('upload') + ' Unggah</button>'
      // D-199: area atas = galeri aset (scrollable), komposer menempel di bawah.
      + '<div class="st-stage">'
      + '<div class="st-gallery st-hidden" id="stGallery"></div>'
      + '<div class="st-stage-empty" id="stStageEmpty">' + icon('image-plus') + '<b>Hasil generate & asetmu muncul di sini</b>'
      + '<p>Ketik <b>@</b> untuk menyematkan karakter, atau unggah aset untuk dipakai ulang.</p></div>'
      + '</div>'
      // D-210: baris judul prompt DI ATAS kotak composer.
      // D-211: label "Deskripsi konten yang kamu mau" dihapus — bikin teks turun
      // 5 baris di HP.
      // D-212: tombol Reset ditambah di depan; semua tombol seragam bentuk petak.
      // D-213: 4 aksi (Reset - Prompt - Optimalkan - Copy) diringkas jadi SATU menu
      // dropdown di DALAM kotak composer, supaya header composer tetap pendek
      // (tidak lagi 2 baris di HP).
      + '<div class="st-composer">'
      // D-214: baris ATAS composer = referensi (karakter/gambar) SEBARIS dengan
      // menu dropdown prompt — jadi 1 baris, bukan 2 baris bertumpuk.
      + '<div class="st-composer-top">'
      + '<div class="st-asset-header st-hidden" id="stAssetHeader"></div>'
      + '<div class="st-prompt-tools st-tools-menu-row">'
      + '<div class="st-pill-wrap st-menu-wrap" id="stPromptMenuWrap">'
      + '<button type="button" class="st-menu-btn" id="stPromptMenuBtn" title="Aksi prompt">' + icon('list-checks') + ' <b>Prompt</b>' + icon('chevron-down') + '</button>'
      + '<div class="st-pop st-pop-menu" id="stPop-actions">'
      + '<button type="button" class="st-menu-item" id="stResetPromptBtn" data-action="reset">' + icon('rotate-ccw') + ' <span>Reset</span></button>'
      + '<button type="button" class="st-menu-item" id="stPromptPill" data-action="prompt">' + icon('message') + ' <span>Prompt</span></button>'
      + '<button type="button" class="st-menu-item" id="stOptimizeBtn" data-action="optimize">' + icon('sparkles') + ' <span>Optimasi</span></button>'
      + '<button type="button" class="st-menu-item" id="stCopyPromptBtn" data-action="copy">' + icon('copy') + ' <span>Copy</span></button>'
      + '</div>'
      // Popover isi Bank Prompt — dibuka dari item "Prompt" di menu.
      + '<div class="st-pop st-pop-wide st-pop-bank" id="stPop-prompt"></div>'
      + '</div>'
      + '</div>'
      + '</div>'
      + '<div class="st-mention-box">'
      + '<textarea id="stPrompt" rows="3" maxlength="1200" placeholder="Prompt… mention @ karakter/aset dll."></textarea>'
      + '<div class="st-mention-list" id="stMentionList"></div>'
      + '</div>'
      // D-244: mode "Karakter Bicara" — arahan adegan (lokasi/kamera/aksi)
      // terpisah dari naskah yang dibacakan TTS.
      + '<div class="st-scene-hint st-hidden" id="stSceneHintBox">'
      + '<label for="stSceneHint">Arahan adegan</label>'
      + '<textarea id="stSceneHint" rows="2" maxlength="1000" placeholder="mis. di studio podcast, kamera close-up, dia tersenyum dan gestur tangan"></textarea>'
      + '</div>'
      + '<div class="st-chain st-hidden" id="stChain"></div>'
      // D-242: panel mode "Karakter Bicara" — pilih karakter yg akan bicara.
      + '<div class="st-lipsync-bar st-hidden" id="stLipsyncBar">'
      + '<button type="button" class="st-lipsync-char" id="stLipsyncCharBtn">'
      + icon('user') + ' <b id="stLipsyncCharName">Pilih karakter</b>' + icon('chevron-down')
      + '</button>'
      + '<div class="st-pop" id="stPop-lipsyncchar"></div>'
      + '<div class="st-lipsync-meta"><span id="stLipsyncMeta">Maks 15 detik</span></div>'
      + '</div>'
      + '<div class="st-controls">'
      // D-221: di HP semua pengaturan konten jadi SATU panel dropdown.
      // Kolom kiri = tombol jenis konten (Foto/Video) + chevron;
      // klik -> panel berisi Rasio, Provider, Model, Durasi, Tier, Resolusi.
      // Di desktop pill tetap tampil baris seperti biasa.
      + '<div class="st-pill-wrap st-type-wrap"><button type="button" class="st-pill st-type-btn" id="stTypePill">' + icon('image-plus') + ' <b>Foto</b>' + icon('chevron-down') + '</button><div class="st-pop" id="stPop-type"></div></div>'
      // D-221: container pill pengaturan (disembunyikan di HP, dipakai panel).
      + '<div class="st-settings-pills" id="stSettingsPills">'
      // Rasio (vertikal/horizontal) — urutan kedua.
      + '<div class="st-pill-wrap"><button type="button" class="st-pill" id="stAspectPill">' + icon('smartphone') + ' <b>1:1</b></button><div class="st-pop" id="stPop-aspect"></div></div>'
      // Provider / mesin — urutan ketiga.
      + '<div class="st-pill-wrap" id="stEnginePillWrap"><button type="button" class="st-pill" id="stEnginePill">' + icon('cpu') + ' <b>Mesin</b></button><div class="st-pop" id="stPop-engine"></div></div>'
      // D-203: kotak model gambar — muncul saat jenis konten Foto & mesin Kie (urutan keempat).
      + '<div class="st-pill-wrap st-hidden" id="stImgModelPillWrap"><button type="button" class="st-pill" id="stImgModelPill">' + icon('sparkles') + ' <b>Model</b></button><div class="st-pop" id="stPop-imgmodel"></div></div>'
      + '<div class="st-pill-wrap st-hidden" id="stModelPillWrap"><button type="button" class="st-pill" id="stModelPill">' + icon('video') + ' <b>Model</b></button><div class="st-pop" id="stPop-model"></div></div>'
      + '<div class="st-pill-wrap st-hidden" id="stDurPill"><button type="button" class="st-pill">' + icon('clock') + ' <b>8 detik</b></button><div class="st-pop" id="stPop-dur"></div></div>'
      + '<div class="st-pill-wrap st-hidden" id="stTierPillWrap"><button type="button" class="st-pill" id="stTierPill">' + icon('sliders') + ' <b>Tier</b></button><div class="st-pop" id="stPop-tier"></div></div>'
      + '<div class="st-pill-wrap st-hidden" id="stResPillWrap"><button type="button" class="st-pill" id="stResPill">' + icon('sparkles') + ' <b>720p</b></button><div class="st-pop" id="stPop-res"></div></div>'
      // D-245: resolusi lipsync (dipakai model InfiniteTalk / LTX 2.5 A2V).
      + '<div class="st-pill-wrap st-hidden" id="stLipResPillWrap"><button type="button" class="st-pill" id="stLipResPill">' + icon('sparkles') + ' <b>720p</b></button><div class="st-pop" id="stPop-lipres"></div></div>'
      + '</div>'
      // D-221: panel pengaturan konten (dropdown/modal di HP).
      + '<div class="st-pop st-pop-settings" id="stPop-settings"></div>'
      + '<span class="st-count" id="stCount">0/1200</span>'
      // D-243: semua tombol generate pakai label seragam "Buat" + ikon per mode,
      // supaya tombol tidak melebar dan tidak turun baris di HP.
      + '<button type="button" class="pink-btn" id="stGenBtn" title="Buat Gambar">' + icon('image-plus') + ' Buat</button>'
      + '<button type="button" class="pink-btn st-hidden" id="stVideoBtn" title="Buat Video">' + icon('film') + ' Buat</button>'
      // D-242: mode "Karakter Bicara" (lipsync) -> potret + audio -> video bicara.
      + '<button type="button" class="pink-btn st-hidden" id="stLipsyncBtn" title="Buat Video Bicara">' + icon('mic') + ' Buat</button>'
      + '</div>'
      + '<div class="st-video-progress st-hidden" id="stVideoProgress" data-progress="0"></div>'
      + '<input type="file" id="stUploadInput" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime" hidden>'
      + '<div class="st-lightbox" id="stLightbox"></div>';

    // Karakter user — dipakai untuk mention picker & header aset.
    fetch('/api/characters', { headers: await authHeaders() }).then((r) => r.json()).then((d) => {
      characters = Array.isArray(d?.characters) ? d.characters : [];
      // D-242: bar karakter lipsync butuh daftar karakter.
      renderLipsyncBar();
      renderAssetHeader(); updatePillLabels();
    }).catch(() => {});
    // Provider kustom dari Pengaturan otomatis jadi pilihan Mesin.
    fetch('/api/custom-providers', { headers: await authHeaders() }).then((r) => r.json()).then((d) => {
      const list = Array.isArray(d?.providers) ? d.providers : [];
      engines = [['auto', 'Otomatis'], ['gemini', 'Google Gemini'], ['kie', 'Kie AI']]
        .concat(list.map((p) => ['custom:' + p.id, p.name]));
      updatePillLabels();
    }).catch(() => {});
    // D-198: galeri aset dari server.
    loadAssets();
    $('stEnginePill')?.addEventListener('click', () => { buildPop('engine'); togglePop('engine'); });
    $('stAspectPill')?.addEventListener('click', () => { buildPop('aspect'); togglePop('aspect'); });
    // D-213: 4 aksi prompt jadi SATU menu dropdown di dalam kotak composer.
    // Menu utama dibuka lewat tombol "Prompt" (ikon list-checks).
    $('stPromptMenuBtn')?.addEventListener('click', () => { togglePop('actions'); });
    // Item menu "Prompt" → buka popover Bank Prompt (isi template & blok).
    $('stPromptPill')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      // Tutup menu aksi dulu, baru buka popover prompt.
      const menu = $('stPop-actions');
      menu?.classList.remove('open');
      if (popOpen === 'actions') popOpen = null;
      await loadPromptBank();
      buildPromptPop();
      togglePop('prompt');
    });
    // D-208: aksi prompt di komposer (dijalankan dari item menu).
    $('stOptimizeBtn')?.addEventListener('click', (e) => { e.stopPropagation(); closeActionMenu(); optimizeComposedPrompt(); });
    $('stCopyPromptBtn')?.addEventListener('click', (e) => { e.stopPropagation(); closeActionMenu(); copyComposedPrompt(); });
    // D-212: tombol Reset — bersihkan komposer dari prompt.
    $('stResetPromptBtn')?.addEventListener('click', (e) => { e.stopPropagation(); closeActionMenu(); resetPromptComposer(); });
    $('stDurPill')?.querySelector('.st-pill').addEventListener('click', () => { buildPop('dur'); togglePop('dur'); });
    $('stModelPill')?.addEventListener('click', () => { buildPop('model'); togglePop('model'); });
    // D-203: pill jenis konten (satu kotak) & pill model gambar.
    // D-221: di HP tombol jenis konten membuka PANEL PENGATURAN (semua setelan
    // konten di satu tempat); di PC tetap dropdown Foto/Video biasa.
    $('stTypePill')?.addEventListener('click', () => {
      if (isMobileLayout()) { openSettingsPanel(); return; }
      buildPop('type'); togglePop('type');
    });
    $('stImgModelPill')?.addEventListener('click', () => { buildPop('imgmodel'); togglePop('imgmodel'); });
    $('stTierPill')?.addEventListener('click', () => { buildPop('tier'); togglePop('tier'); });
    $('stResPill')?.addEventListener('click', () => { buildPop('res'); togglePop('res'); });
    // D-245: pill resolusi lipsync.
    $('stLipResPill')?.addEventListener('click', () => { buildPop('lipres'); togglePop('lipres'); });
    // D-203: katalog model gambar dari server (/api/ai/image/models).
    fetch('/api/ai/image/models', { headers: await authHeaders() }).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!d || !Array.isArray(d.models) || !d.models.length) return; // tetap pakai fallback lokal
      imageCatalog = { defaultModel: d.defaultModel || imageCatalog.defaultModel, models: d.models };
      const m = imageModel();
      if (m) {
        state.imageModel = m.id;
        if (!m.resolutions.includes(state.imageResolution)) state.imageResolution = m.defaultResolution || m.resolutions[0];
      }
      updatePillLabels();
    }).catch(() => {});
    // D-200: katalog model video dari server (provider + model + durasi + resolusi).
    fetch('/api/ai/video/models', { headers: await authHeaders() }).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!d || !Array.isArray(d.models) || !d.models.length) return; // tetap pakai fallback lokal
      videoCatalog = { defaultModel: d.defaultModel || videoCatalog.defaultModel, models: d.models };
      const m = videoModel();
      if (m) {
        state.videoModel = m.id;
        applyModelCaps(m, false);
      }
      updatePillLabels();
    }).catch(() => {});
    // D-242: katalog model lipsync dari server (/api/ai/lipsync/models).
    fetch('/api/ai/lipsync/models', { headers: await authHeaders() }).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!d || !Array.isArray(d.models) || !d.models.length) return; // tetap pakai fallback lokal
      lipsyncCatalog = {
        defaultModel: d.defaultModel || lipsyncCatalog.defaultModel,
        maxSeconds: d.maxSeconds || lipsyncCatalog.maxSeconds,
        providers: Array.isArray(d.providers) && d.providers.length ? d.providers : lipsyncCatalog.providers,
        models: d.models,
      };
      const m = lipsyncModel();
      if (m) state.lipsyncModel = m.id;
      renderLipsyncBar();
    }).catch(() => {});
    const ta = $('stPrompt');
    // D-199: auto-fit — tinggi textarea menyesuaikan isi (44px -> max 150px).
    const autoFit = () => {
      if (!ta) return;
      // D-219: pertahankan posisi scroll saat mengubah tinggi.
      // Mengubah height mengembalikan scrollTop ke 0 -> kursor meloncat ke atas.
      const keepScroll = ta.scrollTop;
      ta.style.height = '44px';
      const next = Math.min(Math.max(ta.scrollHeight, 44), 150);
      ta.style.height = next + 'px';
      ta.style.overflowY = ta.scrollHeight > 150 ? 'auto' : 'hidden';
      ta.scrollTop = keepScroll;
    };
    /**
     * D-219: kursor (caret) harus selalu TEPAT di samping teks yang sedang diketik.
     *
     * Dua penyebab kursor meloncat ke atas di HP:
     *  1) Mengubah `height` textarea mengembalikan scrollTop ke 0 (lihat autoFit).
     *  2) `getComputedStyle` dibaca SETIAP ketikan -> line-height bisa stale
     *     (masih nilai lama) sehingga perkiraan posisi caret meleset.
     *
     * Solusi: cache metrik textarea sekali (line-height, padding, border),
     * dan lakukan scroll pada frame berikutnya (setTimeout 0) supaya layout
     * selesai dulu sebelum posisi caret dihitung.
     */
    let taMetrics = null;
    const readMetrics = () => {
      if (taMetrics) return taMetrics;
      const cs = window.getComputedStyle ? window.getComputedStyle(ta) : null;
      taMetrics = {
        lineHeight: parseFloat(cs?.lineHeight) || 21,
        paddingTop: parseFloat(cs?.paddingTop) || 10,
        borderTop: parseFloat(cs?.borderTopWidth) || 1,
      };
      return taMetrics;
    };
    const scrollCaretIntoView = () => {
      if (!ta) return;
      const pos = ta.selectionStart ?? 0;
      const upto = String(ta.value || '').slice(0, pos);
      const lineCount = upto.split('\n').length;
      const m = readMetrics();
      const clientH = ta.clientHeight || 44;
      // Offset caret dari atas textarea (termasuk border + padding).
      const caretTop = m.borderTop + m.paddingTop + (lineCount - 1) * m.lineHeight;
      // Batas bawah area terlihat: caret harus utuh di dalam area view.
      const viewBottom = ta.scrollTop + clientH;
      if (caretTop + m.lineHeight > viewBottom) {
        // Geser tepat seperlunya -> caret berada di baris paling bawah area view.
        ta.scrollTop = Math.max(0, caretTop + m.lineHeight - clientH);
      } else if (caretTop < ta.scrollTop) {
        // Caret benar-benar di luar area atas -> scroll ke baris itu.
        ta.scrollTop = Math.max(0, caretTop - m.borderTop - m.paddingTop);
      }
    };
    // Scroll dijalankan setelah layout selesai -> posisi caret akurat.
    const scheduleCaretScroll = () => {
      setTimeout(scrollCaretIntoView, 0);
    };
    /**
     * D-220: pulihkan posisi kursor setelah DOM di atas composer berubah
     * (mis. header referensi bertambah/pengurang). Tanpa ini kursor meloncat
     * ke atas setiap kali referensi aktif.
     */
    window.__sherlyRestoreCaret = () => {
      if (!ta) return;
      const pos = ta.selectionStart ?? 0;
      const end = ta.selectionEnd ?? pos;
      try { ta.setSelectionRange(pos, end); } catch { /* ignore */ }
      scheduleCaretScroll();
    };
    ta?.addEventListener('input', () => {
      const c = $('stCount'); if (c) c.textContent = ta.value.length + '/1200';
      autoFit();
      // D-243: estimasi durasi lipsync ikut berubah saat naskah diketik.
      renderLipsyncBar();
      renderAssetHeader(); updatePillLabels(); syncMentionFromText();
      // D-216: mention aset gambar -> masuk ke header sebagai referensi.
      syncMentionedAssetRefs();
      // D-219: kursor tetap di samping teks yang sedang diketik.
      scheduleCaretScroll();
    });
    ta?.addEventListener('keyup', (e) => { syncMentionFromText(); scheduleCaretScroll(); });
    ta?.addEventListener('click', () => { syncMentionFromText(); scheduleCaretScroll(); });
    ta?.addEventListener('focus', scheduleCaretScroll);
    ta?.addEventListener('select', scheduleCaretScroll);
    // D-218: saat caret berpindah (klik, panah, pilih) kursor harus tetap pas
    // di baris yang sedang diketik — karena sering tidak memicu event input/keyup.
    ta?.addEventListener('selectionchange', scheduleCaretScroll);
    document.addEventListener('selectionchange', () => {
      if (document.activeElement === ta) scheduleCaretScroll();
    });
    // Ukuran font HP berubah saat keyboard muncul -> metrik textarea stale.
    ta?.addEventListener('resize', () => { taMetrics = null; scheduleCaretScroll(); });
    ta?.addEventListener('keydown', (e) => {
      if (!mentionOpen) return;
      const list = mentionCandidates();
      if (e.key === 'ArrowDown') { e.preventDefault(); mentionIndex = Math.min(mentionIndex + 1, Math.max(list.length - 1, 0)); renderMention(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); mentionIndex = Math.max(mentionIndex - 1, 0); renderMention(); }
      else if (e.key === 'Enter' && list[mentionIndex]) {
        e.preventDefault();
        const it = list[mentionIndex];
        pickMention(it.kind === 'asset' ? 'asset:' + it.id : 'char:' + it.id);
      }
      else if (e.key === 'Escape') { e.preventDefault(); closeMention(); }
    });
    ta?.addEventListener('blur', () => setTimeout(() => closeMention(), 120));
    $('stGenBtn')?.addEventListener('click', generate);
    $('stVideoBtn')?.addEventListener('click', generateVideo);
    // D-242: mode "Karakter Bicara" (lipsync).
    $('stLipsyncBtn')?.addEventListener('click', generateLipsync);
    $('stLipsyncCharBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      buildLipsyncCharPop();
      togglePop('lipsyncchar');
    });
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
