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
  // D-149: jenis akun otomatis — mengikuti role akun, bukan diisi manual.
  const ROLE_ACCOUNT_TYPE = { admin: 'Pemilik', member: 'Klien', guest: 'Tamu' };
  const autoAccountType = () => ROLE_ACCOUNT_TYPE[window.sherlyUser?.role || 'guest'] || 'Tamu';

  function readForm() {
    return {
      fullName: $('pfFullName').value.trim(),
      displayName: $('pfDisplayName').value.trim(),
      gender: $('pfGender').value,
      accountType: autoAccountType(),
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
    set('pfAccountType', autoAccountType()); // D-149: selalu otomatis, abaikan nilai lama
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
        // D-149: teks di bawah nama mengikuti jenis akun otomatis (Pemilik/Klien/Tamu).
        const t = autoAccountType().toUpperCase();
        small.textContent = (user.role || 'guest') === 'admin'
          ? [t, p.role].filter(Boolean).join(' · ').toUpperCase()
          : t + ' · SHERLYSTUDIO';
      } else small.textContent = 'LOGIN · SHERLYSTUDIO';
    }
    const at = $('pfAccountType'); if (at) at.value = autoAccountType();
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
    fullName: r.full_name || '', displayName: r.display_name || '', gender: r.gender || '',
    role: r.role || '', company: r.company || '', bio: r.bio || '',
    email: r.email || '', phone: r.phone || '', location: r.location || '', website: r.website || '',
    primaryContact: r.primary_contact || 'WhatsApp', photo: r.photo || null, photoPosition: r.photo_position || POSITIONS[0].v,
  });
  const formToDb = (p) => ({
    full_name: p.fullName || '', display_name: p.displayName || '', gender: p.gender || '', account_type: p.accountType || '',
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
          writeForm({ email: user?.email || '', primaryContact: 'WhatsApp' });
        }
      }
    } catch (e) {
      window.toast?.('Gagal memuat profil dari server — memakai data lokal browser. (' + e.message + ')');
      if (local) writeForm(local); else writeForm({ email: user?.email || '', primaryContact: 'WhatsApp' });
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
      let groups = null;
      try {
        const h = {}; const t = await window.sherlyGetAccessToken?.(); if (t) h.Authorization = 'Bearer ' + t;
        const res = await fetch('/api/my/keys', { headers: h });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || ('Gagal memuat kunci (' + res.status + ')'));
        groups = Array.isArray(d.groups) ? d.groups : [];
      } catch (e) { list.innerHTML = '<p class="mykey-empty">Kunci AI belum bisa dimuat: ' + esc(e.message) + '</p>'; return; }
      if (!groups.length) { list.innerHTML = '<p class="mykey-empty">Belum ada kunci tersimpan. Isi form di bawah — key gratis dari Google AI Studio (Gemini) atau Groq sudah cukup untuk mulai mengobrol dengan Sherly.</p>'; return; }
      list.innerHTML = groups.map((g) => {
        const gHealth = g.health_status === 'ok' ? 'sehat' : (g.health_status === 'failing' ? 'gangguan' : (g.active_count ? 'siap' : 'nonaktif'));
        const head = '<div class="mykey-group-head"><b>' + (PC_KEY_PROVIDERS[g.provider] || esc(g.provider)) + ' · ' + esc(g.key_name) + '</b><span class="mykey-gcount">' + g.total + ' key · ' + g.active_count + ' aktif · ' + gHealth + '</span><button type="button" class="mykey-gadd" data-act="addkey" data-provider="' + esc(g.provider) + '" data-label="' + esc(g.key_name) + '">+ Key</button><button type="button" class="mykey-gdel" data-act="delgroup" data-provider="' + esc(g.provider) + '" data-label="' + esc(g.key_name) + '">Hapus Grup</button></div>';
        const rows = (g.keys || []).map((k) => {
          const bad = k.is_active === false || k.health_status === 'failing';
          const st = k.is_active === false ? 'nonaktif' : (k.health_status === 'failing' ? 'gangguan' : 'aktif');
          const isDefault = Number(k.priority) === 1;
          const bits = [k.model ? esc(k.model) : '', k.provider === 'custom' ? esc(k.base_url || '') : ''].filter(Boolean).join(' · ');
          return '<div class="mykey-row" data-key-id="' + esc(k.id) + '"><div class="mykey-meta"><b>•••• ' + esc(k.last4 || '????') + (isDefault ? '<span class="mykey-default" title="Dipakai lebih dulu untuk provider ini">DEFAULT</span>' : '') + '<span class="mykey-status' + (bad ? ' bad' : '') + '" title="Kesehatan key dipantau otomatis — nonaktif setelah gagal 5x beruntun">' + st + '</span></b><small>' + bits + '</small></div><div class="mykey-actions"><button type="button" class="mykey-act" data-act="test">Tes</button><button type="button" class="mykey-act" data-act="edit">Edit</button><button type="button" class="mykey-act" data-act="rotate">Ganti</button>' + (isDefault ? '' : '<button type="button" class="mykey-act" data-act="default">Default</button>') + '<button type="button" class="mykey-act" data-act="del">Hapus</button></div></div>'
            + '<div class="mykey-edit-row" data-edit-for="' + esc(k.id) + '" hidden><input class="mykey-edit-label" maxlength="80" placeholder="Label grup"><select class="mykey-edit-active"><option value="1">Aktif</option><option value="0">Nonaktif</option></select><button type="button" class="mykey-act" data-act="saveEdit">Simpan</button><button type="button" class="mykey-act" data-act="cancel">Batal</button></div>'
            + '<div class="mykey-edit-row" data-rotate-for="' + esc(k.id) + '" hidden><input class="mykey-rotate-key" type="password" maxlength="400" placeholder="API key baru (di-tes dulu sebelum diganti)"><button type="button" class="mykey-act" data-act="saveRotate">Ganti Key</button><button type="button" class="mykey-act" data-act="cancel">Batal</button></div>';
        }).join('');
        return '<div class="mykey-group">' + head + rows + '</div>';
      }).join('');
    }
    async function pcKeyFetch(path, method, body) {
      const h = {}; const t = await window.sherlyGetAccessToken?.(); if (t) h.Authorization = 'Bearer ' + t;
      if (body !== undefined) h['Content-Type'] = 'application/json';
      const res = await fetch(path, { method, headers: h, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || ('Permintaan gagal (' + res.status + ')'));
      return d;
    }
    // D-147 (ala aira/HeyTalent): aksi per key — tes, edit, ganti, default, hapus; hapus per grup.
    $('pcKeysList')?.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('button'); if (!btn || btn.disabled) return;
      const act = btn.getAttribute('data-act'); if (!act) return;
      const row = btn.closest('.mykey-row');
      const editHost = btn.closest('.mykey-edit-row');
      const id = row?.getAttribute('data-key-id') || editHost?.getAttribute('data-edit-for') || editHost?.getAttribute('data-rotate-for') || '';
      const busy = (on) => { btn.disabled = on; };
      try {
        if (act === 'test') {
          busy(true);
          const d = await pcKeyFetch('/api/my/keys/' + encodeURIComponent(id) + '/test', 'POST');
          window.toast?.(d.ok ? 'Key sehat — siap dipakai Sherly.' : 'Key bermasalah: ' + (d.error || 'tidak diketahui'));
          await loadPcKeys();
        } else if (act === 'default') {
          busy(true);
          await pcKeyFetch('/api/my/keys/' + encodeURIComponent(id) + '/default', 'PUT');
          window.toast?.('Key ini jadi default — dipakai paling awal untuk providernya.');
          await loadPcKeys();
        } else if (act === 'edit') {
          const kid = row?.getAttribute('data-key-id') || '';
          const rotRow = $('pcKeysList').querySelector('[data-rotate-for="' + kid + '"]');
          const editRow = $('pcKeysList').querySelector('[data-edit-for="' + kid + '"]');
          if (rotRow) rotRow.hidden = true;
          if (editRow) { editRow.hidden = !editRow.hidden; }
        } else if (act === 'rotate') {
          const kid = row?.getAttribute('data-key-id') || '';
          const rotRow = $('pcKeysList').querySelector('[data-rotate-for="' + kid + '"]');
          const editRow = $('pcKeysList').querySelector('[data-edit-for="' + kid + '"]');
          if (editRow) editRow.hidden = true;
          if (rotRow) { rotRow.hidden = !rotRow.hidden; }
        } else if (act === 'cancel') {
          const host = btn.closest('.mykey-edit-row'); if (host) host.hidden = true;
        } else if (act === 'saveEdit') {
          const host = btn.closest('.mykey-edit-row');
          const label = host?.querySelector('.mykey-edit-label')?.value.trim() || 'pribadi';
          const isActive = host?.querySelector('.mykey-edit-active')?.value !== '0';
          busy(true);
          await pcKeyFetch('/api/my/keys/' + encodeURIComponent(id), 'PUT', { label, is_active: isActive });
          window.toast?.('Perubahan tersimpan.');
          await loadPcKeys();
        } else if (act === 'saveRotate') {
          const host = btn.closest('.mykey-edit-row');
          const apiKey = host?.querySelector('.mykey-rotate-key')?.value.trim() || '';
          if (!apiKey) { window.toast?.('Tempel API key barunya dulu.'); return; }
          busy(true);
          await pcKeyFetch('/api/my/keys/' + encodeURIComponent(id) + '/rotate', 'PUT', { api_key: apiKey });
          window.toast?.('Key berhasil diganti & terverifikasi.');
          await loadPcKeys();
        } else if (act === 'del') {
          if (!window.confirm('Hapus key ini dari vault-mu?')) return;
          busy(true);
          await pcKeyFetch('/api/my/keys/' + encodeURIComponent(id), 'DELETE');
          window.toast?.('Kunci dihapus.');
          await loadPcKeys();
        } else if (act === 'addkey') {
          const provider = btn.getAttribute('data-provider') || '';
          const label = btn.getAttribute('data-label') || '';
          const sel = $('pcKeyProvider');
          if (sel && provider && sel.value !== provider) { sel.value = provider; sel.dispatchEvent(new Event('change', { bubbles: true })); }
          const lab = $('pcKeyLabel'); if (lab) lab.value = label;
          $('pcKeyForm')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
          $('pcKeySecret')?.focus();
          window.toast?.('Form siap utk grup "' + label + '" — tempel key barunya.');
        } else if (act === 'delgroup') {
          const provider = btn.getAttribute('data-provider') || '';
          const label = btn.getAttribute('data-label') || '';
          if (!window.confirm('Hapus SEMUA key di grup "' + label + '"?')) return;
          busy(true);
          await pcKeyFetch('/api/my/keys/group', 'DELETE', { provider, key_name: label });
          window.toast?.('Grup dihapus.');
          await loadPcKeys();
        }
      } catch (e) { window.toast?.(e.message); }
      finally { busy(false); }
    });
    // D-144: alur form jelas — pilih provider → ambil key (link) → tempel → deteksi model → simpan.
    const PC_KEY_LINKS = {
      gemini: { href: 'https://aistudio.google.com/app/apikey', text: 'Ambil gratis di Google AI Studio' },
      groq: { href: 'https://console.groq.com/keys', text: 'Ambil gratis di console.groq.com' },
      openrouter: { href: 'https://openrouter.ai/keys', text: 'Ambil di openrouter.ai/keys' },
      custom: null,
    };
    function applyPcKeyProviderUi() {
      const provider = $('pcKeyProvider')?.value || 'gemini';
      const custom = provider === 'custom';
      const base = $('pcKeyCustomBase'); if (base) base.hidden = !custom;
      const link = PC_KEY_LINKS[provider] || null;
      const row = $('pcKeyGetRow'); if (row) row.hidden = !link;
      const a = $('pcKeyGetLink');
      if (a && link) { a.href = link.href; a.textContent = link.text; }
      const modelInput = $('pcKeyModel');
      if (modelInput) modelInput.placeholder = custom ? 'Wajib — klik Deteksi untuk memilih' : 'Kosongkan = model andalan Sherly';
      const hint = $('pcKeyModelHint');
      if (hint) hint.textContent = custom
        ? 'Wajib diisi. Klik Deteksi untuk menampilkan model yang tersedia di endpoint-mu.'
        : 'Opsional — kosongkan untuk memakai model andalan Sherly. Klik Deteksi untuk melihat model milik key-mu.';
    }
    $('pcKeyProvider')?.addEventListener('change', applyPcKeyProviderUi);
    applyPcKeyProviderUi();
    $('pcKeyDetectBtn')?.addEventListener('click', async () => {
      const btn = $('pcKeyDetectBtn'); if (!btn || btn.disabled) return;
      const provider = $('pcKeyProvider')?.value || '';
      const api_key = $('pcKeySecret')?.value.trim() || '';
      const base_url = $('pcKeyBaseUrl')?.value.trim() || '';
      if (!api_key) { window.toast?.('Tempel API key-mu dulu ya, baru deteksi model.'); return; }
      if (provider === 'custom' && !base_url) { window.toast?.('Isi Base URL dulu ya, baru deteksi model.'); return; }
      const label = $('pcKeyDetectLabel'); const oldLabel = label?.textContent || 'Deteksi';
      btn.disabled = true; if (label) label.textContent = 'Mendeteksi…';
      try {
        const h = { 'Content-Type': 'application/json' };
        const t = await window.sherlyGetAccessToken?.(); if (t) h.Authorization = 'Bearer ' + t;
        const res = await fetch('/api/my/models', { method: 'POST', headers: h, body: JSON.stringify({ provider, api_key, base_url }) });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || ('Deteksi gagal (' + res.status + ')'));
        const models = Array.isArray(d.models) ? d.models : [];
        const list = $('pcKeyModelList');
        if (list) list.innerHTML = models.map((m) => '<option value="' + esc(m.id) + '">' + esc(m.display || '') + '</option>').join('');
        const modelInput = $('pcKeyModel');
        if (modelInput && !modelInput.value.trim() && models.length) modelInput.value = models[0].id;
        const hint = $('pcKeyModelHint');
        if (hint) hint.textContent = models.length
          ? models.length + ' model tersedia untuk key ini — pilih dari daftar saat mengetik.'
          : 'Tidak ada model terdeteksi — ketik manual nama modelnya.';
        window.toast?.(models.length ? 'Deteksi berhasil — ' + models.length + ' model ditemukan.' : 'Tidak ada model terdeteksi untuk key ini.');
      } catch (e) { window.toast?.(e.message); }
      finally { btn.disabled = false; if (label) label.textContent = oldLabel; }
    });
    // D-148 (ala aira): tombol + di bawah key 1 — key 2, 3, dst. sekali submit, satu grup.
    const PC_KEY_MAX_EXTRAS = 20;
    function pcRenumberKeyInputs() {
      const secret = $('pcKeySecret'); if (secret) secret.placeholder = 'API key 1';
      Array.from($('pcKeyExtraList')?.querySelectorAll('.pc-key-extra-input') || []).forEach((inp, i) => { inp.placeholder = 'API key ' + (i + 2); });
    }
    function pcAddKeyInput() {
      const list = $('pcKeyExtraList'); if (!list) return;
      if (list.querySelectorAll('.pc-key-extra-input').length >= PC_KEY_MAX_EXTRAS) { window.toast?.('Maksimal ' + (PC_KEY_MAX_EXTRAS + 1) + ' key sekali submit — simpan dulu, lalu tambah lagi.'); return; }
      const wrap = document.createElement('div'); wrap.className = 'pc-key-extra';
      const inp = document.createElement('input'); inp.type = 'password'; inp.maxLength = 400; inp.autocomplete = 'off'; inp.className = 'pc-key-extra-input';
      const del = document.createElement('button'); del.type = 'button'; del.className = 'pc-key-extra-del'; del.setAttribute('aria-label', 'Hapus key ini'); del.textContent = '×';
      del.addEventListener('click', () => { wrap.remove(); pcRenumberKeyInputs(); });
      wrap.appendChild(inp); wrap.appendChild(del); list.appendChild(wrap);
      pcRenumberKeyInputs(); inp.focus();
    }
    $('pcKeyAddBtn')?.addEventListener('click', pcAddKeyInput);
    $('pcKeyForm')?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const btn = $('pcKeySaveBtn'); if (!btn || btn.disabled) return;
      const provider = $('pcKeyProvider')?.value || '';
      const base_url = $('pcKeyBaseUrl')?.value.trim() || '';
      const model = $('pcKeyModel')?.value.trim() || '';
      const label = $('pcKeyLabel')?.value.trim() || '';
      const entries = [$('pcKeySecret'), ...Array.from($('pcKeyExtraList')?.querySelectorAll('.pc-key-extra-input') || [])]
        .filter(Boolean).map((inp) => ({ inp, val: inp.value.trim() })).filter((e) => e.val);
      if (!entries.length) { window.toast?.('API key wajib diisi.'); return; }
      if (provider === 'custom' && !base_url) { window.toast?.('Base URL wajib diisi untuk provider kustom.'); return; }
      if (provider === 'custom' && !model) { window.toast?.('Nama model wajib diisi untuk provider kustom.'); return; }
      btn.disabled = true; btn.textContent = 'Mengetes 1/' + entries.length + '…';
      const h = { 'Content-Type': 'application/json' };
      const t = await window.sherlyGetAccessToken?.(); if (t) h.Authorization = 'Bearer ' + t;
      let ok = 0; let firstErr = '';
      for (let i = 0; i < entries.length; i++) {
        btn.textContent = 'Mengetes ' + (i + 1) + '/' + entries.length + '…';
        try {
          const res = await fetch('/api/my/keys', { method: 'POST', headers: h, body: JSON.stringify({ provider, api_key: entries[i].val, base_url, model, label }) });
          const d = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(d.error || ('Gagal menyimpan (' + res.status + ')'));
          ok++; entries[i].inp.value = '';
        } catch (e) { entries[i].err = e.message; if (!firstErr) firstErr = e.message; }
      }
      if (ok === entries.length) {
        if ($('pcKeyExtraList')) $('pcKeyExtraList').innerHTML = '';
        pcRenumberKeyInputs();
        window.toast?.(entries.length > 1
          ? entries.length + ' key masuk' + (label ? ' grup "' + label + '"' : '') + ' & terverifikasi — Sherly otomatis fallback antar key-mu saat chat.'
          : 'Key ditambahkan & terverifikasi — Sherly akan otomatis fallback antar key-mu saat chat.');
      } else if (ok > 0) {
        window.toast?.(ok + ' key tersimpan, ' + (entries.length - ok) + ' gagal: ' + firstErr + ' — key yang gagal tetap di kolomnya, periksa lalu submit ulang.');
      } else {
        window.toast?.('Gagal: ' + firstErr);
      }
      await loadPcKeys();
      btn.disabled = false; btn.textContent = 'Tambah & Tes Key';
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
