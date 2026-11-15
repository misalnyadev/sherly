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

    const hero =
      '<div class="pe-hero">'
      + '<img class="pe-ava" src="assets/sherly-portrait.png" alt="Sherly">'
      + '<div class="pe-hero-main">'
      + '<h1>' + esc(p.name || 'Sherly') + ' <span style="color:#ff72c5">\u2726</span></h1>'
      + '<p class="pe-tag">' + esc(p.tagline || '') + '</p>'
      + '<div class="pe-chips"><span class="chip">' + esc(p.role || '') + '</span><span class="chip">' + esc(p.location || '') + '</span><span class="chip">' + esc(p.handle || '') + '</span></div>'
      + '<div class="pe-cta">'
      + '<a class="pink-btn" href="' + esc(p.instagram || '#') + '" target="_blank" rel="noopener">' + icon('arrow-up-right') + ' Instagram ' + esc(p.handle || '') + '</a>'
      + '<button type="button" class="outline-btn" id="pePortfolioBtn">' + icon('gallery') + ' Lihat Portfolio</button>'
      + '</div>'
      + '</div></div>';

    const v = p.visual || {};
    const sections =
      '<div class="pe-grid">'
      + '<div class="pe-card"><h3>' + icon('user-round') + ' Kepribadian</h3>' + chips(p.traits) + '</div>'
      + '<div class="pe-card"><h3>' + icon('message') + ' Suara &amp; Gaya Bicara</h3>'
      + '<p><b>Gaya.</b> ' + esc(p.voice?.gaya || '') + '</p>'
      + '<p><b>Khas.</b> ' + esc(p.voice?.khas || '') + '</p>'
      + '<p><b>Pantangan.</b> ' + esc(p.voice?.pantangan || '') + '</p>'
      + '</div>'
      + (p.pillars || []).map((pl) => '<div class="pe-card"><h3>' + icon('sparkles') + ' ' + esc(pl.title) + '</h3><p>' + esc(pl.desc || '') + '</p></div>').join('')
      + '<div class="pe-card wide"><h3>' + icon('eye') + ' Identitas Visual</h3>'
      + '<div class="pe-mood">' + (v.mood || []).map((m) => '<span class="chip">' + esc(m) + '</span>').join('') + '</div>'
      + '<div class="pe-palette">' + (v.palette || []).map((c) => '<span class="pe-swatch"><i style="background:' + esc(c.hex) + '"></i>' + esc(c.name) + '<small>' + esc(c.hex) + '</small></span>').join('') + '</div>'
      + '<p style="margin-top:12px">' + esc(v.foto || '') + '</p>'
      + '</div>'
      + '<div class="pe-card"><h3>' + icon('users') + ' Audiens</h3><p>' + esc(p.audience || '') + '</p></div>'
      + '<div class="pe-card wide"><h3>' + icon('arrow-up-right') + ' Kolaborasi</h3>'
      + '<p>' + esc(p.kolaborasi || '') + '</p>'
      + (p.heyTalent && p.heyTalent.pin ? '<div class="pe-ht"><span class="pe-ht-pin">' + icon('key') + ' PIN HeyTalent <b>' + esc(p.heyTalent.pin) + '</b></span><button type="button" class="outline-btn" id="peHtBtn">Salin PIN</button></div><p class="pe-ht-note">' + esc(p.heyTalent.note || '') + '</p>' : '')
      + '<div class="pe-cta" style="margin-top:12px">'
      + '<a class="pink-btn" href="' + esc(p.instagram || '#') + '" target="_blank" rel="noopener">' + icon('arrow-up-right') + ' DM ' + esc(p.handle || '') + '</a>'
      + '<button type="button" class="outline-btn" id="peChatBtn">' + icon('message') + ' Chat dengan Sherly</button>'
      + '<button type="button" class="outline-btn" id="peIdeBtn">' + icon('sparkles') + ' Minta ide konten</button>'
      + '<button type="button" class="outline-btn" id="peCollabBtn">' + icon('message-circle') + ' Ajukan Brief Kolaborasi</button>'
      + '</div>'
      + '</div>'
      + '</div>';

    root.innerHTML = hero + sections;

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
