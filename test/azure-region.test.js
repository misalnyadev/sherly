/**
 * D-279 — Test deteksi region Azure Speech + pesan error yang bisa dibaca.
 *
 * Konteks: user melaporkan "azure gagal". Penyebabnya: kunci Azure Speech
 * hanya valid di region tempat resource dibuat, sedangkan D-278 memaksa
 * region `southeastasia` dan tidak pernah menanyakan region ke user.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAzureRegion,
  azureRegionCandidates,
  azureErrorMessage,
  detectAzureRegion,
  probeAzureRegion,
  AZURE_COMMON_REGIONS,
} from '../server/azure-region.js';

const realFetch = globalThis.fetch;
const seen = [];
function mockFetch(handler) {
  seen.length = 0;
  globalThis.fetch = async (url, opts = {}) => {
    seen.push(String(url));
    return handler(String(url), opts);
  };
}
function restore() {
  globalThis.fetch = realFetch;
}
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {'Content-Type': 'application/json'},
});

// --- normalisasi region ---
test('D-279: normalisasi region membersihkan spasi & huruf besar', () => {
  assert.equal(normalizeAzureRegion('  EastUS '), 'eastus');
  assert.equal(normalizeAzureRegion('Southeast Asia'), 'southeastasia');
  assert.equal(normalizeAzureRegion('jakarta'), 'jakarta');
});

test('D-279: region tidak valid dikembalikan kosong', () => {
  assert.equal(normalizeAzureRegion(''), '');
  assert.equal(normalizeAzureRegion('   '), '');
  assert.equal(normalizeAzureRegion('a'.repeat(40)), '');
  assert.equal(normalizeAzureRegion('bad region!!'), '');
});

// --- kandidat region ---
test('D-279: kandidat region memuat region pilihan user di urutan pertama', () => {
  const list = azureRegionCandidates('eastus');
  assert.equal(list[0], 'eastus');
});

test('D-279: kandidat region tidak punya duplikat', () => {
  const list = azureRegionCandidates('eastus');
  assert.equal(new Set(list).size, list.length);
});

test('D-279: daftar region umum memuat region Indonesia & global', () => {
  assert.ok(AZURE_COMMON_REGIONS.includes('jakarta'));
  assert.ok(AZURE_COMMON_REGIONS.includes('southeastasia'));
  assert.ok(AZURE_COMMON_REGIONS.includes('eastus'));
  assert.ok(AZURE_COMMON_REGIONS.includes('westeurope'));
});

// --- pesan error ---
test('D-279: pesan 401 menjelaskan soal region + cara memperbaiki', () => {
  const msg = azureErrorMessage(401, 'invalid subscription key or wrong API endpoint', ['eastus', 'westus']);
  assert.match(msg, /401/);
  assert.match(msg, /region/i);
  assert.match(msg, /eastus/);
  assert.match(msg, /Keys and Endpoint/i);
});

test('D-279: pesan 403 menjelaskan soal kuota', () => {
  const msg = azureErrorMessage(403, 'quota exceeded', ['eastus']);
  assert.match(msg, /403/);
  assert.match(msg, /kuota/i);
});

test('D-279: pesan 404 menjelaskan soal region typo', () => {
  const msg = azureErrorMessage(404, 'not found', ['southeastasia']);
  assert.match(msg, /404/);
  assert.match(msg, /region/i);
});

test('D-279: pesan 429 menyebut rate limit', () => {
  const msg = azureErrorMessage(429, 'too many requests', ['eastus']);
  assert.match(msg, /429/);
  assert.match(msg, /rate limit|kuota/i);
});

// --- probe per region ---
test('D-279: probe region yang benar mengembalikan voices', async () => {
  mockFetch(async (url) => {
    if (url.includes('eastus.')) return json([{ShortName: 'id-ID-ArdiNeural', Locale: 'id-ID'}]);
    return json({message: 'wrong region'}, 401);
  });
  try {
    const res = await probeAzureRegion('key123', 'eastus');
    assert.equal(res.ok, true);
    assert.equal(res.voices.length, 1);
    assert.equal(res.voices[0].ShortName, 'id-ID-ArdiNeural');
  } finally {
    restore();
  }
});

test('D-279: probe region salah memberi status 401 + pesan', async () => {
  mockFetch(async () => json({message: 'Access denied due to invalid subscription key or wrong API endpoint'}, 401));
  try {
    const res = await probeAzureRegion('key123', 'eastus');
    assert.equal(res.ok, false);
    assert.equal(res.status, 401);
    assert.match(res.message, /invalid subscription key/i);
  } finally {
    restore();
  }
});

// --- deteksi region ---
test('D-279: deteksi menemukan region yang benar walau user isi region keliru', async () => {
  mockFetch(async (url) => {
    if (url.includes('westeurope.')) return json([{ShortName: 'id-ID-GadisNeural', Locale: 'id-ID'}]);
    return json({message: 'wrong region'}, 401);
  });
  try {
    const found = await detectAzureRegion('key123', 'southeastasia');
    assert.equal(found.ok, true);
    assert.equal(found.region, 'westeurope');
    assert.ok(found.tried.includes('southeastasia'));
  } finally {
    restore();
  }
});

test('D-279: deteksi mencoba banyak region sebelum menyerah', async () => {
  mockFetch(async () => json({message: 'invalid subscription key'}, 401));
  try {
    const found = await detectAzureRegion('key123', '');
    assert.equal(found.ok, false);
    assert.equal(found.status, 401);
    // должны mencoba banyak region umum
    assert.ok(found.tried.length >= 5, `hanya ${found.tried.length} region dicoba`);
    assert.ok(found.tried.includes('jakarta'));
  } finally {
    restore();
  }
});

test('D-279: deteksi BERHENTI di region yang benar begitu ketemu', async () => {
  mockFetch(async (url) => {
    if (url.includes('jakarta.')) return json([{Locale: 'id-ID'}]);
    return json({message: 'wrong'}, 401);
  });
  try {
    const found = await detectAzureRegion('key123', '');
    assert.equal(found.ok, true);
    assert.equal(found.region, 'jakarta');
    // tidak boleh mencoba semua region kalau sudah ketemu
    assert.ok(found.tried.length < AZURE_COMMON_REGIONS.length + 3);
  } finally {
    restore();
  }
});

test('D-279: 403 (kuota) tidak mencoba region lain', async () => {
  let calls = 0;
  mockFetch(async () => {
    calls += 1;
    return json({message: 'quota exceeded'}, 403);
  });
  try {
    const found = await detectAzureRegion('key123', '');
    assert.equal(found.ok, false);
    assert.equal(found.status, 403);
    assert.equal(calls, 1, `harusnya 1x saja, bukan ${calls}x`);
  } finally {
    restore();
  }
});

test('D-279: timeout treated sebagai kegagalan, bukan crash', async () => {
  mockFetch(async () => {
    const e = new Error('timeout');
    e.name = 'TimeoutError';
    throw e;
  });
  try {
    const res = await probeAzureRegion('key123', 'eastus');
    assert.equal(res.ok, false);
    assert.equal(res.message, 'timeout');
  } finally {
    restore();
  }
});
