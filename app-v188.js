/* Bingo Beats V188
   - Spotify OAuth wordt maar één keer afgehandeld.
   - Een gekozen Spotify-playlist wordt niet meer teruggezet naar de vorige.
   - De lobby toont na deelname alleen de echte lobby.
   - De mobiele hoststappen houden één vaste schermhoogte.
*/
(function(){
  'use strict';

  const q = id => document.getElementById(id);
  const qa = (selector, root=document) => Array.from(root.querySelectorAll(selector));
  const E = value => {
    try{ return typeof esc === 'function' ? esc(String(value ?? '')) : String(value ?? ''); }
    catch(_error){ return String(value ?? ''); }
  };

  let playlists = [];
  let oauthPromise = null;
  let statusRequest = null;

  function spotifyRedirectUri(){
    let path = location.pathname || '/';
    path = path.replace(/index\.html$/i, '');
    if(!path.endsWith('/')) path += '/';
    return location.origin + path;
  }

  function cookieValue(name){
    const prefix = encodeURIComponent(name) + '=';
    const part = String(document.cookie || '').split(';').map(value=>value.trim()).find(value=>value.startsWith(prefix));
    return part ? decodeURIComponent(part.slice(prefix.length)) : '';
  }

  function storeVerifier(verifier){
    try{ localStorage.setItem('spotify_code_verifier', verifier); }catch(_error){}
    try{ sessionStorage.setItem('spotify_code_verifier', verifier); }catch(_error){}
    try{
      document.cookie = 'spotify_code_verifier=' + encodeURIComponent(verifier) + '; max-age=900; path=/; SameSite=Lax; Secure';
    }catch(_error){}
  }

  function readVerifier(){
    try{
      return localStorage.getItem('spotify_code_verifier') ||
        sessionStorage.getItem('spotify_code_verifier') ||
        cookieValue('spotify_code_verifier') ||
        '';
    }catch(_error){
      return cookieValue('spotify_code_verifier') || '';
    }
  }

  function clearVerifier(){
    try{ localStorage.removeItem('spotify_code_verifier'); }catch(_error){}
    try{ sessionStorage.removeItem('spotify_code_verifier'); }catch(_error){}
    try{ document.cookie = 'spotify_code_verifier=; max-age=0; path=/; SameSite=Lax; Secure'; }catch(_error){}
  }

  function stripSpotifyCallback(){
    const url = new URL(location.href);
    ['code','state','error','error_description'].forEach(key=>url.searchParams.delete(key));
    history.replaceState({}, document.title, url.pathname + (url.search ? url.search : '') + url.hash);
  }

  function setPlaylistStatus(message, success){
    const status = q('playlistStatus');
    if(!status) return;
    status.textContent = message;
    status.classList.toggle('ok', success === true);
    status.classList.toggle('error', success === false);
  }

  function setSpotifyState(loggedIn, label){
    document.body.classList.toggle('bbSpotifyLoggedIn', !!loggedIn);
    document.body.classList.toggle('bbSpotifyLoggedOut', !loggedIn);
    const caption = q('bbSpotifyCaption');
    const status = q('loginStatus');
    if(caption) caption.textContent = loggedIn ? 'Ingelogd als' : 'Spotify-account';
    if(status) status.textContent = label || (loggedIn ? 'Spotify-gebruiker' : 'Nog niet ingelogd.');
    const loadButton = q('loadPlaylistsBtn');
    if(loadButton) loadButton.disabled = !loggedIn;
    const select = q('playlistSelect');
    if(select && !loggedIn) select.disabled = true;
  }

  async function syncSpotifyStatusV188(){
    if(statusRequest) return statusRequest;
    statusRequest = (async()=>{
      try{
        const token = typeof getToken === 'function' ? await getToken() : '';
        if(!token){
          setSpotifyState(false, 'Nog niet ingelogd.');
          return false;
        }
        const me = await api('https://api.spotify.com/v1/me');
        const name = me?.display_name || me?.email || 'Spotify-gebruiker';
        setSpotifyState(true, name);
        return true;
      }catch(error){
        setSpotifyState(false, 'Sessie verlopen. Log opnieuw in.');
        return false;
      }finally{
        statusRequest = null;
      }
    })();
    return statusRequest;
  }

  async function spotifyLoginV188(){
    const verifier = typeof rand === 'function' ? rand(96) : crypto.randomUUID().replaceAll('-','') + crypto.randomUUID().replaceAll('-','');
    storeVerifier(verifier);
    const challenge = typeof b64 === 'function' && typeof sha === 'function'
      ? b64(await sha(verifier))
      : verifier;
    const state = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    try{ sessionStorage.setItem('spotify_oauth_state', state); }catch(_error){}
    const params = new URLSearchParams({
      response_type:'code',
      client_id:CLIENT_ID,
      scope:SCOPES,
      code_challenge_method:'S256',
      code_challenge:challenge,
      redirect_uri:spotifyRedirectUri(),
      state,
      show_dialog:'true'
    });
    location.assign('https://accounts.spotify.com/authorize?' + params.toString());
  }

  async function handleSpotifyRedirectV188(){
    if(oauthPromise) return oauthPromise;
    const callback = new URL(location.href);
    const code = callback.searchParams.get('code');
    const oauthError = callback.searchParams.get('error');
    if(!code && !oauthError) return false;

    oauthPromise = (async()=>{
      if(oauthError){
        const description = callback.searchParams.get('error_description') || oauthError;
        stripSpotifyCallback();
        setSpotifyState(false, 'Inloggen geannuleerd.');
        setPlaylistStatus('Spotify-inloggen is niet afgerond: ' + description, false);
        return false;
      }

      const verifier = readVerifier();
      if(!verifier){
        stripSpotifyCallback();
        setSpotifyState(false, 'Spotify-login niet afgerond.');
        setPlaylistStatus('De beveiligde Spotify-login kon niet worden voltooid. Tik opnieuw op INLOGGEN.', false);
        return false;
      }

      try{
        const response = await fetch('https://accounts.spotify.com/api/token',{
          method:'POST',
          headers:{'Content-Type':'application/x-www-form-urlencoded'},
          body:new URLSearchParams({
            client_id:CLIENT_ID,
            grant_type:'authorization_code',
            code,
            redirect_uri:spotifyRedirectUri(),
            code_verifier:verifier
          })
        });
        const data = await response.json().catch(()=>({}));
        if(!response.ok || !data.access_token){
          const message = data.error_description || data.error || `Spotify-fout ${response.status}`;
          throw new Error(message);
        }
        saveTokens(data);
        clearVerifier();
        stripSpotifyCallback();
        await syncSpotifyStatusV188();
        setPlaylistStatus('Spotify is gekoppeld. Je playlists worden geladen…', true);
        setTimeout(()=>loadPlaylistsV188(), 150);
        return true;
      }catch(error){
        stripSpotifyCallback();
        setSpotifyState(false, 'Spotify-login niet gelukt.');
        setPlaylistStatus('Spotify-login mislukt: ' + (error?.message || 'onbekende fout') + '. Probeer opnieuw.', false);
        return false;
      }
    })();
    return oauthPromise;
  }

  function spotifyLogoutV188(){
    ['spotify_access_token','spotify_refresh_token','spotify_expires_at'].forEach(key=>{
      try{ localStorage.removeItem(key); }catch(_error){}
    });
    try{
      accessToken = '';
      refreshToken = '';
      expiresAt = 0;
      if(player){ player.disconnect(); player = null; }
      deviceId = '';
    }catch(_error){}
    playlists = [];
    const select = q('playlistSelect');
    if(select){
      select.innerHTML = '<option value="">Log eerst in met Spotify</option>';
      select.disabled = true;
    }
    updatePlaylistChoice();
    setSpotifyState(false, 'Nog niet ingelogd.');
    setPlaylistStatus('Log in met Spotify en kies daarna een playlist.', null);
  }

  async function fetchAllPages(url){
    const result = [];
    let next = url;
    while(next){
      const page = await api(next);
      result.push(...(Array.isArray(page?.items) ? page.items : []));
      next = page?.next || '';
    }
    return result;
  }

  function selectedPlaylist(){
    const id = q('playlistSelect')?.value || '';
    return playlists.find(item=>String(item.id)===String(id)) || null;
  }

  function selectedPlaylistCount(){
    const item = selectedPlaylist();
    if(item && Number.isFinite(Number(item.tracks?.total))) return Number(item.tracks.total);
    const text = q('playlistSelect')?.selectedOptions?.[0]?.textContent || '';
    return Number((text.match(/\((\d+)\s+nummers?\)/i)||[])[1] || 0);
  }

  function updatePlaylistChoice(){
    const select = q('playlistSelect');
    const selected = selectedPlaylist();
    const count = selected ? selectedPlaylistCount() : 0;
    const countElement = q('bbPlaylistCountValue');
    if(countElement) countElement.textContent = `${count} ${count===1?'nummer':'nummers'}`;
    const importButton = q('importPlaylistBtn');
    if(importButton) importButton.disabled = !selected;
  }

  async function loadPlaylistsV188(){
    const select = q('playlistSelect');
    const loadButton = q('loadPlaylistsBtn');
    try{
      const loggedIn = await syncSpotifyStatusV188();
      if(!loggedIn){
        setPlaylistStatus('Log eerst in met Spotify om je playlists te laden.', false);
        return;
      }
      if(loadButton){
        loadButton.disabled = true;
        loadButton.textContent = 'LADEN…';
      }
      setPlaylistStatus('Je Spotify-playlists worden geladen…', null);
      playlists = (await fetchAllPages('https://api.spotify.com/v1/me/playlists?limit=50'))
        .filter(item=>item?.id);
      const imported = (()=>{ try{ return JSON.parse(localStorage.getItem('bb_imported_playlist')||'null'); }catch(_error){ return null; } })();
      if(select){
        const options = ['<option value="">Kies een playlist</option>'].concat(playlists.map(item=>{
          const total = Number(item.tracks?.total)||0;
          return `<option value="${E(item.id)}">${E(item.name || 'Naamloze playlist')} (${total} nummers)</option>`;
        }));
        select.innerHTML = options.join('');
        select.disabled = playlists.length===0;
        if(imported?.id && playlists.some(item=>String(item.id)===String(imported.id))){
          select.value = String(imported.id);
        }
      }
      updatePlaylistChoice();
      if(playlists.length){
        setPlaylistStatus(`${playlists.length} playlists gevonden. Kies er één en tik daarna op IMPORTEREN.`, true);
      }else{
        setPlaylistStatus('Er zijn geen playlists gevonden in dit Spotify-account.', false);
      }
    }catch(error){
      playlists = [];
      if(select){
        select.innerHTML = '<option value="">Playlists laden mislukt</option>';
        select.disabled = true;
      }
      setPlaylistStatus('Playlists laden mislukt: ' + (error?.message || 'onbekende fout') + '.', false);
    }finally{
      if(loadButton){
        loadButton.disabled = !document.body.classList.contains('bbSpotifyLoggedIn');
        loadButton.textContent = playlists.length ? 'VERVERSEN' : 'LADEN';
      }
    }
  }

  function deepTrack(value, depth=0, seen=new Set()){
    if(!value || typeof value!=='object' || depth>6 || seen.has(value)) return null;
    seen.add(value);
    if(value.id && (String(value.uri||'').startsWith('spotify:track:') || value.type==='track')) return value;
    for(const candidate of [value.track,value.item]){
      const found = deepTrack(candidate, depth+1, seen);
      if(found) return found;
    }
    for(const child of Object.values(value)){
      if(!child || typeof child!=='object') continue;
      if(Array.isArray(child)){
        for(const item of child){
          const found = deepTrack(item, depth+1, seen);
          if(found) return found;
        }
      }else{
        const found = deepTrack(child, depth+1, seen);
        if(found) return found;
      }
    }
    return null;
  }

  function toGameTrack(row){
    const track = deepTrack(row);
    if(!track?.id || track.is_local || row?.is_local) return null;
    const artists = Array.isArray(track.artists)
      ? track.artists.map(artist=>artist?.name).filter(Boolean).join(', ')
      : String(track.artists || track.artist || '');
    return {
      id:track.id,
      uri:track.uri || `spotify:track:${track.id}`,
      name:track.name || 'Onbekend',
      artists:artists || 'Onbekend',
      album:track.album?.name || '',
      release_date:track.album?.release_date || '',
      duration_ms:Number(track.duration_ms)||180000
    };
  }

  async function importPlaylistV188(){
    const playlist = selectedPlaylist();
    const button = q('importPlaylistBtn');
    if(!playlist){
      setPlaylistStatus('Kies eerst een playlist.', false);
      return;
    }
    try{
      if(button){
        button.disabled = true;
        button.textContent = 'IMPORTEREN…';
      }
      setPlaylistStatus(`“${playlist.name || 'Playlist'}” wordt geïmporteerd…`, null);
      const id = encodeURIComponent(playlist.id);
      let rows = [];
      let lastError = null;
      const urls = [
        `https://api.spotify.com/v1/playlists/${id}/items?limit=50&market=NL`,
        playlist.tracks?.href,
        `https://api.spotify.com/v1/playlists/${id}/tracks?limit=100`
      ].filter(Boolean);
      for(const url of urls){
        try{
          rows = await fetchAllPages(url);
          if(rows.length) break;
        }catch(error){
          lastError = error;
        }
      }
      const seen = new Set();
      const importedTracks = [];
      rows.forEach(row=>{
        const track = toGameTrack(row);
        if(!track || seen.has(track.id)) return;
        seen.add(track.id);
        importedTracks.push(track);
      });
      if(!importedTracks.length) throw lastError || new Error('geen afspeelbare nummers gevonden');

      tracks = importedTracks;
      localStorage.setItem('hb_playlist_tracks', JSON.stringify(importedTracks));
      localStorage.removeItem('hb_used');
      localStorage.setItem('bb_imported_playlist', JSON.stringify({
        id:playlist.id,
        name:playlist.name || 'Playlist',
        count:importedTracks.length,
        importedAt:new Date().toISOString()
      }));

      const countElement = q('bbPlaylistCountValue');
      if(countElement) countElement.textContent = `${importedTracks.length} nummers`;
      const preview = q('playlistPreview');
      if(preview){
        preview.classList.remove('hidden');
        preview.innerHTML = `<strong>${E(playlist.name || 'Playlist')}</strong><span>${importedTracks.length} nummers klaar</span>`;
      }

      setPlaylistStatus(`${importedTracks.length} nummers geïmporteerd. Spotify-speler wordt geactiveerd…`, true);
      let active = !!deviceId;
      try{
        if(!active && typeof activatePlayer === 'function') await activatePlayer();
        const started = Date.now();
        while(!deviceId && Date.now()-started < 7500){
          await new Promise(resolve=>setTimeout(resolve,150));
        }
        active = !!deviceId;
      }catch(_error){}
      setPlaylistStatus(
        active
          ? `Klaar: “${playlist.name || 'Playlist'}” is geïmporteerd en Spotify is actief.`
          : `“${playlist.name || 'Playlist'}” is geïmporteerd. Open Spotify op dit apparaat vóór de geluidstest.`,
        active
      );
      window.dispatchEvent(new CustomEvent('bb:playlist-imported',{
        detail:{id:playlist.id,name:playlist.name,count:importedTracks.length,spotifyActive:active}
      }));
    }catch(error){
      setPlaylistStatus('Importeren mislukt: ' + (error?.message || 'onbekende fout') + '.', false);
    }finally{
      if(button){
        button.textContent = 'IMPORTEREN';
        button.disabled = !selectedPlaylist();
      }
    }
  }

  function renderRoomBoxV188(code){
    const box = q('roomBox');
    if(!code || !box) return;
    const base = location.origin + location.pathname.replace(/index\.html$/i,'');
    const link = base + (base.includes('?') ? '&' : '?') + 'room=' + encodeURIComponent(code);
    box.classList.remove('hidden');
    box.innerHTML = `<div class="bbV188RoomShare">
      <img class="bbV188Qr" alt="QR-code voor kamer ${E(code)}" src="${qrUrl(link)}">
      <div class="bbV188RoomDetails">
        <span>SPELCODE</span>
        <strong>${E(code)}</strong>
        <label for="joinLink">DEEL DE LINK</label>
        <input id="joinLink" readonly value="${E(link)}">
        <button id="copyRoomLinkBtn" type="button" class="copyRoomLinkBtn">KOPIEER LINK</button>
      </div>
    </div>`;
  }

  async function createRoomWithHostV188(){
    if(!db) throw new Error('De kamerverbinding is nog niet klaar.');
    const code = typeof roomCode === 'function' ? roomCode() : Math.random().toString(36).slice(2,6).toUpperCase();
    currentRoomCode = code;
    await db.ref('rooms/'+code).set({
      createdAt:firebase.database.ServerValue.TIMESTAMP,
      categories:typeof getCats==='function' ? getCats() : {}
    });
    localStorage.setItem('hb_host_room',code);
    localStorage.setItem('hb_last_stable_room',code);
    renderRoomBoxV188(code);
    if(typeof listenHost==='function') listenHost(code);
    if(typeof listenBingo==='function') listenBingo(code);
    if(typeof window.bbEnsureHostPlayer==='function') await window.bbEnsureHostPlayer(code);
    if(typeof window.bbHostWizardSetStep==='function') window.bbHostWizardSetStep(2,false);
    return code;
  }

  function currentHostStep(){
    return Number(document.querySelector('[data-host-step-panel].active')?.dataset.hostStepPanel || 1);
  }

  function syncScreenState(){
    const host = q('hostApp');
    const hostVisible = !!host && !host.classList.contains('hidden') &&
      !document.body.classList.contains('playerMode') &&
      !document.body.classList.contains('bbHostPlayerMode');
    const step = currentHostStep();
    document.body.classList.toggle('bbHostWizardOpen', hostVisible);
    document.body.classList.toggle('bbHostMusicStep', hostVisible && step===1);
    document.body.dataset.bbHostStep = hostVisible ? String(step) : '';

    const dashboard = q('screenDashboard');
    const joined = !!dashboard && !dashboard.classList.contains('hidden');
    document.body.classList.toggle('bbPlayerJoined', joined);
    if(joined) q('screenJoin')?.classList.add('hidden');

    const activePlayers = q('bbMusicActivePlayers');
    if(activePlayers){
      const count = qa('#hostPlayers .bbV160HostChip,#hostPlayers .playerRow').length;
      const headerCount = Number((q('bbHostHeaderPlayers')?.textContent?.match(/\d+/)||[])[0]||0);
      activePlayers.textContent = String(Math.max(count,headerCount));
    }
  }

  function playerEntries(room){
    return Object.entries(room?.players || {}).sort((a,b)=>String(a[1]?.name||'').localeCompare(String(b[1]?.name||''),'nl'));
  }

  function lobbyCard(card, marked){
    const colors = {yellow:'#ffcc33',pink:'#00d4c7',purple:'#ff8a1f',blue:'#7ed957',green:'#ff5a5f',free:'#152015'};
    return `<div class="bbV188LobbyCard">${(Array.isArray(card)?card:[]).map((color,index)=>{
      const isMarked = !!marked?.[index] || color==='free';
      return `<span class="${isMarked?'marked':''}" style="--cell:${colors[color]||'#273127'}">${isMarked?'✓':''}</span>`;
    }).join('')}</div>`;
  }

  function renderLobbyV188(room, round){
    const root = q('screenDashboard');
    if(!root) return;
    const me = room?.players?.[currentPlayerId] || {};
    const entries = playerEntries(room);
    const ready = entries.filter(([,player])=>player?.ready).length;
    const next = !!round?.id;
    root.className = 'compactDashboard bbV188Lobby';
    root.innerHTML = `
      <section class="bbV188LobbyHero">
        <img src="bb_logo_lime.webp" alt="">
        <div><h2>${next?'Klaar voor de volgende?':'Wachten op de host'}</h2><p>${next?'Tik op READY voor de volgende ronde.':'Iedereen klaar? Dan kan de ronde starten.'}</p></div>
      </section>
      <section class="bbV188LobbyPlayers">
        <div class="bbV188ReadyCount"><span>SPELERS</span><strong>${ready} / ${entries.length} READY</strong></div>
        <div class="bbV188PlayerList">${entries.map(([id,player])=>`
          <div class="bbV188Player ${player?.ready?'ready':'wait'}">
            <span class="bbV188Avatar">${typeof bbAnimalFor==='function'?bbAnimalFor(id,player):'🎵'}</span>
            <b>${E(String(player?.name||'Speler').replace(/^🎤\s*/,''))}${id===currentPlayerId?' <small>JIJ</small>':''}${player?.isHost?' <em>HOST</em>':''}</b>
            <i>${player?.ready?'READY ✓':'WACHT'}</i>
          </div>`).join('') || '<p>Nog geen spelers.</p>'}</div>
      </section>
      <section class="bbV188LobbyOwn">
        <strong>JOUW BINGOKAART</strong>
        ${lobbyCard(me.card,me.marked||{})}
      </section>
      <button type="button" class="bbV188ReadyButton ${me.ready?'isReady':''}" ${me.ready?'disabled':''} onclick="bbV188Ready()">${me.ready?'READY ✓':'READY'}</button>`;
    q('screenJoin')?.classList.add('hidden');
    root.classList.remove('hidden');
    document.body.classList.add('bbPlayerJoined');
  }

  window.bbV188Ready = function(){
    try{
      if(currentRoomCode && currentPlayerId){
        db.ref(`rooms/${currentRoomCode}/players/${currentPlayerId}/ready`).set(true);
      }
    }catch(_error){}
  };

  function installLobbyRenderer(){
    if(typeof renderCompactDashboard !== 'function' || window.__bbV188LobbyWrapped) return;
    window.__bbV188LobbyWrapped = true;
    const previous = renderCompactDashboard;
    renderCompactDashboard = function(room, round){
      const status = String(round?.status||'').toLowerCase();
      const lobby = !round?.id || ['judged','finished','complete','results','ended'].includes(status);
      if(lobby){
        renderLobbyV188(room||{},round||{});
        return;
      }
      const result = previous.apply(this,arguments);
      syncScreenState();
      return result;
    };
  }

  function wireMusicControls(){
    q('playlistSelect')?.addEventListener('change',updatePlaylistChoice);
    document.addEventListener('click',event=>{
      const button = event.target?.closest?.('#loadPlaylistsBtn,#importPlaylistBtn,#newRoomBtn');
      if(!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if(button.id==='loadPlaylistsBtn') loadPlaylistsV188();
      else if(button.id==='importPlaylistBtn') importPlaylistV188();
      else{
        button.disabled = true;
        createRoomWithHostV188()
          .catch(error=>alert('Nieuwe kamer maken mislukt: '+(error?.message||error)))
          .finally(()=>{ button.disabled=false; });
      }
    },true);
  }

  function observeScreens(){
    const observer = new MutationObserver(syncScreenState);
    [document.body,q('hostApp'),q('playerApp'),q('screenJoin'),q('screenDashboard'),q('hostPlayers'),q('bbHostHeaderPlayers')]
      .filter(Boolean)
      .forEach(element=>observer.observe(element,{attributes:true,childList:true,subtree:true,attributeFilter:['class']}));
  }

  function initV188(){
    document.documentElement.classList.add('bbV188');
    installLobbyRenderer();
    wireMusicControls();
    observeScreens();
    syncScreenState();
    updatePlaylistChoice();
    syncSpotifyStatusV188().then(loggedIn=>{
      const select = q('playlistSelect');
      const onlyPlaceholder = !select || !Array.from(select.options).some(option=>option.value);
      if(loggedIn && onlyPlaceholder) loadPlaylistsV188();
    });
    try{
      if(document.body.classList.contains('playerMode') && db && currentRoomCode && currentPlayerId){
        db.ref('rooms/'+currentRoomCode).once('value').then(snapshot=>{
          const room = snapshot.val() || {};
          const round = room.currentRound || {};
          const status = String(round.status||'').toLowerCase();
          if(!round.id || ['judged','finished','complete','results','ended'].includes(status)){
            renderLobbyV188(room,round);
          }
        });
      }
    }catch(_error){}
  }

  /* De hoofdcode koppelt deze functies pas bij DOMContentLoaded. Door ze hier
     te vervangen gebruikt de bestaande app meteen de V188-versies. */
  try{ login = spotifyLoginV188; }catch(_error){}
  try{ logout = spotifyLogoutV188; }catch(_error){}
  try{ handleRedirect = handleSpotifyRedirectV188; }catch(_error){}
  try{ updateStatus = syncSpotifyStatusV188; }catch(_error){}
  try{ renderRoomBox = renderRoomBoxV188; }catch(_error){}
  try{ createRoomWithHost = createRoomWithHostV188; }catch(_error){}
  window.bbCreateRoomWithHost = createRoomWithHostV188;

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',initV188,{once:true});
  }else{
    initV188();
  }
})();
