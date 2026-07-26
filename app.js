/* Bingo Beats Clean V204
   Eén applicatiebestand: Spotify, Firebase, hoststappen en spelersscherm. */
(() => {
  'use strict';

  const CLIENT_ID = '4765b89201b44558a7d5141f9b93c178';
  const SCOPES = [
    'streaming',
    'user-read-email',
    'user-read-private',
    'user-read-playback-state',
    'user-modify-playback-state',
    'playlist-read-private',
    'playlist-read-collaborative'
  ].join(' ');
  const FIREBASE_CONFIG = {
    apiKey:'AIzaSyCcquz1mpz3FsmFFBKgJLgpbkHCajTUpzY',
    authDomain:'hitster-bingo-cb792.firebaseapp.com',
    databaseURL:'https://hitster-bingo-cb792-default-rtdb.europe-west1.firebasedatabase.app',
    projectId:'hitster-bingo-cb792',
    storageBucket:'hitster-bingo-cb792.firebasestorage.app',
    messagingSenderId:'98696776977',
    appId:'1:98696776977:web:e797e555e2d9b38bcc99b0'
  };
  const COLORS = [
    {key:'yellow',name:'GOUD',hex:'#ffcc33',category:'Voor of na 2001'},
    {key:'pink',name:'AQUA',hex:'#28d7e8',category:'Naam van artiest'},
    {key:'purple',name:'ORANJE',hex:'#ff8a1f',category:'Decennium'},
    {key:'blue',name:'LIME',hex:'#93f500',category:'Jaartal ± 2'},
    {key:'green',name:'KORAAL',hex:'#ff6173',category:'Titel van track'}
  ];
  const ANIMALS = ['🦁','🐯','🐼','🦊','🐨','🐸','🐵','🦄','🐙','🦋','🐧','🦉','🐬','🦖','🐝','🐢','🦜','🐺','🦩','🐳','🦔','🐿️','🦦','🐮','🐷','🐰','🐱','🐶','🐹','🐻'];
  const $ = id => document.getElementById(id);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  })[char]);
  const wait = milliseconds => new Promise(resolve => setTimeout(resolve,milliseconds));

  const state = {
    db:null,
    roomRef:null,
    roomCode:'',
    room:null,
    hostPlayerId:localStorage.getItem('bb_host_player_id') || '',
    playerId:localStorage.getItem('hb_player_id') || '',
    playerName:localStorage.getItem('hb_player_name') || '',
    currentStep:1,
    spotifyToken:localStorage.getItem('spotify_access_token') || '',
    spotifyRefreshToken:localStorage.getItem('spotify_refresh_token') || '',
    spotifyExpiresAt:Number(localStorage.getItem('spotify_expires_at') || 0),
    spotifyPlayer:null,
    spotifyDeviceId:'',
    spotifyProfile:null,
    playlists:[],
    selectedPlaylist:null,
    tracks:readJson('hb_playlist_tracks',[]),
    currentTrack:null,
    timer:null,
    stopTimer:null,
    lastPlayerRender:'',
    winnerKey:localStorage.getItem('bb_last_winner_key') || ''
  };

  function readJson(key,fallback){
    try{
      const value = JSON.parse(localStorage.getItem(key) || '');
      return value ?? fallback;
    }catch(_error){
      localStorage.removeItem(key);
      return fallback;
    }
  }

  function isPlayerPage(){
    return !!new URLSearchParams(location.search).get('room');
  }

  function redirectUri(){
    return new URL('./',location.href).href.split('#')[0].split('?')[0];
  }

  function roomFromUrl(){
    return (new URLSearchParams(location.search).get('room') || '').toUpperCase();
  }

  function randomItem(items){
    return items[Math.floor(Math.random()*items.length)];
  }

  function playerAnimal(id,player){
    if(player?.emoji) return player.emoji;
    let hash = 2166136261;
    for(const character of String(id || 'speler')){
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash,16777619);
    }
    return ANIMALS[(hash>>>0)%ANIMALS.length];
  }

  function activePlayers(room=state.room){
    return Object.entries(room?.players || {}).filter(([,player]) => player && player.online !== false);
  }

  function updatePlayerCounts(room=state.room){
    const count = activePlayers(room).length;
    $$('[data-player-count]').forEach(element => {
      element.textContent = String(count);
    });
  }

  function setStatus(id,message,type=''){
    const element = $(id);
    if(!element) return;
    element.textContent = message;
    element.classList.toggle('ok',type==='ok');
    element.classList.toggle('error',type==='error');
  }

  function setStep(step){
    const requested = Math.max(1,Math.min(4,Number(step)||1));
    state.currentStep = requested;
    $$('.hostStep').forEach(panel => {
      panel.classList.toggle('active',Number(panel.dataset.step)===requested);
    });
    $$('[data-step-target]').forEach(node => {
      const nodeStep = Number(node.dataset.stepTarget);
      node.classList.toggle('active',nodeStep===requested);
      node.classList.toggle('complete',nodeStep<requested);
      if(nodeStep===requested) node.setAttribute('aria-current','step');
      else node.removeAttribute('aria-current');
    });
    if(requested===2) ensureRoom().catch(showRoomError);
    if(requested===4) renderHost(state.room);
  }

  function bindInterface(){
    $$('[data-go]').forEach(button => {
      button.addEventListener('click',() => setStep(button.dataset.go));
    });
    $$('[data-duration]').forEach(button => {
      button.addEventListener('click',() => {
        $$('[data-duration]').forEach(choice => choice.classList.toggle('active',choice===button));
        localStorage.setItem('bb_duration',button.dataset.duration);
      });
    });
    const savedDuration = localStorage.getItem('bb_duration') || '20';
    const savedDurationButton = document.querySelector(`[data-duration="${savedDuration}"]`);
    if(savedDurationButton) savedDurationButton.click();

    $('spotifyButton')?.addEventListener('click',() => {
      if(state.spotifyProfile) spotifyLogout();
      else spotifyLogin();
    });
    $('choosePlaylistButton')?.addEventListener('click',openPlaylistPicker);
    $('importPlaylistButton')?.addEventListener('click',importSelectedPlaylist);
    $('newRoomButton')?.addEventListener('click',() => createRoom(true).catch(showRoomError));
    $('copyLinkButton')?.addEventListener('click',copyRoomLink);
    $('hostNameInput')?.addEventListener('change',saveHostName);
    $('joinButton')?.addEventListener('click',joinRoom);
    $('playerNameInput')?.addEventListener('keydown',event => {
      if(event.key==='Enter') event.preventDefault();
    });
    $('soundTestButton')?.addEventListener('click',runSoundTest);
    $('hostReadyButton')?.addEventListener('click',markHostReady);
    $('startRoundButton')?.addEventListener('click',startRound);
    $('playTrackButton')?.addEventListener('click',playRoundTrack);
    $('stopTrackButton')?.addEventListener('click',stopSpotify);
    $('showAnswerButton')?.addEventListener('click',lockAndJudgeRound);
    $('hostAnswerButton')?.addEventListener('click',submitHostAnswer);
    $('hostAnswerInput')?.addEventListener('keydown',event => {
      if(event.key==='Enter') event.preventDefault();
    });
    $('publishResultsButton')?.addEventListener('click',publishResults);
    $('hostScoreboard')?.addEventListener('click',handleHostJudgement);
    $('hostBingoCard')?.addEventListener('click',handleHostCardPick);
    $$('[data-close-modal]').forEach(button => {
      button.addEventListener('click',() => $(button.dataset.closeModal)?.classList.add('hidden'));
    });
    $('playlistModal')?.addEventListener('click',event => {
      if(event.target===event.currentTarget) event.currentTarget.classList.add('hidden');
    });
    document.addEventListener('visibilitychange',() => {
      if(!document.hidden && state.roomCode && currentUserId()){
        state.db.ref(`rooms/${state.roomCode}/players/${currentUserId()}`).update({
          online:true,lastSeen:firebase.database.ServerValue.TIMESTAMP
        }).catch(()=>{});
      }
    });
  }

  async function init(){
    bindInterface();
    setStep(1);
    registerWorker();
    if(!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    state.db = firebase.database();

    if(isPlayerPage()){
      $('playerApp').classList.remove('hidden');
      $('hostApp').classList.add('hidden');
      state.roomCode = roomFromUrl();
      $('joinRoomCode').textContent = state.roomCode || '----';
      $('playerNameInput').value = state.playerName;
      await preparePlayerJoin();
      return;
    }

    $('hostApp').classList.remove('hidden');
    $('playerApp').classList.add('hidden');
    $('hostNameInput').value = localStorage.getItem('bb_host_name') || 'Georgio';
    await handleSpotifyCallback();
    await syncSpotify();
    updatePreflightChecks();
    await restoreRoom();
    setStep(1);
  }

  /* Spotify */
  function randomVerifier(length=96){
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes,byte => chars[byte%chars.length]).join('');
  }

  async function sha256(value){
    return crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  }

  function base64Url(buffer){
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
      .replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  }

  async function spotifyLogin(){
    try{
      const verifier = randomVerifier();
      const oauthState = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      localStorage.setItem('spotify_code_verifier',verifier);
      sessionStorage.setItem('spotify_oauth_state',oauthState);
      const parameters = new URLSearchParams({
        response_type:'code',
        client_id:CLIENT_ID,
        scope:SCOPES,
        code_challenge_method:'S256',
        code_challenge:base64Url(await sha256(verifier)),
        redirect_uri:redirectUri(),
        state:oauthState,
        show_dialog:'true'
      });
      location.assign(`https://accounts.spotify.com/authorize?${parameters}`);
    }catch(error){
      setStatus('musicStatus',`Spotify-inloggen kon niet starten: ${error.message}`,'error');
    }
  }

  async function handleSpotifyCallback(){
    const url = new URL(location.href);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    if(!code && !error) return;

    const cleanUrl = new URL(redirectUri());
    const cleanCallback = () => history.replaceState({},document.title,cleanUrl.pathname);
    if(error){
      cleanCallback();
      setStatus('musicStatus','Spotify-inloggen is geannuleerd.','error');
      return;
    }

    const expectedState = sessionStorage.getItem('spotify_oauth_state') || '';
    const returnedState = url.searchParams.get('state') || '';
    const verifier = localStorage.getItem('spotify_code_verifier') || '';
    if(!verifier || (expectedState && returnedState!==expectedState)){
      cleanCallback();
      setStatus('musicStatus','De Spotify-login kon niet veilig worden afgerond. Tik opnieuw op INLOGGEN.','error');
      return;
    }

    try{
      const response = await fetch('https://accounts.spotify.com/api/token',{
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({
          client_id:CLIENT_ID,
          grant_type:'authorization_code',
          code,
          redirect_uri:redirectUri(),
          code_verifier:verifier
        })
      });
      const data = await response.json().catch(()=>({}));
      if(!response.ok || !data.access_token){
        throw new Error(data.error_description || data.error || `Spotify-fout ${response.status}`);
      }
      saveSpotifyTokens(data);
      setStatus('musicStatus','Spotify is gekoppeld. Je playlists worden geladen…','ok');
    }catch(callbackError){
      setStatus('musicStatus',`Spotify-login mislukt: ${callbackError.message}`,'error');
    }finally{
      localStorage.removeItem('spotify_code_verifier');
      sessionStorage.removeItem('spotify_oauth_state');
      cleanCallback();
    }
  }

  function saveSpotifyTokens(data){
    state.spotifyToken = data.access_token || state.spotifyToken;
    state.spotifyRefreshToken = data.refresh_token || state.spotifyRefreshToken;
    state.spotifyExpiresAt = Date.now() + Number(data.expires_in || 3600)*1000 - 60000;
    localStorage.setItem('spotify_access_token',state.spotifyToken);
    if(state.spotifyRefreshToken) localStorage.setItem('spotify_refresh_token',state.spotifyRefreshToken);
    localStorage.setItem('spotify_expires_at',String(state.spotifyExpiresAt));
  }

  async function getSpotifyToken(){
    if(state.spotifyToken && Date.now()<state.spotifyExpiresAt) return state.spotifyToken;
    if(!state.spotifyRefreshToken) return '';
    const response = await fetch('https://accounts.spotify.com/api/token',{
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({
        grant_type:'refresh_token',
        refresh_token:state.spotifyRefreshToken,
        client_id:CLIENT_ID
      })
    });
    const data = await response.json().catch(()=>({}));
    if(!response.ok || !data.access_token){
      spotifyLogout(false);
      return '';
    }
    saveSpotifyTokens(data);
    return state.spotifyToken;
  }

  async function spotifyApi(url,options={}){
    const token = await getSpotifyToken();
    if(!token) throw new Error('Log eerst in met Spotify.');
    const headers = {...(options.headers||{}),Authorization:`Bearer ${token}`};
    if(options.body) headers['Content-Type'] = 'application/json';
    const response = await fetch(url,{...options,headers});
    if(response.status===204) return {};
    const data = await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.error?.message || data.error_description || `Spotify-fout ${response.status}`);
    return data;
  }

  async function syncSpotify(){
    try{
      const token = await getSpotifyToken();
      if(!token) throw new Error('Niet ingelogd');
      state.spotifyProfile = await spotifyApi('https://api.spotify.com/v1/me');
      $('spotifyCaption').textContent = 'Ingelogd als';
      $('spotifyName').textContent = state.spotifyProfile.display_name || state.spotifyProfile.email || 'Spotify-gebruiker';
      $('spotifyButton').textContent = 'UITLOGGEN';
      $('choosePlaylistButton').disabled = false;
      setStatus('musicStatus','Spotify is verbonden. Kies nu een playlist.','ok');
      await loadSpotifyPlaylists();
    }catch(_error){
      state.spotifyProfile = null;
      $('spotifyCaption').textContent = 'Spotify-account';
      $('spotifyName').textContent = 'Nog niet ingelogd';
      $('spotifyButton').textContent = 'INLOGGEN';
      $('choosePlaylistButton').disabled = true;
      $('importPlaylistButton').disabled = true;
      if(!state.tracks.length) setStatus('musicStatus','Log in met Spotify en kies daarna een playlist.');
    }finally{
      updatePreflightChecks();
    }
  }

  function spotifyLogout(update=true){
    ['spotify_access_token','spotify_refresh_token','spotify_expires_at'].forEach(key => localStorage.removeItem(key));
    state.spotifyToken = '';
    state.spotifyRefreshToken = '';
    state.spotifyExpiresAt = 0;
    state.spotifyProfile = null;
    state.playlists = [];
    state.selectedPlaylist = null;
    if(state.spotifyPlayer){
      state.spotifyPlayer.disconnect();
      state.spotifyPlayer = null;
      state.spotifyDeviceId = '';
    }
    if(update) syncSpotify();
    updatePreflightChecks();
  }

  async function fetchAllSpotifyPages(url){
    const items = [];
    let next = url;
    while(next){
      const page = await spotifyApi(next);
      items.push(...(Array.isArray(page.items) ? page.items : []));
      next = page.next || '';
    }
    return items;
  }

  async function loadSpotifyPlaylists(){
    try{
      state.playlists = (await fetchAllSpotifyPages('https://api.spotify.com/v1/me/playlists?limit=50'))
        .filter(item => item?.id);
      const saved = readJson('bb_imported_playlist',null);
      if(saved?.id){
        state.selectedPlaylist = state.playlists.find(item => item.id===saved.id) || null;
      }
      renderPlaylistSelection();
      setStatus(
        'musicStatus',
        state.playlists.length ? `${state.playlists.length} playlists gevonden. Tik op KIES.` : 'Geen Spotify-playlists gevonden.',
        state.playlists.length ? 'ok' : 'error'
      );
    }catch(error){
      state.playlists = [];
      renderPlaylistSelection();
      setStatus('musicStatus',`Playlists laden mislukt: ${error.message}`,'error');
    }
  }

  function renderPlaylistSelection(){
    const selected = state.selectedPlaylist;
    $('playlistName').textContent = selected?.name || 'Nog geen playlist gekozen';
    const saved = readJson('bb_imported_playlist',null);
    const count = selected?.tracks?.total ?? (saved?.id===selected?.id ? saved.count : 0) ?? 0;
    $('playlistCount').textContent = `${count} ${Number(count)===1?'nummer':'nummers'}`;
    $('importPlaylistButton').disabled = !selected;
    updatePreflightChecks();
  }

  async function openPlaylistPicker(){
    if(!state.spotifyProfile){
      setStatus('musicStatus','Log eerst in met Spotify.','error');
      return;
    }
    if(!state.playlists.length) await loadSpotifyPlaylists();
    const root = $('playlistOptions');
    if(!state.playlists.length){
      root.innerHTML = '<p class="playlistEmpty">Geen playlists gevonden.</p>';
    }else{
      root.innerHTML = state.playlists.map(item => {
        const active = item.id===state.selectedPlaylist?.id;
        const count = Number(item.tracks?.total)||0;
        return `<button type="button" class="playlistChoice ${active?'active':''}" data-playlist="${escapeHtml(item.id)}">
          <span><strong>${escapeHtml(item.name || 'Naamloze playlist')}</strong><small>${count} ${count===1?'nummer':'nummers'}</small></span>
          <b>${active?'✓':'›'}</b>
        </button>`;
      }).join('');
      root.querySelectorAll('[data-playlist]').forEach(button => {
        button.addEventListener('click',() => {
          state.selectedPlaylist = state.playlists.find(item => item.id===button.dataset.playlist) || null;
          sessionStorage.removeItem('bb_sound_test_ok');
          renderPlaylistSelection();
          $('playlistModal').classList.add('hidden');
          setStatus('musicStatus','Playlist gekozen. Tik nu op IMPORTEREN.','ok');
        });
      });
    }
    $('playlistModal').classList.remove('hidden');
  }

  function findSpotifyTrack(value,depth=0){
    if(!value || typeof value!=='object' || depth>5) return null;
    if(value.id && (value.type==='track' || String(value.uri||'').startsWith('spotify:track:'))) return value;
    for(const candidate of [value.track,value.item]){
      const found = findSpotifyTrack(candidate,depth+1);
      if(found) return found;
    }
    return null;
  }

  function gameTrack(row){
    const track = findSpotifyTrack(row);
    if(!track?.id || track.is_local || row?.is_local) return null;
    return {
      id:track.id,
      uri:track.uri || `spotify:track:${track.id}`,
      name:track.name || 'Onbekend',
      artists:(track.artists || []).map(artist => artist?.name).filter(Boolean).join(', ') || 'Onbekend',
      album:track.album?.name || '',
      release_date:track.album?.release_date || '',
      duration_ms:Number(track.duration_ms)||180000
    };
  }

  async function importSelectedPlaylist(){
    const playlist = state.selectedPlaylist;
    if(!playlist) return setStatus('musicStatus','Kies eerst een playlist.','error');
    const button = $('importPlaylistButton');
    button.disabled = true;
    button.textContent = 'BEZIG…';
    try{
      setStatus('musicStatus',`“${playlist.name}” wordt geïmporteerd…`);
      const rows = await fetchAllSpotifyPages(
        `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlist.id)}/items?limit=50&market=NL`
      );
      const seen = new Set();
      state.tracks = rows.map(gameTrack).filter(track => {
        if(!track || seen.has(track.id)) return false;
        seen.add(track.id);
        return true;
      });
      if(!state.tracks.length) throw new Error('geen afspeelbare nummers gevonden');
      localStorage.setItem('hb_playlist_tracks',JSON.stringify(state.tracks));
      localStorage.removeItem('hb_used');
      localStorage.setItem('bb_imported_playlist',JSON.stringify({
        id:playlist.id,name:playlist.name,count:state.tracks.length,importedAt:new Date().toISOString()
      }));
      $('playlistCount').textContent = `${state.tracks.length} nummers`;
      sessionStorage.removeItem('bb_sound_test_ok');
      setStatus('musicStatus',`${state.tracks.length} nummers geïmporteerd. Klaar voor de kamer.`,'ok');
      await ensureSpotifyPlayer().catch(()=>{});
      renderHost(state.room);
    }catch(error){
      setStatus('musicStatus',`Importeren mislukt: ${error.message}`,'error');
    }finally{
      button.textContent = 'IMPORTEREN';
      button.disabled = !state.selectedPlaylist;
      updatePreflightChecks();
    }
  }

  function updatePreflightChecks(){
    const imported = readJson('bb_imported_playlist',null);
    const checks = {
      spotify:!!state.spotifyProfile,
      playlist:!!state.selectedPlaylist,
      import:!!state.selectedPlaylist && imported?.id===state.selectedPlaylist.id && state.tracks.length>0,
      test:sessionStorage.getItem('bb_sound_test_ok')==='1'
    };
    $$('[data-preflight]').forEach(item => {
      const done = !!checks[item.dataset.preflight];
      item.classList.toggle('done',done);
      const checkbox = item.querySelector('input[type="checkbox"]');
      if(checkbox) checkbox.checked = done;
    });
  }

  window.onSpotifyWebPlaybackSDKReady = () => {};

  async function ensureSpotifyPlayer(){
    const token = await getSpotifyToken();
    if(!token) throw new Error('Log eerst in met Spotify.');
    for(let attempt=0;attempt<40 && !window.Spotify;attempt++) await wait(100);
    if(!window.Spotify) throw new Error('De Spotify-speler is nog niet geladen.');
    if(state.spotifyPlayer && state.spotifyDeviceId) return state.spotifyDeviceId;
    if(!state.spotifyPlayer){
      state.spotifyPlayer = new Spotify.Player({
        name:'Bingo Beats',
        getOAuthToken:async callback => callback(await getSpotifyToken()),
        volume:.8
      });
      state.spotifyPlayer.addListener('ready',({device_id}) => {
        state.spotifyDeviceId = device_id;
      });
      state.spotifyPlayer.addListener('not_ready',() => {
        state.spotifyDeviceId = '';
      });
      state.spotifyPlayer.addListener('authentication_error',({message}) => {
        setStatus('musicStatus',`Spotify-speler: ${message}`,'error');
      });
      await state.spotifyPlayer.connect();
    }
    for(let attempt=0;attempt<60 && !state.spotifyDeviceId;attempt++) await wait(100);
    if(!state.spotifyDeviceId) throw new Error('Open Spotify en controleer of je Premium-account actief is.');
    return state.spotifyDeviceId;
  }

  async function runSoundTest(){
    if(!state.tracks.length) return setStatus('testStatus','Importeer eerst een playlist.','error');
    const button = $('soundTestButton');
    button.disabled = true;
    button.textContent = 'BEZIG…';
    try{
      const deviceId = await ensureSpotifyPlayer();
      const track = state.tracks[0];
      await spotifyApi(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,{
        method:'PUT',
        body:JSON.stringify({uris:[track.uri],position_ms:Math.min(30000,Math.max(0,track.duration_ms-10000))})
      });
      setStatus('testStatus','Geluid speelt…','ok');
      await wait(4000);
      await stopSpotify();
      sessionStorage.setItem('bb_sound_test_ok','1');
      setStatus('testStatus','Geluidstest geslaagd.','ok');
      renderHost(state.room);
    }catch(error){
      sessionStorage.removeItem('bb_sound_test_ok');
      setStatus('testStatus',`Test mislukt: ${error.message}`,'error');
    }finally{
      button.disabled = false;
      button.textContent = 'TEST';
      updatePreflightChecks();
    }
  }

  async function stopSpotify(){
    clearTimeout(state.stopTimer);
    try{
      await spotifyApi('https://api.spotify.com/v1/me/player/pause',{method:'PUT'});
    }catch(_error){}
    $('stopTrackButton').disabled = true;
  }

  /* Kamer en host */
  function generateRoomCode(){
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({length:4},() => chars[Math.floor(Math.random()*chars.length)]).join('');
  }

  function createBingoCard(){
    const colors = [];
    while(colors.length<36) colors.push(...COLORS.map(color => color.key));
    colors.length = 36;
    for(let index=colors.length-1;index>0;index--){
      const swap = Math.floor(Math.random()*(index+1));
      [colors[index],colors[swap]] = [colors[swap],colors[index]];
    }
    return colors;
  }

  function hostName(){
    return ($('hostNameInput')?.value || localStorage.getItem('bb_host_name') || 'Host').trim() || 'Host';
  }

  function saveHostName(){
    localStorage.setItem('bb_host_name',hostName());
    if(state.roomCode && state.hostPlayerId){
      state.db.ref(`rooms/${state.roomCode}/players/${state.hostPlayerId}`).update({name:hostName()}).catch(()=>{});
    }
  }

  async function createRoom(replace=false){
    if(state.roomCode && !replace) return state.roomCode;
    if(state.roomRef) state.roomRef.off();
    const code = generateRoomCode();
    await state.db.ref(`rooms/${code}`).set({
      createdAt:firebase.database.ServerValue.TIMESTAMP,
      roundNumber:0,
      settings:currentSettings()
    });
    state.roomCode = code;
    localStorage.setItem('hb_host_room',code);
    renderRoomShare();
    await ensureHostPlayer();
    listenToRoom(code);
    setStatus('roomStatus','Kamer klaar. Laat spelers de QR-code scannen.','ok');
    return code;
  }

  async function ensureRoom(){
    if(state.roomCode) return state.roomCode;
    return createRoom(false);
  }

  async function restoreRoom(){
    const saved = localStorage.getItem('hb_host_room') || '';
    if(!saved) return;
    try{
      const snapshot = await state.db.ref(`rooms/${saved}`).once('value');
      if(!snapshot.exists()){
        localStorage.removeItem('hb_host_room');
        return;
      }
      state.roomCode = saved;
      renderRoomShare();
      await ensureHostPlayer();
      listenToRoom(saved);
    }catch(_error){}
  }

  async function ensureHostPlayer(){
    if(!state.roomCode) return;
    if(!state.hostPlayerId){
      state.hostPlayerId = `host_${Math.random().toString(36).slice(2,10)}`;
      localStorage.setItem('bb_host_player_id',state.hostPlayerId);
    }
    saveHostName();
    const reference = state.db.ref(`rooms/${state.roomCode}/players/${state.hostPlayerId}`);
    const existing = (await reference.once('value')).val() || {};
    await reference.update({
      name:hostName(),
      emoji:existing.emoji || playerAnimal(state.hostPlayerId,existing),
      isHost:true,
      online:true,
      ready:existing.ready ?? false,
      score:Number(existing.score)||0,
      joinedAt:existing.joinedAt || firebase.database.ServerValue.TIMESTAMP,
      lastSeen:firebase.database.ServerValue.TIMESTAMP,
      card:Array.isArray(existing.card) && existing.card.length===36 ? existing.card : createBingoCard(),
      marked:existing.marked || {},
      bingo:!!existing.bingo
    });
    reference.child('online').onDisconnect().set(false);
  }

  function currentSettings(){
    return {
      duration:Number(document.querySelector('.durationGrid button.active')?.dataset.duration || 20),
      randomStart:!!$('randomStart')?.checked,
      noRepeat:!!$('noRepeat')?.checked
    };
  }

  function renderRoomShare(){
    if(!state.roomCode) return;
    const joinUrl = new URL(location.pathname,location.origin);
    joinUrl.searchParams.set('room',state.roomCode);
    $('roomShare').classList.remove('empty');
    $('roomCode').textContent = state.roomCode;
    $('roomLink').value = joinUrl.href;
    $('roomQr').src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(joinUrl.href)}`;
    $('roomQr').alt = `QR-code voor kamer ${state.roomCode}`;
  }

  async function copyRoomLink(){
    const link = $('roomLink').value;
    if(!link) return;
    try{
      await navigator.clipboard.writeText(link);
    }catch(_error){
      $('roomLink').select();
      document.execCommand('copy');
    }
    const button = $('copyLinkButton');
    button.textContent = 'GEKOPIEERD ✓';
    setTimeout(() => button.textContent='KOPIEER LINK',1400);
  }

  function listenToRoom(code){
    if(state.roomRef) state.roomRef.off();
    state.roomRef = state.db.ref(`rooms/${code}`);
    state.roomRef.on('value',snapshot => {
      state.room = snapshot.val() || null;
      if(!state.room) return;
      updatePlayerCounts();
      if(isPlayerPage()) renderPlayer();
      else renderHost();
    });
    listenForWinner(code);
  }

  function renderHost(room=state.room){
    if(!room) return;
    const players = activePlayers(room);
    const ready = players.filter(([,player]) => player.ready===true).length;
    $('readyCount').textContent = `${ready} / ${players.length} READY`;
    $('hostPlayers').innerHTML = players.length ? players.map(([id,player]) => `
      <article class="playerChip ${player.ready?'ready':''}">
        <span>${playerAnimal(id,player)}</span>
        <strong>${escapeHtml(player.name || 'Speler')}</strong>
        <i>${player.ready?'READY ✓':'WACHT'}</i>
      </article>`).join('') : '<p>Nog geen spelers.</p>';

    const round = room.currentRound || {};
    const allReady = players.length>0 && players.every(([,player]) => player.ready===true);
    const canStart = allReady && !!state.tracks.length && !['picking','ready','answering','locked'].includes(round.status);
    const host = room.players?.[state.hostPlayerId];
    const hostReady = host?.ready===true;
    const lobby = !round.id;
    $('hostReadyButton').classList.toggle('done',hostReady);
    $('hostReadyButton').disabled = hostReady;
    $('hostReadyButton').textContent = hostReady ? 'HOST READY ✓' : 'IK BEN READY';
    $('startRoundButton').disabled = !canStart;
    $('startRoundButton').textContent = canStart ? 'START RONDE' : allReady ? 'IMPORTEER EERST MUZIEK' : 'WACHTEN OP READY';
    document.querySelector('.playLayout')?.classList.toggle('lobbyMode',lobby);
    document.querySelector('.transport')?.classList.toggle('hidden',lobby);
    $('testStatus').textContent = sessionStorage.getItem('bb_sound_test_ok')==='1'
      ? 'Geluidstest geslaagd.'
      : state.tracks.length ? 'Test Spotify voordat je start.' : 'Importeer eerst een playlist.';
    $('testStatus').classList.toggle('ok',sessionStorage.getItem('bb_sound_test_ok')==='1');
    updatePreflightChecks();

    renderHostRound(room,round);
    renderHostCard(room,round);
  }

  function renderHostRound(room,round){
    const display = $('hostRoundDisplay');
    const answer = round.correctAnswer;
    $('hostScoreSection').classList.toggle('hidden',!round.id || !['locked','judged'].includes(round.status));
    $('hostAnswerForm').classList.toggle('hidden',round.status!=='answering' || !!room.answers?.[round.id]?.[state.hostPlayerId]);
    $('hostAnswerReveal').classList.toggle('hidden',!answer);
    if(answer){
      $('hostAnswerReveal').innerHTML = `<strong>${escapeHtml(answer.track)}</strong><span>${escapeHtml(answer.artist)} · ${escapeHtml(answer.year)}</span>`;
    }

    if(!round.id){
      $('roundTitle').textContent = 'Klaar om te spelen';
      $('liveBadge').textContent = 'WACHT';
      $('liveBadge').classList.remove('live');
      display.innerHTML = '<strong>Maak iedereen READY</strong><span>Start daarna de eerste ronde.</span>';
      $('playTrackButton').disabled = true;
      $('stopTrackButton').disabled = true;
      $('showAnswerButton').disabled = true;
      return;
    }

    $('roundTitle').textContent = `Ronde ${round.number || room.roundNumber || 1}`;
    $('liveBadge').textContent = ['answering','picking','ready'].includes(round.status) ? '● LIVE' : 'UITSLAG';
    $('liveBadge').classList.toggle('live',['answering','picking','ready'].includes(round.status));
    const color = COLORS.find(item => item.key===round.colorKey);
    if(round.status==='picking'){
      display.innerHTML = '<strong>Categorie wordt gekozen…</strong><span>De kleuren lopen rond.</span>';
    }else{
      display.innerHTML = `<span class="questionColor" style="--round-color:${color?.hex || '#93f500'}"></span>
        <strong>${escapeHtml(round.category || 'Categorie')}</strong>
        <span>${escapeHtml(round.colorName || '')}</span>`;
    }
    $('playTrackButton').disabled = round.status!=='ready';
    $('stopTrackButton').disabled = round.status!=='answering';
    $('showAnswerButton').disabled = !['answering','ready'].includes(round.status);
    if(['locked','judged'].includes(round.status)) renderHostScoreboard(room,round);
  }

  function renderHostScoreboard(room,round){
    const answers = room.answers?.[round.id] || {};
    const correct = room.correct?.[round.id] || {};
    $('hostScoreboard').innerHTML = activePlayers(room).map(([id,player]) => {
      const result = correct[id];
      return `<article class="scoreRow ${result===true?'good':result===false?'bad':''}">
        <span>${playerAnimal(id,player)}</span>
        <div class="scoreWho"><strong>${escapeHtml(player.name || 'Speler')}</strong><small>${escapeHtml(answers[id]?.answer || 'Geen antwoord')}</small></div>
        <div class="judgeActions">
          <button type="button" class="judgeButton" data-judge-player="${escapeHtml(id)}" data-value="true">✓</button>
          <button type="button" class="judgeButton secondaryButton" data-judge-player="${escapeHtml(id)}" data-value="false">×</button>
        </div>
      </article>`;
    }).join('');
  }

  async function handleHostJudgement(event){
    const button = event.target.closest('[data-judge-player]');
    if(!button || !state.room?.currentRound?.id) return;
    const playerId = button.dataset.judgePlayer;
    const value = button.dataset.value==='true';
    const roundId = state.room.currentRound.id;
    const wasGood = state.room.correct?.[roundId]?.[playerId]===true;
    if(wasGood===value) return;
    const player = state.room.players?.[playerId] || {};
    const awarded = Number(state.room.points?.[roundId]?.[playerId] || 0);
    const replacement = value ? 100 : 0;
    await state.db.ref(`rooms/${state.roomCode}`).update({
      [`correct/${roundId}/${playerId}`]:value,
      [`points/${roundId}/${playerId}`]:replacement,
      [`players/${playerId}/score`]:Math.max(0,Number(player.score||0)-awarded+replacement)
    });
  }

  function showRoomError(error){
    setStatus('roomStatus',`Kamer maken mislukt: ${error.message || error}`,'error');
  }

  /* Rondes */
  function chooseTrack(){
    if(!state.tracks.length) return null;
    let used = new Set(readJson('hb_used',[]));
    let available = $('noRepeat')?.checked ? state.tracks.filter(track => !used.has(track.id)) : state.tracks;
    if(!available.length){
      used = new Set();
      available = state.tracks;
    }
    const track = randomItem(available);
    used.add(track.id);
    localStorage.setItem('hb_used',JSON.stringify([...used]));
    return track;
  }

  async function startRound(){
    if(!state.roomCode || !state.room) return;
    const players = activePlayers();
    if(!players.length || !players.every(([,player]) => player.ready===true)){
      return alert('Nog niet iedereen is READY.');
    }
    state.currentTrack = chooseTrack();
    if(!state.currentTrack) return alert('Importeer eerst een Spotify-playlist.');
    const number = Number(state.room.roundNumber || 0)+1;
    const roundId = `r_${Date.now()}`;
    const updates = {
      roundNumber:number,
      settings:currentSettings(),
      currentRound:{
        id:roundId,
        number,
        status:'picking',
        startedAt:firebase.database.ServerValue.TIMESTAMP,
        seconds:currentSettings().duration
      }
    };
    players.forEach(([id]) => {
      updates[`players/${id}/ready`] = false;
      updates[`players/${id}/lastPickedRound`] = null;
    });
    await state.db.ref(`rooms/${state.roomCode}`).update(updates);
    await wait(1800);
    const color = randomItem(COLORS);
    await state.db.ref(`rooms/${state.roomCode}/currentRound`).update({
      status:'ready',
      colorKey:color.key,
      colorName:color.name,
      colorHex:color.hex,
      category:color.category
    });
  }

  async function playRoundTrack(){
    const round = state.room?.currentRound;
    if(!round?.id || !state.currentTrack) return;
    const button = $('playTrackButton');
    button.disabled = true;
    try{
      const deviceId = await ensureSpotifyPlayer();
      const duration = Number(round.seconds || currentSettings().duration)*1000;
      let position = 0;
      if($('randomStart')?.checked && state.currentTrack.duration_ms>duration+45000){
        position = Math.floor(20000 + Math.random()*(state.currentTrack.duration_ms-duration-30000));
      }
      await spotifyApi(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,{
        method:'PUT',
        body:JSON.stringify({uris:[state.currentTrack.uri],position_ms:Math.max(0,position)})
      });
      const deadline = Date.now()+duration;
      await state.db.ref(`rooms/${state.roomCode}/currentRound`).update({
        status:'answering',
        deadlineMs:deadline,
        musicStartedAt:firebase.database.ServerValue.TIMESTAMP
      });
      clearTimeout(state.stopTimer);
      state.stopTimer = setTimeout(() => lockAndJudgeRound(),duration);
    }catch(error){
      alert(`Afspelen mislukt: ${error.message}`);
      button.disabled = false;
    }
  }

  function answerForTrack(track){
    return {
      track:track?.name || '',
      artist:track?.artists || '',
      album:track?.album || '',
      year:String(track?.release_date || '').slice(0,4)
    };
  }

  function normalize(value){
    return String(value || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/&/g,' en ')
      .replace(/[^a-z0-9]+/g,' ')
      .trim();
  }

  function judgeAnswer(answer,round,correctAnswer){
    const given = normalize(answer);
    if(!given) return false;
    const year = Number(correctAnswer.year)||0;
    switch(round.colorKey){
      case 'yellow': {
        const shouldBeBefore = year<2001;
        const saysBefore = /\b(voor|before|ouder)\b/.test(given);
        const saysAfter = /\b(na|after|nieuwer)\b/.test(given);
        return shouldBeBefore ? saysBefore : saysAfter;
      }
      case 'pink': {
        const artists = normalize(correctAnswer.artist).split(/\s+(?:en|feat|ft)\s+|,/).filter(Boolean);
        return artists.some(artist => artist.length>2 && (given.includes(artist) || artist.includes(given)));
      }
      case 'purple': {
        const decade = Math.floor(year/10)*10;
        const numbers = given.match(/\d{2,4}/g) || [];
        return numbers.some(value => {
          const number = Number(value);
          return number===decade || number===decade%100;
        });
      }
      case 'blue': {
        const guessed = Number((given.match(/\d{4}/)||[])[0]);
        return !!guessed && Math.abs(guessed-year)<=2;
      }
      case 'green': {
        const title = normalize(correctAnswer.track);
        return given.length>=3 && (title.includes(given) || given.includes(title));
      }
      default:return false;
    }
  }

  async function lockAndJudgeRound(){
    const round = state.room?.currentRound;
    if(!round?.id || ['locked','judged'].includes(round.status)) return;
    clearTimeout(state.stopTimer);
    await stopSpotify();
    const snapshot = await state.db.ref(`rooms/${state.roomCode}`).once('value');
    const room = snapshot.val() || {};
    const latestRound = room.currentRound || round;
    const correctAnswer = answerForTrack(state.currentTrack);
    const answers = room.answers?.[latestRound.id] || {};
    const correct = {};
    const goodTimes = [];
    activePlayers(room).forEach(([id]) => {
      const entry = answers[id] || {};
      const good = judgeAnswer(entry.answer,latestRound,correctAnswer);
      correct[id] = good;
      if(good) goodTimes.push({id,time:Number(entry.submittedAt)||Number.MAX_SAFE_INTEGER});
    });
    goodTimes.sort((a,b) => a.time-b.time);
    const fastest = goodTimes[0]?.id || '';
    const updates = {
      [`currentRound/status`]:'locked',
      [`currentRound/correctAnswer`]:correctAnswer,
      [`correct/${latestRound.id}`]:correct
    };
    activePlayers(room).forEach(([id,player]) => {
      if(correct[id]){
        const points = id===fastest ? 150 : 100;
        updates[`points/${latestRound.id}/${id}`] = points;
        updates[`players/${id}/score`] = Number(player.score||0)+points;
      }else{
        updates[`points/${latestRound.id}/${id}`] = 0;
      }
    });
    await state.db.ref(`rooms/${state.roomCode}`).update(updates);
  }

  async function publishResults(){
    const round = state.room?.currentRound;
    if(!round?.id) return;
    const correct = state.room.correct?.[round.id] || {};
    const updates = {'currentRound/status':'judged'};
    activePlayers().forEach(([id]) => {
      if(correct[id]!==true) updates[`players/${id}/ready`] = true;
    });
    await state.db.ref(`rooms/${state.roomCode}`).update(updates);
  }

  async function submitHostAnswer(){
    const round = state.room?.currentRound;
    const answer = $('hostAnswerInput').value.trim();
    if(!round?.id || round.status!=='answering') return;
    await state.db.ref(`rooms/${state.roomCode}/answers/${round.id}/${state.hostPlayerId}`).set({
      answer,submittedAt:firebase.database.ServerValue.TIMESTAMP
    });
    $('hostAnswerInput').value = '';
  }

  async function markHostReady(){
    if(!state.roomCode || !state.hostPlayerId) return;
    await state.db.ref(`rooms/${state.roomCode}/players/${state.hostPlayerId}/ready`).set(true);
  }

  /* Speler */
  async function preparePlayerJoin(){
    if(!state.roomCode){
      setStatus('joinStatus','Geen geldige spelcode gevonden.','error');
      $('joinButton').disabled = true;
      return;
    }
    try{
      const snapshot = await state.db.ref(`rooms/${state.roomCode}`).once('value');
      if(!snapshot.exists()) throw new Error('Deze kamer bestaat niet.');
      setStatus('joinStatus','Vul je naam in en tik op MEEDOEN.','ok');
    }catch(error){
      setStatus('joinStatus',error.message,'error');
      $('joinButton').disabled = true;
    }
  }

  async function joinRoom(){
    const name = $('playerNameInput').value.trim();
    if(!name) return setStatus('joinStatus','Vul eerst je naam in.','error');
    const snapshot = await state.db.ref(`rooms/${state.roomCode}`).once('value');
    if(!snapshot.exists()) return setStatus('joinStatus','Deze kamer bestaat niet meer.','error');
    const room = snapshot.val() || {};
    const duplicate = activePlayers(room).some(([id,player]) => id!==state.playerId && normalize(player.name)===normalize(name));
    if(duplicate) return setStatus('joinStatus','Deze naam wordt al gebruikt. Kies een andere naam.','error');
    if(!state.playerId){
      state.playerId = `p_${Math.random().toString(36).slice(2,10)}${Date.now().toString(36).slice(-4)}`;
    }
    state.playerName = name;
    localStorage.setItem('hb_player_id',state.playerId);
    localStorage.setItem('hb_player_name',name);
    localStorage.setItem('hb_player_room',state.roomCode);
    const reference = state.db.ref(`rooms/${state.roomCode}/players/${state.playerId}`);
    const existing = (await reference.once('value')).val() || {};
    await reference.update({
      name,
      emoji:existing.emoji || playerAnimal(state.playerId,existing),
      online:true,
      ready:false,
      score:Number(existing.score)||0,
      joinedAt:existing.joinedAt || firebase.database.ServerValue.TIMESTAMP,
      lastSeen:firebase.database.ServerValue.TIMESTAMP,
      card:Array.isArray(existing.card) && existing.card.length===36 ? existing.card : createBingoCard(),
      marked:existing.marked || {},
      bingo:!!existing.bingo
    });
    reference.child('online').onDisconnect().set(false);
    $('joinScreen').classList.add('hidden');
    $('playerGameScreen').classList.remove('hidden');
    listenToRoom(state.roomCode);
  }

  function currentUserId(){
    return isPlayerPage() ? state.playerId : state.hostPlayerId;
  }

  function renderPlayer(){
    const room = state.room;
    const round = room?.currentRound || {};
    const me = room?.players?.[state.playerId];
    if(!me) return;
    $('joinScreen').classList.add('hidden');
    $('playerGameScreen').classList.remove('hidden');
    $('playerAvatar').textContent = playerAnimal(state.playerId,me);
    $('playerDisplayName').textContent = me.name || state.playerName;
    updatePlayerTimer(round);

    const ownAnswer = round.id ? room.answers?.[round.id]?.[state.playerId] : null;
    const ownCorrect = round.id ? room.correct?.[round.id]?.[state.playerId] : undefined;
    const renderKey = `${round.id||'lobby'}:${round.status||'lobby'}:${!!ownAnswer}:${ownCorrect}:${!!me.ready}:${me.lastPickedRound||''}`;
    if(renderKey===state.lastPlayerRender && round.status==='answering' && !ownAnswer) return;
    state.lastPlayerRender = renderKey;

    if(!round.id){
      renderPlayerLobby(room,me,'Wachten op de host','Iedereen klaar? Dan kan de eerste ronde starten.');
    }else if(round.status==='picking'){
      renderWaitingState('Categorie wordt gekozen…','De kleuren lopen rond.');
    }else if(round.status==='ready'){
      renderQuestionReady(round);
    }else if(round.status==='answering'){
      if(ownAnswer) renderWaitingState('Antwoord ingeleverd','Wacht tot de tijd voorbij is.');
      else renderAnswerState(round);
    }else if(round.status==='locked'){
      renderLockedState(round);
    }else if(round.status==='judged'){
      renderResultState(room,round,me,ownCorrect);
    }else{
      renderPlayerLobby(room,me,'Wachten op de host','De volgende ronde komt eraan.');
    }
  }

  function playerListHtml(room){
    return activePlayers(room).map(([id,player]) => `
      <article class="playerChip ${player.ready?'ready':''}">
        <span>${playerAnimal(id,player)}</span>
        <strong>${escapeHtml(player.name || 'Speler')}</strong>
        <i>${player.ready?'READY ✓':'WACHT'}</i>
      </article>`).join('');
  }

  function renderPlayerLobby(room,me,title,subtitle){
    const players = activePlayers(room);
    const ready = players.filter(([,player]) => player.ready===true).length;
    $('playerGameContent').innerHTML = `<div class="playerState">
      <section class="playerHero">
        <img src="bb_logo_lime.webp" alt="Bingo Beats">
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(subtitle)}</p>
      </section>
      <section class="playerPanel">
        <div class="readySummary"><span>SPELERS</span><strong>${ready} / ${players.length} READY</strong></div>
        <div class="lobbyPlayers">${playerListHtml(room)}</div>
      </section>
      <button type="button" class="readyButton ${me.ready?'done':''}" ${me.ready?'disabled':''}>${me.ready?'READY ✓':'READY'}</button>
    </div>`;
    $('playerGameContent').querySelector('.readyButton')?.addEventListener('click',markPlayerReady);
  }

  function renderWaitingState(title,subtitle){
    $('playerGameContent').innerHTML = `<section class="playerPanel waitingCard">
      <img src="bb_mascot_dj.png" alt="Bingo Beats DJ">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(subtitle)}</p>
    </section>`;
  }

  function colorForRound(round){
    return COLORS.find(color => color.key===round.colorKey) || COLORS[0];
  }

  function renderQuestionReady(round){
    const color = colorForRound(round);
    $('playerGameContent').innerHTML = `<section class="playerPanel waitingCard" style="--round-color:${color.hex}">
      <span class="questionColor"></span>
      <small style="color:${color.hex};font-weight:900">${escapeHtml(color.name)}</small>
      <h1>${escapeHtml(round.category)}</h1>
      <p>De muziek kan ieder moment starten.</p>
    </section>`;
  }

  function renderAnswerState(round){
    const color = colorForRound(round);
    $('playerGameContent').innerHTML = `<div class="playerState answerState" style="--round-color:${color.hex}">
      <section class="playerPanel questionCard">
        <div class="questionColor"></div>
        <small>${escapeHtml(color.name)}</small>
        <h1>${escapeHtml(round.category)}</h1>
      </section>
      <section class="playerPanel waitingCard">
        <img src="bb_mascot_dj.png" alt="Luister naar het nummer">
        <h1>Luister goed</h1>
        <p>Timer, vraag en antwoord blijven zichtbaar.</p>
      </section>
      <div class="playerPanel answerForm">
        <input id="playerAnswerInput" type="text" maxlength="100" placeholder="Typ je antwoord" autocomplete="off">
        <button id="submitAnswerButton" type="button">VERSTUUR</button>
      </div>
    </div>`;
    $('submitAnswerButton').addEventListener('click',submitPlayerAnswer);
    $('playerAnswerInput').addEventListener('keydown',event => {
      if(event.key==='Enter') event.preventDefault();
    });
  }

  function renderLockedState(round){
    const answer = round.correctAnswer || {};
    $('playerGameContent').innerHTML = `<section class="playerPanel waitingCard">
      <span style="font-size:38px">🎵</span>
      <h1>Juiste antwoord</h1>
      <div class="trackAnswer"><strong>${escapeHtml(answer.track || '-')}</strong><small>${escapeHtml(answer.artist || '-')} · ${escapeHtml(answer.year || '-')}</small></div>
      <p>De host controleert de uitslag.</p>
    </section>`;
  }

  function renderResultState(room,round,me,good){
    const picked = me.lastPickedRound===round.id;
    const canPick = good===true && !picked;
    const resultClass = good===true ? 'good' : 'bad';
    const resultTitle = good===true ? 'GOED ANTWOORD!' : 'HELAAS';
    const answer = round.correctAnswer || {};
    $('playerGameContent').innerHTML = `<div class="playerState resultState">
      <section class="playerPanel resultCard ${resultClass}">
        <span>${good===true?'😎':'🙈'}</span>
        <h1>${resultTitle}</h1>
        <p>${canPick?`Kies één ${escapeHtml(round.colorName)} vakje.`:'Maak je klaar voor de volgende ronde.'}</p>
        <div class="trackAnswer"><strong>${escapeHtml(answer.track || '-')}</strong><small>${escapeHtml(answer.artist || '-')} · ${escapeHtml(answer.year || '-')}</small></div>
      </section>
      <section class="playerPanel">
        <div class="bingoCard">${bingoCardHtml(me,round,canPick)}</div>
      </section>
      <button type="button" class="readyButton ${me.ready?'done':''}" ${canPick||me.ready?'disabled':''}>${canPick?'KIES EERST EEN VAK':me.ready?'READY ✓':'READY'}</button>
    </div>`;
    $('playerGameContent').querySelectorAll('.bingoCell.pickable').forEach(button => {
      button.addEventListener('click',() => pickBingoCell(state.playerId,Number(button.dataset.index)));
    });
    $('playerGameContent').querySelector('.readyButton')?.addEventListener('click',markPlayerReady);
  }

  function updatePlayerTimer(round){
    clearInterval(state.timer);
    const element = $('playerTimer');
    const tick = () => {
      if(round.status==='answering' && round.deadlineMs){
        const left = Math.max(0,Math.ceil((round.deadlineMs-Date.now())/1000));
        element.textContent = `00:${String(left).padStart(2,'0')}`;
      }else{
        element.textContent = ['locked','judged'].includes(round.status) ? '00:00' : '--';
      }
    };
    tick();
    if(round.status==='answering') state.timer = setInterval(tick,250);
  }

  async function submitPlayerAnswer(){
    const round = state.room?.currentRound;
    const answer = $('playerAnswerInput')?.value.trim() || '';
    if(!round?.id || round.status!=='answering') return;
    await state.db.ref(`rooms/${state.roomCode}/answers/${round.id}/${state.playerId}`).set({
      answer,submittedAt:firebase.database.ServerValue.TIMESTAMP
    });
  }

  async function markPlayerReady(){
    if(!state.playerId) return;
    await state.db.ref(`rooms/${state.roomCode}/players/${state.playerId}/ready`).set(true);
  }

  function bingoCardHtml(player,round,canPick){
    const card = Array.isArray(player?.card) ? player.card : [];
    const marked = player?.marked || {};
    return card.map((color,index) => {
      const colorInfo = COLORS.find(item => item.key===color);
      const isMarked = !!marked[index];
      const pickable = canPick && color===round?.colorKey && !isMarked;
      return `<button type="button" class="bingoCell ${isMarked?'marked':''} ${pickable?'pickable':''}" data-index="${index}" style="--cell:${colorInfo?.hex || '#777'}" ${pickable?'':'disabled'}><span>${isMarked?'✓':''}</span></button>`;
    }).join('');
  }

  function renderHostCard(room,round){
    const host = room?.players?.[state.hostPlayerId];
    if(!host) return;
    const good = round?.id ? room.correct?.[round.id]?.[state.hostPlayerId] : undefined;
    const canPick = round?.status==='judged' && good===true && host.lastPickedRound!==round.id;
    $('hostBingoCard').innerHTML = bingoCardHtml(host,round,canPick);
  }

  function handleHostCardPick(event){
    const cell = event.target.closest('.bingoCell.pickable');
    if(cell) pickBingoCell(state.hostPlayerId,Number(cell.dataset.index));
  }

  async function pickBingoCell(playerId,index){
    const round = state.room?.currentRound;
    const player = state.room?.players?.[playerId];
    if(!round?.id || !player || player.card?.[index]!==round.colorKey || player.marked?.[index]) return;
    const marked = {...(player.marked||{}),[index]:true};
    const bingo = checkBingo(marked);
    await state.db.ref(`rooms/${state.roomCode}/players/${playerId}`).update({
      marked,
      bingo,
      lastPickedRound:round.id,
      ready:true
    });
    if(bingo){
      await state.db.ref(`rooms/${state.roomCode}/bingos`).push({
        playerId,
        name:player.name || 'Speler',
        roundId:round.id,
        at:firebase.database.ServerValue.TIMESTAMP
      });
    }
  }

  function checkBingo(marked){
    const lines = [];
    for(let row=0;row<6;row++) lines.push(Array.from({length:6},(_,column) => row*6+column));
    for(let column=0;column<6;column++) lines.push(Array.from({length:6},(_,row) => row*6+column));
    lines.push([0,7,14,21,28,35],[5,10,15,20,25,30]);
    return lines.some(line => line.every(index => !!marked[index]));
  }

  function listenForWinner(code){
    state.db.ref(`rooms/${code}/bingos`).off();
    state.db.ref(`rooms/${code}/bingos`).on('child_added',snapshot => {
      const winner = snapshot.val() || {};
      const key = `${snapshot.key}_${winner.roundId || ''}`;
      if(key===state.winnerKey) return;
      state.winnerKey = key;
      localStorage.setItem('bb_last_winner_key',key);
      $('winnerName').textContent = winner.name || 'Speler';
      $('winnerOverlay').classList.remove('hidden');
      setTimeout(() => $('winnerOverlay').classList.add('hidden'),5500);
    });
  }

  function registerWorker(){
    if('serviceWorker' in navigator && location.protocol!=='file:'){
      navigator.serviceWorker.register('./sw.js?v=2050',{updateViaCache:'none'})
        .then(registration => registration.update())
        .catch(()=>{});
    }
  }

  document.addEventListener('DOMContentLoaded',() => {
    init().catch(error => {
      console.error(error);
      if(isPlayerPage()) setStatus('joinStatus',`Starten mislukt: ${error.message}`,'error');
      else setStatus('musicStatus',`Starten mislukt: ${error.message}`,'error');
    });
  },{once:true});
})();
