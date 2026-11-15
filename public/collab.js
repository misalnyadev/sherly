// Kolaborasi — katalog karakter publik + layanan + form brief untuk klien.
// Data: collab-data.js (window.SHERLY_STUDIO). Dipanggil go('Kolaborasi') -> window.renderCollab().
// Brief dikirim via WhatsApp (wa.me) — nomor otomatis dari field WhatsApp di profil admin (tersinkron ke server); fallback collab-data.js.
(() => {
  'use strict';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (key) => {
    const paths = (typeof ICONS !== 'undefined' && ICONS[key]) || '';
    return '<span data-icon="' + key + '">' + (paths ? '<svg viewBox="0 0 24 24" aria-hidden="true">' + paths + '</svg>' : '') + '</span>';
  };
  const CUSTOM = 'Buatkan karakter baru (custom)';

  window.renderCollab = function renderCollab() {
    const root = document.getElementById('collabRoot');
    if (!root) return;
    const cfg = window.SHERLY_STUDIO || {};
    // Nomor WA studio: dari field WhatsApp profil admin (tersinkron via server) — fallback collab-data.js.
    fetch('/api/public/settings').then((r) => r.json().catch(() => ({}))).then((d) => {
      const wa = String(d?.settings?.whatsapp || '').replace(/\D/g, '');
      if (wa && window.SHERLY_STUDIO) window.SHERLY_STUDIO.whatsapp = wa;
    }).catch(() => {});
    const chars = Array.isArray(cfg.characters) ? cfg.characters : [];
    const services = Array.isArray(cfg.services) ? cfg.services : [];

    const hero =
      '<div class="co-hero"><h2>Butuh konten untuk brand kamu?</h2>'
      + '<p>Pilih karakter, ceritakan kebutuhanmu, dan tim SherlyStudio mengurus sisanya \u2014 dari brief, produksi, sampai tayang. Karakter khusus untuk brand-mu juga bisa kami rancang.</p>'
      + '<div class="pe-cta" style="justify-content:center"><button type="button" class="pink-btn" id="coCtaBtn">' + icon('message-circle') + ' Ajukan Brief Sekarang</button></div>'
      + '</div>';

    const charCards =
      '<h2 class="co-h">' + icon('users') + ' Pilih Karakter</h2>'
      + '<div class="pf-grid">'
      + chars.map((c) =>
        '<div class="co-char">'
        + '<div class="co-cover"><img src="' + esc(c.img) + '" alt="' + esc(c.name) + '" loading="lazy"><span class="co-status">' + esc(c.status || 'Tersedia') + '</span></div>'
        + '<div class="pf-info"><h3>' + esc(c.name) + '</h3>'
        + '<div class="pf-meta"><span>' + esc(c.role || '') + '</span></div>'
        + '<p class="co-desc">' + esc(c.desc || '') + '</p>'
        + '<div class="pf-tags">' + (c.tags || []).map((t) => '<span class="chip">' + esc(t) + '</span>').join('') + '</div>'
        + '<button type="button" class="outline-btn co-pick" data-name="' + esc(c.name) + '">' + icon('check') + ' Pilih ' + esc(c.name) + '</button>'
        + (c.htPin ? '<p class="co-ht">' + icon('key') + ' Versi talent lengkap \u2014 chat sampai video call \u2014 di HeyTalent, invite PIN <b>' + esc(c.htPin) + '</b></p>' : '')
        + '</div></div>').join('')
      + '<div class="co-char co-custom"><div class="co-custom-ico">' + icon('sparkles') + '</div><div class="pf-info"><h3>Karakter Custom</h3>'
      + '<p class="co-desc">' + esc(cfg.customNote || '') + '</p>'
      + '<button type="button" class="outline-btn co-pick" data-name="' + esc(CUSTOM) + '">' + icon('check') + ' Pilih opsi ini</button>'
      + '</div></div>'
      + '</div>';

    const svcCards =
      '<h2 class="co-h">' + icon('clapperboard') + ' Layanan</h2>'
      + '<div class="pf-grid">'
      + services.map((s) => '<div class="co-svc"><div class="co-svc-ico">' + icon(s.icon || 'sparkles') + '</div><div class="pf-info"><h3>' + esc(s.title) + '</h3><p class="co-desc">' + esc(s.desc || '') + '</p></div></div>').join('')
      + '</div>';

    const form =
      '<h2 class="co-h" id="coFormAnchor">' + icon('message-circle') + ' Ajukan Brief</h2>'
      + '<div class="co-form">'
      + '<div class="form-grid">'
      + '<div class="form-field"><label for="coName">Nama kamu</label><input id="coName" maxlength="80" placeholder="Nama / nama brand"></div>'
      + '<div class="form-field"><label for="coContact">Kontak (WA / email)</label><input id="coContact" maxlength="120" placeholder="08xx / nama@brand.com"></div>'
      + '<div class="form-field"><label for="coService">Layanan</label><select id="coService"></select></div>'
      + '<div class="form-field"><label for="coChar">Karakter</label><select id="coChar"></select></div>'
      + '<div class="form-field"><label for="coBudget">Budget (opsional)</label><input id="coBudget" maxlength="60" placeholder="mis. Rp2\u20135 jt"></div>'
      + '<div class="form-field"><label for="coDeadline">Deadline / timeline (opsional)</label><input id="coDeadline" maxlength="60" placeholder="mis. 2 minggu dari sekarang"></div>'
      + '<div class="form-field full"><label for="coBrief">Ceritakan kebutuhanmu</label><textarea id="coBrief" rows="4" maxlength="1500" placeholder="Jenis konten, tone yang diinginkan, referensi, jumlah output \u2014 bebas!"></textarea></div>'
      + '</div>'
      + '<div class="pe-cta" style="margin-top:16px"><button type="button" class="pink-btn" id="coSubmit">' + icon('arrow-up-right') + ' Kirim via WhatsApp</button></div>'
      + '<p class="co-note">Brief terkirim ke WhatsApp studio dan dibalas saat jam kerja. Untuk balasan cepat, DM Instagram juga terbuka.</p>'
      + '</div>';

    root.innerHTML = hero + charCards + svcCards + form;

    // Dropdown layanan & karakter
    const svcSel = document.getElementById('coService');
    if (svcSel) svcSel.innerHTML = services.map((s) => '<option>' + esc(s.title) + '</option>').join('') || '<option>Lainnya</option>';
    const charSel = document.getElementById('coChar');
    if (charSel) charSel.innerHTML = chars.map((c) => '<option>' + esc(c.name) + '</option>').concat(['<option>' + esc(CUSTOM) + '</option>']).join('');

    const scrollToForm = () => document.getElementById('coFormAnchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('coCtaBtn')?.addEventListener('click', scrollToForm);
    root.querySelectorAll('.co-pick').forEach((b) => b.addEventListener('click', () => {
      if (charSel) charSel.value = b.dataset.name;
      window.toast?.(b.dataset.name + ' dipilih \u2014 lengkapi briefnya ya.');
      scrollToForm();
    }));

    document.getElementById('coSubmit')?.addEventListener('click', () => {
      const g = (id) => (document.getElementById(id)?.value || '').trim();
      const name = g('coName'), brief = g('coBrief');
      if (!name || !brief) { window.toast?.('Nama dan kebutuhan belum diisi ya.'); return; }
      const lines = [
        'Halo SherlyStudio! Saya mau ajukan brief kolaborasi.',
        '',
        'Nama: ' + name,
        'Kontak: ' + (g('coContact') || '-'),
        'Layanan: ' + (g('coService') || '-'),
        'Karakter: ' + (g('coChar') || '-'),
        'Budget: ' + (g('coBudget') || '-'),
        'Deadline: ' + (g('coDeadline') || '-'),
        '',
        'Kebutuhan:',
        brief,
        '',
        '\u2014 dikirim dari halaman Kolaborasi SherlyStudio'
      ];
      const num = String(cfg.whatsapp || '').replace(/\D/g, '');
      const url = 'https://wa.me/' + (num ? num + '?' : '?') + 'text=' + encodeURIComponent(lines.join('\n'));
      window.open(url, '_blank', 'noopener');
      window.toast?.(num ? 'Brief dibuka di WhatsApp \u2014 tinggal kirim!' : 'Nomor WA studio belum diatur (collab-data.js) \u2014 pilih kontak tujuan di WhatsApp.');
    });
  };
})();
