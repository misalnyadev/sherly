/**
 * D-276 — "Rangkaian Beat" (template Motion Graphics #4).
 *
 * Video pendek (10–30 detik) yang isinya lebih dari satu blok teks:
 * HOOK → BODY → PAYOFF → CTA. Tiap beat punya teks, durasi, dan gaya
 * visual sendiri, dan perpindahannya memberi video "irama" (cut tiap
 * 3–5 detik) — persis struktur short-form yang bikin penonton nahan.
 *
 * Prinsip dari skill remotion-create/video-layout.md:
 *  - Satu beat = SATU hal yang dilihat penonton (jangan cram 2 ide).
 *  - Headline >= 84px (pada 1080), teks pendukung >= 44px.
 *  - Teks penting minimal 80px dari sisi & 100px dari atas/bawah.
 *  - First frame TIDAK boleh frame hitam/logo — hook langsung tampil.
 *
 * Aturan remotion-markup: animasi via useCurrentFrame() + interpolate()/
 * spring(); CSS animation/transition tidak akan ter-render.
 */
import React from 'react';
import {
  AbsoluteFill,
  Audio,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {safePadding, theme, typeScale} from '../theme';
import {beatsFromText, beatAtFrame, type Beat, type BeatRole} from '../beats';

export type BeatSequenceProps = {
  /** Teks beat mentah (pola `=== Nama ===` + baris teks). */
  beatsText?: string;
  brand?: string;
  durationInSeconds?: number;
  accent?: string;
  /** Label tombol CTA (mis. "Simpan Videonya"). Kosong = pakai CTA beat. */
  ctaLabel?: string;
  /**
   * D-276 — URL voice-over TTS (signed URL dari Storage Supabase).
   * Kosong = video tanpa suara.
   */
  audioSrc?: string;
  /** Volume voice-over (0–1). Default 1. */
  volume?: number;
};

/** Gaya per peran beat. */
type RoleStyle = {
  /** Ukuran relatif headline (1 = normal). */
  headlineScale: number;
  /** Latar memakai gradasi plum (true) atau polos (false). */
  plum: boolean;
  /** Tampilkan garis aksen di bawah teks. */
  rule: boolean;
  /** Tampilkan badge peran di atas (mis. "HOOK"). */
  badge: boolean;
  /** Tampilkan tombol CTA (hanya untuk peran cta). */
  ctaButton: boolean;
};

const ROLE_STYLE: Record<BeatRole, RoleStyle> = {
  hook: {headlineScale: 1.18, plum: true, rule: true, badge: false, ctaButton: false},
  body: {headlineScale: 1, plum: false, rule: true, badge: true, ctaButton: false},
  payoff: {headlineScale: 1.08, plum: true, rule: true, badge: true, ctaButton: false},
  cta: {headlineScale: 1, plum: true, rule: false, badge: true, ctaButton: true},
  outro: {headlineScale: 0.9, plum: false, rule: false, badge: false, ctaButton: false},
};

/** Label badge peran (bhs Indonesia, singkat). */
const ROLE_BADGE: Record<BeatRole, string> = {
  hook: 'HOOK',
  body: '',
  payoff: 'HASIL',
  cta: 'SEKARANG',
  outro: 'TERIMA KASIH',
};

export const BeatSequence: React.FC<BeatSequenceProps> = ({
  beatsText = '',
  brand = 'SherlyStudio',
  durationInSeconds = 15,
  accent = theme.pink,
  ctaLabel = '',
  audioSrc = '',
  volume = 1,
}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const type = typeScale(width);
  const pad = safePadding(width);

  const total = Math.max(1, Math.round(durationInSeconds * fps));
  const beats = React.useMemo(
    () => beatsFromText(beatsText, durationInSeconds, fps),
    [beatsText, durationInSeconds, fps],
  );

  const active = beatAtFrame(beats, frame);
  if (!active) return <AbsoluteFill style={{backgroundColor: theme.bg}} />;

  const style = ROLE_STYLE[active.role] || ROLE_STYLE.body;
  const local = frame - active.startFrame;
  const beatFrames = Math.max(1, active.endFrame - active.startFrame);

  // Animasi masuk beat: muncul cepat (spring), lalu tahan.
  const enter = spring({
    frame: local,
    fps,
    config: {damping: 200, mass: 0.7},
  });

  // Keluar: 12% frame terakhir beat.
  const exit = interpolate(
    local,
    [Math.round(beatFrames * 0.88), beatFrames],
    [1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );

  // Fade out terakhir video.
  const fadeOut = interpolate(
    frame,
    [total - Math.round(0.4 * fps), total],
    [1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );

  const visible = enter * exit * fadeOut;
  const rise = interpolate(enter, [0, 1], [34, 0]);
  const headlineSize = Math.round(type.headline * style.headlineScale);

  // Baris pertama = judul besar, sisa baris = subjudul.
  const head = active.lines[0] || '';
  const sub = active.lines.slice(1);

  // Teks tombol CTA.
  // D-276: kalau label tidak diisi, pakai teks handle ("@sherlystudio")
  // kalau ada — bukan mengulang headline (yang bakalan tampil dobel).
  const handle = sub.find((l) => l.trim().startsWith('@'))?.trim() || '';
  const ctaButtonText = ctaLabel.trim() || handle || 'Coba Sekarang';

  // Progress bar beat (indikator irama) di bawah layar.
  const beatProgress = interpolate(local, [0, beatFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        backgroundImage: style.plum
          ? `radial-gradient(ellipse at 50% 38%, ${theme.plum} 0%, ${theme.bg} 64%)`
          : `radial-gradient(ellipse at 50% 42%, ${theme.bgSoft} 0%, ${theme.bg} 70%)`,
        opacity: fadeOut,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* D-276: voice-over TTS (opsional). Volume naik sedikit supaya
          tidak menutupi musik/efek. */}
      {audioSrc ? <Audio src={audioSrc} volume={Math.min(1, Math.max(0, volume))} /> : null}
      <AbsoluteFill
        style={{
          padding: pad,
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          flexDirection: 'column',
          gap: Math.round(width * 0.022),
          opacity: visible,
          transform: `translateY(${rise}px)`,
        }}
      >
        {/* Badge peran beat (kecuali hook — hook harus langsung to the point). */}
        {style.badge && ROLE_BADGE[active.role] ? (
          <div
            style={{
              fontSize: type.caption,
              letterSpacing: 4,
              fontWeight: 700,
              textTransform: 'uppercase',
              color: accent,
              border: `1px solid ${accent}66`,
              borderRadius: 99,
              padding: `${Math.round(width * 0.008)}px ${Math.round(width * 0.022)}px`,
              marginBottom: Math.round(width * 0.012),
            }}
          >
            {ROLE_BADGE[active.role]}
          </div>
        ) : null}

        {/* Headline beat. */}
        <div
          style={{
            fontSize: headlineSize,
            fontWeight: 800,
            lineHeight: 1.1,
            color: theme.white,
            maxWidth: width - pad * 2,
            textShadow: `0 0 40px ${accent}33`,
          }}
        >
          {head}
        </div>

        {/* Garis aksen. */}
        {style.rule ? (
          <div
            style={{
              width: Math.round(width * 0.09),
              height: Math.max(4, Math.round(width * 0.005)),
              borderRadius: 99,
              background: accent,
              margin: '0 auto',
            }}
          />
        ) : null}

        {/* Subjudul (baris tambahan). */}
        {sub.length ? (
          <div
            style={{
              fontSize: type.subhead,
              fontWeight: 500,
              lineHeight: 1.4,
              color: theme.textDim,
              maxWidth: width - pad * 2.4,
            }}
          >
            {sub.map((line, i) => (
              <div key={i} style={{marginTop: i === 0 ? 0 : Math.round(width * 0.008)}}>
                {line}
              </div>
            ))}
          </div>
        ) : null}

        {/* Tombol CTA. */}
        {style.ctaButton ? (
          <div
            style={{
              marginTop: Math.round(width * 0.03),
              background: accent,
              color: theme.bg,
              fontSize: type.subhead,
              fontWeight: 800,
              borderRadius: 99,
              padding: `${Math.round(width * 0.016)}px ${Math.round(width * 0.05)}px`,
              boxShadow: `0 0 50px ${accent}55`,
            }}
          >
            {ctaButtonText}
          </div>
        ) : null}

        {/* Brand kecil. */}
        <div
          style={{
            position: 'absolute',
            bottom: pad,
            fontSize: type.caption,
            letterSpacing: 4,
            textTransform: 'uppercase',
            color: theme.textGhost,
            opacity: 0.75,
          }}
        >
          {brand}
        </div>
      </AbsoluteFill>

      {/* Progress bar beat — indikator irama, pakai token pink. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: Math.max(3, Math.round(height * 0.0035)),
          backgroundColor: theme.lineSoft,
          opacity: fadeOut,
        }}
      >
        <div
          style={{
            width: `${Math.round(beatProgress * 100)}%`,
            height: '100%',
            background: accent,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
