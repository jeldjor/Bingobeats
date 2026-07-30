/* Bingo Beats Clean V212
   Eén applicatiebestand: Spotify, Firebase, automatische spelrondes,
   scoreborden en de vaste Bingo Beats-spelregels. */
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
  const SPECIAL_FIELDS = [
    {key:'era',label:'Voor of na 2001',placeholder:'Voor / na 2001'},
    {key:'artist',label:'Naam van artiest',placeholder:'Artiest'},
    {key:'decade',label:'Decennium',placeholder:'Bijv. jaren 90'},
    {key:'year',label:'Jaartal ± 2',placeholder:'Bijv. 1998'},
    {key:'title',label:'Titel van track',placeholder:'Titel'}
  ];
  const ADVANTAGES = {
    timePressure:{name:'Time Pressure',icon:'⏱️',text:'Tegenstanders krijgen 5 seconden minder.'},
    doubleTrouble:{name:'Double Trouble',icon:'💣',text:'Tegenstanders krijgen een tweede Beat Bomb.'},
    joker:{name:'Joker',icon:'🃏',text:'Zet hem vóór een nummer in; alleen jouw antwoord telt.'},
    engineer:{name:'Beat Engineer Unlock',icon:'👷',text:'Jouw Beat Engineer is direct actief.'},
    extraTime:{name:'Extra Time',icon:'+5',text:'Jij krijgt 5 seconden extra.'}
  };
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
    timers:{},
    stopTimer:null,
    automationTimer:null,
    automationKey:'',
    judgingRound:'',
    lastPlayerRender:'',
    lastHostRender:'',
    winnerKey:localStorage.getItem('bb_last_winner_key') || '',
    powerEffectKey:''
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

  function stableHash(value){
    let hash = 2166136261;
    for(const character of String(value || '')){
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash,16777619);
    }
    return hash>>>0;
  }

  function availableCardIndexes(card){
    return (Array.isArray(card) ? card : []).map((_color,index) => index);
  }

  function powerCellsFor(playerId,card,existing={}){
    const indexes = availableCardIndexes(card);
    const power = {...existing};
    if(!indexes.length) return power;
    if(!Number.isInteger(power.bombIndex)){
      power.bombIndex = indexes[stableHash(`${playerId}|beat-bomb`)%indexes.length];
    }
    if(!Number.isInteger(power.engineerIndex)){
      const choices = indexes.filter(index => index!==power.bombIndex);
      power.engineerIndex = choices[stableHash(`${playerId}|beat-engineer`)%choices.length];
    }
    power.bombTriggered = !!power.bombTriggered;
    power.bomb2Triggered = !!power.bomb2Triggered;
    power.engineerFound = !!power.engineerFound;
    power.engineerActive = !!power.engineerActive;
    power.engineerUsed = !!power.engineerUsed;
    return power;
  }

  function secondBombIndex(playerId,card,power){
    const choices = availableCardIndexes(card).filter(index => index!==power.bombIndex && index!==power.engineerIndex);
    return choices.length ? choices[stableHash(`${playerId}|second-beat-bomb`)%choices.length] : null;
  }

  function activeAdvantage(room,round=room?.currentRound){
    const advantage = round?.advantage || room?.gameState?.activeAdvantage;
    const number = Number(round?.number || room?.roundNumber || 0);
    if(!advantage || number<Number(advantage.startRound||0) || number>Number(advantage.endRound||0)) return null;
    return advantage;
  }

  function jokerOwner(room,round=room?.currentRound){
    const advantage = activeAdvantage(room,round);
    if(advantage?.type!=='joker' || !advantage.jokerUsed) return '';
    return Number(advantage.jokerRound||0)===Number(round?.number||0) ? advantage.ownerId : '';
  }

  function effectiveDeadline(room,round,playerId){
    const base = Number(round?.baseDeadlineMs || round?.deadlineMs || 0);
    if(!base || round?.isBingoBeats) return base;
    const advantage = activeAdvantage(room,round);
    if(advantage?.type==='timePressure' && playerId!==advantage.ownerId) return base-5000;
    if(advantage?.type==='extraTime' && playerId===advantage.ownerId) return base+5000;
    return base;
  }

  function markedCount(player){
    return Object.values(player?.marked || {}).filter(Boolean).length;
  }

  function blockRoundNumber(number){
    return ((Math.max(1,Number(number)||1)-1)%5)+1;
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
    if(requested===4){
      renderHost(state.room);
      scheduleHostAutomation(state.room);
    }
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
    $('hostGameContent')?.addEventListener('click',handleHostGameClick);
    $('hostGameContent')?.addEventListener('keydown',event => {
      if(event.key==='Enter' && event.target.matches('.participantAnswerInput')){
        event.preventDefault();
        submitAnswer(state.hostPlayerId,$('hostGameContent'));
      }
    });
    $('hostScoreboard')?.addEventListener('click',handleHostJudgement);
    $$('[data-close-modal]').forEach(button => {
      button.addEventListener('click',() => $(button.dataset.closeModal)?.classList.add('hidden'));
    });
    $('playlistModal')?.addEventListener('click',event => {
      if(event.target===event.currentTarget) event.currentTarget.classList.add('hidden');
    });
    $('juryModal')?.addEventListener('click',event => {
      if(event.target===event.currentTarget) event.currentTarget.classList.add('hidden');
    });
    $('rulesModal')?.addEventListener('click',event => {
      if(event.target===event.currentTarget) event.currentTarget.classList.add('hidden');
    });
    $('powerEffectClose')?.addEventListener('click',() => $('powerEffectOverlay')?.classList.add('hidden'));
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
        return `<button type="button" class="playlistChoice ${active?'active':''}" data-playlist="${escapeHtml(item.id)}">
          <span><strong>${escapeHtml(item.name || 'Naamloze playlist')}</strong></span>
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
      gameStatus:'lobby',
      gameState:{blockRound:0,version:210},
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
    const card = Array.isArray(existing.card) && existing.card.length===36 ? existing.card : createBingoCard();
    await reference.update({
      name:hostName(),
      emoji:existing.emoji || playerAnimal(state.hostPlayerId,existing),
      isHost:true,
      online:true,
      ready:existing.ready ?? false,
      score:Number(existing.score)||0,
      blockScore:Number(existing.blockScore)||0,
      joinedAt:existing.joinedAt || firebase.database.ServerValue.TIMESTAMP,
      lastSeen:firebase.database.ServerValue.TIMESTAMP,
      card,
      marked:existing.marked || {},
      powerCells:powerCellsFor(state.hostPlayerId,card,existing.powerCells),
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
      else{
        renderHost();
        scheduleHostAutomation(state.room);
      }
    });
    listenForWinner(code);
  }

  function renderHost(room=state.room){
    if(!room) return;
    const round = room.currentRound || {};
    const host = room.players?.[state.hostPlayerId];
    if(!host) return;
    $('hostAvatar').textContent = playerAnimal(state.hostPlayerId,host);
    $('hostDisplayName').textContent = host.name || hostName();
    updateGameTimer('host',round,state.hostPlayerId);
    $('testStatus').textContent = sessionStorage.getItem('bb_sound_test_ok')==='1'
      ? 'Geluidstest geslaagd.'
      : state.tracks.length ? 'Test Spotify voordat je start.' : 'Importeer eerst een playlist.';
    $('testStatus').classList.toggle('ok',sessionStorage.getItem('bb_sound_test_ok')==='1');
    updatePreflightChecks();
    renderGameExperience($('hostGameContent'),room,round,host,state.hostPlayerId,true);
  }

  function handleHostGameClick(event){
    const pick = event.target.closest('.bingoCell.pickable');
    if(pick) return pickBingoCell(state.hostPlayerId,Number(pick.dataset.index));
    const action = event.target.closest('[data-game-action]')?.dataset.gameAction;
    if(action==='ready') markReady(state.hostPlayerId);
    if(action==='submit') submitAnswer(state.hostPlayerId,$('hostGameContent'));
    if(action==='rules') $('rulesModal')?.classList.remove('hidden');
    if(action==='advantage') chooseAdvantage(event.target.closest('[data-advantage]')?.dataset.advantage);
    if(action==='joker') activateJokerForNextRound();
    if(action==='jury'){
      renderHostScoreboard(state.room,state.room.currentRound || {});
      $('juryModal').classList.remove('hidden');
    }
  }

  function renderHostScoreboard(room,round){
    const answers = room.answers?.[round.id] || {};
    const correct = room.correct?.[round.id] || {};
    if(round.isBingoBeats){
      $('hostScoreboard').innerHTML = activePlayers(room).map(([id,player]) => {
        const result = room.specialResults?.[round.id]?.[id] || {details:[false,false,false,false,false]};
        return `<article class="specialJuryPlayer">
          <header><span>${playerAnimal(id,player)}</span><strong>${escapeHtml(player.name || 'Speler')}</strong><em>${Number(result.count||0)} / 5</em></header>
          <div>${SPECIAL_FIELDS.map((field,index) => {
            const good = result.details?.[index]===true;
            return `<section><div><small>${escapeHtml(field.label)}</small><strong>${escapeHtml(answers[id]?.answers?.[field.key] || 'Geen antwoord')}</strong></div>
              <button type="button" class="judgeButton ${good?'selected':''}" data-judge-player="${escapeHtml(id)}" data-judge-field="${index}" data-value="true">✓</button>
              <button type="button" class="judgeButton secondaryButton ${!good?'selected':''}" data-judge-player="${escapeHtml(id)}" data-judge-field="${index}" data-value="false">×</button>
            </section>`;
          }).join('')}</div>
        </article>`;
      }).join('');
      return;
    }
    $('hostScoreboard').innerHTML = activePlayers(room).map(([id,player]) => {
      const result = correct[id];
      return `<article class="scoreRow ${result===true?'good':result===false?'bad':''}">
        <span>${playerAnimal(id,player)}</span>
        <div class="scoreWho"><strong>${escapeHtml(player.name || 'Speler')}</strong><small>${escapeHtml(answers[id]?.answer || 'Geen antwoord')}</small></div>
        <div class="judgeActions">
          <button type="button" class="judgeButton ${result===true?'selected':''}" data-judge-player="${escapeHtml(id)}" data-value="true" aria-label="Antwoord goed rekenen">✓</button>
          <button type="button" class="judgeButton secondaryButton ${result===false?'selected':''}" data-judge-player="${escapeHtml(id)}" data-value="false" aria-label="Antwoord fout rekenen">×</button>
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
    const round = state.room.currentRound;
    if(round.isBingoBeats && button.dataset.judgeField!==undefined){
      const index = Number(button.dataset.judgeField);
      const oldResult = state.room.specialResults?.[roundId]?.[playerId] || {details:[false,false,false,false,false],count:0};
      const details = [...(oldResult.details || [false,false,false,false,false])];
      while(details.length<5) details.push(false);
      if(details[index]===value) return;
      details[index] = value;
      const count = details.filter(Boolean).length;
      const player = state.room.players?.[playerId] || {};
      const oldPoints = Number(state.room.points?.[roundId]?.[playerId] || 0);
      const newPoints = count*100;
      const updates = {
        [`specialResults/${roundId}/${playerId}`]:{...oldResult,details,count},
        [`correct/${roundId}/${playerId}`]:count>=4,
        [`points/${roundId}/${playerId}`]:newPoints,
        [`players/${playerId}/score`]:Math.max(0,Number(player.score||0)-oldPoints+newPoints),
        [`players/${playerId}/blockScore`]:Math.max(0,Number(player.blockScore||0)-oldPoints+newPoints),
        [`players/${playerId}/ready`]:false
      };
      if(count<4) restorePickedCellForCorrection(updates,playerId,player,roundId);
      await state.db.ref(`rooms/${state.roomCode}`).update(updates);
      await refreshBlockWinnerAfterCorrection(roundId);
      const latest = (await state.db.ref(`rooms/${state.roomCode}`).once('value')).val() || state.room;
      renderHostScoreboard(latest,latest.currentRound || round);
      return;
    }
    const wasGood = state.room.correct?.[roundId]?.[playerId]===true;
    if(wasGood===value) return;
    const corrected = {...(state.room.correct?.[roundId] || {}),[playerId]:value};
    const answers = state.room.answers?.[roundId] || {};
    const goodIds = activePlayers(state.room).filter(([id]) => corrected[id]===true && (!round.jokerOwnerId || id===round.jokerOwnerId)).map(([id]) => id);
    goodIds.sort((a,b) => Number(answers[a]?.submittedAt||Infinity)-Number(answers[b]?.submittedAt||Infinity));
    const fastest = goodIds[0] || '';
    const updates = {[`correct/${roundId}/${playerId}`]:value};
    activePlayers(state.room).forEach(([id,player]) => {
      const oldPoints = Number(state.room.points?.[roundId]?.[id] || 0);
      const newPoints = corrected[id]===true ? (id===fastest ? 150 : 100) : 0;
      updates[`points/${roundId}/${id}`] = newPoints;
      updates[`players/${id}/score`] = Math.max(0,Number(player.score||0)-oldPoints+newPoints);
      updates[`players/${id}/blockScore`] = Math.max(0,Number(player.blockScore||0)-oldPoints+newPoints);
    });
    updates[`players/${playerId}/ready`] = false;
    const player = state.room.players?.[playerId] || {};
    if(!value) restorePickedCellForCorrection(updates,playerId,player,roundId);
    await state.db.ref(`rooms/${state.roomCode}`).update(updates);
    const latest = (await state.db.ref(`rooms/${state.roomCode}`).once('value')).val() || state.room;
    renderHostScoreboard(latest,latest.currentRound || round);
  }

  function restorePickedCellForCorrection(updates,playerId,player,roundId){
    const picked = state.room?.pickedCells?.[roundId]?.[playerId];
    if(picked===undefined || picked===null) return;
    if(typeof picked==='object' && picked.previousMarked){
      updates[`players/${playerId}/marked`] = picked.previousMarked;
      updates[`players/${playerId}/powerCells`] = picked.previousPower || player.powerCells || {};
      updates[`players/${playerId}/bingo`] = checkBingo(picked.previousMarked);
    }else{
      const marked = {...(player.marked || {})};
      delete marked[Number(picked)];
      updates[`players/${playerId}/marked`] = marked;
      updates[`players/${playerId}/bingo`] = checkBingo(marked);
    }
    updates[`players/${playerId}/lastPickedRound`] = null;
    updates[`players/${playerId}/lastPowerEffect`] = null;
    updates[`pickedCells/${roundId}/${playerId}`] = null;
  }

  async function refreshBlockWinnerAfterCorrection(roundId){
    const snapshot = await state.db.ref(`rooms/${state.roomCode}`).once('value');
    const room = snapshot.val() || {};
    if(room.currentRound?.id!==roundId || !room.currentRound?.isBingoBeats) return;
    const winner = determineBlockWinner(room);
    if(!winner) return;
    const scores = {};
    activePlayers(room).forEach(([id,player]) => scores[id] = Number(player.blockScore||0));
    const updates = {
      'gameState/lastBlock/winnerId':winner.id,
      'gameState/lastBlock/winnerName':winner.player.name || 'Speler',
      'gameState/lastBlock/scores':scores
    };
    if(room.gameState?.pendingAdvantageWinnerId){
      updates['gameState/pendingAdvantageWinnerId'] = winner.id;
      updates['gameState/pendingAdvantageWinnerName'] = winner.player.name || 'Speler';
    }
    await state.db.ref(`rooms/${state.roomCode}`).update(updates);
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

  function scheduleHostAutomation(room){
    if(!room || room.gameStatus==='finished' || state.currentStep!==4){
      clearTimeout(state.automationTimer);
      state.automationTimer = null;
      state.automationKey = '';
      return;
    }
    const round = room.currentRound || {};
    const players = activePlayers(room);
    const allReady = players.length>0 && players.every(([,player]) => player.ready===true);

    const waitingForAdvantage = !!room.gameState?.pendingAdvantageWinnerId;
    if((!round.id || round.status==='judged') && allReady && !waitingForAdvantage){
      queueAutomation(`start:${round.id || 'first'}:${room.roundNumber || 0}`,startAutomaticRound,250);
      return;
    }
    if(round.status==='picking'){
      const delay = Math.max(0,Number(round.categoryAt || Date.now())-Date.now());
      queueAutomation(`category:${round.id}`,() => revealCategory(round.id),delay);
      return;
    }
    if(round.status==='ready'){
      queueAutomation(`play:${round.id}`,() => playRoundTrack(round.id),850);
      return;
    }
    if(round.status==='answering'){
      const delay = Math.max(0,Number(round.maxDeadlineMs || round.deadlineMs || Date.now())-Date.now());
      queueAutomation(`judge:${round.id}`,() => lockAndJudgeRound(round.id),delay);
      return;
    }
    clearTimeout(state.automationTimer);
    state.automationTimer = null;
    state.automationKey = '';
  }

  function queueAutomation(key,task,delay){
    if(state.automationKey===key) return;
    clearTimeout(state.automationTimer);
    state.automationKey = key;
    state.automationTimer = setTimeout(async() => {
      try{
        await task();
      }catch(error){
        await setRoundError(error);
      }finally{
        if(state.automationKey===key) state.automationKey = '';
      }
    },Math.min(Math.max(0,delay),2147483647));
  }

  async function startAutomaticRound(){
    const snapshot = await state.db.ref(`rooms/${state.roomCode}`).once('value');
    const room = snapshot.val() || {};
    const round = room.currentRound || {};
    const players = activePlayers(room);
    if(room.gameStatus==='finished' || !players.length || !players.every(([,player]) => player.ready===true)) return;
    if(round.id && round.status!=='judged') return;
    if(room.gameState?.pendingAdvantageWinnerId) return;

    const track = chooseTrack();
    if(!track) throw new Error('Importeer eerst een Spotify-playlist bij Muziek.');
    state.currentTrack = track;
    const number = Number(room.roundNumber || 0)+1;
    const isBingoBeats = number%5===0;
    const roundId = `r_${Date.now()}`;
    $('juryModal')?.classList.add('hidden');
    const updates = {
      roundNumber:number,
      settings:currentSettings(),
      gameStatus:'playing',
      currentRound:{
        id:roundId,
        number,
        blockRound:blockRoundNumber(number),
        isBingoBeats,
        status:'picking',
        startedAt:firebase.database.ServerValue.TIMESTAMP,
        categoryAt:Date.now()+(isBingoBeats?3400:2600),
        seconds:isBingoBeats ? 60 : currentSettings().duration,
        trackId:track.id,
        advantage:room.gameState?.activeAdvantage || null,
        jokerOwnerId:''
      }
    };
    players.forEach(([id]) => {
      updates[`players/${id}/ready`] = false;
      updates[`players/${id}/lastPickedRound`] = null;
    });
    await state.db.ref(`rooms/${state.roomCode}`).update(updates);
  }

  async function revealCategory(roundId){
    const snapshot = await state.db.ref(`rooms/${state.roomCode}/currentRound`).once('value');
    const round = snapshot.val() || {};
    if(round.id!==roundId || round.status!=='picking') return;
    if(round.isBingoBeats){
      await state.db.ref(`rooms/${state.roomCode}/currentRound`).update({
        status:'ready',
        category:'BingoBeats Round',
        categoryChosenAt:firebase.database.ServerValue.TIMESTAMP
      });
      return;
    }
    const color = randomItem(COLORS);
    const room = state.room || {};
    const owner = jokerOwner(room,round);
    await state.db.ref(`rooms/${state.roomCode}/currentRound`).update({
      status:'ready',
      colorKey:color.key,
      colorName:color.name,
      colorHex:color.hex,
      category:color.category,
      jokerOwnerId:owner,
      categoryChosenAt:firebase.database.ServerValue.TIMESTAMP
    });
  }

  function trackForRound(round){
    if(state.currentTrack?.id===round?.trackId) return state.currentTrack;
    state.currentTrack = state.tracks.find(track => track.id===round?.trackId) || null;
    return state.currentTrack;
  }

  async function playRoundTrack(roundId){
    const snapshot = await state.db.ref(`rooms/${state.roomCode}/currentRound`).once('value');
    const round = snapshot.val() || {};
    if(round.id!==roundId || round.status!=='ready') return;
    const track = trackForRound(round);
    if(!track) throw new Error('Het gekozen nummer staat niet meer in de geïmporteerde playlist.');
    const deviceId = await ensureSpotifyPlayer();
    const duration = Number(round.isBingoBeats ? 60 : (round.seconds || currentSettings().duration))*1000;
    let position = 0;
    if($('randomStart')?.checked && track.duration_ms>duration+45000){
      position = Math.floor(20000 + Math.random()*(track.duration_ms-duration-30000));
    }
    await spotifyApi(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,{
      method:'PUT',
      body:JSON.stringify({uris:[track.uri],position_ms:Math.max(0,position)})
    });
    const baseDeadline = Date.now()+duration;
    const advantage = activeAdvantage(state.room || {},round);
    const extra = !round.isBingoBeats && advantage?.type==='extraTime' ? 5000 : 0;
    const maxDeadline = baseDeadline+extra;
    await state.db.ref(`rooms/${state.roomCode}/currentRound`).update({
      status:'answering',
      deadlineMs:baseDeadline,
      baseDeadlineMs:baseDeadline,
      maxDeadlineMs:maxDeadline,
      maxSeconds:Number(round.seconds||20)+(extra/1000),
      musicStartedAt:firebase.database.ServerValue.TIMESTAMP
    });
  }

  async function setRoundError(error){
    const message = error?.message || String(error || 'Onbekende fout');
    console.error(error);
    if(!state.roomCode || !state.room?.currentRound?.id) return;
    await state.db.ref(`rooms/${state.roomCode}/currentRound`).update({
      status:'error',
      error:message
    }).catch(()=>{});
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

  function wordsMatch(given,correct){
    const first = normalize(given);
    const second = normalize(correct);
    if(!first || !second) return false;
    if(first===second || first.includes(second) || second.includes(first)) return true;
    const a = new Set(first.split(' ').filter(word => word.length>1));
    const b = new Set(second.split(' ').filter(word => word.length>1));
    const common = [...a].filter(word => b.has(word)).length;
    return common>=Math.max(1,Math.ceil(Math.min(a.size,b.size)*.65));
  }

  function judgeSpecialAnswers(entry,correctAnswer){
    const answers = entry?.answers || {};
    const year = Number(correctAnswer.year)||0;
    const era = normalize(answers.era);
    const before = year<2001;
    const eraGood = before
      ? /\b(voor|before|ouder|tot)\b/.test(era)
      : /\b(na|after|nieuwer|vanaf)\b/.test(era);
    const decade = Math.floor(year/10)*10;
    const decadeValues = normalize(answers.decade).match(/\d{2,4}/g) || [];
    const guessedYear = Number((String(answers.year||'').match(/\d{4}/)||[])[0]);
    const details = [
      eraGood,
      wordsMatch(answers.artist,correctAnswer.artist),
      decadeValues.some(value => Number(value)===decade || Number(value)===decade%100),
      !!guessedYear && Math.abs(guessedYear-year)<=2,
      wordsMatch(answers.title,correctAnswer.track)
    ];
    return {details,count:details.filter(Boolean).length};
  }

  function determineBlockWinner(room,scoreOverrides={}){
    return activePlayers(room)
      .map(([id,player]) => ({
        id,
        player,
        block:Number(scoreOverrides[id] ?? player.blockScore ?? 0),
        total:Number(player.score||0)
      }))
      .sort((a,b) => b.block-a.block || b.total-a.total || a.id.localeCompare(b.id))[0] || null;
  }

  async function lockAndJudgeRound(roundId){
    if(state.judgingRound===roundId) return;
    state.judgingRound = roundId;
    await stopSpotify();
    const snapshot = await state.db.ref(`rooms/${state.roomCode}`).once('value');
    const room = snapshot.val() || {};
    const latestRound = room.currentRound || {};
    if(latestRound.id!==roundId || latestRound.status!=='answering'){
      state.judgingRound = '';
      return;
    }
    const track = trackForRound(latestRound);
    if(!track){
      state.judgingRound = '';
      throw new Error('Het nummer voor deze ronde kon niet meer worden gevonden.');
    }
    const correctAnswer = answerForTrack(track);
    const answers = room.answers?.[latestRound.id] || {};
    const correct = {};
    const specialResults = {};
    const points = {};
    const roundJokerOwner = latestRound.jokerOwnerId || jokerOwner(room,latestRound);
    if(latestRound.isBingoBeats){
      activePlayers(room).forEach(([id]) => {
        const blocked = !!roundJokerOwner && id!==roundJokerOwner;
        const result = blocked
          ? {details:[false,false,false,false,false],count:0,jokerBlocked:true}
          : judgeSpecialAnswers(answers[id] || {},correctAnswer);
        specialResults[id] = result;
        correct[id] = !blocked && result.count>=4;
        points[id] = blocked ? 0 : result.count*100;
      });
    }else{
      const goodTimes = [];
      activePlayers(room).forEach(([id]) => {
        const entry = answers[id] || {};
        const blocked = !!roundJokerOwner && id!==roundJokerOwner;
        const good = !blocked && judgeAnswer(entry.answer,latestRound,correctAnswer);
        correct[id] = good;
        if(good) goodTimes.push({id,time:Number(entry.submittedAt)||Number.MAX_SAFE_INTEGER});
      });
      goodTimes.sort((a,b) => a.time-b.time);
      const fastest = goodTimes[0]?.id || '';
      activePlayers(room).forEach(([id]) => {
        points[id] = correct[id] ? (id===fastest ? 150 : 100) : 0;
      });
    }
    const updates = {
      [`currentRound/status`]:'judged',
      [`currentRound/correctAnswer`]:correctAnswer,
      [`currentRound/judgedAt`]:firebase.database.ServerValue.TIMESTAMP,
      [`correct/${latestRound.id}`]:correct
    };
    if(latestRound.isBingoBeats) updates[`specialResults/${latestRound.id}`] = specialResults;
    const blockScores = {};
    activePlayers(room).forEach(([id,player]) => {
      const awarded = Number(points[id]||0);
      const newTotal = Number(player.score||0)+awarded;
      const newBlock = Number(player.blockScore||0)+awarded;
      blockScores[id] = newBlock;
      updates[`points/${latestRound.id}/${id}`] = awarded;
      updates[`players/${id}/score`] = newTotal;
      updates[`players/${id}/blockScore`] = newBlock;
      updates[`players/${id}/ready`] = false;
    });
    if(latestRound.isBingoBeats){
      const winner = determineBlockWinner(room,blockScores);
      if(winner){
        updates['gameState/pendingAdvantageWinnerId'] = winner.id;
        updates['gameState/pendingAdvantageWinnerName'] = winner.player.name || 'Speler';
        updates['gameState/lastBlock'] = {
          endingRound:Number(latestRound.number||0),
          winnerId:winner.id,
          winnerName:winner.player.name || 'Speler',
          scores:blockScores,
          createdAt:firebase.database.ServerValue.TIMESTAMP
        };
      }
    }
    await state.db.ref(`rooms/${state.roomCode}`).update(updates);
    state.judgingRound = '';
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
    const card = Array.isArray(existing.card) && existing.card.length===36 ? existing.card : createBingoCard();
    await reference.update({
      name,
      emoji:existing.emoji || playerAnimal(state.playerId,existing),
      online:true,
      ready:false,
      score:Number(existing.score)||0,
      blockScore:Number(existing.blockScore)||0,
      joinedAt:existing.joinedAt || firebase.database.ServerValue.TIMESTAMP,
      lastSeen:firebase.database.ServerValue.TIMESTAMP,
      card,
      marked:existing.marked || {},
      powerCells:powerCellsFor(state.playerId,card,existing.powerCells),
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
    updateGameTimer('player',round,state.playerId);
    renderGameExperience($('playerGameContent'),room,round,me,state.playerId,false);
  }

  function playerListHtml(room){
    return activePlayers(room).map(([id,player]) => `
      <article class="playerChip ${player.ready?'ready':''}">
        <span>${playerAnimal(id,player)}</span>
        <strong>${escapeHtml(player.name || 'Speler')}</strong>
        <i>${player.ready?'READY ✓':'WACHT'}</i>
      </article>`).join('');
  }

  function renderGameExperience(root,room,round,me,userId,isHost){
    if(!root || !me) return;
    const ownAnswer = round.id ? room.answers?.[round.id]?.[userId] : null;
    const ownCorrect = round.id ? room.correct?.[round.id]?.[userId] : undefined;
    const liveAnswerSignature = ownAnswer
      ? activePlayers(room).map(([id]) => `${id}:${room.answers?.[round.id]?.[id]?.answer || ''}`).join('|')
      : '';
    const key = `${room.gameStatus||'lobby'}:${round.id||'lobby'}:${round.status||'lobby'}:${!!ownAnswer}:${ownCorrect}:${!!me.ready}:${me.lastPickedRound||''}:${liveAnswerSignature}:${JSON.stringify(room.specialResults?.[round.id]?.[userId]||null)}:${JSON.stringify(room.gameState||{})}:${JSON.stringify(me.powerCells||{})}:${markedCount(me)}:${activePlayers(room).map(([id,player])=>`${id}:${!!player.ready}:${player.score||0}:${player.blockScore||0}`).join('|')}`;
    const keyName = isHost ? 'lastHostRender' : 'lastPlayerRender';
    if(key===state[keyName]) return;
    state[keyName] = key;

    if(room.gameStatus==='finished'){
      root.innerHTML = finalScoreMarkup(room);
    }else if(!round.id){
      root.innerHTML = playerLobbyMarkup(room,me);
    }else if(round.status==='picking'){
      root.innerHTML = round.isBingoBeats ? specialPickerMarkup(round) : categoryPickerMarkup(round);
    }else if(round.status==='ready'){
      root.innerHTML = round.isBingoBeats ? specialReadyMarkup(round) : questionReadyMarkup(round);
    }else if(round.status==='answering'){
      root.innerHTML = ownAnswer
        ? (round.isBingoBeats ? specialSubmittedMarkup(room,round,userId) : submittedStateMarkup(room,round,userId))
        : (round.isBingoBeats ? specialAnswerStateMarkup(room,round,userId) : answerStateMarkup(round,userId));
    }else if(round.status==='judging' || round.status==='locked'){
      root.innerHTML = lockedMarkup(round);
    }else if(round.status==='judged'){
      root.innerHTML = round.isBingoBeats
        ? specialResultStateMarkup(room,round,me,userId,isHost)
        : resultStateMarkup(room,round,me,ownCorrect,isHost);
    }else if(round.status==='error'){
      root.innerHTML = gameErrorMarkup(round.error || 'De ronde kon niet automatisch starten.');
    }else{
      root.innerHTML = playerLobbyMarkup(room,me);
    }
    maybeShowPowerEffect(me,round,userId);
    bindGameActions(root,userId,isHost);
  }

  function playerLobbyMarkup(room,me){
    const players = activePlayers(room);
    const ready = players.filter(([,player]) => player.ready===true).length;
    return `<div class="playerState lobbyGameState">
      <section class="playerHero compactLobbyHero">
        <img src="bb_logo_lime.webp" alt="Bingo Beats">
        <div><h1>Iedereen READY?</h1><p>Zodra iedereen klaar is, start de ronde automatisch.</p></div>
      </section>
      <section class="playerPanel lobbyCardPanel">
        <div class="bingoCard">${bingoCardHtml(me,null,false)}</div>
      </section>
      <section class="playerPanel lobbyRosterPanel">
        <div class="readySummary"><span>SPELERS</span><strong>${ready} / ${players.length} READY</strong></div>
        <div class="lobbyPlayers">${playerListHtml(room)}</div>
      </section>
      <div class="lobbyButtons">
        <button type="button" class="rulesButton" data-game-action="rules">SPELREGELS</button>
        <button type="button" class="readyButton ${me.ready?'done':''}" data-game-action="ready" ${me.ready?'disabled':''}>${me.ready?'READY ✓':'READY'}</button>
      </div>
    </div>`;
  }

  function waitingMarkup(title,subtitle){
    return `<section class="playerPanel waitingCard">
      <img src="bb_logo_lime.webp" alt="Bingo Beats">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(subtitle)}</p>
    </section>`;
  }

  function colorForRound(round){
    return COLORS.find(color => color.key===round.colorKey) || COLORS[0];
  }

  function categoryPickerMarkup(round){
    return `<section class="playerPanel categoryPickerState">
      <small>CATEGORIE KIEZEN</small>
      <h1>Het kleurenrad draait</h1>
      <div class="categoryWheel" aria-label="De categorie wordt automatisch gekozen">
        <div class="categoryWheelOrbit">
          ${COLORS.map((color,index) => `<i style="--wheel-color:${color.hex};--wheel-index:${index}"></i>`).join('')}
        </div>
        <img src="bb_logo_lime.webp" alt="Bingo Beats">
      </div>
      <p>Dezelfde categorie verschijnt zo bij iedereen.</p>
    </section>`;
  }

  function specialPickerMarkup(round){
    return `<section class="playerPanel categoryPickerState specialPickerState">
      <small>RONDE 5 VAN 5</small>
      <h1>BingoBeats Round</h1>
      <div class="specialRoundStar"><img src="bb_logo_lime.webp" alt="BB"><span>★</span></div>
      <p>Vijf categorieën · één nummer · 60 seconden</p>
      <div class="specialRuleChips"><span>100 punten per goed deel</span><span>4/5 = één vrij vak</span></div>
    </section>`;
  }

  function questionReadyMarkup(round){
    const color = colorForRound(round);
    return `<section class="playerPanel waitingCard categoryReveal" style="--round-color:${color.hex}">
      <img class="roundRevealLogo" src="bb_logo_lime.webp" alt="Bingo Beats">
      <span class="questionColor"></span>
      <small style="color:${color.hex};font-weight:900">${escapeHtml(color.name)}</small>
      <h1>${escapeHtml(round.category)}</h1>
      <p>De muziek en stopwatch starten nu.</p>
    </section>`;
  }

  function specialReadyMarkup(){
    return `<section class="playerPanel waitingCard specialReadyState">
      <img src="bb_logo_lime.webp" alt="Bingo Beats">
      <small>BINGOBEATS ROUND</small>
      <h1>Vijf antwoorden.<br>Één nummer.</h1>
      <p>De muziek en stopwatch starten nu.</p>
    </section>`;
  }

  function advantageBannerMarkup(room,round,userId){
    const advantage = activeAdvantage(room,round);
    if(!advantage) return '';
    const config = ADVANTAGES[advantage.type];
    if(!config) return '';
    const owner = room.players?.[advantage.ownerId];
    const isOwner = advantage.ownerId===userId;
    let text = isOwner ? `Jouw ${config.name} is actief.` : `${owner?.name || 'De blokwinnaar'}: ${config.name}.`;
    if(round.jokerOwnerId){
      text = isOwner ? 'Jouw Joker is actief: alleen jouw antwoord telt.' : `${owner?.name || 'De blokwinnaar'} gebruikt de Joker; jouw antwoord telt deze ronde niet.`;
    }
    return `<div class="advantageBanner"><b>${config.icon}</b><span>${escapeHtml(text)}</span></div>`;
  }

  function specialFieldsMarkup(){
    return SPECIAL_FIELDS.map(field => `<label class="specialField">
      <span>${escapeHtml(field.label)}</span>
      <input type="text" maxlength="100" data-special-field="${field.key}" placeholder="${escapeHtml(field.placeholder)}" autocomplete="off">
    </label>`).join('');
  }

  function specialAnswerStateMarkup(room,round,userId){
    const blocked = !!round.jokerOwnerId && round.jokerOwnerId!==userId;
    if(blocked){
      const owner = room.players?.[round.jokerOwnerId];
      return `<div class="playerState specialBlockedState">
        ${advantageBannerMarkup(room,round,userId)}
        <section class="playerPanel waitingCard">
          ${stopwatchMarkup(round,userId)}
          <h1>Joker actief</h1>
          <p>Alleen het antwoord van ${escapeHtml(owner?.name || 'de blokwinnaar')} telt.</p>
        </section>
      </div>`;
    }
    return `<div class="playerState specialAnswerState">
      ${advantageBannerMarkup(room,round,userId)}
      <section class="playerPanel specialAnswerPanel">
        <div class="specialAnswerHead">
          <div><small>BINGOBEATS ROUND</small><h1>Wat weet jij?</h1></div>
          ${stopwatchMarkup(round,userId)}
        </div>
        <div class="specialFields">${specialFieldsMarkup()}</div>
        <button type="button" class="specialSubmitButton" data-game-action="submit">VERSTUUR ALLE 5</button>
      </section>
    </div>`;
  }

  function specialLiveAnswersMarkup(room,round,userId){
    const answers = room.answers?.[round.id] || {};
    const submitted = activePlayers(room).filter(([id]) => answers[id]);
    if(!submitted.length) return '<p class="liveAnswersEmpty">Nog niemand heeft antwoorden ingestuurd.</p>';
    return submitted.map(([id,player]) => {
      const values = SPECIAL_FIELDS.map(field => answers[id]?.answers?.[field.key]).filter(Boolean);
      return `<article class="liveAnswerRow specialLiveRow ${id===userId?'own':''}">
        <span>${playerAnimal(id,player)}</span>
        <div><strong>${escapeHtml(player.name || 'Speler')}${id===userId?' · JIJ':''}</strong><small>${escapeHtml(values.join(' · ') || 'Geen antwoorden')}</small></div>
        <i>${values.length}/5</i>
      </article>`;
    }).join('');
  }

  function specialSubmittedMarkup(room,round,userId){
    const submittedCount = activePlayers(room).filter(([id]) => room.answers?.[round.id]?.[id]).length;
    return `<div class="playerState submittedState specialSubmittedState">
      ${advantageBannerMarkup(room,round,userId)}
      <section class="playerPanel submittedLivePanel">
        <div class="submittedTimer">
          ${stopwatchMarkup(round,userId)}
          <div><strong>Vijf antwoorden ingeleverd ✓</strong><small>${submittedCount} van ${activePlayers(room).length} spelers klaar</small></div>
        </div>
        <div class="liveAnswersHeader"><span>LIVE ANTWOORDEN</span><small>Nog zonder juryuitslag</small></div>
        <div class="liveAnswersList">${specialLiveAnswersMarkup(room,round,userId)}</div>
      </section>
    </div>`;
  }

  function secondsLeft(round,userId=currentUserId()){
    if(round.status!=='answering' || !round.deadlineMs) return 0;
    const deadline = effectiveDeadline(state.room || {},round,userId);
    return Math.max(0,Math.ceil((deadline-Date.now())/1000));
  }

  function stopwatchMarkup(round,userId=currentUserId()){
    const left = secondsLeft(round,userId);
    const advantage = activeAdvantage(state.room || {},round);
    let total = Math.max(1,Number(round.seconds)||20);
    if(!round.isBingoBeats && advantage?.type==='timePressure' && userId!==advantage.ownerId) total -= 5;
    if(!round.isBingoBeats && advantage?.type==='extraTime' && userId===advantage.ownerId) total += 5;
    const progress = Math.max(0,Math.min(100,(left/total)*100));
    return `<div class="roundStopwatch" data-stopwatch-round="${escapeHtml(round.id || '')}" style="--timer-progress:${progress}">
      <span class="stopwatchCrown" aria-hidden="true"></span>
      <div class="stopwatchFace">
        <strong data-countdown-seconds>${left}</strong>
        <small>SECONDEN</small>
      </div>
    </div>`;
  }

  function answerStateMarkup(round,userId){
    const color = colorForRound(round);
    const banner = advantageBannerMarkup(state.room || {},round,userId);
    return `<div class="playerState answerState ${banner?'hasAdvantage':''}" style="--round-color:${color.hex}">
      ${banner}
      <section class="playerPanel countdownPanel roundPlayPanel">
        <img class="roundMainLogo" src="bb_logo_lime.webp" alt="Bingo Beats">
        <div class="roundCategoryInline">
          <div class="questionColor"></div>
          <div><small>${escapeHtml(color.name)}</small><h1>${escapeHtml(round.category)}</h1></div>
        </div>
        ${stopwatchMarkup(round)}
        <div class="listenPrompt"><h2>Luister goed</h2><p>Vul je antwoord in voordat de stopwatch op 0 staat.</p></div>
      </section>
      <div class="playerPanel answerForm">
        <input class="participantAnswerInput" type="text" maxlength="100" placeholder="Typ je antwoord" autocomplete="off">
        <button type="button" data-game-action="submit">VERSTUUR</button>
      </div>
    </div>`;
  }

  function liveAnswersMarkup(room,round,userId){
    const answers = room.answers?.[round.id] || {};
    const submitted = activePlayers(room).filter(([id]) => answers[id]);
    if(!submitted.length){
      return '<p class="liveAnswersEmpty">Nog niemand heeft een antwoord ingestuurd.</p>';
    }
    return submitted.map(([id,player]) => `<article class="liveAnswerRow ${id===userId?'own':''}">
      <span>${playerAnimal(id,player)}</span>
      <div>
        <strong>${escapeHtml(player.name || 'Speler')}${id===userId?' · JIJ':''}</strong>
        <small>${escapeHtml(answers[id]?.answer || 'Geen antwoord')}</small>
      </div>
      <i>BINNEN ✓</i>
    </article>`).join('');
  }

  function submittedStateMarkup(room,round,userId){
    const color = colorForRound(round);
    const submittedCount = activePlayers(room).filter(([id]) => room.answers?.[round.id]?.[id]).length;
    const total = activePlayers(room).length;
    const banner = advantageBannerMarkup(room,round,userId);
    return `<div class="playerState submittedState ${banner?'hasAdvantage':''}" style="--round-color:${color.hex}">
      ${banner}
      <section class="playerPanel submittedLivePanel">
        <img class="roundMainLogo submittedMainLogo" src="bb_logo_lime.webp" alt="Bingo Beats">
        <div class="roundCategoryInline submittedCategory">
          <div class="questionColor"></div>
          <div><small>${escapeHtml(color.name)}</small><h1>${escapeHtml(round.category)}</h1></div>
        </div>
        <div class="submittedTimer">
          ${stopwatchMarkup(round)}
          <div><strong>Antwoord ingeleverd ✓</strong><small>${submittedCount} van ${total} antwoorden binnen</small></div>
        </div>
        <div class="liveAnswersHeader"><span>LIVE ANTWOORDEN</span><small>Nog zonder juryuitslag</small></div>
        <div class="liveAnswersList">${liveAnswersMarkup(room,round,userId)}</div>
      </section>
    </div>`;
  }

  function lockedMarkup(round){
    const answer = round.correctAnswer || {};
    return `<section class="playerPanel waitingCard">
      <span style="font-size:38px">🎵</span>
      <h1>Jury beoordeelt…</h1>
      <div class="trackAnswer"><strong>${escapeHtml(answer.track || '-')}</strong><small>${escapeHtml(answer.artist || '-')} · ${escapeHtml(answer.year || '-')}</small></div>
      <p>De uitslag verschijnt automatisch.</p>
    </section>`;
  }

  function resultStateMarkup(room,round,me,good,isHost){
    const picked = me.lastPickedRound===round.id;
    const canPick = good===true && !picked;
    if(!canPick) return roundScoreboardMarkup(room,round,isHost,currentUserId());
    const resultClass = good===true ? 'good' : 'bad';
    const resultTitle = good===true ? 'GOED ANTWOORD!' : 'HELAAS';
    const answer = round.correctAnswer || {};
    return `<div class="playerState resultState ${canPick?'pickMode':''}">
      <section class="playerPanel resultCard ${resultClass}">
        <span>${good===true?'😎':'🙈'}</span>
        <h1>${resultTitle}</h1>
        <p>${canPick?`Kies één vrij ${escapeHtml(round.colorName)} vakje.`:'Klik op READY voor de volgende ronde.'}</p>
        <div class="trackAnswer"><strong>${escapeHtml(answer.track || '-')}</strong><small>${escapeHtml(answer.artist || '-')} · ${escapeHtml(answer.year || '-')}</small></div>
      </section>
      <section class="playerPanel resultBoardPanel">
        <div class="bingoCard">${bingoCardHtml(me,round,canPick)}</div>
      </section>
      <div class="resultActions ${isHost?'withJury':''}">
        ${isHost?'<button type="button" class="juryButton" data-game-action="jury">JURY CONTROLEREN</button>':''}
        <button type="button" class="readyButton ${me.ready?'done':''}" data-game-action="ready" ${canPick||me.ready?'disabled':''}>${canPick?'KIES EERST EEN VAK':me.ready?'READY ✓':'READY'}</button>
      </div>
    </div>`;
  }

  function scoreboardRowsMarkup(room,round,block=false){
    const points = room.points?.[round.id] || {};
    const scores = block ? (room.gameState?.lastBlock?.scores || {}) : null;
    const ranking = activePlayers(room).sort((a,b) => {
      const aScore = block ? Number(scores?.[a[0]]||0) : Number(a[1].score||0);
      const bScore = block ? Number(scores?.[b[0]]||0) : Number(b[1].score||0);
      return bScore-aScore || Number(b[1].score||0)-Number(a[1].score||0);
    });
    return ranking.map(([id,player],index) => {
      const total = block ? Number(scores?.[id]||0) : Number(player.score||0);
      return `<article class="roundScoreRow ${index===0?'leader':''}">
        <b>${index+1}</b>
        <span>${playerAnimal(id,player)}</span>
        <div><strong>${escapeHtml(player.name || 'Speler')}</strong><small>${markedCount(player)} van 36 vakken</small></div>
        ${block ? '' : `<em>+${Number(points[id]||0)}</em>`}
        <strong>${total} <small>PT</small></strong>
      </article>`;
    }).join('');
  }

  function jokerLobbyMarkup(room,userId){
    const advantage = room.gameState?.activeAdvantage;
    const nextRound = Number(room.roundNumber||0)+1;
    if(advantage?.type!=='joker' || advantage.ownerId!==userId || advantage.jokerUsed || nextRound>Number(advantage.endRound||0)) return '';
    return `<button type="button" class="jokerActivateButton" data-game-action="joker">🃏 JOKER INZETTEN BIJ VOLGENDE NUMMER</button>`;
  }

  function roundScoreboardMarkup(room,round,isHost,userId){
    const me = room.players?.[userId] || {};
    const allReady = activePlayers(room).filter(([,player]) => player.ready).length;
    const answer = round.correctAnswer || {};
    return `<div class="playerState roundScoreState">
      <section class="playerPanel roundScorePanel">
        <div class="scoreboardTitle">
          <img src="bb_logo_lime.webp" alt="BB">
          <div><small>RONDE ${Number(round.number||0)} · SCOREBORD</small><h1>Stand na dit liedje</h1></div>
        </div>
        <div class="scoreTrack"><strong>${escapeHtml(answer.track || '-')}</strong><span>${escapeHtml(answer.artist || '-')} · ${escapeHtml(answer.year || '-')}</span></div>
        <div class="roundScoreRows">${scoreboardRowsMarkup(room,round,false)}</div>
        <div class="readyCounter">${allReady} / ${activePlayers(room).length} READY VOOR VOLGENDE RONDE</div>
      </section>
      ${jokerLobbyMarkup(room,userId)}
      <div class="resultActions ${isHost?'withJury':''}">
        ${isHost?'<button type="button" class="juryButton" data-game-action="jury">JURY CONTROLEREN</button>':''}
        <button type="button" class="readyButton ${me.ready?'done':''}" data-game-action="ready" ${me.ready?'disabled':''}>${me.ready?'READY ✓':'READY VOLGENDE RONDE'}</button>
      </div>
    </div>`;
  }

  function advantageChoicesMarkup(){
    return Object.entries(ADVANTAGES).map(([key,advantage]) => `<button type="button" data-game-action="advantage" data-advantage="${key}">
      <b>${advantage.icon} ${escapeHtml(advantage.name)}</b><small>${escapeHtml(advantage.text)}</small>
    </button>`).join('');
  }

  function blockScoreboardMarkup(room,round,isHost,userId){
    const me = room.players?.[userId] || {};
    const gameState = room.gameState || {};
    const pending = gameState.pendingAdvantageWinnerId;
    const winner = room.players?.[gameState.lastBlock?.winnerId] || {};
    const advantage = gameState.activeAdvantage;
    const canChoose = pending===userId;
    const waiting = pending && !canChoose;
    return `<div class="playerState blockScoreState">
      <section class="playerPanel blockScorePanel">
        <div class="scoreboardTitle blockTitle">
          <span>🏆</span>
          <div><small>BLOKSCOREBORD · RONDE 1–5</small><h1>${escapeHtml(gameState.lastBlock?.winnerName || winner.name || 'Blokwinnaar')} wint het blok</h1></div>
        </div>
        <div class="roundScoreRows">${scoreboardRowsMarkup(room,round,true)}</div>
        ${canChoose ? `<div class="advantageChoice"><strong>Kies jouw voordeel voor de volgende vier rondes</strong><div>${advantageChoicesMarkup()}</div></div>` : ''}
        ${waiting ? `<div class="advantageWaiting">Wachten tot ${escapeHtml(gameState.pendingAdvantageWinnerName || winner.name || 'de blokwinnaar')} een voordeel kiest…</div>` : ''}
        ${!pending && advantage ? `<div class="chosenAdvantage"><b>${ADVANTAGES[advantage.type]?.icon || '★'} ${escapeHtml(ADVANTAGES[advantage.type]?.name || 'Voordeel')}</b><span>Gekozen door ${escapeHtml(advantage.ownerName || 'de blokwinnaar')}</span></div>` : ''}
      </section>
      <div class="resultActions ${isHost?'withJury':''}">
        ${isHost?'<button type="button" class="juryButton" data-game-action="jury">JURY CONTROLEREN</button>':''}
        ${!pending ? `<button type="button" class="readyButton ${me.ready?'done':''}" data-game-action="ready" ${me.ready?'disabled':''}>${me.ready?'READY ✓':'READY NIEUW BLOK'}</button>` : ''}
      </div>
    </div>`;
  }

  function specialResultStateMarkup(room,round,me,userId,isHost){
    const result = room.specialResults?.[round.id]?.[userId] || {details:[false,false,false,false,false],count:0};
    const picked = me.lastPickedRound===round.id;
    const canPick = Number(result.count||0)>=4 && !picked;
    if(!canPick) return blockScoreboardMarkup(room,round,isHost,userId);
    const labels = SPECIAL_FIELDS.map((field,index) => `<span class="${result.details?.[index]?'good':'bad'}"><b>${result.details?.[index]?'✓':'×'}</b>${escapeHtml(field.label)}</span>`).join('');
    return `<div class="playerState resultState pickMode specialResultState">
      <section class="playerPanel resultCard good">
        <span>★</span><h1>${Number(result.count||0)} VAN 5 GOED</h1>
        <p>Kies één vrij vak naar keuze.</p>
        <div class="specialResultDetails">${labels}</div>
      </section>
      <section class="playerPanel resultBoardPanel">
        <div class="bingoCard">${bingoCardHtml(me,round,true,true)}</div>
      </section>
      <div class="resultActions ${isHost?'withJury':''}">
        ${isHost?'<button type="button" class="juryButton" data-game-action="jury">JURY CONTROLEREN</button>':''}
        <button type="button" class="readyButton" disabled>KIES EERST EEN VAK</button>
      </div>
    </div>`;
  }

  function finalScoreMarkup(room){
    const ranking = activePlayers(room).sort((a,b) => Number(b[1].score||0)-Number(a[1].score||0));
    const winner = room.winner || {};
    return `<section class="playerPanel finalScore">
      <span class="finalTrophy">🏆</span>
      <small>BINGO!</small>
      <h1>${escapeHtml(winner.name || ranking[0]?.[1]?.name || 'Winnaar')}</h1>
      <div class="finalRanking">${ranking.map(([id,player],index) => `
        <article class="scoreRow"><b>${index+1}</b><span>${playerAnimal(id,player)}</span><strong>${escapeHtml(player.name || 'Speler')}</strong><em>${Number(player.score)||0} punten</em></article>
      `).join('')}</div>
    </section>`;
  }

  function gameErrorMarkup(message){
    return `<section class="playerPanel waitingCard gameError">
      <span>⚠️</span><h1>Ronde gestopt</h1><p>${escapeHtml(message)}</p>
      <p>De host kan bij Muziek de Spotify-verbinding controleren en daarna een nieuwe kamer maken.</p>
    </section>`;
  }

  function bindGameActions(root,userId,isHost){
    if(isHost) return;
    root.querySelectorAll('.bingoCell.pickable').forEach(button => {
      button.addEventListener('click',() => pickBingoCell(userId,Number(button.dataset.index)));
    });
    root.querySelector('[data-game-action="ready"]')?.addEventListener('click',() => markReady(userId));
    root.querySelector('[data-game-action="submit"]')?.addEventListener('click',() => submitAnswer(userId,root));
    root.querySelector('[data-game-action="rules"]')?.addEventListener('click',() => $('rulesModal')?.classList.remove('hidden'));
    root.querySelector('[data-game-action="joker"]')?.addEventListener('click',activateJokerForNextRound);
    root.querySelectorAll('[data-game-action="advantage"]').forEach(button => {
      button.addEventListener('click',() => chooseAdvantage(button.dataset.advantage));
    });
    root.querySelector('.participantAnswerInput')?.addEventListener('keydown',event => {
      if(event.key==='Enter'){
        event.preventDefault();
        submitAnswer(userId,root);
      }
    });
  }

  function updateGameTimer(prefix,round,userId){
    clearInterval(state.timers[prefix]);
    const element = $(`${prefix}Timer`);
    const tick = () => {
      if(round.status==='answering' && round.deadlineMs){
        const left = secondsLeft(round,userId);
        const total = Math.max(1,Number(round.maxSeconds||round.seconds)||20);
        const progress = Math.max(0,Math.min(100,(left/total)*100));
        element.textContent = `00:${String(left).padStart(2,'0')}`;
        document.querySelectorAll('[data-stopwatch-round]').forEach(stopwatch => {
          if(stopwatch.dataset.stopwatchRound!==(round.id || '')) return;
          stopwatch.style.setProperty('--timer-progress',String(progress));
          stopwatch.classList.toggle('urgent',left<=5);
          const seconds = stopwatch.querySelector('[data-countdown-seconds]');
          if(seconds) seconds.textContent = String(left);
        });
      }else{
        element.textContent = ['judging','locked','judged'].includes(round.status) ? '00:00' : '--';
      }
    };
    tick();
    if(round.status==='answering') state.timers[prefix] = setInterval(tick,250);
  }

  async function submitAnswer(playerId,root){
    const round = state.room?.currentRound;
    if(!round?.id || round.status!=='answering') return;
    const deadline = effectiveDeadline(state.room,round,playerId);
    if(deadline && Date.now()>deadline) return;
    if(round.isBingoBeats){
      const values = {};
      root?.querySelectorAll('[data-special-field]').forEach(input => {
        values[input.dataset.specialField] = input.value.trim().slice(0,100);
      });
      if(Object.values(values).every(value => !value)) return;
      await state.db.ref(`rooms/${state.roomCode}/answers/${round.id}/${playerId}`).set({
        special:true,
        answers:values,
        answer:Object.values(values).join(' · '),
        submittedAt:firebase.database.ServerValue.TIMESTAMP
      });
      return;
    }
    const input = root?.querySelector('.participantAnswerInput');
    const answer = input?.value.trim() || '';
    if(!answer) return;
    await state.db.ref(`rooms/${state.roomCode}/answers/${round.id}/${playerId}`).set({
      answer,submittedAt:firebase.database.ServerValue.TIMESTAMP
    });
    input.value = '';
  }

  async function markReady(playerId){
    if(!playerId) return;
    await state.db.ref(`rooms/${state.roomCode}/players/${playerId}/ready`).set(true);
  }

  function bingoCardHtml(player,round,canPick,freeChoice=false){
    const card = Array.isArray(player?.card) ? player.card : [];
    const marked = player?.marked || {};
    const power = powerCellsFor(currentUserId(),card,player?.powerCells);
    return card.map((color,index) => {
      const colorInfo = COLORS.find(item => item.key===color);
      const isMarked = !!marked[index];
      const bombTriggered = (index===power.bombIndex && power.bombTriggered) || (index===power.bomb2Index && power.bomb2Triggered);
      const engineerVisible = index===power.engineerIndex && power.engineerFound;
      const pickable = canPick && (freeChoice || color===round?.colorKey) && !isMarked && !bombTriggered;
      const icon = bombTriggered ? '💣' : engineerVisible ? '👷' : isMarked ? '✓' : '';
      return `<button type="button" class="bingoCell ${isMarked?'marked':''} ${pickable?'pickable':''} ${bombTriggered?'bombLocked':''} ${engineerVisible?'engineerCell':''}" data-index="${index}" style="--cell:${colorInfo?.hex || '#777'}" ${pickable?'':'disabled'}><span>${icon}</span></button>`;
    }).join('');
  }

  async function pickBingoCell(playerId,index){
    const round = state.room?.currentRound;
    const good = state.room?.correct?.[round?.id]?.[playerId]===true;
    const specialCount = Number(state.room?.specialResults?.[round?.id]?.[playerId]?.count||0);
    const freeChoice = !!round?.isBingoBeats && specialCount>=4;
    if(round?.status!=='judged' || !good || !round?.id) return;
    const reference = state.db.ref(`rooms/${state.roomCode}/players/${playerId}`);
    let effect = '';
    let beforeMarked = {};
    let beforePower = {};
    let bingo = false;
    const transaction = await reference.transaction(current => {
      const player = current || {};
      const card = Array.isArray(player.card) ? player.card : [];
      const marked = {...(player.marked||{})};
      const power = powerCellsFor(playerId,card,player.powerCells);
      const bomb2Active = Number.isInteger(power.bomb2Index) && activeAdvantage(state.room || {},round)?.type==='doubleTrouble';
      const bomb1 = index===power.bombIndex && !power.bombTriggered;
      const bomb2 = bomb2Active && index===power.bomb2Index && !power.bomb2Triggered;
      if(!card[index] || marked[index] || player.lastPickedRound===round.id) return;
      if(!freeChoice && card[index]!==round.colorKey) return;
      if((index===power.bombIndex && power.bombTriggered) || (index===power.bomb2Index && power.bomb2Triggered)) return;
      beforeMarked = {...marked};
      beforePower = {...power};
      if(index===power.engineerIndex && !power.engineerFound){
        marked[index] = true;
        power.engineerFound = true;
        power.engineerActive = true;
        effect = 'engineer';
      }else if(bomb1 || bomb2){
        if(bomb1) power.bombTriggered = true;
        if(bomb2) power.bomb2Triggered = true;
        if(power.engineerActive && !power.engineerUsed){
          marked[index] = true;
          power.engineerUsed = true;
          power.engineerActive = false;
          effect = 'repaired';
        }else{
          Object.keys(marked).forEach(key => delete marked[key]);
          effect = 'bomb';
        }
      }else{
        marked[index] = true;
      }
      bingo = checkBingo(marked);
      return {
        ...player,
        marked,
        powerCells:power,
        bingo,
        lastPickedRound:round.id,
        lastPowerEffect:effect ? {type:effect,roundId:round.id,at:Date.now()} : null,
        ready:false
      };
    },false);
    if(!transaction.committed) return;
    const player = transaction.snapshot.val() || {};
    await state.db.ref(`rooms/${state.roomCode}`).update({
      [`pickedCells/${round.id}/${playerId}`]:{
        index,
        previousMarked:beforeMarked,
        previousPower:beforePower,
        effect:effect || ''
      }
    });
    if(bingo){
      const roomSnapshot = await state.db.ref(`rooms/${state.roomCode}`).once('value');
      const latestRoom = roomSnapshot.val() || {};
      if(!latestRoom.winner){
        await state.db.ref(`rooms/${state.roomCode}`).update({
          gameStatus:'finished',
          'currentRound/status':'finished',
          winner:{
            playerId,
            name:player.name || 'Speler',
            emoji:playerAnimal(playerId,player),
            roundId:round.id,
            at:firebase.database.ServerValue.TIMESTAMP
          }
        });
      }
      await state.db.ref(`rooms/${state.roomCode}/bingos`).push({
        playerId,
        name:player.name || 'Speler',
        roundId:round.id,
        at:firebase.database.ServerValue.TIMESTAMP
      });
    }
  }

  function maybeShowPowerEffect(player,round,userId){
    const effect = player?.lastPowerEffect;
    if(!effect?.type || effect.roundId!==round?.id) return;
    const key = `${userId}:${effect.roundId}:${effect.type}:${effect.at||''}`;
    if(state.powerEffectKey===key) return;
    state.powerEffectKey = key;
    const config = {
      bomb:{icon:'💥',title:'Beat Bomb!',text:'Al je gekozen vakken zijn verdwenen. De bom blijft geblokkeerd.'},
      repaired:{icon:'👷',title:'Engineer redt je kaart!',text:'Je Beat Engineer beschermt je. Je gekozen vakken blijven staan.'},
      engineer:{icon:'👷',title:'Beat Engineer gevonden!',text:'Je Engineer is nu actief en beschermt je één keer tegen een Beat Bomb.'}
    }[effect.type];
    if(!config) return;
    $('powerEffectIcon').textContent = config.icon;
    $('powerEffectTitle').textContent = config.title;
    $('powerEffectText').textContent = config.text;
    $('powerEffectOverlay').classList.remove('hidden');
  }

  async function chooseAdvantage(type){
    if(!ADVANTAGES[type] || !state.roomCode) return;
    const userId = currentUserId();
    const snapshot = await state.db.ref(`rooms/${state.roomCode}`).once('value');
    const room = snapshot.val() || {};
    if(room.gameState?.pendingAdvantageWinnerId!==userId) return;
    const startRound = Number(room.roundNumber||0)+1;
    const advantage = {
      type,
      ownerId:userId,
      ownerName:room.players?.[userId]?.name || 'Speler',
      startRound,
      endRound:startRound+3,
      chosenAt:firebase.database.ServerValue.TIMESTAMP,
      jokerUsed:false
    };
    const updates = {
      'gameState/activeAdvantage':advantage,
      'gameState/pendingAdvantageWinnerId':null,
      'gameState/pendingAdvantageWinnerName':null
    };
    Object.entries(room.players||{}).forEach(([id,player]) => {
      const power = powerCellsFor(id,player.card,player.powerCells);
      delete power.bomb2Index;
      power.bomb2Triggered = false;
      updates[`players/${id}/blockScore`] = 0;
      updates[`players/${id}/ready`] = false;
      updates[`players/${id}/powerCells`] = power;
    });
    if(type==='engineer'){
      const player = room.players?.[userId] || {};
      const power = powerCellsFor(userId,player.card,player.powerCells);
      delete power.bomb2Index;
      updates[`players/${userId}/powerCells`] = {
        ...power,
        bomb2Triggered:false,
        engineerFound:true,
        engineerActive:true,
        engineerUsed:false
      };
    }
    if(type==='doubleTrouble'){
      Object.entries(room.players||{}).forEach(([id,player]) => {
        if(id===userId) return;
        const power = powerCellsFor(id,player.card,player.powerCells);
        power.bomb2Index = secondBombIndex(id,player.card,power);
        power.bomb2Triggered = false;
        updates[`players/${id}/powerCells`] = power;
      });
    }
    await state.db.ref(`rooms/${state.roomCode}`).update(updates);
  }

  async function activateJokerForNextRound(){
    const userId = currentUserId();
    const snapshot = await state.db.ref(`rooms/${state.roomCode}`).once('value');
    const room = snapshot.val() || {};
    const advantage = room.gameState?.activeAdvantage;
    const nextRound = Number(room.roundNumber||0)+1;
    if(advantage?.type!=='joker' || advantage.ownerId!==userId || advantage.jokerUsed || nextRound>Number(advantage.endRound||0)) return;
    await state.db.ref(`rooms/${state.roomCode}/gameState/activeAdvantage`).update({
      jokerUsed:true,
      jokerRound:nextRound
    });
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
      navigator.serviceWorker.register('./sw.js?v=2120',{updateViaCache:'none'})
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
