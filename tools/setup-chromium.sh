#!/usr/bin/env bash
# Siapkan Chromium headless untuk test browser (ephemeral sandbox).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p /tmp/chromedeps/root

if [ ! -x /tmp/chromedeps/chromium ]; then
  echo "▸ Ekstrak Chromium…"
  node -e "
const {createReadStream, createWriteStream} = require('fs');
const {createBrotliDecompress} = require('zlib');
createReadStream('$ROOT/node_modules/@sparticuz/chromium/bin/chromium.br').pipe(createBrotliDecompress()).pipe(createWriteStream('/tmp/chromedeps/chromium'));
"
fi
if [ ! -f /tmp/chromedeps/al2023.tar ]; then
  node -e "
const {createReadStream, createWriteStream} = require('fs');
const {createBrotliDecompress} = require('zlib');
createReadStream('$ROOT/node_modules/@sparticuz/chromium/bin/al2023.tar.br').pipe(createBrotliDecompress()).pipe(createWriteStream('/tmp/chromedeps/al2023.tar'));
"
fi
sleep 6
chmod +x /tmp/chromedeps/chromium
if [ ! -f /tmp/chromedeps/root/lib/libnspr4.so ]; then
  tar -xf /tmp/chromedeps/al2023.tar -C /tmp/chromedeps/root
fi
LD_LIBRARY_PATH=/tmp/chromedeps/root/lib /tmp/chromedeps/chromium --version
