/**
 * D-283 — Pesan error LIPSYNC yang bisa ditindaklanjuti.
 *
 * ⚠️ MASALAH YANG DIPERBAIKI: user melaporkan "fitur karakter berbicara juga
 * belum berhasil". Data live (tabel `sherly_video_tasks`) menunjukkan 4 task
 * lipsync semuanya `status = 'fail'` dengan error:
 *
 *   "ConnectException: Operation timed out (Connection timed out)"
 *
 * Itu error dari backend Kie (Java/Kotlin) — BUKAN error kode kita. Artinya
 * task-nya dibuat dengan sukses (taskId ada!), tapi Kie GAGAL saat menarik
 * file input (gambar potret / audio) dari file host-nya.
 *
 * Dua penyebab nyata yang bisa kita ADDRESS dari sisi Sherly:
 *
 * 1. **Durasi audio salah hitung 3x** (sudah diperbaiki di D-283):
 *    estimasi lama `base64*0.75/16000` menganggap PCM 16 kHz, padahal
 *    Gemini TTS menghasilkan WAV 24 kHz mono 16-bit (48.000 B/detik).
 *    Akibatnya naskah 4 detik dianggap 12 detik, naskah 5 detik dianggap 15
 *    detik -> kena gatekeeper "Audio terlalu panjang" (maks 15 dtk + 3).
 *    Data live: task tercatat 11-12 detik untuk naskah yang jauh lebih pendek.
 *
 * 2. **Error Kie yang tidak diterjemahkan** — user cuma lihat
 *    "ConnectException: Operation timed out" tanpa tahu harus apa.
 *    Sekarang errornya diterjemahkan + diberi saran konkret.
 */

/**
 * Terjemahkan error lipsync (Kie / server) jadi pesan Bahasa Indonesia.
 * @param {string|Error} err error dari Kie atau exception lokal
 * @param {{model?: string, maxSeconds?: number, scriptSeconds?: number}} ctx
 * @returns {string}
 */
export function lipsyncErrorMessage(err, ctx = {}) {
  const raw = String((err && err.message) || err || '').trim();
  const model = ctx.model || 'InfiniteTalk';
  const maxSeconds = ctx.maxSeconds || 15;

  // --- Timeout saat Kie menarik file input (error paling sering) ---
  if (/connectexception|connection timed out|operation timed out|sockettimeout/i.test(raw)) {
    return 'Kie gagal menarik file potret/audio (timeout di sisi Kie). Ini biasanya karena '
      + 'gambar @mention atau file audio terlalu besar, atau Kie sedang sibuk. '
      + 'Coba lagi — kalau tetap gagal, pakai potret karakter yang lebih kecil '
      + '(di bawah ~2 MB) atau pilih model lain (mis. LTX 2.5 Fast). '
      + `(${raw.slice(0, 120)})`;
  }

  // --- Audio terlalu panjang untuk model ---
  if (/audio too long|terlalu panjang|duration.*exceed/i.test(raw)) {
    return `Audio terlalu panjang untuk ${model} (maksimal ${maxSeconds} detik). `
      + 'Pendekkan naskah — maksimal ±' + Math.max(3, Math.floor(maxSeconds * 13 / 10))
      + ' karakter untuk model ini. ' + `(${raw.slice(0, 120)})`;
  }

  // --- Audio terpotong / tidak bisa dibaca ---
  if (/audio.*(invalid|unreadable|decode|corrupt|empty)/i.test(raw)) {
    return 'Audio tidak bisa dibaca Kie. Format WAV 24 kHz mono yang dipakai TTS '
      + 'kadang bermasalah — coba ulang dengan naskah yang lebih pendek. ' + `(${raw.slice(0, 120)})`;
  }

  // --- Gambar ditolak ---
  if (/image.*(invalid|unreadable|too large|exceed|failed)/i.test(raw)) {
    return 'Gambar potret ditolak Kie. Pastikan potret jelas (wajah menghadap depan) '
      + 'dan ukurannya di bawah ~10 MB. ' + `(${raw.slice(0, 120)})`;
  }

  // --- D-286: Kie selesai tapi tidak mengembalikan URL hasil ---
  if (/tidak mengembalikan URL|tidak mengembalikan url|url hasil kosong|no result url/i.test(raw)) {
    return `Kie menandai task selesai tapi tidak mengembalikan URL video untuk ${model}. `
      + 'Ini biasanya terjadi karena format respons Kie berubah atau file hasil '
      + 'sudah kedaluwarsa. Coba ulang — kalau tetap gagal, pakai model lain '
      + '(mis. LTX 2.5 Fast). ' + `(${raw.slice(0, 120)})`;
  }

  // --- D-286: URL input rusak (karakter jejas) ---
  if (/invalid.*url|url.*invalid|malformed url|bad url/i.test(raw)) {
    return `Kie menolak URL file input untuk ${model}. `
      + 'Gambar potret atau audio bermasalah — coba pilih gambar lain atau '
      + 'upload ulang potret karakter. ' + `(${raw.slice(0, 120)})`;
  }

  // --- Kuota kredit Kie habis ---
  if (/credit|insufficient|quota|balance/i.test(raw)) {
    return 'Kredit Kie AI habis. Cek saldo di kie.ai, atau pakai provider lain. ' + `(${raw.slice(0, 120)})`;
  }

  // --- Rate limit ---
  if (/rate limit|too many requests|429/i.test(raw)) {
    return 'Terlalu banyak permintaan ke Kie AI. Tunggu sebentar lalu coba lagi. ' + `(${raw.slice(0, 120)})`;
  }

  // --- Model tidak tersedia ---
  if (/model.*(not found|unavailable|not support)/i.test(raw)) {
    return `Model ${model} tidak tersedia di Kie AI saat ini. Pilih model lain di composer. `
      + `(${raw.slice(0, 120)})`;
  }

  // --- Prompt terlalu panjang (OmniHuman 300 karakter) ---
  if (/prompt.*(too long|exceed|max)/i.test(raw)) {
    return 'Arahan adegan terlalu panjang untuk model ini. '
      + 'Perpendek arahan di kotak "Arahan adegan". ' + `(${raw.slice(0, 120)})`;
  }

  // --- Kunci bermasalah ---
  if (/401|unauthorized|invalid.*key|api key/i.test(raw)) {
    return 'Kunci Kie AI ditolak. Simpan ulang kunci Kie di Pengaturan → Provider & API Key. '
      + `(${raw.slice(0, 120)})`;
  }

  return raw || `Generator ${model} gagal.`;
}

export default lipsyncErrorMessage;
