#!/usr/bin/env bash
# D-249: setup mode "Motion Graphics" (sub-project Remotion).
#
# Dipakai sekali setelah clone:
#   bash tools/setup-motion-graphics.sh
#
# Menginstal dependency sub-project motion-graphics/ (Remotion + React + TS).
# Repo utama TIDAK ikut kena dependency Remotion — node_modules-nya terpisah.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MG_DIR="$ROOT/motion-graphics"

if [ ! -f "$MG_DIR/package.json" ]; then
  echo "✗ Sub-project motion-graphics tidak ditemukan: $MG_DIR" >&2
  exit 1
fi

echo "▸ Menginstal dependency Motion Graphics (Remotion)…"
cd "$MG_DIR"
npm install --no-audit --no-fund

echo ""
echo "✓ Selesai. Sub-project Remotion siap di $MG_DIR"
echo ""
echo "  Preview komposisi :  cd motion-graphics && npm run studio"
echo "  Daftar komposisi   :  cd motion-graphics && npm run compositions"
echo ""
echo "  Catatan server:"
echo "  - Remotion mengunduh Chrome Headless Shell sendiri saat render."
echo "    Kalau jaringan diblokir, set REMOTION_BROWSER_EXECUTABLE ke Chromium"
echo "    yang sudah ada di server."
echo "  - FFmpeg tidak perlu diinstal (bawaan @remotion/compositor-*)."
echo "  - Tanpa REMOTION_LICENSE_KEY, render berjalan sebagai isProduction=false"
echo "    (gratis untuk tim <= 3 orang)."
