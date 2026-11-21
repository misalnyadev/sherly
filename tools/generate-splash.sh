#!/usr/bin/env bash
# D-248: generate apple-touch-startup-image untuk iOS PWA.
# ImageMagick only (no new dependency). Each image = brand ground + centred neon logo.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/splash"
POSTER="$ROOT/public/assets/brand/sherly-logo-poster.png"
SRC="/tmp/arena-coding-uploads/Membuat_efek_neon_logo_web_e1bb06cf.gif"
BG="#070b14"

mkdir -p "$OUT"

# name:css_width:css_height:dpr
SCREENS=(
  "iphone-se:375:667:2"
  "iphone-x:375:812:3"
  "iphone-xr:414:896:2"
  "iphone-xsmax:414:896:3"
  "iphone-12:390:844:3"
  "iphone-12promax:428:926:3"
  "iphone-14pro:393:852:3"
  "iphone-14promax:430:932:3"
  "iphone-15pro:440:956:3"
  "iphone-15promax:440:956:3"
  "iphone-16:393:852:3"
  "iphone-16plus:430:932:3"
  "iphone-16promax:440:956:3"
)

for spec in "${SCREENS[@]}"; do
  IFS=":" read -r name w h dpr <<< "$spec"
  px_w=$((w * dpr))
  px_h=$((h * dpr))

  # logo occupies ~30% of the shorter edge (poster source is 290x340 = 29:34)
  logo_h=$((px_h * 20 / 100))
  logo_w=$((logo_h * 300 / 320))

  # palette-reduce keeps the total size reasonable without visible banding
  # logo diekstrak ke atas latar app (buang kotak hitam poster), lalu di-composite
  # Poster PNG sudah punya latar transparan-friendly (hitam pekat) + logo neon.
  # Di-composite di atas latar app agar menyatu.
  # Komposisi satu tahap: bg app + logo neon, lalu palette-reduce ke PNG 8-bit.
  # -define png:bit-depth=8 + colors 32 menghasilkan file jauh lebih kecil
  # tanpa banding yang terlihat (glow neon memang gradasi lembut).
  convert -size "${px_w}x${px_h}" "xc:${BG}" \
    \( "$POSTER" -resize "${logo_w}x${logo_h}" \) \
    -gravity center -composite \
    -strip -define png:compression-level=9 -define png:bit-depth=8 \
    -colors 16 -dither FloydSteinberg \
    "$OUT/apple-splash-${name}-${px_w}x${px_h}.png"

  echo "  ${name} -> ${px_w}x${px_h}"
done

echo "Done: $(ls "$OUT" | wc -l) images in $OUT"
du -sh "$OUT"
