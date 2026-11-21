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
