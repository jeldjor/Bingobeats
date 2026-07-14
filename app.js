/* Bingo Beats V173 - clean rebuild */
'use strict';

const VERSION='173';
const CLIENT_ID='4765b89201b44558a7d5141f9b93c178';
const REDIRECT_URI=location.origin+location.pathname;
const SCOPES='streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state playlist-read-private playlist-read-collaborative';
const firebaseConfig={apiKey:'AIzaSyCcquz1mpz3FsmFFBKgJLgpbkHCajTUpzY',authDomain:'hitster-bingo-cb792.firebaseapp.com',databaseURL:'https://hitster-bingo-cb792-default-rtdb.europe-west1.firebasedatabase.app',projectId:'hitster-bingo-cb792',storageBucket:'hitster-bingo-cb792.firebasestorage.app',messagingSenderId:'98696776977',appId:'1:98696776977:web:e797e555e2d9b38bcc99b0'};
const TEST_LICENSE_CODE='TEST-2026';
const COLORS=[
  {key:'yellow',name:'GOUD',emoji:'🟡',hex:'#ffcc33',kind:'beforeafter',label:'Voor of na 2001'},
  {key:'pink',name:'AQUA',emoji:'🩵',hex:'#00d4c7',kind:'artist',label:'Naam van artiest'},
  {key:'purple',name:'ORANJE',emoji:'🟠',hex:'#ff8a1f',kind:'decade',label:'Decennium'},
  {key:'blue',name:'LIME',emoji:'🟢',hex:'#7ed957',kind:'year',label:'Jaartal +/- 2'},
  {key:'green',name:'KORAAL',emoji:'🔴',hex:'#ff5a5f',kind:'title',label:'Titel van track'}
];
const ANIMALS=['🦁','🐯','🐼','🦊','🐨','🐸','🐵','🦄','🐙','🦋','🐧','🦉','🐬','🦖','🐝','🐢','🦜','🐺','🦩','🐳','🦔','🐿️','🦦','🐮','🐷','🐰','🐱','🐶','🐹','🐻'];
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const pick=list=>list[Math.floor(Math.random()*list.length)];
const roomPath=(suffix='')=>`rooms/${state.roomCode}${suffix?'/'+suffix:''}`;
const serverNow=()=>Date.now()+state.serverOffset;

const state={
  db:null,roomCode:'',room:null,roomRef:null,serverOffset:0,mode:'host',hostPlaying:false,
  playerId:localStorage.bb_player_id||'',playerName:localStorage.bb_player_name||'',
  hostId:localStorage.bb_host_id||'',hostSecret:localStorage.bb_host_secret||'',
  tracks:readJSON('bb_tracks',[]),musicSource:localStorage.bb_music_source||'',sourceName:localStorage.bb_source_name||'',
  accessToken:localStorage.spotify_access_token||'',refreshToken:localStorage.spotify_refresh_token||'',expiresAt:Number(localStorage.spotify_expires_at||0),
  spotifyPlayer:null,deviceId:'',spotifyReady:false,currentTrack:null,currentTrackRound:'',
  renderSignature:'',hostSignature:'',heartbeat:null,roundTimer:null,autoStartBusy:false,toastTimer:null,
  installPrompt:null,keyboardOpen:false,lastFocusedAnswer:'',joined:false,disconnectRef:null
  ,regularPlayerId:'',regularPlayerName:'',cleanupAt:0,ownAnswers:{}
};

document.addEventListener('DOMContentLoaded',boot);
window.onSpotifyWebPlaybackSDKReady=()=>{state.spotifyReady=true;updateSpotifyStatus();};

async function boot(){
  wireStaticEvents();
  setupViewport();
  setupInstall();
  try{
    await waitForLibraries();
    if(!firebase.apps.length)firebase.initializeApp(firebaseConfig);
    state.db=firebase.database();
    state.db.ref('.info/serverTimeOffset').on('value',snap=>{state.serverOffset=Number(snap.val()||0);});
    await handleSpotifyRedirect();
    $('bootScreen').classList.add('hidden');
    $('app').classList.remove('hidden');
    if(!validLicense())showLicense();else await enterApplication();
    if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }catch(error){
    console.error(error);
    $('bootScreen').querySelector('p').textContent='De app kon niet laden. Controleer je internetverbinding.';
    $('bootRetry').classList.remove('hidden');
  }
}

function waitForLibraries(){
  return new Promise((resolve,reject)=>{
    const started=Date.now();
    const timer=setInterval(()=>{
      if(window.firebase?.database){clearInterval(timer);resolve();}
      else if(Date.now()-started>15000){clearInterval(timer);reject(new Error('Firebase niet geladen'));}
    },80);
  });
}

function wireStaticEvents(){
  $('bootRetry').onclick=()=>location.reload();
  $('licenseBtn').onclick=activateLicense;
  $('licenseInput').onkeydown=event=>{if(event.key==='Enter')activateLicense();};
  $('spotifyTab').onclick=()=>selectSourceTab('spotify');
  $('csvTab').onclick=()=>selectSourceTab('csv');
  $('loginBtn').onclick=spotifyLogin;
  $('logoutBtn').onclick=spotifyLogout;
  $('loadPlaylistsBtn').onclick=loadPlaylists;
  $('importPlaylistBtn').onclick=importSelectedPlaylist;
  $('csvFile').onchange=handleCsvFile;
  $('resetUsedBtn').onclick=resetUsedTracks;
  $('newRoomBtn').onclick=()=>confirmAction('Nieuwe kamer maken?','De huidige kamer blijft bestaan, maar je hostscherm gaat naar een nieuwe spelcode.',createRoom);
  $('resumeRoomBtn').onclick=resumeSavedRoom;
  $('hostPlayBtn').onclick=enterHostPlayerMode;
  $('joinBtn').onclick=joinRoom;
  $('playerName').onkeydown=event=>{if(event.key==='Enter')joinRoom();};
  $('leaveBtn').onclick=requestLeave;
  $('juryBtn').onclick=openHostJury;
  ['duration','noRepeat','randomStart','cat-yellow','cat-pink','cat-purple','cat-blue','cat-green'].forEach(id=>$(id).addEventListener('change',syncRoomSettings));
  $('modalRoot').addEventListener('click',event=>{if(event.target===$('modalRoot'))closeModal();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('modalRoot').classList.contains('hidden'))closeModal();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.joined)heartbeat();});
}

function setupViewport(){
  const update=()=>{
    const viewport=window.visualViewport;
    const height=viewport?.height||window.innerHeight;
    document.documentElement.style.setProperty('--visible-height',`${Math.round(height)}px`);
    const keyboard=!!viewport&&window.innerHeight-height>130;
    state.keyboardOpen=keyboard;
    document.body.classList.toggle('keyboard-open',keyboard);
  };
  update();
  window.visualViewport?.addEventListener('resize',update);
  window.visualViewport?.addEventListener('scroll',update);
  window.addEventListener('resize',update);
}

function setupInstall(){
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();state.installPrompt=event;$('installBtn').classList.remove('hidden');});
  $('installBtn').onclick=async()=>{if(!state.installPrompt)return;state.installPrompt.prompt();await state.installPrompt.userChoice;state.installPrompt=null;$('installBtn').classList.add('hidden');};
}

function validLicense(){const data=readJSON('bb_license',null);return data?.code===TEST_LICENSE_CODE&&data?.active===true;}
function showLicense(){hideViews();$('licenseView').classList.remove('hidden');$('modeLabel').textContent='Licentie';setTimeout(()=>$('licenseInput').focus(),80);}
function activateLicense(){
  const code=$('licenseInput').value.trim().toUpperCase();
  if(code!==TEST_LICENSE_CODE)return setMessage('licenseMessage','Ongeldige licentiecode.','error');
  localStorage.bb_license=JSON.stringify({code,active:true,activatedAt:new Date().toISOString()});
  setMessage('licenseMessage','Licentie geactiveerd.','success');
  setTimeout(enterApplication,250);
}

async function enterApplication(){
  hideViews();
  const params=new URLSearchParams(location.search);
  const code=(params.get('room')||'').trim().toUpperCase();
  if(code){state.mode='player';state.roomCode=code;$('playerView').classList.remove('hidden');$('modeLabel').textContent='Speler';$('joinRoomCode').textContent=code;$('playerName').value=state.playerName||'';return;}
  state.mode='host';$('hostView').classList.remove('hidden');$('modeLabel').textContent=`Host · V${VERSION}`;
  restoreSettings();updateMusicSummary();updateSpotifyStatus();
  const saved=localStorage.bb_host_room||'';
  if(saved){$('resumeRoomBtn').textContent=`HERVAT ${saved}`;$('resumeRoomBtn').classList.remove('hidden');await resumeRoom(saved,true);}
}

function hideViews(){['licenseView','hostView','playerView'].forEach(id=>$(id).classList.add('hidden'));}

function selectSourceTab(source){
  $('spotifyTab').classList.toggle('active',source==='spotify');$('csvTab').classList.toggle('active',source==='csv');
  $('spotifySource').classList.toggle('hidden',source!=='spotify');$('csvSource').classList.toggle('hidden',source!=='csv');
}

function restoreSettings(){
  const settings=readJSON('bb_settings',{});
  if(settings.duration)$('duration').value=String(settings.duration);
  if(typeof settings.noRepeat==='boolean')$('noRepeat').checked=settings.noRepeat;
  if(typeof settings.randomStart==='boolean')$('randomStart').checked=settings.randomStart;
  selectSourceTab(state.musicSource==='csv'?'csv':'spotify');
}

function saveSettings(){
  localStorage.bb_settings=JSON.stringify({duration:Number($('duration').value)||20,noRepeat:$('noRepeat').checked,randomStart:$('randomStart').checked});
}

async function spotifyLogin(){
  const verifier=randomString(96);localStorage.spotify_code_verifier=verifier;
  const challenge=base64Url(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
  location.href='https://accounts.spotify.com/authorize?'+new URLSearchParams({response_type:'code',client_id:CLIENT_ID,scope:SCOPES,code_challenge_method:'S256',code_challenge:challenge,redirect_uri:REDIRECT_URI});
}
function randomString(length){const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';const bytes=new Uint8Array(length);crypto.getRandomValues(bytes);return [...bytes].map(byte=>chars[byte%chars.length]).join('');}
function base64Url(buffer){return btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
async function handleSpotifyRedirect(){
  const params=new URLSearchParams(location.search),code=params.get('code');if(!code)return;
  const response=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:CLIENT_ID,grant_type:'authorization_code',code,redirect_uri:REDIRECT_URI,code_verifier:localStorage.spotify_code_verifier||''})});
  const data=await response.json();if(!response.ok||!data.access_token)throw new Error(data.error_description||'Spotify login mislukt');
  saveTokens(data);params.delete('code');history.replaceState({},document.title,location.pathname+(params.toString()?'?'+params:''));
}
function saveTokens(data){state.accessToken=data.access_token;if(data.refresh_token)state.refreshToken=data.refresh_token;state.expiresAt=Date.now()+Number(data.expires_in||3600)*1000-60000;localStorage.spotify_access_token=state.accessToken;if(state.refreshToken)localStorage.spotify_refresh_token=state.refreshToken;localStorage.spotify_expires_at=String(state.expiresAt);}
async function getToken(){
  if(state.accessToken&&Date.now()<state.expiresAt)return state.accessToken;
  if(!state.refreshToken)return'';
  const response=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:state.refreshToken,client_id:CLIENT_ID})});
  const data=await response.json();if(!response.ok||!data.access_token){spotifyLogout();return'';}saveTokens(data);return state.accessToken;
}
async function spotifyApi(url,options={}){
  const token=await getToken();if(!token)throw new Error('Log eerst in met Spotify.');
  const headers={...(options.headers||{}),Authorization:`Bearer ${token}`};if(options.body)headers['Content-Type']='application/json';
  const response=await fetch(url,{...options,headers});if(response.status===204)return{};
  const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error?.message||data.error_description||`Spotify-fout ${response.status}`);return data;
}
async function updateSpotifyStatus(){
  if(!$('spotifyStatus'))return;
  const token=await getToken().catch(()=>null);
  if(!token){$('spotifyStatus').textContent='Nog niet ingelogd.';return;}
  try{const me=await spotifyApi('https://api.spotify.com/v1/me');$('spotifyStatus').textContent=`Ingelogd als ${me.display_name||me.email||'Spotify-gebruiker'}.`;}
  catch{$('spotifyStatus').textContent='Spotify-sessie moet opnieuw worden verbonden.';}
}
function spotifyLogout(){
  ['spotify_access_token','spotify_refresh_token','spotify_expires_at','bb_spotify_test_at'].forEach(key=>localStorage.removeItem(key));
  state.accessToken=state.refreshToken='';state.expiresAt=0;state.deviceId='';state.spotifyPlayer?.disconnect?.();state.spotifyPlayer=null;updateSpotifyStatus();
}

async function ensureSpotifyPlayer(){
  const token=await getToken();if(!token)throw new Error('Log eerst in met Spotify.');
  if(!window.Spotify)await waitForSpotifySdk();
  if(state.spotifyPlayer&&state.deviceId)return state.deviceId;
  if(!state.spotifyPlayer){
    state.spotifyPlayer=new Spotify.Player({name:'Bingo Beats',getOAuthToken:async callback=>callback(await getToken()),volume:.8});
    state.spotifyPlayer.addListener('ready',({device_id})=>{state.deviceId=device_id;});
    state.spotifyPlayer.addListener('not_ready',()=>{state.deviceId='';});
    state.spotifyPlayer.addListener('authentication_error',({message})=>toast(message,true));
    state.spotifyPlayer.addListener('account_error',()=>toast('Voor afspelen via Bingo Beats is Spotify Premium nodig.',true));
  }
  await state.spotifyPlayer.connect();
  const started=Date.now();while(!state.deviceId&&Date.now()-started<7000)await wait(100);
  if(!state.deviceId)throw new Error('De Bingo Beats Spotify-speler werd niet actief. Controleer Spotify Premium en probeer opnieuw.');
  return state.deviceId;
}
function waitForSpotifySdk(){return new Promise((resolve,reject)=>{const started=Date.now();const timer=setInterval(()=>{if(window.Spotify){clearInterval(timer);resolve();}else if(Date.now()-started>10000){clearInterval(timer);reject(new Error('Spotify-speler kon niet laden.'));}},100);});}

async function testSpotify(showSuccess=true){
  try{
    const device=await ensureSpotifyPlayer();
    await spotifyApi('https://api.spotify.com/v1/me/player',{method:'PUT',body:JSON.stringify({device_ids:[device],play:false})});
    const sample=state.tracks[0];
    if(sample){const position=smartFragmentStart(sample.duration_ms||180000,1000);await spotifyApi(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(device)}`,{method:'PUT',body:JSON.stringify({uris:[sample.uri],position_ms:position})});await wait(900);await spotifyApi('https://api.spotify.com/v1/me/player/pause',{method:'PUT',body:'{}'});}
    localStorage.bb_spotify_test_at=String(Date.now());
    if(state.roomCode)await state.db.ref(roomPath('meta')).update({autoStartBlocked:false,lastError:null,updatedAt:firebase.database.ServerValue.TIMESTAMP});
    if(showSuccess)toast('Spotify-speler is klaar voor het spel.');return true;
  }catch(error){if(showSuccess)toast(error.message,true);return false;}
}

async function loadPlaylists(){
  try{
    $('loadPlaylistsBtn').disabled=true;$('loadPlaylistsBtn').textContent='LADEN…';
    let url='https://api.spotify.com/v1/me/playlists?limit=50',items=[];
    while(url){const page=await spotifyApi(url);items.push(...(page.items||[]));url=page.next;}
    $('playlistSelect').innerHTML=items.map(item=>`<option value="${esc(item.id)}">${esc(item.name)} (${Number(item.tracks?.total||0)})</option>`).join('');
    $('playlistField').classList.remove('hidden');$('importPlaylistBtn').classList.remove('hidden');
    if(!items.length)throw new Error('Geen playlists gevonden in dit account.');
  }catch(error){toast(error.message,true);}finally{$('loadPlaylistsBtn').disabled=false;$('loadPlaylistsBtn').textContent='MIJN PLAYLISTS LADEN';}
}

async function importSelectedPlaylist(){
  const id=$('playlistSelect').value;if(!id)return;
  try{
    $('importPlaylistBtn').disabled=true;$('importPlaylistBtn').textContent='IMPORTEREN…';
    let url=`https://api.spotify.com/v1/playlists/${encodeURIComponent(id)}/tracks?limit=100&market=NL`,tracks=[],skipped=0;
    while(url){const page=await spotifyApi(url);for(const item of page.items||[]){const track=item.track;if(!track?.id||track.is_local||!track.uri){skipped++;continue;}tracks.push(normalizeSpotifyTrack(track));}url=page.next;}
    const unique=[...new Map(tracks.map(track=>[track.id,track])).values()];if(!unique.length)throw new Error('Deze playlist bevat geen afspeelbare Spotify-tracks.');
    state.tracks=unique;state.musicSource='spotify';state.sourceName=$('playlistSelect').selectedOptions[0]?.textContent||'Spotify-playlist';persistTracks();updateMusicSummary();
    toast(`${unique.length} nummers geladen${skipped?`; ${skipped} niet-beschikbare nummers overgeslagen`:''}.`);
  }catch(error){toast(error.message,true);}finally{$('importPlaylistBtn').disabled=false;$('importPlaylistBtn').textContent='PLAYLIST GEBRUIKEN';}
}
function normalizeSpotifyTrack(track){return{id:track.id,uri:track.uri,name:track.name||'Onbekend',artists:(track.artists||[]).map(a=>a.name).join(', ')||'Onbekend',album:track.album?.name||'',release_date:track.album?.release_date||'',duration_ms:Number(track.duration_ms)||180000};}

function handleCsvFile(event){
  const file=event.target.files?.[0];if(!file)return;
  const reader=new FileReader();reader.onload=()=>{try{const result=parseTrackCsv(reader.result);state.tracks=result.tracks;state.musicSource='csv';state.sourceName=file.name;persistTracks();updateMusicSummary();toast(`${result.tracks.length} nummers geladen${result.errors.length?`; ${result.errors.length} regels overgeslagen`:''}.`);if(result.errors.length)showCsvErrors(result.errors);}catch(error){toast(error.message,true);}};reader.readAsText(file);
}
function parseTrackCsv(text){
  const rows=parseCsvRows(text);if(rows.length<2)throw new Error('Het CSV-bestand bevat geen nummers.');
  const headers=rows[0].map(normalizeHeader),find=names=>headers.findIndex(header=>names.map(normalizeHeader).includes(header));
  const uriIndex=find(['Track URI','Spotify URI','URI']),titleIndex=find(['Track Name','Name','Title']),artistIndex=find(['Artist Name(s)','Artist Names','Artists','Artist']);
  const albumIndex=find(['Album Name','Album']),releaseIndex=find(['Release Date','Release']),durationIndex=find(['Duration (ms)','Duration']);
  if(uriIndex<0||titleIndex<0||artistIndex<0)throw new Error('CSV mist Track URI, Track Name of Artist Name(s).');
  const tracks=[],errors=[],seen=new Set();
  rows.slice(1).forEach((row,index)=>{const id=trackId(row[uriIndex]);if(!id){errors.push(`Regel ${index+2}: ongeldige Track URI`);return;}if(seen.has(id)){errors.push(`Regel ${index+2}: dubbel nummer`);return;}seen.add(id);tracks.push({id,uri:`spotify:track:${id}`,name:String(row[titleIndex]||'').trim()||'Onbekend',artists:String(row[artistIndex]||'').trim()||'Onbekend',album:albumIndex>=0?String(row[albumIndex]||'').trim():'',release_date:releaseIndex>=0?String(row[releaseIndex]||'').trim():'',duration_ms:Math.max(30000,Number(row[durationIndex])||180000)});});
  if(!tracks.length)throw new Error('Geen geldige Spotify-tracks gevonden in de CSV.');return{tracks,errors};
}
function parseCsvRows(text){let rows=[],row=[],cell='',quoted=false;for(let index=0;index<text.length;index++){const char=text[index],next=text[index+1];if(char==='"'&&quoted&&next==='"'){cell+='"';index++;}else if(char==='"')quoted=!quoted;else if(char===','&&!quoted){row.push(cell);cell='';}else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&next==='\n')index++;row.push(cell);cell='';if(row.some(value=>value.trim()))rows.push(row);row=[];}else cell+=char;}row.push(cell);if(row.some(value=>value.trim()))rows.push(row);return rows;}
function normalizeHeader(value){return String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function trackId(value){const text=String(value||'').trim(),match=text.match(/spotify:track:([a-zA-Z0-9]+)/)||text.match(/track\/([a-zA-Z0-9]+)/);return match?.[1]||(/^[a-zA-Z0-9]{15,}$/.test(text)?text:'');}
function showCsvErrors(errors){openModal(`<div class="modal-card"><h2>CSV-controle</h2><p>${errors.length} regels zijn niet gebruikt:</p><div class="jury-list">${errors.slice(0,30).map(error=>`<div class="jury-item">${esc(error)}</div>`).join('')}</div>${errors.length>30?`<p class="muted">En nog ${errors.length-30} regels.</p>`:''}<div class="modal-actions"><button class="button" data-close>SLUITEN</button></div></div>`);}
function persistTracks(){localStorage.bb_tracks=JSON.stringify(state.tracks);localStorage.bb_music_source=state.musicSource;localStorage.bb_source_name=state.sourceName;}
function updateMusicSummary(){const box=$('musicSummary');if(!box)return;if(state.tracks.length){box.classList.add('ready');box.innerHTML=`<strong>✓ ${state.tracks.length} nummers klaar</strong><br><span>${esc(state.sourceName||state.musicSource)}</span>`;}else{box.classList.remove('ready');box.textContent='Nog geen muziek gekozen.';}}
function resetUsedTracks(){localStorage.removeItem('bb_used_tracks');toast('Alle nummers kunnen weer gekozen worden.');}

function ensureHostIdentity(){
  if(!state.hostId){state.hostId=`h_${cryptoId()}`;localStorage.bb_host_id=state.hostId;}
  if(!state.hostSecret){state.hostSecret=randomString(32);localStorage.bb_host_secret=state.hostSecret;}
}
function cryptoId(){const bytes=new Uint8Array(9);crypto.getRandomValues(bytes);return [...bytes].map(byte=>byte.toString(36)).join('').slice(0,14);}
function newRoomCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',bytes=new Uint8Array(6);crypto.getRandomValues(bytes);return [...bytes].map(byte=>chars[byte%chars.length]).join('');}
function getCategories(){return Object.fromEntries(COLORS.map(color=>[color.key,{label:$(`cat-${color.key}`).value||color.label,kind:color.kind,name:color.name,emoji:color.emoji,hex:color.hex}]));}

async function createRoom(){
  if(!state.tracks.length)return toast('Kies eerst een Spotify-playlist of CSV-bestand.',true);
  ensureHostIdentity();saveSettings();
  try{
    let code='',created=false;
    for(let attempt=0;attempt<8&&!created;attempt++){
      code=newRoomCode();
      const result=await state.db.ref(`rooms/${code}`).transaction(current=>current===null?{
        meta:{createdAt:firebase.database.ServerValue.TIMESTAMP,updatedAt:firebase.database.ServerValue.TIMESTAMP,hostId:state.hostId,hostKey:hashText(state.hostSecret),version:VERSION,gameNumber:1,roundNumber:0,autoStartBlocked:true,lastError:'Test eerst de muziek. Daarna starten rondes automatisch zodra iedereen Ready is.'},
        categories:getCategories(),settings:{duration:Number($('duration').value)||20,noRepeat:$('noRepeat').checked,randomStart:$('randomStart').checked},currentRound:{status:'lobby',number:0}
      }:undefined,false);
      created=result.committed;
    }
    if(!created)throw new Error('Er kon geen unieke spelcode worden gemaakt. Probeer opnieuw.');
    state.roomCode=code;localStorage.bb_host_room=code;await subscribeRoom(code);renderRoomShare();$('hostPlayBtn').classList.remove('hidden');toast(`Kamer ${code} is klaar.`);
  }catch(error){toast(error.message,true);}
}

function hashText(value){let hash=2166136261;for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(36);}
async function resumeSavedRoom(){const saved=localStorage.bb_host_room;if(saved)await resumeRoom(saved,false);}
async function resumeRoom(code,silent=false){
  ensureHostIdentity();
  try{
    const snap=await state.db.ref(`rooms/${code}`).once('value');
    if(!snap.exists()){localStorage.removeItem('bb_host_room');$('resumeRoomBtn').classList.add('hidden');if(!silent)toast('Deze kamer bestaat niet meer.',true);return;}
    const room=snap.val()||{};
    if(room.meta?.hostId&&room.meta.hostId!==state.hostId){if(!silent)toast('Deze kamer hoort bij een andere hostbrowser.',true);return;}
    state.roomCode=code;await subscribeRoom(code);renderRoomShare();$('hostPlayBtn').classList.remove('hidden');$('resumeRoomBtn').classList.add('hidden');if(!silent)toast(`Kamer ${code} hervat.`);
  }catch(error){if(!silent)toast(error.message,true);}
}

async function subscribeRoom(code){
  state.roomRef?.off();state.roomRef=state.db.ref(`rooms/${code}`);state.roomCode=code;state.hostSignature='';state.renderSignature='';
  state.roomRef.on('value',snapshot=>{state.room=snapshot.val()||null;if(!state.room){handleRoomRemoved();return;}onRoomUpdate();},error=>toast(`Verbinding met kamer verbroken: ${error.message}`,true));
}

function handleRoomRemoved(){
  toast('De kamer bestaat niet meer.',true);state.room=null;state.roomCode='';state.roomRef?.off();state.roomRef=null;
  if(state.mode==='player')location.href=location.pathname;else renderHost();
}

function onRoomUpdate(){
  if(state.mode==='host')renderHost();
  else renderPlayer();
  ensureRoundTimer();
  if(isHostController())maybeAutoStart();
  if(isHostController())maybeFinalizeVotes();
  if(isHostController())maybeFinalizeAllJury();
}

async function syncRoomSettings(){
  saveSettings();if(!state.roomCode||!isHostController())return;
  await state.db.ref(roomPath()).update({categories:getCategories(),settings:{duration:Number($('duration').value)||20,noRepeat:$('noRepeat').checked,randomStart:$('randomStart').checked},'meta/updatedAt':firebase.database.ServerValue.TIMESTAMP}).catch(()=>{});
}

function cleanupStalePlayers(){
  if(!isHostController()||Date.now()-state.cleanupAt<60000)return;state.cleanupAt=Date.now();
  const cutoff=serverNow()-5*60*1000,updates={};
  Object.entries(state.room?.players||{}).forEach(([id,player])=>{if(player.online===false&&Number(player.lastSeen||0)<cutoff)updates[id]=null;});
  if(Object.keys(updates).length)state.db.ref(roomPath('players')).update(updates).catch(()=>{});
}

function renderRoomShare(){
  if(!state.roomCode)return;
  const link=`${location.origin}${location.pathname}?room=${state.roomCode}`;
  $('roomShare').classList.remove('hidden');
  $('roomShare').innerHTML=`<div><div class="eyebrow">SPELCODE</div><div class="room-code">${esc(state.roomCode)}</div><div class="room-link-row"><input value="${esc(link)}" readonly aria-label="Kamerlink"><button class="button secondary" data-copy-link type="button">KOPIEER</button></div></div><img src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(link)}" alt="QR-code naar kamer ${esc(state.roomCode)}">`;
  $('roomShare').querySelector('[data-copy-link]').onclick=async event=>{try{await navigator.clipboard.writeText(link);}catch{const input=$('roomShare').querySelector('input');input.select();document.execCommand('copy');}event.currentTarget.textContent='GEKOPIEERD';setTimeout(()=>event.currentTarget.textContent='KOPIEER',1200);};
}

async function joinRoom(){
  const name=$('playerName').value.trim();if(!name)return setMessage('joinMessage','Vul eerst je naam in.','error');
  $('joinBtn').disabled=true;setMessage('joinMessage','Kamer controleren…');
  try{
    const roomSnap=await state.db.ref(`rooms/${state.roomCode}`).once('value');
    if(!roomSnap.exists()||!roomSnap.val()?.meta)throw new Error('Deze kamer bestaat niet. Vraag de host om een nieuwe QR-code.');
    const room=roomSnap.val();if(room.currentRound?.status==='ended')throw new Error('Dit spel is beëindigd. Vraag de host om een nieuwe kamer.');
    if(!state.playerId)state.playerId=`p_${cryptoId()}`;
    const ref=state.db.ref(`rooms/${state.roomCode}/players/${state.playerId}`),existing=(await ref.once('value')).val()||{};
    const duplicate=Object.entries(room.players||{}).some(([id,player])=>id!==state.playerId&&player.online!==false&&normalizeText(player.name)===normalizeText(name));
    if(duplicate)throw new Error('Deze naam is al in gebruik. Kies een andere naam.');
    const animal=existing.avatar||chooseAnimal(room.players||{},state.playerId);
    await ref.update({name,avatar,online:true,ready:true,isHost:false,joinedAt:existing.joinedAt||firebase.database.ServerValue.TIMESTAMP,lastSeen:firebase.database.ServerValue.TIMESTAMP,score:Number(existing.score)||0,card:existing.card||generateCard(state.playerId),marked:existing.marked||{},gameNumber:Number(room.meta?.gameNumber)||1});
    await attachPlayer(ref,name,false);
  }catch(error){setMessage('joinMessage',error.message,'error');$('joinBtn').disabled=false;}
}

async function attachPlayer(ref,name,isHost){
  state.playerName=name;localStorage.bb_player_id=state.playerId;localStorage.bb_player_name=name;localStorage.bb_player_room=state.roomCode;
  state.disconnectRef=ref;await ref.child('online').onDisconnect().set(false);state.joined=true;startHeartbeat();
  state.ownAnswers=readJSON(`bb_own_answers_${state.roomCode}_${state.playerId}`,{});
  $('joinView').classList.add('hidden');$('gameView').classList.remove('hidden');$('leaveBtn').textContent=isHost?'TERUG':'VERLATEN';$('playerIdentity').textContent=name;
  await subscribeRoom(state.roomCode);renderPlayer();
}

function chooseAnimal(players,id){
  const used=new Set(Object.values(players).filter(player=>player.online!==false).map(player=>player.avatar));
  let start=parseInt(hashText(id),36)%ANIMALS.length;
  for(let offset=0;offset<ANIMALS.length;offset++){const animal=ANIMALS[(start+offset)%ANIMALS.length];if(!used.has(animal))return animal;}
  return ANIMALS[start];
}

async function enterHostPlayerMode(){
  if(!state.roomCode||!state.room)return toast('Maak eerst een kamer.',true);
  ensureHostIdentity();
  let name=localStorage.bb_host_player_name||'Host';
  const result=prompt('Naam van de host/speler:',name);if(result===null)return;name=result.trim()||'Host';localStorage.bb_host_player_name=name;
  state.regularPlayerId=state.playerId;state.regularPlayerName=state.playerName;
  state.hostPlaying=true;state.mode='player';state.playerId=`host_${state.hostId}`;state.playerName=`🎤 ${name}`;
  const ref=state.db.ref(`rooms/${state.roomCode}/players/${state.playerId}`),existing=(await ref.once('value')).val()||{};
  await ref.update({name:state.playerName,avatar:existing.avatar||chooseAnimal(state.room.players||{},state.playerId),online:true,ready:true,isHost:true,joinedAt:existing.joinedAt||firebase.database.ServerValue.TIMESTAMP,lastSeen:firebase.database.ServerValue.TIMESTAMP,score:Number(existing.score)||0,card:existing.card||generateCard(state.playerId),marked:existing.marked||{},gameNumber:Number(state.room.meta?.gameNumber)||1});
  $('hostView').classList.add('hidden');$('playerView').classList.remove('hidden');$('joinView').classList.add('hidden');$('gameView').classList.remove('hidden');$('modeLabel').textContent='Host speelt mee';$('juryBtn').classList.remove('hidden');
  await attachPlayer(ref,state.playerName,true);
}

function startHeartbeat(){clearInterval(state.heartbeat);heartbeat();state.heartbeat=setInterval(heartbeat,20000);}
function heartbeat(){if(!state.joined||!state.roomCode||!state.playerId)return;state.db.ref(`rooms/${state.roomCode}/players/${state.playerId}`).update({online:true,lastSeen:firebase.database.ServerValue.TIMESTAMP}).catch(()=>{});}
function activePlayers(room=state.room){return Object.entries(room?.players||{}).filter(([,player])=>player.online!==false);}
function allActiveReady(room=state.room){const players=activePlayers(room);return players.length>0&&players.every(([,player])=>player.ready===true);}
function isHostController(){return !!state.roomCode&&state.room?.meta?.hostId===state.hostId&&(state.mode==='host'||state.hostPlaying);}

function renderHost(){
  const room=state.room,round=room?.currentRound||{status:'lobby'};cleanupStalePlayers();
  $('connectionBadge').textContent=room?'ONLINE':'GEEN KAMER';$('connectionBadge').classList.toggle('online',!!room);
  if(!room){$('hostStageTitle').textContent='Maak eerst een kamer';$('hostPlayers').className='players-grid empty-state';$('hostPlayers').textContent='Nog geen spelers.';$('hostRound').classList.add('hidden');$('hostActions').innerHTML='';return;}
  const players=activePlayers(room),signature=JSON.stringify({status:round.status,id:round.id,deadline:round.deadlineMs,players:players.map(([id,p])=>[id,p.name,p.avatar,p.ready,p.score]),answers:Object.keys(room.answerReceipts?.[round.id]||{}).length,results:room.results?.[round.id],decision:room.decision,blocked:room.meta?.autoStartBlocked});
  if(signature===state.hostSignature)return;state.hostSignature=signature;
  $('hostStageTitle').textContent=hostStageTitle(round,players);
  $('hostPlayers').className=players.length?'players-grid':'players-grid empty-state';
  $('hostPlayers').innerHTML=players.length?players.map(([id,player])=>playerChip(id,player)).join(''):'Scan de QR-code om mee te doen.';
  renderHostRound(room,round);renderHostActions(room,round);renderHostScore(room,round);
}

function hostStageTitle(round,players){
  if(round.status==='ended')return'Spel beëindigd';
  if(['picking','ready','answering','judging','review'].includes(round.status))return`Ronde ${round.number||1}`;
  const ready=players.filter(([,p])=>p.ready).length;return`${ready} van ${players.length} spelers Ready`;
}
function playerChip(id,player){return`<div class="player-chip ${player.ready?'ready':''} ${player.online===false?'offline':''}"><span class="avatar">${esc(player.avatar||'🎵')}</span><span class="name">${esc(cleanName(player.name))}</span><span class="ready-state">${player.ready?'READY':'WACHT'}</span></div>`;}

function renderHostRound(room,round){
  const block=$('hostRound');
  if(!round.id&&round.status!=='ended'){block.classList.add('hidden');block.innerHTML='';return;}
  block.classList.remove('hidden');
  const color=COLORS.find(item=>item.key===round.colorKey),answer=round.correctAnswer;
  let html='';
  if(round.status==='ended')html='<div class="answer-reveal"><h3>Het spel is beëindigd</h3><p>Start een nieuw spel of maak een nieuwe kamer.</p></div>';
  else html=`<div class="round-main"><div class="round-color" style="--round-color:${esc(color?.hex||'#7ed957')}">${esc(round.colorEmoji||'🎵')}</div><div><h3>${esc(round.colorName||'Kleur wordt gekozen…')}</h3><p>${esc(round.category||'Nog even geduld')}</p></div></div>${round.status==='answering'?`<div class="timer" data-timer>${formatTimer(round.deadlineMs)}</div>`:''}`;
  if(answer)html+=answerReveal(answer,round.fact);
  block.innerHTML=html;
}

function renderHostActions(room,round){
  const decision=room.decision;
  if(decision?.status==='open'){
    let html='';
    if(decision.phase==='choose_mode')html=`<button class="button" data-decision-mode="host">HOST KIEST</button><button class="button secondary" data-decision-mode="vote">MEERDERHEID KIEST</button>`;
    else if(decision.mode==='host')html=`<button class="button" data-host-outcome="continue">VERDER SPELEN</button><button class="button secondary" data-host-outcome="newgame">NIEUW SPEL</button><button class="button danger" data-host-outcome="end">SPEL BEËINDIGEN</button>`;
    else if(decision.mode==='vote'){
      const voteId=hostVoteId(),own=decision.votes?.[voteId],counts=countDecisionVotes(room);
      html=own?`<div class="ready-banner">Hoststem: ${decisionLabel(own)} · Verder ${counts.continue} · Nieuw ${counts.newgame} · Stop ${counts.end}</div>`:`<button class="button" data-host-vote="continue">VERDER SPELEN</button><button class="button secondary" data-host-vote="newgame">NIEUW SPEL</button><button class="button danger" data-host-vote="end">SPEL BEËINDIGEN</button>`;
    }
    $('hostActions').innerHTML=html;
    $('hostActions').querySelectorAll('[data-decision-mode]').forEach(button=>button.onclick=()=>chooseDecisionMode(button.dataset.decisionMode));
    $('hostActions').querySelectorAll('[data-host-outcome]').forEach(button=>button.onclick=()=>resolveDecision(button.dataset.hostOutcome));
    $('hostActions').querySelectorAll('[data-host-vote]').forEach(button=>button.onclick=()=>castDecisionVote(button.dataset.hostVote,hostVoteId()));
    $('hostMessage').textContent='Bingo! Kies hoe het spel verdergaat.';return;
  }
  const actions=[];
  if(room.meta?.autoStartBlocked)actions.push(`<button class="button" data-action="test">TEST MUZIEK OPNIEUW</button>`);
  else if(!['picking','ready','answering','judging','review'].includes(round.status)&&activePlayers(room).length)actions.push(`<button class="button secondary" data-action="test">TEST MUZIEK</button>`);
  if(round.status==='answering')actions.push(`<button class="button secondary" data-action="stop">STOP FRAGMENT</button>`);
  if(['review','results'].includes(round.status))actions.push(`<button class="button secondary" data-action="jury">JURY / OVERRULE</button>`);
  if(round.status==='ended')actions.push(`<button class="button" data-action="newgame">NIEUW SPEL</button>`);
  $('hostActions').innerHTML=actions.join('');
  $('hostActions').querySelector('[data-action="test"]')?.addEventListener('click',()=>testSpotify(true));
  $('hostActions').querySelector('[data-action="stop"]')?.addEventListener('click',()=>stopPlayback(true));
  $('hostActions').querySelector('[data-action="jury"]')?.addEventListener('click',openHostJury);
  $('hostActions').querySelector('[data-action="newgame"]')?.addEventListener('click',()=>confirmAction('Nieuw spel starten?','Spelers blijven in dezelfde kamer en krijgen een nieuwe kaart. Scores en rondes worden gewist.',resetGame));
  $('hostMessage').textContent=hostStatusMessage(room,round);
}
function hostStatusMessage(room,round){
  if(room.meta?.autoStartBlocked)return room.meta.lastError||'Automatisch starten is gepauzeerd. Test de muziek opnieuw.';
  if(round.status==='answering')return`${Object.keys(room.answerReceipts?.[round.id]||{}).length} van ${activePlayers(room).length} antwoorden ontvangen.`;
  if(round.status==='review')return'De jury beoordeelt één of meer twijfelgevallen.';
  if(round.status==='results')return'Wachten tot iedereen Ready is voor de volgende ronde.';
  if(allActiveReady(room))return'Iedereen is Ready. De ronde start automatisch.';
  return'Wachten tot alle actieve spelers Ready zijn.';
}

function renderHostScore(room,round){
  const card=$('hostScoreCard');if(!round.id||!['review','results','decision','ended'].includes(round.status)){card.classList.add('hidden');return;}
  card.classList.remove('hidden');const results=room.results?.[round.id]||{},answers=room.answers?.[round.id]||{};
  const players=Object.entries(room.players||{}).sort((a,b)=>(b[1].score||0)-(a[1].score||0));
  $('hostScoreboard').innerHTML=`<div class="score-table">${players.map(([id,player])=>{const result=results[id],stateClass=result?.status==='good'?'good':result?.status==='review'?'review':'bad';return`<div class="score-row"><strong>${esc(player.avatar||'🎵')} ${esc(cleanName(player.name))}</strong><span class="score-answer">${esc(answers[id]?.answer||'Geen antwoord')}</span><span class="score-state ${stateClass}">${result?.status==='good'?'GOED':result?.status==='review'?'JURY':'FOUT'}</span><span class="score-points">${Number(player.score)||0}</span></div>`;}).join('')}</div>`;
}

async function maybeAutoStart(){
  const room=state.room,round=room?.currentRound||{};
  if(state.autoStartBusy||!state.tracks.length||room?.meta?.autoStartBlocked||room?.decision?.status==='open')return;
  if(!['lobby','results','complete',''].includes(round.status||'lobby')||!allActiveReady(room))return;
  state.autoStartBusy=true;
  try{await startRoundAtomic();}finally{state.autoStartBusy=false;}
}

async function startRoundAtomic(){
  const ref=state.db.ref(roomPath('currentRound'));
  const roundNumber=Number(state.room?.meta?.roundNumber||0)+1,roundId=`r_${serverNow()}_${cryptoId().slice(0,5)}`;
  const claim=await ref.transaction(current=>{
    const status=current?.status||'lobby';
    if(!['lobby','results','complete',''].includes(status))return;
    return{id:roundId,number:roundNumber,status:'starting',claimedBy:state.hostId,claimedAt:firebase.database.ServerValue.TIMESTAMP};
  },false);
  if(!claim.committed)return;
  let track=null;
  try{
    const latest=(await state.db.ref(roomPath()).once('value')).val()||{};
    if(!allActiveReady(latest))throw new Error('Niet alle actieve spelers zijn meer Ready.');
    track=chooseTrack();if(!track)throw new Error('Er zijn geen nummers beschikbaar. Kies opnieuw een playlist of reset gespeelde nummers.');
    state.currentTrack=track;state.currentTrackRound=roundId;localStorage[`bb_round_track_${state.roomCode}`]=JSON.stringify({roundId,track});
    const device=await ensureSpotifyPlayer();
    const color=pick(COLORS),category=latest.categories?.[color.key]||color,duration=Math.min(25,Math.max(20,Number(latest.settings?.duration||$('duration').value||20)));
    const update={};
    activePlayers(latest).forEach(([id])=>{update[`players/${id}/ready`]=false;});
    update.currentRound={id:roundId,number:roundNumber,status:'picking',claimedBy:state.hostId,claimedAt:firebase.database.ServerValue.TIMESTAMP,colorKey:color.key,colorName:category.name||color.name,colorEmoji:category.emoji||color.emoji,colorHex:category.hex||color.hex,category:category.label||color.label,categoryKind:category.kind||color.kind,seconds:duration};
    update['meta/roundNumber']=roundNumber;update['meta/updatedAt']=firebase.database.ServerValue.TIMESTAMP;
    await state.db.ref(roomPath()).update(update);
    pruneOldRounds(roundNumber);
    await wait(1500);
    await state.db.ref(roomPath('currentRound')).update({status:'ready'});
    await wait(700);
    await playRoundTrack(track,device,duration,roundId);
  }catch(error){
    if(track)unmarkUsedTrack(track.id);
    const updates={currentRound:{status:'lobby',number:Number(state.room?.meta?.roundNumber||0)},'meta/autoStartBlocked':true,'meta/lastError':error.message};
    activePlayers(state.room).forEach(([id])=>{updates[`players/${id}/ready`]=true;});
    await state.db.ref(roomPath()).update(updates).catch(()=>{});toast(error.message,true);
  }
}

function pruneOldRounds(currentNumber){
  if(currentNumber<=30)return;const room=state.room||{},keepIds=new Set();
  Object.keys(room.results||{}).slice(-25).forEach(id=>keepIds.add(id));const updates={};
  Object.keys(room.answers||{}).forEach(id=>{if(!keepIds.has(id))updates[`answers/${id}`]=null;});
  Object.keys(room.answerReceipts||{}).forEach(id=>{if(!keepIds.has(id))updates[`answerReceipts/${id}`]=null;});
  Object.keys(room.results||{}).forEach(id=>{if(!keepIds.has(id))updates[`results/${id}`]=null;});
  Object.keys(room.juryVotes||{}).forEach(id=>{if(!keepIds.has(id))updates[`juryVotes/${id}`]=null;});
  if(Object.keys(updates).length)state.db.ref(roomPath()).update(updates).catch(()=>{});
}

function chooseTrack(){
  if(!state.tracks.length)return null;
  let used=new Set(readJSON('bb_used_tracks',[])),available=$('noRepeat').checked?state.tracks.filter(track=>!used.has(track.id)):state.tracks;
  if(!available.length){used=new Set();available=state.tracks;}
  const track=pick(available);return track;
}
function markUsedTrack(id){const used=new Set(readJSON('bb_used_tracks',[]));used.add(id);localStorage.bb_used_tracks=JSON.stringify([...used]);}
function unmarkUsedTrack(id){const used=new Set(readJSON('bb_used_tracks',[]));used.delete(id);localStorage.bb_used_tracks=JSON.stringify([...used]);}
async function playRoundTrack(track,device,duration,roundId){
  let position=0;
  if($('randomStart').checked&&track.duration_ms>duration*1000+30000)position=smartFragmentStart(track.duration_ms,duration*1000);
  await spotifyApi(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(device)}`,{method:'PUT',body:JSON.stringify({uris:[track.uri],position_ms:position})});
  markUsedTrack(track.id);const startedAt=serverNow(),deadline=startedAt+duration*1000;
  await state.db.ref(roomPath('currentRound')).update({status:'answering',musicStartedAt:firebase.database.ServerValue.TIMESTAMP,deadlineMs:deadline,positionMs:position});
  localStorage.bb_spotify_test_at=String(Date.now());
  clearTimeout(state.roundTimer);state.roundTimer=setTimeout(()=>lockRound(roundId),duration*1000+250);
}
function smartFragmentStart(trackDuration,fragmentDuration){
  const latest=Math.max(0,trackDuration-fragmentDuration-5000),base=Math.min(75000,Math.max(30000,Math.round(trackDuration*.34))),jitter=Math.round((Math.random()-.5)*12000);
  return Math.max(15000,Math.min(latest,base+jitter));
}

async function stopPlayback(lock=false){
  try{await spotifyApi('https://api.spotify.com/v1/me/player/pause',{method:'PUT',body:'{}'});}catch{}
  if(lock&&state.room?.currentRound?.status==='answering')await lockRound(state.room.currentRound.id);
}

function ensureRoundTimer(){
  const round=state.room?.currentRound;if(!isHostController()||round?.status!=='answering'||!round.deadlineMs)return;
  const left=Number(round.deadlineMs)-serverNow();clearTimeout(state.roundTimer);
  if(left<=0)lockRound(round.id);else state.roundTimer=setTimeout(()=>lockRound(round.id),left+150);
}

async function lockRound(roundId){
  if(!isHostController())return;
  const roundRef=state.db.ref(roomPath('currentRound'));
  const claim=await roundRef.transaction(current=>current?.id===roundId&&current.status==='answering'?{...current,status:'judging',lockedAt:firebase.database.ServerValue.TIMESTAMP}:undefined,false);
  if(!claim.committed)return;
  await stopPlayback(false);
  let track=state.currentTrackRound===roundId?state.currentTrack:null;
  if(!track){const stored=readJSON(`bb_round_track_${state.roomCode}`,null);if(stored?.roundId===roundId)track=stored.track;}
  if(!track){await state.db.ref(roomPath()).update({'meta/autoStartBlocked':true,'meta/lastError':'Het antwoord van deze ronde kon na herladen niet worden teruggevonden.','currentRound/status':'review'});return;}
  const snapshot=(await state.db.ref(roomPath()).once('value')).val()||{},round=snapshot.currentRound||{};
  const answers=(await state.db.ref(`privateAnswers/${state.roomCode}/${roundId}`).once('value')).val()||{},updates={};let hasReview=false;
  const correct={track:track.name,artist:track.artists,album:track.album||'',year:String(track.release_date||'').slice(0,4)};
  Object.entries(snapshot.players||{}).forEach(([id,player])=>{
    const verdict=judgeAnswer(round,answers[id]?.answer||'',correct);hasReview ||= verdict.status==='review';
    updates[`answers/${roundId}/${id}`]=answers[id]||{answer:'',submittedAt:null};
    updates[`results/${roundId}/${id}`]={...verdict,answer:answers[id]?.answer||'',awarded:false};
  });
  updates['currentRound/correctAnswer']=correct;updates['currentRound/fact']=createFact(track);updates['currentRound/status']=hasReview?'review':'results';updates['currentRound/judgedAt']=firebase.database.ServerValue.TIMESTAMP;
  await state.db.ref(roomPath()).update(updates);await applyScores(roundId);
  state.db.ref(`privateAnswers/${state.roomCode}/${roundId}`).remove().catch(()=>{});
}

function judgeAnswer(round,answer,correct){
  const input=normalizeText(answer);if(!input)return{status:'bad',reason:'Geen antwoord'};
  const kind=round.categoryKind||'title',year=Number(correct.year)||0;
  if(kind==='year'){const value=Number(input.match(/\d{4}/)?.[0]);return value&&Math.abs(value-year)<=2?{status:'good',reason:'Jaartal binnen twee jaar'}:{status:'bad',reason:'Jaartal wijkt te veel af'};}
  if(kind==='decade'){const value=Number(input.match(/(?:19|20)?\d0/)?.[0]);const decade=value<100?1900+value:value;return decade===Math.floor(year/10)*10?{status:'good',reason:'Juiste decennium'}:{status:'bad',reason:'Verkeerde decennium'};}
  if(kind==='beforeafter'){
    const before=/voor|before|ouder|eerder/.test(input),after=/na|after|nieuwer|later/.test(input),correctBefore=year<2001;
    return(before&&correctBefore)||(after&&!correctBefore)?{status:'good',reason:'Juiste periode'}:{status:'bad',reason:'Verkeerde periode'};
  }
  const target=normalizeText(kind==='artist'?correct.artist:correct.track),cleanTarget=stripEdition(target),cleanInput=stripEdition(input);
  if(cleanInput===cleanTarget)return{status:'good',reason:'Exact goed'};
  const similarity=stringSimilarity(cleanInput,cleanTarget),coverage=tokenCoverage(cleanInput,cleanTarget);
  if(similarity>=.84||(similarity>=.72&&coverage>=.75))return{status:'good',reason:'Duidelijke spellingvariant'};
  if(similarity>=.58||coverage>=.5)return{status:'review',reason:'Lijkt erop, jury beslist'};
  return{status:'bad',reason:'Komt onvoldoende overeen'};
}
function normalizeText(value){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' en ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');}
function stripEdition(value){return normalizeText(value).replace(/\b(remaster(?:ed)?|radio|edit|version|live|mix|feat|featuring|ft)\b.*$/,'').trim();}
function tokenCoverage(input,target){const a=new Set(input.split(' ').filter(word=>word.length>1)),b=target.split(' ').filter(word=>word.length>1);return b.length?b.filter(word=>a.has(word)).length/b.length:0;}
function stringSimilarity(a,b){if(!a&&!b)return 1;const distance=levenshtein(a,b);return 1-distance/Math.max(a.length,b.length,1);}
function levenshtein(a,b){let previous=Array.from({length:b.length+1},(_,index)=>index);for(let i=1;i<=a.length;i++){let current=[i];for(let j=1;j<=b.length;j++)current[j]=Math.min(current[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));previous=current;}return previous[b.length];}

async function applyScores(roundId){
  const ref=state.db.ref(roomPath());
  await ref.transaction(room=>{
    if(!room)return room;const results=room.results?.[roundId]||{},players=room.players||{};
    Object.entries(results).forEach(([id,result])=>{if(result.status==='good'&&!result.awarded&&players[id]){players[id].score=Number(players[id].score||0)+100;result.awarded=true;}if(result.status!=='good'&&result.awarded&&players[id]){players[id].score=Math.max(0,Number(players[id].score||0)-100);result.awarded=false;}});
    return room;
  },false);
}

function createFact(track){
  const year=String(track.release_date||'').slice(0,4),artists=String(track.artists||'').split(',').map(value=>value.trim()).filter(Boolean),title=String(track.name||''),album=String(track.album||'');
  const facts=[];
  if(year)facts.push(`Dit nummer verscheen in ${year}, in de ${Math.floor(Number(year)/10)*10}'s.`);
  if(album&&normalizeText(album)!==normalizeText(title))facts.push(`Het nummer staat op het album “${album}”.`);
  if(artists.length>1)facts.push(`Aan dit nummer werken ${artists.length} genoemde artiesten samen.`);
  const words=title.split(/\s+/).filter(Boolean);if(words.length>=4)facts.push(`De titel bestaat uit ${words.length} woorden.`);
  if(/[!?]/.test(title))facts.push('De officiële titel bevat opvallende interpunctie.');
  return pick(facts.length?facts:['Een goede muziektitel blijft vaak al na een paar seconden hangen.']);
}

function renderPlayer(){
  const room=state.room;if(!room||!state.playerId)return;
  const player=room.players?.[state.playerId];if(!player){toast('Je bent niet meer aangemeld in deze kamer.',true);return exitToJoin();}
  const round=room.currentRound||{status:'lobby'},ownAnswer=room.answers?.[round.id]?.[state.playerId]||state.ownAnswers[round.id],ownResult=room.results?.[round.id]?.[state.playerId];
  $('playerIdentity').innerHTML=`${esc(player.avatar||'🎵')} ${esc(cleanName(player.name))}`;
  $('juryBtn').classList.toggle('hidden',!state.hostPlaying||!['review','results'].includes(round.status));
  const signature=JSON.stringify({status:round.status,id:round.id,deadline:round.deadlineMs,color:round.colorKey,answer:ownAnswer?.answer,result:ownResult,ready:player.ready,marked:player.marked,players:activePlayers(room).map(([id,p])=>[id,p.name,p.avatar,p.ready,p.score]),decision:room.decision,bingo:room.bingos,game:room.meta?.gameNumber});
  if(signature===state.renderSignature)return;
  const focused=document.activeElement?.id==='answerInput';if(focused&&round.status==='answering'&&!ownAnswer)return;
  state.renderSignature=signature;
  $('playerGame').innerHTML=playerStage(room,round,player,ownAnswer,ownResult);
  wirePlayerStage(room,round,player,ownAnswer,ownResult);
}

function playerStage(room,round,player,ownAnswer,ownResult){
  const players=activePlayers(room),ready=players.filter(([,p])=>p.ready).length;
  let content='';
  if(round.status==='ended')content=endedPanel();
  else if(room.decision?.status==='open')content=decisionPanel(room,player);
  else if(!round.id||['lobby','complete'].includes(round.status))content=lobbyPanel(room,player,ready,players.length);
  else if(round.status==='picking'||round.status==='starting')content=waitingPanel('De BB-aap kiest…','De kleur en categorie worden zo bekend.','🎨');
  else if(round.status==='ready')content=waitingPanel(round.category||'Klaar voor muziek',`${round.colorName||''} · Het fragment start zo.`,'🎵',round);
  else if(round.status==='answering')content=answerPanel(round,ownAnswer);
  else if(round.status==='judging')content=waitingPanel('Jury beoordeelt','De antwoorden worden gecontroleerd.','🧐',round);
  else if(round.status==='review')content=reviewPanel(room,round,player,ownResult);
  else content=resultPanel(room,round,player,ownResult);
  return`<div class="player-stage">${summaryBar(room,round,player)}<div class="primary-panel ${!round.id||['lobby','complete'].includes(round.status)?'lobby-panel':''}" style="--round-color:${esc(round.colorHex||colorHex(round.colorKey))}">${content}</div><div class="bingo-status">${cardProgress(player)} · ${ready}/${players.length} Ready</div></div>`;
}

function summaryBar(room,round,player){return`<div class="player-summary"><div class="summary-pill"><strong>${esc(round.id?`RONDE ${round.number||1}`:'LOBBY')}</strong> · ${esc(round.category||'Wachten')}</div><div class="summary-pill">⭐ <strong>${Number(player.score)||0}</strong></div><div class="summary-pill">👥 <strong>${activePlayers(room).length}</strong></div></div>`;}
function lobbyPanel(room,player,ready,total){
  const players=activePlayers(room).sort((a,b)=>(b[1].score||0)-(a[1].score||0));
  const hostTest=isHostController()?`<button class="button secondary" data-test-music>${room.meta?.autoStartBlocked?'TEST MUZIEK OPNIEUW':'TEST MUZIEK'}</button>`:'';
  return`<div class="ready-banner">${player.ready?'✓ JIJ BENT READY':'KLAAR VOOR DE VOLGENDE RONDE?'}</div><h1>${ready} van ${total} Ready</h1><p class="muted">${esc(room.meta?.autoStartBlocked?room.meta.lastError||'Test de muziek opnieuw.':'De ronde begint automatisch als iedereen klaar is.')}</p>${!player.ready?'<button class="button" data-ready>IK BEN READY</button>':''}${hostTest}<div class="compact-player-list">${players.map(([id,p])=>playerChip(id,p)).join('')}</div>`;
}
function waitingPanel(title,text,emoji,round={}){return`${round.colorKey?`<span class="category-badge">${esc(round.colorEmoji||'')} ${esc(round.colorName||'')}</span>`:''}<div class="player-timer">${emoji}</div><h1>${esc(title)}</h1><p class="muted">${esc(text)}</p>`;}
function answerPanel(round,ownAnswer){
  if(ownAnswer)return`<span class="category-badge">${esc(round.colorEmoji||'')} ${esc(round.category||'')}</span><div class="player-timer" data-timer>${formatTimer(round.deadlineMs)}</div><h1>Antwoord ingeleverd</h1><div class="submitted-box">${esc(ownAnswer.answer)}</div><p class="muted">Je antwoord staat vast. Wacht tot de tijd voorbij is.</p>`;
  return`<span class="category-badge">${esc(round.colorEmoji||'')} ${esc(round.category||'')}</span><div class="player-timer" data-timer>${formatTimer(round.deadlineMs)}</div><h1>Wat is jouw antwoord?</h1><p class="muted">${answerHint(round.categoryKind)}</p><form class="answer-form" data-answer-form><input id="answerInput" maxlength="80" autocomplete="off" enterkeyhint="send" placeholder="Typ je antwoord"><button class="button" type="submit">VERSTUUR</button></form>`;
}
function answerHint(kind){return({artist:'Vul de naam van de artiest in.',title:'Vul de titel van het nummer in.',year:'Vul een jaartal in.',decade:'Bijvoorbeeld: 1990 of jaren 90.',beforeafter:'Vul “voor” of “na” in.'})[kind]||'Vul je antwoord in.';}
function reviewPanel(room,round,player,ownResult){
  const reviews=Object.entries(room.results?.[round.id]||{}).filter(([,result])=>result.status==='review');
  if(!reviews.length)return waitingPanel('Jury rondt af','De uitslag verschijnt zo.','🧐',round);
  const [reviewId,result]=reviews[0],reviewPlayer=room.players?.[reviewId]||{},votes=room.juryVotes?.[round.id]?.[reviewId]||{},ownVote=votes[state.playerId];
  return`<span class="category-badge">JURY</span><h1>Rekenen we dit goed?</h1><p><strong>${esc(reviewPlayer.avatar||'🎵')} ${esc(cleanName(reviewPlayer.name))}</strong> antwoordde:</p><div class="submitted-box">${esc(result.answer||'Geen antwoord')}</div><p class="muted">${esc(result.reason||'De jury twijfelt.')}</p>${typeof ownVote==='boolean'?`<div class="ready-banner">Stem ontvangen: ${ownVote?'GOED':'FOUT'}</div>`:`<div class="button-row"><button class="button" data-jury-vote="true">GOED</button><button class="button danger" data-jury-vote="false">FOUT</button></div>`}`;
}
function resultPanel(room,round,player,ownResult){
  const answer=round.correctAnswer||{},good=ownResult?.status==='good';
  if(good&&!player.pickedRounds?.[round.id]){
    const indices=pickableCells(player,round.colorKey);
    if(indices.length)return`<span class="category-badge">✓ GOED ANTWOORD</span>${answerReveal(answer,round.fact)}<p><strong>Kies één ${esc(round.colorName||'')} vakje:</strong></p>${bingoCard(player,indices)}${compactScoreboard(room,round)}`;
  }
  return`<span class="category-badge">${good?'✓ GOED':'✕ HELAAS'}</span>${answerReveal(answer,round.fact)}${bingoCard(player,[])}${compactScoreboard(room,round)}${!player.ready?'<button class="button" data-ready>IK BEN READY</button>':'<div class="ready-banner">✓ READY VOOR DE VOLGENDE RONDE</div>'}`;
}
function compactScoreboard(room,round){
  const results=room.results?.[round.id]||{},players=Object.entries(room.players||{}).sort((a,b)=>(b[1].score||0)-(a[1].score||0));
  return`<div class="score-compact">${players.map(([id,p])=>`<div class="score-row"><span class="avatar">${esc(p.avatar||'🎵')}</span><strong>${esc(cleanName(p.name))} ${results[id]?.status==='good'?'✓':results[id]?.status==='review'?'?':'×'}</strong><span class="score-points">${Number(p.score)||0}</span></div>`).join('')}</div>`;
}
function answerReveal(answer,fact){return`<div class="answer-reveal"><h3>${esc(answer.track||'Onbekende titel')}</h3><p>${esc(answer.artist||'Onbekende artiest')}</p>${answer.year?`<p>${esc(answer.year)}${answer.album?` · ${esc(answer.album)}`:''}</p>`:''}${fact?`<div class="fact-box"><strong>Wist je dat?</strong><br>${esc(fact)}</div>`:''}</div>`;}
function endedPanel(){return`<div class="player-timer">🏁</div><h1>Spel beëindigd</h1><p class="muted">Bedankt voor het meespelen!</p><button class="button secondary" data-leave-now>TERUG NAAR BEGIN</button>`;}

function wirePlayerStage(room,round,player,ownAnswer,ownResult){
  $('playerGame').querySelector('[data-ready]')?.addEventListener('click',setReady);
  $('playerGame').querySelector('[data-test-music]')?.addEventListener('click',()=>testSpotify(true));
  $('playerGame').querySelector('[data-leave-now]')?.addEventListener('click',()=>leaveRoom(true));
  const form=$('playerGame').querySelector('[data-answer-form]');if(form)form.addEventListener('submit',submitAnswer);
  $('playerGame').querySelectorAll('[data-cell]').forEach(button=>button.addEventListener('click',()=>pickBingoCell(Number(button.dataset.cell),round)));
  $('playerGame').querySelectorAll('[data-jury-vote]').forEach(button=>button.addEventListener('click',()=>castJuryVote(button.dataset.juryVote==='true')));
  $('playerGame').querySelectorAll('[data-decision-vote]').forEach(button=>button.addEventListener('click',()=>castDecisionVote(button.dataset.decisionVote)));
  $('playerGame').querySelectorAll('[data-host-outcome]').forEach(button=>button.addEventListener('click',()=>resolveDecision(button.dataset.hostOutcome)));
  $('playerGame').querySelectorAll('[data-decision-mode]').forEach(button=>button.addEventListener('click',()=>chooseDecisionMode(button.dataset.decisionMode)));
}

async function submitAnswer(event){
  event.preventDefault();const input=$('answerInput'),answer=input?.value.trim();if(!answer)return toast('Vul eerst je antwoord in.',true);
  const round=state.room?.currentRound;if(!round?.id||round.status!=='answering'||serverNow()>=Number(round.deadlineMs||0))return toast('De antwoordtijd is voorbij.',true);
  const ref=state.db.ref(`privateAnswers/${state.roomCode}/${round.id}/${state.playerId}`);
  const result=await ref.transaction(current=>current||{answer:answer.slice(0,80),submittedAt:firebase.database.ServerValue.TIMESTAMP},false);
  if(!result.committed)return toast('Je had al een antwoord ingeleverd.',true);
  state.ownAnswers[round.id]={answer:answer.slice(0,80),submittedAt:serverNow()};localStorage[`bb_own_answers_${state.roomCode}_${state.playerId}`]=JSON.stringify(state.ownAnswers);
  await state.db.ref(roomPath(`answerReceipts/${round.id}/${state.playerId}`)).set(true);state.renderSignature='';renderPlayer();
}
async function setReady(){if(!state.playerId)return;await state.db.ref(roomPath(`players/${state.playerId}`)).update({ready:true,lastSeen:firebase.database.ServerValue.TIMESTAMP});}

function colorHex(key){return COLORS.find(color=>color.key===key)?.hex||'#7ed957';}
function generateCard(seed){
  const missing=parseInt(hashText(seed+Date.now()),36)%COLORS.length,pool=[];
  COLORS.forEach((color,index)=>{const count=index===missing?4:5;for(let i=0;i<count;i++)pool.push(color.key);});shuffle(pool);
  const card=[];for(let i=0;i<25;i++)card.push(i===12?'free':pool.shift());return card;
}
function shuffle(list){for(let index=list.length-1;index>0;index--){const target=Math.floor(Math.random()*(index+1));[list[index],list[target]]=[list[target],list[index]];}return list;}
function bingoCard(player,pickable=[]){const set=new Set(pickable),marked=player.marked||{};return`<div class="bingo-mini">${(player.card||[]).map((color,index)=>{const done=index===12||marked[index],canPick=set.has(index);return`<button class="bingo-cell ${done?'marked':''} ${canPick?'pickable':''}" style="--cell:${colorHex(color)}" ${canPick?`data-cell="${index}"`:'disabled'}>${done?'✓':index===12?'★':''}</button>`;}).join('')}</div>`;}
function pickableCells(player,color){return(player.card||[]).map((cell,index)=>cell===color&&!player.marked?.[index]?index:-1).filter(index=>index>=0);}
function checkBingo(marked){
  const lines=[[0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],[0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24],[0,6,12,18,24],[4,8,12,16,20]];
  return lines.some(line=>line.every(index=>index===12||marked?.[index]));
}
function cardProgress(player){const count=Object.keys(player.marked||{}).filter(key=>player.marked[key]).length;return`Bingokaart ${Math.min(24,count+1)}/25`;} 
async function pickBingoCell(index,round){
  const ref=state.db.ref(roomPath(`players/${state.playerId}`));let bingo=false;
  const result=await ref.transaction(player=>{
    if(!player||player.card?.[index]!==round.colorKey||player.marked?.[index]||player.pickedRounds?.[round.id])return;
    player.marked=player.marked||{};player.marked[index]=true;player.pickedRounds=player.pickedRounds||{};player.pickedRounds[round.id]=index;player.ready=true;bingo=checkBingo(player.marked);return player;
  },false);
  if(!result.committed)return;
  if(bingo)await declareBingo(round.id);
}

async function declareBingo(roundId){
  const bingoRef=state.db.ref(roomPath('bingos/current'));
  const claim=await bingoRef.transaction(current=>current||{playerId:state.playerId,name:state.playerName,roundId,at:firebase.database.ServerValue.TIMESTAMP},false);
  if(claim.committed)await state.db.ref(roomPath('decision')).set({status:'open',phase:'choose_mode',winnerId:state.playerId,winnerName:state.playerName,openedAt:firebase.database.ServerValue.TIMESTAMP});
}

function decisionPanel(room,player){
  const decision=room.decision||{},winner=cleanName(decision.winnerName||room.players?.[decision.winnerId]?.name||'Een speler');
  if(decision.phase==='choose_mode'){
    if(!isHostController())return`<div class="winner-title">BINGO!</div><div class="winner-name">${esc(winner)} heeft gewonnen</div><p class="muted">De host kiest hoe jullie verdergaan.</p>`;
    return`<div class="winner-title">BINGO!</div><div class="winner-name">${esc(winner)} heeft gewonnen</div><p>Kiest de host of stemt de hele groep?</p><div class="button-row"><button class="button" data-decision-mode="host">HOST KIEST</button><button class="button secondary" data-decision-mode="vote">MEERDERHEID KIEST</button></div>`;
  }
  if(decision.mode==='host'){
    if(!isHostController())return`<div class="winner-title">BINGO!</div><div class="winner-name">${esc(winner)} heeft gewonnen</div><p class="muted">De host maakt een keuze.</p>`;
    return`<div class="winner-title">BINGO!</div><div class="winner-name">${esc(winner)} heeft gewonnen</div><div class="decision-grid"><button class="button" data-host-outcome="continue">VERDER SPELEN</button><button class="button secondary" data-host-outcome="newgame">NIEUW SPEL</button><button class="button danger" data-host-outcome="end">SPEL BEËINDIGEN</button></div>`;
  }
  const ownVote=decision.votes?.[state.playerId],counts=countDecisionVotes(room);
  return`<div class="winner-title">BINGO!</div><div class="winner-name">${esc(winner)} heeft gewonnen</div><p>De meerderheid kiest wat er gebeurt.</p>${ownVote?`<div class="ready-banner">Jouw stem: ${decisionLabel(ownVote)}</div>`:`<div class="decision-grid"><button class="button" data-decision-vote="continue">VERDER SPELEN</button><button class="button secondary" data-decision-vote="newgame">NIEUW SPEL</button><button class="button danger" data-decision-vote="end">SPEL BEËINDIGEN</button></div>`}<div class="vote-result">Verder ${counts.continue} · Nieuw spel ${counts.newgame} · Beëindigen ${counts.end}<br>Bij gelijkspel telt de stem van de host dubbel.</div>`;
}
function decisionLabel(value){return({continue:'VERDER SPELEN',newgame:'NIEUW SPEL',end:'SPEL BEËINDIGEN'})[value]||value;}
async function chooseDecisionMode(mode){if(!isHostController()||!['host','vote'].includes(mode))return;await state.db.ref(roomPath('decision')).update({phase:'decide',mode,votes:{}});}
function hostVoteId(){return state.hostPlaying?state.playerId:`controller_${state.hostId}`;}
async function castDecisionVote(vote,voterId=state.playerId){if(!['continue','newgame','end'].includes(vote)||!voterId)return;await state.db.ref(roomPath(`decision/votes/${voterId}`)).set(vote);}
function countDecisionVotes(room){
  const counts={continue:0,newgame:0,end:0},votes=room.decision?.votes||{};
  Object.entries(votes).forEach(([id,vote])=>{if(counts[vote]!==undefined)counts[vote]+=(room.players?.[id]?.isHost||id.startsWith('controller_'))?2:1;});return counts;
}
async function maybeFinalizeVotes(){
  const room=state.room,decision=room?.decision;if(!decision||decision.status!=='open'||decision.mode!=='vote'||decision.phase!=='decide')return;
  const players=activePlayers(room),votes=decision.votes||{},required=players.map(([id])=>id);
  if(!state.hostPlaying)required.push(hostVoteId());
  if(required.some(id=>!votes[id]))return;
  const counts=countDecisionVotes(room),highest=Math.max(...Object.values(counts)),winners=Object.keys(counts).filter(key=>counts[key]===highest);
  let outcome=winners.length===1?winners[0]:null;
  if(!outcome){const hostChoice=votes[hostVoteId()];if(hostChoice&&winners.includes(hostChoice))outcome=hostChoice;}
  if(!outcome)return;await resolveDecision(outcome);
}
async function resolveDecision(outcome){
  if(!isHostController()||!['continue','newgame','end'].includes(outcome))return;
  const claim=await state.db.ref(roomPath('decision/status')).transaction(status=>status==='open'?'resolving':undefined,false);if(!claim.committed)return;
  if(outcome==='continue')await continueGame();else if(outcome==='newgame')await resetGame();else await endGame();
}
async function continueGame(){
  const room=(await state.db.ref(roomPath()).once('value')).val()||{},updates={'decision':null,'bingos/current':null,'currentRound/status':'results'};
  activePlayers(room).forEach(([id])=>{updates[`players/${id}/ready`]=false;});await state.db.ref(roomPath()).update(updates);
}
async function resetGame(){
  const room=(await state.db.ref(roomPath()).once('value')).val()||{},gameNumber=Number(room.meta?.gameNumber||1)+1,updates={answers:null,answerReceipts:null,results:null,juryVotes:null,bingos:null,decision:null,currentRound:{status:'lobby',number:0},'meta/gameNumber':gameNumber,'meta/roundNumber':0,'meta/autoStartBlocked':false,'meta/lastError':null};
  Object.entries(room.players||{}).forEach(([id,player])=>{updates[`players/${id}/card`]=generateCard(id+gameNumber);updates[`players/${id}/marked`]={};updates[`players/${id}/pickedRounds`]={};updates[`players/${id}/ready`]=false;updates[`players/${id}/score`]=0;updates[`players/${id}/gameNumber`]=gameNumber;});
  await state.db.ref(roomPath()).update(updates);state.db.ref(`privateAnswers/${state.roomCode}`).remove().catch(()=>{});toast('Nieuw spel gestart. Iedereen krijgt een nieuwe kaart.');
}
async function endGame(){
  const room=(await state.db.ref(roomPath()).once('value')).val()||{},updates={decision:null,'currentRound/status':'ended','meta/endedAt':firebase.database.ServerValue.TIMESTAMP};
  Object.keys(room.players||{}).forEach(id=>{updates[`players/${id}/ready`]=false;});await state.db.ref(roomPath()).update(updates);
}

async function castJuryVote(vote){
  const round=state.room?.currentRound,review=Object.entries(state.room?.results?.[round?.id]||{}).find(([,result])=>result.status==='review');if(!round?.id||!review)return;
  await state.db.ref(roomPath(`juryVotes/${round.id}/${review[0]}/${state.playerId}`)).set(vote);await maybeFinalizeJury(round.id,review[0]);
}
async function maybeFinalizeJury(roundId,reviewId){
  if(!isHostController())return;
  const room=(await state.db.ref(roomPath()).once('value')).val()||{},players=activePlayers(room),votes=room.juryVotes?.[roundId]?.[reviewId]||{};
  if(players.some(([id])=>typeof votes[id]!=='boolean'))return;
  let yes=0,no=0;Object.entries(votes).forEach(([id,vote])=>{const weight=room.players?.[id]?.isHost?2:1;if(vote)yes+=weight;else no+=weight;});
  if(yes===no)return;await setJuryResult(roundId,reviewId,yes>no?'good':'bad');
}
async function maybeFinalizeAllJury(){
  const round=state.room?.currentRound;if(round?.status!=='review'||!round.id)return;
  const review=Object.entries(state.room?.results?.[round.id]||{}).find(([,result])=>result.status==='review');
  if(review)await maybeFinalizeJury(round.id,review[0]);
}
async function setJuryResult(roundId,playerId,status){
  if(!isHostController()||!['good','bad'].includes(status))return;
  await state.db.ref(roomPath(`results/${roundId}/${playerId}`)).update({status,reason:'Jurybesluit',overruledAt:firebase.database.ServerValue.TIMESTAMP});
  const room=(await state.db.ref(roomPath()).once('value')).val()||{},pending=Object.values(room.results?.[roundId]||{}).some(result=>result.status==='review');
  if(!pending)await state.db.ref(roomPath('currentRound/status')).set('results');await applyScores(roundId);
}

function openHostJury(){
  if(!isHostController())return;
  const round=state.room?.currentRound||{},results=state.room?.results?.[round.id]||{},answers=state.room?.answers?.[round.id]||{};
  const rows=Object.entries(state.room?.players||{}).map(([id,player])=>{const result=results[id]||{};return`<div class="jury-item"><strong>${esc(player.avatar||'🎵')} ${esc(cleanName(player.name))}</strong><span>Antwoord: ${esc(answers[id]?.answer||'Geen antwoord')}</span><span>Beoordeling: ${result.status==='good'?'Goed':result.status==='review'?'Jury':'Fout'} · ${esc(result.reason||'')}</span><div class="jury-buttons"><button class="button" data-overrule="good" data-player="${esc(id)}">GOED</button><button class="button danger" data-overrule="bad" data-player="${esc(id)}">FOUT</button></div></div>`;}).join('');
  openModal(`<div class="modal-card"><h2>Jury / overrule</h2><p class="muted">Corrigeer alleen als een antwoord verkeerd beoordeeld is.</p><div class="jury-list">${rows||'Nog geen antwoorden.'}</div><div class="modal-actions"><button class="button secondary" data-close>SLUITEN</button></div></div>`);
  $('modalRoot').querySelectorAll('[data-overrule]').forEach(button=>button.addEventListener('click',async()=>{await setJuryResult(round.id,button.dataset.player,button.dataset.overrule);closeModal();}));
}

function requestLeave(){
  if(state.hostPlaying)return confirmAction('Terug naar het hostscherm?','Je verlaat de spelerslijst en gaat terug naar de hostbediening.',()=>leaveHostPlayerMode());
  confirmAction('Spel verlaten?','Je verdwijnt uit de lobby en kunt later opnieuw meedoen.',()=>leaveRoom(true));
}
async function leaveRoom(navigate=false){
  clearInterval(state.heartbeat);state.heartbeat=null;
  if(state.roomCode&&state.playerId)await state.db.ref(`rooms/${state.roomCode}/players/${state.playerId}`).remove().catch(()=>{});
  state.disconnectRef?.onDisconnect().cancel().catch(()=>{});state.joined=false;state.roomRef?.off();state.roomRef=null;
  localStorage.removeItem('bb_player_room');state.renderSignature='';if(navigate)location.href=location.pathname;
}
async function leaveHostPlayerMode(){
  const code=state.roomCode;await leaveRoom(false);state.hostPlaying=false;state.mode='host';state.playerId=localStorage.bb_player_id||'';state.playerName=localStorage.bb_player_name||'';
  state.playerId=state.regularPlayerId;state.playerName=state.regularPlayerName;
  if(state.playerId)localStorage.bb_player_id=state.playerId;else localStorage.removeItem('bb_player_id');
  if(state.playerName)localStorage.bb_player_name=state.playerName;else localStorage.removeItem('bb_player_name');
  $('playerView').classList.add('hidden');$('hostView').classList.remove('hidden');$('juryBtn').classList.add('hidden');$('modeLabel').textContent=`Host · V${VERSION}`;await resumeRoom(code,true);
}
function exitToJoin(){$('gameView').classList.add('hidden');$('joinView').classList.remove('hidden');$('joinBtn').disabled=false;state.joined=false;}

function confirmAction(title,text,onConfirm){
  openModal(`<div class="modal-card"><h2>${esc(title)}</h2><p>${esc(text)}</p><div class="modal-actions"><button class="button secondary" data-close>ANNULEREN</button><button class="button danger" data-confirm>DOORGAAN</button></div></div>`);
  $('modalRoot').querySelector('[data-confirm]').onclick=async()=>{closeModal();await onConfirm();};
}
function openModal(html){const root=$('modalRoot');root.innerHTML=html;root.classList.remove('hidden');root.querySelectorAll('[data-close]').forEach(button=>button.onclick=closeModal);setTimeout(()=>root.querySelector('button,input,select')?.focus(),30);}
function closeModal(){$('modalRoot').classList.add('hidden');$('modalRoot').innerHTML='';}
function toast(message,error=false){const box=$('toast');clearTimeout(state.toastTimer);box.textContent=message;box.classList.toggle('error',error);box.classList.remove('hidden');state.toastTimer=setTimeout(()=>box.classList.add('hidden'),error?6500:3200);}
function setMessage(id,message,type=''){const node=$(id);if(!node)return;node.textContent=message;node.className=`form-message ${type}`;}
function cleanName(name){return String(name||'Speler').replace(/^🎤\s*/,'').trim()||'Speler';}
function formatTimer(deadline){const seconds=Math.max(0,Math.ceil((Number(deadline||0)-serverNow())/1000));return`00:${String(seconds).padStart(2,'0')}`;}
function readJSON(key,fallback){try{const value=localStorage.getItem(key);return value===null?fallback:JSON.parse(value);}catch{return fallback;}}

setInterval(()=>{
  document.querySelectorAll('[data-timer]').forEach(element=>{const round=state.room?.currentRound;if(round?.deadlineMs)element.textContent=formatTimer(round.deadlineMs);});
},250);

window.addEventListener('beforeunload',()=>{if(state.joined&&state.disconnectRef)state.disconnectRef.update({online:false,lastSeen:firebase.database.ServerValue.TIMESTAMP}).catch(()=>{});});
