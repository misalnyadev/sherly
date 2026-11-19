// Persona Sherly — brand kit internal + media kit publik.
// Data: persona-data.js (window.SHERLY_PERSONA). Dipanggil go('Persona') -> window.renderPersona().
(() => {
  'use strict';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Konten dirender dinamis (setelah loop injeksi [data-icon]) -> ikon dirakit manual.
  const icon = (key) => {
    const paths = (typeof ICONS !== 'undefined' && ICONS[key]) || '';
    return '<span data-icon="' + key + '">' + (paths ? '<svg viewBox="0 0 24 24" aria-hidden="true">' + paths + '</svg>' : '') + '</span>';
  };

  // D-194: override persona dari owner (Pengaturan → Persona Sherly) digabung ke bawaan.
  window.sherlyFetchPersonaOverrides = async function sherlyFetchPersonaOverrides() {
    if (window.__sherlyPersonaOv) return window.__sherlyPersonaOv;
    try {
      const res = await fetch('/api/persona-settings');
      const d = await res.json().catch(() => ({}));
      window.__sherlyPersonaOv = (d && d.overrides && typeof d.overrides === 'object') ? d.overrides : {};
    } catch { window.__sherlyPersonaOv = {}; }
    return window.__sherlyPersonaOv;
  };
  window.sherlyMergePersona = function sherlyMergePersona(base, ov) {
    const out = { ...(base || {}) };
    const o = ov || {};
    for (const k of ['name', 'handle', 'instagram', 'tagline', 'role', 'location', 'bio', 'audience', 'kolaborasi']) if (o[k]) out[k] = o[k];
    if (Array.isArray(o.traits) && o.traits.length) out.traits = o.traits;
    if (o.voice) out.voice = { ...(base?.voice || {}), ...o.voice };
    if (Array.isArray(o.pillars) && o.pillars.length) out.pillars = o.pillars;
    if (o.visual) out.visual = { ...(base?.visual || {}), ...(Array.isArray(o.visual.mood) && o.visual.mood.length ? { mood: o.visual.mood } : {}), ...(o.visual.foto ? { foto: o.visual.foto } : {}) };
    if (o.owner) out.owner = { ...(base?.owner || {}), ...o.owner };
    return out;
  };
  window.renderPersona = async function renderPersona() {
    const root = document.getElementById('personaRoot');
    if (!root) return;
    const ov = await window.sherlyFetchPersonaOverrides();
    const p = window.sherlyMergePersona(window.SHERLY_PERSONA || {}, ov);
    const chips = (arr) => '<div class="pe-traits">' + (arr || []).map((t) => '<span class="chip">' + esc(t) + '</span>').join('') + '</div>';

    // D-192: tata letak blogazine — masthead editorial, bio drop-cap, pilar bernomor.
    const mast =
      '<div class="bz-mast">'
      + '<div class="bz-mast-top"><span class="bz-kicker">Brand &amp; Media Kit</span><span class="bz-script">' + esc(p.handle || '') + ' ' + icon('sherlyheart') + '</span></div>'
      + '<div class="bz-mast-main">'
      + '<img class="pe-ava" src="assets/sherly-portrait.png" alt="Sherly">'
      + '<div class="bz-mast-txt">'
      + '<h1 class="bz-name">' + esc(p.name || 'Sherly') + ' ' + icon('sherlyheart') + '</h1>'
      + '<p class="bz-tagline">\u201c' + esc(p.tagline || '') + '\u201d</p>'
      + '<div class="bz-byline"><span>' + esc(p.role || '') + '</span><i>' + icon('sherlyheart') + '</i><span>' + esc(p.location || '') + '</span><i>' + icon('sherlyheart') + '</i><span>' + esc(p.handle || '') + '</span></div>'
      + '<div class="pe-cta">'
      + '<a class="pink-btn" href="' + esc(p.instagram || '#') + '" target="_blank" rel="noopener">' + icon('arrow-up-right') + ' Instagram</a>'
      + '<button type="button" class="outline-btn" id="pePortfolioBtn">' + icon('gallery') + ' Lihat Portfolio</button>'
      + '</div>'
      + '</div></div></div>';

    const bio = '<p class="bz-bio">' + esc(p.bio || '') + '</p>';
    const scriptDiv = '<div class="bz-script-div">' + esc(String(p.tagline || '').split('\u2014')[0].trim()) + '</div>';

    const v = p.visual || {};
    const pillars = (p.pillars || []).map((pl, i) =>
      '<div class="bz-pillar"><span class="bz-num">0' + (i + 1) + '</span><div><h4>' + esc(pl.title) + '</h4><p>' + esc(pl.desc || '') + '</p></div></div>').join('');

    const grid =
      '<div class="bz-grid">'
      + '<section class="bz-card"><span class="bz-kicker">Tentang dia</span><h3 class="bz-title">' + icon('user-round') + ' Kepribadian</h3>' + chips(p.traits) + '</section>'
      + '<section class="bz-card span2"><span class="bz-kicker">Editor\u2019s notes</span><h3 class="bz-title">' + icon('message') + ' Suara &amp; Gaya Bicara</h3>'
      + '<p><b>Gaya.</b> ' + esc(p.voice?.gaya || '') + '</p>'
      + '<p><b>Khas.</b> ' + esc(p.voice?.khas || '') + '</p>'
      + '<p><b>Pantangan.</b> ' + esc(p.voice?.pantangan || '') + '</p>'
      + '</section>'
      + '<section class="bz-card full"><span class="bz-kicker">Pilar konten</span><h3 class="bz-title">' + icon('sparkles') + ' Pilar Konten</h3><div class="bz-pillars">' + pillars + '</div></section>'
      + '<section class="bz-card span2"><span class="bz-kicker">Mood board</span><h3 class="bz-title">' + icon('eye') + ' Identitas Visual</h3>'
      + '<div class="pe-mood">' + (v.mood || []).map((m) => '<span class="chip">' + esc(m) + '</span>').join('') + '</div>'
      + '<div class="pe-palette">' + (v.palette || []).map((c) => '<span class="pe-swatch"><i style="background:' + esc(c.hex) + '"></i>' + esc(c.name) + '<small>' + esc(c.hex) + '</small></span>').join('') + '</div>'
      + '<p style="margin-top:12px">' + esc(v.foto || '') + '</p>'
      + '</section>'
      + '<section class="bz-card"><span class="bz-kicker">Untuk siapa</span><h3 class="bz-title">' + icon('users') + ' Audiens</h3><p>' + esc(p.audience || '') + '</p></section>'
      + '<section class="bz-card full"><span class="bz-kicker">Bekerja sama</span><h3 class="bz-title">' + icon('arrow-up-right') + ' Kolaborasi</h3>'
      + '<p>' + esc(p.kolaborasi || '') + '</p>'
      + (p.heyTalent && p.heyTalent.pin ? '<div class="pe-ht"><span class="pe-ht-pin">' + icon('key') + ' PIN HeyTalent <b>' + esc(p.heyTalent.pin) + '</b></span><button type="button" class="outline-btn" id="peHtBtn">Salin PIN</button></div><p class="pe-ht-note">' + esc(p.heyTalent.note || '') + '</p>' : '')
      + '<div class="pe-cta" style="margin-top:12px">'
      + '<a class="pink-btn" href="' + esc(p.instagram || '#') + '" target="_blank" rel="noopener">' + icon('arrow-up-right') + ' DM ' + esc(p.handle || '') + '</a>'
      + '<button type="button" class="outline-btn" id="peChatBtn">' + icon('message') + ' Chat dengan Sherly</button>'
      + '<button type="button" class="outline-btn" id="peIdeBtn">' + icon('sparkles') + ' Minta ide konten</button>'
      + '<button type="button" class="outline-btn" id="peCollabBtn">' + icon('message-circle') + ' Ajukan Brief Kolaborasi</button>'
      + '</div>'
      + '</section>'
      + '</div>';

    root.innerHTML = mast + bio + scriptDiv + grid + '<div class="bz-close">with love, ' + esc(p.name || 'Sherly') + ' ' + icon('sherlyheart') + '</div>';

    document.getElementById('pePortfolioBtn')?.addEventListener('click', () => window.go?.('Portfolio'));
    document.getElementById('peChatBtn')?.addEventListener('click', () => window.go?.('Chat Sherly'));
    document.getElementById('peCollabBtn')?.addEventListener('click', () => window.go?.('Kolaborasi'));
    document.getElementById('peHtBtn')?.addEventListener('click', async () => {
      const pin = String(window.SHERLY_PERSONA?.heyTalent?.pin || '').trim();
      if (!pin) return;
      try { await navigator.clipboard.writeText(pin); window.toast?.('PIN HeyTalent disalin: ' + pin); }
      catch { window.toast?.('PIN HeyTalent: ' + pin); }
    });
    document.getElementById('peIdeBtn')?.addEventListener('click', () => {
      window.go?.('Chat Sherly');
      setTimeout(() => {
        const el = document.getElementById('ssChatInput');
        if (el) { el.value = 'Buatkan 5 ide konten yang paling sejalan dengan persona & pilar kontenku \u2014 lengkap dengan hook dan alasan kenapa cocok.'; el.focus(); }
      }, 250);
    });
  };

  // ===== D-194: Editor Persona (Pengaturan → tab "Persona Sherly") =====
  function personaEditorInit() {
    const pane = document.getElementById('settingsPersonaPane');
    if (!pane || pane.dataset.ready) return;
    pane.dataset.ready = '1';
    const $ = (id) => document.getElementById(id);
    const status = (msg, isErr) => { const el = $('peEdStatus'); if (el) { el.textContent = msg || ''; el.style.color = isErr ? '#ff9bdc' : 'var(--muted)'; } };

    (async () => {
      try {
        const ov = await window.sherlyFetchPersonaOverrides();
        const base = window.SHERLY_PERSONA || {};
        const eff = window.sherlyMergePersona(base, ov);
        const v = (x) => (x == null ? '' : String(x));
        $('peEdOwnerName').value = v(eff.owner?.name);
        $('peEdOwnerNote').value = v(eff.owner?.note);
        $('peEdTagline').value = v(eff.tagline);
        $('peEdRole').value = v(eff.role);
        $('peEdLocation').value = v(eff.location);
        $('peEdBio').value = v(eff.bio);
        $('peEdTraits').value = (eff.traits || []).join(', ');
        $('peEdGaya').value = v(eff.voice?.gaya);
        $('peEdKhas').value = v(eff.voice?.khas);
        $('peEdPantangan').value = v(eff.voice?.pantangan);
        for (let i = 1; i <= 4; i++) {
          const pl = (eff.pillars || [])[i - 1] || {};
          $('peEdP' + i + 'T').value = v(pl.title);
          $('peEdP' + i + 'D').value = v(pl.desc);
        }
        $('peEdMood').value = ((eff.visual || {}).mood || []).join(', ');
        $('peEdFoto').value = v(eff.visual?.foto);
        $('peEdAudience').value = v(eff.audience);
        $('peEdKolaborasi').value = v(eff.kolaborasi);
      } catch { status('Gagal memuat persona saat ini.', true); }
    })();

    const collect = () => ({
      owner: { name: $('peEdOwnerName').value.trim(), note: $('peEdOwnerNote').value.trim() },
      tagline: $('peEdTagline').value.trim(),
      role: $('peEdRole').value.trim(),
      location: $('peEdLocation').value.trim(),
      bio: $('peEdBio').value.trim(),
      traits: $('peEdTraits').value.split(',').map((x) => x.trim()).filter(Boolean),
      voice: { gaya: $('peEdGaya').value.trim(), khas: $('peEdKhas').value.trim(), pantangan: $('peEdPantangan').value.trim() },
      pillars: [1, 2, 3, 4].map((i) => ({ title: $('peEdP' + i + 'T').value.trim(), desc: $('peEdP' + i + 'D').value.trim() })),
      visual: { mood: $('peEdMood').value.split(',').map((x) => x.trim()).filter(Boolean), foto: $('peEdFoto').value.trim() },
      audience: $('peEdAudience').value.trim(),
      kolaborasi: $('peEdKolaborasi').value.trim()
    });

    const save = async (payload) => {
      const btn = $('peEdSaveBtn');
      btn.disabled = true; status('Menyimpan…');
      try {
        const h = { 'Content-Type': 'application/json' };
        const t = await window.sherlyGetAccessToken?.();
        if (t) h.Authorization = 'Bearer ' + t;
        const res = await fetch('/api/persona-settings', { method: 'PUT', headers: h, body: JSON.stringify(payload) });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || ('Gagal menyimpan (' + res.status + ')'));
        window.__sherlyPersonaOv = null; // cache lama dibersihkan — halaman Persona ambil yang baru
        status('Tersimpan ✓ Persona & nama owner langsung dipakai.');
        window.toast?.('Persona Sherly tersimpan 💕');
      } catch (e) {
        status(e.message || 'Gagal menyimpan.', true);
        window.toast?.(e.message || 'Gagal menyimpan persona.');
      } finally { btn.disabled = false; }
    };

    $('peEdSaveBtn')?.addEventListener('click', () => save(collect()));
    $('peEdResetBtn')?.addEventListener('click', () => {
      if (!window.confirm?.('Kembalikan Persona ke bawaan? Perubahanmu akan hilang.')) return;
      save({});
      ['peEdOwnerName', 'peEdOwnerNote'].forEach((id) => { const el = $(id); if (el) el.value = ''; });
    });
  }

  document.querySelectorAll('.settings-tab[data-settings-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.settingsTab;
      document.querySelectorAll('.settings-tab[data-settings-tab]').forEach((b) => b.classList.toggle('active', b === btn));
      const providers = document.getElementById('settingsProvidersPane');
      const persona = document.getElementById('settingsPersonaPane');
      if (providers) providers.hidden = tab !== 'providers';
      if (persona) persona.hidden = tab !== 'persona';
      if (tab === 'persona') personaEditorInit();
    });
  });
})();
