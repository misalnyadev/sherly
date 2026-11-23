// D-251: unit test modul client-side Motion Graphics (public/motion-graphics.js).
//
// Modul ini ESM murni (tanpa DOM di level atas) sehingga bisa di-import
// langsung di Node untuk menguji utilitas deterministiknya.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mod = await import('../public/motion-graphics.js');
const {
  interpolate, lerp, clamp, easeInOut, spring, parseCaptions, hexToRgba,
  MG_CLIENT_TEMPLATES, clientRenderSupported, drawCompositionFrame,
} = mod;

describe('D-251 utilitas client-side', () => {
  test('interpolate memakai bentuk Remotion (value, inputRange, outputRange)', () => {
    assert.equal(interpolate(0.5, [0, 1], [0, 100]), 50);
    assert.equal(interpolate(5, [0, 10], [100, 0]), 50);
    assert.equal(interpolate(0, [0, 1], [0, 100]), 0);
    assert.equal(interpolate(1, [0, 1], [0, 100]), 100);
    // Di luar rentang -> dijepit.
    assert.equal(interpolate(-3, [0, 1], [0, 100]), 0);
    assert.equal(interpolate(9, [0, 1], [0, 100]), 100);
  });

  test('interpolate rentang turun (fade out) benar', () => {
    // Fade out 1 -> 0 antara detik terakhir.
    assert.equal(interpolate(2, [2, 3], [1, 0]), 1);
    assert.equal(interpolate(2.5, [2, 3], [1, 0]), 0.5);
    assert.equal(interpolate(3, [2, 3], [1, 0]), 0);
  });

  test('interpolate rentang naik (fade in) benar', () => {
    assert.equal(interpolate(0, [0, 180], [0, 1]), 0);
    assert.ok(interpolate(90, [0, 180], [0, 1]) > 0.4);
    assert.equal(interpolate(180, [0, 180], [0, 1]), 1);
  });

  test('lerp & clamp bekerja', () => {
    assert.equal(lerp(0, 10, 0.25), 2.5);
    assert.equal(clamp(5, 0, 3), 3);
    assert.equal(clamp(-5, 0, 3), 0);
    assert.equal(clamp(1.5, 0, 3), 1.5);
  });

  test('easeInOut simetris', () => {
    assert.ok(easeInOut(0) < 0.01);
    assert.ok(Math.abs(easeInOut(0.5) - 0.5) < 0.01);
    assert.ok(easeInOut(1) > 0.99);
  });

  test('spring mulai dari 0 dan naik ke ~1', () => {
    assert.equal(spring(-1), 0);
    assert.ok(spring(1) > 0.5);
    assert.ok(spring(3) > 0.9);
  });

  test('hexToRgba menghasilkan rgba yang valid', () => {
    assert.equal(hexToRgba('#ff72c5', 0.5), 'rgba(255,114,197,0.5)');
    assert.equal(hexToRgba('ff72c5', 1), 'rgba(255,114,197,1)');
  });

  test('parseCaptions membaca SRT', () => {
    const srt = '1\n00:00:00,000 --> 00:00:02,000\nHalo\n\n2\n00:00:02,000 --> 00:00:04,000\nDunia';
    const cues = parseCaptions(srt, 4000);
    assert.equal(cues.length, 2);
    assert.equal(cues[0].text, 'Halo');
    assert.equal(cues[0].startMs, 0);
    assert.equal(cues[0].endMs, 2000);
    assert.equal(cues[1].text, 'Dunia');
    assert.equal(cues[1].startMs, 2000);
  });

  test('parseCaptions fallback: satu baris per slot', () => {
    const cues = parseCaptions('satu\ndua\ntiga', 3000);
    assert.equal(cues.length, 3);
    assert.equal(cues[0].text, 'satu');
    assert.equal(cues[2].text, 'tiga');
    // Cue tidak boleh melewati durasi total.
    for (const c of cues) assert.ok(c.endMs <= 3000);
  });

  test('parseCaptions input kosong -> tidak ada cue', () => {
    assert.deepEqual(parseCaptions('', 3000), []);
    assert.deepEqual(parseCaptions('   ', 3000), []);
  });
});

describe('D-251 katalog template client-side', () => {
  test('empat template tersedia dengan field wajib', () => {
    const ids = MG_CLIENT_TEMPLATES.map((t) => t.id);
    // D-276: template ke-4 = "Rangkaian Beat".
    assert.deepEqual(ids, ['branded-intro', 'captioned-clip', 'stat-card', 'beat-sequence']);
    for (const t of MG_CLIENT_TEMPLATES) {
      assert.ok(Array.isArray(t.fields) && t.fields.length, t.id + ' harus punya field');
      assert.ok(t.aspects.includes('9:16'), t.id + ' harus mendukung 9:16');
      assert.ok(t.durations.length, t.id + ' harus punya durasi');
    }
    // Intro, kartu statistik & rangkaian beat butuh isi; klip subtitle boleh kosong.
    for (const id of ['branded-intro', 'stat-card', 'beat-sequence']) {
      const t = MG_CLIENT_TEMPLATES.find((x) => x.id === id);
      assert.ok(t.fields.some((f) => f.required), id + ' harus punya minimal satu field wajib');
    }
  });

  test('katalog client-side sama dengan katalog server', async () => {
    const server = await import('../server/motion-graphics.js');
    const s = server.MG_TEMPLATES;
    assert.equal(s.length, MG_CLIENT_TEMPLATES.length);
    for (const st of s) {
      const ct = MG_CLIENT_TEMPLATES.find((x) => x.id === st.id);
      assert.ok(ct, 'template server "' + st.id + '" harus ada di client');
      assert.deepEqual(ct.fields.map((f) => f.key), st.fields.map((f) => f.key), 'field harus sama: ' + st.id);
      assert.deepEqual(ct.aspects, st.aspects, 'rasio harus sama: ' + st.id);
      assert.deepEqual(ct.durations, st.durations, 'durasi harus sama: ' + st.id);
      assert.equal(ct.defaultDuration, st.defaultDuration, 'durasi default harus sama: ' + st.id);
    }
  });
});

describe('D-251 modul client-side', () => {
  test('clientRenderSupported() false di Node (tanpa WebCodecs)', () => {
    assert.equal(clientRenderSupported(), false);
  });

  test('drawCompositionFrame menolak template tak dikenal', () => {
    assert.throws(() => drawCompositionFrame({}, 'nope', 100, 100, 0, {}, 3), /tidak dikenal/i);
  });

  test('drawCompositionFrame menggambar tanpa error (canvas stub)', () => {
    // Stub ctx 2D yang mencatat panggilan — cukup untuk memastikan tidak ada
    // akses properti ctx yang tidak ada.
    const calls = [];
    const ctx = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'measureText') return (s) => ({width: String(s).length * 8});
        if (prop === 'canvas') return {width: 1080, height: 1920};
        if (prop === 'createLinearGradient') return () => ({addColorStop() {}});
        if (prop === 'createRadialGradient') return () => ({addColorStop() {}});
        if (typeof prop === 'string' && ['fillStyle', 'strokeStyle', 'font', 'textAlign', 'globalAlpha', 'lineWidth', 'letterSpacing'].includes(prop)) return '';
        return (...args) => { calls.push(String(prop)); return undefined; };
      },
      set() { return true; },
    });
    drawCompositionFrame(ctx, 'branded-intro', 1080, 1920, 1.2, { title: 'Uji', subtitle: 'Sub' }, 4);
    assert.ok(calls.length > 10, 'komposisi harus menggambar banyak elemen');
    assert.ok(calls.includes('fillText'), 'harus menulis teks');
  });

  test('ketiga komposisi menggambar tanpa error', () => {
    for (const id of ['branded-intro', 'captioned-clip', 'stat-card']) {
      const ctx = new Proxy({}, {
        get(_t, prop) {
          if (prop === 'measureText') return (s) => ({width: String(s).length * 8});
          if (prop === 'canvas') return {width: 1080, height: 1080};
          if (prop === 'createLinearGradient') return () => ({addColorStop() {}});
          if (prop === 'createRadialGradient') return () => ({addColorStop() {}});
          if (typeof prop === 'string' && ['fillStyle', 'strokeStyle', 'font', 'textAlign', 'globalAlpha', 'lineWidth', 'letterSpacing'].includes(prop)) return '';
          return () => undefined;
        },
        set() { return true; },
      });
      const props = id === 'stat-card' ? { value: '1', label: 'L', note: 'N' }
        : id === 'captioned-clip' ? { captionsText: 'satu\ndua' }
          : { title: 'T', subtitle: 'S' };
      drawCompositionFrame(ctx, id, 1080, 1080, 1.0, props, 4);
    }
  });
});

describe('D-251 integrasi vendor mediabunny', () => {
  test('public/vendor/mediabunny.min.mjs tersedia & berformat ESM', () => {
    const src = readFileSync('public/vendor/mediabunny.min.mjs', 'utf8');
    assert.ok(src.length > 100_000, 'bundle mediabunny harus ada (lazy-load saat render)');
    assert.match(src, /export\s*\{/, 'harus berupa modul ESM');
  });

  test('modul meng-import mediabunny via path relatif vendor', () => {
    const src = readFileSync('public/motion-graphics.js', 'utf8');
    assert.match(src, /import\('\.\/vendor\/mediabunny\.min\.mjs'\)/,
      'harus import vendor lokal (bukan bare specifier) supaya jalan tanpa bundler');
    assert.doesNotMatch(src, /from\s+'mediabunny'/, 'tidak boleh pakai bare specifier');
  });
});

describe('D-252 batas ukuran upload (Vercel 4,5 MB)', () => {
  test('bitrateForDuration menurunkan bitrate supaya muat', () => {
    const short = mod.bitrateForDuration(4);
    const long = mod.bitrateForDuration(10);
    assert.ok(long < short, 'durasi lebih panjang -> bitrate lebih kecil');
    // Batas atas & bawah.
    assert.ok(short <= 6_000_000, 'bitrate tidak boleh melebihi batas atas');
    assert.ok(long >= 800_000, 'bitrate tidak boleh terlalu kecil');
    // Estimasi ukuran harus di bawah batas upload untuk semua durasi模板.
    for (const dur of [4, 5, 6, 8, 10]) {
      const bytes = (mod.bitrateForDuration(dur) / 8) * dur;
      assert.ok(bytes <= mod.MG_UPLOAD_MAX_BYTES,
        'durasi ' + dur + ' dtk harus muat (estimasi ' + (bytes / 1024 / 1024).toFixed(2) + ' MB)');
    }
  });

  test('batas upload di bawah limit Vercel 4,5 MB', () => {
    assert.ok(mod.MG_UPLOAD_MAX_BYTES <= 4.5 * 1024 * 1024,
      'batas upload harus di bawah batas platform 4,5 MB');
  });
});
