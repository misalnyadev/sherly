// ===== D-208: Seed Bank Prompt — gaya foto + 159 kode video (dari PDF) =====
//
// Dua kelompok kode dari PDF "KODE FOTO KE VIDEO" (50) dan "109 Kode Video Produk" (109).
// Semuanya mode VIDEO. Gaya foto lama (Lifestyle/Beauty/Timeless/Inspire) jadi
// template mode FOTO supaya transparan & bisa diedit sendiri. /** Template mode FOTO — gaya lama (D-203) yang sekarang jadi template transparan. */
export const SEED_FOTO_STYLES = [ { "label": "Lifestyle", "content": "Gaya hidup sehari-hari yang cozy dan estetik ala Bogor, cahaya alami, komposisi bersih dengan ruang bernapas.", "category": "gaya", "slots": [], "group": "style" }, { "label": "Beauty & Skincare", "content": "Visual beauty & skincare yang bersih dan elegan, cahaya lembut, nuansa cream, tekstur kulit natural dengan pori yang terlihat.", "category": "gaya", "slots": [], "group": "style" }, { "label": "Timeless Style", "content": "Outfit elegan ala capsule wardrobe yang timeless, tidak dikendalikan tren musaiman, komposisi bersih dan warna-warna netral.", "category": "gaya", "slots": [], "group": "style" }, { "label": "Inspire & Grow", "content": "Momen tumbuh menjadi kreator yang hangat dan inspiratif, cahaya pagi lembut, ekspresi alami dan penuh semangat.", "category": "gaya", "slots": [], "group": "style" }
]; /** 50 kode "KODE FOTO KE VIDEO" (mode video). */
export const SEED_CODES_FOTOVIDEO = [ { "label": "Crane Up", "content": "/craneup — Kamera bergerak naik perlahan dari posisi rendah, memperlihatkan area sekitar subjek.", "slots": [], "code": "/craneup", "group": "fotovideo" }, { "label": "Crane Down", "content": "/cranedown — Kamera turun perlahan dari atas menuju subjek.", "slots": [], "code": "/cranedown", "group": "fotovideo" }, { "label": "Pedestal Up", "content": "/pedestalup — Kamera naik secara vertikal dengan framing tetap pada subjek.", "slots": [], "code": "/pedestalup", "group": "fotovideo" }, { "label": "Pedestal Down", "content": "/pedestaldown — Kamera turun secara vertikal dengan fokus tetap pada subjek.", "slots": [], "code": "/pedestaldown", "group": "fotovideo" }, { "label": "Truck Left", "content": "/truckleft — Kamera bergerak ke kiri sambil mempertahankan subjek dalam frame.", "slots": [], "code": "/truckleft", "group": "fotovideo" }, { "label": "Truck Right", "content": "/truckright — Kamera bergerak ke kanan mengikuti posisi subjek.", "slots": [], "code": "/truckright", "group": "fotovideo" }, { "label": "Pan Left", "content": "/panleft — Kamera berputar perlahan ke arah kiri untuk memperlihatkan lingkungan.", "slots": [], "code": "/panleft", "group": "fotovideo" }, { "label": "Pan Right", "content": "/panright — Kamera berputar perlahan ke arah kanan.", "slots": [], "code": "/panright", "group": "fotovideo" }, { "label": "Tilt Up", "content": "/tiltup — Kamera mendongak dari subjek menuju bagian atas lingkungan.", "slots": [], "code": "/tiltup", "group": "fotovideo" }, { "label": "Tilt Down", "content": "/tiltdown — Kamera bergerak dari atas menuju subjek secara perlahan.", "slots": [], "code": "/tiltdown", "group": "fotovideo" }, { "label": "Dolly Zoom", "content": "/dollyzoom — Kamera bergerak maju sambil melakukan zoom berlawanan untuk menciptakan efek dramatis.", "slots": [], "code": "/dollyzoom", "group": "fotovideo" }, { "label": "Slow Push", "content": "/slowpush — Kamera mendekat sangat perlahan dengan nuansa sinematik.", "slots": [], "code": "/slowpush", "group": "fotovideo" }, { "label": "Fast Push", "content": "/fastpush — Kamera bergerak cepat mendekati subjek untuk menciptakan energi dramatis.", "slots": [], "code": "/fastpush", "group": "fotovideo" }, { "label": "Slow Pull", "content": "/slowpull — Kamera menjauh perlahan sambil mempertahankan subjek tetap dominan.", "slots": [], "code": "/slowpull", "group": "fotovideo" }, { "label": "Arc Shot", "content": "/arcshot — Kamera bergerak membentuk busur di sekitar subjek.", "slots": [], "code": "/arcshot", "group": "fotovideo" }, { "label": "Spiral Shot", "content": "/spiralshot — Kamera bergerak mengelilingi subjek dengan lintasan spiral yang halus.", "slots": [], "code": "/spiralshot", "group": "fotovideo" }, { "label": "Fly Through", "content": "/flythrough — Kamera seolah terbang melewati lingkungan menuju subjek.", "slots": [], "code": "/flythrough", "group": "fotovideo" }, { "label": "Back Orbit", "content": "/backorbit — Kamera mengorbit subjek dari belakang menuju sisi depan.", "slots": [], "code": "/backorbit", "group": "fotovideo" }, { "label": "Foreground", "content": "/foreground — Kamera melewati objek di depan untuk menciptakan efek depth dan cinematic reveal.", "slots": [], "code": "/foreground", "group": "fotovideo" }, { "label": "Rack Focus", "content": "/rackfocus — Fokus berpindah dari objek depan ke subjek utama secara sinematik.", "slots": [], "code": "/rackfocus", "group": "fotovideo" }, { "label": "Turnaround", "content": "/turnaround — Buat subjek perlahan berputar menghadap arah berbeda.", "slots": [], "code": "/turnaround", "group": "fotovideo" }, { "label": "Look Back", "content": "/lookback — Buat subjek berjalan lalu menoleh ke belakang secara natural.", "slots": [], "code": "/lookback", "group": "fotovideo" }, { "label": "Look Camera", "content": "/lookcamera — Buat subjek perlahan mengarahkan pandangan langsung ke kamera.", "slots": [], "code": "/lookcamera", "group": "fotovideo" }, { "label": "Head Turn", "content": "/headturn — Buat kepala subjek bergerak natural dari satu arah ke arah lain.", "slots": [], "code": "/headturn", "group": "fotovideo" }, { "label": "Body Turn", "content": "/bodyturn — Buat tubuh subjek berputar secara perlahan dan natural.", "slots": [], "code": "/bodyturn", "group": "fotovideo" }, { "label": "Step Forward", "content": "/stepforward — Buat subjek melangkah perlahan mendekati kamera.", "slots": [], "code": "/stepforward", "group": "fotovideo" }, { "label": "Step Back", "content": "/stepback — Buat subjek mundur perlahan dari kamera.", "slots": [], "code": "/stepback", "group": "fotovideo" }, { "label": "Pose Motion", "content": "/posemotion — Tambahkan gerakan kecil natural pada pose tanpa mengubah identitas subjek.", "slots": [], "code": "/posemotion", "group": "fotovideo" }, { "label": "Natural Walk", "content": "/naturalwalk — Buat subjek berjalan dengan gerakan tubuh yang realistis.", "slots": [], "code": "/naturalwalk", "group": "fotovideo" }, { "label": "Slow Walk", "content": "/slowwalk — Buat subjek berjalan perlahan dengan nuansa dramatis.", "slots": [], "code": "/slowwalk", "group": "fotovideo" }, { "label": "Cloth Motion", "content": "/clothmotion — Tambahkan gerakan kain atau pakaian yang tertiup angin secara natural.", "slots": [], "code": "/clothmotion", "group": "fotovideo" }, { "label": "Leaves", "content": "/leaves — Tambahkan daun-daun bergerak dan berjatuhan di sekitar adegan.", "slots": [], "code": "/leaves", "group": "fotovideo" }, { "label": "Dust", "content": "/dust — Tambahkan partikel debu yang melayang di udara dengan pencahayaan sinematik.", "slots": [], "code": "/dust", "group": "fotovideo" }, { "label": "Particles", "content": "/particles — Tambahkan partikel kecil bergerak untuk memperkuat kedalaman visual.", "slots": [], "code": "/particles", "group": "fotovideo" }, { "label": "Watermotion", "content": "/watermotion — Buat air di sekitar adegan bergerak secara realistis.", "slots": [], "code": "/watermotion", "group": "fotovideo" }, { "label": "Waves", "content": "/waves — Tambahkan gerakan ombak alami pada lingkungan.", "slots": [], "code": "/waves", "group": "fotovideo" }, { "label": "Cloud Motion", "content": "/cloudmotion — Buat awan bergerak perlahan di langit.", "slots": [], "code": "/cloudmotion", "group": "fotovideo" }, { "label": "Storm", "content": "/storm — Ubah suasana menjadi badai dengan angin, awan gelap, dan gerakan lingkungan yang dramatis.", "slots": [], "code": "/storm", "group": "fotovideo" }, { "label": "Embers", "content": "/embers — Tambahkan bara api kecil yang beterbangan di sekitar subjek.", "slots": [], "code": "/embers", "group": "fotovideo" }, { "label": "Magicaldust", "content": "/magicaldust — Tambahkan partikel cahaya berkilauan yang bergerak mengelilingi subjek.", "slots": [], "code": "/magicaldust", "group": "fotovideo" }, { "label": "Lens Flare", "content": "/lensflare — Tambahkan flare cahaya sinematik saat sumber cahaya mengenai lensa.", "slots": [], "code": "/lensflare", "group": "fotovideo" }, { "label": "Light Beam", "content": "/lightbeam — Tambahkan sinar cahaya yang menembus lingkungan secara dramatis.", "slots": [], "code": "/lightbeam", "group": "fotovideo" }, { "label": "Rim Light", "content": "/rimlight — Tambahkan cahaya dari belakang yang membentuk outline terang pada subjek.", "slots": [], "code": "/rimlight", "group": "fotovideo" }, { "label": "Back Light", "content": "/backlight — Gunakan sumber cahaya kuat dari belakang untuk menciptakan siluet sinematik.", "slots": [], "code": "/backlight", "group": "fotovideo" }, { "label": "Moonlight (Video)", "content": "/moonlight — Ubah pencahayaan menjadi cahaya bulan yang lembut dan dramatis.", "slots": [], "code": "/moonlight", "group": "fotovideo" }, { "label": "Volumetric", "content": "/volumetric — Tambahkan efek volumetric lighting dengan sinar cahaya yang terlihat di udara.", "slots": [], "code": "/volumetric", "group": "fotovideo" }, { "label": "Flash Cut", "content": "/flashcut — Tambahkan kilatan cahaya singkat seperti transisi dalam video musik.", "slots": [], "code": "/flashcut", "group": "fotovideo" }, { "label": "Dreamy", "content": "/dreamy — Ubah suasana menjadi lembut, dreamy, dan sedikit magical dengan gerakan kamera halus.", "slots": [], "code": "/dreamy", "group": "fotovideo" }, { "label": "Luxury Ad", "content": "/luxuryad — Ubah adegan menjadi visual iklan premium dengan kamera elegan dan pencahayaan mewah.", "slots": [], "code": "/luxuryad", "group": "fotovideo" }, { "label": "Trailer", "content": "/trailer — Ubah foto menjadi adegan trailer film dengan gerakan kamera dramatis, pencahayaan sinematik, dan atmosfer intens.", "slots": [], "code": "/trailer", "group": "fotovideo" }
]; /** 109 "Kode Video Produk" (mode video). */
export const SEED_CODES_PRODUK = [ { "label": "Smoke Reveal", "content": "/SmokeReveal — Produk muncul dari balik asap.", "slots": [], "code": "/SmokeReveal", "group": "produk" }, { "label": "Fire Reveal", "content": "/FireReveal — Produk muncul dari balik api.", "slots": [], "code": "/FireReveal", "group": "produk" }, { "label": "Water Reveal", "content": "/WaterReveal — Produk muncul dari cipratan air.", "slots": [], "code": "/WaterReveal", "group": "produk" }, { "label": "Ice Reveal", "content": "/IceReveal — Produk muncul dari dalam es.", "slots": [], "code": "/IceReveal", "group": "produk" }, { "label": "Lightning Reveal", "content": "/LightningReveal — Produk muncul disambar petir, dramatis.", "slots": [], "code": "/LightningReveal", "group": "produk" }, { "label": "Glass Break", "content": "/GlassBreak — Kaca pecah di depan produk.", "slots": [], "code": "/GlassBreak", "group": "produk" }, { "label": "Shatter Transition", "content": "/ShatterTransition — Pindah scene dengan efek pecah berkeping.", "slots": [], "code": "/ShatterTransition", "group": "produk" }, { "label": "Ink Splash", "content": "/InkSplash — Tinta menyebar buat munculin produk.", "slots": [], "code": "/InkSplash", "group": "produk" }, { "label": "Paint Explosion", "content": "/PaintExplosion — Cat meledak, produk muncul dari situ.", "slots": [], "code": "/PaintExplosion", "group": "produk" }, { "label": "Powder Burst", "content": "/PowderBurst — Ledakan bubuk atau debu warna-warni.", "slots": [], "code": "/PowderBurst", "group": "produk" }, { "label": "Times Square 3 D Reveal", "content": "/TimesSquare3DReveal — Produk jadi iklan 3D raksasa kayak di Times Square.", "slots": [], "code": "/TimesSquare3DReveal", "group": "produk" }, { "label": "Billboard Reveal", "content": "/BillboardReveal — Produk nempel di billboard gede pinggir jalan.", "slots": [], "code": "/BillboardReveal", "group": "produk" }, { "label": "Hologram Billboard", "content": "/HologramBillboard — Billboard versi hologram tembus pandang.", "slots": [], "code": "/HologramBillboard", "group": "produk" }, { "label": "LED Wall Ad", "content": "/LEDWallAd — Iklan produk di layar LED raksasa.", "slots": [], "code": "/LEDWallAd", "group": "produk" }, { "label": "City Screen Takeover", "content": "/CityScreenTakeover — Produk lo nguasain semua layar di kota.", "slots": [], "code": "/CityScreenTakeover", "group": "produk" }, { "label": "Floating Billboard", "content": "/FloatingBillboard — Billboard yang ngambang di udara.", "slots": [], "code": "/FloatingBillboard", "group": "produk" }, { "label": "Building Projection", "content": "/BuildingProjection — Iklan produk disorot ke dinding gedung.", "slots": [], "code": "/BuildingProjection", "group": "produk" }, { "label": "Bus Stop Ad", "content": "/BusStopAd — Iklan produk di halte bus, keliatan nyata.", "slots": [], "code": "/BusStopAd", "group": "produk" }, { "label": "Subway Ad", "content": "/SubwayAd — Iklan produk di dalam kereta bawah tanah.", "slots": [], "code": "/SubwayAd", "group": "produk" }, { "label": "Mall Display", "content": "/MallDisplay — Produk dipajang di dalam mall.", "slots": [], "code": "/MallDisplay", "group": "produk" }, { "label": "Cinematic", "content": "/Cinematic — Videonya dibikin berasa kayak film bioskop.", "slots": [], "code": "/Cinematic", "group": "produk" }, { "label": "Movie Scene", "content": "/MovieScene — Adegannya diubah jadi potongan film.", "slots": [], "code": "/MovieScene", "group": "produk" }, { "label": "Hollywood Shot", "content": "/HollywoodShot — Gaya film Hollywood, rapi dan mahal.", "slots": [], "code": "/HollywoodShot", "group": "produk" }, { "label": "Netflix Style", "content": "/NetflixStyle — Gaya serial streaming zaman sekarang.", "slots": [], "code": "/NetflixStyle", "group": "produk" }, { "label": "Marvel Intro", "content": "/MarvelIntro — Pembukaan ala film superhero.", "slots": [], "code": "/MarvelIntro", "group": "produk" }, { "label": "Sci Fi Movie", "content": "/SciFiMovie — Adegan film fiksi ilmiah.", "slots": [], "code": "/SciFiMovie", "group": "produk" }, { "label": "Thriller Scene", "content": "/ThrillerScene — Suasana tegang dan mencekam.", "slots": [], "code": "/ThrillerScene", "group": "produk" }, { "label": "Action Sequence", "content": "/ActionSequence — Adegan aksi yang cepat dan enerjik.", "slots": [], "code": "/ActionSequence", "group": "produk" }, { "label": "Drama Shot", "content": "/DramaShot — Adegan sedih atau mengharukan.", "slots": [], "code": "/DramaShot", "group": "produk" }, { "label": "Epic Finale", "content": "/EpicFinale — Penutup yang megah dan dramatis.", "slots": [], "code": "/EpicFinale", "group": "produk" }, { "label": "Golden Hour", "content": "/GoldenHour — Cahaya hangat kayak matahari mau terbenam.", "slots": [], "code": "/GoldenHour", "group": "produk" }, { "label": "Blue Hour", "content": "/BlueHour — Suasana sore kebiruan menjelang malam.", "slots": [], "code": "/BlueHour", "group": "produk" }, { "label": "Sunset Glow", "content": "/SunsetGlow — Cahaya sunset yang keemasan.", "slots": [], "code": "/SunsetGlow", "group": "produk" }, { "label": "Sunrise Magic", "content": "/SunriseMagic — Suasana pagi yang cerah dan magis.", "slots": [], "code": "/SunriseMagic", "group": "produk" }, { "label": "Moonlight", "content": "/Moonlight — Adegan disinari cahaya bulan.", "slots": [], "code": "/Moonlight", "group": "produk" }, { "label": "Rain Mood", "content": "/RainMood — Ditambahin hujan, suasananya melow.", "slots": [], "code": "/RainMood", "group": "produk" }, { "label": "Snow Fall", "content": "/SnowFall — Ditambahin salju turun.", "slots": [], "code": "/SnowFall", "group": "produk" }, { "label": "Fog Scene", "content": "/FogScene — Suasana berkabut dan misterius.", "slots": [], "code": "/FogScene", "group": "produk" }, { "label": "Storm Mode", "content": "/StormMode — Cuaca badai yang dramatis.", "slots": [], "code": "/StormMode", "group": "produk" }, { "label": "Cloud Break", "content": "/CloudBreak — Awan terbuka, cahaya nembus dari atas.", "slots": [], "code": "/CloudBreak", "group": "produk" }, { "label": "Drone Reveal", "content": "/DroneReveal — Kamera nyorot dari atas kayak drone.", "slots": [], "code": "/DroneReveal", "group": "produk" }, { "label": "Orbit Shot", "content": "/OrbitShot — Kamera muter ngelilingin produk.", "slots": [], "code": "/OrbitShot", "group": "produk" }, { "label": "Push In", "content": "/PushIn — Kamera pelan-pelan maju mendekat.", "slots": [], "code": "/PushIn", "group": "produk" }, { "label": "Pull Back", "content": "/PullBack — Kamera pelan-pelan mundur menjauh.", "slots": [], "code": "/PullBack", "group": "produk" }, { "label": "Tracking Shot", "content": "/TrackingShot — Kamera ngikutin objek yang gerak.", "slots": [], "code": "/TrackingShot", "group": "produk" }, { "label": "Gimbal Walk", "content": "/GimbalWalk — Kamera jalan mulus tanpa goyang.", "slots": [], "code": "/GimbalWalk", "group": "produk" }, { "label": "Crane Shot", "content": "/CraneShot — Kamera naik atau turun tegak lurus.", "slots": [], "code": "/CraneShot", "group": "produk" }, { "label": "Helicopter Shot", "content": "/HelicopterShot — Pengambilan dari udara kayak helikopter.", "slots": [], "code": "/HelicopterShot", "group": "produk" }, { "label": "FPV Fly Through", "content": "/FPVFlyThrough — Kamera terbang cepat sudut pandang orang pertama.", "slots": [], "code": "/FPVFlyThrough", "group": "produk" }, { "label": "Luxury Walk", "content": "/LuxuryWalk — Adegan jalan bergaya mewah.", "slots": [], "code": "/LuxuryWalk", "group": "produk" }, { "label": "CEO Style", "content": "/CEOStyle — Nuansa bos perusahaan yang berkelas.", "slots": [], "code": "/CEOStyle", "group": "produk" }, { "label": "Fashion Runway", "content": "/FashionRunway — Adegan catwalk peragaan busana.", "slots": [], "code": "/FashionRunway", "group": "produk" }, { "label": "Street Luxury", "content": "/StreetLuxury — Gaya mewah tapi di jalanan kota.", "slots": [], "code": "/StreetLuxury", "group": "produk" }, { "label": "Rich Lifestyle", "content": "/RichLifestyle — Suasana hidup kalangan atas.", "slots": [], "code": "/RichLifestyle", "group": "produk" }, { "label": "Yacht Scene", "content": "/YachtScene — Adegan di kapal pesiar.", "slots": [], "code": "/YachtScene", "group": "produk" }, { "label": "Penthouse View", "content": "/PenthouseView — Suasana apartemen mewah lantai atas.", "slots": [], "code": "/PenthouseView", "group": "produk" }, { "label": "Supercar Reveal", "content": "/SupercarReveal — Mobil sport muncul dengan dramatis.", "slots": [], "code": "/SupercarReveal", "group": "produk" }, { "label": "Private Jet", "content": "/PrivateJet — Adegan di dalam jet pribadi.", "slots": [], "code": "/PrivateJet", "group": "produk" }, { "label": "VIP Arrival", "content": "/VIPArrival — Kedatangan ala tamu penting.", "slots": [], "code": "/VIPArrival", "group": "produk" }, { "label": "Product Launch", "content": "/ProductLaunch — Adegan peluncuran produk resmi.", "slots": [], "code": "/ProductLaunch", "group": "produk" }, { "label": "Luxury Product", "content": "/LuxuryProduct — Produk dibikin keliatan mahal dan premium.", "slots": [], "code": "/LuxuryProduct", "group": "produk" }, { "label": "Macro Shot", "content": "/MacroShot — Close-up banget, detail produk keliatan jelas.", "slots": [], "code": "/MacroShot", "group": "produk" }, { "label": "360 Spin", "content": "/360Spin — Produk muter penuh satu putaran.", "slots": [], "code": "/360Spin", "group": "produk" }, { "label": "Floating Product", "content": "/FloatingProduct — Produk ngambang di udara.", "slots": [], "code": "/FloatingProduct", "group": "produk" }, { "label": "Perfume Ad", "content": "/PerfumeAd — Iklan parfum atau kosmetik.", "slots": [], "code": "/PerfumeAd", "group": "produk" }, { "label": "Jewelry Showcase", "content": "/JewelryShowcase — Perhiasan dipamerin dengan visual mewah.", "slots": [], "code": "/JewelryShowcase", "group": "produk" }, { "label": "Watch Commercial", "content": "/WatchCommercial — Iklan jam tangan mahal.", "slots": [], "code": "/WatchCommercial", "group": "produk" }, { "label": "Shoe Spotlight", "content": "/ShoeSpotlight — Sepatu jadi bintang utama iklannya.", "slots": [], "code": "/ShoeSpotlight", "group": "produk" }, { "label": "Tech Reveal", "content": "/TechReveal — Produk elektronik muncul dengan dramatis.", "slots": [], "code": "/TechReveal", "group": "produk" }, { "label": "Coffee Aesthetic", "content": "/CoffeeAesthetic — Suasana kopi yang estetik.", "slots": [], "code": "/CoffeeAesthetic", "group": "produk" }, { "label": "Desk Setup", "content": "/DeskSetup — Meja kerja yang tertata rapi dan keren.", "slots": [], "code": "/DeskSetup", "group": "produk" }, { "label": "Study Vibes", "content": "/StudyVibes — Suasana belajar yang nyaman.", "slots": [], "code": "/StudyVibes", "group": "produk" }, { "label": "Creator Desk", "content": "/CreatorDesk — Meja kerja content creator.", "slots": [], "code": "/CreatorDesk", "group": "produk" }, { "label": "Gaming Setup", "content": "/GamingSetup — Ruangan gaming lengkap.", "slots": [], "code": "/GamingSetup", "group": "produk" }, { "label": "Minimal Room", "content": "/MinimalRoom — Ruangan bersih bergaya minimalis.", "slots": [], "code": "/MinimalRoom", "group": "produk" }, { "label": "Cozy Morning", "content": "/CozyMorning — Suasana pagi yang hangat dan nyaman.", "slots": [], "code": "/CozyMorning", "group": "produk" }, { "label": "Cafe Scene", "content": "/CafeScene — Adegan di dalam kafe.", "slots": [], "code": "/CafeScene", "group": "produk" }, { "label": "Home Office", "content": "/HomeOffice — Ruang kerja di rumah yang profesional.", "slots": [], "code": "/HomeOffice", "group": "produk" }, { "label": "Productivity", "content": "/Productivity — Suasana kerja atau belajar yang produktif.", "slots": [], "code": "/Productivity", "group": "produk" }, { "label": "Cyberpunk", "content": "/Cyberpunk — Suasana kota neon gelap ala cyberpunk.", "slots": [], "code": "/Cyberpunk", "group": "produk" }, { "label": "Neon City", "content": "/NeonCity — Kota masa depan penuh lampu neon.", "slots": [], "code": "/NeonCity", "group": "produk" }, { "label": "Future World", "content": "/FutureWorld — Dunia masa depan.", "slots": [], "code": "/FutureWorld", "group": "produk" }, { "label": "AI World", "content": "/AIWorld — Lingkungan futuristik bernuansa AI.", "slots": [], "code": "/AIWorld", "group": "produk" }, { "label": "Virtual Reality", "content": "/VirtualReality — Adegan di dunia virtual.", "slots": [], "code": "/VirtualReality", "group": "produk" }, { "label": "Holographic UI", "content": "/HolographicUI — Ditambahin tampilan hologram melayang.", "slots": [], "code": "/HolographicUI", "group": "produk" }, { "label": "Matrix Mode", "content": "/MatrixMode — Nuansa digital ala film Matrix.", "slots": [], "code": "/MatrixMode", "group": "produk" }, { "label": "Robot Vision", "content": "/RobotVision — Sudut pandang mata robot.", "slots": [], "code": "/RobotVision", "group": "produk" }, { "label": "Space Station", "content": "/SpaceStation — Adegan di dalam stasiun luar angkasa.", "slots": [], "code": "/SpaceStation", "group": "produk" }, { "label": "Mars Mission", "content": "/MarsMission — Adegan penjelajahan planet Mars.", "slots": [], "code": "/MarsMission", "group": "produk" }, { "label": "Dreamscape", "content": "/Dreamscape — Dunia mimpi yang aneh dan surreal.", "slots": [], "code": "/Dreamscape", "group": "produk" }, { "label": "Fairy Forest", "content": "/FairyForest — Hutan ajaib penuh keajaiban.", "slots": [], "code": "/FairyForest", "group": "produk" }, { "label": "Magic Portal", "content": "/MagicPortal — Portal yang nyambungin dua dunia.", "slots": [], "code": "/MagicPortal", "group": "produk" }, { "label": "Floating Islands", "content": "/FloatingIslands — Pulau-pulau yang ngambang di langit.", "slots": [], "code": "/FloatingIslands", "group": "produk" }, { "label": "Cloud Kingdom", "content": "/CloudKingdom — Kerajaan fantasi di atas awan.", "slots": [], "code": "/CloudKingdom", "group": "produk" }, { "label": "Crystal World", "content": "/CrystalWorld — Dunia yang semuanya terbuat dari kristal.", "slots": [], "code": "/CrystalWorld", "group": "produk" }, { "label": "Underwater Dream", "content": "/UnderwaterDream — Suasana bawah laut yang indah.", "slots": [], "code": "/UnderwaterDream", "group": "produk" }, { "label": "Galaxy Walk", "content": "/GalaxyWalk — Jalan menembus luar angkasa.", "slots": [], "code": "/GalaxyWalk", "group": "produk" }, { "label": "Aurora Sky", "content": "/AuroraSky — Ditambahin cahaya aurora warna-warni di langit.", "slots": [], "code": "/AuroraSky", "group": "produk" }, { "label": "Fantasy Castle", "content": "/FantasyCastle — Kastil ajaib ala negeri dongeng.", "slots": [], "code": "/FantasyCastle", "group": "produk" }, { "label": "Anime Style", "content": "/AnimeStyle — Diubah jadi gaya anime.", "slots": [], "code": "/AnimeStyle", "group": "produk" }, { "label": "Manga Motion", "content": "/MangaMotion — Nuansa komik manga yang bergerak.", "slots": [], "code": "/MangaMotion", "group": "produk" }, { "label": "Ghibli Mood", "content": "/GhibliMood — Gaya animasi lembut ala Studio Ghibli.", "slots": [], "code": "/GhibliMood", "group": "produk" }, { "label": "Comic Book", "content": "/ComicBook — Tampilannya jadi kayak buku komik.", "slots": [], "code": "/ComicBook", "group": "produk" }, { "label": "Pixel World", "content": "/PixelWorld — Dunia pixel ala game jadul.", "slots": [], "code": "/PixelWorld", "group": "produk" }, { "label": "Vaporwave", "content": "/Vaporwave — Gaya retro vaporwave warna pastel neon.", "slots": [], "code": "/Vaporwave", "group": "produk" }, { "label": "Retro 80s", "content": "/Retro80s — Nuansa tahun 80-an.", "slots": [], "code": "/Retro80s", "group": "produk" }, { "label": "Y2K Aesthetic", "content": "/Y2KAesthetic — Gaya awal tahun 2000-an.", "slots": [], "code": "/Y2KAesthetic", "group": "produk" }, { "label": "Film Grain", "content": "/FilmGrain — Ditambahin tekstur butiran ala film seluloid.", "slots": [], "code": "/FilmGrain", "group": "produk" }, { "label": "VHS Look", "content": "/VHSLook — Tampilannya kayak rekaman kaset VHS jadul.", "slots": [], "code": "/VHSLook", "group": "produk" }
];

// ===== D-210: 200 Cheat Codes Google Flow (Product Photo to Video) =====
//
// PDF: "200 Cheat Codes Google Flow - Product Photo to Video.pdf"
// 20 kategori x 10 kode = 200 kode prompt video produk.
// Semua mode VIDEO. Isi = "/Kode — deskripsi Indonesia dari PDF".
// group = 'flow' (kelompok baru di UI: "Cheat Codes Google Flow").

/** 200 cheat code Google Flow (mode video, group 'flow'). */
export const SEED_CODES_FLOW = [
  {
    "label": "UGC Product Hook",
    "content": "/ugcproducthook — UGC opening dengan produk langsung jadi hook.",
    "slots": [],
    "code": "/ugcproducthook",
    "group": "flow",
    "category": "UGC & Creator Style"
  },
  {
    "label": "UGC Handheld",
    "content": "/ugchandheld — Handheld smartphone natural.",
    "slots": [],
    "code": "/ugchandheld",
    "group": "flow",
    "category": "UGC & Creator Style"
  },
  {
    "label": "UGC Tabletalk",
    "content": "/ugctabletalk — Produk di meja ala creator review.",
    "slots": [],
    "code": "/ugctabletalk",
    "group": "flow",
    "category": "UGC & Creator Style"
  },
  {
    "label": "UGC First Look",
    "content": "/ugcfirstlook — First impression produk.",
    "slots": [],
    "code": "/ugcfirstlook",
    "group": "flow",
    "category": "UGC & Creator Style"
  },
  {
    "label": "UGC Close Up",
    "content": "/ugccloseup — Close-up produk ala UGC.",
    "slots": [],
    "code": "/ugccloseup",
    "group": "flow",
    "category": "UGC & Creator Style"
  },
  {
    "label": "UGC Reaction",
    "content": "/ugcreaction — Reaction setelah melihat produk.",
    "slots": [],
    "code": "/ugcreaction",
    "group": "flow",
    "category": "UGC & Creator Style"
  },
  {
    "label": "UGC Demo",
    "content": "/ugcdemo — Demonstrasi produk natural.",
    "slots": [],
    "code": "/ugcdemo",
    "group": "flow",
    "category": "UGC & Creator Style"
  },
  {
    "label": "UGC Before After",
    "content": "/ugcbeforeafter — Visual before-after.",
    "slots": [],
    "code": "/ugcbeforeafter",
    "group": "flow",
    "category": "UGC & Creator Style"
  },
  {
    "label": "UGC Aesthetic",
    "content": "/ugcaesthetic — UGC clean aesthetic.",
    "slots": [],
    "code": "/ugcaesthetic",
    "group": "flow",
    "category": "UGC & Creator Style"
  },
  {
    "label": "UGC TikTok",
    "content": "/ugctiktok — Gaya TikTok product video.",
    "slots": [],
    "code": "/ugctiktok",
    "group": "flow",
    "category": "UGC & Creator Style"
  },
  {
    "label": "Unboxing",
    "content": "/unboxing — Classic unboxing.",
    "slots": [],
    "code": "/unboxing",
    "group": "flow",
    "category": "Unboxing"
  },
  {
    "label": "Slow Unboxing",
    "content": "/slowunboxing — Buka packaging secara slow cinematic.",
    "slots": [],
    "code": "/slowunboxing",
    "group": "flow",
    "category": "Unboxing"
  },
  {
    "label": "Premium Unboxing",
    "content": "/premiumunboxing — Unboxing produk premium.",
    "slots": [],
    "code": "/premiumunboxing",
    "group": "flow",
    "category": "Unboxing"
  },
  {
    "label": "POV Unboxing",
    "content": "/povunboxing — POV tangan membuka produk.",
    "slots": [],
    "code": "/povunboxing",
    "group": "flow",
    "category": "Unboxing"
  },
  {
    "label": "ASMR Unboxing",
    "content": "/asmrunboxing — Unboxing fokus detail dan ASMR visual.",
    "slots": [],
    "code": "/asmrunboxing",
    "group": "flow",
    "category": "Unboxing"
  },
  {
    "label": "Dark Unboxing",
    "content": "/darkunboxing — Dark luxury unboxing.",
    "slots": [],
    "code": "/darkunboxing",
    "group": "flow",
    "category": "Unboxing"
  },
  {
    "label": "Sunlight Unboxing",
    "content": "/sunlightunboxing — Natural sunlight unboxing.",
    "slots": [],
    "code": "/sunlightunboxing",
    "group": "flow",
    "category": "Unboxing"
  },
  {
    "label": "Surprise Unboxing",
    "content": "/surpriseunboxing — Reveal produk sebagai kejutan.",
    "slots": [],
    "code": "/surpriseunboxing",
    "group": "flow",
    "category": "Unboxing"
  },
  {
    "label": "Minimal Unboxing",
    "content": "/minimalunboxing — Clean minimalist unboxing.",
    "slots": [],
    "code": "/minimalunboxing",
    "group": "flow",
    "category": "Unboxing"
  },
  {
    "label": "Macro Box Open",
    "content": "/macroboxopen — Macro shot packaging terbuka.",
    "slots": [],
    "code": "/macroboxopen",
    "group": "flow",
    "category": "Unboxing"
  },
  {
    "label": "Smoke Reveal",
    "content": "/smokereveal — Produk muncul dari asap.",
    "slots": [],
    "code": "/smokereveal",
    "group": "flow",
    "category": "Product Reveal"
  },
  {
    "label": "Light Reveal",
    "content": "/lightreveal — Muncul dari kilatan cahaya.",
    "slots": [],
    "code": "/lightreveal",
    "group": "flow",
    "category": "Product Reveal"
  },
  {
    "label": "Shadow Reveal",
    "content": "/shadowreveal — Reveal dari bayangan.",
    "slots": [],
    "code": "/shadowreveal",
    "group": "flow",
    "category": "Product Reveal"
  },
  {
    "label": "Curtain Reveal",
    "content": "/curtainreveal — Cinematic curtain reveal.",
    "slots": [],
    "code": "/curtainreveal",
    "group": "flow",
    "category": "Product Reveal"
  },
  {
    "label": "Flash Reveal",
    "content": "/flashreveal — Flash transition ke produk.",
    "slots": [],
    "code": "/flashreveal",
    "group": "flow",
    "category": "Product Reveal"
  },
  {
    "label": "Dark Reveal",
    "content": "/darkreveal — Muncul dari background gelap.",
    "slots": [],
    "code": "/darkreveal",
    "group": "flow",
    "category": "Product Reveal"
  },
  {
    "label": "Silhouette Reveal",
    "content": "/silhouettereveal — Silhouette lalu produk terlihat.",
    "slots": [],
    "code": "/silhouettereveal",
    "group": "flow",
    "category": "Product Reveal"
  },
  {
    "label": "Spotlight Reveal",
    "content": "/spotlightreveal — Spotlight perlahan menyala.",
    "slots": [],
    "code": "/spotlightreveal",
    "group": "flow",
    "category": "Product Reveal"
  },
  {
    "label": "Blur Reveal",
    "content": "/blurreveal — Blur to sharp product reveal.",
    "slots": [],
    "code": "/blurreveal",
    "group": "flow",
    "category": "Product Reveal"
  },
  {
    "label": "Glass Reveal",
    "content": "/glassreveal — Reveal melalui kaca atau reflection.",
    "slots": [],
    "code": "/glassreveal",
    "group": "flow",
    "category": "Product Reveal"
  },
  {
    "label": "Orbit Shot",
    "content": "/orbitshot — Kamera muter mengelilingi produk.",
    "slots": [],
    "code": "/orbitshot",
    "group": "flow",
    "category": "Camera Movement"
  },
  {
    "label": "360 Product",
    "content": "/360product — Full 360 degree product rotation.",
    "slots": [],
    "code": "/360product",
    "group": "flow",
    "category": "Camera Movement"
  },
  {
    "label": "Slow Push In",
    "content": "/slowpushin — Kamera perlahan mendekat.",
    "slots": [],
    "code": "/slowpushin",
    "group": "flow",
    "category": "Camera Movement"
  },
  {
    "label": "Pullout",
    "content": "/pullout — Kamera mundur reveal environment.",
    "slots": [],
    "code": "/pullout",
    "group": "flow",
    "category": "Camera Movement"
  },
  {
    "label": "Slide Right",
    "content": "/slideright — Cinematic slide kanan.",
    "slots": [],
    "code": "/slideright",
    "group": "flow",
    "category": "Camera Movement"
  },
  {
    "label": "Slide Left",
    "content": "/slideleft — Cinematic slide kiri.",
    "slots": [],
    "code": "/slideleft",
    "group": "flow",
    "category": "Camera Movement"
  },
  {
    "label": "Top Down",
    "content": "/topdown — Kamera dari atas.",
    "slots": [],
    "code": "/topdown",
    "group": "flow",
    "category": "Camera Movement"
  },
  {
    "label": "Low Angle",
    "content": "/lowangle — Dramatic low-angle product shot.",
    "slots": [],
    "code": "/lowangle",
    "group": "flow",
    "category": "Camera Movement"
  },
  {
    "label": "Dutch Angle",
    "content": "/dutchangle — Dynamic tilted camera.",
    "slots": [],
    "code": "/dutchangle",
    "group": "flow",
    "category": "Camera Movement"
  },
  {
    "label": "Parallax",
    "content": "/parallax — Efek depth atau parallax dari foto.",
    "slots": [],
    "code": "/parallax",
    "group": "flow",
    "category": "Camera Movement"
  },
  {
    "label": "Cinematic Product",
    "content": "/cinematicproduct — Cinematic commercial look.",
    "slots": [],
    "code": "/cinematicproduct",
    "group": "flow",
    "category": "Cinematic"
  },
  {
    "label": "Movie Product",
    "content": "/movieproduct — Produk seperti movie scene.",
    "slots": [],
    "code": "/movieproduct",
    "group": "flow",
    "category": "Cinematic"
  },
  {
    "label": "Anamorphic",
    "content": "/anamorphic — Anamorphic cinematic lens.",
    "slots": [],
    "code": "/anamorphic",
    "group": "flow",
    "category": "Cinematic"
  },
  {
    "label": "Film Look",
    "content": "/filmlook — Analog film commercial.",
    "slots": [],
    "code": "/filmlook",
    "group": "flow",
    "category": "Cinematic"
  },
  {
    "label": "35mm Product",
    "content": "/35mmproduct — 35mm photography movement.",
    "slots": [],
    "code": "/35mmproduct",
    "group": "flow",
    "category": "Cinematic"
  },
  {
    "label": "50mm Product",
    "content": "/50mmproduct — Premium 50mm lens look.",
    "slots": [],
    "code": "/50mmproduct",
    "group": "flow",
    "category": "Cinematic"
  },
  {
    "label": "85mm Product",
    "content": "/85mmproduct — Luxury shallow depth of field.",
    "slots": [],
    "code": "/85mmproduct",
    "group": "flow",
    "category": "Cinematic"
  },
  {
    "label": "Cinematic Rack Focus",
    "content": "/cinematicrackfocus — Rack focus foreground ke product.",
    "slots": [],
    "code": "/cinematicrackfocus",
    "group": "flow",
    "category": "Cinematic"
  },
  {
    "label": "Cinematic Pan",
    "content": "/cinematicpan — Slow cinematic pan.",
    "slots": [],
    "code": "/cinematicpan",
    "group": "flow",
    "category": "Cinematic"
  },
  {
    "label": "Hero Angle",
    "content": "/heroangle — Hero product shot.",
    "slots": [],
    "code": "/heroangle",
    "group": "flow",
    "category": "Cinematic"
  },
  {
    "label": "Luxury Product",
    "content": "/luxuryproduct — Luxury commercial.",
    "slots": [],
    "code": "/luxuryproduct",
    "group": "flow",
    "category": "Luxury & Premium"
  },
  {
    "label": "Quiet Luxury",
    "content": "/quietluxury — Minimal quiet luxury aesthetic.",
    "slots": [],
    "code": "/quietluxury",
    "group": "flow",
    "category": "Luxury & Premium"
  },
  {
    "label": "Black Gold",
    "content": "/blackgold — Black and gold premium scene.",
    "slots": [],
    "code": "/blackgold",
    "group": "flow",
    "category": "Luxury & Premium"
  },
  {
    "label": "Marble Reveal",
    "content": "/marblereveal — Product on luxury marble.",
    "slots": [],
    "code": "/marblereveal",
    "group": "flow",
    "category": "Luxury & Premium"
  },
  {
    "label": "Luxury Spotlight",
    "content": "/luxuryspotlight — Dramatic luxury spotlight.",
    "slots": [],
    "code": "/luxuryspotlight",
    "group": "flow",
    "category": "Luxury & Premium"
  },
  {
    "label": "Jewelry Lighting",
    "content": "/jewelrylighting — Lighting ala iklan perhiasan.",
    "slots": [],
    "code": "/jewelrylighting",
    "group": "flow",
    "category": "Luxury & Premium"
  },
  {
    "label": "Premium Studio",
    "content": "/premiumstudio — High-end studio commercial.",
    "slots": [],
    "code": "/premiumstudio",
    "group": "flow",
    "category": "Luxury & Premium"
  },
  {
    "label": "Luxury Reflection",
    "content": "/luxuryreflection — Reflective luxury floor.",
    "slots": [],
    "code": "/luxuryreflection",
    "group": "flow",
    "category": "Luxury & Premium"
  },
  {
    "label": "Velvet Reveal",
    "content": "/velvetreveal — Produk di atas kain velvet.",
    "slots": [],
    "code": "/velvetreveal",
    "group": "flow",
    "category": "Luxury & Premium"
  },
  {
    "label": "Luxury Rotate",
    "content": "/luxuryrotate — Slow elegant product rotation.",
    "slots": [],
    "code": "/luxuryrotate",
    "group": "flow",
    "category": "Luxury & Premium"
  },
  {
    "label": "Fast Cut Ads",
    "content": "/fastcutads — Fast-cut performance ad.",
    "slots": [],
    "code": "/fastcutads",
    "group": "flow",
    "category": "Fast Ads"
  },
  {
    "label": "Scroll Stopper",
    "content": "/scrollstopper — Opening yang dibuat stop scroll.",
    "slots": [],
    "code": "/scrollstopper",
    "group": "flow",
    "category": "Fast Ads"
  },
  {
    "label": "3 Second Hook",
    "content": "/3secondhook — Strong first 3 seconds.",
    "slots": [],
    "code": "/3secondhook",
    "group": "flow",
    "category": "Fast Ads"
  },
  {
    "label": "Rapid Zoom",
    "content": "/rapidzoom — Rapid zoom ke produk.",
    "slots": [],
    "code": "/rapidzoom",
    "group": "flow",
    "category": "Fast Ads"
  },
  {
    "label": "Snap Transition",
    "content": "/snaptransition — Snap transition cepat.",
    "slots": [],
    "code": "/snaptransition",
    "group": "flow",
    "category": "Fast Ads"
  },
  {
    "label": "Quick Reveal",
    "content": "/quickreveal — Reveal produk super cepat.",
    "slots": [],
    "code": "/quickreveal",
    "group": "flow",
    "category": "Fast Ads"
  },
  {
    "label": "Punch In",
    "content": "/punchin — Aggressive punch-in camera.",
    "slots": [],
    "code": "/punchin",
    "group": "flow",
    "category": "Fast Ads"
  },
  {
    "label": "Speed Ramp",
    "content": "/speedramp — Speed-ramp product motion.",
    "slots": [],
    "code": "/speedramp",
    "group": "flow",
    "category": "Fast Ads"
  },
  {
    "label": "Whip Transition",
    "content": "/whiptransition — Whip-pan transition.",
    "slots": [],
    "code": "/whiptransition",
    "group": "flow",
    "category": "Fast Ads"
  },
  {
    "label": "Viral Product",
    "content": "/viralproduct — Visual ala viral short-form ads.",
    "slots": [],
    "code": "/viralproduct",
    "group": "flow",
    "category": "Fast Ads"
  },
  {
    "label": "Skincare Commercial",
    "content": "/skincarecommercial — Skincare beauty ad.",
    "slots": [],
    "code": "/skincarecommercial",
    "group": "flow",
    "category": "Beauty & Skincare"
  },
  {
    "label": "Serum Drop",
    "content": "/serumdrop — Serum atau liquid menetes cinematic.",
    "slots": [],
    "code": "/serumdrop",
    "group": "flow",
    "category": "Beauty & Skincare"
  },
  {
    "label": "Water Beauty",
    "content": "/waterbeauty — Splash air beauty commercial.",
    "slots": [],
    "code": "/waterbeauty",
    "group": "flow",
    "category": "Beauty & Skincare"
  },
  {
    "label": "Glass Skincare",
    "content": "/glassskincare — Skincare di atas reflective glass.",
    "slots": [],
    "code": "/glassskincare",
    "group": "flow",
    "category": "Beauty & Skincare"
  },
  {
    "label": "Clean Beauty",
    "content": "/cleanbeauty — Clean white beauty aesthetic.",
    "slots": [],
    "code": "/cleanbeauty",
    "group": "flow",
    "category": "Beauty & Skincare"
  },
  {
    "label": "Soft Beauty",
    "content": "/softbeauty — Soft diffused beauty lighting.",
    "slots": [],
    "code": "/softbeauty",
    "group": "flow",
    "category": "Beauty & Skincare"
  },
  {
    "label": "Glow Product",
    "content": "/glowproduct — Glowing skincare product.",
    "slots": [],
    "code": "/glowproduct",
    "group": "flow",
    "category": "Beauty & Skincare"
  },
  {
    "label": "Bathroom Beauty",
    "content": "/bathroombeauty — Produk dalam premium bathroom.",
    "slots": [],
    "code": "/bathroombeauty",
    "group": "flow",
    "category": "Beauty & Skincare"
  },
  {
    "label": "Dewy Effect",
    "content": "/dewyeffect — Droplets dan fresh dewy feel.",
    "slots": [],
    "code": "/dewyeffect",
    "group": "flow",
    "category": "Beauty & Skincare"
  },
  {
    "label": "Ingredient Reveal",
    "content": "/ingredientreveal — Ingredients mengelilingi produk.",
    "slots": [],
    "code": "/ingredientreveal",
    "group": "flow",
    "category": "Beauty & Skincare"
  },
  {
    "label": "Food Commercial",
    "content": "/foodcommercial — Food advertising cinematic.",
    "slots": [],
    "code": "/foodcommercial",
    "group": "flow",
    "category": "Food & Beverage"
  },
  {
    "label": "Drink Splash",
    "content": "/drinksplash — Minuman dengan splash dramatis.",
    "slots": [],
    "code": "/drinksplash",
    "group": "flow",
    "category": "Food & Beverage"
  },
  {
    "label": "Ice Burst",
    "content": "/iceburst — Produk dengan pecahan es.",
    "slots": [],
    "code": "/iceburst",
    "group": "flow",
    "category": "Food & Beverage"
  },
  {
    "label": "Pour Shot",
    "content": "/pourshot — Liquid pouring cinematic.",
    "slots": [],
    "code": "/pourshot",
    "group": "flow",
    "category": "Food & Beverage"
  },
  {
    "label": "Steam Food",
    "content": "/steamfood — Makanan dengan steam natural.",
    "slots": [],
    "code": "/steamfood",
    "group": "flow",
    "category": "Food & Beverage"
  },
  {
    "label": "Crispy Close Up",
    "content": "/crispycloseup — Close-up texture makanan.",
    "slots": [],
    "code": "/crispycloseup",
    "group": "flow",
    "category": "Food & Beverage"
  },
  {
    "label": "Fresh Ingredients",
    "content": "/freshingredients — Ingredient masuk mengelilingi produk.",
    "slots": [],
    "code": "/freshingredients",
    "group": "flow",
    "category": "Food & Beverage"
  },
  {
    "label": "Slow Mo Food",
    "content": "/slowmofood — Food slow motion.",
    "slots": [],
    "code": "/slowmofood",
    "group": "flow",
    "category": "Food & Beverage"
  },
  {
    "label": "Tabletop Food",
    "content": "/tabletopfood — Commercial tabletop setup.",
    "slots": [],
    "code": "/tabletopfood",
    "group": "flow",
    "category": "Food & Beverage"
  },
  {
    "label": "Floating Food",
    "content": "/floatingfood — Bahan makanan melayang cinematic.",
    "slots": [],
    "code": "/floatingfood",
    "group": "flow",
    "category": "Food & Beverage"
  },
  {
    "label": "Tech Reveal",
    "content": "/techreveal — Futuristic gadget reveal.",
    "slots": [],
    "code": "/techreveal",
    "group": "flow",
    "category": "Tech & Gadget"
  },
  {
    "label": "Neon Tech",
    "content": "/neontech — Neon cyber product commercial.",
    "slots": [],
    "code": "/neontech",
    "group": "flow",
    "category": "Tech & Gadget"
  },
  {
    "label": "Gadget Rotate",
    "content": "/gadgetrotate — Gadget 360 rotation.",
    "slots": [],
    "code": "/gadgetrotate",
    "group": "flow",
    "category": "Tech & Gadget"
  },
  {
    "label": "Screen Reveal",
    "content": "/screenreveal — Layar device menyala.",
    "slots": [],
    "code": "/screenreveal",
    "group": "flow",
    "category": "Tech & Gadget"
  },
  {
    "label": "Dark Tech",
    "content": "/darktech — Premium dark technology commercial.",
    "slots": [],
    "code": "/darktech",
    "group": "flow",
    "category": "Tech & Gadget"
  },
  {
    "label": "Blueprint Tech",
    "content": "/blueprinttech — Blueprint elements muncul.",
    "slots": [],
    "code": "/blueprinttech",
    "group": "flow",
    "category": "Tech & Gadget"
  },
  {
    "label": "Futuristic Product",
    "content": "/futuristicproduct — Futuristic showroom scene.",
    "slots": [],
    "code": "/futuristicproduct",
    "group": "flow",
    "category": "Tech & Gadget"
  },
  {
    "label": "Tech Macro",
    "content": "/techmacro — Macro detail gadget.",
    "slots": [],
    "code": "/techmacro",
    "group": "flow",
    "category": "Tech & Gadget"
  },
  {
    "label": "Charging Animation",
    "content": "/charginganimation — Charging-energy visual.",
    "slots": [],
    "code": "/charginganimation",
    "group": "flow",
    "category": "Tech & Gadget"
  },
  {
    "label": "Cyber Orbit",
    "content": "/cyberorbit — Cyber camera orbit.",
    "slots": [],
    "code": "/cyberorbit",
    "group": "flow",
    "category": "Tech & Gadget"
  },
  {
    "label": "Fashion Product",
    "content": "/fashionproduct — Fashion editorial commercial.",
    "slots": [],
    "code": "/fashionproduct",
    "group": "flow",
    "category": "Fashion"
  },
  {
    "label": "Streetwear Reveal",
    "content": "/streetwearreveal — Streetwear dynamic reveal.",
    "slots": [],
    "code": "/streetwearreveal",
    "group": "flow",
    "category": "Fashion"
  },
  {
    "label": "Fabric Motion",
    "content": "/fabricmotion — Kain bergerak cinematic.",
    "slots": [],
    "code": "/fabricmotion",
    "group": "flow",
    "category": "Fashion"
  },
  {
    "label": "Shoe Rotation",
    "content": "/shoerotation — Sepatu rotating hero shot.",
    "slots": [],
    "code": "/shoerotation",
    "group": "flow",
    "category": "Fashion"
  },
  {
    "label": "Shoe Stomp",
    "content": "/shoestomp — Shoe impact atau stomp reveal.",
    "slots": [],
    "code": "/shoestomp",
    "group": "flow",
    "category": "Fashion"
  },
  {
    "label": "Bag Luxury",
    "content": "/bagluxury — Luxury handbag commercial.",
    "slots": [],
    "code": "/bagluxury",
    "group": "flow",
    "category": "Fashion"
  },
  {
    "label": "Fashion Studio",
    "content": "/fashionstudio — Clean fashion studio shot.",
    "slots": [],
    "code": "/fashionstudio",
    "group": "flow",
    "category": "Fashion"
  },
  {
    "label": "Runway Product",
    "content": "/runwayproduct — Product ala fashion runway.",
    "slots": [],
    "code": "/runwayproduct",
    "group": "flow",
    "category": "Fashion"
  },
  {
    "label": "Floating Fashion",
    "content": "/floatingfashion — Fashion item melayang.",
    "slots": [],
    "code": "/floatingfashion",
    "group": "flow",
    "category": "Fashion"
  },
  {
    "label": "Editorial Product",
    "content": "/editorialproduct — Magazine editorial motion.",
    "slots": [],
    "code": "/editorialproduct",
    "group": "flow",
    "category": "Fashion"
  },
  {
    "label": "Perfume Reveal",
    "content": "/perfumereveal — Luxury perfume reveal.",
    "slots": [],
    "code": "/perfumereveal",
    "group": "flow",
    "category": "Perfume"
  },
  {
    "label": "Mist Perfume",
    "content": "/mistperfume — Perfume dengan kabut tipis.",
    "slots": [],
    "code": "/mistperfume",
    "group": "flow",
    "category": "Perfume"
  },
  {
    "label": "Flower Perfume",
    "content": "/flowerperfume — Bunga bergerak mengelilingi botol.",
    "slots": [],
    "code": "/flowerperfume",
    "group": "flow",
    "category": "Perfume"
  },
  {
    "label": "Dark Perfume",
    "content": "/darkperfume — Dark seductive perfume commercial.",
    "slots": [],
    "code": "/darkperfume",
    "group": "flow",
    "category": "Perfume"
  },
  {
    "label": "Water Perfume",
    "content": "/waterperfume — Perfume dengan ripple air.",
    "slots": [],
    "code": "/waterperfume",
    "group": "flow",
    "category": "Perfume"
  },
  {
    "label": "Gold Perfume",
    "content": "/goldperfume — Gold light luxury perfume.",
    "slots": [],
    "code": "/goldperfume",
    "group": "flow",
    "category": "Perfume"
  },
  {
    "label": "Smoke Perfume",
    "content": "/smokeperfume — Smoke flowing around bottle.",
    "slots": [],
    "code": "/smokeperfume",
    "group": "flow",
    "category": "Perfume"
  },
  {
    "label": "Macro Perfume",
    "content": "/macroperfume — Close-up detail botol.",
    "slots": [],
    "code": "/macroperfume",
    "group": "flow",
    "category": "Perfume"
  },
  {
    "label": "Mirror Perfume",
    "content": "/mirrorperfume — Mirror reflection commercial.",
    "slots": [],
    "code": "/mirrorperfume",
    "group": "flow",
    "category": "Perfume"
  },
  {
    "label": "Floating Perfume",
    "content": "/floatingperfume — Perfume floating gracefully.",
    "slots": [],
    "code": "/floatingperfume",
    "group": "flow",
    "category": "Perfume"
  },
  {
    "label": "Explosion Reveal",
    "content": "/explosionreveal — Cinematic explosion behind product.",
    "slots": [],
    "code": "/explosionreveal",
    "group": "flow",
    "category": "Dynamic VFX"
  },
  {
    "label": "Particle Burst",
    "content": "/particleburst — Particle burst reveal.",
    "slots": [],
    "code": "/particleburst",
    "group": "flow",
    "category": "Dynamic VFX"
  },
  {
    "label": "Energy Wave",
    "content": "/energywave — Energy wave melewati produk.",
    "slots": [],
    "code": "/energywave",
    "group": "flow",
    "category": "Dynamic VFX"
  },
  {
    "label": "Electric Reveal",
    "content": "/electricreveal — Electric sparks reveal.",
    "slots": [],
    "code": "/electricreveal",
    "group": "flow",
    "category": "Dynamic VFX"
  },
  {
    "label": "Fire Product",
    "content": "/fireproduct — Cinematic flames around product.",
    "slots": [],
    "code": "/fireproduct",
    "group": "flow",
    "category": "Dynamic VFX"
  },
  {
    "label": "Water Burst",
    "content": "/waterburst — Water burst around product.",
    "slots": [],
    "code": "/waterburst",
    "group": "flow",
    "category": "Dynamic VFX"
  },
  {
    "label": "Dust Reveal",
    "content": "/dustreveal — Dramatic dust reveal.",
    "slots": [],
    "code": "/dustreveal",
    "group": "flow",
    "category": "Dynamic VFX"
  },
  {
    "label": "Sand Blast",
    "content": "/sandblast — Sand motion reveal.",
    "slots": [],
    "code": "/sandblast",
    "group": "flow",
    "category": "Dynamic VFX"
  },
  {
    "label": "Crystal Burst",
    "content": "/crystalburst — Crystal fragments cinematic.",
    "slots": [],
    "code": "/crystalburst",
    "group": "flow",
    "category": "Dynamic VFX"
  },
  {
    "label": "Lightning Product",
    "content": "/lightningproduct — Lightning energy effect.",
    "slots": [],
    "code": "/lightningproduct",
    "group": "flow",
    "category": "Dynamic VFX"
  },
  {
    "label": "Floating Product",
    "content": "/floatingproduct — Produk melayang.",
    "slots": [],
    "code": "/floatingproduct",
    "group": "flow",
    "category": "Floating & Levitation"
  },
  {
    "label": "Levitation",
    "content": "/levitation — Premium levitation shot.",
    "slots": [],
    "code": "/levitation",
    "group": "flow",
    "category": "Floating & Levitation"
  },
  {
    "label": "Zerogravity",
    "content": "/zerogravity — Zero-gravity commercial.",
    "slots": [],
    "code": "/zerogravity",
    "group": "flow",
    "category": "Floating & Levitation"
  },
  {
    "label": "Floating Ingredients",
    "content": "/floatingingredients — Ingredients melayang.",
    "slots": [],
    "code": "/floatingingredients",
    "group": "flow",
    "category": "Floating & Levitation"
  },
  {
    "label": "Floating Parts",
    "content": "/floatingparts — Bagian produk terpisah melayang.",
    "slots": [],
    "code": "/floatingparts",
    "group": "flow",
    "category": "Floating & Levitation"
  },
  {
    "label": "Magnetic Product",
    "content": "/magneticproduct — Magnetic floating effect.",
    "slots": [],
    "code": "/magneticproduct",
    "group": "flow",
    "category": "Floating & Levitation"
  },
  {
    "label": "Weightless Product",
    "content": "/weightlessproduct — Smooth weightless motion.",
    "slots": [],
    "code": "/weightlessproduct",
    "group": "flow",
    "category": "Floating & Levitation"
  },
  {
    "label": "Hover Rotate",
    "content": "/hoverrotate — Hover sekaligus rotating.",
    "slots": [],
    "code": "/hoverrotate",
    "group": "flow",
    "category": "Floating & Levitation"
  },
  {
    "label": "Floating Platform",
    "content": "/floatingplatform — Platform melayang.",
    "slots": [],
    "code": "/floatingplatform",
    "group": "flow",
    "category": "Floating & Levitation"
  },
  {
    "label": "Airborne Product",
    "content": "/airborneproduct — Produk terbang masuk frame.",
    "slots": [],
    "code": "/airborneproduct",
    "group": "flow",
    "category": "Floating & Levitation"
  },
  {
    "label": "Product Transform",
    "content": "/producttransform — Product transformation animation.",
    "slots": [],
    "code": "/producttransform",
    "group": "flow",
    "category": "Transformation"
  },
  {
    "label": "Packaging To Product",
    "content": "/packagingtoproduct — Packaging berubah jadi produk.",
    "slots": [],
    "code": "/packagingtoproduct",
    "group": "flow",
    "category": "Transformation"
  },
  {
    "label": "Ingredient To Product",
    "content": "/ingredienttoproduct — Ingredient menyatu jadi produk.",
    "slots": [],
    "code": "/ingredienttoproduct",
    "group": "flow",
    "category": "Transformation"
  },
  {
    "label": "Liquid Transform",
    "content": "/liquidtransform — Liquid berubah jadi product.",
    "slots": [],
    "code": "/liquidtransform",
    "group": "flow",
    "category": "Transformation"
  },
  {
    "label": "Smoke Transform",
    "content": "/smoketransform — Smoke berubah jadi product.",
    "slots": [],
    "code": "/smoketransform",
    "group": "flow",
    "category": "Transformation"
  },
  {
    "label": "Particle Transform",
    "content": "/particletransform — Particles membentuk product.",
    "slots": [],
    "code": "/particletransform",
    "group": "flow",
    "category": "Transformation"
  },
  {
    "label": "Sketch To 3D",
    "content": "/sketchto3d — Sketch berubah jadi product realistis.",
    "slots": [],
    "code": "/sketchto3d",
    "group": "flow",
    "category": "Transformation"
  },
  {
    "label": "Wireframe To Product",
    "content": "/wireframetoproduct — Wireframe ke final product.",
    "slots": [],
    "code": "/wireframetoproduct",
    "group": "flow",
    "category": "Transformation"
  },
  {
    "label": "Color Transform",
    "content": "/colortransform — Dramatic color transformation.",
    "slots": [],
    "code": "/colortransform",
    "group": "flow",
    "category": "Transformation"
  },
  {
    "label": "Materialize",
    "content": "/materialize — Produk materialize dari udara.",
    "slots": [],
    "code": "/materialize",
    "group": "flow",
    "category": "Transformation"
  },
  {
    "label": "Lifestyle Product",
    "content": "/lifestyleproduct — Produk di real-life environment.",
    "slots": [],
    "code": "/lifestyleproduct",
    "group": "flow",
    "category": "Lifestyle"
  },
  {
    "label": "Morning Routine",
    "content": "/morningroutine — Morning routine product placement.",
    "slots": [],
    "code": "/morningroutine",
    "group": "flow",
    "category": "Lifestyle"
  },
  {
    "label": "Desk Setup",
    "content": "/desksetup — Modern desk setup.",
    "slots": [],
    "code": "/desksetup",
    "group": "flow",
    "category": "Lifestyle"
  },
  {
    "label": "Coffee Table",
    "content": "/coffeetable — Cozy coffee-table aesthetic.",
    "slots": [],
    "code": "/coffeetable",
    "group": "flow",
    "category": "Lifestyle"
  },
  {
    "label": "Bedroom Product",
    "content": "/bedroomproduct — Aesthetic bedroom product shot.",
    "slots": [],
    "code": "/bedroomproduct",
    "group": "flow",
    "category": "Lifestyle"
  },
  {
    "label": "Travel Product",
    "content": "/travelproduct — Produk dalam travel setting.",
    "slots": [],
    "code": "/travelproduct",
    "group": "flow",
    "category": "Lifestyle"
  },
  {
    "label": "Outdoor Product",
    "content": "/outdoorproduct — Cinematic outdoor placement.",
    "slots": [],
    "code": "/outdoorproduct",
    "group": "flow",
    "category": "Lifestyle"
  },
  {
    "label": "Gym Product",
    "content": "/gymproduct — Energetic gym environment.",
    "slots": [],
    "code": "/gymproduct",
    "group": "flow",
    "category": "Lifestyle"
  },
  {
    "label": "Workspace Product",
    "content": "/workspaceproduct — Professional workspace scene.",
    "slots": [],
    "code": "/workspaceproduct",
    "group": "flow",
    "category": "Lifestyle"
  },
  {
    "label": "Daily Use",
    "content": "/dailyuse — Everyday-use product video.",
    "slots": [],
    "code": "/dailyuse",
    "group": "flow",
    "category": "Lifestyle"
  },
  {
    "label": "Minimal Product",
    "content": "/minimalproduct — Simple clean product commercial.",
    "slots": [],
    "code": "/minimalproduct",
    "group": "flow",
    "category": "Minimalist"
  },
  {
    "label": "White Background",
    "content": "/whitebackground — Pure white studio motion.",
    "slots": [],
    "code": "/whitebackground",
    "group": "flow",
    "category": "Minimalist"
  },
  {
    "label": "Beige Minimal",
    "content": "/beigeminimal — Warm beige aesthetic.",
    "slots": [],
    "code": "/beigeminimal",
    "group": "flow",
    "category": "Minimalist"
  },
  {
    "label": "Monochrome",
    "content": "/monochrome — Monochrome premium scene.",
    "slots": [],
    "code": "/monochrome",
    "group": "flow",
    "category": "Minimalist"
  },
  {
    "label": "Soft Shadow",
    "content": "/softshadow — Soft moving shadow.",
    "slots": [],
    "code": "/softshadow",
    "group": "flow",
    "category": "Minimalist"
  },
  {
    "label": "Clean Rotate",
    "content": "/cleanrotate — Clean studio rotation.",
    "slots": [],
    "code": "/cleanrotate",
    "group": "flow",
    "category": "Minimalist"
  },
  {
    "label": "Minimal Orbit",
    "content": "/minimalorbit — Subtle orbit camera.",
    "slots": [],
    "code": "/minimalorbit",
    "group": "flow",
    "category": "Minimalist"
  },
  {
    "label": "Architectural Shadow",
    "content": "/architecturalshadow — Moving architectural light atau shadow.",
    "slots": [],
    "code": "/architecturalshadow",
    "group": "flow",
    "category": "Minimalist"
  },
  {
    "label": "Soft Gradient",
    "content": "/softgradient — Premium gradient background.",
    "slots": [],
    "code": "/softgradient",
    "group": "flow",
    "category": "Minimalist"
  },
  {
    "label": "Museum Display",
    "content": "/museumdisplay — Product seperti museum object.",
    "slots": [],
    "code": "/museumdisplay",
    "group": "flow",
    "category": "Minimalist"
  },
  {
    "label": "Macro Product",
    "content": "/macroproduct — Extreme macro product details.",
    "slots": [],
    "code": "/macroproduct",
    "group": "flow",
    "category": "Macro & Detail"
  },
  {
    "label": "Texture Close Up",
    "content": "/texturecloseup — Fokus texture produk.",
    "slots": [],
    "code": "/texturecloseup",
    "group": "flow",
    "category": "Macro & Detail"
  },
  {
    "label": "Logo Zoom",
    "content": "/logozoom — Camera push ke logo.",
    "slots": [],
    "code": "/logozoom",
    "group": "flow",
    "category": "Macro & Detail"
  },
  {
    "label": "Material Detail",
    "content": "/materialdetail — Showcase material quality.",
    "slots": [],
    "code": "/materialdetail",
    "group": "flow",
    "category": "Macro & Detail"
  },
  {
    "label": "Edge Highlight",
    "content": "/edgehighlight — Lighting mengikuti edge produk.",
    "slots": [],
    "code": "/edgehighlight",
    "group": "flow",
    "category": "Macro & Detail"
  },
  {
    "label": "Macro Tracking",
    "content": "/macrotracking — Tracking across details.",
    "slots": [],
    "code": "/macrotracking",
    "group": "flow",
    "category": "Macro & Detail"
  },
  {
    "label": "Button Macro",
    "content": "/buttonmacro — Macro tombol atau detail kecil.",
    "slots": [],
    "code": "/buttonmacro",
    "group": "flow",
    "category": "Macro & Detail"
  },
  {
    "label": "Surface Glide",
    "content": "/surfaceglide — Camera glide di permukaan.",
    "slots": [],
    "code": "/surfaceglide",
    "group": "flow",
    "category": "Macro & Detail"
  },
  {
    "label": "Micro Reflection",
    "content": "/microreflection — Micro reflection cinematic.",
    "slots": [],
    "code": "/microreflection",
    "group": "flow",
    "category": "Macro & Detail"
  },
  {
    "label": "Detail Sequence",
    "content": "/detailsequence — Sequence beberapa detail produk.",
    "slots": [],
    "code": "/detailsequence",
    "group": "flow",
    "category": "Macro & Detail"
  },
  {
    "label": "Product Benefit",
    "content": "/productbenefit — Visual menonjolkan benefit utama.",
    "slots": [],
    "code": "/productbenefit",
    "group": "flow",
    "category": "E-Commerce Ads"
  },
  {
    "label": "Problem Solution",
    "content": "/problemsolution — Problem ke product solution.",
    "slots": [],
    "code": "/problemsolution",
    "group": "flow",
    "category": "E-Commerce Ads"
  },
  {
    "label": "Feature Highlight",
    "content": "/featurehighlight — Highlight fitur produk.",
    "slots": [],
    "code": "/featurehighlight",
    "group": "flow",
    "category": "E-Commerce Ads"
  },
  {
    "label": "Bestseller",
    "content": "/bestseller — Bestseller hero video.",
    "slots": [],
    "code": "/bestseller",
    "group": "flow",
    "category": "E-Commerce Ads"
  },
  {
    "label": "New Arrival",
    "content": "/newarrival — New arrival reveal.",
    "slots": [],
    "code": "/newarrival",
    "group": "flow",
    "category": "E-Commerce Ads"
  },
  {
    "label": "Limited Stock",
    "content": "/limitedstock — Urgency visual.",
    "slots": [],
    "code": "/limitedstock",
    "group": "flow",
    "category": "E-Commerce Ads"
  },
  {
    "label": "Sale Product",
    "content": "/saleproduct — Energetic sale creative.",
    "slots": [],
    "code": "/saleproduct",
    "group": "flow",
    "category": "E-Commerce Ads"
  },
  {
    "label": "Testimonial Visual",
    "content": "/testimonialvisual — Testimonial-style product motion.",
    "slots": [],
    "code": "/testimonialvisual",
    "group": "flow",
    "category": "E-Commerce Ads"
  },
  {
    "label": "Comparison Video",
    "content": "/comparisonvideo — Product vs alternative.",
    "slots": [],
    "code": "/comparisonvideo",
    "group": "flow",
    "category": "E-Commerce Ads"
  },
  {
    "label": "Why Buy This",
    "content": "/whybuythis — Visual alasan membeli produk.",
    "slots": [],
    "code": "/whybuythis",
    "group": "flow",
    "category": "E-Commerce Ads"
  },
  {
    "label": "Tiny World",
    "content": "/tinyworld — Produk jadi dunia miniatur.",
    "slots": [],
    "code": "/tinyworld",
    "group": "flow",
    "category": "Experimental / Viral"
  },
  {
    "label": "Giant Product",
    "content": "/giantproduct — Produk raksasa di dunia nyata.",
    "slots": [],
    "code": "/giantproduct",
    "group": "flow",
    "category": "Experimental / Viral"
  },
  {
    "label": "Product Portal",
    "content": "/productportal — Produk keluar dari portal.",
    "slots": [],
    "code": "/productportal",
    "group": "flow",
    "category": "Experimental / Viral"
  },
  {
    "label": "Product Clone",
    "content": "/productclone — Satu produk menjadi banyak.",
    "slots": [],
    "code": "/productclone",
    "group": "flow",
    "category": "Experimental / Viral"
  },
  {
    "label": "Infinite Zoom",
    "content": "/infinitezoom — Infinite zoom menuju produk.",
    "slots": [],
    "code": "/infinitezoom",
    "group": "flow",
    "category": "Experimental / Viral"
  },
  {
    "label": "Product Drop",
    "content": "/productdrop — Produk jatuh dramatic lalu berhenti.",
    "slots": [],
    "code": "/productdrop",
    "group": "flow",
    "category": "Experimental / Viral"
  },
  {
    "label": "Freeze Time",
    "content": "/freezetime — Lingkungan freeze, produk bergerak.",
    "slots": [],
    "code": "/freezetime",
    "group": "flow",
    "category": "Experimental / Viral"
  },
  {
    "label": "World Transition",
    "content": "/worldtransition — Dunia berubah mengikuti produk.",
    "slots": [],
    "code": "/worldtransition",
    "group": "flow",
    "category": "Experimental / Viral"
  },
  {
    "label": "Impossible Camera",
    "content": "/impossiblecamera — Impossible cinematic camera movement.",
    "slots": [],
    "code": "/impossiblecamera",
    "group": "flow",
    "category": "Experimental / Viral"
  },
  {
    "label": "Viral Reveal",
    "content": "/viralreveal — High-impact viral final reveal.",
    "slots": [],
    "code": "/viralreveal",
    "group": "flow",
    "category": "Experimental / Viral"
  }
];
