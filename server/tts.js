// Text-to-speech via Google Gemini TTS (uses the same vault/env Gemini keys as chat).
// Returns a complete WAV (PCM 16-bit mono, 24 kHz default) so browsers can play it directly.
import { createHash } from 'node:crypto';

export const DEFAULT_VOICE = process.env.GEMINI_TTS_VOICE || 'Kore';

/** Hash stabil untuk cache: provider+model+voice+teks (bukan per akun — per akun dijaga RLS tabel). */
export function ttsClipHash({ provider = 'gemini', model, voice, text }) {
  return createHash('sha256').update([provider, model, voice, String(text || '')].join('|')).digest('hex').slice(0, 40);
}
// Candidate TTS models in priority order — set GEMINI_TTS_MODEL to pin a specific one.
export const TTS_MODEL_CANDIDATES = [process.env.GEMINI_TTS_MODEL, 'gemini-3.8-flash-tts', 'gemini-2.5-flash-preview-tts'].filter(Boolean);

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
 * Synthesize `text` to audio. Resolves { wav: Buffer, model, voice }.
 * Throws with a descriptive Error on failure (caller decides fallback).
 */
export async function synthesizeSpeech({ apiKey, text, voiceName = DEFAULT_VOICE, models = TTS_MODEL_CANDIDATES }) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 1500);
  if (!clean) throw new Error('Teks untuk suara kosong.');
  let lastError = null;
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const body = {
      contents: [{ parts: [{ text: clean }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
    };
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45000),
      });
      const data = await res.json().catch(() => ({}));
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
      const rateMatch = /rate=(\d+)/.exec(mime || '');
      const sampleRate = rateMatch ? Number(rateMatch[1]) : 24000;
      const wav = pcmToWav(Buffer.from(b64, 'base64'), sampleRate);
      return { wav, model, voice: voiceName, sampleRate };
    } catch (error) {
      lastError = error;
      if (/not found|not supported|is not available/i.test(String(error?.message || ''))) continue;
      throw error;
    }
  }
  throw lastError || new Error('Model TTS tidak tersedia. Set GEMINI_TTS_MODEL di environment.');
}
