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
  function renderProviderCards({ groups, envFallback }) {
    const env = envFallback || {};
    const container = $('vaultProviderCards');
    container.innerHTML = PROVIDERS.map((p) => {
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
        <p>${esc(detail)}</p>
        <div class="vault-meta">${pill(headlineClass === 'ok' ? 'ok' : headlineClass)} <span>${esc(headline)}</span> ${env[p] ? '<span class="pill env">ENV FALLBACK</span>' : ''} ${failing ? `<span class="pill failing">${failing} FAILING</span>` : ''}</div>
        <div class="vault-model">
          <label for="model-${p}">Model yang dipakai Chat Sherly</label>
          <div class="vault-model-row">
            <input id="model-${p}" list="dl-${p}" value="${esc(current)}" placeholder="model-id" aria-label="Model ${esc(PROVIDER_LABEL[p])}">
            <button class="outline-btn" data-fetch-models="${p}" type="button">Ambil daftar</button>
            <button class="outline-btn" data-save-model="${p}" type="button">Simpan</button>
          </div>
          <datalist id="dl-${p}"></datalist>
          <div class="vault-model-src">Sumber model: ${esc(sourceLabel)} · “Ambil daftar” memuat model terbaru langsung dari ${esc(PROVIDER_LABEL[p])}</div>
        </div>
      </div>`;
    }).join('');
    container.querySelectorAll('[data-fetch-models]').forEach(b => b.addEventListener('click', () => fetchModels(b.dataset.fetchModels, b)));
    container.querySelectorAll('[data-save-model]').forEach(b => b.addEventListener('click', () => saveModel(b.dataset.saveModel, b)));
  }

  async function fetchModels(provider, btn) {
    const input = $(`model-${provider}`);
    const dl = $(`dl-${provider}`);
    if (btn) { btn.disabled = true; btn.textContent = 'Memuat...'; }
    try {
      const data = await api('/api/ai-provider-models/' + provider);
      const models = data.models || [];
      dl.innerHTML = models.map(m => `<option value="${esc(m.id)}">${esc(m.id + (m.recommended ? ' — disarankan' : ''))}</option>`).join('');
      const current = input.value.trim();
      const stillThere = models.some(m => m.id === current);
      toast(stillThere
        ? `${models.length} model tersedia — rekomendasi diurutkan paling atas.`
        : `${models.length} model tersedia. Model tersimpan "${current}" tidak ditemukan — pilih model baru.`);
      if (!stillThere && models[0]) input.value = models.find(m => m.recommended)?.id || models[0].id;
    } catch (error) {
      toast('Gagal mengambil daftar model: ' + error.message);
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

  function renderGroupsTable(groups) {
    const tbody = document.querySelector('#vaultKeysTable tbody');
    if (!groups.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="color:var(--muted);white-space:normal">Belum ada API key tersimpan. Klik “Tambah API Key” — satu label bisa menampung banyak key sekaligus.</td></tr>';
      return;
    }
    tbody.innerHTML = groups.map((g) => `
    <tr class="group-row">
      <td><b>${esc(g.key_name)}</b><br><small style="color:var(--muted)">${g.total} key · ${g.active_count} aktif</small></td>
      <td>${esc(PROVIDER_LABEL[g.provider] || g.provider)}</td>
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
    $('keyModal').classList.add('open');
  }
  function closeKeyModal() { $('keyModal').classList.remove('open'); }

  async function submitKeyForm(e) {
    e.preventDefault();
    const id = $('keyFormId').value;
    const btn = $('saveKeyBtn');
    btn.disabled = true;
    try {
      if (keyModalMode === 'add') {
        const body = { provider: $('keyProvider').value, key_name: $('keyName').value.trim(), api_key: $('keyValue').value.trim(), priority: Number($('keyPriority').value) || 100 };
        const data = await api('/api/ai-keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        toast(data.probe?.ok ? `Key tersimpan & valid (grup “${body.key_name}”).` : 'Key tersimpan, tetapi probe gagal: ' + (data.probe?.error || 'unknown'));
      } else if (keyModalMode === 'edit') {
        const body = { key_name: $('keyName').value.trim(), priority: Number($('keyPriority').value) || 100 };
        await api('/api/ai-keys/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        toast('Key diperbarui.');
      } else {
        const body = { api_key: $('keyValue').value.trim() };
        const data = await api('/api/ai-keys/' + encodeURIComponent(id) + '/rotate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        toast(data.probe?.ok ? 'Key dirotasi dan koneksi valid.' : 'Key dirotasi, tetapi probe gagal: ' + (data.probe?.error || 'unknown'));
      }
      closeKeyModal();
      loadAIProviders();
    } catch (error) {
      toast(error.message);
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
  $('refreshKeysBtn')?.addEventListener('click', loadAIProviders);
  $('keyForm')?.addEventListener('submit', submitKeyForm);
  $('keyModal')?.addEventListener('click', (e) => { if (e.target.id === 'keyModal') closeKeyModal(); });
})();
