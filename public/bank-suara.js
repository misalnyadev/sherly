// Bank Suara Sherly — kelola klip TTS tersimpan (Pengaturan → Bank Suara)
(function () {
  const $ = (id) => document.getElementById(id);
  const panel = () => $('bankSuaraPanel');
  const fmtBytes = (n) => {
    n = Number(n) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  };
  const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' · ' + new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
  const authHeaders = async () => { const t = (await window.sherlyGetAccessToken?.()) || window.sherlyStoredToken?.()?.access_token || ''; return { 'Authorization': 'Bearer ' + t }; };
  const jsonHeaders = async () => ({ 'Content-Type': 'application/json', ...(await authHeaders()) });
  const voicePrefs = () => { try { const p = JSON.parse(localStorage.getItem('sherly.voicePrefs') || '{}'); return { voice: p.voice || 'Zephyr', style: typeof p.style === 'string' ? p.style : '' }; } catch { return { voice: 'Zephyr', style: '' }; } };

  // 12 frasa umum WA sehari-hari (gaya Sherly) — dicicil direkam ke Bank Suara
  const COMMON_PHRASES = [
    'Halo!',
    'Oke, noted ya.',
    'Wkwk iya sih.',
    'Bentar ya, aku pikir bentar.',
    'Menurutku sih bagus.',
    'Gampang kok, gini caranya.',
    'Bisa dicoba dulu deh.',
    'Ide bagus tuh.',
    'Kamu gimana?',
    'Semangat ya!',
    'Nanti aku kabari lagi.',
    'Siap, nanti aku cek.',
  ];

  let clips = [];
  let playing = null; // { audio, btn }
  function stopPlaying() { if (playing) { try { playing.audio.pause(); } catch {} playing.btn?.classList.remove('playing'); playing = null; } }

  async function deleteClip(id, btn) {
    btn.disabled = true;
    try {
      const r = await fetch('/api/ai/tts/bank/' + encodeURIComponent(id), { method: 'DELETE', headers: await authHeaders() });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Gagal menghapus'); }
      clips = clips.filter(c => c.id !== id);
      render();
      window.toast?.('Klip dihapus dari Bank Suara.');
    } catch (e) { window.toast?.(e.message); btn.disabled = false; }
  }

  async function playClip(id, btn) {
    if (playing && playing.id === id) { stopPlaying(); return; }
    stopPlaying();
    btn.disabled = true;
    try {
      const r = await fetch('/api/ai/tts/bank/' + encodeURIComponent(id) + '/audio', { headers: await authHeaders() });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Gagal memutar klip'); }
      const url = URL.createObjectURL(await r.blob());
      const audio = new Audio(url);
      playing = { id, audio, btn };
      audio.onended = () => { URL.revokeObjectURL(url); stopPlaying(); };
      audio.onerror = () => { URL.revokeObjectURL(url); stopPlaying(); window.toast?.('Gagal memutar audio.'); };
      await audio.play();
    } catch (e) { window.toast?.(e.message); } finally { btn.disabled = false; }
  }

  function render() {
    const list = $('bankSuaraList');
    if (!list) return;
    if (!clips.length) { list.innerHTML = '<p class="bank-suara-empty">Bank Suara masih kosong. Klik <b>Siapkan 12 frasa umum</b>, atau pakai tombol Dengarkan di chat — setiap pengucapan otomatis tersimpan.</p>'; return; }
    list.innerHTML = '';
    for (const clip of clips) {
      const row = document.createElement('div');
      row.className = 'bank-clip';
      const playBtn = document.createElement('button');
      playBtn.type = 'button'; playBtn.className = 'bank-clip-play'; playBtn.title = 'Putar klip';
      playBtn.setAttribute('aria-label', 'Putar klip');
      playBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.52.86l10.2-6.5a1 1 0 0 0 0-1.7L9.52 4.64A1 1 0 0 0 8 5.5z"/></svg>';
      playBtn.addEventListener('click', () => playClip(clip.id, playBtn));
      const body = document.createElement('div');
      body.className = 'bank-clip-body';
      const text = document.createElement('div');
      text.className = 'bank-clip-text'; text.textContent = clip.text;
      const meta = document.createElement('div');
      meta.className = 'bank-clip-meta';
      meta.textContent = `${clip.provider === 'gemini' ? 'Gemini' : clip.provider} · ${clip.voice}${clip.style ? ' · “' + clip.style + '”' : ''} · ${fmtBytes(clip.bytes)} · ${fmtDate(clip.created_at)}`;
      body.append(text, meta);
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'bank-clip-del'; del.title = 'Hapus klip'; del.setAttribute('aria-label', 'Hapus klip');
      del.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7"/></svg>';
      del.addEventListener('click', () => { if (confirm('Hapus klip ini dari Bank Suara?')) deleteClip(clip.id, del); });
      row.append(playBtn, body, del);
      list.appendChild(row);
    }
  }

  async function loadBankSuara() {
    if (!panel()) return;
    stopPlaying();
    const list = $('bankSuaraList');
    if (list) list.innerHTML = '<p class="bank-suara-empty">Memuat Bank Suara...</p>';
    try {
      const r = await fetch('/api/ai/tts/bank', { headers: await authHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || ('Gagal memuat Bank Suara (' + r.status + ')'));
      clips = d.clips || [];
      $('bankStCount').textContent = String(d.total ?? clips.length);
      $('bankStBytes').textContent = fmtBytes(d.bytes);
      $('bankStVoice').textContent = voicePrefs().voice;
      render();
    } catch (e) {
      $('bankStCount').textContent = '–'; $('bankStBytes').textContent = '–'; $('bankStVoice').textContent = voicePrefs().voice;
      if (list) list.innerHTML = `<p class="bank-suara-empty">${e.message}</p>`;
    }
  }
  window.loadBankSuara = loadBankSuara;

  // ---------- Upload massal dari VoiceBox lokal ----------
  let pending = []; // { file, text }
  function renderPending() {
    const list = $('bankUploadList');
    if (!list) return;
    list.innerHTML = '';
    pending.forEach((item, i) => {
      const row = document.createElement('div');
      row.className = 'bank-upload-row';
      const fname = document.createElement('span');
      fname.className = 'bank-upload-fname'; fname.title = item.file.name; fname.textContent = item.file.name;
      const input = document.createElement('input');
      input.type = 'text'; input.value = item.text; input.maxLength = 140;
      input.setAttribute('aria-label', 'Teks untuk ' + item.file.name);
      input.addEventListener('input', () => { item.text = input.value; });
      const rm = document.createElement('button');
      rm.type = 'button'; rm.innerHTML = '✕'; rm.title = 'Hapus dari daftar';
      rm.addEventListener('click', () => { pending.splice(i, 1); renderPending(); });
      row.append(fname, input, rm);
      list.appendChild(row);
    });
    const count = $('bankUploadCount');
    if (count) count.textContent = pending.length ? `${pending.length} file siap diupload` : '';
    const btn = $('bankUploadBtn');
    if (btn) btn.disabled = pending.length === 0;
  }
  const defaultTextFor = (name) => String(name || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();

  document.addEventListener('DOMContentLoaded', () => {
    if (!panel()) return;
    $('bankUploadPickBtn')?.addEventListener('click', () => $('bankUploadInput')?.click());
    $('bankUploadInput')?.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      for (const file of files) pending.push({ file, text: defaultTextFor(file.name) });
      e.target.value = '';
      renderPending();
    });
    $('bankUploadBtn')?.addEventListener('click', async () => {
      if (!pending.length) return;
      const btn = $('bankUploadBtn'), progress = $('bankProgress');
      const prefs = voicePrefs();
      btn.disabled = true;
      let uploaded = 0, skipped = 0, failed = 0;
      const items = [...pending];
      for (let i = 0; i < items.length; i++) {
        progress.textContent = `Mengunggah ${i + 1}/${items.length} — ${items[i].file.name}...`;
        try {
          const fd = new FormData();
          fd.append('audio', items[i].file, items[i].file.name);
          fd.append('texts', JSON.stringify([items[i].text]));
          fd.append('voice', prefs.voice);
          fd.append('style', prefs.style);
          const headers = await authHeaders(); // tanpa Content-Type — browser set multipart boundary
          const r = await fetch('/api/ai/tts/bank/upload', { method: 'POST', headers, body: fd });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) { failed++; progress.textContent = `Mengunggah ${i + 1}/${items.length} — gagal: ${d.error || r.status}`; continue; }
          uploaded += d.uploaded || 0; skipped += d.skipped || 0; failed += d.failed || 0;
        } catch (err) { failed++; progress.textContent = `Mengunggah ${i + 1}/${items.length} — error: ${err.message}`; }
      }
      progress.textContent = `Selesai — ${uploaded} klip baru masuk bank, ${skipped} sudah ada, ${failed} gagal.`;
      pending = [];
      renderPending();
      btn.disabled = false;
      await loadBankSuara();
      window.toast?.(`Bank Suara: ${uploaded} klip baru dari VoiceBox lokal.`);
    });
  });

  document.addEventListener('DOMContentLoaded', () => {
    if (!panel()) return;
    $('bankSuaraRefreshBtn')?.addEventListener('click', loadBankSuara);
    $('bankClearBtn')?.addEventListener('click', async () => {
      if (!confirm('Kosongkan SELURUH Bank Suara? Semua rekaman akan dihapus dan perlu direkam ulang.')) return;
      const btn = $('bankClearBtn'); btn.disabled = true;
      try {
        const r = await fetch('/api/ai/tts/bank', { method: 'DELETE', headers: await authHeaders() });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Gagal mengosongkan');
        window.toast?.(`Bank Suara dikosongkan (${d.deleted || 0} klip).`);
        await loadBankSuara();
      } catch (e) { window.toast?.(e.message); } finally { btn.disabled = false; }
    });
    $('bankPrepareBtn')?.addEventListener('click', async () => {
      const btn = $('bankPrepareBtn'), progress = $('bankProgress');
      const prefs = voicePrefs();
      btn.disabled = true;
      let fresh = 0, cached = 0, failed = 0;
      for (let i = 0; i < COMMON_PHRASES.length; i++) {
        progress.textContent = `Merekam frasa ${i + 1}/${COMMON_PHRASES.length} (${prefs.voice})...`;
        try {
          const r = await fetch('/api/ai/tts', { method: 'POST', headers: await jsonHeaders(), body: JSON.stringify({ text: COMMON_PHRASES[i], voice: prefs.voice, style: prefs.style }) });
          if (!r.ok) { failed++; continue; }
          await r.blob(); // tuntas = tersimpan di Bank Suara (atau dari cache)
          if (r.headers.get('X-TTS-Source') === 'cache') cached++; else fresh++;
        } catch { failed++; }
      }
      progress.textContent = `Selesai — ${fresh} klip baru direkam, ${cached} sudah ada di bank${failed ? `, ${failed} gagal (cek API key Gemini)` : ''}.`;
      btn.disabled = false;
      await loadBankSuara();
      window.toast?.('Bank Suara terisi frasa umum Sherly.');
    });
  });
})();
