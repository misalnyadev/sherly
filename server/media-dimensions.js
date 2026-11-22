/**
 * D-257 — Deteksi dimensi aset (lebar x tinggi) langsung dari bytes file.
 *
 * Dipakai kalau client tidak mengirim width/height (mis. upload lama, atau
 * browser gagal membaca metadata). Tanpa ini, video horizontal ikut default
 * 9:16 sehingga tampil VERTIKAL di galeri.
 *
 * Parser ringan, tanpa dependensi:
 *  - MP4/MOV/3GP (ISO-BMFF): cari box `tkhd` (lebar/tinggi viewport) & `mvhd`.
 *  - PNG: header IHDR.
 *  - JPEG: scan marker SOF0..SOF15.
 *  - GIF: header logical screen.
 *  - WebP: RIFF/VP8/VP8L/VP8X.
 *
 * Semua fungsi aman (tidak melempar error).
 */

/** Ambil dimensi dari buffer PNG. */
function pngSize(buf) {
  if (buf.length < 24) return null;
  // Signature 8 byte + IHDR chunk (length 4 + type 4 + data).
  if (buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(4) !== 0x0d0a1a0a) return null;
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** Ambil dimensi dari buffer JPEG (scan marker SOFn). */
function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let off = 2;
  while (off + 9 < buf.length) {
    if (buf[off] !== 0xff) { off++; continue; }
    const marker = buf[off + 1];
    // Standalone marker (tidak punya panjang).
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { off += 2; continue; }
    const len = buf.readUInt16BE(off + 2);
    // SOF0..SOF15 kecuali DHT(c4), JPGA(c8), DAC(cc).
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (off + 9 > buf.length) return null;
      return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
    }
    off += 2 + len;
  }
  return null;
}

/** Ambil dimensi dari buffer GIF. */
function gifSize(buf) {
  if (buf.length < 10) return null;
  const sig = buf.toString('ascii', 0, 3);
  if (sig !== 'GIF') return null;
  return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
}

/** Ambil dimensi dari buffer WebP (VP8 / VP8L / VP8X). */
function webpSize(buf) {
  if (buf.length < 30) return null;
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') {
    // Lossy: frame header di offset 26.
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    const b = buf.readUInt32LE(21);
    return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') {
    const w = buf[24] | (buf[25] << 8) | (buf[26] << 16);
    const h = buf[27] | (buf[28] << 8) | (buf[29] << 16);
    return { width: w + 1, height: h + 1 };
  }
  return null;
}

/**
 * Ambil dimensi dari container ISO-BMFF (MP4/MOV/3GP).
 * Cari box `tkhd` -> viewport width/height (fixed point 16.16).
 */
function mp4Size(buf) {
  const size = buf.length;
  const view = new DataView(buf.buffer, buf.byteOffset, size);
  let found = null;

  // Walk box-tree (skip container boxes agar tidak salah baca).
  const walk = (start, end, depth) => {
    if (depth > 6) return;
    let off = start;
    while (off + 8 <= end) {
      let boxSize = view.getUint32(off);
      const type = buf.toString('ascii', off + 4, off + 8);
      let headerLen = 8;
      if (boxSize === 1) {
        // 64-bit size.
        if (off + 16 > end) return;
        const hi = view.getUint32(off + 8), lo = view.getUint32(off + 12);
        boxSize = hi * 4294967296 + lo;
        headerLen = 16;
      } else if (boxSize === 0) {
        boxSize = end - off;
      }
      if (boxSize < headerLen || off + boxSize > end) {
        // Box rusak -> berhenti di branch ini.
        return;
      }
      const bodyStart = off + headerLen;
      const bodyEnd = off + boxSize;

      if (type === 'tkhd') {
        // version(1) flags(3) create(4) modify(4) trackId(4) reserved(4)
        // duration(4) reserved(8) layer(2) altGroup(2) volume(2) reserved(2)
        // matrix(36) width(4) height(4)
        // Layout tkhd: version+flags(4) create(4) modify(4) trackId(4)
        // reserved(4) duration(4) reserved(8) layer(2) altGroup(2)
        // volume(2) reserved(2) matrix(36) -> width(4) height(4).
        const p = bodyStart + 40 + 36;
        if (p + 8 <= bodyEnd) {
          const version = buf[bodyStart];
          const wFixed = view.getUint32(p);
          const hFixed = view.getUint32(p + 4);
          let w = version === 1 ? wFixed / 65536 : wFixed >> 16;
          let h = version === 1 ? hFixed / 65536 : hFixed >> 16;
          // D-257: `tkhd` menyimpan ukuran track SEBELUM display matrix
          // diterapkan. Kalau matrix memutar 90/270 (video portrait yang
          // direkam landscape), lebar & tinggi harus DITUKAR.
          const matrixOff = bodyStart + 40;
          const a = view.getUint32(matrixOff);
          const b = view.getInt32(matrixOff + 4);
          const rotated = Math.abs(a) < 0.5 && Math.abs(b) > 0.5; // a=0, b=±1
          if (rotated) { const t = w; w = h; h = t; }
          if (w > 0 && h > 0) found = { width: Math.round(w), height: Math.round(h) };
        }
      }
      if (type === 'mvhd' && !found) {
        const version = buf[bodyStart];
        const p = bodyStart + 4 + (version === 1 ? 16 : 8) + 4 + 4 + 4 + 8 + 4 + 36;
        if (p + 8 <= bodyEnd) {
          const wFixed = view.getUint32(p);
          const hFixed = view.getUint32(p + 4);
          const w = version === 1 ? wFixed / 65536 : wFixed >> 16;
          const h = version === 1 ? hFixed / 65536 : hFixed >> 16;
          if (w > 0 && h > 0) found = { width: Math.round(w), height: Math.round(h) };
        }
      }
      // Box container -> telusuri isinya.
      if (['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts'].includes(type)) {
        walk(bodyStart, bodyEnd, depth + 1);
      }
      off += boxSize;
    }
  };

  try { walk(0, size, 0); } catch { /* ignore */ }
  return found;
}


/**
 * Ambil dimensi dari container WebM/Matroska (EBML).
 * Cari element `PixelWidth` (0xB0) & `PixelHeight` (0xBA) di dalam
 * TrackVideo (0xE0). Nilai bisa berupa uint (umumnya) atau float.
 */
function webmSize(buf) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.length);
  // Baca EBML element: id (vint) + size (vint).
  // Panjang vint (data length prefix) dari byte pertama.
  const vintLen = (byte) => {
    if (byte === 0) return 0;
    for (let i = 0; i < 8; i++) if (byte & (0x80 >> i)) return i + 1;
    return 0;
  };
  const readId = (off) => {
    const len = vintLen(buf[off]);
    if (!len || off + len > buf.length) return null;
    let id = 0;
    for (let i = 0; i < len; i++) id = id * 256 + buf[off + i];
    return { id, len };
  };
  // EBML size vint: bit penanda dihapus dari byte PERTAMA.
  const readSize = (off) => {
    const len = vintLen(buf[off]);
    if (!len || off + len > buf.length) return null;
    const first = buf[off];
    let value = first & (0xff >> len);
    let allOnes = (value === (0xff >> len));
    for (let i = 1; i < len; i++) {
      const b = buf[off + i];
      if (b !== 0xff) allOnes = false;
      value = value * 256 + b;
    }
    // Semua byte 1 -> ukuran "unknown" (ganti dengan sisa buffer).
    if (allOnes) return -1;
    return value;
  };
  const readUint = (off, size) => {
    let v = 0;
    for (let i = 0; i < size; i++) v = v * 256 + buf[off + i];
    return v;
  };
  const readFloat = (off, size) => {
    if (size === 4) return view.getFloat32(off);
    if (size === 8) return view.getFloat64(off);
    return 0;
  };

  let width = 0, height = 0;
  // Walk depth-first, cari PixelWidth/PixelHeight di dalam TrackVideo.
  const walk = (start, end, depth) => {
    if (depth > 8) return;
    let off = start;
    while (off < end) {
      const head = readId(off);
      if (!head) return;
      const size = readSize(off + head.len);
      if (size === null) return;
      const dataStart = off + head.len + vintLen(buf[off + head.len]);
      const dataEnd = size >= 0 ? Math.min(end, dataStart + size) : end;
      if (dataEnd <= dataStart && size !== 0) return;
      // PixelWidth (0xB0) / PixelHeight (0xBA)
      if (head.id === 0xb0 && size > 0 && size <= 8) width = Math.round(readUint(dataStart, size));
      else if (head.id === 0xba && size > 0 && size <= 8) height = Math.round(readUint(dataStart, size));
      else if (head.id === 0x9f && size > 0 && size <= 8) width = Math.round(readFloat(dataStart, size));
      else if (head.id === 0x9a && size > 0 && size <= 8) height = Math.round(readFloat(dataStart, size));
      // Container elements -> telusuri.
      if ([0x18538067, 0x1654ae6b, 0xae, 0x1f43b675, 0x1c53bb6b, 0x114d9b74, 0x4dbb, 0xe0, 0x1f43b675].includes(head.id)) {
        walk(dataStart, dataEnd, depth + 1);
      }
      if (size < 0) return;
      off = dataEnd;
    }
  };
  try {
    walk(0, buf.length, 0);
  } catch { /* ignore */ }
  if (width > 0 && height > 0) return { width, height };
  return null;
}

/**
 * Deteksi dimensi aset dari bytes file.
 * @param {Buffer} buffer isi file
 * @param {string} mime contoh 'video/mp4'
 * @returns {{width:number,height:number}|null}
 */
export function detectDimensions(buffer, mime = '') {
  if (!buffer || !buffer.length) return null;
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const m = String(mime || '').toLowerCase();
  try {
    if (m.includes('png')) return pngSize(buf);
    if (m.includes('jpeg') || m.includes('jpg')) return jpegSize(buf);
    if (m.includes('gif')) return gifSize(buf);
    if (m.includes('webp')) return webpSize(buf);
    if (m.includes('webm') || m.includes('matroska')) return webmSize(buf);
    if (m.includes('mp4') || m.includes('mov') || m.includes('m4v') || m.includes('3gp') || m.includes('quicktime')) {
      return mp4Size(buf);
    }
  } catch { /* ignore */ }
  // Fallback: sniff signature.
  try {
    if (buf.length >= 4 && buf.readUInt32BE(0) === 0x89504e47) return pngSize(buf);
    if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8) return jpegSize(buf);
    if (buf.length >= 12 && buf.toString('ascii', 0, 3) === 'GIF') return gifSize(buf);
    if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF') return webpSize(buf);
    if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return webmSize(buf);
    if (buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp') return mp4Size(buf);
  } catch { /* ignore */ }
  return null;
}

export default detectDimensions;
