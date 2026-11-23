/**
 * D-249 — "Intro BerBrand" (template Motion Graphics #1).
 *
 * Intro singkat 5-8 detik: judul + subjudul + logo SherlyStudio, dengan
 * gradasi pink yang menyala dari tengah.
 *
 * Aturan (skill remotion-markup):
 *  - Animasi WAJIB pakai useCurrentFrame() + interpolate()/spring().
 *    CSS `transition`/`animation` TIDAK akan ter-render → dilarang.
 *  - `fps` diambil dari useVideoConfig() untuk konversi detik→frame.
 *  - Subscriber useCurrentFrame() harus di komponen paling kecil yang perlu.
 */
import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {safePadding, theme, typeScale} from '../theme';

export type BrandedIntroProps = {
  title: string;
  subtitle?: string;
  brand?: string;
  durationInSeconds?: number;
  accent?: string;
};

export const BrandedIntro: React.FC<BrandedIntroProps> = ({
  title,
  subtitle = '',
  brand = 'SherlyStudio',
  durationInSeconds = 6,
  accent = theme.pink,
}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const type = typeScale(width);
  const pad = safePadding(width);

  const total = Math.max(1, Math.round(durationInSeconds * fps));

  // D-275: intro bisa sampai 15 detik. Animasi masuk selesai di ~1,6 detik,
  // jadi durasi panjang akan jadi "layar diam". Perbaikan: intro tetap
  // ditampilkan (hold) dan gerakannya "bernapas" pelan sampai fade out.
  const INTRO_MAX_FRAMES = Math.round(2.4 * fps);
  const introLen = Math.min(total, INTRO_MAX_FRAMES);
  const animFrame = Math.min(frame, introLen);
  const isHolding = frame > introLen;

  // Judul: masuk dengan spring, settles di ~60% durasi.
  const titleIn = spring({
    frame: animFrame - Math.round(0.35 * fps),
    fps,
    config: {damping: 200, mass: 0.7},
  });

  // Subjudul: muncul sedikit setelah judul.
  const subIn = spring({
    frame: animFrame - Math.round(1.15 * fps),
    fps,
    config: {damping: 200, mass: 0.9},
  });

  // Denyut cahaya di belakang logo — loop halus.
  const pulse = interpolate(
    Math.sin((frame / fps) * Math.PI * 0.9),
    [-1, 1],
    [0.72, 1],
  );

  // Napas pelan saat menahan (supaya layar tidak benar-benar statis).
  const breath = isHolding
    ? Math.sin(((frame - introLen) / Math.max(1, total - introLen)) * Math.PI)
    : 0;
  const breathScale = 1 + breath * 0.012;

  // Fade out di 12% terakhir.
  const fadeOut = interpolate(frame, [total - Math.round(0.6 * fps), total], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Garis aksen di bawah judul — tumbuh mengikuti spring judul.
  const lineWidth = interpolate(titleIn, [0, 1], [0, Math.min(width * 0.34, 420)]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        // Gradasi radial statis (bukan animasi) — fija aman.
        backgroundImage: `radial-gradient(ellipse at 50% 38%, ${theme.plum} 0%, ${theme.bg} 62%)`,
        opacity: fadeOut,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Cahaya denyut di belakang logo */}
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.16 * pulse,
        }}
      >
        <div
          style={{
            width: width * 0.52,
            height: width * 0.52,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${accent} 0%, ${theme.bg} 70%)`,
            filter: 'blur(70px)',
          }}
        />
      </AbsoluteFill>

      {/* Konten utama */}
      <AbsoluteFill
        style={{
          padding: pad,
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          flexDirection: 'column',
          gap: Math.round(width * 0.022),
          // D-275: napas pelan saat menahan (durasi > 2,4 detik).
          transform: `scale(${breathScale})`,
        }}
      >
        {/* Logo Sherly —基督 "sherlyheart" Equivalent: hati pink */}
        <div
          style={{
            transform: `scale(${interpolate(titleIn, [0, 1], [0.7, 1])})`,
            opacity: titleIn,
            marginBottom: Math.round(width * 0.03),
          }}
        >
          <svg width={Math.round(width * 0.085)} height={Math.round(width * 0.085)} viewBox="0 0 24 24" aria-label="SherlyStudio">
            <path
              d="M12 21s-7.5-4.7-9.6-9.2C.9 8.1 3 4.6 6.3 4.6c2 0 3.6 1.1 4.6 2.6l1.1 1.6 1.1-1.6c1-1.5 2.6-2.6 4.6-2.6 3.3 0 5.4 3.5 3.9 7.2C19.5 16.3 12 21 12 21z"
              fill={accent}
            />
          </svg>
        </div>

        {/* Kicker */}
        <div
          style={{
            fontSize: type.kicker,
            letterSpacing: 6,
            textTransform: 'uppercase',
            color: theme.textFaint,
            opacity: subIn,
            transform: `translateY(${interpolate(subIn, [0, 1], [24, 0])}px)`,
          }}
        >
          {brand}
        </div>

        {/* Judul utama */}
        <div
          style={{
            fontSize: type.headline,
            fontWeight: 800,
            lineHeight: 1.08,
            color: theme.white,
            maxWidth: width - pad * 2,
            opacity: titleIn,
            transform: `translateY(${interpolate(titleIn, [0, 1], [40, 0])}px)`,
          }}
        >
          {title}
        </div>

        {/* Garis aksen */}
        <div
          style={{
            width: lineWidth,
            height: Math.max(4, Math.round(width * 0.005)),
            borderRadius: 99,
            background: `linear-gradient(90deg, ${theme.pinkBright}, ${accent})`,
            marginTop: Math.round(width * 0.012),
          }}
        />

        {/* Subjudul */}
        {subtitle ? (
          <div
            style={{
              fontSize: type.subhead,
              fontWeight: 500,
              lineHeight: 1.35,
              color: theme.textDim,
              maxWidth: width - pad * 2.4,
              opacity: subIn,
              transform: `translateY(${interpolate(subIn, [0, 1], [26, 0])}px)`,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
