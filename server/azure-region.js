/**
 * D-279 — Azure Speech: deteksi region otomatis + pesan error yang bisa dibaca.
 *
 * ⚠️ MASALAH YANG DIPERBAIKI (D-278 → D-279):
 * Kode D-278 memaksa region `southeastasia` dan TIDAK PERNAH menanyakan region
 * ke user. Padahal kunci Azure Speech **hanya valid di region tempat resource
 * dibuat**. Akibatnya user yang membuat resource di `eastus` / `westeurope` /
 * `jakarta` / dll. selalu dapat:
 *
 *   HTTP 401 — "Access denied due to invalid subscription key or wrong API
 *   endpoint. Make sure to provide a valid key for an active subscription and
 *   use a correct regional API endpoint for your resource."
 *
 * Itu yang bikin Azure "gagal" bagi user, BUKAN karena free tier-nya rusak.
 *
 * Solusi D-279:
 *   1. Simpan region per-key (kolom `metadata` di `ai_provider_keys`).
 *   2. Kalau region tidak diisi/ salah → **coba beberapa region umum** otomatis
 *      (mulai dari region yang disimpan, lalu daftar region umum).
 *   3. Error 401/403 → pesan dalam Bahasa Indonesia yang jelas + Region kandidat.
 *
 * Catatan jujur soal free tier (koreksi klaim D-278):
 * - Paket F0 = 500.000 karakter neural/bulan, reset bulanan, tidak kedaluwarsa.
 * - Azure Free subscription **wajib** kartu kredit/debit untuk verifikasi
 *   (hold sementara ~$1 yang dikembalikan) dan free account **dinonaktifkan
 *   setelah 30 hari** kalau tidak pindah ke pay-as-you-go.
 * - Jadi F0 bukan "tanpa info pembayaran" — koreksi atas klaim D-278.
 */

import { AZURE_SPEECH_HOST, AZURE_SPEECH_DEFAULT_REGION } from './tts-providers.js';

/**
 * Region Azure Speech yang paling sering dipakai (urutan prioritas tries).
 * Daftar ini hanya untuk mencoba — kunci tetap milik satu region tertentu.
 */
export const AZURE_COMMON_REGIONS = [
  'southeastasia',
  'jakarta',
  'eastus',
  'westeurope',
  'northeurope',
  'uksouth',
  'eastasia',
  'australiaeast',
  'centralindia',
  'japaneast',
  'koreacentral',
  'canadacentral',
  'brazilsouth',
];

/**
 * Normalisasi region: lowercase, tanpa spasi, hanya karakter region valid.
 * @param {string} region
 * @returns {string}
 */
export function normalizeAzureRegion(region) {
  const r = String(region || '').trim().toLowerCase().replace(/\s+/g, '');
  return /^[a-z0-9-]{2,30}$/.test(r) ? r : '';
}

/**
 * Susun daftar region untuk dicoba (tanpa duplikat).
 * @param {string} [preferred] region yang disimpan untuk key ini
 * @returns {string[]}
 */
export function azureRegionCandidates(preferred) {
  const list = [];
  const push = (r) => {
    const n = normalizeAzureRegion(r);
    if (n && !list.includes(n)) list.push(n);
  };
  push(preferred);
  push(process.env.AZURE_SPEECH_REGION);
  push(AZURE_SPEECH_DEFAULT_REGION);
  for (const r of AZURE_COMMON_REGIONS) push(r);
  return list;
}

/**
 * Error Azure Speech → pesan Bahasa Indonesia yang bisa ditindaklanjuti.
 * @param {number} status
 * @param {string} raw pesan asli dari Azure
 * @param {string[]} triedRegions
 * @returns {string}
 */
export function azureErrorMessage(status, raw, triedRegions = []) {
  const regions = triedRegions.length ? triedRegions.join(', ') : '(tidak ada)';
  const base = String(raw || '').slice(0, 200);
  if (status === 401) {
    return `Azure Speech: kunci ditolak (401). Kunci hanya valid di region tempat resource dibuat. `
      + `Region yang dicoba: ${regions}. `
      + `Perbaiki: buka Azure Portal → resource Speech → "Keys and Endpoint", salin KEY 1 dan kolom "Location/Region", `
      + `lalu isi Region di form key (contoh: eastus). ${base ? '— Azure: ' + base : ''}`;
  }
  if (status === 403) {
    return `Azure Speech: akses ditolak (403). Kemungkinan kuota F0 bulan ini habis atau resource terkunci. `
      + `Region yang dicoba: ${regions}. ${base ? '— Azure: ' + base : ''}`;
  }
  if (status === 404) {
    return `Azure Speech: region tidak ditemukan (404). Region yang dicoba: ${regions}. `
      + `Pastikan region ditulis persis seperti di Azure Portal (tanpa spasi). ${base ? '— Azure: ' + base : ''}`;
  }
  if (status === 429) {
    return `Azure Speech:-rate limit / kuota habis (429). Batas F0 = 20 permintaan per menit. Region yang dicoba: ${regions}. ${base ? '— Azure: ' + base : ''}`;
  }
  return `Azure Speech error (${status}). Region yang dicoba: ${regions}. ${base}`;
}

/**
 * Uji satu region: GET /cognitiveservices/voices/list.
 * @param {string} apiKey
 * @param {string} region
 * @param {AbortSignal} signal
 * @returns {Promise<{ok: boolean, status: number, message: string, voices: any[]}>}
 */
export async function probeAzureRegion(apiKey, region, signal) {
  const reg = normalizeAzureRegion(region);
  try {
    const res = await fetch(`https://${reg}.${AZURE_SPEECH_HOST}/cognitiveservices/voices/list`, {
      headers: {Accept: 'application/json', 'Ocp-Apim-Subscription-Key': apiKey},
      signal: signal || AbortSignal.timeout(20000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = String(data?.message || data?.error?.message || `HTTP ${res.status}`).slice(0, 200);
      return {ok: false, status: res.status, message: msg, voices: []};
    }
    const voices = Array.isArray(data) ? data : [];
    return {ok: true, status: res.status, message: '', voices};
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      return {ok: false, status: 0, message: 'timeout', voices: []};
    }
    return {ok: false, status: 0, message: String(error?.message || 'network error').slice(0, 200), voices: []};
  }
}

/**
 * Cari region yang benar untuk sebuah kunci Azure.
 *
 * Strategi:
 * 1. Coba daftar kandidat (region tersimpan → env → default → region umum).
 * 2. Kembalikan region pertama yang merespons 200.
 * 3. Kalau semuanya 401 → tetap kembalikan region kandidat PERTAMA supaya
 *    pesan errornya informatif (region yang dicoba + saran perbaikan).
 *
 * @param {string} apiKey
 * @param {string} [preferredRegion]
 * @param {AbortSignal} [signal]
 * @returns {Promise<{region: string, ok: boolean, status: number, message: string, voices: any[], tried: string[]}>}
 */
export async function detectAzureRegion(apiKey, preferredRegion = '', signal) {
  const tried = azureRegionCandidates(preferredRegion);
  let last = {status: 0, message: 'tidak ada region yang dicoba'};
  for (const region of tried) {
    const res = await probeAzureRegion(apiKey, region, signal);
    if (res.ok) {
      return {region, ok: true, status: res.status, message: '', voices: res.voices, tried};
    }
    last = res;
    // 401 = kunci tidak cocok dengan region ini → coba region lain.
    // 429/403 = kunci benar, quota masalah → jangan coba region lain.
    if (res.status === 403 || res.status === 429) {
      return {region, ok: false, status: res.status, message: res.message, voices: [], tried};
    }
  }
  return {region: tried[0] || '', ok: false, status: last.status, message: last.message, voices: [], tried};
}
