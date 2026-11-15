// ===== Konfigurasi Kolaborasi SherlyStudio =====
// Halaman "Kolaborasi" (publik, untuk klien) membaca data ini.
//
// PENTING: isi nomor WhatsApp studio di bawah (format internasional tanpa "+",
// contoh: '6281234567890') supaya brief dari klien langsung terkirim ke kamu.
// Kalau masih kosong, tombol kirim akan membuka WhatsApp dengan teks siap kirim
// dan klien memilih kontak tujuan sendiri.
window.SHERLY_STUDIO = {
  whatsapp: '',
  instagram: 'https://www.instagram.com/sherlyves/',

  // Layanan yang ditawarkan ke klien
  services: [
    { icon: 'film', title: 'Konten Feed & Reels', desc: 'Foto, video, dan copy siap tayang untuk feed & reels \u2014 on-brand dari konsep sampai editing.' },
    { icon: 'clapperboard', title: 'Campaign & Brand Ambassador', desc: 'Kolaborasi kampanye penuh dengan karakter pilihanmu \u2014 brief, produksi, hingga evaluasi performa.' },
    { icon: 'sparkles', title: 'Karakter Custom (AI Talent)', desc: 'Butuh karakter khusus untuk brand-mu \u2014 misalnya karakter lelaki? Kami rancang persona, visual, dan gaya bicaranya dari nol.' },
    { icon: 'pencil', title: 'Copywriting & Strategi Konten', desc: 'Caption, pilar konten, dan kalender publikasi yang terasa seperti manusia \u2014 bukan template.' }
  ],

  // Katalog karakter (tambah karakter baru di sini — kartunya muncul otomatis)
  characters: [
    {
      id: 'sherly', name: 'Sherly', img: 'assets/sherly-portrait.png',
      role: 'Lifestyle \u00b7 Beauty \u00b7 Fashion \u00b7 Travel',
      desc: 'Hangat, estetik, timeless \u2014 spesialis konten keseharian yang relevan dan review yang jujur.',
      tags: ['Reels', 'Review jujur', 'Daily vlog'], status: 'Tersedia',
      htPin: 'H3NFU9' // PIN kontak HeyTalent (versi talent) — karakter lain nanti punya PIN sendiri
    }
  ],

  customNote: 'Butuh karakter lain \u2014 misalnya karakter lelaki, atau karakter khusus untuk brand-mu? Pilih \u201CBuatkan karakter baru\u201D di brief, tim kami yang merancang.'
};
