// AI Provider Manager UI — reads/writes via /api/ai-keys (admin session required).
// Depends on globals from the main page script: api, esc, toast, ICONS (for icon injection).
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const PROVIDER_LABEL = { groq: 'Groq', gemini: 'Google Gemini', openrouter: 'OpenRouter' };
  let keyCache = [];
  let keyModalMode = 'add'; // add | edit | rotate

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

  function renderProviderCards({ keys, envFallback }) {
    const env = envFallback || {};
    const container = $('vaultProviderCards');
    container.innerHTML = ['groq', 'gemini', 'openrouter'].map((p) => {
      const pKeys = keys.filter((k) => k.provider === p);
      const active = pKeys.filter((k) => k.is_active);
      const failing = pKeys.filter((k) => k.health_status === 'failing');
      const ready = active.length > 0 || env[p];
      const headline = ready ? (failing.length ? 'Perlu perhatian' : 'Siap dipakai') : 'Belum ada key';
      const headlineClass = ready ? (failing.length ? 'failing' : 'ok') : 'unknown';
      const detail = active.length
        ? `${active.length} key vault aktif dari ${pKeys.length} key tersimpan`
        : (env[p] ? 'Tidak ada key vault aktif — memakai fallback env server' : 'Tambahkan API key agar provider ini bisa dipakai');
      return `<div class="vault-card">
        <h3>${esc(PROVIDER_LABEL[p])}</h3>
        <p>${esc(detail)}</p>
        <div class="vault-meta">${pill(headlineClass === 'ok' ? 'ok' : headlineClass)} <span>${esc(headline)}</span> ${env[p] ? '<span class="pill env">ENV FALLBACK</span>' : ''} ${failing.length ? `<span class="pill failing">${failing.length} FAILING</span>` : ''}</div>
      </div>`;
    }).join('');
  }

  function renderKeysTable(keys) {
    const tbody = document.querySelector('#vaultKeysTable tbody');
    if (!keys.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="color:var(--muted);white-space:normal">Belum ada API key tersimpan. Klik “Tambah API Key” untuk menambahkan key pertama (terenkripsi AES-256-GCM).</td></tr>';
      return;
    }
    tbody.innerHTML = keys.map((k) => `<tr>
      <td><b>${esc(k.key_name)}</b></td>
      <td>${esc(PROVIDER_LABEL[k.provider] || k.provider)}</td>
      <td><code>••••${esc(k.last4)}</code></td>
      <td>${esc(k.priority)}</td>
      <td><button class="toggle-btn ${k.is_active ? '' : 'off'}" data-toggle="${esc(k.id)}" data-active="${k.is_active ? '1' : '0'}">${k.is_active ? 'Aktif' : 'Nonaktif'}</button></td>
      <td>${pill(k.health_status)}${k.consecutive_failures ? ` <small style="color:var(--muted)">(${esc(k.consecutive_failures)}x gagal)</small>` : ''}</td>
      <td>${esc(fmtDate(k.last_used_at))}</td>
      <td>
        <button class="outline-btn icon-btn" data-test="${esc(k.id)}" title="Uji koneksi (probe ringan, ~0 token)"><span data-icon="sparkles"></span></button>
        <button class="outline-btn icon-btn" data-rotate="${esc(k.id)}" title="Rotasi: ganti nilai key"><span data-icon="refresh-cw"></span></button>
        <button class="outline-btn icon-btn" data-edit="${esc(k.id)}" title="Edit nama & prioritas"><span data-icon="pencil"></span></button>
        <button class="outline-btn icon-btn danger-btn" data-delete="${esc(k.id)}" title="Hapus key"><span data-icon="plus" style="transform:rotate(45deg);display:inline-block"></span></button>
      </td>
    </tr>`).join('');
    injectIcons(tbody);
    tbody.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => toggleKey(b.dataset.toggle, b.dataset.active !== '1')));
    tbody.querySelectorAll('[data-test]').forEach((b) => b.addEventListener('click', () => testKey(b.dataset.test)));
    tbody.querySelectorAll('[data-rotate]').forEach((b) => b.addEventListener('click', () => openKeyModal('rotate', findKey(b.dataset.rotate))));
    tbody.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openKeyModal('edit', findKey(b.dataset.edit))));
    tbody.querySelectorAll('[data-delete]').forEach((b) => b.addEventListener('click', () => deleteKey(b.dataset.delete)));
  }
  const findKey = (id) => keyCache.find((k) => k.id === id);

  async function loadAIProviders() {
    const tbody = document.querySelector('#vaultKeysTable tbody');
    try {
      const data = await api('/api/ai-keys');
      keyCache = data.keys || [];
      const banner = $('vaultBanner');
      if (data.warning || !data.vaultConfigured) {
        banner.style.display = 'block';
        banner.textContent = data.warning || 'AI_ENCRYPTION_KEY belum dikonfigurasi di Vercel/server. Chat tetap berjalan memakai env fallback (jika ada), tetapi vault nonaktif.';
      } else if (data.vaultSelfTest === false) {
        banner.style.display = 'block';
        banner.textContent = 'AI_ENCRYPTION_KEY ada tetapi self-test enkripsi gagal. Periksa nilai env (harus 64 karakter hex: openssl rand -hex 32).';
      } else {
        banner.style.display = 'none';
      }
      renderProviderCards(data);
      renderKeysTable(keyCache);
    } catch (error) {
      keyCache = [];
      renderProviderCards({ keys: [], envFallback: {} });
      tbody.innerHTML = `<tr><td colspan="8" style="color:var(--muted);white-space:normal">Gagal memuat vault: ${esc(error.message)}</td></tr>`;
    }
  }
  window.loadAIProviders = loadAIProviders;

  // --- Modal handling (add | edit | rotate) ---
  function openKeyModal(mode, item) {
    keyModalMode = mode;
    $('keyFormId').value = item?.id || '';
    $('keyModalTitle').textContent = mode === 'add' ? 'Tambah API Key' : mode === 'edit' ? 'Edit API Key' : 'Rotasi API Key';
    $('keyProvider').value = item?.provider || 'groq';
    $('keyProvider').disabled = mode !== 'add';
    $('keyName').value = item?.key_name || '';
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
        toast(data.probe?.ok ? 'Key tersimpan dan koneksi valid.' : 'Key tersimpan, tetapi probe gagal: ' + (data.probe?.error || 'unknown'));
      } else if (keyModalMode === 'edit') {
        const body = { key_name: $('keyName').value.trim(), priority: Number($('keyPriority').value) || 100 };
        await api('/api/ai-keys/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        toast('Key diperbarui.');
      } else { // rotate
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
  async function testKey(id) {
    try {
      const data = await api('/api/ai-keys/' + encodeURIComponent(id) + '/test', { method: 'POST' });
      toast(data.probe?.ok ? 'Probe berhasil — key valid.' : 'Probe gagal: ' + (data.probe?.error || 'unknown'));
      loadAIProviders();
    } catch (error) { toast(error.message); }
  }
  async function deleteKey(id) {
    const key = findKey(id);
    if (!key || !confirm(`Hapus key “${key.key_name}” (${PROVIDER_LABEL[key.provider] || key.provider})? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      await api('/api/ai-keys/' + encodeURIComponent(id), { method: 'DELETE' });
      toast('Key dihapus.');
      loadAIProviders();
    } catch (error) { toast(error.message); }
  }

  $('addProviderKeyBtn')?.addEventListener('click', () => openKeyModal('add', null));
  $('cancelKeyBtn')?.addEventListener('click', closeKeyModal);
  $('refreshKeysBtn')?.addEventListener('click', loadAIProviders);
  $('keyForm')?.addEventListener('submit', submitKeyForm);
  $('keyModal')?.addEventListener('click', (e) => { if (e.target.id === 'keyModal') closeKeyModal(); });
})();
