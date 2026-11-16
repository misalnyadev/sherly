(() => {
  const style = `
  #ssChatRoot{display:none}
  .ss-chat{position:relative;width:100%;height:100%;flex:1;min-height:0;align-self:stretch;background:linear-gradient(180deg,#070b14 120px,rgba(216,45,145,.13) 240px,rgba(216,45,145,0) 460px),radial-gradient(700px 380px at 88% 110%,rgba(116,67,108,.14),transparent 60%),#070b14;display:none;grid-template-rows:auto minmax(0,1fr) auto;color:#f4f5fb;font:14px/1.55 Inter,ui-sans-serif,system-ui,sans-serif;border:0;border-radius:18px;overflow:hidden}
  main.ss-chat-active>.layout,main.ss-chat-active>.page-view{display:none!important}main.ss-chat-active>#ssChatRoot{display:flex!important;flex:1;min-height:0;align-items:stretch;position:relative}main.ss-chat-active{height:100vh;height:100dvh;overflow:hidden;display:flex;flex-direction:column;padding-bottom:0!important}
  .ss-chat.open{display:grid}
  .ss-chat-main{min-width:0;min-height:0;height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden}
  .ss-chat button{cursor:pointer;font:inherit}
  /* header */
  .ss-chat-toolbar{display:flex;align-items:center;gap:13px;padding:13px 20px;background:none;border-bottom:1px solid rgba(255,255,255,.045);position:relative;z-index:2}
  .ss-chat-id{display:flex;align-items:center;gap:9px;min-width:0;border:1px solid #49334e;background:#111a2e;border-radius:999px;padding:3px 13px 3px 3px;box-shadow:0 0 0 3px #f044a814;transition:border-color .18s,box-shadow .18s}
  .ss-chat-id:hover{border-color:rgba(240,68,168,.6);box-shadow:0 0 0 3px #f044a81f}
  .ss-status-text{min-width:0;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ss-ava-wrap{position:relative;flex:none;display:flex;padding:0;border:0;background:none;appearance:none;-webkit-appearance:none}
  .ss-ava{display:block;width:38px;height:38px;border-radius:50%;object-fit:cover;object-position:center 16%;border:1px solid rgba(255,255,255,.16);background:#111a2e}
  .ss-chat-name{font-size:13.5px;font-weight:500;color:#ffffff;letter-spacing:0;display:flex;align-items:center;gap:6px;line-height:1.15}
  .ss-verified{color:#ff72c5;display:inline-flex}.ss-verified svg{width:13px;height:13px}
  .ss-chat-status{font-size:10.5px;line-height:1.35;color:#91a2b9;display:flex;align-items:center;gap:5px;margin-top:1px;letter-spacing:.01em}
  .ss-status-dot{width:6px;height:6px;border-radius:50%;background:#ff72c5;display:inline-block}
  .ss-bubble-meta small.ss-tier-tag{font-weight:800;letter-spacing:.14em;color:#ff9bdc}
  /* D-115: layar kecil (±5.8", chat ~316px) — badge & tombol + tidak boleh terpotong:
     toolbar lebih rapat, badge kompak, teks status menyusut, rantai min-width:0 tuntas. */
  @media(max-width:700px){
    .ss-chat-toolbar{gap:7px;padding:10px}
    .ss-status-text{max-width:104px}
    .ss-chat-status{min-width:0}
  }
  .ss-spacer{flex:1}
  .ss-chat-info{background:none;border:0;padding:0;margin:0;text-align:left;color:inherit;font:inherit;cursor:pointer;min-width:0;flex:1;display:block}
  .ss-chat-info:hover .ss-chat-name{color:#ffd0ec}
  .ss-voice-sep{height:1px;background:rgba(255,255,255,.08);margin:16px 0 2px}
  .ss-profile-box{border:1px solid #49334e;background:#111a2e;border-radius:14px;padding:13px 14px;box-shadow:0 0 0 3px #f044a814}
  .ss-profile-box .ss-voice-label{margin-top:0}
  .ss-profile-box .ss-voice-note{margin-bottom:0}
  /* messages — scrollable, no visible scrollbar */
  .ss-chat-messages{min-height:0;min-width:0;overscroll-behavior:contain;overflow-y:auto;overflow-x:hidden;padding:26px max(22px,calc((100% - 940px)/2));display:flex;flex-direction:column;gap:14px;scrollbar-width:none;-ms-overflow-style:none}
  .ss-chat-messages::-webkit-scrollbar{display:none}
  .ss-row{display:flex;gap:9px;align-items:flex-end;max-width:82%}
  .ss-row.assistant{align-self:flex-start}
  .ss-row.user{align-self:flex-end;flex-direction:row-reverse}
  .ss-row-ava{width:30px;height:30px;flex:none;border-radius:50%;object-fit:cover;object-position:center 16%;border:1px solid rgba(255,255,255,.13);background:#111a2e;margin-bottom:2px}
  .ss-bubble{padding:12px 15px;border-radius:18px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7;font-weight:400}
  .ss-row.assistant .ss-bubble{background:#101b2c;border:1px solid #1c2b40;border-bottom-left-radius:6px;color:#f4f5fb;box-shadow:0 4px 18px rgba(0,0,0,.25)}
  .ss-row.user .ss-bubble{background:linear-gradient(135deg,#d82d91 0%,#b02d80 55%,#74436c 100%);border:1px solid rgba(255,255,255,.14);border-bottom-right-radius:6px;color:#fff;box-shadow:0 6px 22px rgba(216,45,145,.28)}
  .ss-bubble small{display:block;color:rgba(255,255,255,.45);font-size:10px;margin-top:7px;letter-spacing:.03em}
  .ss-row.user .ss-bubble small{color:rgba(255,255,255,.55)}
  /* empty state */
  .ss-chat-empty{margin:auto;text-align:center;max-width:520px;color:#91a2b9;padding:24px 12px}
  .ss-empty-ava{width:86px;height:86px;border-radius:50%;object-fit:cover;object-position:center 14%;border:1px solid rgba(255,114,197,.4);padding:4px;background:radial-gradient(circle at 50% 30%,rgba(216,45,145,.35),rgba(4,7,15,.9));box-shadow:0 0 44px rgba(216,45,145,.35)}
  .ss-chat-empty h2{color:#fff;font-size:24px;font-weight:500;margin:16px 0 8px;letter-spacing:.01em}
  .ss-chat-empty p{line-height:1.75;font-size:13px;margin:0 auto}
  .ss-suggest{display:flex;flex-wrap:wrap;gap:9px;justify-content:center;margin-top:18px}
  .ss-suggest button{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.03);color:#ffd0ec;border-radius:999px;padding:9px 15px;font-size:12px;transition:.18s;letter-spacing:.01em}
  .ss-suggest button:hover{border-color:rgba(255,114,197,.55);background:rgba(216,45,145,.14);box-shadow:0 0 18px rgba(216,45,145,.22);transform:translateY(-1px)}
  /* composer — flush to bottom, left & right edges borderless */
  .ss-compose-wrap{position:relative;z-index:2;flex-shrink:0;background:linear-gradient(180deg,rgba(4,7,15,0),#070b14 38%);padding:12px 18px max(20px,calc(env(safe-area-inset-bottom) + 6px))}
  .ss-compose{display:flex;gap:11px;align-items:flex-end;background:#0c1422;border:1px solid #1c2b40;border-radius:22px;padding:9px 10px 9px 17px;transition:.18s}
  .ss-compose:focus-within{border-color:rgba(240,68,168,.6);box-shadow:0 0 0 3px rgba(240,68,168,.14),0 10px 34px rgba(0,0,0,.35)}
  .ss-compose textarea{flex:1;resize:none;min-height:44px;height:44px;max-height:150px;overflow-y:auto;background:transparent;border:0;outline:0;color:#fff;padding:11px 2px;font:inherit;line-height:1.5;scrollbar-width:none}
  .ss-compose textarea::-webkit-scrollbar{display:none}
  .ss-compose textarea::placeholder{color:#5d6f88}
  .ss-send{flex:none;width:46px;height:46px;border-radius:50%;border:0;background:linear-gradient(135deg,#f044a8,#b02d80);color:#fff;display:grid;place-items:center;box-shadow:0 6px 20px rgba(216,45,145,.4);transition:.18s}
  .ss-send:hover{transform:translateY(-1px) scale(1.05);box-shadow:0 8px 26px rgba(216,45,145,.55)}
  .ss-send:disabled{opacity:.45;cursor:wait;transform:none}
  .ss-chat-hint{text-align:center;color:#5d6f88;font-size:10px;margin-top:8px;letter-spacing:.04em}
  .ss-jump{position:absolute;right:12px;bottom:calc(100% + 10px);width:42px;height:42px;border-radius:50%;border:1px solid #24344e;background:#101b2ccc;color:#cfd6e4;display:grid;place-items:center;cursor:pointer;box-shadow:0 10px 30px #0009,0 0 0 3px #f044a814;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);opacity:0;visibility:hidden;transform:translateY(8px) scale(.9);transition:opacity .22s,transform .22s,visibility .22s,border-color .18s,color .18s;z-index:3}
  .ss-jump.show{opacity:1;visibility:visible;transform:none}
  .ss-jump:hover{border-color:#f044a8;color:#ffd0ec}
  .ss-chat-img{max-width:230px;max-height:180px;border-radius:12px;display:block;margin-bottom:7px;border:1px solid rgba(255,255,255,.18);object-fit:cover}
  .ss-bubble-text{display:block}
  .ss-filechip{display:inline-flex;align-items:center;gap:7px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:9px;padding:5px 9px;font-size:11px;margin-bottom:7px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ss-bubble-meta{display:flex;align-items:center;gap:10px;margin-top:7px}
  .ss-tts-btn{background:none;border:0;color:#91a2b9;cursor:pointer;padding:3px 4px;border-radius:8px;display:inline-flex;align-items:center;gap:6px;font-size:10px;letter-spacing:.04em;transition:.15s}
  .ss-tts-btn:hover{color:#ffd0ec}
  .ss-tts-btn.playing{color:#ff72c5}
  .ss-tts-btn:disabled{opacity:.6;cursor:wait}
  .ss-attach{flex:none;width:42px;height:46px;border:0;background:transparent;color:#a9b8cd;display:grid;place-items:center;border-radius:14px;transition:.15s}
  .ss-attach:hover{color:#ffd0ec;background:rgba(255,255,255,.05)}
  .ss-attach-chip{display:flex;align-items:center;gap:9px;width:max-content;max-width:100%;background:#111a2e;border:1px solid #24344e;border-radius:13px;padding:6px 9px;margin:0 6px 8px}
  .ss-attach-chip[hidden]{display:none!important}
  .ss-attach-chip img{width:44px;height:44px;object-fit:cover;border-radius:9px;border:1px solid rgba(255,255,255,.14)}
  .ss-attach-chip span{font-size:11px;color:#cfd6e4;max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ss-attach-chip button{background:none;border:0;color:#91a2b9;font-size:15px;cursor:pointer;padding:4px 7px;border-radius:8px;line-height:1}
  .ss-attach-chip button:hover{color:#ffd0ec;background:rgba(255,255,255,.05)}
  .ss-compose-wrap{padding:10px 18px max(18px,calc(env(safe-area-inset-bottom) + 8px))}
  .ss-chat-hint{margin-top:6px;font-size:9.5px;color:#5d6f88}
  @media (pointer:coarse),(hover:none){.ss-chat-hint{display:none}}
  @media(max-width:700px){.ss-chat{min-height:480px;border-radius:12px}.ss-chat-toolbar{padding:10px 12px;gap:9px}.ss-chat-messages{padding:18px 12px}.ss-compose-wrap{padding:10px}.ss-row{max-width:94%}.ss-ava{width:36px;height:36px}.ss-suggest{flex-direction:column;align-items:stretch}}
    .ss-auth{position:fixed;inset:0;z-index:100;background:#04070fdc;display:none;place-items:center;padding:20px;font:14px/1.45 Inter,ui-sans-serif,system-ui,sans-serif}.ss-auth.open{display:grid}.ss-auth-card{width:min(420px,100%);background:#101b2c;border:1px solid #24344e;border-radius:18px;padding:26px;box-shadow:0 25px 80px #000b;color:#f4f5fb}.ss-auth-card h2{margin:0 0 7px}.ss-auth-card p{color:#91a2b9;line-height:1.6}.ss-auth-card label{display:block;color:#cfd6e4;font-size:12px;margin:14px 0 6px}.ss-auth-card input{width:100%;padding:12px;border-radius:9px;border:1px solid #24344e;background:#0f1828;color:white;outline:0;box-sizing:border-box}.ss-auth-card input:focus{border-color:#f044a8}.ss-auth-actions{display:flex;gap:9px;margin-top:18px}.ss-auth-actions button{flex:1;border-radius:999px;padding:12px 18px;font-weight:600;cursor:pointer;font-family:inherit;border:1px solid #24344e;background:#0f1828;color:#cfd6e4;transition:border-color .18s,color .18s}.ss-auth-actions button:hover{border-color:#74436c;color:#fff}.ss-auth-primary{background:linear-gradient(100deg,#d82d91,#b02d80)!important;border:0!important;color:#fff!important;font-weight:600;box-shadow:0 7px 20px #f044a833}.ss-auth-error{color:#ff9bdc;font-size:12px;min-height:18px;margin-top:10px}.ss-auth-modes{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:2px 0 6px}.ss-auth-modes button{padding:10px 4px;border-radius:999px;border:1px solid #24344e;background:#0f1828;color:#cfd6e4;font-size:12px;font-weight:500;cursor:pointer;font-family:inherit;transition:border-color .18s,color .18s}.ss-auth-modes button.active{border-color:#f044a8;color:#fff;background:#24142a}.ss-auth-card select{width:100%;padding:12px;border-radius:9px;border:1px solid #24344e;background:#0f1828;color:#fff;outline:0;box-sizing:border-box}.ss-auth-card select:focus{border-color:#f044a8}.ss-auth-sub{color:#91a2b9;font-size:11.5px;line-height:1.6;margin:10px 0 0}
  @media(max-width:700px){.ss-chat{min-height:480px;grid-template-columns:minmax(0,1fr)}.ss-chat-toolbar{padding:12px}.ss-chat-id{padding:3px 11px 3px 3px;gap:8px}.ss-status-text{max-width:170px}.ss-chat-messages{padding:18px 13px}.ss-compose-wrap{padding:10px}.ss-bubble{max-width:94%}}
  .ss-ava-wrap{cursor:pointer;border-radius:50%;background:none;border:0;padding:0}.ss-ava-wrap:focus-visible{outline:2px solid #f044a8;outline-offset:2px}
  .ss-newchat{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;border:1px solid #24344e;background:#111a2e;color:#cfd6e4;cursor:pointer;flex:0 0 auto}.ss-newchat:hover{border-color:#f044a8;color:#fff}.ss-newchat svg{width:16px;height:16px}
  .ss-voice{position:fixed;inset:0;z-index:110;background:#04070fd9;display:none;place-items:center;padding:18px;font:14px/1.5 Inter,ui-sans-serif,system-ui,sans-serif}.ss-voice.open{display:grid}.ss-voice-card{width:min(520px,100%);max-height:88vh;overflow:auto;background:#101b2c;border:1px solid #24344e;border-radius:18px;padding:22px;color:#f4f5fb;box-shadow:0 25px 80px #000b}.ss-voice-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px}.ss-voice-head h2{margin:0;font-size:18px}.ss-voice-head p{margin:4px 0 0;color:#91a2b9;font-size:13px}.ss-voice-close{background:none;border:0;color:#91a2b9;font-size:18px;cursor:pointer;padding:4px}.ss-voice-close:hover{color:#fff}
  .ss-voice-grid{display:flex;flex-wrap:wrap;gap:8px}.ss-voice-chip{padding:8px 14px;border-radius:999px;border:1.5px solid #f044a833;background:#24142a;color:#ffd0ec;cursor:pointer;font-size:13px}.ss-voice-chip:hover{border-color:#f044a8}.ss-voice-chip.active{background:#b02d80;border-color:#f044a8;color:#fff}
  .ss-voice-label{display:block;color:#cfd6e4;font-size:12px;margin:14px 0 6px}.ss-voice-style{width:100%;padding:11px 12px;border-radius:10px;border:1px solid #24344e;background:#0f1828;color:#fff;outline:0;box-sizing:border-box;font:inherit;resize:vertical}.ss-voice-style:focus{border-color:#f044a8}.ss-voice-note{color:#91a2b9;font-size:11px;margin:6px 2px 0;line-height:1.5}
  .ss-voice-actions{display:flex;gap:9px;margin-top:14px}.ss-voice-actions button{flex:1;padding:11px;border-radius:10px;border:1px solid #24344e;background:#111a2e;color:#cfd6e4;cursor:pointer;font:inherit;font-weight:500}.ss-voice-test:hover{border-color:#f044a8;color:#ffd0ec}.ss-voice-save{background:#d82d91!important;border-color:#f044a8!important;color:#fff!important}.ss-voice-save:hover{background:#b02d80!important}
  .ss-voice-saved{min-height:18px;margin:8px 2px 0;font-size:12px;color:#ff9bdc}
  .ss-voice-modes{display:flex;gap:8px;margin:2px 0 12px}.ss-voice-mode{flex:1;padding:9px 10px;border-radius:10px;border:1.5px solid #24344e;background:#111a2e;color:#cfd6e4;cursor:pointer;font-size:12.5px}.ss-voice-mode.active{border-color:#f044a8;background:#24142a;color:#ffd0ec}
  .ss-device-block select{width:100%;padding:10px 12px;border-radius:10px;border:1px solid #24344e;background:#0f1828;color:#fff;outline:0;font:inherit}.ss-device-block label{display:block;color:#cfd6e4;font-size:12px;margin:12px 0 6px}
  .ss-rate-row{display:flex;align-items:center;gap:10px}.ss-rate-row input[type=range]{flex:1;accent-color:#f044a8}.ss-rate-row output{min-width:44px;text-align:right;color:#ffd0ec;font-size:13px}
  .ss-chat-close{display:none;background:none;border:0;color:#cfd6e4;cursor:pointer;padding:6px;border-radius:10px;flex:0 0 auto}
  .ss-chat-close:hover{color:#fff}
  @media(max-width:850px){
  .ss-chat-close{display:grid;place-items:center}
  .ss-chat.open{position:fixed;inset:0;z-index:96;height:100vh!important;height:100dvh!important;min-height:0;border-radius:0;box-shadow:none;padding-top:env(safe-area-inset-top)}
  main.ss-chat-active #ssChatRoot{height:0!important;overflow:visible}
  }
  `;
  const styleEl = document.createElement('style'); styleEl.textContent = style; document.head.appendChild(styleEl);
  const root = document.createElement('div'); root.innerHTML = `
  <section class="ss-chat" id="ssSherlyChat" aria-label="Chat Sherly">
    <section class="ss-chat-main">
      <header class="ss-chat-toolbar">
        <button type="button" class="ss-chat-close" id="ssChatClose" aria-label="Tutup chat"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>
        <div class="ss-chat-id">
          <button type="button" class="ss-ava-wrap" id="ssAvaBtn" title="Buka profil Sherly" aria-label="Buka profil Sherly"><img class="ss-ava" src="assets/sherly-portrait.png" alt="Sherly"></button>
          <button type="button" class="ss-chat-info" id="ssChatInfoBtn" title="Buka profil Sherly" aria-label="Buka profil Sherly">
            <div class="ss-chat-name">Sherly <span class="ss-verified" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 2.1 3-.3 1.4 2.7 2.8 1.1-1 2.9 1 2.9-2.8 1.1-1.4 2.7-3-.3L12 22l-2.4-2.1-3 .3-1.4-2.7-2.8-1.1 1-2.9-1-2.9 2.8-1.1 1.4-2.7 3 .3L12 2zm-1.2 13.6l5-5-1.4-1.4-3.6 3.6-1.8-1.8L7.6 15l3.2 3.2z" opacity=".95"/></svg></span></div>
            <div class="ss-chat-status"><span class="ss-status-dot" aria-hidden="true"></span><span class="ss-status-text">Online · siap bantu ide, strategi &amp; campaign</span></div>
          </button>
        </div>
        <span class="ss-spacer"></span>
        <button type="button" class="ss-newchat" id="ssNewChat" title="Percakapan baru" aria-label="Percakapan baru"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>
      </header>
      <div class="ss-chat-messages" id="ssMessages" aria-live="polite"><div class="ss-chat-empty"><img class="ss-empty-ava" src="assets/sherly-portrait.png" alt="Sherly"><h2>Halo, aku Sherly ✦</h2><p>Tempat kamu nyusun ide konten, strategi, campaign, sampai rencana SherlyStudio. Mulai dari mana nih?</p><div class="ss-suggest"><button type="button" data-prompt="Susunkan ide konten 30 hari untuk akun Sherly berdasarkan niche lifestyle &amp; beauty">Ide konten 30 hari</button><button type="button" data-prompt="Buat caption plus hashtag untuk Reels terbaru Sherly tentang skincare routine">Caption + hashtag Reels</button><button type="button" data-prompt="Rancang strategi kolaborasi brand untuk SherlyStudio bulan depan">Strategi kolaborasi brand</button></div></div></div>
      <div class="ss-compose-wrap"><button type="button" class="ss-jump" id="ssJumpBtn" aria-label="Lompat ke pesan terakhir"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="m6 13 6 6 6-6"/></svg></button><div class="ss-attach-chip" id="ssAttachChip" hidden><img id="ssAttachThumb" alt="Pratinjau lampiran"><span id="ssAttachName"></span><button type="button" id="ssAttachRemove" aria-label="Hapus lampiran"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div><form class="ss-compose" id="ssChatForm"><button type="button" class="ss-attach" id="ssAttachBtn" aria-label="Kirim gambar atau file"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l8.57-8.57A4 4 0 1118 8.84l-8.59 8.57a2 2 0 01-2.83-2.83l8.49-8.48"/></svg></button><input id="ssAttachInput" type="file" accept="image/*,.txt,.md,.csv,.json" hidden><textarea id="ssChatInput" rows="1" maxlength="12000" placeholder="Tulis pesan untuk Sherly..." aria-label="Pesan untuk Sherly"></textarea><button class="ss-send" id="ssSend" type="submit" aria-label="Kirim pesan"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg></button></form><div class="ss-chat-hint">Enter untuk mengirim · Shift + Enter untuk baris baru</div></div>
    </section>
  </section>
  <div class="ss-voice" id="ssVoicePanel" role="dialog" aria-modal="true" aria-labelledby="ssVoiceTitle" aria-hidden="true"><form class="ss-voice-card" id="ssVoiceForm"><div class="ss-voice-head"><div><h2 id="ssVoiceTitle"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff72c5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px;margin-right:5px"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>Profil Sherly</h2><p>Atur AI provider &amp; suara Sherly — semua di satu tempat.</p></div><button type="button" class="ss-voice-close" id="ssVoiceClose" aria-label="Tutup"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div><div class="ss-profile-box"><label class="ss-voice-label" for="ssProvider">AI Provider</label><select id="ssProvider" class="ss-voice-style" aria-label="Pilih AI provider"><option value="auto">✦ Otomatis (fallback cerdas)</option><option value="gemini">Gemini</option><option value="groq">Groq</option><option value="openrouter">OpenRouter</option></select><p class="ss-voice-note">Mesin AI yang menjawab chat — berlaku langsung tanpa perlu Simpan. “Otomatis” memakai provider terbaik yang tersedia &amp; fallback bila salah satu gagal.</p></div><div class="ss-voice-sep"></div><div class="ss-voice-modes" role="tablist" aria-label="Mesin suara"><button type="button" class="ss-voice-mode active" id="ssModeGemini" data-mode="gemini"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px;margin-right:4px"><path d="M20 16.2A4.8 4.8 0 0 0 18 7h-1.2A7 7 0 1 0 5 17h13a4 4 0 0 0 2-.8Z"/></svg>Gemini TTS · Bank Suara</button><button type="button" class="ss-voice-mode" id="ssModeDevice" data-mode="device"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px;margin-right:4px"><rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/></svg>Suara Perangkat (lokal, gratis)</button></div><div id="ssGeminiBlock"><div class="ss-voice-grid" id="ssVoiceGrid"></div><label class="ss-voice-label" for="ssVoiceStyle">Gaya bicara khas (opsional)</label><textarea id="ssVoiceStyle" class="ss-voice-style" rows="2" maxlength="180" placeholder="Indonesia dengan intonasi dan jeda nafas yang natural"></textarea><p class="ss-voice-note">Dipakai sebagai instruksi gaya saat Sherly bicara. Kosongkan = gaya default. Tersimpan di perangkat ini dan ikut dipakai Bank Suara.</p></div><div id="ssDeviceBlock" class="ss-device-block" hidden><label for="ssDeviceVoice">Suara perangkat (id-ID diutamakan — kualitas tergantung sistem HP/PC kamu)</label><select id="ssDeviceVoice"></select><label for="ssDeviceRate">Kecepatan bicara</label><div class="ss-rate-row"><input type="range" id="ssDeviceRate" min="0.7" max="1.3" step="0.05" value="1"><output id="ssDeviceRateOut">1.0×</output></div><p class="ss-voice-note">Suara perangkat dibacakan langsung oleh HP/PC — gratis, tanpa API, tanpa Bank Suara. Browser tidak bisa merekam suara bawaan, jadi tidak bisa disimpan ke Bank. Cocok kalau kuota/key habis.</p></div><div class="ss-voice-actions"><button type="button" class="ss-voice-test" id="ssVoiceTest">Tes</button><button type="submit" class="ss-voice-save">Simpan</button></div><p class="ss-voice-saved" id="ssVoiceSaved" role="status"></p></form></div>
  <div class="ss-auth" id="ssLogin" role="dialog" aria-modal="true" aria-labelledby="ssLoginTitle"><form class="ss-auth-card" id="ssLoginForm"><h2 id="ssLoginTitle">Ngobrol dengan Sherly</h2><p id="ssLoginDesc">Masuk dulu yuk — Sherly pengen kenal kamu biar obrolannya nyambung.</p><div class="ss-auth-modes" role="tablist" aria-label="Cara masuk"><button type="button" class="active" data-mode="login">Masuk</button><button type="button" data-mode="register">Daftar</button><button type="button" data-mode="guest">Tamu</button></div><div data-fields="login"><label for="ssEmail">Email</label><input id="ssEmail" type="email" autocomplete="username" placeholder="email@domain.com"><label for="ssPassword">Password</label><input id="ssPassword" type="password" autocomplete="current-password" placeholder="Password akun kamu"></div><div data-fields="register" hidden><label for="ssRegName">Nama lengkap</label><input id="ssRegName" type="text" autocomplete="name" placeholder="cth: Rani Puspita"><label for="ssRegNick">Panggilan</label><input id="ssRegNick" type="text" autocomplete="nickname" placeholder="cth: Rani"><label for="ssRegGender">Jenis kelamin</label><select id="ssRegGender"><option value="">— pilih —</option><option value="pria">Pria</option><option value="wanita">Wanita</option></select><label for="ssRegEmail">Email</label><input id="ssRegEmail" type="email" autocomplete="username" placeholder="email@domain.com"><label for="ssRegPassword">Password (min. 6 karakter)</label><input id="ssRegPassword" type="password" autocomplete="new-password" placeholder="Buat password baru"></div><div data-fields="guest" hidden><label for="ssGuestName">Nama</label><input id="ssGuestName" type="text" autocomplete="name" placeholder="cth: Bagas Pratama"><label for="ssGuestNick">Panggilan</label><input id="ssGuestNick" type="text" autocomplete="nickname" placeholder="cth: Bagas"><label for="ssGuestGender">Jenis kelamin</label><select id="ssGuestGender"><option value="">— pilih —</option><option value="pria">Pria</option><option value="wanita">Wanita</option></select><label for="ssGuestContact">Kontak (opsional)</label><input id="ssGuestContact" type="text" placeholder="No. WA / email — biar Sherly tetap bisa mengenalmu"><p class="ss-auth-sub">Tanpa akun — identitasmu tersimpan di perangkat ini, dan Sherly tetap ingat obrolan kalian di lain hari.</p></div><div class="ss-auth-error" id="ssLoginError" aria-live="polite"></div><div class="ss-auth-actions"><button type="button" id="ssCancelLogin">Batal</button><button class="ss-auth-primary" id="ssLoginSubmit" type="submit">Masuk</button></div></form></div>`;
  root.id = 'ssChatRoot';
  const mainEl = document.querySelector('main');
  const topbarEl = mainEl?.querySelector('.topbar');
  if (mainEl) { if (topbarEl) topbarEl.insertAdjacentElement('afterend', root); else mainEl.prepend(root); }
  else document.body.appendChild(root);
  // D-124: #ssChatRoot ber-display:none saat chat tertutup, jadi modal login di dalamnya
  // ikut tersembunyi (klik profil atas / tab Profil = "tidak ada reaksi", halaman kosong).
  // Pindahkan modal login ke <body> supaya selalu tampil walau chat belum dibuka.
  const loginModal = root.querySelector('#ssLogin');
  if (loginModal) document.body.appendChild(loginModal);
  // Account chip (top-right): logged in -> buka Profil Pengguna; tamu -> buka login.
  const ownerEl = document.querySelector('.topbar .owner');
  if (ownerEl) {
    ownerEl.setAttribute('role', 'button');
    ownerEl.setAttribute('tabindex', '0');
    ownerEl.querySelector('[data-icon]')?.remove();
    // D-123: kapsul profil pojok atas — sudah login (tier apa pun) buka halaman Profil-nya; publik buka form login.
    const openAccountOrLogin = () => { if (window.sherlyStoredToken?.()?.access_token || token) window.go?.('Profil'); else openLogin(); };
    ownerEl.addEventListener('click', openAccountOrLogin);
    ownerEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAccountOrLogin(); } });
  }
  const $ = id => document.getElementById(id);
  let token = window.sherlyStoredToken?.()?.access_token || null, conversationId = null, sending = false;
  const hasToken = () => Boolean(window.sherlyStoredToken?.()?.access_token || token);
  const authHeaders = async () => ({'Content-Type':'application/json','Authorization':`Bearer ${(await window.sherlyGetAccessToken?.()) || token}`});
  // ---------- Preferensi suara Sherly (dipakai tombol Dengarkan & Bank Suara) ----------
  const VOICE_CHOICES = [['Kore','Tegas & hangat'],['Aoede','Ringan & santai'],['Leda','Muda & ceria'],['Zephyr','Cerah & semangat'],['Sulafat','Lembut & ramah'],['Callirrhoe','Kalem & mengalir'],['Despina','Halus & akrab'],['Puck','Riang & akrab'],['Charon','Tenang & dalam'],['Fenrir','Tegas & semangat'],['Orus','Mantap & hangat'],['Iapetus','Jernih & santai'],['Enceladus','Lembut & dekat'],['Umbriel','Kalem & tenang']];
  function voicePrefs(){ try { const p = JSON.parse(localStorage.getItem('sherly.voicePrefs') || '{}'); return { voice: VOICE_CHOICES.some(v=>v[0]===p.voice) ? p.voice : 'Zephyr', style: typeof p.style === 'string' ? p.style.slice(0,180) : '', mode: p?.mode === 'device' ? 'device' : 'gemini', deviceVoiceURI: typeof p?.deviceVoiceURI === 'string' ? p.deviceVoiceURI : '', rate: Math.min(1.3, Math.max(0.7, Number(p?.rate) || 1)) }; } catch { return { voice: 'Zephyr', style: '', mode: 'gemini', deviceVoiceURI: '', rate: 1 }; } }
  function saveVoicePrefs(prefs){ try { const cur = voicePrefs(); localStorage.setItem('sherly.voicePrefs', JSON.stringify({ voice: prefs.voice ?? cur.voice, style: String(prefs.style ?? cur.style).slice(0,180), mode: prefs.mode ?? cur.mode, deviceVoiceURI: prefs.deviceVoiceURI ?? cur.deviceVoiceURI, rate: prefs.rate ?? cur.rate })); } catch {} }
  let profileRole = 'guest';
  // D-114/D-116: label tier — Sherly mengenali status lawan bicaranya (server mengirimnya
  // sebagai konteks terverifikasi). Penanda visual di chat = meta pesan pertama di bawah;
  // badge kapsulnya ada di halaman Profil Pengguna (diisi profile.js).
  const tierInfo = (r) => r === 'admin' ? { cls: 'owner', label: 'OWNER', title: 'Sherly mengenalimu: pemilik SherlyStudio — partner satu tim' }
    : r === 'member' ? { cls: 'member', label: 'KLIEN', title: 'Sherly mengenalimu: klien terdaftar SherlyStudio' }
    : { cls: 'guest', label: 'TAMU', title: 'Sherly mengenalimu: tamu (buku tamu) — belum berlangganan' };
  function setProfile(user){
    const owner = document.querySelector('.topbar .owner');
    const b = owner?.querySelector('b'), small = owner?.querySelector('small');
    const name = user ? (user.display_name || user.nickname || user.full_name || user.email?.split('@')[0] || 'Pengguna') : 'Tamu';
    if (b) b.textContent = name;
    const r = (user && user.role) || 'guest';
    if (small) small.textContent = user ? (r === 'admin' ? 'ADMIN' : r === 'member' ? 'KLIEN · SHERLYSTUDIO' : 'TAMU · SHERLYSTUDIO') : 'LOGIN · SHERLYSTUDIO';
    profileRole = r;
    owner?.classList.toggle('is-guest', !user);
  }
  let authMode = 'login';
  function setAuthMode(mode){
    authMode = mode;
    document.querySelectorAll('#ssLoginForm .ss-auth-modes button').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
    document.querySelectorAll('#ssLoginForm [data-fields]').forEach(f => { f.hidden = f.dataset.fields !== mode; });
    $('ssLoginSubmit').textContent = mode === 'login' ? 'Masuk' : (mode === 'register' ? 'Daftar' : 'Lanjut');
    $('ssLoginDesc').textContent = mode === 'login' ? 'Masuk dengan email & password — admin maupun klien SherlyStudio.' : (mode === 'register' ? 'Buat akun klien — biar Sherly mengingatmu di setiap obrolan.' : 'Isi buku tamu dulu — tanpa akun, cukup nama & panggilanmu.');
    $('ssLoginError').textContent = '';
  }
  function openLogin(){ $('ssLogin').classList.add('open'); const first = $('ssLoginForm').querySelector('[data-fields]:not([hidden]) input, [data-fields]:not([hidden]) select'); (first || $('ssEmail'))?.focus(); }
  window.sherlyOpenLogin=openLogin;
  window.sherlyOpenRegister=()=>{openLogin();setAuthMode('register');};
  const savedSession = window.sherlyStoredToken?.(); if (savedSession?.access_token) { token = savedSession.access_token; setProfile(savedSession.user || { email: 'Admin', role: 'admin' }); window.sherlyApplyProfile?.(); }
  // ---------- Lampiran gambar/file untuk Vision ----------
  const attachBtn = $('ssAttachBtn'), attachInput = $('ssAttachInput'), attachChip = $('ssAttachChip'), attachThumb = $('ssAttachThumb'), attachName = $('ssAttachName'), attachRemove = $('ssAttachRemove');
  let pendingImage = null, pendingFile = null;
  function downscaleImage(file, maxSize = 1280, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file); const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#0c1422'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve({ mime: 'image/jpeg', data: dataUrl.split(',')[1], dataUrl });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Gagal membaca gambar.')); };
      img.src = url;
    });
  }
  function clearAttachment(){ pendingImage = pendingFile = null; attachChip.hidden = true; attachInput.value = ''; }
  attachBtn?.addEventListener('click', () => attachInput?.click());
  attachInput?.addEventListener('change', async (e) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    try {
      if (f.type.startsWith('image/')) {
        const img = await downscaleImage(f, 1280, 0.85);
        pendingImage = img; pendingFile = null;
        attachThumb.src = img.dataUrl; attachThumb.style.display = 'block'; attachName.textContent = f.name;
      } else if (/\.(txt|md|csv|json)$/i.test(f.name) || f.type === 'text/plain' || f.type === 'application/json') {
        let text = await f.text(); if (text.length > 8000) text = text.slice(0, 8000) + '\n...(dipotong)';
        pendingFile = { name: f.name, text }; pendingImage = null;
        attachThumb.style.display = 'none'; attachName.textContent = f.name;
      } else {
        window.toast?.('Baru gambar (vision) dan file teks (.txt/.md/.csv/.json) yang didukung. File lain menyusul.');
        return;
      }
      attachChip.hidden = false;
    } catch (err) { window.toast?.(err.message); }
  });
  attachRemove?.addEventListener('click', clearAttachment);

  // ---------- TTS playback ----------
  let ttsAudio = null, ttsCurrentBtn = null;
  function stopTts(){ if (ttsAudio) { try { ttsAudio.pause(); } catch {} ttsAudio = null; } if (window.speechSynthesis) { try { speechSynthesis.cancel(); } catch {} } ttsCurrentBtn?.classList.remove('playing'); ttsCurrentBtn = null; }
  async function toggleTts(btn){
    if (ttsCurrentBtn === btn && (ttsAudio || (window.speechSynthesis && speechSynthesis.speaking))) { stopTts(); return; }
    stopTts();
    const bubble = btn.closest('.ss-bubble');
    const text = bubble?.querySelector('.ss-bubble-text')?.textContent?.trim() || '';
    if (!text) return;
    const label = btn.querySelector('span');
    // Mode Suara Perangkat (lokal): langsung dibacakan perangkat, tanpa server/Bank Suara
    if (voicePrefs().mode === 'device') {
      ttsCurrentBtn = btn; btn.classList.add('playing'); if (label) label.textContent = 'Berhenti';
      speakDevice(text, { onEnd: () => { btn.classList.remove('playing'); if (label) label.textContent = 'Dengarkan'; ttsCurrentBtn = null; } });
      return;
    }
    btn.disabled = true; if (label) label.textContent = 'Membuat...';
    try {
      const r = await fetch('/api/ai/tts', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ text: text.slice(0, 1500), ...voicePrefs() }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || ('TTS gagal (' + r.status + ')')); }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      ttsAudio = new Audio(url); ttsCurrentBtn = btn; btn.classList.add('playing'); if (label) label.textContent = 'Berhenti';
      ttsAudio.onended = () => { URL.revokeObjectURL(url); ttsAudio = null; btn.classList.remove('playing'); if (label) label.textContent = 'Dengarkan'; ttsCurrentBtn = null; };
      ttsAudio.onerror = () => { URL.revokeObjectURL(url); stopTts(); if (label) label.textContent = 'Dengarkan'; window.toast?.('Gagal memutar audio TTS.'); };
      await ttsAudio.play();
    } catch (e) {
      // Fallback: suara browser bila TTS server tidak tersedia
      if ('speechSynthesis' in window) {
        try {
          const utter = new SpeechSynthesisUtterance(text.slice(0, 1500));
          utter.lang = 'id-ID'; window.speechSynthesis.cancel(); window.speechSynthesis.speak(utter);
          window.toast?.('TTS server gagal (' + e.message + ') — memakai suara browser.');
        } catch { window.toast?.(e.message); }
      } else window.toast?.(e.message);
    } finally { btn.disabled = false; if (label && !ttsCurrentBtn) label.textContent = label.textContent === 'Membuat...' ? 'Dengarkan' : label.textContent; }
  }

  // Suggestion chips in the empty state -> langsung kirim sebagai pesan
  $('ssMessages').addEventListener('click',(e)=>{const btn=e.target.closest('.ss-suggest button[data-prompt]');if(!btn)return;const input=$('ssChatInput');input.value=btn.dataset.prompt;$('ssChatForm').requestSubmit()});
  $('ssMessages').addEventListener('click',(e)=>{const btn=e.target.closest('.ss-tts-btn');if(!btn)return;e.preventDefault();toggleTts(btn)});
  // Auto-grow textarea sampai 150px
  $('ssChatInput').addEventListener('input',function(){this.style.height='44px';const next=Math.min(this.scrollHeight,150);this.style.height=next+'px'});
  // Pastikan panel chat selalu menempel dari bawah topbar sampai dasar layar.
  // Set eksplisit tinggi #ssChatRoot dalam piksel (bukan hanya andalkan dvh/flex) agar komposer tidak 'naik' di browser mana pun.
  function sizeChat(){
    if (!mainEl?.classList.contains('ss-chat-active')) return;
    const root = $('ssChatRoot'); if (!root) return;
    root.style.height = ''; // ukur ulang dari layout
    const topbar = mainEl.querySelector('.topbar');
    const avail = mainEl.clientHeight - (topbar?.offsetHeight || 0) - 17;
    if (Number.isFinite(avail) && avail > 240) root.style.height = Math.floor(avail) + 'px';
  }
  window.addEventListener('resize', sizeChat);
  function openChat(){ mainEl?.classList.add('ss-chat-active'); $('ssSherlyChat').classList.add('open'); requestAnimationFrame(sizeChat); window.dispatchEvent(new Event('sherly-chat-opened')); if(!hasToken()){openLogin()}else{restoreLatestConversation().finally(()=>$('ssChatInput').focus())} }
  function closeChat(){ const root=$('ssChatRoot'); if(root) root.style.height=''; $('ssSherlyChat').classList.remove('open'); mainEl?.classList.remove('ss-chat-active'); window.dispatchEvent(new Event('sherly-chat-closed')); }
  let tierTagShown = false;
  function empty(){
    tierTagShown = false;
    const u = window.sherlyStoredToken?.()?.user || null;
    const role = u?.role || 'guest';
    const escX = (v) => String(v || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const nick = escX(u?.nickname || u?.display_name || (u?.email ? u.email.split('@')[0] : ''));
    let head = '<h2>Halo, aku Sherly ✦</h2>';
    let sub = 'Tempat kamu nyusun ide konten, strategi, campaign, sampai rencana SherlyStudio. Mulai dari mana nih?';
    let buttons = [
      ['Susunkan ide konten 30 hari untuk akun Sherly berdasarkan niche lifestyle &amp; beauty', 'Ide konten 30 hari'],
      ['Buat caption plus hashtag untuk Reels terbaru Sherly tentang skincare routine', 'Caption + hashtag Reels'],
      ['Rancang strategi kolaborasi brand untuk SherlyStudio bulan depan', 'Strategi kolaborasi brand']
    ];
    if (role === 'member') {
      head = '<h2>Halo ' + (nick || 'kembali') + '! ✦</h2>';
      sub = 'Senang kamu kembali! Obrolan kita sebelumnya masih aku ingat. Ada kebutuhan konten hari ini?';
      buttons = [
        ['Aku mau bahas ide konten untuk brandku', 'Bahas ide konten'],
        ['Boleh tanya progres brief terakhirku?', 'Progres brief'],
        ['Rekomendasikan konten Reels yang lagi relevan ya', 'Rekomendasi Reels']
      ];
    } else if (role === 'guest' && u) {
      head = '<h2>Halo ' + (nick || 'teman baru') + '! ✦</h2>';
      sub = 'Senang berkenalan! Aku Sherly — content creator di balik SherlyStudio. Ada yang bisa aku bantu?';
      buttons = [
        ['Sherly, kenalan dulu dong, kamu siapa?', 'Kenalan dulu'],
        ['SherlyStudio bisa bantu apa saja sih?', 'Layanan studio'],
        ['Aku butuh konten untuk brandku, gimana caranya?', 'Butuh konten']
      ];
    }
    const sug = buttons.map(([pr, lb]) => '<button type="button" data-prompt="' + pr + '">' + lb + '</button>').join('');
    $('ssMessages').innerHTML = '<div class="ss-chat-empty"><img class="ss-empty-ava" src="assets/sherly-portrait.png" alt="Sherly">' + head + '<p>' + sub + '</p><div class="ss-suggest">' + sug + '</div></div>';
  }
  function bubble(role,content,meta='',opts={}){const box=$('ssMessages');box.querySelector('.ss-chat-empty')?.remove();const row=document.createElement('div');row.className=`ss-row ${role}`;if(role==='assistant'){const img=document.createElement('img');img.className='ss-row-ava';img.src='assets/sherly-portrait.png';img.alt='Sherly';row.appendChild(img)}const el=document.createElement('div');el.className=`ss-bubble ${role}`;
    if(opts.imageDataUrl){const pic=document.createElement('img');pic.className='ss-chat-img';pic.src=opts.imageDataUrl;pic.alt='Gambar terlampir';el.appendChild(pic)}
    if(opts.fileName){const chip=document.createElement('span');chip.className='ss-filechip';chip.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/></svg>'; chip.append(opts.fileName);el.appendChild(chip)}
    const text=document.createElement('span');text.className='ss-bubble-text';text.textContent=content;el.appendChild(text);
    const withTts = role==='assistant' && opts.tts !== false;
    const needsMeta = meta || withTts;
    if(needsMeta){const footer=document.createElement('div');footer.className='ss-bubble-meta';if(meta){const small=document.createElement('small');if(/dikenali Sherly$/.test(meta))small.className='ss-tier-tag';small.textContent=meta;footer.appendChild(small)}
      if(withTts){const tts=document.createElement('button');tts.type='button';tts.className='ss-tts-btn';tts.setAttribute('aria-label','Dengarkan jawaban');tts.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/></svg><span>Dengarkan</span>';footer.appendChild(tts)}
      el.appendChild(footer)}
    row.appendChild(el);box.appendChild(row);box.scrollTop=box.scrollHeight;return el;}
  async function loadConversations(){return; /* Riwayat akan ditempatkan pada halaman khusus, bukan sidebar chat. */}
  // Muat ulang percakapan terakhir dari server (chat tidak hilang saat refresh).
  async function restoreLatestConversation(){
    if (conversationId) return;
    if (localStorage.getItem('sherly.forceNewChat') === '1') return;
    if (!$('ssMessages').querySelector('.ss-chat-empty') && $('ssMessages').children.length) return;
    try {
      const r = await fetch('/api/ai/conversations', { headers: { 'Authorization': 'Bearer ' + ((await window.sherlyGetAccessToken?.()) || token || '') } });
      if (!r.ok) return;
      const d = await r.json();
      const latest = (d.conversations || [])[0];
      if (latest?.id) await openConversation(latest.id);
    } catch { /* biarkan empty state */ }
  }
  async function openConversation(id){conversationId=id;$('ssMessages').textContent='Memuat percakapan...';try{const r=await fetch(`/api/ai/conversations/${encodeURIComponent(id)}/messages`,{headers:{'Authorization':'Bearer '+((await window.sherlyGetAccessToken?.())||token||'')}});const d=await r.json();if(!r.ok)throw new Error(d.error||'Gagal membuka percakapan');empty();for(const m of d.messages||[]){const chunks=String(m.content||'').split(/\n{2,}/).map(x=>x.trim()).filter(Boolean);const parts=chunks.length?chunks:[String(m.content||'')];parts.forEach((t,i)=>{const last=i===parts.length-1;const tierFirst=(m.role==='user'&&!tierTagShown)?(tierTagShown=true,tierInfo(profileRole).label+' · dikenali Sherly'):'';bubble(m.role,t,tierFirst||((last&&m.provider)?`${m.provider}${m.model?' · '+m.model:''}`:''))})}await loadConversations()}catch(e){empty();if(typeof window.toast==='function')window.toast(e.message);else alert(e.message)}}
  async function submitAuth(e){
    e.preventDefault();
    const btn = $('ssLoginSubmit'), err = $('ssLoginError');
    const label = authMode === 'login' ? 'Masuk' : (authMode === 'register' ? 'Daftar Akun Klien' : 'Lanjut sebagai Tamu');
    btn.disabled = true; btn.textContent = 'Memproses...'; err.textContent = '';
    try {
      let r, d;
      if (authMode === 'register') {
        const fullName = $('ssRegName').value.trim(), nick = $('ssRegNick').value.trim(), gender = $('ssRegGender').value, email = $('ssRegEmail').value.trim(), password = $('ssRegPassword').value;
        if (!fullName || !gender || !email || !password) throw new Error('Lengkapi nama, jenis kelamin, email, dan password dulu ya.');
        r = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: fullName, nickname: nick, gender, email, password }) });
        d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Pendaftaran gagal');
        if (d.needs_confirmation) { err.textContent = 'Hampir selesai! Cek email kamu untuk verifikasi dulu, lalu kembali ke sini untuk masuk.'; return; }
      } else if (authMode === 'guest') {
        const fullName = $('ssGuestName').value.trim(), nick = $('ssGuestNick').value.trim(), gender = $('ssGuestGender').value, contact = $('ssGuestContact').value.trim();
        if (!fullName || !gender) throw new Error('Nama dan jenis kelamin wajib diisi dulu ya.');
        r = await fetch('/api/auth/guest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: fullName, nickname: nick, gender, contact }) });
        d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Gagal masuk sebagai tamu');
      } else {
        r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: $('ssEmail').value.trim(), password: $('ssPassword').value }) });
        d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Login gagal');
      }
      token = d.access_token;
      setProfile(d.user || null);
      window.sherlySetAuthSession?.({ access_token: d.access_token, refresh_token: d.refresh_token || null, expires_at: d.expires_at || null, user: d.user || null });
      window.sherlyApplyRole?.();
      window.sherlyApplyProfile?.();
      // D-119: profil per akun — admin menarik ulang dari DB; tamu/klien bersihkan sisa akun sebelumnya.
      if ((d.user?.role || 'guest') === 'admin') Promise.resolve(window.loadProfile?.()).catch(() => {});
      else window.sherlyResetLocalProfile?.();
      $('ssLogin').classList.remove('open');
      await loadConversations();
      if (!conversationId) empty();
      $('ssChatInput').focus();
    } catch (e2) { err.textContent = e2.message; }
    finally { btn.disabled = false; btn.textContent = label; }
  }
  async function send(e){e.preventDefault();if(sending)return;if(!hasToken()){openLogin();return}const input=$('ssChatInput');let message=input.value.trim();const outgoingImage=pendingImage,outgoingFile=pendingFile;if(!message&&!outgoingImage){window.toast?.('Tulis pesan atau lampirkan gambar dulu ya.');return}if(outgoingFile){message=(message?message+'\n\n':'')+`[Lampiran file: ${outgoingFile.name}]\n\`\`\`\n${outgoingFile.text}\n\`\`\``}const displayText = message || 'Tolong analisis gambar ini.';sending=true;$('ssSend').disabled=true;input.value='';input.style.height='44px';clearAttachment();const tierMeta = tierTagShown ? '' : tierInfo(profileRole).label + ' · dikenali Sherly'; tierTagShown = true;
    bubble('user',displayText,tierMeta,{imageDataUrl:outgoingImage?.dataUrl,fileName:outgoingFile?.name});const pending=bubble('assistant','Sherly sedang mengetik...','',{tts:false});try{const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Jakarta';const r=await fetch('/api/ai/chat',{method:'POST',headers:await authHeaders(),body:JSON.stringify({message,provider:$('ssProvider').value,conversation_id:conversationId,timezone,...(outgoingImage?{image:{mime:outgoingImage.mime,data:outgoingImage.data}}:{})})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Sherly gagal merespons');pending.remove();conversationId=d.conversation_id;try{localStorage.removeItem('sherly.forceNewChat')}catch{}const parts=(Array.isArray(d.bubbles)&&d.bubbles.length?d.bubbles:String(d.reply||'').split(/\n{2,}/)).map(x=>String(x).trim()).filter(Boolean);const metaStr=`${d.provider}${d.model?' · '+d.model:''}${d.fallback_used?' · fallback otomatis':''}`;parts.forEach((text,i)=>{const last=i===parts.length-1;window.setTimeout(()=>{bubble('assistant',text,last?metaStr:'',last?{tts:true}:{tts:false})}, Math.min(i*450,1800))});await loadConversations()}catch(e2){pending.querySelector('.ss-bubble-text').textContent=`Maaf, pesan belum berhasil diproses: ${e2.message}`}finally{sending=false;$('ssSend').disabled=false;input.focus()}}
  function logout(){
    token=null; conversationId=null;
    try { localStorage.removeItem('sherly.forceNewChat'); } catch {}
    window.sherlyClearAuthSession?.();
    setProfile(null);
    window.sherlyResetLocalProfile?.(); // D-119: hapus cache profil akun ini dari browser
    $('ssPassword').value=''; $('ssLoginError').textContent=''; setAuthMode('login');
    closeChat();
    if (typeof window.go === 'function') window.go('Beranda');
    if (typeof window.toast === 'function') window.toast('Anda sudah keluar akun.');
  }
  window.sherlyLogout = logout;
  // ---------- Tombol "Percakapan baru" ----------
  $('ssNewChat').addEventListener('click',()=>{
    if (sending) return;
    conversationId = null;
    try { localStorage.setItem('sherly.forceNewChat', '1'); } catch {}
    empty();
    $('ssChatInput').focus();
    if (typeof window.toast === 'function') window.toast('Percakapan baru dimulai.');
  });

  // ---------- Panel Suara Sherly (klik foto profil Sherly) ----------
  const voicePanel = $('ssVoicePanel'), voiceGrid = $('ssVoiceGrid'), voiceStyle = $('ssVoiceStyle'), voiceSaved = $('ssVoiceSaved'), voiceTest = $('ssVoiceTest');
  let selectedVoice = voicePrefs().voice;
  function renderVoiceChips(){
    voiceGrid.innerHTML = '';
    for (const [id, label] of VOICE_CHOICES) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'ss-voice-chip' + (id === selectedVoice ? ' active' : '');
      chip.textContent = `${id} · ${label}`;
      chip.setAttribute('aria-pressed', String(id === selectedVoice));
      chip.addEventListener('click', () => { selectedVoice = id; voiceSaved.textContent = ''; renderVoiceChips(); });
      voiceGrid.appendChild(chip);
    }
  }
  // ---------- Mode: Gemini (Bank Suara) vs Suara Perangkat (lokal) ----------
  let currentMode = voicePrefs().mode;
  const modeBtns = { gemini: $('ssModeGemini'), device: $('ssModeDevice') };
  const geminiBlock = $('ssGeminiBlock'), deviceBlock = $('ssDeviceBlock');
  const deviceVoiceSel = $('ssDeviceVoice'), deviceRate = $('ssDeviceRate'), deviceRateOut = $('ssDeviceRateOut');
  function deviceVoices(){
    const all = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    // id-ID diutamakan, lalu bahasa lain; tiap opsi tampil: nama · lang
    return all.slice().sort((a, b) => ((b.lang || '').toLowerCase().startsWith('id') - (a.lang || '').toLowerCase().startsWith('id')) || String(a.name).localeCompare(String(b.name)));
  }
  function renderDeviceVoices(selectedURI){
    if (!deviceVoiceSel) return;
    const voices = deviceVoices();
    deviceVoiceSel.innerHTML = '';
    if (!voices.length) { const opt = document.createElement('option'); opt.value = ''; opt.textContent = 'Tidak ada suara perangkat ditemukan'; deviceVoiceSel.appendChild(opt); deviceVoiceSel.disabled = true; return; }
    deviceVoiceSel.disabled = false;
    let chosen = null;
    for (const v of voices) {
      const opt = document.createElement('option');
      opt.value = v.voiceURI;
      opt.textContent = `${v.name} · ${v.lang}${/id/i.test(v.lang) ? ' ★' : ''}`;
      if (v.voiceURI === selectedURI) chosen = opt;
      deviceVoiceSel.appendChild(opt);
    }
    if (chosen) deviceVoiceSel.value = chosen.value;
    else { const firstId = voices.find(v => /^id/i.test(v.lang)); if (firstId) deviceVoiceSel.value = firstId.voiceURI; }
  }
  function setMode(mode){
    currentMode = mode === 'device' ? 'device' : 'gemini';
    modeBtns.gemini?.classList.toggle('active', currentMode === 'gemini');
    modeBtns.device?.classList.toggle('active', currentMode === 'device');
    if (geminiBlock) geminiBlock.hidden = currentMode !== 'gemini';
    if (deviceBlock) deviceBlock.hidden = currentMode !== 'device';
    if (currentMode === 'device') renderDeviceVoices(voicePrefs().deviceVoiceURI);
  }
  modeBtns.gemini?.addEventListener('click', () => { setMode('gemini'); voiceSaved.textContent=''; });
  modeBtns.device?.addEventListener('click', () => { setMode('device'); voiceSaved.textContent=''; });
  deviceRate?.addEventListener('input', () => { if (deviceRateOut) deviceRateOut.textContent = Number(deviceRate.value).toFixed(2).replace(/0$/, '') + '×'; });
  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => { if (currentMode === 'device') renderDeviceVoices(voicePrefs().deviceVoiceURI); };
  /** Ucapkan teks dengan suara perangkat (lokal). Return utterance-nya. */
  function speakDevice(text, { onStart, onEnd } = {}){
    if (!window.speechSynthesis) return null;
    const prefs = voicePrefs();
    const utter = new SpeechSynthesisUtterance(String(text).slice(0, 800));
    utter.lang = 'id-ID';
    utter.rate = prefs.rate || 1;
    const v = deviceVoices().find(v => v.voiceURI === prefs.deviceVoiceURI) || deviceVoices().find(v => /^id/i.test(v.lang)) || null;
    if (v) { utter.voice = v; utter.lang = v.lang || 'id-ID'; }
    utter.onstart = () => onStart?.();
    utter.onend = () => onEnd?.();
    utter.onerror = () => onEnd?.();
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
    return utter;
  }
  function openVoicePanel(){
    const prefs = voicePrefs();
    selectedVoice = prefs.voice;
    voiceStyle.value = prefs.style;
    if (deviceRate) { deviceRate.value = String(prefs.rate || 1); if (deviceRateOut) deviceRateOut.textContent = Number(prefs.rate || 1).toFixed(2).replace(/0$/, '') + '×'; }
    voiceSaved.textContent = '';
    voiceTest.disabled = false; voiceTest.textContent = 'Tes';
    renderVoiceChips();
    setMode(prefs.mode);
    voicePanel.classList.add('open');
    voicePanel.setAttribute('aria-hidden', 'false');
  }
  function closeVoicePanel(){ voicePanel.classList.remove('open'); voicePanel.setAttribute('aria-hidden', 'true'); }
  $('ssChatClose')?.addEventListener('click', closeChat);
  $('ssAvaBtn').addEventListener('click', openVoicePanel);
  $('ssChatInfoBtn')?.addEventListener('click', openVoicePanel);
  const jumpBtn = $('ssJumpBtn'), msgsEl = $('ssMessages');
  if (jumpBtn && msgsEl) {
    msgsEl.addEventListener('scroll', () => {
      jumpBtn.classList.toggle('show', msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight > 420);
    }, { passive: true });
    jumpBtn.addEventListener('click', () => msgsEl.scrollTo({ top: msgsEl.scrollHeight, behavior: 'smooth' }));
  }
  $('ssVoiceClose').addEventListener('click', closeVoicePanel);
  voicePanel.addEventListener('click', (e) => { if (e.target === voicePanel) closeVoicePanel(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && voicePanel.classList.contains('open')) closeVoicePanel(); });
  $('ssVoiceForm').addEventListener('submit', (e) => {
    e.preventDefault();
    saveVoicePrefs({ voice: selectedVoice, style: voiceStyle.value, mode: currentMode, deviceVoiceURI: deviceVoiceSel?.value || '', rate: Number(deviceRate?.value) || 1 });
    voiceSaved.textContent = currentMode === 'device' ? '✓ Suara perangkat disimpan — dipakai tombol Dengarkan (lokal).' : '✓ Suara Sherly disimpan — dipakai Dengarkan & Bank Suara.';
    if (typeof window.toast === 'function') window.toast('Preferensi suara Sherly disimpan.');
  });
  voiceTest.addEventListener('click', async () => {
    if (currentMode === 'device') {
      saveVoicePrefs({ voice: selectedVoice, style: voiceStyle.value, mode: 'device', deviceVoiceURI: deviceVoiceSel?.value || '', rate: Number(deviceRate?.value) || 1 });
      voiceTest.disabled = true; voiceTest.textContent = 'Memutar...';
      speakDevice('Halo, aku Sherly. Ini contoh suara perangkatku.', { onEnd: () => { voiceTest.disabled = false; voiceTest.textContent = 'Tes'; } });
      return;
    }
    voiceTest.disabled = true; voiceTest.textContent = 'Merekam...';
    try {
      const r = await fetch('/api/ai/tts', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ text: 'Halo, aku Sherly. Ini contoh suaraku hari ini.', voice: selectedVoice, style: voiceStyle.value }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || ('TTS gagal (' + r.status + ')')); }
      const url = URL.createObjectURL(await r.blob());
      const audio = new Audio(url);
      voiceTest.textContent = 'Memutar...';
      audio.onended = () => { URL.revokeObjectURL(url); voiceTest.disabled = false; voiceTest.textContent = 'Tes'; };
      audio.onerror = () => { URL.revokeObjectURL(url); voiceTest.disabled = false; voiceTest.textContent = 'Tes'; };
      await audio.play();
    } catch (err) {
      voiceSaved.textContent = 'Tes gagal: ' + err.message;
      voiceTest.disabled = false; voiceTest.textContent = 'Tes';
    }
  });

  $('ssCancelLogin').addEventListener('click',()=>$('ssLogin').classList.remove('open'));document.querySelectorAll('#ssLoginForm .ss-auth-modes button').forEach(btn=>btn.addEventListener('click',()=>setAuthMode(btn.dataset.mode)));$('ssLoginForm').addEventListener('submit',submitAuth);$('ssChatForm').addEventListener('submit',send);
$('ssChatInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('ssChatForm').requestSubmit()}});
  // Keep the application shell and sidebar visible. Chat occupies only the main workspace.
  document.querySelectorAll('.nav button[data-page]').forEach(b=>b.addEventListener('click',e=>{
    if(b.dataset.page==='Chat Sherly'){
      e.preventDefault();e.stopImmediatePropagation();
      document.querySelectorAll('.nav button,.side-nav-btn').forEach(n=>n.classList.toggle('active',n===b));
      openChat();
    } else {
      closeChat(); // let the existing application navigation handle the selected module
    }
  },true));
  document.querySelectorAll('.panel.chat button.primary').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();document.querySelectorAll('.nav button,.side-nav-btn').forEach(n=>n.classList.toggle('active',n.dataset.page==='Chat Sherly'));openChat()},true));
  // (D-117) JANGAN reset profil di sini — baris ini menimpa status tier dari sesi login
  // di atas (setProfile(savedSession.user)), sehingga tag pesan pertama selalu bilang "TAMU".
  window.openSherlyChat=openChat;
  window.sherlyLogout=logout;
  window.sherlyCloseChat=closeChat;
})();
