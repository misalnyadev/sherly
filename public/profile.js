// Profil Pengguna — identitas & kontak kerja sama.
// Disimpan lokal di browser (localStorage 'sherly.profile.v1'); ringkasannya dikirim ke
// /api/ai/chat agar Sherly mengenali lawan bicaranya. Bergantung pada global dari inline script:
// toast, go, sherlyReadProfile, sherlyWriteProfile, sherlyGetAccessToken (untuk email default).
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
    set('pfFullName', p.fullName); set('pfDisplayName', p.displayName);
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
    document.querySelectorAll('.topbar .owner img.avatar, #ssProfileTrigger img.avatar').forEach((el) => {
      if (window.__pfPhoto) { if (!DEFAULT_AVATAR.el) DEFAULT_AVATAR.el = el.getAttribute('src'); el.src = window.__pfPhoto; el.style.objectPosition = window.__pfPosition; }
      else if (DEFAULT_AVATAR.el) { el.src = DEFAULT_AVATAR.el; }
    });
  }

  function applyProfileUI() {
    const p = window.sherlyReadProfile?.();
    const name = p ? (p.displayName || p.fullName || null) : null;
    // trigger + dropdown identity
    const triggerName = document.querySelector('#ssProfileTrigger .owner b');
    const triggerRole = document.querySelector('#ssProfileTrigger .owner small');
    if (triggerName && name) triggerName.textContent = name;
    if (triggerRole && p?.role) triggerRole.textContent = (p.role + (p.company ? ' · ' + p.company : '')).toUpperCase();
    const ssName = document.getElementById('ssProfileName');
    const ssRole = document.getElementById('ssProfileRole');
    if (ssName && name) ssName.textContent = name;
    if (ssRole && (p?.role || p?.accountType)) ssRole.textContent = [p?.accountType, p?.role].filter(Boolean).join(' · ').toUpperCase();
    renderAvatar();
  }

  window.sherlyApplyProfile = applyProfileUI;
  window.loadProfile = function loadProfile() {
    const p = window.sherlyReadProfile?.() || {};
    // prefill email from the logged-in account if empty
    if (!p.email) {
      const user = window.sherlyUser;
      if (user?.email) p.email = user.email;
    }
    if (!p.accountType) p.accountType = 'Kreator';
    if (!p.primaryContact) p.primaryContact = 'WhatsApp';
    writeForm(p);
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

    $('pfSaveBtn')?.addEventListener('click', () => {
      const p = readForm();
      const ok = window.sherlyWriteProfile?.(p);
      if (ok) { window.toast?.('Profil tersimpan — Chat Sherly akan memakai identitas ini.'); applyProfileUI(); }
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
      if (saved) { saved.photo = null; saved.photoPosition = POSITIONS[0].v; window.sherlyWriteProfile?.(saved); }
      renderAvatar();
      window.toast?.('Foto profil dihapus.');
    });
    $('pfOpenProvidersBtn')?.addEventListener('click', () => window.go?.('AI Providers'));

    // restore UI identity from any previously saved profile
    const saved = window.sherlyReadProfile?.();
    if (saved) { window.__pfPhoto = saved.photo || null; window.__pfPosition = saved.photoPosition || POSITIONS[0].v; }
    applyProfileUI();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
