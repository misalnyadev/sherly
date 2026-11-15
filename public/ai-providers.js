// AI Provider Manager UI — /api/ai-keys (admin session). One label can hold many keys (a group).
// Depends on globals from the main page script: api, esc, toast, ICONS.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const PROVIDERS = ['groq', 'gemini', 'openrouter'];
  const PROVIDER_LABEL = { groq: 'Groq', gemini: 'Google Gemini', openrouter: 'OpenRouter' };
  let groupCache = [];
  let modelCache = {};
  let keyModalMode = 'add'; // add | edit | rotate
  let addPrefill = null;    // {provider, key_name}
  // Capability taxonomy (server sends authoritative list; fallbacks keep UI alive if payload lama)
  const FALLBACK_CAPABILITIES = [
    { id: 'chat', label: 'Teks & Logika', short: 'Teks', badge: 'message', description: 'Chat, reasoning, copywriting & analisis — otak utama Sherly.' },
    { id: 'vision', label: 'Vision / Analisis Gambar', short: 'Vision', badge: 'eye', description: 'Memahami isi gambar & referensi visual.' },
    { id: 'tts', label: 'Text-to-Speech', short: 'TTS', badge: 'audio-lines', description: 'Mengubah teks menjadi voiceover.' },
    { id: 'image_gen', label: 'Text-to-Image', short: 'T2I', badge: 'gallery', description: 'Studio: generate gambar dari prompt (mis. kie.ai).' },
    { id: 'image_edit', label: 'Image-to-Image', short: 'I2I', badge: 'pencil', description: 'Studio: restyle/edit gambar dengan prompt (mis. kie.ai).' },
    { id: 'video_gen', label: 'Text-to-Video', short: 'T2V', badge: 'clapperboard', description: 'Studio: generate video dari prompt (mis. kie.ai).' },
    { id: 'video_edit', label: 'Image-to-Video', short: 'I2V', badge: 'film', description: 'Studio: animasi/clip dari gambar (mis. kie.ai).' },
  ];
  const FALLBACK_PROVIDER_CAPS = { groq: ['chat', 'vision'], gemini: ['chat', 'vision', 'tts'], openrouter: ['chat', 'vision'] };
  let capabilityRegistry = FALLBACK_CAPABILITIES;
  let providerCapabilities = FALLBACK_PROVIDER_CAPS;
  let activeCapability = 'all';
  let lastAIPayload = null;

  const capById = (id) => capabilityRegistry.find(c => c.id === id);
  const capsOf = (provider) => providerCapabilities[provider] || [];
  const iconSvg = (key) => { try { const P = (typeof ICONS !== 'undefined') ? ICONS : {}; return P[key] ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[key]}</svg>` : ''; } catch (e) { return ''; } };
  const providersForCap = (capId) => PROVIDERS.filter(p => capsOf(p).includes(capId));
  function capabilityBadges(provider) {
    return capsOf(provider).map(id => { const c = capById(id); return c ? `<span class="cap-badge" title="${esc(c.label)}">${iconSvg(c.badge)}${esc(c.short || c.label)}</span>` : ''; }).join('');
  }
  function renderCapabilityTabs() {
    const wrap = $('capabilityTabs');
    if (!wrap) return;
    const tabs = [{ id: 'all', label: 'Semua', short: 'Semua', badge: 'sparkles' }].concat(capabilityRegistry);
    wrap.innerHTML = tabs.map(t => {
      const count = t.id === 'all' ? PROVIDERS.length : providersForCap(t.id).length;
      return `<button type="button" class="cap-tab${activeCapability === t.id ? ' active' : ''}" data-cap-tab="${esc(t.id)}" role="tab" aria-selected="${activeCapability === t.id}"><span>${t.badge ? iconSvg(t.badge) : ''}${esc(t.label)}</span><small>${count}</small></button>`;
    }).join('');
    wrap.querySelectorAll('[data-cap-tab]').forEach(b => b.addEventListener('click', () => {
      activeCapability = b.dataset.capTab;
      renderCapabilityTabs();
      if (lastAIPayload) { renderProviderCards(lastAIPayload); renderGroupsTable(lastGroups); }
    }));
  }
  function showCapabilityEmptyIfNeeded() {
    const empty = $('capabilityEmpty');
    const cards = $('vaultProviderCards');
    const panel = $('vaultGroupsPanel');
    const visibleProviders = PROVIDERS.filter(p => activeCapability === 'all' || capsOf(p).includes(activeCapability));
    const isEmpty = visibleProviders.length === 0;
    if (empty) {
      const cap = capById(activeCapability);
      if (isEmpty && cap) {
        empty.hidden = false;
        empty.innerHTML = `<h3>${iconSvg(cap.badge)} ${esc(cap.label)}</h3><p>${esc(cap.description || '')}</p><p>Belum ada provider terdaftar untuk kategori ini. Di roadmap: <b>kie.ai</b> (text-to-image, image-to-image, text-to-video, image-to-video) serta provider TTS khusus — tab ini akan terisi otomatis begitu key-nya ditambahkan.</p><p><small>Sambil menunggu, kategori <b>Teks &amp; Logika</b> / <b>Vision</b> sudah bisa dipakai dengan key Groq, Gemini, atau OpenRouter yang tersimpan.</small></p>`;
      } else {
        empty.hidden = true;
        empty.innerHTML = '';
      }
    }
    if (cards) cards.style.display = isEmpty ? 'none' : '';
    if (panel) panel.style.display = isEmpty ? 'none' : '';
    return isEmpty;
  }

  function injectIcons(root) {
    if (typeof ICONS === 'undefined') return;
    root.querySelectorAll('[data-icon]').forEach((el) => {
      const paths = ICONS[el.dataset.icon];
      if (paths) el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + paths + '</svg>';
    });
  }
  const pill = (status) => `<span class="pill ${esc(status || 'unknown')}">${esc((status || 'unknown').toUpperCase())}</span>`;
  const fmtDate = (iso) => {
    if (!iso) return '—';
    try { return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)); }
    catch { return String(iso); }
  };
  const findKey = (id) => groupCache.flatMap(g => g.keys).find(k => k.id === id);
  const findGroup = (key) => groupCache.find(g => g.key === key);

  // ---------- Provider cards (status + model selector) ----------
  function renderProviderCards(payload) {
    const { groups, envFallback } = payload || {};
    if (showCapabilityEmptyIfNeeded()) return;
    const env = envFallback || {};
    const visibleProviders = PROVIDERS.filter(p => activeCapability === 'all' || capsOf(p).includes(activeCapability));
    const container = $('vaultProviderCards');
    container.innerHTML = visibleProviders.map((p) => {
      const gs = groups.filter(g => g.provider === p);
      const total = gs.reduce((n, g) => n + g.total, 0);
      const active = gs.reduce((n, g) => n + g.active_count, 0);
      const failing = gs.reduce((n, g) => n + g.failing_count, 0);
      const ready = active > 0 || env[p];
      const headline = ready ? (failing ? 'Perlu perhatian' : 'Siap dipakai') : 'Belum ada key';
      const headlineClass = ready ? (failing ? 'failing' : 'ok') : 'unknown';
      const detail = active
        ? `${active} key aktif dari ${total} key tersimpan (${gs.length} grup)`
        : (env[p] ? 'Tidak ada key vault aktif — memakai fallback env server' : 'Tambahkan API key agar provider ini bisa dipakai');
      const current = modelCache[p]?.model || '—';
      const source = modelCache[p]?.source || 'default';
      const sourceLabel = source === 'settings' ? 'tersimpan di pengaturan' : 'default aplikasi/env';
      return `<div class="vault-card">
        <h3>${esc(PROVIDER_LABEL[p])}</h3>
        <div class="cap-badges">${capabilityBadges(p)}</div>
        <p>${esc(detail)}</p>
        <div class="vault-meta">${pill(headlineClass === 'ok' ? 'ok' : headlineClass)} <span>${esc(headline)}</span> ${env[p] ? '<span class="pill env">ENV FALLBACK</span>' : ''} ${failing ? `<span class="pill failing">${failing} FAILING</span>` : ''}</div>
        <div class="vault-model">
          <label for="model-${p}">Model yang dipakai Chat Sherly</label>
          <div class="vault-model-row">
            <input id="model-${p}" value="${esc(current)}" placeholder="model-id" autocomplete="off" spellcheck="false" aria-label="Model ${esc(PROVIDER_LABEL[p])}">
            <button class="outline-btn" data-fetch-models="${p}" type="button">Ambil daftar</button>
            <button class="outline-btn" data-save-model="${p}" type="button">Simpan</button>
          </div>
          <div class="model-picker" id="picker-${p}" hidden></div>
          <div class="vault-model-src">Sumber model: ${esc(sourceLabel)} · “Ambil daftar” memuat model terbaru langsung dari ${esc(PROVIDER_LABEL[p])}</div>
        </div>
      </div>`;
    }).join('');
    container.querySelectorAll('[data-fetch-models]').forEach(b => b.addEventListener('click', () => fetchModels(b.dataset.fetchModels, b)));
    container.querySelectorAll('[data-save-model]').forEach(b => b.addEventListener('click', () => saveModel(b.dataset.saveModel, b)));
  }

  function renderModelList(provider, models, query) {
    const list = $(`mlist-${provider}`);
    const q = (query || '').trim().toLowerCase();
    const filtered = models.filter(m => !q || m.id.toLowerCase().includes(q));
    if (!filtered.length) { list.innerHTML = '<div class="model-picker-error">Tidak ada model cocok dengan pencarian.</div>'; return; }
    const MAX = 200;
    list.innerHTML = filtered.slice(0, MAX).map(m => `<button type="button" class="model-item" data-model-id="${esc(m.id)}"><span>${esc(m.id)}</span>${m.recommended ? '<span class="model-badge">DISARANKAN</span>' : ''}</button>`).join('')
      + (filtered.length > MAX ? `<div class="model-count">Menampilkan ${MAX} dari ${filtered.length} — persempit dengan pencarian.</div>` : '');
    list.querySelectorAll('[data-model-id]').forEach(item => item.addEventListener('click', () => {
      $(`model-${provider}`).value = item.dataset.modelId;
      $(`picker-${provider}`).hidden = true;
      toast(`Model dipilih: ${item.dataset.modelId} — klik “Simpan” untuk menyimpan.`);
    }));
  }

  async function fetchModels(provider, btn) {
    const input = $(`model-${provider}`);
    const picker = $(`picker-${provider}`);
    if (btn) { btn.disabled = true; btn.textContent = 'Memuat...'; }
    picker.hidden = false;
    picker.innerHTML = '<div class="model-picker-error">Mengambil daftar model...</div>';
    try {
      const data = await api('/api/ai-provider-models/' + provider);
      const models = data.models || [];
      if (!models.length) {
        picker.innerHTML = '<div class="model-picker-error">Provider tidak mengembalikan model apa pun dengan key saat ini.</div>';
        return;
      }
      const current = input.value.trim();
      const stillThere = models.some(m => m.id === current);
      picker.innerHTML = `<div class="model-count">${models.length} model tersedia${stillThere ? '' : ' — model tersimpan tidak ditemukan di daftar ini, pilih pengganti'} · klik untuk memilih</div><input class="model-search" id="msearch-${provider}" placeholder="Cari model (mis. gpt, gemini, llama)..." autocomplete="off" spellcheck="false"><div class="model-list" id="mlist-${provider}"></div>`;
      renderModelList(provider, models, '');
      $(`msearch-${provider}`).addEventListener('input', (e) => renderModelList(provider, models, e.target.value));
      $(`msearch-${provider}`).focus();
    } catch (error) {
      picker.innerHTML = `<div class="model-picker-error">Gagal mengambil daftar model: ${esc(error.message)}<br><small>Sebab umum: key tidak valid/kedaluwarsa — daftar model juga memakai key yang sama, jadi key gagal = daftar gagal. Periksa key di kartu ini, lalu coba lagi.</small></div>`;
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Ambil daftar'; }
    }
  }

  async function saveModel(provider, btn) {
    const input = $(`model-${provider}`);
    const model = input.value.trim();
    if (!model) return toast('Model wajib diisi.');
    if (btn) btn.disabled = true;
    try {
      await api('/api/ai-provider-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, model }) });
      modelCache[provider] = { model, source: 'settings' };
      toast(`Model ${PROVIDER_LABEL[provider]} disimpan: ${model}`);
      loadAIProviders();
    } catch (error) {
      toast(error.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ---------- Groups table (1 label = many keys) ----------
  function memberRows(g) {
    return g.keys.map((k, i) => `<tr>
      <td>#${i + 1}</td>
      <td><code>••••${esc(k.last4)}</code></td>
      <td>${esc(k.priority)}</td>
      <td><button class="toggle-btn ${k.is_active ? '' : 'off'}" data-toggle="${esc(k.id)}" data-active="${k.is_active ? '1' : '0'}">${k.is_active ? 'Aktif' : 'Nonaktif'}</button></td>
      <td>${pill(k.health_status)}${k.consecutive_failures ? ` <small style="color:var(--muted)">(${esc(k.consecutive_failures)}x gagal)</small>` : ''}</td>
      <td>${esc(fmtDate(k.last_used_at))}</td>
      <td>
        <button class="outline-btn icon-btn" data-test="${esc(k.id)}" title="Uji koneksi"><span data-icon="sparkles"></span></button>
        <button class="outline-btn icon-btn" data-rotate="${esc(k.id)}" title="Rotasi: ganti nilai key"><span data-icon="refresh-cw"></span></button>
        <button class="outline-btn icon-btn" data-edit="${esc(k.id)}" title="Edit label & prioritas"><span data-icon="pencil"></span></button>
        <button class="outline-btn icon-btn danger-btn" data-delete="${esc(k.id)}" title="Hapus key ini"><span data-icon="plus" style="transform:rotate(45deg);display:inline-block"></span></button>
      </td>
    </tr>`).join('');
  }

  let lastGroups = [];
  function renderGroupsTable(groupRows) {
    lastGroups = groupRows || [];
    const groups = lastGroups.filter(g => activeCapability === 'all' || capsOf(g.provider).includes(activeCapability));
    const tbody = document.querySelector('#vaultKeysTable tbody');
    if (!groups.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="color:var(--muted);white-space:normal">Belum ada API key tersimpan. Klik “Tambah API Key” — satu label bisa menampung banyak key sekaligus.</td></tr>';
      return;
    }
    tbody.innerHTML = groups.map((g) => `
    <tr class="group-row">
      <td><b>${esc(g.key_name)}</b><br><small style="color:var(--muted)">${g.total} key · ${g.active_count} aktif</small></td>
      <td>${esc(PROVIDER_LABEL[g.provider] || g.provider)}<div class="provider-caps">${capabilityBadges(g.provider)}</div></td>
      <td>${g.keys.map(k => `<span class="key-chip">••••${esc(k.last4)}</span>`).join(' ')}</td>
      <td>${esc(g.priority)}</td>
      <td><button class="toggle-btn ${g.active_count ? '' : 'off'}" data-group-toggle="${esc(g.key)}">${g.active_count ? 'Nonaktifkan' : 'Aktifkan'}</button></td>
      <td>${pill(g.health_status)}${g.failing_count ? ` <small style="color:var(--muted)">(${g.failing_count} failing)</small>` : ''}</td>
      <td>${esc(fmtDate(g.last_used_at))}</td>
      <td>
        <button class="outline-btn icon-btn" data-group-add="${esc(g.key)}" title="Tambah key ke grup ini"><span data-icon="plus"></span></button>
        <button class="outline-btn icon-btn" data-group-test="${esc(g.key)}" title="Uji semua key di grup"><span data-icon="sparkles"></span></button>
        <button class="group-expand" data-group-expand="${esc(g.key)}" title="Lihat isi grup">▸</button>
        <button class="outline-btn icon-btn danger-btn" data-group-delete="${esc(g.key)}" title="Hapus seluruh grup"><span data-icon="plus" style="transform:rotate(45deg);display:inline-block"></span></button>
      </td>
    </tr>
    <tr class="member-row" data-members="${esc(g.key)}" hidden><td colspan="8">
      <table class="member-table"><thead><tr><th>#</th><th>Key</th><th>Prioritas</th><th>Status</th><th>Kesehatan</th><th>Terakhir dipakai</th><th>Aksi</th></tr></thead><tbody>${memberRows(g)}</tbody></table>
    </td></tr>`).join('');
    injectIcons(tbody);

    tbody.querySelectorAll('[data-group-toggle]').forEach(b => b.addEventListener('click', () => toggleGroup(b.dataset.groupToggle)));
    tbody.querySelectorAll('[data-group-test]').forEach(b => b.addEventListener('click', () => testGroup(b.dataset.groupTest)));
    tbody.querySelectorAll('[data-group-add]').forEach(b => b.addEventListener('click', () => openKeyModal('add', null, findGroup(b.dataset.groupAdd))));
    tbody.querySelectorAll('[data-group-delete]').forEach(b => b.addEventListener('click', () => deleteGroup(b.dataset.groupDelete)));
    tbody.querySelectorAll('[data-group-expand]').forEach(b => b.addEventListener('click', () => {
      const row = tbody.querySelector(`[data-members="${CSS.escape(b.dataset.groupExpand)}"]`);
      if (!row) return;
      row.hidden = !row.hidden;
      b.textContent = row.hidden ? '▸' : '▾';
    }));
    tbody.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => toggleKey(b.dataset.toggle, b.dataset.active !== '1')));
    tbody.querySelectorAll('[data-test]').forEach(b => b.addEventListener('click', () => testKey(b.dataset.test)));
    tbody.querySelectorAll('[data-rotate]').forEach(b => b.addEventListener('click', () => openKeyModal('rotate', findKey(b.dataset.rotate))));
    tbody.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openKeyModal('edit', findKey(b.dataset.edit))));
    tbody.querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', () => deleteKey(b.dataset.delete)));
  }

  async function loadAIProviders() {
    const tbody = document.querySelector('#vaultKeysTable tbody');
    try {
      const data = await api('/api/ai-keys');
      lastAIPayload = data;
      capabilityRegistry = (Array.isArray(data.capabilities) && data.capabilities.length) ? data.capabilities : FALLBACK_CAPABILITIES;
      providerCapabilities = data.providerCapabilities || FALLBACK_PROVIDER_CAPS;
      renderCapabilityTabs();
      groupCache = data.groups || [];
      modelCache = data.models || {};
      const banner = $('vaultBanner');
      if (data.warning || !data.vaultConfigured) {
        banner.style.display = 'block';
        banner.textContent = data.warning || 'AI_ENCRYPTION_KEY belum dikonfigurasi di server.';
      } else if (data.vaultSelfTest === false) {
        banner.style.display = 'block';
        banner.textContent = 'AI_ENCRYPTION_KEY ada tetapi self-test enkripsi gagal. Periksa nilai env (openssl rand -hex 32).';
      } else {
        banner.style.display = 'none';
      }
      const dl = $('keyNameSuggestions');
      if (dl) dl.innerHTML = [...new Set(groupCache.map(g => g.key_name))].map(n => `<option value="${esc(n)}"></option>`).join('');
      renderProviderCards(data);
      renderGroupsTable(groupCache);
    } catch (error) {
      groupCache = [];
      modelCache = {};
      renderProviderCards({ groups: [], envFallback: {} });
      tbody.innerHTML = `<tr><td colspan="8" style="color:var(--muted);white-space:normal">Gagal memuat vault: ${esc(error.message)}</td></tr>`;
    }
  }
  window.loadAIProviders = loadAIProviders;

  // ---------- Modal (add to group | edit | rotate) ----------
  function openKeyModal(mode, item, groupPrefill) {
    keyModalMode = mode;
    addPrefill = groupPrefill || (mode === 'add' && item ? { provider: item.provider, key_name: item.key_name } : null);
    $('keyFormId').value = item?.id || '';
    $('keyModalTitle').textContent = mode === 'add' ? (addPrefill ? `Tambah Key ke Grup “${addPrefill.key_name}”` : 'Tambah API Key') : mode === 'edit' ? 'Edit API Key' : 'Rotasi API Key';
    $('keyProvider').value = item?.provider || addPrefill?.provider || 'groq';
    $('keyProvider').disabled = mode !== 'add';
    $('keyName').value = item?.key_name || addPrefill?.key_name || '';
    $('keyName').parentElement.style.display = mode === 'rotate' ? 'none' : 'flex';
    $('keyValueLabel').textContent = mode === 'rotate' ? 'API Key baru *' : 'API Key *';
    $('keyValue').value = '';
    $('keyValue').parentElement.style.display = mode === 'edit' ? 'none' : 'flex';
    $('keyPriority').value = item?.priority ?? 100;
    $('keyPriority').parentElement.style.display = mode === 'rotate' ? 'none' : 'flex';
    $('saveKeyBtn').textContent = mode === 'rotate' ? 'Simpan Key Baru' : 'Simpan Key';
    $('probeKeyBtn').style.display = mode === 'edit' ? 'none' : '';
    resetProbeResult();
    $('keyModal').classList.add('open');
  }
  function closeKeyModal() { $('keyModal').classList.remove('open'); }
  function resetProbeResult() {
    const out = $('probeResult');
    if (!out) return;
    out.hidden = true;
    out.textContent = '';
    out.className = 'probe-result';
  }
  function showProbeResult(kind, message) {
    const out = $('probeResult');
    out.hidden = false;
    out.textContent = message;
    out.className = 'probe-result ' + kind;
  }
  async function testKeyBeforeSave() {
    const btn = $('probeKeyBtn');
    const provider = $('keyProvider').value;
    const api_key = $('keyValue').value.trim();
    if (api_key.length < 8) { showProbeResult('err', '✗ Isi API key dulu (minimal 8 karakter).'); return; }
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = 'Menguji…';
    showProbeResult('pending', 'Menguji koneksi ke ' + (PROVIDER_LABEL[provider] || provider) + '…');
    try {
      const data = await api('/api/ai-keys/probe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, api_key }) });
      if (data.probe?.ok) showProbeResult('ok', '✓ Koneksi OK — key valid. Aman disimpan dengan “Simpan Key”.');
      else showProbeResult('err', '✗ Key DITOLAK. ' + (PROVIDER_LABEL[provider] || provider) + ' menjawab: ' + (data.probe?.error || 'error tidak diketahui'));
    } catch (error) {
      showProbeResult('err', '✗ Gagal menguji: ' + error.message);
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  async function submitKeyForm(e) {
    e.preventDefault();
    const id = $('keyFormId').value;
    const btn = $('saveKeyBtn');
    btn.disabled = true;
    try {
      if (keyModalMode === 'add') {
        const body = { provider: $('keyProvider').value, key_name: $('keyName').value.trim(), api_key: $('keyValue').value.trim(), priority: Number($('keyPriority').value) || 100 };
        const data = await api('/api/ai-keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        toast('Key tersimpan — koneksi valid (grup “' + body.key_name + '”).');
      } else if (keyModalMode === 'edit') {
        const body = { key_name: $('keyName').value.trim(), priority: Number($('keyPriority').value) || 100 };
        await api('/api/ai-keys/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        toast('Key diperbarui.');
      } else {
        const body = { api_key: $('keyValue').value.trim() };
        const data = await api('/api/ai-keys/' + encodeURIComponent(id) + '/rotate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        toast('Key baru tersimpan — koneksi valid.');
      }
      closeKeyModal();
      loadAIProviders();
    } catch (error) {
      toast(error.message);
      if (keyModalMode !== 'edit') showProbeResult('err', '✗ ' + error.message);
    } finally {
      btn.disabled = false;
    }
  }

  async function toggleKey(id, makeActive) {
    try {
      await api('/api/ai-keys/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: makeActive }) });
      toast(makeActive ? 'Key diaktifkan.' : 'Key dinonaktifkan.');
      loadAIProviders();
    } catch (error) { toast(error.message); }
  }
  async function toggleGroup(groupKey) {
    const g = findGroup(groupKey);
    if (!g) return;
    const target = g.active_count === 0;
    try {
      await Promise.all(g.keys.map(k => api('/api/ai-keys/' + encodeURIComponent(k.id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: target }) })));
      toast(target ? `Grup “${g.key_name}” diaktifkan.` : `Grup “${g.key_name}” dinonaktifkan.`);
      loadAIProviders();
    } catch (error) { toast(error.message); loadAIProviders(); }
  }
  async function testKey(id) {
    try {
      const data = await api('/api/ai-keys/' + encodeURIComponent(id) + '/test', { method: 'POST' });
      toast(data.probe?.ok ? 'Probe berhasil — key valid.' : 'Probe gagal: ' + (data.probe?.error || 'unknown'));
      loadAIProviders();
    } catch (error) { toast(error.message); }
  }
  async function testGroup(groupKey) {
    const g = findGroup(groupKey);
    if (!g) return;
    toast(`Menguji ${g.keys.length} key di grup “${g.key_name}”...`);
    let ok = 0, failed = 0;
    for (const k of g.keys) {
      try {
        const data = await api('/api/ai-keys/' + encodeURIComponent(k.id) + '/test', { method: 'POST' });
        if (data.probe?.ok) ok += 1; else failed += 1;
      } catch { failed += 1; }
    }
    toast(`Hasil uji grup “${g.key_name}”: ${ok} valid, ${failed} gagal.`);
    loadAIProviders();
  }
  async function deleteKey(id) {
    const key = findKey(id);
    if (!key || !confirm(`Hapus key “${key.key_name}” (••••${key.last4})?`)) return;
    try {
      await api('/api/ai-keys/' + encodeURIComponent(id), { method: 'DELETE' });
      toast('Key dihapus.');
      loadAIProviders();
    } catch (error) { toast(error.message); }
  }
  async function deleteGroup(groupKey) {
    const g = findGroup(groupKey);
    if (!g || !confirm(`Hapus seluruh grup “${g.key_name}” (${g.total} key)? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      await api('/api/ai-keys/group', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: g.provider, key_name: g.key_name }) });
      toast('Grup dihapus.');
      loadAIProviders();
    } catch (error) { toast(error.message); }
  }

  $('addProviderKeyBtn')?.addEventListener('click', () => openKeyModal('add', null));
  $('cancelKeyBtn')?.addEventListener('click', closeKeyModal);
  $('probeKeyBtn')?.addEventListener('click', testKeyBeforeSave);
  $('keyProvider')?.addEventListener('change', resetProbeResult);
  $('keyValue')?.addEventListener('input', resetProbeResult);
  $('refreshKeysBtn')?.addEventListener('click', loadAIProviders);
  $('keyForm')?.addEventListener('submit', submitKeyForm);
  $('keyModal')?.addEventListener('click', (e) => { if (e.target.id === 'keyModal') closeKeyModal(); });
})();
