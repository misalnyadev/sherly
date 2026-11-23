// Text-to-speech via Google Gemini TTS (uses the same vault/env Gemini keys as chat).
// Returns a complete WAV (PCM 16-bit mono, 24 kHz default) so browsers can play it directly.
import { createHash } from 'node:crypto';

export const DEFAULT_VOICE = process.env.GEMINI_TTS_VOICE || 'Zephyr';

/** 14 prebuilt Gemini voices dengan deskripsi Indonesia (dipakai UI & validasi). */
export const GEMINI_TTS_VOICES = [
  { id: 'Kore', label: 'Kore · Tegas & hangat' },
  { id: 'Aoede', label: 'Aoede · Ringan & santai' },
  { id: 'Leda', label: 'Leda · Muda & ceria' },
  { id: 'Zephyr', label: 'Zephyr · Cerah & semangat' },
  { id: 'Sulafat', label: 'Sulafat · Lembut & ramah' },
  { id: 'Callirrhoe', label: 'Callirrhoe · Kalem & mengalir' },
  { id: 'Despina', label: 'Despina · Halus & akrab' },
  { id: 'Puck', label: 'Puck · Riang & akrab' },
  { id: 'Charon', label: 'Charon · Tenang & dalam' },
  { id: 'Fenrir', label: 'Fenrir · Tegas & semangat' },
  { id: 'Orus', label: 'Orus · Mantap & hangat' },
  { id: 'Iapetus', label: 'Iapetus · Jernih & santai' },
  { id: 'Enceladus', label: 'Enceladus · Lembut & dekat' },
  { id: 'Umbriel', label: 'Umbriel · Kalem & tenang' },
];
export const GEMINI_TTS_VOICE_IDS = new Set(GEMINI_TTS_VOICES.map(v => v.id));
export const MAX_STYLE_LEN = 180;
/** Bersihkan style hint dari karakter berbahaya; batasi panjang. */
export function sanitizeStyleHint(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\r\n\t]+/g, ' ').replace(/[:;]{2,}/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_STYLE_LEN);
}

/** Hash stabil untuk cache: provider+model+voice+style+teks. */
export function ttsClipHash({ provider = 'gemini', model, voice, style = '', text }) {
  return createHash('sha256').update([provider, model, voice, String(style || ''), String(text || '')].join('|')).digest('hex').slice(0, 40);
}
// Candidate TTS models in priority order — set GEMINI_TTS_MODEL to pin a specific one.
export const TTS_MODEL_CANDIDATES = [process.env.GEMINI_TTS_MODEL, 'gemini-3.8-flash-tts', 'gemini-2.5-flash-preview-tts'].filter(Boolean);

/**
 * Fade-out linear 25ms di ujung PCM 16-bit agar tidak ada "klik/kresek" saat audio berakhir.
 * Juga dibuang kalau panjang ganjil (artefak decode).
 */
export function fadeOutTrailingPcm(pcm, sampleRate = 24000, fadeMs = 25) {
  let buf = pcm;
  if (buf.length % 2 !== 0) buf = buf.subarray(0, buf.length - 1);
  const totalSamples = buf.length / 2;
  const fadeSamples = Math.min(Math.floor((sampleRate * fadeMs) / 1000), Math.floor(totalSamples / 2));
  if (fadeSamples <= 0) return buf;
  const out = Buffer.from(buf); // copy
  for (let i = 0; i < fadeSamples; i++) {
    const gain = 1 - i / fadeSamples;
    const idx = totalSamples - fadeSamples + i;
    const cur = out.readInt16LE(idx * 2);
    out.writeInt16LE(Math.round(cur * gain), idx * 2);
  }
  return out;
}

/** Wrap raw PCM (16-bit LE mono) in a RIFF/WAVE container. */
export function pcmToWav(pcm, sampleRate = 24000) {
  const numChannels = 1, bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcm.length;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20);  // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}

/**
 * D-283: hitung durasi WAV (detik) dari header file.
 *
 * ⚠️ BUG YANG DIPERBAIKI: sebelumnya durasi audio TTS diperkirakan dari
 * `base64.length * 0.75 / 16000` — itu mengasumsikan PCM 16 kHz, padahal
 * Gemini TTS menghasilkan **WAV 24 kHz mono 16-bit** (48.000 byte/detik).
 * Akibatnya durasi **dihitung ~3x lebih besar** dari kenyataan:
 *   - naskah 5 detik  -> dianggap 15 detik
 *   - naskah 4 detik  -> dianggap 12 detik
 * Karena InfiniteTalk hanya menerima audio <= 15 detik, hampir SETIAP
 * naskah realistic ditolak "Audio terlalu panjang" sebelum sampai ke Kie.
 * (Data live: 4 task lipsync gagal dengan durasi tercatat 11-12 detik.)
 *
 * Sekarang durasi dibaca PERSIS dari header WAV (sampleRate + dataSize),
 * jadi gatekeeper sesuai dengan kenyataan. Kalau bukan WAV / header rusak,
 * jatuh ke heuristik konservatif yang dulu.
 */
export function wavDurationSeconds(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || '');
  if (buf.length < 44) return 0;
  // Cari chunk 'fmt ' lalu 'data' (chunk WAV bisa disisipkan LIST dsb).
  let offset = 12;
  let byteRate = 0;
  let dataSize = 0;
  let sampleRate = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === 'fmt ') {
      // Layout chunk 'fmt ': size(4) audioFormat(2) numChannels(2)
      //                  sampleRate(4) byteRate(4) blockAlign(2) bits(2)
      sampleRate = buf.readUInt32LE(offset + 12);
      byteRate = buf.readUInt32LE(offset + 16);
    } else if (id === 'data') {
      dataSize = size;
      break;
    }
    offset += 8 + size + (size % 2);
  }
  if (byteRate > 0 && dataSize > 0) return dataSize / byteRate;
  if (sampleRate > 0 && dataSize > 0) {
    // Fallback: 16-bit mono asumsi (2 byte per sample).
    return dataSize / (sampleRate * 2);
  }
  return 0;
}

/**
 * D-283: durasi audio (detik) dari base64, seakurat mungkin.
 * Base64 -> byte -> header WAV. Kalau bukan WAV, pakai heuristik lama.
 */
export function audioDurationFromBase64(base64) {
  const buf = Buffer.from(String(base64 || ''), 'base64');
  const wav = wavDurationSeconds(buf);
  if (wav > 0) return Math.max(1, Math.round(wav));
  // Fallback konservatif: asumsikan PCM 16-bit mono 24 kHz (48.000 B/detik),
  // bukan 16 kHz seperti estimation lama yang bikin durasi 3x lebih besar.
  return Math.max(1, Math.round((buf.length / 48000)));
}

/**
 * Synthesize `text` to audio. Resolves { wav: Buffer, model, voice }.
 * Throws with a descriptive Error on failure (caller decides fallback).
 */
export async function synthesizeSpeech({ apiKey, text, voiceName = DEFAULT_VOICE, style = '', models = TTS_MODEL_CANDIDATES }) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 1500);
  const styleHint = sanitizeStyleHint(style);
  if (!clean) throw new Error('Teks untuk suara kosong.');
  let lastError = null;
  const callFormat = (model, modern) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    // Format modern: gaya bicara dikirim sebagai speech_metadata (instruksi, BUKAN teks yang dibaca).
    const speechPart = modern
      ? { text: clean, ...(styleHint ? { speech_metadata: { style: styleHint } } : {}) }
      : { text: clean }; // fallback legacy: gaya tidak disisipkan agar tidak ikut dibacakan
    const voiceConfig = modern ? { voice: voiceName } : { prebuiltVoiceConfig: { voiceName } };
    const body = {
      contents: [{ role: 'user', parts: [speechPart] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig },
      },
    };
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45000),
    });
  };
  for (const model of models) {
    try {
      let res = await callFormat(model, true);
      let data = await res.json().catch(() => ({}));
      if (!res.ok && res.status === 400) {
        // Model lama tidak mengenal format modern -> coba sekali format legacy (tanpa style).
        res = await callFormat(model, false);
        data = await res.json().catch(() => ({}));
      }
      if (!res.ok) {
        const msg = data?.error?.message || `Gemini TTS error (${res.status})`;
        // Model tidak ada -> coba kandidat berikutnya; error lain -> lempar langsung
        if (/not found|not supported|is not available/i.test(msg) || res.status === 404) { lastError = new Error(msg); continue; }
        throw new Error(msg);
      }
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const inline = parts.find(p => p?.inlineData?.data || p?.inline_data?.data);
      const b64 = inline?.inlineData?.data || inline?.inline_data?.data;
      const mime = inline?.inlineData?.mimeType || inline?.inline_data?.mime_type || '';
      if (!b64) throw new Error('Gemini TTS tidak mengembalikan audio.');
      const rateMatch = /rate=(\d+)/i.exec(mime || '');
      const sampleRate = rateMatch ? Number(rateMatch[1]) : 24000;
      const raw = Buffer.from(b64, 'base64');
      // Gemini kadang langsung mengirim WAV lengkap — jangan dibungkus dua kali.
      const alreadyWav = /wav/i.test(mime || '') || (raw.length > 12 && raw.toString('ascii', 0, 4) === 'RIFF');
      const wav = alreadyWav ? raw : pcmToWav(fadeOutTrailingPcm(raw, sampleRate), sampleRate);
      return { wav, model, voice: voiceName, sampleRate };
    } catch (error) {
      lastError = error;
      if (/not found|not supported|is not available/i.test(String(error?.message || ''))) continue;
      throw error;
    }
  }
  throw lastError || new Error('Model TTS tidak tersedia. Set GEMINI_TTS_MODEL di environment.');
}
