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

  window.renderPersona = function renderPersona() {
    const root = document.getElementById('personaRoot');
    if (!root) return;
    const p = window.SHERLY_PERSONA || {};
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
})();
