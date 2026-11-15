// ===== Data Portfolio SherlyStudio =====
// Karya ditampilkan di halaman Portfolio (grid + detail).
// Ganti / tambah / hapus karya kamu langsung di daftar ini.
//
// Format tiap karya:
//   id     : unik bebas (mis. 'p1')
//   type   : 'photo' | 'video' | 'copy'
//   title  : judul karya
//   client : (opsional) nama brand / klien
//   date   : (opsional) periode, mis. 'Okt 2025'
//   tags   : (opsional) array label, mis. ['Banner','Beauty']
//
//   photo : img  = path gambar (taruh file di assets/portfolio/), desc = cerita di balik karya
//   video : img  = cover/thumbnail, video = path atau URL file video (boleh kosong dulu -> tampil sebagai slot)
//   copy  : headline = kalimat pembuka besar, copy = teks lengkap (boleh multi-baris dengan \n)
window.PORTFOLIO_ITEMS = [
  {
    id: 'p1', type: 'photo', title: 'Serum Glow — Key Visual',
    client: 'Glow Studio', date: 'Okt 2025', tags: ['Banner', 'Beauty', 'Retouch'],
    img: 'assets/portfolio/p1.jpg',
    desc: 'Key visual kampanye pelancaran serum — konsep neon pink di atas dasar gelap biar langsung nyeruik di feed. Retouch kulit & botol dikerjakan manual, cahaya rim pink bikin produk jadi pusat perhatian.'
  },
  {
    id: 'p2', type: 'photo', title: 'Flatlay Koleksi Skincare',
    client: 'Personal Brand', date: 'Sep 2025', tags: ['Flatlay', 'Konten'],
    img: 'assets/portfolio/p2.jpg',
    desc: 'Flatlay produk untuk konten edukasi skincare — susunan sengaja diberi ruang kosong biar nyaman dilihat, aksen kelopak mawar jadi pemantik warna.'
  },
  {
    id: 'p3', type: 'photo', title: 'Poster Tipografi “Create · Edit · Share”',
    client: 'SherlyStudio', date: 'Agu 2025', tags: ['Tipografi', 'Poster'],
    img: 'assets/portfolio/p3.jpg',
    desc: 'Poster identitas SherlyStudio — tiga kata kerja yang jadi spirit studio, dikerjakan dengan glow neon konsisten palet pink.'
  },
  {
    id: 'p4', type: 'video', title: 'Reels — Behind the Scenes',
    client: 'Personal Brand', date: 'Okt 2025', tags: ['Reels', 'BTS'],
    img: 'assets/portfolio/p4.jpg', video: '',
    desc: 'Dokumentasi proses produksi konten beauty — dari set lampu sampai hasil akhir. Contoh slot video: isi field “video” dengan file/URL video di portfolio-data.js.'
  },
  {
    id: 'p5', type: 'photo', title: 'SherlyStudio — Visual Panel',
    client: 'SherlyStudio', date: 'Jul 2025', tags: ['Branding'],
    img: 'assets/sherly-panel.png',
    desc: 'Panel visual untuk identitas studio — dipakai di materi perkenalan & presentasi.'
  },
  {
    id: 'p6', type: 'copy', title: 'Campaign Copy — 30 Hari Konten',
    client: 'Personal Brand', date: 'Okt 2025', tags: ['Copywriting', 'Campaign'],
    headline: '30 hari, satu niche, tetap relevan.',
    copy: 'Hari 1 — Perkenalan ulang: siapa aku sekarang, dan apa yang berubah.\nHari 2–8 — Edukasi: pecah satu masalah audiens jadi lima konten kecil yang mudah dicerna.\nHari 9 — Sosial proof: hasil nyata pemakaian produk, before–after jujur.\nHari 10–15 — Storytelling: alasan personal di balik setiap rekomendasi.\nHari 16–22 — Interaksi: polling, Q&A, dan konten duet bareng komunitas.\nHari 23–29 — Soft selling: framing produk sebagai solusi, bukan tujuan.\nHari 30 — Refleksi + teaser arah konten bulan depan.'
  }
];
