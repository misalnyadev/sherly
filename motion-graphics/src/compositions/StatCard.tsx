/**
 * D-249 — "Kartu Statistik" (template Motion Graphics #3).
 *
 * Data-driven: satu angka besar + label + catatan. Dipakai untuk kutipan
 * studi kasus, ringkasan performa, atau kartu statistik di konten.
 *
 * Prinsip dari skill remotion-create/video-layout.md:
 *  - Buildingkan frame around SATU hal yang dilihat penonton.
 *  - Headline >= 84px (pada 1080), teks pendukung >= 44px.
 *  - Teks penting minimal 80px dari sisi & 100px dari atas/bawah.
 *
 * Aturan remotion-markup: animasi via useCurrentFrame() + interpolate()/
 * spring(); CSS animation/transition tidak akan ter-render.
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

export type StatCardProps = {
  value: string;
  label: string;
  note?: string;
  brand?: string;
  durationInSeconds?: number;
  accent?: string;
};

export const StatCard: React.FC<StatCardProps> = ({
  value,
  label,
  note = '',
  brand = 'SherlyStudio',
  durationInSeconds = 5,
  accent = theme.pink,
}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const type = typeScale(width);
  const pad = safePadding(width);

  const total = Math.max(1, Math.round(durationInSeconds * fps));

  const valueIn = spring({
    frame: frame - Math.round(0.3 * fps),
    fps,
    config: {damping: 200, mass: 0.8},
  });
  const labelIn = spring({
    frame: frame - Math.round(0.85 * fps),
    fps,
    config: {damping: 200, mass: 1},
  });
  const noteIn = spring({
    frame: frame - Math.round(1.35 * fps),
    fps,
    config: {damping: 200, mass: 1.1},
  });

  const fadeOut = interpolate(frame, [total - Math.round(0.5 * fps), total], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Angka "naik" sedikit untuk memberi rasa progres.
  const valueLift = interpolate(valueIn, [0, 1], [46, 0]);
  const cardScale = interpolate(valueIn, [0, 1], [0.94, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        backgroundImage: `radial-gradient(ellipse at 50% 34%, ${theme.plum} 0%, ${theme.bg} 66%)`,
        opacity: fadeOut,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <AbsoluteFill
        style={{
          padding: pad,
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          flexDirection: 'column',
        }}
      >
        {/* Kartu */}
        <div
          style={{
            width: '100%',
            maxWidth: Math.min(width - pad * 2, 900),
            backgroundColor: theme.bgElevated,
            border: `1px solid ${theme.line}`,
            borderRadius: Math.round(width * 0.022),
            padding: `${Math.round(width * 0.05)}px ${Math.round(width * 0.045)}px`,
            transform: `scale(${cardScale})`,
            opacity: valueIn,
            boxShadow: `0 30px 90px rgba(4,7,15,0.6), 0 0 60px ${accent}1f`,
            display: 'flex',
            flexDirection: 'column',
            gap: Math.round(width * 0.018),
          }}
        >
          {/* Nilai utama */}
          <div
            style={{
              fontSize: Math.round(type.headline * 1.6),
              fontWeight: 800,
              lineHeight: 1,
              color: theme.white,
              transform: `translateY(${valueLift}px)`,
              textShadow: `0 0 40px ${accent}55`,
            }}
          >
            {value}
          </div>

          {/* Garis aksen */}
          <div
            style={{
              width: Math.round(width * 0.09),
              height: Math.max(4, Math.round(width * 0.005)),
              borderRadius: 99,
              background: accent,
              margin: '0 auto',
            }}
          />

          {/* Label */}
          <div
            style={{
              fontSize: type.subhead,
              fontWeight: 600,
              lineHeight: 1.3,
              color: theme.textDim,
              opacity: labelIn,
              transform: `translateY(${interpolate(labelIn, [0, 1], [22, 0])}px)`,
            }}
          >
            {label}
          </div>

          {/* Catatan */}
          {note ? (
            <div
              style={{
                fontSize: type.caption,
                lineHeight: 1.5,
                color: theme.textGhost,
                opacity: noteIn,
                transform: `translateY(${interpolate(noteIn, [0, 1], [18, 0])}px)`,
              }}
            >
              {note}
            </div>
          ) : null}
        </div>

        {/* Brand kecil di bawah */}
        <div
          style={{
            marginTop: Math.round(width * 0.035),
            fontSize: type.caption,
            letterSpacing: 4,
            textTransform: 'uppercase',
            color: theme.textGhost,
            opacity: noteIn,
          }}
        >
          {brand}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
