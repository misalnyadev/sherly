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

## 7. Estimasi kerja

| Bagian | Waktu |
|---|---|
| Pre-boot splash inline (HTML + CSS + JS hide) | ~20 menit |
| Script generate apple startup images (ImageMagick) | ~30 menit |
| 13/26 `<link>` + media query | ~15 menit |
| Manifest Android tweak | ~5 menit |
| Test visual (Chromium HP + cek iOS via media query) | ~30 menit |
| Regression test | ~20 menit |
| **Total** | **~2 jam** |

---

## 8. Rekomendasi final

**Lakukan Opsi B**, dengan:
- Pre-boot splash inline (semua HP + browser), **minimum 600 ms**, hilang
  otomatis + safety net
- **Hanya tampil di HP** (`@media(max-width:560px)`) — sesuai permintaan
- 13 apple startup image (portrait) → 26 kalau mau landscape juga
- Warna `#070b14` + logo `sherly-mark.png` + tagline
- Animasi denyut halus pada logo (mati kalau `prefers-reduced-motion`)
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
