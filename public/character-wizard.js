// ===== Karakter Wizard v2 — analisis foto (vision), kunci identitas, master board =====
// Adopsi pola wizard AK Talent untuk modal karakter SherlyStudio.
// Dipanggil dari index.html:
//   window.sherlyWizardOpen(item)  — saat modal karakter dibuka (render grid traits, board, langkah)
//   window.sherlyWizardCollect()   — saat simpan (kembalikan {traits})
//   window.sherlyWizardClear()     — hapus draft lokal setelah tersimpan
//   window.sherlyCardCompleteness(c) — baris "Lengkap x/5" untuk kartu galeri karakter
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
  let traits = {};
  let editingId = '';
  let currentRefUrl = '';
  let currentBoardUrl = '';
  let lastBoard = null; // { mime, data } hasil generate terakhir (belum disimpan)
  let draftTimer = null;

  const apiJson = async (url, body) => {
    const t = (await window.sherlyGetAccessToken?.()) || '';
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Request gagal (' + r.status + ')');
    return d;
  };

  // ---------- util gambar ----------
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
  async function currentPhotoBase64() {
    const file = $('characterImage')?.files?.[0];
    if (file) return await blobToResizedBase64(file);
    if (currentRefUrl) {
      const r = await fetch(currentRefUrl);
      if (!r.ok) throw new Error('Gagal membaca foto referensi tersimpan.');
      return await blobToResizedBase64(await r.blob());
    }
    return null;
  }

  // ---------- draft ----------
  function saveDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      try {
        const clean = {};
        for (const [k] of TRAIT_FIELDS) { const v = String(traits[k] || '').trim(); if (v) clean[k] = v; }
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ traits: clean }));
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
      // Input di pane tersembunyi di-disable agar validasi form tidak nyangkut di field tak terlihat.
      p.querySelectorAll('input,textarea,select,button').forEach((el) => { el.disabled = !on; });
    });
  }

  // ---------- traits grid ----------
  function renderTraitsGrid() {
    const grid = $('traitsGrid'); if (!grid) return;
    grid.innerHTML = TRAIT_FIELDS.map(([k, label]) =>
      '<div class="trait-field"><label>' + esc(label) + '</label><textarea data-trait="' + k + '" rows="1" placeholder="…">' + esc(traits[k] || '') + '</textarea></div>'
    ).join('');
    grid.querySelectorAll('[data-trait]').forEach((t) => {
      t.addEventListener('input', () => { traits[t.dataset.trait] = t.value; saveDraft(); refreshLock(); });
    });
  }

  function collectBasics() {
    return {
      name: ($('characterName')?.value || '').trim(),
      role: ($('characterRole')?.value || '').trim(),
      age: $('characterAge')?.value || '',
      origin: ($('characterOrigin')?.value || '').trim(),
      appearance: $('characterAppearance')?.value || '',
      personality: $('characterPersonality')?.value || '',
    };
  }

  // ---------- kunci identitas ----------
  function compileIdentityLock() {
    const b = collectBasics();
    const t = traits;
    const join = (a, bb) => [a, bb].filter((x) => String(x || '').trim()).join(' — ');
    const line = (label, v) => (String(v || '').trim() ? label + ': ' + String(v).trim() + '. ' : '');
    let s = 'IDENTITY LOCK — karakter ' + (b.name || 'ini') + (b.age ? ', usia visual ' + b.age + ' tahun' : '') + (b.origin ? ', asal ' + b.origin : '') + (b.role ? ', peran ' + b.role : '') + '. ';
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
    s += line('Aksesoris', t.accessories);
    s += line('Tekstur kulit', t.skinTexture || 'pori-pori halus terlihat natural, tekstur kulit nyata, tanpa efek beauty filter berlebihan');
    s += 'Pertahankan wajah, rambut, kulit, dan proporsi tubuh ini persis sama di semua konten — jangan berubah menjadi orang lain. Foto realistis, anatomi wajar, pencahayaan konsisten.';
    if (b.appearance.trim()) s += '\nPenampilan umum: ' + b.appearance.trim();
    if (b.personality.trim()) s += '\nKepribadian: ' + b.personality.trim();
    return s;
  }
  function refreshLock() {
    const el = $('wizLockPreview'); if (el) el.textContent = compileIdentityLock();
  }

  // ---------- analisis foto ----------
  async function runAnalysis() {
    const btn = $('wizAnalyzeBtn'); const log = $('wizAnalyzeLog');
    if (!btn) return;
    let photo = null;
    btn.disabled = true; btn.textContent = 'Menganalisis…';
    if (log) log.textContent = 'Menyiapkan foto…';
    try {
      photo = await currentPhotoBase64();
      if (!photo) {
        if (log) log.textContent = 'Unggah foto wajah dulu di langkah 1 (atau pakai foto referensi karakter tersimpan).';
        return;
      }
      if (log) log.textContent = 'Menganalisis foto dengan AI vision…';
      const d = await apiJson('/api/ai/vision', { image: photo });
      traits = Object.assign({}, traits, d.traits || {});
      renderTraitsGrid(); refreshLock(); saveDraft();
      if (log) log.textContent = 'Analisis selesai ✓ — ' + Object.keys(d.traits || {}).length + ' detail terisi. Periksa & sunting sesukamu.';
      window.toast?.('Analisis foto selesai ✓');
    } catch (e) {
      if (log) log.textContent = 'Gagal: ' + (e.message || 'analisis foto gagal.');
      window.toast?.(e.message || 'Analisis foto gagal.');
    } finally {
      btn.disabled = false; btn.textContent = 'Analisis Foto Otomatis';
    }
  }

  // ---------- master board ----------
  function renderBoardBox() {
    const box = $('wizBoardBox'); if (!box) return;
    if (!editingId) {
      box.innerHTML = '<div class="wiz-log">Simpan karakter dulu (tombol Simpan Karakter), lalu buka lagi Edit untuk membuat Master Board — sheet referensi 3 panel dari foto wajah + kunci identitas.</div>';
      return;
    }
    let html = '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'
      + '<button type="button" class="pink-btn" id="wizBoardBtn">Buat Master Board</button>'
      + (currentBoardUrl ? '<span class="wiz-log">Board tersimpan ✓ — buat ulang bila perlu.</span>' : '<span class="wiz-log">Sheet 3 panel (full body · potret · macro) via Gemini + foto referensi.</span>')
      + '</div><span class="wiz-log" id="wizBoardLog"></span><div id="wizBoardOut"></div>';
    if (currentBoardUrl) html += '<img src="' + esc(currentBoardUrl) + '" alt="Master board" style="width:100%;max-width:340px;border-radius:10px;border:1px solid var(--line);display:block;margin-top:10px">';
    box.innerHTML = html;
    $('wizBoardBtn')?.addEventListener('click', runBoard);
  }

  async function runBoard() {
    const btn = $('wizBoardBtn'); const log = $('wizBoardLog'); const out = $('wizBoardOut');
    if (!btn) return;
    btn.disabled = true; btn.textContent = 'Membuat board…';
    if (log) log.textContent = 'Gemini sedang menyusun sheet referensi (±15–40 detik)…';
    try {
      const d = await apiJson('/api/ai/character-board', { characterId: editingId });
      lastBoard = d.image || null;
      if (!lastBoard) throw new Error('Generator tidak mengembalikan gambar.');
      const dataUrl = 'data:' + (lastBoard.mime || 'image/png') + ';base64,' + lastBoard.data;
      if (out) out.innerHTML = '<img src="' + dataUrl + '" alt="Master board baru" style="width:100%;max-width:340px;border-radius:10px;border:1px solid var(--line);display:block;margin-top:10px">'
        + '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><button type="button" class="pink-btn" id="wizBoardSave">Simpan Master Board</button>'
        + '<a class="outline-btn" href="' + dataUrl + '" download="master-board-' + esc(editingId.slice(0, 8)) + '.png" style="text-decoration:none;display:inline-flex;align-items:center">Unduh</a></div>';
      if (log) log.textContent = 'Board jadi ✓ — periksa konsistensi wajahnya, lalu simpan.';
      $('wizBoardSave')?.addEventListener('click', async () => {
        const sv = $('wizBoardSave');
        try {
          sv.disabled = true; sv.textContent = 'Menyimpan…';
          const r = await apiJson('/api/characters/' + editingId + '/board', { image: lastBoard });
          currentBoardUrl = r.board_image_url || '';
          if (log) log.textContent = 'Master board tersimpan ke karakter ✓';
          window.toast?.('Master board tersimpan ✓');
          renderBoardBox();
        } catch (e) {
          sv.disabled = false; sv.textContent = 'Simpan Master Board';
          if (log) log.textContent = 'Gagal menyimpan: ' + (e.message || 'coba lagi.');
          window.toast?.(e.message || 'Gagal menyimpan master board.');
        }
      });
    } catch (e) {
      if (log) log.textContent = 'Gagal: ' + (e.message || 'generator master board gagal.');
      window.toast?.(e.message || 'Generator master board gagal.');
    } finally {
      btn.disabled = false; btn.textContent = 'Buat Master Board';
    }
  }

  // ---------- API untuk index.html ----------
  window.sherlyWizardOpen = function (item) {
    editingId = item?.id || '';
    currentRefUrl = item?.reference_image_url || '';
    currentBoardUrl = item?.board_image_url || '';
    lastBoard = null;
    traits = {};
    if (item?.traits && typeof item.traits === 'object') traits = { ...item.traits };
    if (!editingId) {
      try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); if (d?.traits) traits = { ...d.traits, ...traits }; } catch {}
    }
    renderTraitsGrid();
    refreshLock();
    renderBoardBox();
    goStep(1);
  };
  window.sherlyWizardCollect = () => {
    const clean = {};
    for (const [k] of TRAIT_FIELDS) { const v = String(traits[k] || '').trim(); if (v) clean[k] = v.slice(0, 300); }
    return clean;
  };
  window.sherlyCardCompleteness = function (c) {
    const items = [
      ['Foto', !!c.reference_image_url],
      ['Profil', !!(c.name && c.role)],
      ['Detail fisik', Object.keys(c.traits || {}).length >= 10 || (c.appearance || '').length > 40],
      ['Kunci identitas', (c.identity_prompt || '').length >= 100],
      ['Master board', !!c.board_image_url],
    ];
    const done = items.filter((x) => x[1]).length;
    const missing = items.filter((x) => !x[1]).map((x) => x[0]);
    const cls = missing.length ? 'warn' : 'ok';
    const txt = 'Lengkap ' + done + '/' + items.length + (missing.length ? ' · kurang: ' + missing.join(', ') : ' · siap produksi');
    return '<div class="wiz-complete ' + cls + '" title="' + esc(txt) + '">' + esc(txt) + '</div>';
  };

  // ---------- binding statis (sekali, saat file dimuat) ----------
  const bind = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', fn); };
  document.querySelectorAll('#characterModal .wiz-step').forEach((b) => b.addEventListener('click', () => goStep(b.dataset.step)));
  bind('wizNext1', () => goStep(2));
  bind('wizPrev2', () => goStep(1));
  bind('wizNext2', () => goStep(3));
  bind('wizPrev3', () => goStep(2));
  bind('wizAnalyzeBtn', runAnalysis);
  bind('wizLockRefresh', () => { refreshLock(); window.toast?.('Kunci identitas disusun ulang dari detail.'); });
  bind('wizLockApply', () => {
    const ta = $('characterPrompt');
    if (!ta) return;
    ta.value = compileIdentityLock();
    window.toast?.('Kunci identitas dipakai sebagai Master Prompt ✓');
  });
  ['characterName', 'characterRole', 'characterAge', 'characterOrigin', 'characterAppearance', 'characterPersonality'].forEach((id) => {
    $(id)?.addEventListener('input', refreshLock);
  });
})();
