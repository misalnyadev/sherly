# Riset: Splashscreen khusus tampilan HP — November 2026

> Status: **riset Only** — belum ada implementasi. Dokumen ini bahan pertimbangan
> sebelum bikin splashscreen.

---

## 1. Yang sudah ada di SherlyStudio

| Aset | Status |
|---|---|
| `public/manifest.webmanifest` | ✅ ada — `display: standalone`, `background_color: #070b14`, `theme_color: #170f20` |
| Icon 192 / 512 / 512-maskable | ✅ ada di `public/assets/icons/` |
| `apple-touch-icon.png` | ✅ ada (23 KB) |
| `apple-mobile-web-app-capable` | ✅ `yes` |
| `apple-mobile-web-app-status-bar-style` | ✅ `black-translucent` |
| `apple-mobile-web-app-title` | ✅ `SherlyStudio` |
| Logo mark | ✅ `public/assets/sherly-mark.png` (19 KB) |
| Ikon app `sherlyheart` | ✅ ada di `ICONS` (`public/index.html`) |
| **Splashscreen / startup image** | ❌ **belum ada** |
| **Pre-boot splash (anti white-flash)** | ❌ belum ada |

> ⚠️ Satu jebakan penting: `black-translucent` + `viewport-fit=cover` bikin
> konten app **nyempit ke bawah status bar**. Kalau splashscreen bikin area
> terpotong, itu karena setting status bar, bukan splashscreen-nya.

---

## 2. Dua mechanism yang BEDA (dan ini kunci pemikirannya)

### 2.1 Android / Chromium (WebAPK)

Chromium **bikin splashscreen otomatis** dari manifest:
- `background_color` → warna latar
- `icons` (utama `purpose: any` atau `maskable`) → logo di tengah
- `name` → teks di bawah logo
- `theme_color` → warna status bar

**Tidak perlu file apa pun.** Yang perlu cuma pastikan manifest & icon bener.
Sudah ✅ di repo.

### 2.2 iOS / iPadOS (Safari)

Safari **abaikan `background_color`** dan **tidak generate splashscreen**.
Yang dipake: `<link rel="apple-touch-startup-image" href="..." media="...">`.

Aturan iOS yang tricky:
- Gambar **HARUS ukuran persis** dengan window PWA → **butuh 1 gambar per
  ukuran layar + orientasi**
- **Salah 1 pixel → gak dipakai**, dan iOS jatuh ke **screenshot terakhir** app
  (bisa "white flash" atau gambar acak)
- `media` query harus pakai `device-width`/`device-height` **dalam satuan CSS**
  + `-webkit-device-pixel-ratio` + `orientation`
- ❗ `apple-touch-startup-image` **hanya jalan kalau** ada
  `apple-mobile-web-app-capable` — jadi tag itu **wajib** (itti ada di kita ✅)
- 📱 **iOS 26+**: setiap situs yang ditambahkan ke Home Screen jadi web app
  by default, dan `apple-mobile-web-app-capable` jadi opsional

### 2.3 Browser biasa (HP buka via URL, bukan PWA)

**Tidak ada splashscreen sama sekali.** Yang ada cuma:
- Browser menampilkan background putih sesaat sebelum first paint
- Lalu app kita

Ini yang paling sering bikin "jelek" — user lihat layar putih 0,3 detik.

---

## 3. Solusi: 3 lapis (recommended)

### Lapis 1 — Pre-boot splash inline (SEMUA HP + browser)

Tag HTML/CSS di paling atas `<head>`, sebelum CSS app. Otomatis hilang saat
`<body>` siap.

**Walet** (dipakai iOS saat startup image tak cocok):
```html
<style>
  #splash{position:fixed;inset:0;z-index:99999;background:#070b14;
    display:flex;align-items:center;justify-content:center;
    transition:opacity .35s ease,visibility .35s}
  #splash.done{opacity:0;visibility:hidden;pointer-events:none}
  @media(min-width:561px){#splash{display:none}}
</style>
```

**Isi**: background `#070b14` (sama dengan manifest) + logo `sherly-mark.png`
kecil + tagline. Logo bisa pakai `sherlyheart` SVG inline (khas Sherly, konsisten
dengan D-193) atau PNG mark.

**Kenapa harus inline**: kalau `<link>` ke CSS eksternal, browser harus download
dulu → white flash tetap terjadi. Inline = 0 request tambahan.

### Lapis 2 — Apple startup images (iOS PWA)

Generate PNG per ukuran layar, taruh di `public/splash/`, tambah
`<link rel="apple-touch-startup-image">` di `<head>`.

**Daftar ukuran (CSS px, portrait) — iPhone:**
| Device | CSS | DPR | Pixel |
|---|---|---|---|
| iPhone SE (2/3) | 375×667 | 2 | 750×1334 |
| iPhone 8 | 375×667 | 2 | 750×1334 |
| iPhone X/XS/11 Pro | 375×812 | 3 | 1125×2436 |
| iPhone XR/11 | 414×896 | 2 | 828×1792 |
| iPhone XS Max/11 Pro Max | 414×896 | 3 | 1242×2688 |
| iPhone 12/13/14 | 390×844 | 3 | 1170×2532 |
| iPhone 12/13 mini | 375×812 | 3 | 1125×2436 |
| iPhone 12/13/14 Pro Max | 428×926 | 3 | 1284×2778 |
| iPhone 14 Pro | 393×852 | 3 | 1179×2556 |
| iPhone 14 Pro Max | 430×932 | 3 | 1290×2796 |
| iPhone 15/16 | 393×852 | 3 | 1179×2556 |
| iPhone 15/16 Plus | 430×932 | 3 | 1290×2796 |
| iPhone 15/16 Pro Max | 440×956 | 3 | 1320×2868 |

**Total: 13 ukuran × 2 orientasi = 26 gambar.** Atau bisa lebih irit: cukup
**portrait** saja (kebanyakan user portrait) → 13 gambar.

**Ukuran file**: kalau PNG di-palette-reduce → total **~270 KB** untuk 26 gambar.
Kalau full color → bisa 2–3 MB (terlalu berat). ⚠️ `pwa-asset-generator` &
`sharp` butuh dependency; di repo ini **ImageMagick (`convert`) sudah ada** →
bisa generate tanpa dependency baru.

### Lapis 3 — Manifest Android (udah ada, tinggal optimasi)

Manifest sekarang sudah bener. Tambahan opsional:
- `"orientation": "portrait"` — biar splash Android portrait (tapi **belum
  didukung iOS**)
- `"categories"`, `"shortcuts"` — biar lebih "app-like"
- Icon **maskable** sudah ada ✅ (Chromium pakai yang maskable kalau ada)

---

## 4. Opsi implementasi

| Opsi | Isi | Detail | binary |
|---|---|---|---|
| **A. Minimal (HTML/CSS saja)** | Pre-boot splash inline | 1 blok HTML + CSS + 1 baris JS. Gak ada file gambar baru. Beres white-flash di semua HP. | ~2 KB |
| **B. Lengkap** | A + 13/26 apple startup image + `<link>` | Perlu script generate (`tools/generate-splash.sh` pakai ImageMagick). | ~270 KB |
| **C. Native-ish (PWA)** | B + service worker cache splash | `public/sw.js` sudah ada — cek apakah sudah cache aset. | + SW work |
| **D. B + video animasi** | B + MP4/GIF logo di pre-boot splash | Pakai file animasi user. System splash tetap PNG statis (wajib). | + ukuran video |

### Rekomendasi gw: **Opsi B**
Reason:
1. Opsi A solve 80% masalah (white flash + halaman kosong) dengan **risiko
   rendah**
2. Tapi kalau app ini **dijadiin app HP** (PWA di Home Screen), layar
   pembuka iOS itu bagian dari **first impression** — worth it
3. Logo & warna udah ada →**<br>
generate cuma kerjaan ImageMagick, tanpa dependency baru
4. Ukuran ±270 KB itu **kecil** untuk PWA (dibanding app native 30 MB+)

---

## 5. Keputusan desain (yang perlu kamu tentukan)

### 5.1 Tampilan
| Opsi | Deskripsi |
|---|---|
| **① Logo + tagline** | Logo Sherly (pink gradient) di tengah, di bawahnya "SherlyStudio" + tagline "CREATE · EDIT · SHARE" |
| **② Logo animasi** | Logo heartbeat (sherlyheart) berdenyut pelan — inline SVG/CSS, ringan |
| **③ Minimal** | Cuma logo, tanpa teks |
| **④ Progress bar** | Garis pink horizontal di bawah logo (indikatif loading) |

### 5.2 Warna latar
- `#070b14` (bg app & manifest) — **konsisten, anti white-flash** ⭐
- `#170f20` (theme_color) — lebih plum, lebih "brand"

Gw rekomendasikan **#070b14** + aksen pink, biar nyambung sama app.

### 5.3 Durasi splash
- **Otomatis**: hilang begitu DOM siap ( Recommended — nggak nge-block)
- **Minimum 600 ms** biar "ny purposeful" (bikin splash keliatan, tapi tetap cepat)
- **Fixed 1,2 dtk** (risiko: user Dissaway )

### 5.4 Munculnya
- **Setiap buka app** (termasuk yang udah login)
- **Hanya saat cold start** (butuh `sessionStorage` flag) — lebih halus
- **Hanya PWA (navigator.standalone)** — browser biasa ga perlu

Gw rekomendasikan: **hanya PWA + minimum 600 ms** — di browser biasa cukup
pre-boot singkat tanpa flash.

---

## 6. Detail teknis yang perlu hati-hati

### 6.1 Z-index
Splash harus `z-index` **di atas semua**. Z-index tertinggi yang sekarang dipakai
di repo ini:

| Elemen | z-index |
|---|---|
| mobile tabbar | 60 |
| modal / dialog | 120 |
| settings popover | 130 |
| **lightbox (tertinggi)** | **140** |
| chat-module | 110 |

→ **splash pakai `z-index: 200`** (atau 9999 kalau mau pasti paling atas).
Tablet `chat-module` juga 110, jadi jangan lupa.

### 6.2 Timing hide
Splash jangan hilang sebelum **CSS app + font** siap → Otherwise ada flash
"ganti layout". Event yang pas:
```js
document.fonts?.ready.then(hideSplash)   // font Inter sudah loaded
window.addEventListener('load', hideSplash, { once: true })
```
Plus `setTimeout(hideSplash, 1200)` sebagai **safety net** (jangan sampai
splash nyangkut kalau ada error).

### 6.3 iOS safe area
Karena `viewport-fit=cover` + `black-translucent`, konten splash di iOS bisa
ke bawah notch. Pakai `env(safe-area-inset-*)`.

### 6.4 Aksesibilitas
- Splash harus `<div role="status" aria-live="polite">` atau minimal
  `aria-hidden` kalau purely dekoratif
- Jangan blok scroll selama splash aktif (`overflow:hidden` di body) — tapi
  pastikan user ga bisa interact duluan

### 6.5 Reduced motion
Kalau user set `prefers-reduced-motion: reduce` → matikan animasi logo denyut.

### 6.6 Don't break the PWA cache
`public/sw.js` — kalau ada service worker yang cache app shell, tambah file
splash ke precache list biar offline tetap keliatan bagus.

### 6.7 Test
Verifikasi di:
- **iOS Safari PWA** (iPhone 375×812, 390×844, 430×932) → cek startup image
  **tanpa white flash**
- **Android Chrome PWA** → cek manifest-generated splash
- **Browser HP biasa** → cek pre-boot splash muncul & hilang
- **Desktop** → splash harus **tidak muncul** (user minta "khusus tampilan HP")

---

## 6b. Opsi baru: MP4 / GIF animasi logo (dari user)

User sudah bikin **file MP4 + GIF animasi logo SherlyStudio**. Pertanyaannya:
**bisa dipakai gak?** → **BISA, dan bagus banget.** Tapi ada batasan penting
per platform.

### 6b.1 Batasan utama: mana yang bisaanimated

| Target | Animated? | Mekanisme |
|---|---|---|
| **Android/Chromium splash** | ❌ **TIDAK** | Chromium generates splash dari manifest → **harus statis** (PNG/SVG) |
| **iOS `apple-touch-startup-image`** | ❌ **TIDAK** | Apple hanya baca **gambar statis** (PNG/JPEG). Tidak ada video/GIF |
| **Pre-boot splash (kita bikin sendiri)** | ✅ **BISA** | Kita kontrol sendiri → `<video>` atau `<img src=gif>` |

> ⚠️ **Ini poin paling penting:** bagian yang otomatis (system splash) **harus
> tetap statis**. Tapi bagian yang **kita kendalikan sendiri** (pre-boot splash
> yang fade in setelah app load) **bisa animated**.

### 6b.2 MP4 vs GIF

| | MP4 (H.264) | GIF |
|---|---|---|
| Ukuran | **200 KB – 1,5 MB** (5 detik) | **2 – 15 MB** (5 detik) |
| Kompresi | Modern, inter-frame | 256 warna, tanpa inter-frame |
| Alpha | ❌ tidak | ⚠️ **binary** (1-bit, tepi bergerigi) |
| Loop | ✅ `loop` attribute | ✅ otomatis |
| Autoplay mobile | ✅ perlu `muted` + `playsinline` | ✅ selalu jalan |
| Software | Butuh ffmpeg | Gak butuh |

**Data konkret** (5 detik, 480p, 24 fps):
| Format | Ukuran |
|---|---|
| GIF (256 warna) | 8,4 MB |
| GIF (128 warna, 12 fps) | 3,1 MB |
| Animated WebP (lossy) | 1,1 MB |
| MP4 H.264 CRF 23 | **211 KB** |
| MP4 H.265 CRF 28 | 142 KB |
| WebM VP9 CRF 30 | 178 KB |

→ **MP4 menang telak untuk ukuran** (40× lebih kecil dari GIF).
→ Tapi MP4 **tidak bisa alpha** → butuh **background baked in** (warna `#070b14`).

### 6b.3 Rekomendasi: Pakai KEDUA-DUA-nya

| Peran | Format | Alasan |
|---|---|---|
| **System splash** (Android + iOS) | **PNG statis** (frame pertama / poster) | Wajib statis. Ambil **frame 1** dari MP4-mu → PNG |
| **Pre-boot splash** (kita) | **MP4** (primary) + **GIF** (fallback) | MP4 ringan, GIF buat browser yg gak dukung video |

Implementasi pre-boot:
```html
<video id="splashVid" src="/assets/brand/sherly-logo.mp4"
       autoplay muted loop playsinline preload="auto"
       style="display:none"></video>
<img id="splashGif" src="/assets/brand/sherly-logo.gif" alt=""
     style="display:none">
```
```js
// pilih: video kalau didukung, kalau gagal -> GIF
const v = document.getElementById('splashVid');
if (v && v.canPlayType('video/mp4')) { v.style.display='block'; }
else { document.getElementById('splashGif').style.display='block'; }
```

### 6b.4 Format lain yang lebih ideal: **Animated WebP**
- Full alpha channel ✅
- ~5× lebih kecil dari GIF
- Support browser luas (Chrome, Firefox, Safari 14+, Edge)
- ❗ Gak bisa dipakai buat system splash (tetap statis)

**Kalau MP4-mu punya background solid** (baked), MP4 + GIF fallback udah cukup.
**Kalau butuh transparan** → convert ke **animated WebP**.

### 6b.5 Checklist kalau file-nya udah ada
- [ ] Durasi animasi ≤ **2 detik** (splash ga boleh lama)
- [ ] Loop seamless (frame terakhir nyambung ke frame pertama)
- [ ] Resolusi cukup: **minimal 512×512** logo (bisa di-scale)
- [ ] Background **solid** `#070b14` baked in (kalau MP4)
- [ ] **Tanpa audio track** (harus `muted`)
- [ ] Encoder: H.264 High Profile, `faststart` flag, CRF ~23, 24–30 fps
- [ ] Ukuran MP4 target **< 500 KB**; GIF target **< 1,5 MB**
- [ ] Ambil **frame pertama** → PNG untuk system splash (Android + iOS)
- [ ] Respect `prefers-reduced-motion` → tampilkan **PNG statis**, bukan animasi
- [ ] Jangan jadikan video sebagai **LCP element** → pakai `poster` PNG

### 6b.6 Catatan: fps & loop
Durasi splash rata-rata target **1,2–2 detik**. Kalau animasi logo 2 detik → user
bakal lihat ~1 loop penuh. Jangan lupa `loop` supaya ga ada "flicker" di akhir.

---

## 7. Estimasi kerja

| Bagian | Waktu |
|---|---|
| Pre-boot splash inline (HTML + CSS + JS hide) | ~20 menit |
| Integrasi MP4/GIF animasi (video element + fallback) | ~20 menit |
| Script generate apple startup images (ImageMagick) | ~30 menit |
| 13/26 `<link>` + media query | ~15 menit |
| Manifest Android tweak | ~5 menit |
| Test visual (Chromium HP + cek iOS via media query) | ~30 menit |
| Regression test | ~20 menit |
| **Total** | **~2,5 jam** |

---

## 8. Rekomendasi final

**Lakukan Opsi B**, dengan:
- Pre-boot splash inline (semua HP + browser), **minimum 600 ms**, hilang
  otomatis + safety net
- **Hanya tampil di HP** (`@media(max-width:560px)`) — sesuai permintaan
- **Video MP4 animasi logo** (dari user) di pre-boot splash + **GIF** sebagai
  fallback; **poster PNG** (frame 1) untuk `poster` attribute + system splash
- 13 apple startup image (portrait, **statis** — frame 1) → 26 kalau mau
  landscape juga
- Warna `#070b14` (sama dengan background MP4)
- Tagline "CREATE · EDIT · SHARE" di bawah logo
- `prefers-reduced-motion` → tampilkan PNG statis, bukan animasi
- Android: manifest sudah cukup, tinggal pastikan

---

## 9. Sumber

- https://web.dev/learn/pwa/enhancements — Apple startup image + media query
- https://progressivewebapps.com/design/splash-screens/ — perbandingan Android vs
  iOS vs desktop, tabel dukungan browser
- https://progressivewebapps.com/platforms/ios-safari/ — apa yang Safari baca dari
  manifest, batas iOS 26
- https://firt.dev/notes/pwa-ios/ — `apple-touch-startup-image` hanya jalan kalau
  ada `apple-mobile-web-app-capable`
- https://www.npmjs.com/package/pwa-asset-generator — generator (tapi butuh
  dependency; repo ini sudah ada ImageMagick)
- https://simicart.com/blog/pwa-splash-screen/ — pola meta tag
- https://github.com/HurshMJ/daily-checkin/issues/31 — rekomendasi: skip
  per-device launch image, pastikan first paint gelap
- https://www.kalex.studio/blog/lottie-vs-gif-vs-mp4-vs-webm-web-animation-formats —
  tabel ukuran format animasi web, rule "never make animation the LCP element"
- https://www.utilitykit.tools/blog/gif-vs-webp-vs-mp4-for-the-web/ — angka konkret
  8,4 MB GIF vs 211 KB MP4 (5 detik, 480p), alpha channel per format
- https://stackoverflow.com/questions/30979309/ios-animated-splash-screen —
  iOS launch image **harus statis**
