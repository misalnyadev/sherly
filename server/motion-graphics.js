// ===== D-249: Mode "Motion Graphics" — render video programatik =====
//
// Render memakai Remotion (Node SSR API) di server sendiri — BUKAN AWS Lambda,
// jadi biaya bulanan = $0 (lihat docs/RESEARCH-REMOTION.md).
//
// Alur:
//   1. bundle()  -> servemonce dari project motion-graphics/ (di-cache per proses)
//   2. selectComposition() + renderMedia() -> MP4 di /tmp
//   3. MP4 -> Supabase Storage (bucket studio-assets) -> tabel assets
//
// Render berjalan sebagai TASK (tabel public.sherly_video_tasks dengan
// provider='remotion') karena batas maxDuration server (60 dtk) lebih
// pendek dari proses render + encode.
//
// Lisensi Remotion:
//   - licenseKey   : env REMOTION_LICENSE_KEY kalau ada (WAJIB kalau produk
//                     jadi layanan render untuk user -> tier Automators,
//                     min $100/bulan + $0,01/render).
//   - licenseKey   : null kalau tidak ada key (string kosong itu invalid).
//   - isProduction : true hanya kalau key tersedia; kalau tidak -> false
//                     (render dev tidak dihitung sebagai render berlisensi).
//
// Prasyarat runtime:
//   - Node >= 18
//   - Chromium untuk headless render. Default: Remotion mengunduh sendiri
//     (Chrome Headless Shell) — butuh akses internet. Kalau diblokir, set
//     env REMOTION_BROWSER_EXECUTABLE ke path Chromium yang sudah ada.

import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MG_PROJECT = path.resolve(HERE, '..', 'motion-graphics');
const MG_ENTRY = path.join(MG_PROJECT, 'src', 'index.ts');

export const MOTION_GRAPHICS_PROVIDER = 'remotion';

/** Template yang bisa dipilih user. */
export const MG_TEMPLATES = [
  {
    id: 'branded-intro',
    label: 'Intro BerBrand',
    hint: 'Judul + subjudul + logo Sherly, cocok buat pembuka konten.',
    icon: 'sparkles',
    defaultDuration: 6,
    durations: [5, 6, 8],
    aspects: ['9:16', '16:9', '1:1'],
    fields: [
      {key: 'title', label: 'Judul', placeholder: 'Contoh: Kreasi Tanpa Batas', required: true},
      {key: 'subtitle', label: 'Subjudul', placeholder: 'Contoh: Studio kreatif bertenaga AI'},
    ],
  },
  {
    id: 'captioned-clip',
    label: 'Klip Bersubtitle',
    hint: 'Tempel video lalu kasih subtitle per baris.',
    icon: 'captions',
    defaultDuration: 8,
    durations: [6, 8, 10],
    aspects: ['9:16', '16:9'],
    fields: [
      {key: 'src', label: 'URL video', placeholder: 'https://… (kosong = latarnya teks saja)'},
      {key: 'captionsText', label: 'Subtitle', placeholder: 'Satu baris = satu cue', type: 'textarea'},
    ],
  },
  {
    id: 'stat-card',
    label: 'Kartu Statistik',
    hint: 'Satu angka besar + label, buat kutipan atau ringkasan data.',
    icon: 'bar-chart',
    defaultDuration: 5,
    durations: [4, 5, 6],
    aspects: ['9:16', '16:9', '1:1'],
    fields: [
      {key: 'value', label: 'Nilai', placeholder: 'Contoh: 3.2x', required: true},
      {key: 'label', label: 'Label', placeholder: 'Contoh: lebih cepat produksi', required: true},
      {key: 'note', label: 'Catatan', placeholder: 'Contoh: Data internal, Q3 2026'},
    ],
  },
];

/** Rasio -> [lebar, tinggi] piksel (harus sama dengan motion-graphics/src/theme.ts). */
export const MG_ASPECTS = {
  '9:16': {width: 1080, height: 1920},
  '16:9': {width: 1920, height: 1080},
  '1:1': {width: 1080, height: 1080},
};

const MG_FPS = 30;

/** Template -> id komposisi Remotion per rasio (harus sama dengan Root.tsx). */
function compositionId(templateId, aspect) {
  if (templateId === 'branded-intro') {
    // Komposisi vertikal Bernama "BrandedIntro" (tanpa suffix).
    if (aspect === '16:9') return 'BrandedIntroWide';
    if (aspect === '1:1') return 'BrandedIntroSquare';
    return 'BrandedIntro';
  }
  const base = templateId === 'captioned-clip' ? 'CaptionedClip' : 'StatCard';
  if (aspect === '16:9') return `${base}Wide`;
  if (aspect === '1:1') return `${base}Square`;
  return `${base}Vertical`;
}

export function getTemplate(templateId) {
  return MG_TEMPLATES.find((t) => t.id === templateId) || null;
}

/**
 * Normalisasi & validasi input render.
 * Return {template, compositionId, aspect, durationInSeconds, inputProps}.
 */
export function normalizeRenderRequest(body = {}) {
  const template = getTemplate(String(body.template || '').trim());
  if (!template) {
    throw Object.assign(new Error('Template Motion Graphics tidak dikenal.'), {status: 400});
  }
  const aspectRaw = String(body.aspect || '9:16').trim();
  const aspect = template.aspects.includes(aspectRaw) ? aspectRaw : template.aspects[0];
  const size = MG_ASPECTS[aspect];
  if (!size) throw Object.assign(new Error('Rasio tidak didukung.'), {status: 400});

  const durationInSeconds = template.durations.includes(Number(body.duration))
    ? Number(body.duration)
    : template.defaultDuration;

  const raw = body.props && typeof body.props === 'object' ? body.props : {};
  const inputProps = {};
  for (const field of template.fields) {
    const value = String(raw[field.key] ?? '').trim();
    if (field.required && !value) {
      throw Object.assign(new Error(`Kolom "${field.label}" wajib diisi.`), {status: 400});
    }
    if (value) inputProps[field.key] = value.slice(0, 4000);
  }

  // Durasi ikut props supaya komposisi bisa fade-out di frame terakhir.
  inputProps.durationInSeconds = durationInSeconds;

  return {
    template,
    compositionId: compositionId(template.id, aspect),
    aspect,
    width: size.width,
    height: size.height,
    durationInSeconds,
    inputProps,
  };
}

/** Kunci lisensi Remotion untuk render ini. */
export function licenseConfig() {
  const key = String(process.env.REMOTION_LICENSE_KEY || '').trim();
  return {
    // String kosong TIDAK valid untuk Remotion — harus null kalau tidak ada key.
    licenseKey: key || null,
    // Tanpa key -> render development (tidak dihitung render berlisensi).
    isProduction: Boolean(key),
  };
}

// ===== Runtime Remotion (dimuat lazy) =====

let rendererPromise = null;

/**
 * Remotion hidup di project terpisah (motion-graphics/) supaya repo utama
 * tetap ringan. Node ESM akan mencari @remotion/* dari node_modules repo
 * utama — yang tidak ada. Jadi kita resolve manual dari folder project itu.
 *
 * `createRequire` dipakai supaya package entry point (main/exports) dibaca
 * sama seperti Node biasa — import direkt ke folder tidak didukung ESM.
 */
const mgRequire = createRequire(path.join(MG_PROJECT, 'package.json'));

async function importFromMotionProject(specifier) {
  const entry = mgRequire.resolve(specifier);
  return import(pathToFileURL(entry).href);
}

async function loadRenderer() {
  if (!rendererPromise) {
    rendererPromise = (async () => {
      const bundler = await importFromMotionProject('@remotion/bundler');
      const renderer = await importFromMotionProject('@remotion/renderer');
      return {bundler, renderer};
    })().catch((error) => {
      rendererPromise = null;
      throw Object.assign(
        new Error('Renderer Motion Graphics belum terpasang: ' + (error?.message || error)),
        {status: 503},
      );
    });
  }
  return rendererPromise;
}

/** Cache hasil bundle per proses — bundling itu mahal (~1-3 dtk). */
let serveUrlPromise = null;

async function getServeUrl() {
  if (!serveUrlPromise) {
    serveUrlPromise = (async () => {
      const {bundler} = await loadRenderer();
      const outDir = path.join(os.tmpdir(), 'sherly-mg-bundle');
      await fs.mkdir(outDir, {recursive: true});
      return bundler.bundle({
        entryPoint: MG_ENTRY,
        outDir,
        onProgress: () => {},
      });
    })().catch((error) => {
      serveUrlPromise = null;
      throw error;
    });
  }
  return serveUrlPromise;
}

/** Path Chromium untuk headless render (kalau perlu override env). */
async function resolveBrowserExecutable() {
  const env = String(process.env.REMOTION_BROWSER_EXECUTABLE || '').trim();
  if (!env) return undefined;
  try {
    await fs.access(env);
    return env;
  } catch {
    return undefined;
  }
}

/**
 * Render satu komposisi -> Buffer MP4.
 * opts.onProgress({progress}) dipanggil selama render.
 */
export async function renderMotionGraphic(req, opts = {}) {
  const {renderer} = await loadRenderer();
  const serveUrl = await getServeUrl();
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sherly-mg-'));
  const outputLocation = path.join(outDir, 'out.mp4');

  const durationInFrames = Math.max(
    1,
    Math.round(req.durationInSeconds * MG_FPS),
  );

  const browserExecutable = await resolveBrowserExecutable();

  const composition = await renderer.selectComposition({
    serveUrl,
    id: req.compositionId,
    inputProps: req.inputProps,
    ...(browserExecutable ? {browserExecutable} : {}),
  });
  const license = licenseConfig();

  await renderer.renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation,
    inputProps: req.inputProps,
    licenseKey: license.licenseKey,
    isProduction: license.isProduction,
    ...(browserExecutable ? {browserExecutable} : {}),
    onProgress: ({progress}) => {
      try {
        opts.onProgress?.({progress: Math.max(0, Math.min(100, Math.round(progress * 100)))});
      } catch {
        /* abaikan error callback */
      }
    },
  });

  const buffer = await fs.readFile(outputLocation);
  await fs.rm(outDir, {recursive: true, force: true}).catch(() => {});

  return {
    buffer,
    width: req.width,
    height: req.height,
    durationMs: Math.round(req.durationInSeconds * 1000),
  };
}

/**
 * Probe apakah Motion Graphics bisa dipakai di server ini.
 * Dipakai route /api/studio/motion-graphics/templates agar UI bisa
 * menyembunyikan mode kalau renderer tidak siap.
 */
export async function motionGraphicsAvailable() {
  try {
    await fs.access(MG_ENTRY);
  } catch {
    return {ok: false, reason: 'Project motion-graphics tidak ditemukan.'};
  }
  try {
    await loadRenderer();
  } catch (error) {
    return {ok: false, reason: error?.message || 'Renderer tidak tersedia.'};
  }
  return {ok: true};
}

/**
 * Jalankan perintah eksternal (dipakai untukEnvironment check & setup).
 * Tidak dipakai di jalur render normal — hanya utilitas.
 */
export function runCommand(command, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {stdio: ['ignore', 'pipe', 'pipe']});
    let out = '';
    let err = '';
    child.stdout?.on('data', (d) => { out += String(d); });
    child.stderr?.on('data', (d) => { err += String(d); });
    child.on('close', (code) => resolve({code, out, err}));
    child.on('error', (error) => resolve({code: -1, out, err: String(error?.message || error)}));
    if (opts.timeout) {
      setTimeout(() => child.kill('SIGTERM'), opts.timeout);
    }
  });
}
