(() => {
  const style = `
  .ss-chat{position:relative;width:100%;height:calc(100dvh - 112px);min-height:520px;background:radial-gradient(1100px 480px at 50% -12%,rgba(216,45,145,.16),transparent 62%),radial-gradient(700px 380px at 88% 110%,rgba(124,43,133,.14),transparent 60%),#070b14;display:none;grid-template-rows:auto minmax(0,1fr) auto;color:#f4f5fb;font:14px/1.55 Inter,ui-sans-serif,system-ui,sans-serif;border:0;border-radius:18px;overflow:hidden}
  main.ss-chat-active>.layout,main.ss-chat-active>.page-view{display:none!important}main.ss-chat-active>#ssChatRoot{display:block!important}
  .ss-chat.open{display:grid}
  .ss-chat-main{min-width:0;min-height:0;height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden}
  .ss-chat button{cursor:pointer;font:inherit}
  /* header */
  .ss-chat-toolbar{display:flex;align-items:center;gap:13px;padding:13px 20px;background:linear-gradient(180deg,rgba(255,255,255,.025),transparent);border-bottom:1px solid rgba(255,255,255,.045);position:relative;z-index:2}
  .ss-back{width:38px;height:38px;flex:none;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:#dce4f1;display:grid;place-items:center;transition:.18s}
  .ss-back:hover{background:rgba(255,255,255,.07);border-color:rgba(255,114,197,.4)}
  .ss-chat-id{display:flex;align-items:center;gap:12px;min-width:0}
  .ss-ava-wrap{position:relative;flex:none}
  .ss-ava{width:46px;height:46px;border-radius:50%;object-fit:cover;object-position:center 16%;border:1px solid rgba(255,255,255,.16);background:#131c2e}
  .ss-ava-dot{position:absolute;right:-1px;bottom:-1px;width:12px;height:12px;border-radius:50%;background:#3ddc84;border:2px solid #0a0f1e;box-shadow:0 0 8px #3ddc8466}
  .ss-chat-name{font-size:15px;font-weight:500;color:#ffffff;letter-spacing:.01em;display:flex;align-items:center;gap:7px;line-height:1.2}
  .ss-verified{color:#ff72c5;display:inline-flex}
  .ss-chat-status{font-size:11px;color:#8fa4bd;display:flex;align-items:center;gap:6px;margin-top:3px;letter-spacing:.02em}
  .ss-status-dot{width:6px;height:6px;border-radius:50%;background:#3ddc84;display:inline-block}
  .ss-spacer{flex:1}
  .ss-provider{background:rgba(255,255,255,.04);color:#e8edf6;border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:9px 14px;font-size:12px;outline:none;transition:.18s;cursor:pointer}
  .ss-provider:hover{border-color:rgba(255,114,197,.45)}
  .ss-provider:focus{border-color:#e84ba9;box-shadow:0 0 0 3px rgba(232,75,169,.18)}
  /* messages — scrollable, no visible scrollbar */
  .ss-chat-messages{min-height:0;min-width:0;overscroll-behavior:contain;overflow-y:auto;overflow-x:hidden;padding:26px max(22px,calc((100% - 940px)/2));display:flex;flex-direction:column;gap:14px;scrollbar-width:none;-ms-overflow-style:none}
  .ss-chat-messages::-webkit-scrollbar{display:none}
  .ss-row{display:flex;gap:9px;align-items:flex-end;max-width:82%}
  .ss-row.assistant{align-self:flex-start}
  .ss-row.user{align-self:flex-end;flex-direction:row-reverse}
  .ss-row-ava{width:30px;height:30px;flex:none;border-radius:50%;object-fit:cover;object-position:center 16%;border:1px solid rgba(255,255,255,.13);background:#131c2e;margin-bottom:2px}
  .ss-bubble{padding:12px 15px;border-radius:18px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7;font-weight:400}
  .ss-row.assistant .ss-bubble{background:#101a2c;border:1px solid #1e2c44;border-bottom-left-radius:6px;color:#e9edf6;box-shadow:0 4px 18px rgba(0,0,0,.25)}
  .ss-row.user .ss-bubble{background:linear-gradient(135deg,#d82d91 0%,#a02d8f 55%,#5c2470 100%);border:1px solid rgba(255,255,255,.14);border-bottom-right-radius:6px;color:#fff;box-shadow:0 6px 22px rgba(216,45,145,.28)}
  .ss-bubble small{display:block;color:rgba(233,237,246,.45);font-size:10px;margin-top:7px;letter-spacing:.03em}
  .ss-row.user .ss-bubble small{color:rgba(255,255,255,.55)}
  /* empty state */
  .ss-chat-empty{margin:auto;text-align:center;max-width:520px;color:#8fa4bd;padding:24px 12px}
  .ss-empty-ava{width:86px;height:86px;border-radius:50%;object-fit:cover;object-position:center 14%;border:1px solid rgba(255,114,197,.4);padding:4px;background:radial-gradient(circle at 50% 30%,rgba(216,45,145,.35),rgba(13,18,32,.9));box-shadow:0 0 44px rgba(216,45,145,.35)}
  .ss-chat-empty h2{color:#fff;font-size:24px;font-weight:500;margin:16px 0 8px;letter-spacing:.01em}
  .ss-chat-empty p{line-height:1.75;font-size:13px;margin:0 auto}
  .ss-suggest{display:flex;flex-wrap:wrap;gap:9px;justify-content:center;margin-top:18px}
  .ss-suggest button{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.03);color:#ffd6ef;border-radius:999px;padding:9px 15px;font-size:12px;transition:.18s;letter-spacing:.01em}
  .ss-suggest button:hover{border-color:rgba(255,114,197,.55);background:rgba(216,45,145,.14);box-shadow:0 0 18px rgba(216,45,145,.22);transform:translateY(-1px)}
  /* composer — flush to bottom, left & right edges borderless */
  .ss-compose-wrap{position:relative;z-index:2;flex-shrink:0;background:linear-gradient(180deg,rgba(7,11,20,0),#070b14 38%);padding:12px 18px max(14px,env(safe-area-inset-bottom))}
  .ss-compose{display:flex;gap:11px;align-items:flex-end;background:#0d1526;border:1px solid #1f2c42;border-radius:22px;padding:9px 10px 9px 17px;transition:.18s}
  .ss-compose:focus-within{border-color:rgba(232,75,169,.6);box-shadow:0 0 0 3px rgba(232,75,169,.14),0 10px 34px rgba(0,0,0,.35)}
  .ss-compose textarea{flex:1;resize:none;min-height:44px;height:44px;max-height:150px;overflow-y:auto;background:transparent;border:0;outline:0;color:#fff;padding:11px 2px;font:inherit;line-height:1.5;scrollbar-width:none}
  .ss-compose textarea::-webkit-scrollbar{display:none}
  .ss-compose textarea::placeholder{color:#5f7089}
  .ss-send{flex:none;width:46px;height:46px;border-radius:50%;border:0;background:linear-gradient(135deg,#e83ca5,#7a2d91);color:#fff;display:grid;place-items:center;box-shadow:0 6px 20px rgba(216,45,145,.4);transition:.18s}
  .ss-send:hover{transform:translateY(-1px) scale(1.05);box-shadow:0 8px 26px rgba(216,45,145,.55)}
  .ss-send:disabled{opacity:.45;cursor:wait;transform:none}
  .ss-chat-hint{text-align:center;color:#5f7089;font-size:10px;margin-top:8px;letter-spacing:.04em}
  @media(max-width:700px){.ss-chat{height:calc(100dvh - 100px);min-height:480px;border-radius:12px}.ss-chat-toolbar{padding:10px 12px;gap:9px}.ss-chat-messages{padding:18px 12px}.ss-compose-wrap{padding:10px}.ss-row{max-width:94%}.ss-chat-toolbar .ss-provider{max-width:125px}.ss-ava{width:40px;height:40px}.ss-suggest{flex-direction:column;align-items:stretch}}
    .ss-auth{position:fixed;inset:0;z-index:100;background:#02050bdc;display:none;place-items:center;padding:20px;font:14px/1.45 Inter,ui-sans-serif,system-ui,sans-serif}.ss-auth.open{display:grid}.ss-auth-card{width:min(420px,100%);background:#101b2c;border:1px solid #344158;border-radius:18px;padding:26px;box-shadow:0 25px 80px #000b;color:#f4f5fb}.ss-auth-card h2{margin:0 0 7px}.ss-auth-card p{color:#91a2b9;line-height:1.6}.ss-auth-card label{display:block;color:#b9c5d5;font-size:12px;margin:14px 0 6px}.ss-auth-card input{width:100%;padding:12px;border-radius:9px;border:1px solid #344158;background:#080f1b;color:white;outline:0;box-sizing:border-box}.ss-auth-card input:focus{border-color:#e84ba9}.ss-auth-actions{display:flex;gap:9px;margin-top:18px}.ss-auth-actions button{flex:1}.ss-auth-primary{background:linear-gradient(100deg,#d82d91,#7c2b85)!important;border:0!important;font-weight:500}.ss-auth-error{color:#ff9ebd;font-size:12px;min-height:18px;margin-top:10px}
  @media(max-width:700px){.ss-chat{height:calc(100dvh - 100px);min-height:480px;grid-template-columns:minmax(0,1fr)}.ss-chat-toolbar{padding:12px}.ss-chat-messages{padding:18px 13px}.ss-compose-wrap{padding:10px}.ss-bubble{max-width:94%}.ss-chat-toolbar select{max-width:125px}}
  `;
  const styleEl = document.createElement('style'); styleEl.textContent = style; document.head.appendChild(styleEl);
  const root = document.createElement('div'); root.innerHTML = `
  <section class="ss-chat" id="ssSherlyChat" aria-label="Chat Sherly">
    <section class="ss-chat-main">
      <header class="ss-chat-toolbar">
        <button type="button" class="ss-back" id="ssCloseChatTop" aria-label="Kembali ke Beranda"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></button>
        <div class="ss-chat-id">
          <div class="ss-ava-wrap"><img class="ss-ava" src="assets/sherly-portrait.png" alt="Sherly"><span class="ss-ava-dot" aria-hidden="true"></span></div>
          <div>
            <div class="ss-chat-name">Sherly <span class="ss-verified" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 2.1 3-.3 1.4 2.7 2.8 1.1-1 2.9 1 2.9-2.8 1.1-1.4 2.7-3-.3L12 22l-2.4-2.1-3 .3-1.4-2.7-2.8-1.1 1-2.9-1-2.9 2.8-1.1 1.4-2.7 3 .3L12 2zm-1.2 13.6l5-5-1.4-1.4-3.6 3.6-1.8-1.8L7.6 15l3.2 3.2z" opacity=".95"/></svg></span></div>
            <div class="ss-chat-status"><span class="ss-status-dot" aria-hidden="true"></span>Online · siap bantu ide, strategi &amp; campaign</div>
          </div>
        </div>
        <span class="ss-spacer"></span>
        <select id="ssProvider" class="ss-provider" aria-label="Pilih AI provider"><option value="auto">✦ Otomatis</option><option value="gemini">Gemini</option><option value="groq">Groq</option><option value="openrouter">OpenRouter</option></select>
      </header>
      <div class="ss-chat-messages" id="ssMessages" aria-live="polite"><div class="ss-chat-empty"><img class="ss-empty-ava" src="assets/sherly-portrait.png" alt="Sherly"><h2>Halo, aku Sherly ✦</h2><p>Tempat kamu nyusun ide konten, strategi, campaign, sampai rencana SherlyStudio. Mulai dari mana nih?</p><div class="ss-suggest"><button type="button" data-prompt="Susunkan ide konten 30 hari untuk akun Sherly berdasarkan niche lifestyle &amp; beauty">Ide konten 30 hari</button><button type="button" data-prompt="Buat caption plus hashtag untuk Reels terbaru Sherly tentang skincare routine">Caption + hashtag Reels</button><button type="button" data-prompt="Rancang strategi kolaborasi brand untuk SherlyStudio bulan depan">Strategi kolaborasi brand</button></div></div></div>
      <div class="ss-compose-wrap"><form class="ss-compose" id="ssChatForm"><textarea id="ssChatInput" rows="1" maxlength="12000" placeholder="Tulis pesan untuk Sherly..." aria-label="Pesan untuk Sherly"></textarea><button class="ss-send" id="ssSend" type="submit" aria-label="Kirim pesan"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg></button></form><div class="ss-chat-hint">Enter untuk mengirim · Shift + Enter untuk baris baru</div></div>
    </section>
  </section>
  <div class="ss-auth" id="ssLogin" role="dialog" aria-modal="true" aria-labelledby="ssLoginTitle"><form class="ss-auth-card" id="ssLoginForm"><h2 id="ssLoginTitle">Masuk ke SherlyStudio</h2><p>Gunakan akun admin SherlyStudio untuk mengakses Chat Sherly.</p><label for="ssEmail">Email</label><input id="ssEmail" type="email" autocomplete="username" required placeholder="email@domain.com"><label for="ssPassword">Password</label><input id="ssPassword" type="password" autocomplete="current-password" required placeholder="Password akun Supabase"><div class="ss-auth-error" id="ssLoginError" aria-live="polite"></div><div class="ss-auth-actions"><button type="button" id="ssCancelLogin">Batal</button><button class="ss-auth-primary" id="ssLoginSubmit" type="submit">Masuk</button></div></form></div>`;
  root.id = 'ssChatRoot';
  const mainEl = document.querySelector('main');
  const topbarEl = mainEl?.querySelector('.topbar');
  if (mainEl) { if (topbarEl) topbarEl.insertAdjacentElement('afterend', root); else mainEl.prepend(root); }
  else document.body.appendChild(root);
  // Account chip (top-right): logged in -> buka Profil Pengguna; tamu -> buka login.
  const ownerEl = document.querySelector('.topbar .owner');
  if (ownerEl) {
    ownerEl.setAttribute('role', 'button');
    ownerEl.setAttribute('tabindex', '0');
    ownerEl.querySelector('[data-icon]')?.remove();
    ownerEl.addEventListener('click', () => { if (hasToken()) window.go?.('Profil'); else openLogin(); });
    ownerEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (hasToken()) window.go?.('Profil'); else openLogin(); } });
  }
  const $ = id => document.getElementById(id);
  let token = window.sherlyStoredToken?.()?.access_token || null, conversationId = null, sending = false;
  const hasToken = () => Boolean(window.sherlyStoredToken?.()?.access_token || token);
  const authHeaders = async () => ({'Content-Type':'application/json','Authorization':`Bearer ${(await window.sherlyGetAccessToken?.()) || token}`});
  function setProfile(user){
    const owner = document.querySelector('.topbar .owner');
    const b = owner?.querySelector('b'), small = owner?.querySelector('small');
    const name = user ? (user.display_name || user.full_name || user.email?.split('@')[0] || 'Pengguna') : 'Tamu';
    if (b) b.textContent = name;
    if (small) small.textContent = user ? (user.role || 'ADMIN').toString().toUpperCase() : 'LOGIN · SHERLYSTUDIO';
    owner?.classList.toggle('is-guest', !user);
  }
  function openLogin(){ $('ssLogin').classList.add('open'); $('ssEmail').focus(); }
  window.sherlyOpenLogin=openLogin;
  const savedSession = window.sherlyStoredToken?.(); if (savedSession?.access_token) { token = savedSession.access_token; setProfile(savedSession.user || { email: 'Admin', role: 'admin' }); window.sherlyApplyProfile?.(); }
  // Suggestion chips in the empty state -> langsung kirim sebagai pesan
  $('ssMessages').addEventListener('click',(e)=>{const btn=e.target.closest('.ss-suggest button[data-prompt]');if(!btn)return;const input=$('ssChatInput');input.value=btn.dataset.prompt;$('ssChatForm').requestSubmit()});
  // Auto-grow textarea sampai 150px
  $('ssChatInput').addEventListener('input',function(){this.style.height='44px';const next=Math.min(this.scrollHeight,150);this.style.height=next+'px'});
  function openChat(){ mainEl?.classList.add('ss-chat-active'); $('ssSherlyChat').classList.add('open'); if(!hasToken()){openLogin()}else{loadConversations();$('ssChatInput').focus()} }
  function closeChat(){ $('ssSherlyChat').classList.remove('open'); mainEl?.classList.remove('ss-chat-active'); }
  function empty(){ $('ssMessages').innerHTML='<div class="ss-chat-empty"><img class="ss-empty-ava" src="assets/sherly-portrait.png" alt="Sherly"><h2>Halo, aku Sherly ✦</h2><p>Tempat kamu nyusun ide konten, strategi, campaign, sampai rencana SherlyStudio. Mulai dari mana nih?</p><div class="ss-suggest"><button type="button" data-prompt="Susunkan ide konten 30 hari untuk akun Sherly berdasarkan niche lifestyle &amp; beauty">Ide konten 30 hari</button><button type="button" data-prompt="Buat caption plus hashtag untuk Reels terbaru Sherly tentang skincare routine">Caption + hashtag Reels</button><button type="button" data-prompt="Rancang strategi kolaborasi brand untuk SherlyStudio bulan depan">Strategi kolaborasi brand</button></div></div>'; }
  function bubble(role,content,meta=''){const box=$('ssMessages');box.querySelector('.ss-chat-empty')?.remove();const row=document.createElement('div');row.className=`ss-row ${role}`;if(role==='assistant'){const img=document.createElement('img');img.className='ss-row-ava';img.src='assets/sherly-portrait.png';img.alt='Sherly';row.appendChild(img)}const el=document.createElement('div');el.className=`ss-bubble ${role}`;el.textContent=content;if(meta){const small=document.createElement('small');small.textContent=meta;el.appendChild(small)}row.appendChild(el);box.appendChild(row);box.scrollTop=box.scrollHeight;return el;}
  async function loadConversations(){return; /* Riwayat akan ditempatkan pada halaman khusus, bukan sidebar chat. */}
  async function openConversation(id){conversationId=id;$('ssMessages').textContent='Memuat percakapan...';try{const r=await fetch(`/api/ai/conversations/${encodeURIComponent(id)}/messages`,{headers:{'Authorization':'Bearer '+((await window.sherlyGetAccessToken?.())||token||'')}});const d=await r.json();if(!r.ok)throw new Error(d.error||'Gagal membuka percakapan');empty();for(const m of d.messages||[])bubble(m.role,m.content,m.provider?`${m.provider}${m.model?' · '+m.model:''}`:'');await loadConversations()}catch(e){empty();if(typeof window.toast==='function')window.toast(e.message);else alert(e.message)}}
  async function login(e){e.preventDefault();const btn=$('ssLoginSubmit'),err=$('ssLoginError');btn.disabled=true;btn.textContent='Memeriksa...';err.textContent='';try{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:$('ssEmail').value.trim(),password:$('ssPassword').value})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Login gagal');token=d.access_token;setProfile(d.user||{email:'Admin',role:'admin'});window.sherlySetAuthSession?.({access_token:d.access_token,refresh_token:d.refresh_token||null,expires_at:d.expires_at||null,user:d.user||null});window.sherlyApplyProfile?.();$('ssLogin').classList.remove('open');await loadConversations();$('ssChatInput').focus()}catch(e){err.textContent=e.message}finally{btn.disabled=false;btn.textContent='Masuk'}}
  async function send(e){e.preventDefault();if(sending)return;if(!hasToken()){openLogin();return}const input=$('ssChatInput'),message=input.value.trim();if(!message)return;sending=true;$('ssSend').disabled=true;input.value='';input.style.height='44px';bubble('user',message);const pending=bubble('assistant','Sherly sedang mengetik...');try{const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Jakarta';const r=await fetch('/api/ai/chat',{method:'POST',headers:await authHeaders(),body:JSON.stringify({message,provider:$('ssProvider').value,conversation_id:conversationId,timezone})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Sherly gagal merespons');pending.remove();conversationId=d.conversation_id;bubble('assistant',d.reply,`${d.provider}${d.model?' · '+d.model:''}${d.fallback_used?' · fallback otomatis':''}`);await loadConversations()}catch(e){pending.textContent=`Maaf, pesan belum berhasil diproses: ${e.message}`}finally{sending=false;$('ssSend').disabled=false;input.focus()}}
  function logout(){
    token=null; conversationId=null;
    window.sherlyClearAuthSession?.();
    setProfile(null);
    window.sherlyApplyProfile?.();
    $('ssPassword').value=''; $('ssLoginError').textContent='';
    closeChat();
    if (typeof window.go === 'function') window.go('Beranda');
    if (typeof window.toast === 'function') window.toast('Anda sudah keluar akun.');
  }
  window.sherlyLogout = logout;
  $('ssCloseChatTop').addEventListener('click',closeChat);$('ssCancelLogin').addEventListener('click',()=>$('ssLogin').classList.remove('open'));$('ssLoginForm').addEventListener('submit',login);$('ssChatForm').addEventListener('submit',send);
$('ssChatInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('ssChatForm').requestSubmit()}});
  // Keep the application shell and sidebar visible. Chat occupies only the main workspace.
  document.querySelectorAll('.nav button[data-page]').forEach(b=>b.addEventListener('click',e=>{
    if(b.dataset.page==='Chat Sherly'){
      e.preventDefault();e.stopImmediatePropagation();
      document.querySelectorAll('.nav button').forEach(n=>n.classList.toggle('active',n===b));
      openChat();
    } else {
      closeChat(); // let the existing application navigation handle the selected module
    }
  },true));
  document.querySelectorAll('.panel.chat button.primary').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();document.querySelectorAll('.nav button').forEach(n=>n.classList.toggle('active',n.dataset.page==='Chat Sherly'));openChat()},true));
  setProfile(null);
  window.openSherlyChat=openChat;
  window.sherlyLogout=logout;
})();
