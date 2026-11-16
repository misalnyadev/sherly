// Profil Pengguna — identitas & kontak kerja sama.
// Sumber utama: database Supabase (user_profiles, RLS per-akun) — sinkron lintas perangkat.
// localStorage 'sherly.profile.v1' dipakai sebagai cache lokal/fallback bila DB belum dimigrasi.
// Chat Sherly membaca profil langsung dari DB di server. Global dari inline script:
// toast, go, sherlyReadProfile, sherlyWriteProfile, sherlyGetAccessToken.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DEFAULT_AVATAR = {};
  const POSITIONS = [{ v: '50% 12%', label: 'atas' }, { v: '50% 42%', label: 'tengah' }, { v: '50% 72%', label: 'bawah' }];

  function readForm() {
    return {
      fullName: $('pfFullName').value.trim(),
      displayName: $('pfDisplayName').value.trim(),
      gender: $('pfGender').value,
      accountType: $('pfAccountType').value,
      role: $('pfRole').value.trim(),
      company: $('pfCompany').value.trim(),
      bio: $('pfBio').value.trim(),
      email: $('pfEmail').value.trim(),
      phone: $('pfPhone').value.trim(),
      location: $('pfLocation').value.trim(),
      website: $('pfWebsite').value.trim(),
      primaryContact: $('pfPrimaryContact').value,
      photo: window.__pfPhoto ?? null,
      photoPosition: window.__pfPosition || POSITIONS[0].v,
    };
  }

  function writeForm(p) {
    const set = (id, v) => { const el = $(id); if (el) el.value = v || ''; };
    set('pfFullName', p.fullName); set('pfDisplayName', p.displayName); set('pfGender', p.gender);
    if (p.accountType) $('pfAccountType').value = p.accountType;
    set('pfRole', p.role); set('pfCompany', p.company); set('pfBio', p.bio);
    set('pfEmail', p.email); set('pfPhone', p.phone); set('pfLocation', p.location); set('pfWebsite', p.website);
    if (p.primaryContact) $('pfPrimaryContact').value = p.primaryContact;
    window.__pfPhoto = p.photo || null;
    window.__pfPosition = p.photoPosition || POSITIONS[0].v;
    renderAvatar();
  }

  function renderAvatar() {
    const img = $('pfAvatar');
    if (img) {
      if (window.__pfPhoto) { img.src = window.__pfPhoto; img.style.objectPosition = window.__pfPosition; img.style.display = 'block'; }
      else if (DEFAULT_AVATAR.main) { img.src = DEFAULT_AVATAR.main; img.style.objectPosition = '50% 12%'; }
    }
    // topbar / dropdown avatars
    document.querySelectorAll('.topbar .owner img.avatar').forEach((el) => {
      if (window.__pfPhoto) { if (!DEFAULT_AVATAR.el) DEFAULT_AVATAR.el = el.getAttribute('src'); el.src = window.__pfPhoto; el.style.objectPosition = window.__pfPosition; }
      else if (DEFAULT_AVATAR.el) { el.src = DEFAULT_AVATAR.el; }
    });
    // tab "Profil" di navbar kapsul HP: foto bulat profil user
    document.querySelectorAll('.mobile-tabbar .tab-avatar').forEach((el) => {
      const img = el.querySelector('img'), ico = el.querySelector('[data-icon]');
      if (!img) return;
      if (window.__pfPhoto) { img.src = window.__pfPhoto; img.style.objectPosition = window.__pfPosition; img.hidden = false; if (ico) ico.style.display = 'none'; }
      else if (DEFAULT_AVATAR.main) { img.src = DEFAULT_AVATAR.main; img.style.objectPosition = '50% 12%'; img.hidden = false; if (ico) ico.style.display = 'none'; }
      else { img.hidden = true; if (ico) ico.style.display = ''; }
    });
  }

  function applyProfileUI() {
    const p = window.sherlyReadProfile?.() || {};
    const user = window.sherlyUser || null;
    const name = p.displayName || p.fullName || user?.display_name || user?.email?.split('@')[0] || null;
    const owner = document.querySelector('.topbar .owner');
    const b = owner?.querySelector('b');
    const small = owner?.querySelector('small');
    if (b) { if (name) b.textContent = name; else b.textContent = user ? 'Pengguna' : 'Tamu'; }
    if (small) {
      if (user) {
        const sub = [p.accountType, p.role].filter(Boolean).join(' · ').toUpperCase();
        small.textContent = sub || (user.role === 'admin' ? 'ADMIN' : user.role === 'member' ? 'KLIEN · SHERLYSTUDIO' : 'TAMU · SHERLYSTUDIO');
      } else small.textContent = 'LOGIN · SHERLYSTUDIO';
    }
    owner?.classList.toggle('is-guest', !user);
    // D-116: badge tier di halaman profil — status yang dikenali Sherly saat chat (server-side).
    ['pfTierBadge', 'pcTierBadge'].forEach((id) => {
      const tb = $(id);
      if (!tb) return;
      const r = user?.role || 'guest';
      const t = r === 'admin' ? { c: 'owner', l: 'OWNER', d: 'Sherly mengenalimu: pemilik SherlyStudio — partner satu tim' }
        : r === 'member' ? { c: 'member', l: 'KLIEN', d: 'Sherly mengenalimu: klien terdaftar SherlyStudio' }
        : { c: 'guest', l: 'TAMU', d: 'Sherly mengenalimu: tamu (buku tamu) — belum punya akun klien' };
      tb.hidden = false; tb.className = 'ss-tier-badge ' + t.c; tb.textContent = t.l; tb.title = t.d;
    });
    renderAvatar();
  }

  window.sherlyApplyProfile = applyProfileUI;
  // D-120: profil ringkas khusus klien/tamu — sumbernya metadata akun (bukan user_profiles admin).
  window.sherlyApplyTierProfile = function () {
    const user = window.sherlyUser || null;
    const grid = $('pfClientGrid');
    if (!grid || !user) return;
    const role = user.role || 'guest';
    if (role === 'admin') return; // admin memakai grid profil penuh
    const set = (id, v) => { const el = $(id); if (el) el.value = v || ''; };
    set('pcFullName', user.full_name); set('pcNickname', user.nickname);
    set('pcGender', (user.gender === 'pria' || user.gender === 'wanita') ? user.gender : '');
    set('pcContact', user.contact); set('pcEmail', user.email);
    const cta = $('pcGuestCta'); if (cta) cta.hidden = role !== 'guest';
  };
  // D-119: bersihkan jejak profil akun sebelumnya — dipanggil saat logout / ganti akun.
  window.sherlyResetLocalProfile = function () {
    window.sherlyRemoveProfile?.();
    window.__pfPhoto = null;
    window.__pfPosition = POSITIONS[0].v;
    applyProfileUI();
  };
  // DB <-> form mapping (snake_case <-> camelCase)
  const dbToForm = (r) => ({
    fullName: r.full_name || '', displayName: r.display_name || '', gender: r.gender || '', accountType: r.account_type || 'Kreator',
    role: r.role || '', company: r.company || '', bio: r.bio || '',
    email: r.email || '', phone: r.phone || '', location: r.location || '', website: r.website || '',
    primaryContact: r.primary_contact || 'WhatsApp', photo: r.photo || null, photoPosition: r.photo_position || POSITIONS[0].v,
  });
  const formToDb = (p) => ({
    full_name: p.fullName || '', display_name: p.displayName || '', gender: p.gender || '', account_type: p.accountType || 'Kreator',
    role: p.role || '', company: p.company || '', bio: p.bio || '',
    email: p.email || '', phone: p.phone || '', location: p.location || '', website: p.website || '',
    primary_contact: p.primaryContact || 'WhatsApp', photo: p.photo || '', photo_position: p.photoPosition || POSITIONS[0].v,
  });
  const hasContent = (p) => p && ['fullName','displayName','role','company','bio','photo','phone','location','website'].some((k) => p[k]);

  async function putProfile(p) {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: await (async () => { const h = { 'Content-Type': 'application/json' }; const t = await window.sherlyGetAccessToken?.(); if (t) h.Authorization = 'Bearer ' + t; return h; })(),
      body: JSON.stringify(formToDb(p)),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ('Gagal menyimpan profil (' + res.status + ')'));
    return data.profile;
  }

  window.loadProfile = async function loadProfile() {
    const local = window.sherlyReadProfile?.() || null;
    const user = window.sherlyUser || null;
    try {
      const res = await fetch('/api/profile', { headers: await (async () => { const h = {}; const t = await window.sherlyGetAccessToken?.(); if (t) h.Authorization = 'Bearer ' + t; return h; })() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || ('Gagal memuat profil (' + res.status + ')'));
      if (data.profile) {
        const p = dbToForm(data.profile);
        window.sherlyWriteProfile(p);
        writeForm(p);
      } else {
        if (data.warning) window.toast?.(data.warning);
        if (!data.warning && hasContent(local)) {
          try { await putProfile(local); window.toast?.('Profil tersimpan ke database akun Anda — tersedia di perangkat mana pun saat login.'); } catch (e) { /* biarkan lokal */ }
          writeForm(local);
        } else if (local) {
          writeForm(local);
        } else {
          writeForm({ email: user?.email || '', accountType: 'Kreator', primaryContact: 'WhatsApp' });
        }
      }
    } catch (e) {
      window.toast?.('Gagal memuat profil dari server — memakai data lokal browser. (' + e.message + ')');
      if (local) writeForm(local); else writeForm({ email: user?.email || '', accountType: 'Kreator', primaryContact: 'WhatsApp' });
    }
    applyProfileUI();
  };

  function resizeImage(file, maxSize, cb) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      cb(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); window.toast?.('Gagal membaca gambar.'); };
    img.src = url;
  }

  function init() {
    // capture defaults for avatar restore
    const img = $('pfAvatar');
    if (img && !DEFAULT_AVATAR.main) { img.src = document.querySelector('.topbar .owner img.avatar')?.getAttribute('src') || ''; DEFAULT_AVATAR.main = img.src; }

    $('pfSaveBtn')?.addEventListener('click', async () => {
      const btn = $('pfSaveBtn');
      const p = readForm();
      window.sherlyWriteProfile?.(p); // cache lokal selalu
      btn.disabled = true;
      try {
        await putProfile(p);
        try {
          const sr = await fetch('/api/admin/settings', { method: 'PUT', headers: await (async () => { const h = { 'Content-Type': 'application/json' }; const t = await window.sherlyGetAccessToken?.(); if (t) h.Authorization = 'Bearer ' + t; return h; })(), body: JSON.stringify({ whatsapp: p.phone || '' }) });
          if (sr.ok) window.toast?.('Nomor WhatsApp studio tersinkron — brief klien di Kolaborasi kini memakai nomor ini.');
        } catch {}
        window.toast?.('Profil tersimpan di database — Chat Sherly membacanya, dan tetap sama di perangkat lain saat login.');
      } catch (e) {
        window.toast?.('Profil tersimpan di browser ini. Sinkron database gagal: ' + e.message);
      } finally {
        btn.disabled = false;
        applyProfileUI();
      }
    });
    $('pfChangePhotoBtn')?.addEventListener('click', () => $('pfPhotoInput')?.click());
    $('pfPhotoInput')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      resizeImage(file, 512, (dataUrl) => { window.__pfPhoto = dataUrl; window.__pfPosition = POSITIONS[0].v; renderAvatar(); window.toast?.('Foto dimuat — klik Simpan Profil untuk menyimpan.'); });
      e.target.value = '';
    });
    $('pfArrangePhotoBtn')?.addEventListener('click', () => {
      const cur = POSITIONS.findIndex((x) => x.v === window.__pfPosition);
      const next = POSITIONS[(cur + 1) % POSITIONS.length];
      window.__pfPosition = next.v;
      renderAvatar();
      window.toast?.('Posisi foto: ' + next.label + ' — klik Simpan Profil untuk menyimpan.');
    });
    $('pfRemovePhotoBtn')?.addEventListener('click', () => {
      window.__pfPhoto = null;
      window.__pfPosition = POSITIONS[0].v;
      const saved = window.sherlyReadProfile?.();
      if (saved) {
        saved.photo = null; saved.photoPosition = POSITIONS[0].v;
        window.sherlyWriteProfile?.(saved);
        putProfile(saved).catch(() => {}); // sinkron DB seadanya; kegagalan tidak fatal
      }
      renderAvatar();
      window.toast?.('Foto profil dihapus.');
    });
    $('pfOpenProvidersBtn')?.addEventListener('click', () => window.go?.('Pengaturan'));
    // D-120: aksi profil klien/tamu
    $('pcLogoutBtn')?.addEventListener('click', () => window.sherlyLogout?.());
    $('pcUpgradeBtn')?.addEventListener('click', () => window.sherlyOpenRegister?.());
    $('pcSaveBtn')?.addEventListener('click', async () => {
      const btn = $('pcSaveBtn');
      const body = { full_name: $('pcFullName')?.value.trim() || '', nickname: $('pcNickname')?.value.trim() || '', gender: $('pcGender')?.value || '', contact: $('pcContact')?.value.trim() || '' };
      if (!body.full_name) { window.toast?.('Nama lengkap wajib diisi ya.'); return; }
      btn.disabled = true;
      try {
        const h = { 'Content-Type': 'application/json' };
        const t = await window.sherlyGetAccessToken?.(); if (t) h.Authorization = 'Bearer ' + t;
        const res = await fetch('/api/account', { method: 'PUT', headers: h, body: JSON.stringify(body) });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || ('Gagal menyimpan (' + res.status + ')'));
        const s = window.sherlyStoredToken?.();
        window.sherlySetAuthSession?.({ access_token: s?.access_token || null, refresh_token: s?.refresh_token || null, expires_at: s?.expires_at || null, user: d.user || null });
        window.sherlyApplyProfile?.();
        window.sherlyApplyTierProfile?.();
        window.toast?.('Tersimpan — Sherly sekarang tahu cara menyapamu dengan benar.');
      } catch (e) { window.toast?.(e.message); }
      finally { btn.disabled = false; }
    });
    // D-142: kunci AI pribadi (BYOK) — tamu & klien mengisi API key sendiri.
    const PC_KEY_PROVIDERS = { gemini: 'Gemini', groq: 'Groq', openrouter: 'OpenRouter', custom: 'Kustom' };
    async function loadPcKeys() {
      const list = $('pcKeysList'); if (!list) return;
      const role = window.sherlyUser?.role || 'guest';
      if (!window.sherlyStoredToken?.() || role === 'admin') { list.innerHTML = ''; return; }
      let keys = null;
      try {
        const h = {}; const t = await window.sherlyGetAccessToken?.(); if (t) h.Authorization = 'Bearer ' + t;
        const res = await fetch('/api/my/keys', { headers: h });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || ('Gagal memuat kunci (' + res.status + ')'));
        keys = Array.isArray(d.keys) ? d.keys : [];
      } catch (e) { list.innerHTML = '<p class="mykey-empty">Kunci AI belum bisa dimuat: ' + esc(e.message) + '</p>'; return; }
      if (!keys.length) { list.innerHTML = '<p class="mykey-empty">Belum ada kunci tersimpan. Isi form di bawah — key gratis dari Google AI Studio (Gemini) atau Groq sudah cukup untuk mulai mengobrol dengan Sherly.</p>'; return; }
      list.innerHTML = keys.map((k) => (
        '<div class="mykey-row"><div class="mykey-meta"><b>' + (PC_KEY_PROVIDERS[k.provider] || esc(k.provider)) + '</b><small>•••• ' + esc(k.last4 || '????') + (k.provider === 'custom' ? ' · ' + esc(k.model || '') + ' · ' + esc(k.base_url || '') : '') + '</small></div><button type="button" class="mykey-del" data-key-id="' + esc(k.id) + '">Hapus</button></div>'
      )).join('');
    }
    $('pcKeysList')?.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('.mykey-del'); if (!btn) return;
      const id = btn.getAttribute('data-key-id'); if (!id || btn.disabled) return;
      btn.disabled = true;
      try {
        const h = {}; const t = await window.sherlyGetAccessToken?.(); if (t) h.Authorization = 'Bearer ' + t;
        const res = await fetch('/api/my/keys/' + encodeURIComponent(id), { method: 'DELETE', headers: h });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || 'Gagal menghapus kunci.');
        window.toast?.('Kunci dihapus.');
        await loadPcKeys();
      } catch (e) { btn.disabled = false; window.toast?.(e.message); }
    });
    $('pcKeyProvider')?.addEventListener('change', () => {
      const custom = $('pcKeyProvider')?.value === 'custom';
      const base = $('pcKeyCustomBase'); if (base) base.hidden = !custom;
      const model = $('pcKeyCustomModel'); if (model) model.hidden = !custom;
    });
    $('pcKeyForm')?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const btn = $('pcKeySaveBtn'); if (!btn || btn.disabled) return;
      const provider = $('pcKeyProvider')?.value || '';
      const api_key = $('pcKeySecret')?.value.trim() || '';
      const base_url = $('pcKeyBaseUrl')?.value.trim() || '';
      const model = $('pcKeyModel')?.value.trim() || '';
      if (!api_key) { window.toast?.('API key wajib diisi.'); return; }
      if (provider === 'custom' && !base_url) { window.toast?.('Base URL wajib diisi untuk provider kustom.'); return; }
      if (provider === 'custom' && !model) { window.toast?.('Nama model wajib diisi untuk provider kustom.'); return; }
      btn.disabled = true; btn.textContent = 'Menyimpan & mengetes…';
      try {
        const h = { 'Content-Type': 'application/json' };
        const t = await window.sherlyGetAccessToken?.(); if (t) h.Authorization = 'Bearer ' + t;
        const res = await fetch('/api/my/keys', { method: 'POST', headers: h, body: JSON.stringify({ provider, api_key, base_url, model }) });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || ('Gagal menyimpan (' + res.status + ')'));
        if ($('pcKeySecret')) $('pcKeySecret').value = '';
        window.toast?.('Kunci tersimpan & terverifikasi — sekarang kamu bisa chat dengan Sherly.');
        await loadPcKeys();
      } catch (e) { window.toast?.(e.message); }
      finally { btn.disabled = false; btn.textContent = 'Simpan & Tes Key'; }
    });

    // D-143: pintasan ke halaman Pengaturan member & modal suara Sherly.
    $('pcSettingsBtn')?.addEventListener('click', () => window.go?.('Pengaturan Saya'));
    $('pcVoiceBtn')?.addEventListener('click', () => window.sherlyOpenVoicePanel?.());
    $('pfLogoutBtn')?.addEventListener('click', () => window.sherlyLogout?.());

    // restore UI identity from any previously saved profile
    const saved = window.sherlyReadProfile?.();
    if (saved) { window.__pfPhoto = saved.photo || null; window.__pfPosition = saved.photoPosition || POSITIONS[0].v; }
    applyProfileUI();
    backgroundSync();

    // D-142: muat kunci pribadi saat role berubah (login/logout) tanpa reload halaman.
    const __applyRolePrev = window.sherlyApplyRole;
    if (typeof __applyRolePrev === 'function' && !window.__pcKeysRoleHook) {
      window.__pcKeysRoleHook = true;
      window.sherlyApplyRole = function () { __applyRolePrev.apply(this, arguments); loadPcKeys(); };
    }
    window.sherlyLoadPersonalKeys = loadPcKeys;
    loadPcKeys();
  }

  // Silently pull the DB profile right after load so the topbar shows the account's
  // real identity on any device (without waiting for the user to open Profil).
  async function backgroundSync() {
    if (!window.sherlyUser) return;
    try {
      const h = {}; const t = await window.sherlyGetAccessToken?.(); if (t) h.Authorization = 'Bearer ' + t;
      const res = await fetch('/api/profile', { headers: h });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.profile) {
        const p = dbToForm(data.profile);
        window.sherlyWriteProfile(p);
        window.__pfPhoto = p.photo || null; window.__pfPosition = p.photoPosition || POSITIONS[0].v;
        applyProfileUI();
      }
    } catch { /* offline/belum migrasi — pakai cache lokal tanpa mengganggu */ }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
