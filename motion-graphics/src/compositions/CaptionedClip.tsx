/**
 * D-249 — "Klip Bersubtitle" (template Motion Graphics #2).
 *
 * Menempelkan subtitle pada video. Cue diambil dari teks mentah: satu baris
 * = satu cue, durasi dibagi rata (atau memakai format SRT sederhana
 * "00:00:01,000 --> 00:00:04,000").
 *
 * Format cue mengikuti tipe `Caption` dari @remotion/captions (skill
 * remotion-captions): {text, startMs, endMs, timestampMs, confidence}.
 *
 * Aturan remotion-markup: animasi WAJIB useCurrentFrame() + interpolate();
 * CSS animation/transition tidak akan ter-render.
 */
import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {safePadding, theme, typeScale} from '../theme';

export type CaptionCue = {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs: number | null;
  confidence: number | null;
};

export type CaptionedClipProps = {
  /** URL video (http(s) absolut atau file://). */
  src?: string;
  /** Baris subtitle mentah (satu baris = satu cue) atau SRT. */
  captionsText?: string;
  /** Cue siap pakai (diprioritaskan daripada captionsText). */
  cues?: CaptionCue[];
  durationInSeconds?: number;
  accent?: string;
};

const SRT_TIME = /(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})/g;

/** Ubah "00:00:01,000" -> milidetik. */
function parseSrtTime(value: string): number {
  const m = value.match(SRT_TIME);
  if (!m) return 0;
  const [, h, mm, ss, ms] = m;
  return (
    Number(h) * 3600_000 +
    Number(mm) * 60_000 +
    Number(ss) * 1000 +
    Number(ms.padEnd(3, '0'))
  );
}

/**
 * Parse teks subtitle mentah -> daftar cue.
 * Dua format didukung:
 *  1. SRT  ("1\n00:00:01,000 --> 00:00:04,000\nTeks")
 *  2. Baris polos (satu baris = satu cue, durasi dibagi rata).
 */
export function parseCaptions(raw: string, totalMs: number): CaptionCue[] {
  const text = String(raw || '').trim();
  if (!text) return [];

  const srtCue = /(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})/;
  if (srtCue.test(text)) {
    const blocks = text.split(/\r?\n\r?\n/);
    const cues: CaptionCue[] = [];
    for (const block of blocks) {
      const lines = block
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const timeLine = lines.find((l) => srtCue.test(l));
      if (!timeLine) continue;
      const body = lines.filter((l) => l !== timeLine && !/^\d+$/.test(l)).join(' ');
      if (!body) continue;
      const times = timeLine.match(SRT_TIME);
      if (!times || times.length < 8) continue;
      const startMs = parseSrtTime(times.slice(0, 4).join(':'));
      const endMs = parseSrtTime(times.slice(4, 8).join(':'));
      cues.push({
        text: body,
        startMs,
        endMs: Math.max(endMs, startMs + 200),
        timestampMs: startMs,
        confidence: null,
      });
    }
    if (cues.length) return cues;
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const slot = Math.max(1200, Math.floor(totalMs / lines.length));
  return lines.map((line, i) => {
    const startMs = Math.min(i * slot, Math.max(0, totalMs - 600));
    return {
      text: line,
      startMs,
      endMs: Math.min(startMs + slot, totalMs),
      timestampMs: startMs,
      confidence: null,
    };
  });
}

export const CaptionedClip: React.FC<CaptionedClipProps> = ({
  src,
  captionsText = '',
  cues,
  durationInSeconds = 8,
  accent = theme.pinkBright,
}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const type = typeScale(width);
  const pad = safePadding(width);

  const totalMs = Math.max(1, Math.round(durationInSeconds * 1000));
  const allCues = cues && cues.length ? cues : parseCaptions(captionsText, totalMs);
  const nowMs = (frame / fps) * 1000;

  const active = allCues.find((c) => nowMs >= c.startMs && nowMs <= c.endMs);

  // Muncul/tutup halus per cue (fade 180ms) — pakai frame, bukan CSS.
  let cueOpacity = 0;
  let cueRise = 12;
  if (active) {
    const inMs = nowMs - active.startMs;
    const outMs = active.endMs - nowMs;
    cueOpacity = Math.min(
      interpolate(inMs, [0, 180], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
      interpolate(outMs, [0, 180], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
    );
    cueRise = interpolate(inMs, [0, 180], [12, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Video sumber (kalau ada) */}
      {src ? (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <video
            src={src}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </AbsoluteFill>
      ) : (
        /* Tanpa video: latar bergradasi + hint */
        <AbsoluteFill
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            backgroundImage: `radial-gradient(ellipse at 50% 40%, ${theme.plum} 0%, ${theme.bg} 68%)`,
          }}
        >
          <div
            style={{
              fontSize: type.body,
              color: theme.textGhost,
              textAlign: 'center',
              maxWidth: width - pad * 2,
              lineHeight: 1.5,
            }}
          >
            Tempel video untuk diberi subtitle.
          </div>
        </AbsoluteFill>
      )}

      {/* Caption bar — posisi aman di bawah tengah */}
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingBottom: Math.round(height * 0.09),
          paddingLeft: pad,
          paddingRight: pad,
        }}
      >
        {active ? (
          <div
            style={{
              maxWidth: width - pad * 2,
              backgroundColor: 'rgba(4,7,15,0.86)',
              border: `1px solid ${theme.line}`,
              borderRadius: Math.round(width * 0.014),
              padding: `${Math.round(width * 0.014)}px ${Math.round(width * 0.022)}px`,
              opacity: cueOpacity,
              transform: `translateY(${cueRise}px)`,
            }}
          >
            <div
              style={{
                fontSize: type.body,
                fontWeight: 600,
                lineHeight: 1.35,
                color: theme.white,
                textAlign: 'center',
                textShadow: `0 2px 10px ${accent}33`,
              }}
            >
              {active.text}
            </div>
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
