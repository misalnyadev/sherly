/**
 * D-249 — Root Remotion: daftar komposisi Motion Graphics SherlyStudio.
 *
 * Setiap template didaftarkan sebagai Composition terpisah supaya bisa
 * di-preview & diedit sendiri di Remotion Studio, dan punya defaultProps
 * yang bisa diubah dari UI Studio.
 *
 * Aturan remotion-markup/compositions.md: setiap komposisi yang diedit
 * sendiri di Studio sebaiknya punya node JSX sendiri (bukan registrasi
 * programatis).
 *
 * D-275 — durasi dinamis:
 *   Server renderer mengirim `durationInSeconds` lewat inputProps. Tanpa
 *   `calculateMetadata`, komposisi selalu memakai `durationInFrames` statis
 *   di bawah ini (6/8/5 detik) dan pilihan durasi di UI tidak berefek.
 *   `calculateMetadata` membaca `durationInSeconds` dari props dan
 *   overriding `durationInFrames` SEBELUM render.
 */
import React from 'react';
import {Composition} from 'remotion';
import {ASPECTS} from './theme';
import {BrandedIntro, type BrandedIntroProps} from './compositions/BrandedIntro';
import {CaptionedClip, type CaptionedClipProps} from './compositions/CaptionedClip';
import {StatCard, type StatCardProps} from './compositions/StatCard';

const FPS = 30;
const V = ASPECTS['9:16'];
const H = ASPECTS['16:9'];
const S = ASPECTS['1:1'];

/** Batas durasi (detik) — sinkron dengan server/motion-graphics.js. */
export const MG_MAX_DURATION = 30;

/** Durasi yang boleh dipilih (detik). */
export const MG_DURATIONS = [5, 6, 8, 10, 12, 15, 20, 25, 30];

/**
 * D-275: hitung `durationInFrames` dari `durationInSeconds` yang dikirim
 * server. Nilai dibatasi 1..MG_MAX_DURATION supaya request aneh tidak
 * membuat render sangat panjang.
 */
const durationFromProps = (
  props: {durationInSeconds?: number} | undefined,
  fallbackSeconds: number,
): number => {
  const raw = Number(props?.durationInSeconds);
  const seconds = Number.isFinite(raw) && raw > 0 ? raw : fallbackSeconds;
  const clamped = Math.min(Math.max(seconds, 1), MG_MAX_DURATION);
  return Math.max(1, Math.round(clamped * FPS));
};

/**
 * Pembuat fungsi `calculateMetadata` untuk satu template.
 * `fallbackSeconds` = durasi default komposisi itu.
 */
const makeCalculateMetadata =
  <P extends {durationInSeconds?: number}>(fallbackSeconds: number) =>
  ({props}: {props: P}): {durationInFrames: number} => ({
    durationInFrames: durationFromProps(props, fallbackSeconds),
  });

const calculateMetadata = makeCalculateMetadata<BrandedIntroProps>(6);
const calculateMetadata8 = makeCalculateMetadata<CaptionedClipProps>(8);
const calculateMetadata5 = makeCalculateMetadata<StatCardProps>(5);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="BrandedIntro"
        component={BrandedIntro}
        durationInFrames={6 * FPS}
        fps={FPS}
        width={V.width}
        height={V.height}
        calculateMetadata={calculateMetadata}
        defaultProps={
          {
            title: 'SherlyStudio',
            subtitle: 'Studio kreatif bertenaga AI',
            brand: 'SherlyStudio',
            durationInSeconds: 6,
            accent: '#f044a8',
          } satisfies BrandedIntroProps
        }
      />
      <Composition
        id="BrandedIntroWide"
        component={BrandedIntro}
        durationInFrames={6 * FPS}
        fps={FPS}
        width={H.width}
        height={H.height}
        calculateMetadata={calculateMetadata}
        defaultProps={
          {
            title: 'SherlyStudio',
            subtitle: 'Studio kreatif bertenaga AI',
            brand: 'SherlyStudio',
            durationInSeconds: 6,
            accent: '#f044a8',
          } satisfies BrandedIntroProps
        }
      />
      <Composition
        id="BrandedIntroSquare"
        component={BrandedIntro}
        durationInFrames={6 * FPS}
        fps={FPS}
        width={S.width}
        height={S.height}
        calculateMetadata={calculateMetadata}
        defaultProps={
          {
            title: 'SherlyStudio',
            subtitle: 'Studio kreatif bertenaga AI',
            brand: 'SherlyStudio',
            durationInSeconds: 6,
            accent: '#f044a8',
          } satisfies BrandedIntroProps
        }
      />

      <Composition
        id="CaptionedClipVertical"
        component={CaptionedClip}
        durationInFrames={8 * FPS}
        fps={FPS}
        width={V.width}
        height={V.height}
        calculateMetadata={calculateMetadata8}
        defaultProps={
          {
            src: '',
            captionsText: '',
            durationInSeconds: 8,
            accent: '#ff72c5',
          } satisfies CaptionedClipProps
        }
      />
      <Composition
        id="CaptionedClipWide"
        component={CaptionedClip}
        durationInFrames={8 * FPS}
        fps={FPS}
        width={H.width}
        height={H.height}
        calculateMetadata={calculateMetadata8}
        defaultProps={
          {
            src: '',
            captionsText: '',
            durationInSeconds: 8,
            accent: '#ff72c5',
          } satisfies CaptionedClipProps
        }
      />

      <Composition
        id="StatCardVertical"
        component={StatCard}
        durationInFrames={5 * FPS}
        fps={FPS}
        width={V.width}
        height={V.height}
        calculateMetadata={calculateMetadata5}
        defaultProps={
          {
            value: '3.2x',
            label: ' lebih cepat produksi',
            note: 'Data internal SherlyStudio, Q3 2026',
            brand: 'SherlyStudio',
            durationInSeconds: 5,
            accent: '#f044a8',
          } satisfies StatCardProps
        }
      />
      <Composition
        id="StatCardWide"
        component={StatCard}
        durationInFrames={5 * FPS}
        fps={FPS}
        width={H.width}
        height={H.height}
        calculateMetadata={calculateMetadata5}
        defaultProps={
          {
            value: '3.2x',
            label: ' lebih cepat produksi',
            note: 'Data internal SherlyStudio, Q3 2026',
            brand: 'SherlyStudio',
            durationInSeconds: 5,
            accent: '#f044a8',
          } satisfies StatCardProps
        }
      />
      <Composition
        id="StatCardSquare"
        component={StatCard}
        durationInFrames={5 * FPS}
        fps={FPS}
        width={S.width}
        height={S.height}
        calculateMetadata={calculateMetadata5}
        defaultProps={
          {
            value: '3.2x',
            label: ' lebih cepat produksi',
            note: 'Data internal SherlyStudio, Q3 2026',
            brand: 'SherlyStudio',
            durationInSeconds: 5,
            accent: '#f044a8',
          } satisfies StatCardProps
        }
      />
    </>
  );
};
