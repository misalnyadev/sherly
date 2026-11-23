/**
 * D-281 — ElevenLabs: pesan error yang bisa ditindaklanjuti.
 *
 * ⚠️ MASALAH YANG DIPERBAIKI: user melaporkan
 *   "✗ Key DITOLAK. elevenlabs menjawab: elevenlabs error (401)"
 * padahal key-nya **baru dibuat**. Pesan itu tidak berguna karena kode kita
 * TIDAK membaca `detail.code` dari ElevenLabs — padahal di sanalah informasi
 * yang dibutuhkan ada.
 *
 * Format error ElevenLabs (dari dokumentasi resmi `elevenlabs.io/docs/eleven-api/resources/errors`):
 *
 *   {
 *     "detail": {
 *       "type": "authentication_error",
 *       "code": "invalid_api_key" | "missing_api_key" | "missing_permissions" | ...,
 *       "message": "...",
 *       "status": "invalid_api_key_prefix"
 *     }
 *   }
 *
 * Type:
 *   - `authentication_error` → 401 (kunci invalid / belum dikirim / kurang permission)
 *   - `authorization_error`  → 403 (permission kurang / fitur tidak ada di plan)
 *
 * Code yang sering muncul:
 *   - `invalid_api_key`        → kunci salah / dicopy key_id, bukan `sk_...`
 *   - `missing_api_key`        → header `xi-api-key` tidak terkirim
 *   - `missing_permissions`    → **"Restrict Key" masih on dengan permission No Access**
 *   - `invalid_api_key_prefix` → kunci tidak diawali `sk_` (key_id yang dipaste)
 *   - `quota_exceeded`         → kuota habis (401)
 *   - `paid_plan_required`     → free plan tidak boleh pakai Voice Library (402)
 *
 * Dua penyebab yang paling sering terjadi pada user BARU:
 *
 * 1. **"Restrict Key" + permission "No Access"** (paling sering).
 *    ElevenLabs menyalakan Restrict Key untuk SETIAP key baru, dengan semua
 *    permission = "No Access". Jadi key **tidak bisa dipakai apa-apa** sampai
 *    user meng-edit key-nya dan menyalakan:
 *      - Text to Speech → **Access**
 *      - Voices → **Read**
 *      - User → **Read**
 *
 * 2. **Free tier diblokir dari IP data-center / VPN** (`free_tier_usage_disabled`).
 *    ⚠️ PENTING untuk Sherly: server produksi berjalan di **Vercel = data center**,
 *    dan ElevenLabs kadang memblokir akun gratis yang dipakai dari alamat
 *    data-center atau VPN. Flag ini **tidak bisa dibatalkan** oleh ElevenLabs —
 *    hanya prepaid credit / plan berbayar yang mengatasinya.
 */

/**
 * Ambil pesan/code/type dari respons error ElevenLabs.
 * @param {object} data payload JSON dari ElevenLabs
 * @returns {{code: string, type: string, message: string, status: string}}
 */
export function parseElevenlabsError(data) {
  const detail = data?.detail;
  let obj = {};
  if (Array.isArray(detail)) {
    obj = detail[0] || {};
  } else if (detail && typeof detail === 'object') {
    obj = detail;
  } else if (typeof detail === 'string') {
    obj = {message: detail};
  }
  return {
    code: String(obj?.code || '').trim(),
    type: String(obj?.type || '').trim(),
    message: String(obj?.message || '').trim(),
    status: String(obj?.status || '').trim(),
  };
}

/**
 * Pesan Bahasa Indonesia yang bisa ditindaklanjuti untuk error ElevenLabs.
 * @param {number} httpStatus status HTTP dari ElevenLabs
 * @param {object} data payload JSON dari ElevenLabs
 * @returns {string}
 */
export function elevenlabsErrorMessage(httpStatus, data) {
  const {code, type, message, status} = parseElevenlabsError(data);
  const raw = message || `elevenlabs error (${httpStatus})`;
  const detail = code || status || type;

  // --- Permission key belum diaktifkan (penyebab paling sering: key baru) ---
  if (code === 'missing_permissions' || /missing the permission|permission .* to execute/i.test(raw)) {
    return 'ElevenLabs: key-nya belum diberi izin. Key baru ElevenLabs MATI secara default '
      + '("Restrict Key" aktif, semua permission = No Access). '
      + 'Perbaiki: elevenlabs.io → Profile → API Keys → klik "⋯" pada key → Edit → '
      + 'nyalakan "Text to Speech: Access" + "Voices: Read" + "User: Read" → Save. ' + `(${raw})`;
  }

  // --- Key ID yang dipaste, bukan API key penuh ---
  if (code === 'invalid_api_key_prefix' || /must start with .sk_|key_id/i.test(raw)) {
    return 'ElevenLabs: yang dipaste bukan API key yang benar. Di halaman API Keys ada dua hal: '
      + '"API Key ID" dan "API Key" — yang dipakai adalah API KEY PENUH yang diawali "sk_". '
      + 'Salin ulang field API Key (bukan ID-nya), dan paste tanpa spasi/newline. ' + `(${raw})`;
  }

  // --- Free tier diblokir dari data center / VPN ---
  if (code === 'free_tier_usage_disabled' || /free tier usage disabled/i.test(raw)) {
    return 'ElevenLabs: akun gratis dinonaktifkan karena dipakai dari alamat data-center/VPN. '
      + '⚠️ Server Sherly berjalan di Vercel (data center) — ini yang memicu flag tersebut, '
      + 'dan ElevenLabs tidak bisa membatalkannya. Solusi: (1) pakai TTSForFree sebagai cadangan utama, '
      + 'atau (2) tambah prepaid credit / plan berbayar di ElevenLabs. ' + `(${raw})`;
  }

  // --- Free plan tidak boleh pakai Voice Library ---
  if (code === 'paid_plan_required' || httpStatus === 402 || /free users cannot use library voices/i.test(raw)) {
    return 'ElevenLabs: paket gratis tidak boleh memakai Voice Library lewat API. '
      + 'Gunakan voice "premade" (mis. Rachel, Sarah) atau naikkan plan. ' + `(${raw})`;
  }

  // --- Kuota habis ---
  if (code === 'quota_exceeded' || /quota/i.test(raw)) {
    return `ElevenLabs: kuota habis. Paket gratis = 10.000 karakter/bulan. ${raw}`;
  }

  // --- Kunci tidak valid / dicabut ---
  if (code === 'invalid_api_key' || /invalid api key/i.test(raw)) {
    return 'ElevenLabs: API key ditolak. Possible causes: key dicopy belum utuh (ada spasi/newline), '
      + 'key dicabut/di-regenerate, atau key-nya bukan dari akun ini. '
      + 'Perbaiki: salin ulang dari elevenlabs.io → Profile → API Keys, lalu tes lagi. ' + `(${raw})`;
  }

  if (code === 'missing_api_key' || /neither authorization header nor xi-api-key/i.test(raw)) {
    return `ElevenLabs: header xi-api-key tidak terkirim. ${raw}`;
  }

  // --- 403 umum: permission / IP whitelist ---
  if (httpStatus === 403) {
    return 'ElevenLabs: akses ditolak (403). Cek permission key (Text to Speech: Access + Voices: Read + '
      + 'User: Read) dan whitelist IP di halaman API Keys. ' + `(${raw})`;
  }

  // --- 401 umum (tanpa code yang dikenal) ---
  if (httpStatus === 401) {
    return 'ElevenLabs: kunci ditolak (401). Cek: (1) key yang dicopy adalah API KEY penuh diawali "sk_", '
      + 'bukan "API Key ID"; (2) permission key sudah diaktifkan (Text to Speech: Access + Voices: Read + User: Read); '
      + `(3) belum ada spasi/newline. ${raw}`;
  }

  return `ElevenLabs error (${httpStatus})${detail ? ` [${detail}]` : ''}. ${raw}`;
}
