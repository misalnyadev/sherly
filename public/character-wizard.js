// ===== Karakter Wizard v3 (5 tahap) — ala AK Talent di atas arsitektur SherlyStudio =====
// Tahap: 1 Foto (unggah / BUAT via AI txt2img) · 2 Detail Fisik (vision) · 3 Identitas & Master
// Board (img2img) · 4 Suara (Gemini TTS) · 5 Bible (dirangkum AI, suara ikut terkunci).
// API untuk index.html: sherlyWizardOpen(item) · sherlyWizardCollect() · sherlyWizardFiles()
// · sherlyWizardClear() · sherlyCardCompleteness(c) · sherlyExportCharacter(id)
// Ekspor/impor paket .json = jembatan karakter antar aplikasi (AK Talent dkk).
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const TRAIT_FIELDS = [
    ['faceShape', 'Bentuk wajah'], ['skin', 'Warna kulit'], ['eyes', 'Mata'], ['eyeDetail', 'Detail mata'],
    ['eyebrows', 'Alis'], ['nose', 'Hidung'], ['lips', 'Bibir'], ['lipDetail', 'Detail bibir'],
    ['hair', 'Rambut'], ['hairDetail', 'Detail rambut'], ['hijab', 'Hijab'], ['bodyType', 'Bentuk tubuh'],
    ['mark', 'Ciri khas'], ['outfit', 'Outfit / estetika fesyen'], ['style', 'Gaya'],
    ['accessories', 'Aksesoris'], ['skinTexture', 'Tekstur kulit close-up'],
  ];
  const DRAFT_KEY = 'sherly.charwizard.v1';
  const PACKAGE_FORMAT = 'character-package';
  // D-105: gender & tinggi (form basics, ala AK Talent) disimpan di traits — bukan field vision.
  const TRAIT_EXTRA = ['gender', 'height'];
  // D-110: TRAIT_FIELDS berupa pasangan [kunci, label] — iterasi kunci WAJIB lewat TRAIT_KEYS.
  // (Bug lama: saveDraft/collect iterate pasangan array -> traits[['hair','Rambut']] = undefined
  //  -> hanya gender+height yang tersimpan -> "kurang: Detail fisik" di setiap simpan.)
  const TRAIT_KEYS = TRAIT_FIELDS.map((f) => f[0]);

  let traits = {};
  let bible = '';
  let voice = { name: '', style: '', script: '' };
  // Detail "Buat Karakter (AI)": field fisik (hijab/rambut/dll.) menulis langsung ke `traits`
  // supaya konsisten dengan tahap 2-3; field khusus generate disimpan terpisah di `gen`.
  let gen = { gender: '', look: 'photo', expr: '', bg: '', light: 'window', notes: '', lang: 'id' };
  let genPromptDirty = false; // true bila user menyunting kotak prompt manual
  let editingId = '';
  let currentRefUrl = '';   // URL foto referensi tersimpan (mode edit)
  let currentBoardUrl = '';
  let currentVoiceUrl = '';
  let pendingRef = null;    // { mime, data } foto hasil generate / impor (belum tersimpan)
  let pendingBoard = null;  // { mime, data } board hasil generate / impor
  let pendingVoice = null;  // Blob suara hasil TTS / impor
  let draftTimer = null;

  const apiJson = async (url, body) => {
    const t = (await window.sherlyGetAccessToken?.()) || '';
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Request gagal (' + r.status + ')');
    return d;
  };
  const authHeaders = async () => {
    const t = (await window.sherlyGetAccessToken?.()) || '';
    return { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) };
  };

  // ---------- util gambar/audio ----------
  function blobToResizedBase64(blob, max = 1280) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          const dataUrl = c.toDataURL('image/jpeg', 0.9);
          resolve({ mime: 'image/jpeg', data: dataUrl.split(',')[1] });
        } catch (e) { URL.revokeObjectURL(url); reject(e); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Gagal membaca gambar.')); };
      img.src = url;
    });
  }
  async function urlToBase64(url, max = 1280) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('Gagal membaca berkas tersimpan.');
    return await blobToResizedBase64(await r.blob(), max);
  }
  const b64ToBlob = (mime, data) => new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], { type: mime || 'image/png' });
  async function dataUrlToBlob(dataUrl) { const r = await fetch(dataUrl); return await r.blob(); }

  /** Sumber foto saat ini: file terpilih > hasil generate/impor > foto tersimpan. */
  async function currentPhotoParts() {
    const file = $('characterImage')?.files?.[0];
    if (file) return await blobToResizedBase64(file);
    if (pendingRef) return { mime: pendingRef.mime, data: pendingRef.data };
    if (currentRefUrl) return await urlToBase64(currentRefUrl);
    return null;
  }

  // ---------- draft ----------
  function saveDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      try {
        const cleanT = {};
        for (const k of [...TRAIT_KEYS, ...TRAIT_EXTRA]) { const v = String(traits[k] || '').trim(); if (v) cleanT[k] = v; }
        const cleanV = {};
        for (const k of ['name', 'style', 'script']) { const v = String(voice[k] || '').trim(); if (v) cleanV[k] = v; }
        const cleanG = {};
        for (const k of ['gender', 'look', 'expr', 'bg', 'light', 'notes', 'lang']) { const v = String(gen[k] || '').trim(); if (v) cleanG[k] = v; }
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ traits: cleanT, bible: String(bible || '').slice(0, 8000), voice: cleanV, gen: cleanG }));
      } catch {}
    }, 400);
  }
  window.sherlyWizardClear = () => { try { localStorage.removeItem(DRAFT_KEY); } catch {} };

  // ---------- langkah ----------
  function goStep(n) {
    document.querySelectorAll('#characterModal .wiz-step').forEach((b) => b.classList.toggle('active', b.dataset.step === String(n)));
    document.querySelectorAll('#characterModal .wiz-pane').forEach((p) => {
      const on = p.dataset.pane === String(n);
      p.hidden = !on;
      p.querySelectorAll('input,textarea,select,button').forEach((el) => { el.disabled = !on; });
    });
    if (String(n) === '1') syncGenDropdowns(); // refresh dropdown setelah sunting trait di tahap 2
    if (String(n) === '3') refreshBoardPrompt(); // refresh prompt board setelah sunting identitas
    if (String(n) === '4') renderVoiceBox();
    if (String(n) === '5') {
      // D-108: sampai di tahap Bible, kunci identitas otomatis jadi Master Prompt
      // (bila masih kosong) — user tinggal susun Bible lalu Simpan.
      refreshLock();
      const ta = $('characterPrompt');
      if (ta && !ta.value.trim()) { ta.value = compileIdentityLock(); refreshBoardPrompt(); }
    }
  }

  // ---------- mode foto (unggah / buat) ----------
  function setPhotoMode(mode) {
    const up = $('wizModeUpload'), gen = $('wizModeGen');
    if (!up || !gen) return;
    up.classList.toggle('on', mode === 'upload');
    gen.classList.toggle('on', mode === 'gen');
    $('wizGenBlock').hidden = mode !== 'gen';
    if (mode === 'gen') refreshGenPrompt();
  }

  function refreshPhotoPreview() {
    const wrap = $('wizPhotoPreviewWrap'), img = $('wizPhotoPreview');
    if (!wrap || !img) return;
    const file = $('characterImage')?.files?.[0];
    const src = file ? URL.createObjectURL(file) : (pendingRef ? 'data:' + (pendingRef.mime || 'image/png') + ';base64,' + pendingRef.data : (currentRefUrl || ''));
    if (src) { img.src = src; wrap.hidden = false; } else wrap.hidden = true;
    refreshBoardRef(src);
  }

  /** Thumbnail foto referensi di tahap 3 — menegaskan basis image-to-image board. */
  function refreshBoardRef(src) {
    const img = $('wizBoardRefImg'), note = $('wizBoardRefNote');
    if (!img || !note) return;
    if (src === undefined) {
      const file = $('characterImage')?.files?.[0];
      src = file ? URL.createObjectURL(file) : (pendingRef ? 'data:' + (pendingRef.mime || 'image/png') + ';base64,' + pendingRef.data : (currentRefUrl || ''));
    }
    if (src) {
      img.src = src; img.hidden = false;
      note.textContent = 'Dipakai Kie AI / Gemini sebagai basis image-to-image — wajah & detail tetap konsisten.';
    } else {
      img.removeAttribute('src'); img.hidden = true;
      note.textContent = 'Belum ada foto — unggah / buat dulu di tahap 1, atau pakai mesin teks→gambar.';
    }
  }

  // ---------- traits grid ----------
  function renderTraitsGrid() {
    const grid = $('traitsGrid'); if (!grid) return;
    grid.innerHTML = TRAIT_FIELDS.map(([k, label]) =>
      '<div class="trait-field"><label>' + esc(label) + '</label><textarea data-trait="' + k + '" rows="1" placeholder="…">' + esc(traits[k] || '') + '</textarea></div>'
    ).join('');
    grid.querySelectorAll('[data-trait]').forEach((t) => {
      t.addEventListener('input', () => { traits[t.dataset.trait] = t.value; saveDraft(); refreshLock(); refreshGenPrompt(); refreshBoardPrompt(); });
    });
  }

  // D-108: "Penampilan" tidak lagi field manual di tahap 5 — dirangkum otomatis dari
  // detail fisik tahap 1–2, jadi selalu sinkron dengan karakter (bukan teks default statis).
  function ringkasAppearance() {
    const p = [];
    if (traits.gender) p.push(traits.gender);
    if (traits.height) p.push('tinggi ' + traits.height);
    if (traits.hair) p.push('rambut ' + traits.hair);
    if (traits.eyes) p.push('mata ' + traits.eyes);
    if (traits.skin) p.push('kulit ' + traits.skin);
    if (traits.faceShape) p.push('wajah ' + traits.faceShape);
    if (traits.bodyType) p.push('tubuh ' + traits.bodyType);
    if (traits.hijab && !/^(tidak|tanpa|no)/i.test(String(traits.hijab).trim())) p.push('berhijab: ' + traits.hijab);
    if (traits.mark) p.push('ciri khas: ' + traits.mark);
    return p.join('; ').slice(0, 900);
  }
  function collectBasics() {
    return {
      name: ($('characterName')?.value || '').trim(),
      role: fieldVal('characterRole'),
      age: $('characterAge')?.value || '',
      origin: fieldVal('characterOrigin'),
      niche: ($('characterNiche')?.value || '').split(',').map((x) => x.trim()).filter(Boolean),
      platforms: ($('characterPlatforms')?.value || '').split(',').map((x) => x.trim()).filter(Boolean),
      language: fieldVal('characterLanguage'),
      appearance: ringkasAppearance(),
      personality: $('characterPersonality')?.value || '',
      identity_prompt: $('characterPrompt')?.value || '',
    };
  }

  // ---------- kunci identitas ----------
  function compileIdentityLock(opts = {}) {
    const b = collectBasics();
    const t = traits;
    // Format detail ala AK Talent: "Mata: besar (kelopak ganda)".
    const join = (a, bb) => {
      const x = String(a || '').trim(), y = String(bb || '').trim();
      return x && y ? x + ' (' + y + ')' : (x || y);
    };
    const line = (label, v) => (String(v || '').trim() ? label + ': ' + String(v).trim() + '. ' : '');
    let s = 'IDENTITY LOCK — karakter ' + (b.name || 'ini') + (b.age ? ', usia visual ' + b.age + ' tahun' : '') + (b.origin ? ', etnis ' + b.origin : '') + (t.gender ? ', gender ' + t.gender : '') + (t.height ? ', tinggi ' + t.height : '') + (b.role ? ', peran ' + b.role : '') + '. ';
    s += line('Bentuk wajah', t.faceShape);
    s += line('Warna kulit', t.skin);
    s += line('Mata', join(t.eyes, t.eyeDetail));
    s += line('Alis', t.eyebrows);
    s += line('Hidung', t.nose);
    s += line('Bibir', join(t.lips, t.lipDetail));
    s += line('Rambut', join(t.hair, t.hairDetail));
    s += (String(t.hijab || '').trim() && !/^tidak ada$/i.test(t.hijab)) ? 'Hijab: ' + t.hijab.trim() + ' (rambut tidak terlihat). ' : '';
    s += line('Bentuk tubuh', t.bodyType);
    s += line('Ciri khas', t.mark);
    s += line('Outfit', t.outfit);
    s += line('Gaya', t.style);
    s += (String(t.accessories || '').trim() && !/^tidak ada$/i.test(t.accessories)) ? 'Aksesoris: ' + String(t.accessories).trim() + '. ' : '';
    s += line('Tekstur kulit', t.skinTexture || 'pori-pori halus terlihat natural, tekstur kulit nyata tidak mulus plastik, tanpa efek beauty filter berlebihan');
    // skipVoice: prompt board (tahap 3) disusun sebelum tahap 4 — jangan sertakan profil suara.
    if (voice.name && !opts.skipVoice) s += 'Suara: voice Gemini "' + voice.name + '"' + (voice.style ? ', gaya ' + voice.style : '') + '. ';
    s += 'Pertahankan wajah ini persis sama, jangan berubah menjadi orang lain. Foto realistis, natural, anatomi wajar, pencahayaan konsisten.';
    if (b.appearance.trim()) s += '\nPenampilan umum: ' + b.appearance.trim();
    if (b.personality.trim()) s += '\nKepribadian: ' + b.personality.trim();
    return s;
  }
  function refreshLock() {
    const el = $('wizLockPreview'); if (el) el.textContent = compileIdentityLock();
  }

  // ---------- tahap 1: buat karakter (txt2img) ----------
  function buildFacePrompt() {
    const b = collectBasics();
    const t = traits;
    const bits = [];
    bits.push('Foto potret wajah hyper-realistic karakter virtual' + (b.name ? ' bernama ' + b.name : '') + (b.age ? ', usia visual sekitar ' + b.age + ' tahun' : '') + (b.origin ? ', beretnis ' + b.origin : '') + '.');
    const look = [t.hijab && !/^tidak ada$/i.test(t.hijab) ? 'berhijab (' + t.hijab + ')' : null,
      join2(t.hair, t.hairDetail), join2(t.eyes, t.eyeDetail), t.skin, t.faceShape, join2(t.lips, t.lipDetail), t.bodyType, t.outfit, t.style, t.accessories]
      .filter(Boolean).join(', ');
    if (look) bits.push('Penampilan: ' + look + '.');
    if (b.appearance.trim()) bits.push(b.appearance.trim());
    if (b.personality.trim()) bits.push('Ekspresi mencerminkan kepribadian: ' + b.personality.trim() + '.');
    bits.push('Gaya fotografi estetika Instagram, potret close-up natural, cahaya jendela lembut, latar bersih sederhana.');
    bits.push('Wajah realistis dengan tekstur kulit nyata dan pori-pori halus; tanpa beauty filter berlebihan, tanpa teks/watermark.');
    return bits.join(' ').slice(0, 1450);
    function join2(a, b2) { return [a, b2].filter((x) => String(x || '').trim()).join(' — '); }
  }

  // ---------- tahap 1: form detail karakter -> prompt siap generate ----------
  const GEN_LOOK = {
    photo: { id: 'foto potret wajah hyper-realistic', en: 'hyper-realistic portrait photograph' },
    semi: { id: 'potret wajah semi-realistis', en: 'semi-realistic portrait' },
    anime: { id: 'ilustrasi potret gaya anime', en: 'anime-style character portrait illustration' },
    '3d': { id: 'render karakter 3D stylized', en: 'stylized 3D character render' },
    illo: { id: 'ilustrasi digital yang detail', en: 'detailed digital illustration portrait' },
  };
  const GEN_LIGHT = {
    window: { id: 'cahaya jendela natural yang lembut', en: 'soft natural window light' },
    golden: { id: 'golden hour yang hangat', en: 'warm golden hour light' },
    studio: { id: 'studio softbox yang bersih', en: 'clean studio softbox lighting' },
    moody: { id: 'sinematik moody', en: 'cinematic moody lighting' },
    neon: { id: 'neon urban malam', en: 'neon urban night lighting' },
  };
  const GEN_GENDER = {
    Perempuan: { id: 'perempuan', en: 'female' },
    'Laki-laki': { id: 'laki-laki', en: 'male' },
    'Tampilan netral': { id: 'tampilan netral', en: 'androgynous look' },
  };

  // Dropdown preset (klik-klik cepat ala AK Talent) + opsi "Lainnya — tulis sendiri…".
  // store: 'trait' (sinkron tahap 2-3) · 'gen' (khusus generate) · 'dom' (nilai di elemen form basics).
  const GEN_DROPDOWNS = [
    { id: 'characterRole', store: 'dom', key: 'role', empty: '— pilih peran —', presets: ['Virtual Lifestyle Influencer', 'Beauty Influencer', 'Fashion Influencer', 'Gamer & Streamer', 'Penyanyi Virtual', 'Presenter Virtual', 'Model Virtual', 'Food Vlogger', 'Travel Content Creator', 'Kreator Edukasi'] },
    { id: 'characterOrigin', store: 'dom', key: 'origin', empty: '— pilih —', presets: ['Indonesia', 'Jepang', 'Korea Selatan', 'Tiongkok', 'Thailand', 'Malaysia', 'Filipina', 'India', 'Blasteran Asia–Eropa', 'Amerika', 'Eropa', 'Timur Tengah'] },
    { id: 'characterGender', store: 'trait', key: 'gender', empty: '— pilih —', presets: ['Perempuan', 'Laki-laki', 'Tampilan netral'] },
    { id: 'characterHeight', store: 'trait', key: 'height', empty: '— pilih —', presets: ['±150 cm', '±155 cm', '±160 cm', '±163 cm', '±165 cm', '±168 cm', '±170 cm', '±173 cm', '±175 cm', '±180 cm', '±185 cm'] },
    { id: 'characterLanguage', store: 'dom', key: 'language', empty: '— pilih —', presets: ['Bahasa Indonesia', 'English', 'Bilingual (ID + EN)', 'Bahasa Jawa', 'Bahasa Sunda'] },
    { id: 'wizGenHijab', store: 'trait', key: 'hijab', empty: 'Tanpa hijab', presets: ['pashmina simpel', 'hijab segi empat', 'hijab instan sporty', 'khimar / gamis', 'hijab perlente'] },
    { id: 'wizGenHair', store: 'trait', key: 'hair', empty: '— pilih —', presets: ['hitam panjang lurus', 'hitam panjang berlayer', 'hitam pendek bob', 'hitam keriting panjang', 'cokelat gelap panjang berlayer', 'cokelat honey brown panjang', 'pirang ash panjang', 'merah mahogany panjang', 'pendek undercut (pria)', 'comma hair (pria)', 'gondrong wavy (pria)'] },
    { id: 'wizGenEyes', store: 'trait', key: 'eyes', empty: '— pilih —', presets: ['cokelat gelap', 'hitam pekat', 'cokelat terang', 'hazel', 'biru', 'hijau', 'kelabu'] },
    { id: 'wizGenSkin', store: 'trait', key: 'skin', empty: '— pilih —', presets: ['putih cerah', 'sawo matang cerah', 'sawo matang', 'cokelat olive', 'cokelat gelap'] },
    { id: 'wizGenFace', store: 'trait', key: 'faceShape', empty: '— pilih —', presets: ['oval', 'bulat', 'heart', 'kotak (square)', 'lonjong', 'V-sharp'] },
    { id: 'wizGenBody', store: 'trait', key: 'bodyType', empty: '— pilih —', presets: ['langsing (slim)', 'hourglass', 'atletis', 'pear', 'rectangle', 'curvy plus size', 'tegap berotot (pria)'] },
    { id: 'wizGenOutfit', store: 'trait', key: 'outfit', empty: '— pilih —', presets: ['kasual (kaos & jeans)', 'streetwear (hoodie & sneaker)', 'formal (blazer & kemeja)', 'dress elegan', 'modest (gamis longgar)', 'korean (knit & rok plisket)', 'batik modern', 'sporty (athleisure)'] },
    { id: 'wizGenAcc', store: 'trait', key: 'accessories', empty: 'Tanpa aksesori', presets: ['anting kecil emas', 'kacamata frame tipis', 'kalung tipis silver', 'jam tangan minimalis', 'headphone', 'topi bucket'] },
    { id: 'wizGenExpr', store: 'gen', key: 'expr', empty: '— pilih —', presets: ['senyum hangat natural', 'ceria tertawa', 'tenang & datar', 'playful smirk', 'serius fokus'] },
    { id: 'wizGenBg', store: 'gen', key: 'bg', empty: '— pilih —', presets: ['studio bersih polos', 'kafe minimalis', 'kamar cozy hangat', 'taman hijau', 'jalan kota siang', 'pantai golden hour', 'dinding pastel', 'kantor modern'] },
  ];
  const CUSTOM_OPT = '__custom';

  /** Nilai efektif sebuah field: preset terpilih, atau isi input "Lainnya". */
  function fieldVal(id) {
    const el = $(id); if (!el) return '';
    if (el.tagName === 'SELECT' && el.value === CUSTOM_OPT) return String($(id + 'X')?.value || '').trim();
    return String(el.value || '').trim();
  }
  function setDropdownVal(cfg, v) {
    const sel = $(cfg.id), xi = $(cfg.id + 'X');
    if (!sel) return;
    const val = String(v || '').trim();
    if (!xi) { sel.value = val; return; }
    if (!val || cfg.presets.includes(val)) { sel.value = val; xi.hidden = true; xi.value = ''; }
    else { sel.value = CUSTOM_OPT; xi.hidden = false; xi.value = val; }
  }
  function applyDropdownVal(cfg, v) {
    if (cfg.store === 'trait') { traits[cfg.key] = v; refreshLock(); refreshBoardPrompt(); }
    else if (cfg.store === 'gen') gen[cfg.key] = v;
    refreshGenPrompt();
    saveDraft();
  }
  function initGenDropdown(cfg) {
    const sel = $(cfg.id), xi = $(cfg.id + 'X');
    if (!sel || sel.tagName !== 'SELECT') return;
    let html = '<option value="">' + esc(cfg.empty) + '</option>';
    for (const p of cfg.presets) html += '<option value="' + esc(p) + '">' + esc(p) + '</option>';
    html += '<option value="' + CUSTOM_OPT + '">Lainnya — tulis sendiri…</option>';
    sel.innerHTML = html;
    sel.addEventListener('change', () => {
      if (sel.value === CUSTOM_OPT) {
        if (xi) { xi.hidden = false; xi.focus(); }
        applyDropdownVal(cfg, String(xi?.value || '').trim());
      } else {
        if (xi) { xi.hidden = true; xi.value = ''; }
        applyDropdownVal(cfg, sel.value);
      }
    });
    xi?.addEventListener('input', () => applyDropdownVal(cfg, xi.value));
  }
  window.sherlyFieldVal = fieldVal;
  window.sherlyFieldSet = (id, v) => {
    const cfg = GEN_DROPDOWNS.find((c) => c.id === id);
    if (cfg) setDropdownVal(cfg, v);
    else { const el = $(id); if (el) el.value = String(v ?? ''); }
    refreshLock();
    refreshGenPrompt();
  };
  const isEn = () => gen.lang === 'en';
  const present = (v) => String(v || '').trim();

  /** Susun prompt txt2img dari form detail karakter (bahasa id/en, nilai isian tetap verbatim). */
  function buildGenPrompt() {
    const b = collectBasics();
    const t = traits;
    const L = (map, key) => (map[key] && (isEn() ? map[key].en : map[key].id)) || '';
    const look = gen.look || 'photo';
    const real = look === 'photo' || look === 'semi';
    const bits = [];
    const who = [
      t.gender ? L(GEN_GENDER, t.gender) : '',
      b.age ? (isEn() ? 'looks around ' + b.age + ' years old' : 'usia visual sekitar ' + b.age + ' tahun') : '',
      b.origin ? (isEn() ? b.origin + ' ethnicity' : 'beretnis ' + b.origin) : '',
      t.height ? (isEn() ? 'about ' + t.height.replace(/^±\s*/, '') + ' tall' : 'tinggi ' + t.height) : '',
    ].filter(Boolean).join(', ');
    bits.push(L(GEN_LOOK, look) + (isEn() ? ' of a virtual character' : ' karakter virtual') + (b.name ? (isEn() ? ' named ' : ' bernama ') + b.name : '') + (who ? ' (' + who + ')' : '') + '.');
    const hijabOn = present(t.hijab) && !/^tidak ada$/i.test(t.hijab);
    const lookBits = [];
    if (hijabOn) lookBits.push(isEn() ? 'wearing hijab (' + present(t.hijab) + ')' : 'berhijab (' + present(t.hijab) + ')');
    else if (present(t.hair)) lookBits.push(isEn() ? present(t.hair) + ' hair' : 'rambut ' + present(t.hair));
    if (present(t.eyes)) lookBits.push(isEn() ? present(t.eyes) + ' eyes' : 'mata ' + present(t.eyes));
    if (present(t.skin)) lookBits.push(isEn() ? present(t.skin) + ' skin' : 'kulit ' + present(t.skin));
    if (present(t.faceShape)) lookBits.push(isEn() ? present(t.faceShape) + ' face shape' : 'bentuk wajah ' + present(t.faceShape));
    if (present(t.bodyType)) lookBits.push(isEn() ? present(t.bodyType) + ' body' : 'tubuh ' + present(t.bodyType));
    if (present(t.outfit)) lookBits.push((isEn() ? 'wearing ' : 'memakai ') + present(t.outfit));
    if (present(t.accessories)) lookBits.push((isEn() ? 'accessories: ' : 'aksesori: ') + present(t.accessories));
    if (lookBits.length) bits.push((isEn() ? 'Appearance: ' : 'Penampilan: ') + lookBits.join(', ') + '.');
    if (present(gen.expr)) bits.push((isEn() ? 'Expression: ' : 'Ekspresi: ') + present(gen.expr) + '.');
    if (present(gen.bg)) bits.push((isEn() ? 'Background: ' : 'Latar: ') + present(gen.bg) + (real ? (isEn() ? ', softly blurred' : ', sedikit blur') : '') + '.');
    bits.push((isEn() ? 'Lighting: ' : 'Pencahayaan: ') + L(GEN_LIGHT, gen.light || 'window') + '.');
    if (present(gen.notes)) bits.push(present(gen.notes));
    bits.push(real
      ? (isEn()
        ? 'Aesthetic Instagram-style close-up portrait, realistic skin texture with fine pores, natural look, no heavy beauty filter, no text, no watermark.'
        : 'Potret close-up estetika ala Instagram, tekstur kulit realistis dengan pori-pori halus, tampilan natural, tanpa beauty filter berlebihan, tanpa teks/watermark.')
      : (isEn()
        ? 'Clean composition, high detail, consistent character design, no text, no watermark.'
        : 'Komposisi bersih, detail tinggi, desain karakter konsisten, tanpa teks/watermark.'));
    return bits.join(' ').replace(/\s+/g, ' ').trim().slice(0, 1450);
  }

  /** Isi ulang kotak prompt (kecuali user sudah menyuntingnya manual — kecuali dipaksa). */
  function refreshGenPrompt(force) {
    const ta = $('wizGenPrompt'); if (!ta) return;
    if (genPromptDirty && !force) return;
    ta.value = buildGenPrompt();
  }

  /** Isi form detail dari state (traits + gen) — dipanggil saat wizard dibuka. */
  function syncGenDropdowns() {
    for (const cfg of GEN_DROPDOWNS) {
      if (cfg.store === 'dom') continue; // basics di-set showCharacterModal
      setDropdownVal(cfg, cfg.store === 'gen' ? gen[cfg.key] : traits[cfg.key]);
    }
  }
  function renderGenForm() {
    syncGenDropdowns();
    const vals = { wizGenLook: gen.look || 'photo', wizGenLight: gen.light || 'window', wizGenLang: isEn() ? 'en' : 'id', wizGenNotes: gen.notes || '' };
    for (const [id, v] of Object.entries(vals)) { const el = $(id); if (el) el.value = String(v); }
    genPromptDirty = false;
    refreshGenPrompt(true);
  }

  async function runGenFace() {
    const btn = $('wizGenFaceBtn'); const log = $('wizGenLog');
    if (!btn) return;
    btn.disabled = true; btn.textContent = 'Membuat foto…';
    if (log) log.textContent = 'Memanggil mesin gambar dengan prompt di atas…';
    try {
      const prompt = ($('wizGenPrompt')?.value || '').trim() || buildFacePrompt();
      const d = await apiJson('/api/ai/image', { prompt, provider: $('wizGenEngine')?.value || 'auto', aspect: '4:5' });
      if (!d.image?.data) throw new Error('Mesin tidak mengembalikan gambar.');
      pendingRef = { mime: d.image.mime, data: d.image.data };
      currentRefUrl = '';
      const ci = $('characterImage'); if (ci) ci.value = '';
      refreshPhotoPreview();
      if (log) log.textContent = 'Foto jadi ✓ (via ' + (d.provider || 'AI') + ') — akan tersimpan sebagai foto referensi. Bisa di-generate ulang.';
      window.toast?.('Foto karakter jadi ✓');
    } catch (e) {
      if (log) log.textContent = 'Gagal: ' + (e.message || 'generator gagal.') + ' Kredit habis? Salin prompt-nya dan generate di aplikasi lain, lalu unggah hasilnya.';
      window.toast?.(e.message || 'Generator gagal.');
    } finally {
      btn.disabled = false; btn.textContent = 'Generate di Aplikasi';
    }
  }

  // ---------- tahap 2: analisis foto ----------
  async function runAnalysis() {
    const btn = $('wizAnalyzeBtn'); const log = $('wizAnalyzeLog');
    if (!btn) return;
    btn.disabled = true; btn.textContent = 'Menganalisis…';
    if (log) log.textContent = 'Menyiapkan foto…';
    try {
      const photo = await currentPhotoParts();
      if (!photo) {
        if (log) log.textContent = 'Unggah / buat foto wajah dulu di tahap 1 (atau pakai foto referensi tersimpan).';
        return;
      }
      if (log) log.textContent = 'Menganalisis foto dengan AI vision…';
      const d = await apiJson('/api/ai/vision', { image: photo, provider: $('wizVisionEngine')?.value || 'auto' });
      traits = Object.assign({}, traits, d.traits || {});
      renderTraitsGrid(); refreshLock(); saveDraft();
      if (log) log.textContent = 'Analisis selesai ✓ (via ' + (d.provider || 'AI') + ') — ' + Object.keys(d.traits || {}).length + ' detail terisi. Periksa & sunting sesukamu.';
      window.toast?.('Analisis foto selesai ✓');
    } catch (e) {
      if (log) log.textContent = 'Gagal: ' + (e.message || 'analisis foto gagal.');
      window.toast?.(e.message || 'Analisis foto gagal.');
    } finally {
      btn.disabled = false; btn.textContent = 'Analisis Foto Otomatis';
    }
  }

  // ---------- tahap 3: master board ----------
  let boardPromptDirty = false;
  // Engine character-sheet — VERBATIM ala AK Talent (docs/referensi-aktalent.md).
  // Struktur: preamble + STEP 0 (kunci identitas & lingkungan) -> "Karakter dasar:" + identitas
  // -> STEP 1 (generate landscape 16:9) -> SHEET PROMPT (3 full-body + grid 4x3 = 12 foto).
  const BOARD_ENGINE_PRE = `You are an automatic character-sheet engine. You receive ONE reference image of a character and produce ONE landscape character sheet showing the exact same person from many views. Do not ask the user any questions and do not offer choices. If no reference image is attached, ask once for it, then proceed.

STEP 0 - IDENTITY AND ENVIRONMENT LOCK (silent)

Study the reference image (and the original character prompt if provided). Keep these identical in every panel: face shape and bone structure, eye color and iris pattern, brows, nose, lip shape, skin tone and undertone, freckles / moles / marks and their positions, hair color, texture, length and style, facial hair, age, build, outfit, accessories, lighting style and color grade.

Also lock the environment: identify the location, background elements, surfaces, lighting direction and color palette in the reference image. Every full-body and portrait panel must keep this same environment. Do not replace it with a studio backdrop.

For views the reference does not show (back, side, full body), infer them consistently: the hair style continues logically (same braid, curl or cut pattern and length), the outfit continues, and the body matches the visible build. For the environment, continue the same location logically: the same surfaces, the same props, the same lighting, seen from the new angle.

Karakter dasar (acuan identitas, Bahasa Indonesia — jadikan rujukan utama bersama foto referensi): `;
  const BOARD_ENGINE_POST = `

STEP 1 - GENERATE (automatic)

Generate exactly ONE image: landscape 16:9, highest resolution available, containing the full set of panels below, arranged as specified. No text, labels, captions, numbers, watermarks or UI anywhere in the image.

SHEET PROMPT

"Single landscape (16:9) professional character reference sheet of the exact same person as the reference image, laid out as a clean editorial grid of photographs separated by thin even white gutters. Every panel shows the same person with identical face, skin tone, freckles and marks, hair, outfit and accessories, under the same lighting style and color grade. Every full-body and portrait panel keeps the same environment as the reference image.

LEFT SECTION (about 45% of the width): three full-body photographs side by side at the same scale, head to feet visible, standing relaxed in the exact same environment as the reference image, with the same location, background, surfaces and lighting:

1) full body front view,

2) full body side profile view (clean profile of forehead, nose, lips and chin), with the background continuing naturally from the same location,

3) full body back view (hair from behind with the exact same style and length, outfit seen from the back with realistic seams and fabric folds), with the background continuing naturally from the same location.

RIGHT SECTION (about 55% of the width): a 4-column by 3-row grid of 12 photographs:

Row 1, portraits (each in the same environment, softly blurred behind the person): head-and-shoulders front portrait; three-quarter portrait looking at the lens; side profile portrait with rim light on the face edge; back-of-head view showing hair from behind in full detail.

Row 2, macro close-ups: eye macro (iris with a natural color gradient and soft limbal ring, sharp pupil, moist reflections, individual lashes with natural curl, individual eyebrow hairs, fine lines and pores around the eye); ear macro (skin translucency, pores, peach fuzz, rim-lit hair strands, earring with sharp specular highlights if the reference has one); hair macro (individual strands clearly defined, natural variation in thickness and direction, fine baby hairs at the hairline, scalp visible where the style allows); cheek macro (pores distinctly visible, freckles and marks as in the reference, fine peach fuzz, natural oils with glossy highlights on the cheekbone).

Row 3, features and expressions: nose macro (fine evenly distributed hairs, visible pores, slight shine on the tip, realistic shadowing); lips macro, closed (natural lip texture and fine lines, slight color variation, soft edges, fine hair around the lips); natural genuine smile (teeth slightly visible, crinkles at the eye corners, lifted cheeks); open-mouth laugh showing natural slightly uneven teeth with translucent edges, gums, tongue and realistic moisture.

All skin is unretouched and natural: pores distinctly visible with subtle variation, fine vellus hair (peach fuzz), tiny bumps, natural oils, fine skin grain, soft directional sheen. Natural proportions, five fingers per hand. Consistent professional editorial photography across all panels, shallow depth of field in the portraits and macro lenses in the close-ups, subtle film grain, no plastic smoothing, no beauty filter, no HDR look. Each panel is sharp, well exposed and cleanly framed with no overlap between panels."`;
  function buildBoardPrompt() {
    const mp = ($('characterPrompt')?.value || '').trim();
    const base = mp || compileIdentityLock({ skipVoice: true });
    return BOARD_ENGINE_PRE + String(base).trim().slice(0, 1600) + BOARD_ENGINE_POST;
  }
  function refreshBoardPrompt(force) {
    const ta = $('wizBoardPrompt'); if (!ta) return;
    if (boardPromptDirty && !force) return;
    ta.value = buildBoardPrompt();
  }
  function renderBoardBox() {
    const saved = $('wizBoardSaved');
    if (saved) saved.innerHTML = currentBoardUrl
      ? '<img src="' + esc(currentBoardUrl) + '" alt="Master board tersimpan" style="width:100%;max-width:340px;border-radius:10px;border:1px solid var(--line);display:block">'
      : '';
    boardPromptDirty = false;
    refreshBoardPrompt(true);
  }
  /** Tampilkan board baru (hasil AI / unggahan eksternal) + aksi simpan/unduh. */
  function showBoardResult() {
    const out = $('wizBoardOut'); if (!out || !pendingBoard) return;
    const dataUrl = 'data:' + (pendingBoard.mime || 'image/png') + ';base64,' + pendingBoard.data;
    out.innerHTML = '<img src="' + dataUrl + '" alt="Master board baru" style="width:100%;max-width:340px;border-radius:10px;border:1px solid var(--line);display:block;margin-top:10px">'
      + '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center">'
      + (editingId ? '<button type="button" class="pink-btn" id="wizBoardSave">Simpan Master Board</button>' : '<span class="wiz-log">Board akan tersimpan saat <b>Simpan Karakter</b> ✓</span>')
      + '<a class="outline-btn" href="' + dataUrl + '" download="master-board.png" style="text-decoration:none;display:inline-flex;align-items:center">Unduh</a></div>';
    $('wizBoardSave')?.addEventListener('click', saveBoardNow);
  }
  async function saveBoardNow() {
    const sv = $('wizBoardSave'); if (!sv || !pendingBoard || !editingId) return;
    try {
      sv.disabled = true; sv.textContent = 'Menyimpan…';
      const r = await apiJson('/api/characters/' + editingId + '/board', { image: pendingBoard });
      currentBoardUrl = r.board_image_url || '';
      const log = $('wizBoardLog'); if (log) log.textContent = 'Master board tersimpan ke karakter ✓';
      window.toast?.('Master board tersimpan ✓');
      renderBoardBox();
    } catch (e) {
      sv.disabled = false; sv.textContent = 'Simpan Master Board';
      const log = $('wizBoardLog'); if (log) log.textContent = 'Gagal menyimpan: ' + (e.message || 'coba lagi.');
      window.toast?.(e.message || 'Gagal menyimpan master board.');
    }
  }

  async function runBoard() {
    const btn = $('wizBoardBtn'); const log = $('wizBoardLog');
    if (!btn) return;
    btn.disabled = true; btn.textContent = 'Membuat board…';
    if (log) log.textContent = 'Gemini menyusun sheet referensi (±15–40 detik)…';
    try {
      const prompt = ($('wizBoardPrompt')?.value || '').trim() || buildBoardPrompt();
      const engine = $('wizBoardEngine')?.value || 'kie';
      const body = { prompt, provider: engine };
      if (editingId) body.characterId = editingId;
      else if (engine === 'gemini' || engine === 'kie') {
        // Foto tahap 1 jadi basis img2img — Kie (gpt-image flare i2i) & Gemini mendukung.
        const ref = await currentPhotoParts().catch(() => null);
        if (ref) body.reference = ref;
      }
      const d = await apiJson('/api/ai/character-board', body);
      if (!d.image?.data) throw new Error('Generator tidak mengembalikan gambar.');
      pendingBoard = { mime: d.image.mime, data: d.image.data };
      showBoardResult();
      const via = 'via ' + (d.provider || 'AI') + (d.mode === 'txt2img' ? ' (teks→gambar, tanpa foto referensi)' : ' (img2img dari foto tahap 1)');
      if (log) log.textContent = 'Board jadi ✓ ' + via + ' — periksa konsistensi wajahnya.';
    } catch (e) {
      if (log) log.textContent = 'Gagal: ' + (e.message || 'generator master board gagal.') + ' Atau salin prompt-nya, generate di aplikasi lain, lalu unggah hasilnya di sini.';
      window.toast?.(e.message || 'Generator master board gagal.');
    } finally {
      btn.disabled = false; btn.textContent = 'Buat Master Board (AI)';
    }
  }

  // ---------- tahap 4: suara ----------
  function renderVoiceBox() {
    const out = $('wizVoiceOut'); if (!out) return;
    if (currentVoiceUrl && !pendingVoice) {
      out.innerHTML = '<span class="wiz-log">Sampel suara tersimpan:</span><audio controls src="' + esc(currentVoiceUrl) + '"></audio>';
    }
    if (pendingVoice) {
      const url = URL.createObjectURL(pendingVoice);
      out.innerHTML = '<span class="wiz-log">Sampel suara baru' + (editingId ? '' : ' — tersimpan saat Simpan Karakter') + ':</span><audio controls src="' + url + '"></audio>';
    }
  }
  async function runVoice() {
    const btn = $('wizVoiceBtn'); const log = $('wizVoiceLog'); const out = $('wizVoiceOut');
    if (!btn) return;
    const script = ($('wizVoiceScript')?.value || '').trim();
    if (!script) { if (log) log.textContent = 'Tulis dulu contoh naskah suaranya.'; return; }
    btn.disabled = true; btn.textContent = 'Membuat suara…';
    if (log) log.textContent = 'Gemini TTS membacakan naskah…';
    try {
      const t = (await window.sherlyGetAccessToken?.()) || '';
      const r = await fetch('/api/ai/tts', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify({ text: script, voice: $('wizVoiceName')?.value || '', style: ($('wizVoiceStyle')?.value || '').trim() }) });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || 'TTS gagal (' + r.status + ').');
      }
      const buf = await r.arrayBuffer();
      pendingVoice = new Blob([buf], { type: r.headers.get('Content-Type') || 'audio/wav' });
      voice = { name: r.headers.get('X-TTS-Voice') || $('wizVoiceName')?.value || '', style: ($('wizVoiceStyle')?.value || '').trim(), script };
      saveDraft();
      const url = URL.createObjectURL(pendingVoice);
      if (out) out.innerHTML = '<span class="wiz-log">Sampel suara baru' + (editingId ? '' : ' — tersimpan saat Simpan Karakter') + ':</span><audio controls src="' + url + '"></audio>';
      if (log) log.textContent = 'Suara jadi ✓ (voice ' + voice.name + ') — profil suara terkunci ke karakter & bible.';
      window.toast?.('Sampel suara jadi ✓');
    } catch (e) {
      if (log) log.textContent = 'Gagal: ' + (e.message || 'TTS gagal.');
      window.toast?.(e.message || 'TTS gagal.');
    } finally {
      btn.disabled = false; btn.textContent = 'Buat Sampel Suara';
    }
  }

  // ---------- tahap 5: bible ----------
  async function runBible() {
    const btn = $('wizBibleBtn'); const log = $('wizBibleLog'); const ta = $('wizBible');
    if (!btn || !ta) return;
    btn.disabled = true; btn.textContent = 'Menyusun bible…';
    if (log) log.textContent = 'AI merangkum profil, detail fisik, kunci identitas, dan suara…';
    try {
      const data = collectBasics();
      data.traits = traits;
      data.voice = voice;
      const d = await apiJson('/api/ai/character-bible', { data, provider: $('wizBibleEngine')?.value || 'auto' });
      ta.value = d.bible || '';
      bible = ta.value;
      saveDraft();
      if (log) log.textContent = 'Bible jadi ✓ — sunting bila perlu, lalu Simpan Karakter.';
      window.toast?.('Character Bible jadi ✓');
    } catch (e) {
      if (log) log.textContent = 'Gagal: ' + (e.message || 'penyusun bible gagal.');
      window.toast?.(e.message || 'Penyusun bible gagal.');
    } finally {
      btn.disabled = false; btn.textContent = 'Buat Character Bible (AI)';
    }
  }

  // ---------- API untuk index.html ----------
  window.sherlyWizardOpen = function (item) {
    editingId = item?.id || '';
    currentRefUrl = item?.reference_image_url || '';
    currentBoardUrl = item?.board_image_url || '';
    currentVoiceUrl = item?.voice_url || '';
    pendingRef = null; pendingBoard = null; pendingVoice = null;
    traits = item?.traits && typeof item.traits === 'object' ? { ...item.traits } : {};
    bible = typeof item?.bible === 'string' ? item.bible : '';
    voice = { name: '', style: '', script: '', ...(item?.voice || {}) };
    if (!editingId) {
      try {
        const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
        if (d?.traits) traits = { ...d.traits, ...traits };
        if (d?.bible && !bible) bible = d.bible;
        if (d?.voice) voice = { ...voice, ...d.voice }; // draft mengisi field yang masih kosong
        if (d?.gen) {
          gen = { ...gen, ...d.gen };
          // Migrasi draft lama (≤D-103): gen.gender pindah ke traits.gender (D-105).
          const og = String(gen.gender || '').trim();
          if (og && !traits.gender) traits.gender = ({ wanita: 'Perempuan', pria: 'Laki-laki', netral: 'Tampilan netral' }[og] || og);
          delete gen.gender;
        }
      } catch {}
    }
    // Paket impor: gambar data URL jadi pending blob (tersimpan saat Simpan Karakter).
    const pkg = item?._pkg || null;
    if (pkg) {
      pendingBoard = pkg.board ? { mime: pkg.board.split(';')[0].split(':')[1] || 'image/png', data: pkg.board.split(',')[1] } : null;
      currentBoardUrl = pkg.board || '';
      currentVoiceUrl = pkg.voice || '';
    }
    const ta = $('wizBible'); if (ta) ta.value = bible;
    const vn = $('wizVoiceName'); if (vn && voice.name) vn.value = voice.name;
    const vs = $('wizVoiceScript'); if (vs && voice.script) vs.value = voice.script;
    const vst = $('wizVoiceStyle'); if (vst && voice.style) vst.value = voice.style;
    renderTraitsGrid();
    renderGenForm();
    refreshLock();
    renderBoardBox();
    refreshBoardRef();
    refreshEngineSelects();
    setPhotoMode('upload');
    refreshPhotoPreview();
    goStep(1);
  };
  window.sherlyWizardCollect = () => {
    const cleanT = {};
    for (const k of [...TRAIT_KEYS, ...TRAIT_EXTRA]) { const v = String(traits[k] || '').trim(); if (v) cleanT[k] = v.slice(0, 300); }
    const ta = $('wizBible'); if (ta) bible = ta.value;
    voice = { name: ($('wizVoiceName')?.value || '').trim(), style: ($('wizVoiceStyle')?.value || '').trim(), script: ($('wizVoiceScript')?.value || '').trim() };
    const cleanV = {};
    for (const k of ['name', 'style', 'script']) if (voice[k]) cleanV[k] = voice[k];
    // D-108: appearance dirangkum otomatis dari detail fisik — bukan field manual lagi.
    return { traits: cleanT, appearance: ringkasAppearance(), bible: String(bible || '').slice(0, 8000), voice: cleanV };
  };
  window.sherlyWizardFiles = () => {
    const out = {};
    if (pendingRef) out.referenceImage = b64ToBlob(pendingRef.mime, pendingRef.data);
    if (pendingBoard) out.boardImage = b64ToBlob(pendingBoard.mime, pendingBoard.data);
    if (pendingVoice) out.voiceSample = pendingVoice;
    return out;
  };
  window.sherlyCardCompleteness = function (c) {
    const items = [
      ['Foto', !!c.reference_image_url],
      ['Profil', !!(c.name && c.role)],
      ['Detail fisik', Object.keys(c.traits || {}).length >= 6 || (c.appearance || '').length > 40],
      ['Master board', !!c.board_image_url],
      ['Suara', !!(c.voice_url || (c.voice && c.voice.name))],
      ['Bible', (c.bible || '').length > 40],
    ];
    const done = items.filter((x) => x[1]).length;
    const missing = items.filter((x) => !x[1]).map((x) => x[0]);
    const cls = missing.length ? 'warn' : 'ok';
    const txt = 'Lengkap ' + done + '/' + items.length + (missing.length ? ' · kurang: ' + missing.join(', ') : ' · siap produksi');
    return '<div class="wiz-complete ' + cls + '" title="' + esc(txt) + '">' + esc(txt) + '</div>';
  };

  // ---------- ekspor / impor paket ----------
  const fetchAsDataUrl = async (url) => {
    try {
      const r = await fetch(url);
      if (!r.ok) return null;
      const blob = await r.blob();
      return await new Promise((resolve) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result || ''));
        fr.onerror = () => resolve('');
        fr.readAsDataURL(blob);
      });
    } catch { return null; }
  };
  window.sherlyExportCharacter = async function (id) {
    const c = (typeof characterCache !== 'undefined' ? characterCache : []).find((x) => x.id === id);
    if (!c) return;
    window.toast?.('Menyiapkan paket karakter…');
    const images = {};
    const ref = await fetchAsDataUrl(c.reference_image_url); if (ref) images.reference = ref;
    const board = await fetchAsDataUrl(c.board_image_url); if (board) images.board = board;
    const voiceUrl = await fetchAsDataUrl(c.voice_url); if (voiceUrl) images.voice = voiceUrl;
    const pkg = {
      app: 'sherlystudio', format: PACKAGE_FORMAT, version: 1, exported_at: new Date().toISOString(),
      character: {
        name: c.name || '', role: c.role || '', age: c.age ?? null, origin: c.origin || '',
        niche: c.niche || [], language: c.language || '', platforms: c.platforms || [],
        appearance: c.appearance || '', personality: c.personality || '',
        identity_prompt: c.identity_prompt || '', is_master: !!c.is_master,
        traits: c.traits || {}, bible: c.bible || '', voice: c.voice || {}, images,
      },
    };
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'karakter-' + String(c.name || 'karakter').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.sherlystudio.json';
    a.click();
    window.toast?.('Paket karakter diekspor ✓ — bisa diimpor ke AK Talent nanti.');
  };
  async function importPackage(file) {
    if (!file) return;
    let pkg;
    try { pkg = JSON.parse(await file.text()); } catch { window.toast?.('Berkas bukan JSON yang valid.'); return; }
    const ch = pkg?.character;
    if (!ch || typeof ch !== 'object' || !(pkg.format === PACKAGE_FORMAT || ch.name)) {
      window.toast?.('Berkas bukan paket karakter SherlyStudio.');
      return;
    }
    const item = {
      name: ch.name, role: ch.role, age: ch.age, origin: ch.origin,
      niche: Array.isArray(ch.niche) ? ch.niche : [], language: ch.language,
      platforms: Array.isArray(ch.platforms) ? ch.platforms : [],
      appearance: ch.appearance, personality: ch.personality,
      identity_prompt: ch.identity_prompt, is_master: false,
      traits: ch.traits || {}, bible: ch.bible || '', voice: ch.voice || {},
      reference_image_url: ch.images?.reference || '',
      _pkg: { board: ch.images?.board || '', voice: ch.images?.voice || '' },
    };
    // Foto referensi dari paket: jadikan pending (tersimpan saat Simpan Karakter).
    if (item.reference_image_url && item.reference_image_url.startsWith('data:')) {
      pendingRefImport = item.reference_image_url;
      item.reference_image_url = '';
    }
    window.showCharacterModal?.(item);
    window.toast?.('Paket karakter dimuat ✓ — periksa tiap tahap lalu Simpan.');
  }
  let pendingRefImport = null;

  // ---------- binding statis ----------
  const bind = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', fn); };
  document.querySelectorAll('#characterModal .wiz-step').forEach((b) => b.addEventListener('click', () => goStep(b.dataset.step)));
  bind('wizNext1', () => goStep(2));
  bind('wizPrev2', () => goStep(1));
  bind('wizNext2', () => {
    // D-108: ingatkan lembut bila detail fisik masih minim (tidak memblokir — tetap bisa lanjut).
    const filled = Object.values(traits).filter((v) => String(v || '').trim()).length;
    if (filled < 3) window.toast?.('Detail fisik masih minim — klik "Analisis Foto Otomatis" atau isi manual dulu di tahap 2 biar karakter konsisten.');
    goStep(3);
  });
  bind('wizPrev3', () => goStep(2));
  bind('wizNext3', () => goStep(4));
  bind('wizPrev4', () => goStep(3));
  bind('wizNext4', () => goStep(5));
  bind('wizPrev5', () => goStep(4));
  bind('wizModeUpload', () => setPhotoMode('upload'));
  bind('wizModeGen', () => setPhotoMode('gen'));
  bind('wizGenFaceBtn', runGenFace);
  bind('wizCopyFacePrompt', async () => {
    const p = ($('wizGenPrompt')?.value || '').trim() || buildFacePrompt();
    try { await navigator.clipboard.writeText(p); window.toast?.('Prompt tersalin ✓ — tempel di aplikasi gambar favoritmu.'); }
    catch { window.toast?.('Gagal menyalin — salin manual dari kotak prompt.'); }
  });
  // Dropdown preset (klik-klik cepat ala AK Talent) — opsi diisi dari GEN_DROPDOWNS.
  for (const cfg of GEN_DROPDOWNS) initGenDropdown(cfg);
  const GEN_STATE_IDS = { wizGenLook: 'look', wizGenLight: 'light', wizGenNotes: 'notes', wizGenLang: 'lang' };
  for (const [id, key] of Object.entries(GEN_STATE_IDS)) {
    const isText = id === 'wizGenNotes';
    $(id)?.addEventListener(isText ? 'input' : 'change', () => {
      gen[key] = $(id).value;
      if (key === 'lang') genPromptDirty = false; // ganti bahasa = susun ulang
      refreshGenPrompt();
      saveDraft();
    });
  }
  $('wizGenPrompt')?.addEventListener('input', () => { genPromptDirty = true; });
  bind('wizGenRebuild', () => { genPromptDirty = false; refreshGenPrompt(true); window.toast?.('Prompt disusun ulang dari form ✓'); });
  // Hasil generate dari aplikasi luar: unggah di mode Buat Karakter, tetap lanjut ke tahap 2 dst.
  bind('wizGenUploadBtn', () => $('wizGenUploadFile')?.click());
  $('wizGenUploadFile')?.addEventListener('change', async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    const log = $('wizGenLog');
    if (!/^image\/(png|jpe?g|webp)$/i.test(f.type)) { window.toast?.('Format harus PNG, JPG, atau WebP.'); return; }
    if (f.size > 8 * 1024 * 1024) { window.toast?.('Ukuran maksimal 8 MB.'); return; }
    try {
      if (log) log.textContent = 'Membaca berkas…';
      pendingRef = await blobToResizedBase64(f);
      currentRefUrl = '';
      const ci = $('characterImage'); if (ci) ci.value = '';
      refreshPhotoPreview();
      if (log) log.textContent = 'Hasil dari aplikasi lain terunggah ✓ — lanjut ke tahap 2 (analisis fisik) atau langsung Simpan Karakter.';
      window.toast?.('Foto hasil eksternal dipakai ✓');
    } catch (err) {
      if (log) log.textContent = 'Gagal membaca berkas.';
      window.toast?.(err.message || 'Gagal membaca berkas.');
    }
  });
  // Hasil board dari aplikasi luar: unggah langsung di tahap 3 (generate di Kie/Leonardo dll.).
  bind('wizBoardBtn', runBoard);
  bind('wizBoardCopy', async () => {
    const p = ($('wizBoardPrompt')?.value || '').trim() || buildBoardPrompt();
    try { await navigator.clipboard.writeText(p); window.toast?.('Prompt board tersalin ✓ — tempel di aplikasi gambar favoritmu.'); }
    catch { window.toast?.('Gagal menyalin — salin manual dari kotak prompt.'); }
  });
  bind('wizBoardRebuild', () => { boardPromptDirty = false; refreshBoardPrompt(true); window.toast?.('Prompt board disusun ulang ✓'); });
  $('wizBoardPrompt')?.addEventListener('input', () => { boardPromptDirty = true; });
  bind('wizBoardUploadBtn', () => $('wizBoardUploadFile')?.click());
  $('wizBoardUploadFile')?.addEventListener('change', async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    const log = $('wizBoardLog');
    if (!/^image\/(png|jpe?g|webp)$/i.test(f.type)) { window.toast?.('Format harus PNG, JPG, atau WebP.'); return; }
    if (f.size > 8 * 1024 * 1024) { window.toast?.('Ukuran maksimal 8 MB.'); return; }
    try {
      if (log) log.textContent = 'Membaca berkas…';
      pendingBoard = await blobToResizedBase64(f, 1600);
      showBoardResult();
      if (log) log.textContent = 'Board dari aplikasi lain terunggah ✓' + (editingId ? ' — klik Simpan Master Board.' : ' — akan tersimpan saat Simpan Karakter.');
      window.toast?.('Master board terunggah ✓');
    } catch (err) {
      if (log) log.textContent = 'Gagal membaca berkas.';
      window.toast?.(err.message || 'Gagal membaca berkas.');
    }
  });
  // Provider kustom dari Pengaturan jadi pilihan mesin gambar (wajah & board), seperti di Studio.
  let customProviders = null;
  async function loadCustomProviders() {
    if (customProviders) return customProviders;
    try {
      const t = (await window.sherlyGetAccessToken?.()) || '';
      const r = await fetch('/api/custom-providers', { headers: t ? { Authorization: 'Bearer ' + t } : {} });
      if (!r.ok) return []; // jangan cache kegagalan — coba lagi saat wizard dibuka
      const d = await r.json().catch(() => ({}));
      customProviders = Array.isArray(d?.providers) ? d.providers : [];
    } catch { return []; }
    return customProviders;
  }
  async function refreshEngineSelects() {
    const customs = await loadCustomProviders();
    if (!customs.length) return;
    const mk = (c, suffix) => '<option value="custom:' + esc(c.id) + '">' + esc('Kustom: ' + String(c.name || 'Provider') + suffix) + '</option>';
    const face = $('wizGenEngine');
    if (face && !face.innerHTML.includes('custom:')) face.insertAdjacentHTML('beforeend', customs.map((c) => mk(c, '')).join(''));
    const board = $('wizBoardEngine');
    if (board && !board.innerHTML.includes('custom:')) board.insertAdjacentHTML('beforeend', customs.map((c) => mk(c, ' — tanpa foto')).join(''));
  }
  refreshEngineSelects();
  bind('wizAnalyzeBtn', runAnalysis);
  bind('wizLockRefresh', () => { refreshLock(); window.toast?.('Kunci identitas disusun ulang dari detail.'); });
  bind('wizLockApply', () => {
    const ta = $('characterPrompt');
    if (!ta) return;
    ta.value = compileIdentityLock();
    refreshBoardPrompt();
    window.toast?.('Kunci identitas dipakai sebagai Master Prompt ✓');
  });
  bind('wizVoiceBtn', runVoice);
  bind('wizBibleBtn', runBible);
  $('characterImage')?.addEventListener('change', refreshPhotoPreview);
  ['characterName', 'characterRole', 'characterAge', 'characterOrigin', 'characterPersonality', 'characterLanguage', 'characterPrompt'].forEach((id) => {
    const el = $(id); if (!el) return;
    const fn = () => { refreshLock(); refreshGenPrompt(); refreshBoardPrompt(); };
    el.addEventListener('input', fn);
    el.addEventListener('change', fn);
  });
  $('importCharBtn')?.addEventListener('click', () => $('importCharFile')?.click());
  $('importCharFile')?.addEventListener('change', (e) => { const f = e.target.files?.[0]; e.target.value = ''; importPackage(f); });

  // Paket impor dengan foto data URL: konversi ke pending sesudah wizard dibuka.
  const origOpen = window.sherlyWizardOpen;
  window.sherlyWizardOpen = function (item) {
    origOpen(item);
    if (pendingRefImport) {
      const dataUrl = pendingRefImport; pendingRefImport = null;
      pendingRef = { mime: dataUrl.split(';')[0].split(':')[1] || 'image/png', data: dataUrl.split(',')[1] };
      currentRefUrl = '';
      refreshPhotoPreview();
    }
  };
})();
