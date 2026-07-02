/* Bingo Beats V83 CLEAN CORE */
const CLIENT_ID="4765b89201b44558a7d5141f9b93c178",REDIRECT_URI=location.origin+location.pathname,SCOPES=["streaming","user-read-email","user-read-private","user-read-playback-state","user-modify-playback-state"].join(" ");
const firebaseConfig={apiKey:"AIzaSyCcquz1mpz3FsmFFBKgJLgpbkHCajTUpzY",authDomain:"hitster-bingo-cb792.firebaseapp.com",databaseURL:"https://hitster-bingo-cb792-default-rtdb.europe-west1.firebasedatabase.app",projectId:"hitster-bingo-cb792",storageBucket:"hitster-bingo-cb792.firebasestorage.app",messagingSenderId:"98696776977",appId:"1:98696776977:web:e797e555e2d9b38bcc99b0"};
const COLORS=[{key:"yellow",name:"GOUD",emoji:"🟡",input:"cat-yellow",hex:"#FFCC33"},{key:"pink",name:"AQUA",emoji:"🩵",input:"cat-pink",hex:"#00D4C7"},{key:"purple",name:"ORANJE",emoji:"🟠",input:"cat-purple",hex:"#FF8A1F"},{key:"blue",name:"LIME",emoji:"🟢",input:"cat-blue",hex:"#7ED957"},{key:"green",name:"KORAAL",emoji:"🔴",input:"cat-green",hex:"#FF5A5F"}];
const TEST_LICENSE_CODE="TEST-2026",$=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m])),pick=a=>a[Math.floor(Math.random()*a.length)];
let db,player,deviceId="",accessToken=localStorage.spotify_access_token||"",refreshToken=localStorage.spotify_refresh_token||"",expiresAt=Number(localStorage.spotify_expires_at||0),tracks=JSON.parse(localStorage.hb_csv_tracks||"[]"),currentTrack=null,currentRoomCode="",currentRoundId="",currentPlayerId=localStorage.hb_player_id||"",currentPlayerName=localStorage.hb_player_name||"",activeRound=null,stopTimer=null,lockTimer=null,dashTimer=null,audioCtx=null,bingoSeenKey=localStorage.hb_last_bingo_key||"";
const feedbackSeen={};
function isPlayerPage(){return !!new URLSearchParams(location.search).get("room")}
document.addEventListener("DOMContentLoaded",init);
function init(){wireLicense();checkLicenseGate()}
function wireLicense(){$("licenseBtn")?.addEventListener("click",activateLicense);$("licenseInput")?.addEventListener("keydown",e=>{if(e.key==="Enter")activateLicense()})}
function checkLicenseGate(){let l=JSON.parse(localStorage.getItem("bb_license")||"null");(!l||l.code!==TEST_LICENSE_CODE||l.active!==true)?showLicenseScreen("Voer een geldige licentiecode in."):unlockApp()}
function activateLicense(){let c=($("licenseInput")?.value||"").trim().toUpperCase();if(c!==TEST_LICENSE_CODE)return showLicenseScreen("Ongeldige licentiecode.");localStorage.setItem("bb_license",JSON.stringify({code:TEST_LICENSE_CODE,active:true,type:"test",activatedAt:new Date().toISOString()}));if($("licenseStatus")){$("licenseStatus").textContent="Licentie geactiveerd.";$("licenseStatus").className="small licenseSuccess"}setTimeout(unlockApp,350)}
function showLicenseScreen(m){$("licenseScreen")?.classList.remove("hidden");$("mainHeader")?.classList.add("hidden");$("hostApp")?.classList.add("hidden");$("playerApp")?.classList.add("hidden");if($("licenseStatus")){$("licenseStatus").textContent=m||"";$("licenseStatus").className="small licenseError"}}
function unlockApp(){$("licenseScreen")?.classList.add("hidden");$("mainHeader")?.classList.remove("hidden");if(!firebase.apps.length)firebase.initializeApp(firebaseConfig);db=firebase.database();wireApp();handleRedirect().then(updateStatus).catch(console.error);isPlayerPage()?setupPlayerMode():setupHostMode()}
function wireApp(){[["loginBtn",login],["logoutBtn",logout],["activateBtn",activatePlayer],["newRoomBtn",createRoom],["soundBtn",activateSound],["startRoundBtn",startRound],["playBtn",playHidden],["stopBtn",stopPlayback],["showAnswerBtn",showAnswer],["lockBtn",lockRound],["publishBtn",publishResults],["joinBtn",joinPlayer],["newGameBtn",openNewGameModal],["cancelNewGameBtn",closeNewGameModal],["confirmNewGameBtn",bbStartNewGameSameRoom]].forEach(([i,f])=>$(i)?.addEventListener("click",f));$("csvFile")?.addEventListener("change",handleCsv);$("resetUsedBtn")?.addEventListener("click",()=>{localStorage.removeItem("hb_used");updateStatus()});$("hostScoreboard")?.addEventListener("click",scoreboardClick);document.addEventListener("click",e=>{if(e.target?.id==="copyRoomLinkBtn"){e.preventDefault();copyRoomLink()}})}
function setModeLabel(t){if($("modeText"))$("modeText").textContent=t}
async function login(){let v=rand(96);localStorage.spotify_code_verifier=v;location.href="https://accounts.spotify.com/authorize?"+new URLSearchParams({response_type:"code",client_id:CLIENT_ID,scope:SCOPES,code_challenge_method:"S256",code_challenge:b64(await sha(v)),redirect_uri:REDIRECT_URI})}
function rand(l){let c="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~",o="",b=new Uint8Array(l);crypto.getRandomValues(b);b.forEach(x=>o+=c[x%c.length]);return o}async function sha(s){return crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))}function b64(b){return btoa(String.fromCharCode(...new Uint8Array(b))).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")}
async function handleRedirect(){let code=new URLSearchParams(location.search).get("code");if(!code)return;let r=await fetch("https://accounts.spotify.com/api/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:CLIENT_ID,grant_type:"authorization_code",code,redirect_uri:REDIRECT_URI,code_verifier:localStorage.spotify_code_verifier||""})}),d=await r.json();if(d.access_token){saveTokens(d);history.replaceState({},document.title,REDIRECT_URI)}else alert("Spotify login fout.")}
function saveTokens(d){accessToken=d.access_token;if(d.refresh_token)refreshToken=d.refresh_token;expiresAt=Date.now()+d.expires_in*1000-60000;localStorage.spotify_access_token=accessToken;if(refreshToken)localStorage.spotify_refresh_token=refreshToken;localStorage.spotify_expires_at=expiresAt}
async function getToken(){if(accessToken&&Date.now()<expiresAt)return accessToken;if(!refreshToken)return"";let r=await fetch("https://accounts.spotify.com/api/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"refresh_token",refresh_token:refreshToken,client_id:CLIENT_ID})}),d=await r.json();if(d.access_token){saveTokens(d);return accessToken}return""}
async function api(u,o={}){let t=await getToken();if(!t)throw Error("Niet ingelogd.");let r=await fetch(u,{...o,headers:{...(o.headers||{}),Authorization:"Bearer "+t,"Content-Type":"application/json"}});if(r.status===204)return{};let d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error?.message||"Spotify fout.");return d}
function logout(){["spotify_access_token","spotify_refresh_token","spotify_expires_at"].forEach(k=>localStorage.removeItem(k));accessToken=refreshToken="";expiresAt=0;updateStatus()}window.onSpotifyWebPlaybackSDKReady=()=>{};
async function activatePlayer(){let t=await getToken();if(!t)return alert("Login eerst met Spotify.");if(!window.Spotify)return alert("Spotify speler nog niet geladen.");if(player){await player.connect();return}player=new Spotify.Player({name:"Bingo Beats",getOAuthToken:async cb=>cb(await getToken()),volume:.8});player.addListener("ready",({device_id})=>{deviceId=device_id;if($("loginStatus"))$("loginStatus").textContent+=" — speler actief."});await player.connect()}
async function updateStatus(){if($("csvStatus"))$("csvStatus").textContent=tracks.length?`${tracks.length} nummers geladen.`:"Nog geen CSV geladen.";if(!$("loginStatus"))return;if(await getToken()){try{let me=await api("https://api.spotify.com/v1/me");$("loginStatus").textContent="Ingelogd als: "+(me.display_name||me.email||"Spotify gebruiker");if($("activateBtn"))$("activateBtn").disabled=false}catch(e){$("loginStatus").textContent="Ingelogd."}}else{$("loginStatus").textContent="Nog niet ingelogd.";if($("activateBtn"))$("activateBtn").disabled=true}}
function parseCSV(t){let rows=[],r=[],c="",q=false;for(let i=0;i<t.length;i++){let ch=t[i],n=t[i+1];if(ch=='"'&&q&&n=='"'){c+='"';i++}else if(ch=='"')q=!q;else if(ch==","&&!q){r.push(c);c=""}else if((ch=="\n"||ch=="\r")&&!q){if(ch=="\r"&&n=="\n")i++;r.push(c);c="";if(r.some(v=>v.trim()))rows.push(r);r=[]}else c+=ch}r.push(c);if(r.some(v=>v.trim()))rows.push(r);return rows}function norm(h){return String(h||"").toLowerCase().replace(/[^a-z0-9]/g,"")}function findI(h,n){let a=h.map(norm);for(let x of n){let i=a.indexOf(norm(x));if(i>=0)return i}return-1}function tid(u){let s=String(u||"").trim(),m=s.match(/spotify:track:([a-zA-Z0-9]+)/)||s.match(/track\/([a-zA-Z0-9]+)/);return m?m[1]:(/^[a-zA-Z0-9]{15,}$/.test(s)?s:"")}
function handleCsv(e){let f=e.target.files?.[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{loadCsv(r.result)}catch(err){alert(err.message)}};r.readAsText(f)}
function loadCsv(text){let rows=parseCSV(text),h=rows[0]||[],ui=findI(h,["Track URI","Spotify URI","URI"]),ti=findI(h,["Track Name","Name","Title"]),ai=findI(h,["Artist Name(s)","Artist Names","Artists","Artist"]),al=findI(h,["Album Name","Album"]),ri=findI(h,["Release Date","Release"]),di=findI(h,["Duration (ms)","Duration"]);if(ui<0||ti<0||ai<0)throw Error("CSV mist Track URI, Track Name of Artist Name(s).");let out=[],seen=new Set();for(let i=1;i<rows.length;i++){let row=rows[i],id=tid(row[ui]);if(!id||seen.has(id))continue;seen.add(id);out.push({id,uri:"spotify:track:"+id,name:row[ti]||"Onbekend",artists:row[ai]||"Onbekend",album:al>=0?row[al]||"":"",release_date:ri>=0?row[ri]||"":"",duration_ms:Number(row[di])||180000})}tracks=out;localStorage.hb_csv_tracks=JSON.stringify(tracks);updateStatus()}
function chooseTrack(){if(!tracks.length)return null;let u=new Set(JSON.parse(localStorage.hb_used||"[]")),a=$("noRepeat")?.checked?tracks.filter(t=>!u.has(t.id)):tracks;if(!a.length){u=new Set();a=tracks}let t=pick(a);u.add(t.id);localStorage.hb_used=JSON.stringify([...u]);updateStatus();return t}
function setupHostMode(){setModeLabel("🎤 Host");document.body.classList.remove("playerMode");$("hostApp")?.classList.remove("hidden");$("playerApp")?.classList.add("hidden");restoreHost();showStartPopup()}
function getCats(){return{yellow:$("cat-yellow")?.value||"Voor of na 2001",pink:$("cat-pink")?.value||"Naam van artiest",purple:$("cat-purple")?.value||"Decennium",blue:$("cat-blue")?.value||"Jaartal +/- 2",green:$("cat-green")?.value||"Titel van track"}}function roomCode(){let c="",ch="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";for(let i=0;i<4;i++)c+=ch[Math.floor(Math.random()*ch.length)];return c}
function createRoom(){currentRoomCode=roomCode();db.ref("rooms/"+currentRoomCode).set({createdAt:firebase.database.ServerValue.TIMESTAMP,categories:getCats()}).then(()=>{localStorage.hb_host_room=currentRoomCode;localStorage.hb_last_stable_room=currentRoomCode;renderRoomBox(currentRoomCode);listenHost(currentRoomCode);listenBingo(currentRoomCode)})}
function restoreHost(){let s=localStorage.hb_host_room||localStorage.hb_last_stable_room||"";if(s&&!isPlayerPage()){currentRoomCode=s;renderRoomBox(s);listenHost(s);listenBingo(s)}}
function qrUrl(t){return"https://api.qrserver.com/v1/create-qr-code/?size=220x220&data="+encodeURIComponent(t||"")}function renderRoomBox(code){if(!code||!$("roomBox"))return;let link=location.origin+location.pathname+"?room="+code;$("roomBox").classList.remove("hidden");$("roomBox").innerHTML=`<div class="hostRoomGridClean"><div class="hostRoomCodeClean"><div class="roomLabelClean">SPELCODE</div><div class="roomCodeClean">${esc(code)}</div></div><div class="hostRoomLinkClean"><div class="roomLabelClean">DEEL DE LINK</div><input id="joinLink" readonly value="${esc(link)}"><button id="copyRoomLinkBtn" type="button" class="copyRoomLinkBtn">📋 Kopieer link</button></div><img class="hostQrClean" alt="QR code" src="${qrUrl(link)}"></div>`}
function copyRoomLink(){let input=$("joinLink"),btn=$("copyRoomLinkBtn"),code=currentRoomCode||localStorage.hb_host_room||"",link=input?.value||(code?location.origin+location.pathname+"?room="+code:"");if(!link)return;let done=()=>{if(btn){btn.textContent="✅ Gekopieerd";setTimeout(()=>btn.textContent="📋 Kopieer link",1500)}};if(navigator.clipboard?.writeText)navigator.clipboard.writeText(link).then(done).catch(()=>{input?.select?.();document.execCommand("copy");done()});else{input?.select?.();document.execCommand("copy");done()}}
function listenHost(room){db.ref("rooms/"+room).off();db.ref("rooms/"+room).on("value",s=>{let d=s.val()||{};renderHostPlayers(d);renderHostScore(d);hostReadyState(d)})}
function renderHostPlayers(room){let ps=room.players||{},list=Object.values(ps);if(!$("hostPlayers"))return;$("hostPlayers").innerHTML=list.length?list.map(p=>`<div class="playerRow ${p.ready?"ready":""}"><strong>${esc(p.name||"Speler")}</strong><span>${p.ready?"🐵 READY":"⏳ wacht"}</span></div>`).join(""):"Nog geen spelers."}function allReady(room){let ps=Object.values(room.players||{});return ps.length>0&&ps.every(p=>p.ready)}
function hostReadyState(room){let r=room.currentRound||{},b=$("startRoundBtn");if(!b)return;if(["picking","ready","answering","locked"].includes(r.status))return;if(allReady(room)){b.disabled=false;b.textContent="🎲 START RONDE";if($("hostStatus"))$("hostStatus").textContent="Iedereen is READY."}else{b.disabled=true;b.textContent="⏳ Wachten op READY";let n=Object.values(room.players||{}).filter(p=>!p.ready).map(p=>p.name).join(", ");if($("hostStatus"))$("hostStatus").textContent=n?"Nog niet ready: "+n:"Wachten op spelers."}}
function pickerHTML(){return`<div class="bbPickerClean"><img src="bb_logo_purple.png" class="bbPickerLogoClean" alt="Bingo Beats"><div class="bbPickerTitleClean">🐵 BB-aap kiest een kleur...</div><div class="bbPickerDotsClean"><span style="--c:#FFCC33"></span><span style="--c:#00D4C7"></span><span style="--c:#FF8A1F"></span><span style="--c:#7ED957"></span><span style="--c:#FF5A5F"></span></div><div class="bbPickerSmallClean">Nog even spannend...</div></div>`}
function startRound(){if(!currentRoomCode)return alert("Maak eerst een kamer.");db.ref("rooms/"+currentRoomCode).once("value").then(s=>{let room=s.val()||{};if(!allReady(room))return alert("Nog niet iedereen is READY.");currentTrack=chooseTrack();if(!currentTrack)return alert("Upload eerst CSV.");let up={};Object.keys(room.players||{}).forEach(pid=>up[`rooms/${currentRoomCode}/players/${pid}/ready`]=false);return db.ref().update(up).then(()=>startRoundVisual(currentRoomCode))})}
function startRoundVisual(room){if($("hostAnswerArea"))$("hostAnswerArea").innerHTML="";if($("playBtn")){$("playBtn").disabled=true;$("playBtn").textContent="🎵 Speel verborgen nummer"}if($("showAnswerBtn"))$("showAnswerBtn").disabled=true;if($("hostPickerArea"))$("hostPickerArea").innerHTML=pickerHTML();currentRoundId="r_"+Date.now();db.ref("rooms/"+room+"/currentRound").set({id:currentRoundId,status:"picking",pickerMode:"bb",pickerMarkup:pickerHTML(),pickerStartedAt:firebase.database.ServerValue.TIMESTAMP,seconds:Number($("duration")?.value)||20});setTimeout(()=>{flash();let color=pick(COLORS),cat=$(color.input)?.value||"Geen categorie";if($("hostPickerArea"))$("hostPickerArea").innerHTML=`<div class="colorDisplay">${color.emoji}<br>${color.name}</div><div class="categoryDisplay">${esc(cat)}</div>`;db.ref("rooms/"+room+"/currentRound").set({id:currentRoundId,status:"ready",pickerMode:"bb",pickerMarkup:pickerHTML(),colorKey:color.key,colorName:color.name,colorEmoji:color.emoji,category:cat,seconds:Number($("duration")?.value)||20});if($("playBtn"))$("playBtn").disabled=false;if($("showAnswerBtn"))$("showAnswerBtn").disabled=false;$("hostScorePanel")?.classList.remove("hidden");if($("hostStatus"))$("hostStatus").textContent="Kleur bekend. Klik nu op Speel verborgen nummer."},3000)}
async function playHidden(){try{if(!currentTrack)return alert("Geen nummer gekozen. Druk eerst op START RONDE.");if($("playBtn")){$("playBtn").disabled=true;$("playBtn").textContent="🎵 Nummer speelt..."}if(!deviceId){await activatePlayer();await new Promise(r=>setTimeout(r,1200))}if(!deviceId){alert("Geen Spotify-speler actief. Klik eerst op Activeer Spotify-speler.");if($("playBtn")){$("playBtn").disabled=false;$("playBtn").textContent="🎵 Speel verborgen nummer"}return}let dur=(Number($("duration")?.value)||20)*1000,pos=0;if($("randomStart")?.checked&&currentTrack.duration_ms>dur+40000){let max=Math.max(0,currentTrack.duration_ms-dur-5000);pos=Math.floor(20000+Math.random()*Math.max(1,max-20000))}await api(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,{method:"PUT",body:JSON.stringify({uris:[currentTrack.uri],position_ms:pos})});let deadline=Date.now()+dur;await db.ref("rooms/"+currentRoomCode+"/currentRound").update({status:"answering",deadlineMs:deadline,musicStartedAt:firebase.database.ServerValue.TIMESTAMP});if($("stopBtn"))$("stopBtn").disabled=false;clearTimeout(lockTimer);lockTimer=setTimeout(lockRound,dur);clearTimeout(stopTimer);stopTimer=setTimeout(stopPlayback,dur);if($("hostStatus"))$("hostStatus").textContent="Muziek speelt. Spelers kunnen nu antwoorden."}catch(e){alert("Afspelen mislukt: "+e.message);if($("playBtn")){$("playBtn").disabled=false;$("playBtn").textContent="🎵 Speel verborgen nummer"}}}
async function stopPlayback(){try{await api("https://api.spotify.com/v1/me/player/pause",{method:"PUT",body:"{}"})}catch(e){}if($("stopBtn"))$("stopBtn").disabled=true}function answerObject(){return currentTrack?{track:currentTrack.name||"",artist:currentTrack.artists||"",album:currentTrack.album||"",year:(currentTrack.release_date||"").slice(0,4)||""}:null}function showHostAnswer(a){if(!$("hostAnswerArea")||!a)return;$("hostAnswerArea").innerHTML=`<div class="correctBox"><h3>${esc(a.track||"-")}</h3><p>${esc(a.artist||"-")}</p><p>${esc(a.album||"-")} — ${esc(a.year||"-")}</p></div>`}function publishAnswer(){let a=answerObject();if(!currentRoomCode||!a)return Promise.resolve();showHostAnswer(a);return db.ref("rooms/"+currentRoomCode+"/currentRound").update({correctAnswer:a,correctAnswerShown:true})}function lockRound(){if(!currentRoomCode)return;publishAnswer().then(()=>db.ref("rooms/"+currentRoomCode+"/currentRound").update({status:"locked"})).then(()=>{if($("hostStatus"))$("hostStatus").textContent="Tijd voorbij. Antwoord automatisch zichtbaar bij spelers."}).catch(e=>alert("Timer/antwoord fout: "+e.message))}function showAnswer(){publishAnswer().catch(e=>alert("Antwoord tonen mislukt: "+e.message))}
function renderHostScore(room){let r=room.currentRound||{};if(!r.id||!$("hostScoreboard"))return;$("hostScorePanel")?.classList.remove("hidden");if($("hostRoundInfo"))$("hostRoundInfo").textContent=`${r.colorEmoji||""} ${r.colorName||""} — ${r.category||""} — ${r.status||""}`;let ps=room.players||{},ans=room.answers?.[r.id]||{},cor=room.correct?.[r.id]||{};$("hostScoreboard").innerHTML=Object.entries(ps).map(([pid,p])=>{let st=cor[pid],cls=st===true?"scoreGood":st===false?"scoreBad":"scorePending";return`<div class="scoreCard ${cls}"><div>${esc(p.name||"Speler")}</div><div>${esc(ans[pid]?.answer||"Geen antwoord")}</div><div><button type="button" class="goodBtn ${st===true?"goodSelected":""}" data-pid="${pid}" data-good="true">✅</button><button type="button" class="badBtn ${st===false?"badSelected":""}" data-pid="${pid}" data-good="false">❌</button></div></div>`}).join("")}
function scoreboardClick(e){let btn=e.target.closest("button[data-pid]");if(!btn)return;e.preventDefault();let pid=btn.dataset.pid,good=btn.dataset.good==="true";db.ref("rooms/"+currentRoomCode+"/currentRound").once("value").then(s=>{let r=s.val()||{};if(!r.id)throw Error("Geen actieve ronde.");return db.ref("rooms/"+currentRoomCode+"/correct/"+r.id+"/"+pid).set(good)}).then(()=>{if($("hostStatus"))$("hostStatus").textContent="🐵 Beoordeling opgeslagen."}).catch(e=>alert(e.message))}
function publishResults(){db.ref("rooms/"+currentRoomCode).once("value").then(s=>{let room=s.val()||{},r=room.currentRound||{},up={};up[`rooms/${currentRoomCode}/currentRound/status`]="judged";Object.entries(room.players||{}).forEach(([pid,p])=>{let good=room.correct?.[r.id]?.[pid]===true;if(!good)up[`rooms/${currentRoomCode}/players/${pid}/ready`]=true});return db.ref().update(up)}).then(()=>{if($("hostStatus"))$("hostStatus").textContent="Resultaten verzonden."})}
function openNewGameModal(){if(!currentRoomCode)return alert("Maak eerst een kamer.");let m=$("newGameModal");if(m){m.classList.remove("hidden");m.style.display="flex"}}function closeNewGameModal(){let m=$("newGameModal");if(m){m.classList.add("hidden");m.style.display="none"}}function bbStartNewGameSameRoom(){if(!currentRoomCode){closeNewGameModal();return}db.ref("rooms/"+currentRoomCode).once("value").then(s=>{let room=s.val()||{},up={};Object.keys(room.players||{}).forEach(pid=>{up[`rooms/${currentRoomCode}/players/${pid}/card`]=genCard();up[`rooms/${currentRoomCode}/players/${pid}/marked`]={};up[`rooms/${currentRoomCode}/players/${pid}/bingo`]=false;up[`rooms/${currentRoomCode}/players/${pid}/ready`]=false;up[`rooms/${currentRoomCode}/players/${pid}/lastPickedRound`]=null});up[`rooms/${currentRoomCode}/currentRound`]=null;up[`rooms/${currentRoomCode}/answers`]=null;up[`rooms/${currentRoomCode}/correct`]=null;up[`rooms/${currentRoomCode}/bingos`]=null;return db.ref().update(up)}).then(()=>{closeNewGameModal();$("hostBingoPanel")?.classList.add("hidden");if($("hostStatus"))$("hostStatus").textContent="Nieuw spel gestart in dezelfde kamer."})}
function showStartPopup(){let o=$("hbHostStartOverlay");if(!o)return;let s=localStorage.hb_host_room||localStorage.hb_last_stable_room||"";if(s){$("hbLastRoomLine")?.classList.remove("hidden");if($("hbLastRoomCode"))$("hbLastRoomCode").textContent=s;if($("hbResumeRoomBtn")){$("hbResumeRoomBtn").disabled=false;$("hbResumeRoomBtn").textContent="🔄 Hervat "+s}renderRoomBox(s)}else{$("hbLastRoomLine")?.classList.add("hidden");if($("hbResumeRoomBtn")){$("hbResumeRoomBtn").disabled=true;$("hbResumeRoomBtn").textContent="🔄 Hervat kamer"}}o.classList.remove("hidden");$("hbResumeRoomBtn")?.addEventListener("click",()=>{let r=localStorage.hb_host_room||localStorage.hb_last_stable_room||"";if(r){currentRoomCode=r;renderRoomBox(r);listenHost(r);listenBingo(r)}o.classList.add("hidden")},{once:true});$("hbNewRoomModalBtn")?.addEventListener("click",()=>{localStorage.removeItem("hb_host_room");localStorage.removeItem("hb_last_stable_room");currentRoomCode="";o.classList.add("hidden");createRoom()},{once:true});$("hbCloseModalBtn")?.addEventListener("click",()=>o.classList.add("hidden"),{once:true})}
function setupPlayerMode(){document.body.classList.add("playerMode");setModeLabel("🎮 Speler");$("hostApp")?.classList.add("hidden");$("playerApp")?.classList.remove("hidden");currentRoomCode=(new URLSearchParams(location.search).get("room")||"").toUpperCase();if($("playerRoomCode"))$("playerRoomCode").textContent=currentRoomCode;if(currentPlayerName&&$("playerNameInput"))$("playerNameInput").value=currentPlayerName;if(currentPlayerId&&currentPlayerName){listenPlayer();showDashboard()}}
function genCard(){let colors=["yellow","pink","purple","blue","green"],pool=[];for(let i=0;i<24;i++)pool.push(colors[i%5]);for(let i=pool.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}let card=[],k=0;for(let i=0;i<25;i++)card.push(i===12?"free":pool[k++]);return card}
function joinPlayer(){let name=($("playerNameInput")?.value||"").trim();if(!name)return alert("Vul je naam in.");currentPlayerName=name;if(!currentPlayerId)currentPlayerId="p_"+Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);localStorage.hb_player_id=currentPlayerId;localStorage.hb_player_name=currentPlayerName;localStorage.hb_player_room=currentRoomCode;let ref=db.ref("rooms/"+currentRoomCode+"/players/"+currentPlayerId);ref.once("value").then(s=>{let ex=s.val()||{};return ref.update({name,online:true,ready:true,joinedAt:ex.joinedAt||firebase.database.ServerValue.TIMESTAMP,lastSeen:firebase.database.ServerValue.TIMESTAMP,card:ex.card||genCard(),marked:ex.marked||{},bingo:!!ex.bingo})}).then(()=>{ref.child("online").onDisconnect().set(false);listenPlayer();showDashboard()})}
function showDashboard(){$("screenJoin")?.classList.add("hidden");$("screenDashboard")?.classList.remove("hidden")}function listenPlayer(){db.ref("rooms/"+currentRoomCode).off();db.ref("rooms/"+currentRoomCode).on("value",s=>{let room=s.val()||{},r=room.currentRound||{};activeRound=r;showDashboard();renderCompactDashboard(room,r)});listenBingo(currentRoomCode)}
function colorHex(k){return{yellow:"#FFCC33",pink:"#00D4C7",purple:"#FF8A1F",blue:"#7ED957",green:"#FF5A5F",free:"#FFCC33"}[k]||"rgba(255,255,255,.18)"}function colorEmoji(k){return{yellow:"🟡",pink:"🩵",purple:"🟠",blue:"🟢",green:"🔴",free:"🐵"}[k]||""}
function renderCompactDashboard(room,r){renderCompactTop(room,r);renderCompactAnswer(room,r);renderCompactScore(room,r);renderCompactCard(room,r);renderCompactPicker(room,r)}
function renderCompactTop(room,r){if($("dashRoundNo"))$("dashRoundNo").textContent=currentPlayerName||"Speler";if($("dashPlayerCount"))$("dashPlayerCount").textContent=Object.keys(room.players||{}).length;clearInterval(dashTimer);dashTimer=setInterval(()=>{let el=$("dashTimer");if(!el)return;if(r?.status==="answering"&&r.deadlineMs){let left=Math.max(0,Math.ceil((r.deadlineMs-Date.now())/1000));el.textContent="00:"+String(left).padStart(2,"0");if(left<=0)clearInterval(dashTimer)}else if(r?.status==="locked"||r?.status==="judged")el.textContent="00:00";else el.textContent="--"},300)}
function renderCompactAnswer(room,r){let b=$("dashAnswerBlock");if(!b)return;if(!r?.id){b.innerHTML=`<h3>🎮 Wachten</h3><p class="small">Wachten op de host...</p>`;return}let own=room.answers?.[r.id]?.[currentPlayerId],ans=r.correctAnswer;if((r.status==="locked"||r.status==="judged")&&ans){b.innerHTML=`<h3>🐵 Juiste antwoord</h3><p>🎵 <strong>${esc(ans.track||"-")}</strong></p><p>🎤 ${esc(ans.artist||"-")}</p><p>📅 ${esc(ans.year||"-")}</p>`;return}if(r.status==="answering"){if(own){b.innerHTML=`<h3>🔒 Antwoord ingeleverd</h3><p>${esc(own.answer||"Leeg antwoord")}</p><p class="small">Wachten tot de tijd voorbij is...</p>`;return}b.innerHTML=`<h3>✍️ Vul je antwoord in</h3><p class="small">${esc(r.colorEmoji||"")} ${esc(r.colorName||"")} — ${esc(r.category||"")}</p><div class="compactInputRow"><input id="scoreAnswerInput" placeholder="Typ je antwoord"><button id="scoreSubmitAnswerBtn">Verstuur</button></div>`;$("scoreSubmitAnswerBtn")?.addEventListener("click",()=>submitAnswerValue($("scoreAnswerInput")?.value||""));return}if(r.status==="picking"){b.innerHTML=`<h3>🐵 Kleurkiezer</h3><p class="small">De BB-aap kiest een kleur...</p>`;return}if(r.status==="ready"){b.innerHTML=`<h3>🎵 Klaar voor muziek</h3><p class="small">${esc(r.colorEmoji||"")} ${esc(r.colorName||"")} — ${esc(r.category||"")}</p>`;return}b.innerHTML=`<h3>🎮 Wachten</h3><p class="small">Wachten op beoordeling...</p>`}
function submitAnswerValue(v){if(!activeRound?.id)return;db.ref("rooms/"+currentRoomCode+"/answers/"+activeRound.id+"/"+currentPlayerId).set({answer:v||"",submittedAt:firebase.database.ServerValue.TIMESTAMP})}
function renderCompactScore(room,r){let el=$("dashScoreboard");if(!el)return;let ps=room.players||{},ans=r?.id?room.answers?.[r.id]||{}:{},cor=r?.id?room.correct?.[r.id]||{}:{};el.innerHTML=Object.entries(ps).map(([pid,p])=>{let has=ans[pid]&&typeof ans[pid].answer!=="undefined",a=has?(String(ans[pid].answer).trim()||"Leeg antwoord"):"Nog niet ingevuld",st=r?.status==="judged"?cor[pid]:undefined,cls=st===true?"scoreGood":st===false?"scoreBad":"scorePending",ic=st===true?"🐵":st===false?"❌":has?"📝":"⏳";return`<div class="scoreCard ${cls}"><div class="scoreName">${esc(p.name||"Speler")}${pid===currentPlayerId?" (jij)":""}</div><div>${esc(a)}</div><div>${ic}</div></div>`}).join("")||"Nog geen spelers."}
function renderCompactCard(room,r){let me=room.players?.[currentPlayerId]||{},card=me.card||[],marked=me.marked||{},box=$("dashOwnCard");if(!box)return;let goodValue=r?.id&&room.correct?.[r.id]?room.correct[r.id][currentPlayerId]:undefined,good=goodValue===true,bad=goodValue===false,picked=r?.id&&me.lastPickedRound===r.id,canPick=r?.status==="judged"&&good&&!picked;if(r?.status==="judged")maybeShowFeedback(room,r,goodValue,picked);if($("dashCardHint"))$("dashCardHint").textContent=canPick?`Kies een ${r.colorEmoji||""} ${r.colorName||""} vakje`:picked?"🐵 Vakje gekozen":bad?"Helaas, geen vakje deze ronde":"Jouw bingokaart";if($("dashCardStatus"))$("dashCardStatus").textContent=canPick?"Tik op een geldig kleurvakje":me.ready?"🐵 READY voor volgende ronde":"Wachten op ronde";box.innerHTML=card.map((c,i)=>{let isMarked=!!marked[i]||i===12,pickable=canPick&&c===r.colorKey&&c!=="free"&&!marked[i];return`<div class="compactCell ${c==="free"?"free":""} ${isMarked?"marked":""} ${pickable?"pickable":""}" data-i="${i}" style="background:${colorHex(c)}">${isMarked?"🐵":""}</div>`}).join("");box.querySelectorAll(".pickable").forEach(cell=>cell.addEventListener("click",()=>pickCell(Number(cell.dataset.i))))}
function renderCompactPicker(room,r){let area=$("dashPickerArea");if(!area)return;if(!r?.id){area.innerHTML=`<div class="dashCatText">Wachten op host</div>`;return}if(r.status==="picking"){area.innerHTML=pickerHTML();return}area.innerHTML=`<div class="dashColorBig">${esc(r.colorEmoji||"🎮")}</div><div class="dashColorText">${esc(r.colorName||"KLEUR")}</div><div class="dashCatText">${esc(r.category||"Wachten...")}</div>`}
function overlay(){let o=$("bbFeedbackOverlay");if(!o){o=document.createElement("div");o.id="bbFeedbackOverlay";o.className="bbFeedbackOverlay";document.body.appendChild(o)}return o}function closeOverlay(){$("bbFeedbackOverlay")?.classList.remove("show")}function maybeShowFeedback(room,r,good,picked){if(!r?.id||r.status!=="judged")return;if(good===true&&!picked){let k=`${r.id}_good_${currentPlayerId}`;if(feedbackSeen[k])return;feedbackSeen[k]=true;setTimeout(()=>showGoodOverlay(room,r),80)}if(good===false){let k=`${r.id}_bad_${currentPlayerId}`;if(feedbackSeen[k])return;feedbackSeen[k]=true;setTimeout(()=>showBadOverlay(room,r),80)}}
function showGoodOverlay(room,r){let me=room.players?.[currentPlayerId]||{},card=me.card||[],marked=me.marked||{},cells=card.map((c,i)=>{let isMarked=!!marked[i]||i===12,pickable=c===r.colorKey&&c!=="free"&&!marked[i];return`<button type="button" class="bbOverlayCell ${isMarked?"marked":""} ${pickable?"pickable":"blocked"}" data-i="${i}" style="background:${colorHex(c)}" ${pickable?"":"disabled"}>${isMarked?"🐵":colorEmoji(c)}</button>`}).join(""),o=overlay();o.innerHTML=`<div class="bbOverlayCard good"><div class="bbMonkeyFace">🐵😎</div><img src="bb_mascot_dj.png" class="bbOverlayLogo bbMascotVisible" alt="BB-aap"><div class="bbOverlayTitle">😎 GOED ANTWOORD!</div><div class="bbOverlayText">Kies één ${r.colorEmoji||""} ${r.colorName||""} vakje</div><div class="bbOverlayBingo">${cells}</div><div class="bbOverlayHint">Tik op een opgelicht vakje</div></div>`;o.classList.add("show");o.querySelectorAll(".bbOverlayCell.pickable").forEach(btn=>btn.addEventListener("click",()=>{let i=Number(btn.dataset.i);btn.textContent="🐵";btn.classList.add("chosen");pickCell(i);setTimeout(closeOverlay,650)}))}
function showBadOverlay(room,r){let ans=r.correctAnswer||{},answer=ans.track?`🎵 ${esc(ans.track||"-")}<br>🎤 ${esc(ans.artist||"-")}`:"Volgende ronde beter!",o=overlay();o.innerHTML=`<div class="bbOverlayCard bad"><div class="bbMonkeyFace">🐵🙈</div><img src="bb_mascot_dj.png" class="bbOverlayLogo bbMascotVisible" alt="BB-aap"><div class="bbOverlayTitle">🙈 HELAAS!</div><div class="bbOverlayText">Deze was lastig...</div><div class="bbOverlayAnswer">${answer}</div><button type="button" class="bbOverlayContinue">Verder</button></div>`;o.classList.add("show");o.querySelector(".bbOverlayContinue")?.addEventListener("click",closeOverlay);db.ref("rooms/"+currentRoomCode+"/players/"+currentPlayerId+"/ready").set(true);setTimeout(closeOverlay,4500)}
function checkBingo(marked){let lines=[[0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],[0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,23],[4,9,14,19,24],[0,6,12,18,24],[4,8,12,16,20]];return lines.some(line=>line.every(i=>i===12||marked?.[i]))}
function pickCell(i){db.ref("rooms/"+currentRoomCode+"/players/"+currentPlayerId).once("value").then(s=>{let p=s.val()||{},marked=p.marked||{},card=p.card||[];if(!activeRound?.id)return;if(card[i]!==activeRound.colorKey||marked[i])return;marked[i]=true;let bingo=checkBingo(marked);return db.ref("rooms/"+currentRoomCode+"/players/"+currentPlayerId).update({marked,bingo,lastPickedRound:activeRound.id,ready:true}).then(()=>{if(bingo)return db.ref("rooms/"+currentRoomCode+"/bingos").push({name:currentPlayerName,roundId:activeRound.id,at:firebase.database.ServerValue.TIMESTAMP})})})}
function activateSound(){try{let C=window.AudioContext||window.webkitAudioContext;if(C&&!audioCtx)audioCtx=new C();if(audioCtx?.state==="suspended")audioCtx.resume();if($("soundStatus"))$("soundStatus").textContent="🐵 actief."}catch(e){}}function flash(){let f=document.createElement("div");f.className="flash";document.body.appendChild(f);setTimeout(()=>f.remove(),700)}function tune(){try{let C=window.AudioContext||window.webkitAudioContext;if(!audioCtx&&C)audioCtx=new C();if(!audioCtx)return;[523,659,784,1046].forEach((freq,i)=>{let o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=freq;o.connect(g);g.connect(audioCtx.destination);let t=audioCtx.currentTime+i*.18;g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.3,t+.03);g.gain.exponentialRampToValueAtTime(.001,t+.16);o.start(t);o.stop(t+.18)})}catch(e){}}function confetti(){let cs=["#FFCC33","#00D4C7","#FF8A1F","#7ED957","#FF5A5F","#fff"];for(let i=0;i<90;i++){let p=document.createElement("div");p.className="confetti";p.style.left=Math.random()*100+"vw";p.style.background=pick(cs);document.body.appendChild(p);setTimeout(()=>p.remove(),3500)}}function showWinner(name){if($("winnerPanel")){$("winnerPanel").classList.remove("hidden");$("winnerMessage").innerHTML="🏆 BINGO!<br>Speler "+esc(name)+" heeft gewonnen!"}if($("hostBingoPanel")){$("hostBingoPanel").classList.remove("hidden");$("hostBingoMessage").innerHTML="🏆 BINGO!<br>Speler "+esc(name)+" heeft gewonnen!"}if($("bingoFullOverlay")){$("bingoFullOverlay").classList.remove("hidden");if($("bingoFullName"))$("bingoFullName").textContent=name||"Speler";setTimeout(()=>$("bingoFullOverlay")?.classList.add("hidden"),5500)}confetti();tune()}
function listenBingo(room){if(!room)return;db.ref("rooms/"+room+"/bingos").off();db.ref("rooms/"+room+"/bingos").on("child_added",s=>{let b=s.val()||{},key=s.key+"_"+(b.roundId||"");if(key===bingoSeenKey)return;bingoSeenKey=key;localStorage.hb_last_bingo_key=key;showWinner(b.name||"onbekend")})}



/* =========================
   V84 - SPELER MOET EERST NAAM INVULLEN
   ========================= */
(function(){
  function q(id){ return document.getElementById(id); }
  function getRoom(){ return (new URLSearchParams(location.search).get("room") || "").toUpperCase(); }

  function forceNameFirstV84(){
    const room = getRoom();
    if(!room) return;

    document.body.classList.add("playerMode");
    q("hostApp")?.classList.add("hidden");
    q("playerApp")?.classList.remove("hidden");

    const mode = q("modeText");
    if(mode) mode.textContent = "🎮 Speler";

    const roomLabel = q("playerRoomCode");
    if(roomLabel) roomLabel.textContent = room;

    const savedRoom = localStorage.hb_player_room || "";
    const savedName = localStorage.hb_player_name || "";
    const savedId = localStorage.hb_player_id || "";
    const mayResume = savedRoom === room && savedName && savedId;

    if(!mayResume){
      localStorage.removeItem("hb_player_room");
      localStorage.removeItem("hb_player_name");
      localStorage.removeItem("hb_player_id");

      if(typeof currentPlayerId !== "undefined") currentPlayerId = "";
      if(typeof currentPlayerName !== "undefined") currentPlayerName = "";
      if(typeof currentRoomCode !== "undefined") currentRoomCode = room;

      q("screenJoin")?.classList.remove("hidden");
      q("screenDashboard")?.classList.add("hidden");

      const input = q("playerNameInput");
      if(input){
        input.value = "";
        setTimeout(() => input.focus(), 300);
      }
    }
  }

  if(typeof setupPlayerMode === "function" && !window.__setupPlayerModeV84Wrapped){
    window.__setupPlayerModeV84Wrapped = true;
    const oldSetupPlayerMode = setupPlayerMode;
    setupPlayerMode = function(){
      const room = getRoom();
      if(typeof currentRoomCode !== "undefined") currentRoomCode = room;

      const savedRoom = localStorage.hb_player_room || "";
      const savedName = localStorage.hb_player_name || "";
      const savedId = localStorage.hb_player_id || "";

      if(savedRoom === room && savedName && savedId){
        return oldSetupPlayerMode.apply(this, arguments);
      }
      forceNameFirstV84();
    };
  }

  if(typeof joinPlayer === "function" && !window.__joinPlayerV84Wrapped){
    window.__joinPlayerV84Wrapped = true;
    const oldJoinPlayer = joinPlayer;
    joinPlayer = function(){
      const room = getRoom();
      if(room) localStorage.hb_player_room = room;
      return oldJoinPlayer.apply(this, arguments);
    };
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(forceNameFirstV84, 500));
})();



/* =========================
   V85 - BB AAP ALTIJD ZICHTBAAR IN OVERLAY
   ========================= */
(function(){
  const obs = new MutationObserver(() => {
    document.querySelectorAll(".bbOverlayCard").forEach(card => {
      if(!card.querySelector(".bbMonkeyFace")){
        const face = document.createElement("div");
        face.className = "bbMonkeyFace";
        face.textContent = card.classList.contains("bad") ? "🐵🙈" : "🐵😎";
        card.insertBefore(face, card.firstChild);
      }
      const img = card.querySelector(".bbOverlayLogo");
      if(img){
        img.src = "bb_mascot_dj.png";
        img.classList.add("bbMascotVisible");
      }
    });
  });
  document.addEventListener("DOMContentLoaded", () => {
    obs.observe(document.body, {childList:true, subtree:true});
  });
})();


/* =========================
   V89 - App polish fixes Georgio
   - startpopup alleen bij normaal openen, niet na Spotify login/redirect
   - host room compacter met grotere QR + glow
   - antwoord nooit tonen voor timer voorbij is
   - foutscherm zonder losse aap-emojis
   - goedscherm: vakjes volledig gekleurd, geen kleine kleur-emoji
   ========================= */
(function(){
  const q = (id) => document.getElementById(id);
  const hasSpotifyCallback = () => new URLSearchParams(location.search).has("code");
  const roomLink = (code) => location.origin + location.pathname + "?room=" + code;

  // Popup alleen bij openen van de host-app. Niet na terugkomst van Spotify OAuth.
  if (typeof setupHostMode === "function" && !window.__setupHostModeV89Wrapped) {
    window.__setupHostModeV89Wrapped = true;
    setupHostMode = function(){
      setModeLabel("🎤 Host");
      document.body.classList.remove("playerMode");
      q("hostApp")?.classList.remove("hidden");
      q("playerApp")?.classList.add("hidden");
      restoreHost();

      if (hasSpotifyCallback()) {
        sessionStorage.setItem("bb_start_popup_seen", "1");
        return;
      }
      if (sessionStorage.getItem("bb_start_popup_seen") !== "1") {
        sessionStorage.setItem("bb_start_popup_seen", "1");
        showStartPopup();
      }
    };
  }

  // Compacter hostscherm: grote QR, geen "Deel de link" blok, wel Kopieer link.
  if (typeof renderRoomBox === "function" && !window.__renderRoomBoxV89Wrapped) {
    window.__renderRoomBoxV89Wrapped = true;
    renderRoomBox = function(code){
      const box = q("roomBox");
      if(!code || !box) return;
      const link = roomLink(code);
      box.classList.remove("hidden");
      box.innerHTML = `
        <div class="hostRoomGridV89">
          <div class="hostRoomCodeV89">
            <div class="roomLabelV89">SPELCODE</div>
            <div class="roomCodeV89">${esc(code)}</div>
          </div>
          <div class="hostRoomQrWrapV89">
            <img class="hostQrV89" alt="QR code" src="${qrUrl(link)}">
          </div>
          <div class="hostRoomCopyV89">
            <input id="joinLink" class="joinLinkHiddenV89" readonly value="${esc(link)}" aria-label="Kamerlink">
            <button id="copyRoomLinkBtn" type="button" class="copyRoomLinkBtnV89">📋 Kopieer link</button>
          </div>
        </div>`;
    };
  }

  function updateShowAnswerButtonV89(room){
    const btn = q("showAnswerBtn");
    if(!btn) return;
    const r = room?.currentRound || activeRound || {};
    const timerPast = r.deadlineMs && Date.now() >= Number(r.deadlineMs);
    const mayShow = r.status === "locked" || r.status === "judged" || timerPast;
    btn.disabled = !mayShow;
    btn.title = mayShow ? "Antwoord tonen" : "Antwoord pas beschikbaar na de timer";
  }

  // Buttonstatus steeds goedzetten.
  if (typeof renderHostScore === "function" && !window.__renderHostScoreV89Wrapped) {
    window.__renderHostScoreV89Wrapped = true;
    const oldRenderHostScore = renderHostScore;
    renderHostScore = function(room){
      const res = oldRenderHostScore.apply(this, arguments);
      updateShowAnswerButtonV89(room || {});
      return res;
    };
  }

  // Antwoord mag nooit zichtbaar worden vóór timer voorbij is.
  if (typeof showAnswer === "function" && !window.__showAnswerV89Wrapped) {
    window.__showAnswerV89Wrapped = true;
    showAnswer = function(){
      if(!currentRoomCode) return;
      db.ref("rooms/"+currentRoomCode+"/currentRound").once("value").then(s=>{
        const r = s.val() || {};
        const timerPast = r.deadlineMs && Date.now() >= Number(r.deadlineMs);
        if(!(r.status === "locked" || r.status === "judged" || timerPast)) {
          alert("Het antwoord is pas zichtbaar nadat de timer voorbij is.");
          return;
        }
        return publishAnswer();
      }).catch(e=>alert("Antwoord tonen mislukt: "+e.message));
    };
  }

  // Maak lockRound expliciet: pas na timer publishen, daarna status locked.
  if (typeof lockRound === "function" && !window.__lockRoundV89Wrapped) {
    window.__lockRoundV89Wrapped = true;
    lockRound = function(){
      if(!currentRoomCode) return;
      db.ref("rooms/"+currentRoomCode+"/currentRound").once("value").then(s=>{
        const r = s.val() || {};
        const timerPast = !r.deadlineMs || Date.now() >= Number(r.deadlineMs) - 250;
        if(!timerPast) return; // beveiliging: nooit te vroeg tonen
        return publishAnswer()
          .then(()=>db.ref("rooms/"+currentRoomCode+"/currentRound").update({status:"locked"}))
          .then(()=>{ if(q("hostStatus")) q("hostStatus").textContent="Tijd voorbij. Antwoord automatisch zichtbaar bij spelers."; });
      }).catch(e=>alert("Timer/antwoord fout: "+e.message));
    };
  }

  // Goed antwoord overlay: grote vakjes volledig in kleur, geen kleine kleur-emoji's.
  if (typeof showGoodOverlay === "function" && !window.__showGoodOverlayV89Wrapped) {
    window.__showGoodOverlayV89Wrapped = true;
    showGoodOverlay = function(room,r){
      const me = room.players?.[currentPlayerId] || {}, card = me.card || [], marked = me.marked || {};
      const cells = card.map((c,i)=>{
        const isMarked = !!marked[i] || i === 12;
        const pickable = c === r.colorKey && c !== "free" && !marked[i];
        const label = isMarked ? "✓" : "";
        return `<button type="button" class="bbOverlayCell ${isMarked?"marked":""} ${pickable?"pickable":"blocked"}" data-i="${i}" style="background:${colorHex(c)}" ${pickable?"":"disabled"}>${label}</button>`;
      }).join("");
      const o = overlay();
      o.innerHTML = `<div class="bbOverlayCard good">
        <div class="bbMonkeyFace">🐵😎</div>
        <img src="bb_mascot_dj.png" class="bbOverlayLogo bbMascotVisible" alt="BB-aap">
        <div class="bbOverlayTitle">😎 GOED ANTWOORD!</div>
        <div class="bbOverlayText">Kies één ${r.colorEmoji||""} ${r.colorName||""} vakje</div>
        <div class="bbOverlayBingo">${cells}</div>
        <div class="bbOverlayHint">Tik op een opgelicht vakje</div>
      </div>`;
      o.classList.add("show");
      o.querySelectorAll(".bbOverlayCell.pickable").forEach(btn=>btn.addEventListener("click",()=>{
        const i = Number(btn.dataset.i);
        btn.textContent = "✓";
        btn.classList.add("chosen");
        pickCell(i);
        setTimeout(closeOverlay,650);
      }));
    };
  }

  // Fout antwoord overlay: geen losse aap-emojis, alleen het echte BB-logo/mascottebeeld.
  if (typeof showBadOverlay === "function" && !window.__showBadOverlayV89Wrapped) {
    window.__showBadOverlayV89Wrapped = true;
    showBadOverlay = function(room,r){
      const ans = r.correctAnswer || {};
      const answer = ans.track ? `🎵 ${esc(ans.track||"-")}<br>🎤 ${esc(ans.artist||"-")}` : "Volgende ronde beter!";
      const o = overlay();
      o.innerHTML = `<div class="bbOverlayCard bad">
        <img src="bb_mascot_dj.png" class="bbOverlayLogo bbMascotVisible" alt="Bingo Beats">
        <div class="bbOverlayTitle">HELAAS!</div>
        <div class="bbOverlayText">Deze was lastig...</div>
        <div class="bbOverlayAnswer">${answer}</div>
        <button type="button" class="bbOverlayContinue">Verder</button>
      </div>`;
      o.classList.add("show");
      o.querySelector(".bbOverlayContinue")?.addEventListener("click",closeOverlay);
      db.ref("rooms/"+currentRoomCode+"/players/"+currentPlayerId+"/ready").set(true);
      setTimeout(closeOverlay,4500);
    };
  }
})();

/* =========================
   V90 - Fixes Georgio
   - Goed/fout overlays zonder losse emoji's
   - Goed antwoord kaart: echte grote kleuren per vakje
   - Antwoord nooit publiceren vóór timer voorbij is
   ========================= */
(function(){
  const q = (id)=>document.getElementById(id);
  const COLOR_HEX_V90 = {yellow:'#FFCC33', pink:'#00D4C7', purple:'#FF8A1F', blue:'#7ED957', green:'#FF5A5F', free:'#FFCC33'};
  const colorClassV90 = (c)=>['yellow','pink','purple','blue','green','free'].includes(c) ? 'cell-' + c : '';

  // Extra beveiliging: publishAnswer zelf mag nooit te vroeg tonen, ook niet via oude code.
  if (typeof publishAnswer === 'function' && !window.__publishAnswerV90Wrapped) {
    window.__publishAnswerV90Wrapped = true;
    const oldPublishAnswerV90 = publishAnswer;
    publishAnswer = function(){
      if(!currentRoomCode) return Promise.resolve();
      return db.ref('rooms/'+currentRoomCode+'/currentRound').once('value').then(s=>{
        const r = s.val() || {};
        const timerPast = r.deadlineMs && Date.now() >= Number(r.deadlineMs) - 250;
        const allowed = r.status === 'locked' || r.status === 'judged' || timerPast;
        if(!allowed){
          if(q('hostAnswerArea')) q('hostAnswerArea').innerHTML = '';
          if(q('hostStatus')) q('hostStatus').textContent = 'Muziek speelt. Antwoord blijft verborgen tot de timer voorbij is.';
          return Promise.resolve();
        }
        return oldPublishAnswerV90.apply(this, arguments);
      });
    };
  }

  // Show-answer knop pas na timer bruikbaar.
  if (typeof startRoundVisual === 'function' && !window.__startRoundVisualV90Wrapped) {
    window.__startRoundVisualV90Wrapped = true;
    const oldStartRoundVisualV90 = startRoundVisual;
    startRoundVisual = function(){
      const res = oldStartRoundVisualV90.apply(this, arguments);
      setTimeout(()=>{
        if(q('showAnswerBtn')) q('showAnswerBtn').disabled = true;
        if(q('hostAnswerArea')) q('hostAnswerArea').innerHTML = '';
      }, 0);
      setTimeout(()=>{
        if(q('showAnswerBtn')) q('showAnswerBtn').disabled = true;
        if(q('hostAnswerArea')) q('hostAnswerArea').innerHTML = '';
      }, 3100);
      return res;
    };
  }

  if (typeof playHidden === 'function' && !window.__playHiddenV90Wrapped) {
    window.__playHiddenV90Wrapped = true;
    const oldPlayHiddenV90 = playHidden;
    playHidden = async function(){
      if(q('showAnswerBtn')) q('showAnswerBtn').disabled = true;
      if(q('hostAnswerArea')) q('hostAnswerArea').innerHTML = '';
      const res = await oldPlayHiddenV90.apply(this, arguments);
      const dur = (Number(q('duration')?.value)||20)*1000;
      setTimeout(()=>{ if(q('showAnswerBtn')) q('showAnswerBtn').disabled = false; }, dur + 350);
      return res;
    };
  }

  // Goed antwoord overlay: geen losse emoji's, alle vakjes zijn grote kleuren.
  if (typeof showGoodOverlay === 'function') {
    showGoodOverlay = function(room,r){
      const me = room.players?.[currentPlayerId] || {}, card = me.card || [], marked = me.marked || {};
      const cells = card.map((c,i)=>{
        const isMarked = !!marked[i] || i === 12;
        const pickable = c === r.colorKey && c !== 'free' && !marked[i];
        const cls = colorClassV90(c);
        return `<button type="button" class="bbOverlayCell ${cls} ${isMarked?'marked':''} ${pickable?'pickable':'blocked'}" data-i="${i}" style="--cellColor:${COLOR_HEX_V90[c]||'rgba(255,255,255,.18)'}" ${pickable?'':'disabled'}></button>`;
      }).join('');
      const o = overlay();
      o.innerHTML = `<div class="bbOverlayCard good">
        <img src="bb_mascot_dj.png" class="bbOverlayLogo bbMascotVisible" alt="Bingo Beats">
        <div class="bbOverlayTitle">GOED ANTWOORD!</div>
        <div class="bbOverlayText">Kies één ${esc(r.colorName||'kleur')} vakje</div>
        <div class="bbOverlayBingo">${cells}</div>
        <div class="bbOverlayHint">Tik op een opgelicht vakje</div>
      </div>`;
      o.classList.add('show');
      o.querySelectorAll('.bbOverlayCell.pickable').forEach(btn=>btn.addEventListener('click',()=>{
        const i = Number(btn.dataset.i);
        btn.classList.add('chosen');
        pickCell(i);
        setTimeout(closeOverlay,650);
      }));
    };
  }

  // Fout antwoord overlay: ook geen muziek/microfoon emoji's in antwoordblok.
  if (typeof showBadOverlay === 'function') {
    showBadOverlay = function(room,r){
      const ans = r.correctAnswer || {};
      const answer = ans.track ? `${esc(ans.track||'-')}<br>${esc(ans.artist||'-')}` : 'Volgende ronde beter!';
      const o = overlay();
      o.innerHTML = `<div class="bbOverlayCard bad">
        <img src="bb_mascot_dj.png" class="bbOverlayLogo bbMascotVisible" alt="Bingo Beats">
        <div class="bbOverlayTitle">HELAAS!</div>
        <div class="bbOverlayText">Deze was lastig...</div>
        <div class="bbOverlayAnswer">${answer}</div>
        <button type="button" class="bbOverlayContinue">Verder</button>
      </div>`;
      o.classList.add('show');
      o.querySelector('.bbOverlayContinue')?.addEventListener('click',closeOverlay);
      db.ref('rooms/'+currentRoomCode+'/players/'+currentPlayerId+'/ready').set(true);
      setTimeout(closeOverlay,4500);
    };
  }
})();


/* =========================
   V94 - SPELERSCHERM STORY FLOW + ADAPTIVE LAYOUT
   - Geen 4-vakken-dashboard meer
   - Eén duidelijke spelerfocus per fase
   - Werkt passend op telefoon, iPad en desktop
   ========================= */
(function(){
  const q = id => document.getElementById(id);
  const E = s => (typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m])));
  const HEX = {yellow:'#FFCC33', pink:'#00D4C7', purple:'#FF8A1F', blue:'#7ED957', green:'#FF5A5F', free:'#101716'};
  const NAME = {yellow:'GOUD', pink:'AQUA', purple:'ORANJE', blue:'LIME', green:'KORAAL', free:'FREE'};
  let draft = '';
  const seenAnswers = new Set();

  function secondsLeft(r){
    if(!r?.deadlineMs) return null;
    return Math.max(0, Math.ceil((Number(r.deadlineMs)-Date.now())/1000));
  }
  function timerPct(r){
    const left = secondsLeft(r);
    const sec = Math.max(1, Number(r?.seconds)||20);
    return left === null ? 100 : Math.max(0, Math.min(100, left / sec * 100));
  }
  function getPlayers(room){ return Object.entries(room.players || {}); }
  function ownAnswer(room,r){ return r?.id ? room.answers?.[r.id]?.[currentPlayerId] : null; }
  function isTimerOver(r){ return !!(r?.deadlineMs && Date.now() >= Number(r.deadlineMs)); }
  function initial(name){ return String(name||'?').trim().slice(0,1).toUpperCase() || '?'; }
  function categoryQuestion(cat){
    const c = String(cat||'').toLowerCase();
    if(c.includes('artiest')) return 'Welke artiest hoor je?';
    if(c.includes('titel') || c.includes('track') || c.includes('lied')) return 'Hoe heet deze track?';
    if(c.includes('decennium')) return 'Uit welk decennium komt deze track?';
    if(c.includes('jaar') || c.includes('voor') || c.includes('na')) return 'Uit welk jaar komt deze track?';
    return 'Hoe heet deze track?';
  }
  function cardHTML(room,r,{large=false,pick=false}={}){
    const me = room.players?.[currentPlayerId] || {};
    const card = me.card || [];
    const marked = me.marked || {};
    const cells = Array.from({length:25},(_,i)=>{
      const rawKey = card[i] || (i===12 ? 'free' : 'yellow');
      const key = (i===12 || rawKey==='free') ? 'free' : rawKey;
      const isFree = key === 'free';
      const isMarked = !!marked[i] || isFree;
      const canPick = pick && key===r?.colorKey && !isMarked && !isFree;
      const cls = ['bbStageCell', 'cell-'+key, isFree?'free':'', isMarked?'marked':'', canPick?'pickable':''].filter(Boolean).join(' ');
      const content = isFree ? '🐵' : (marked[i] ? '✓' : '');
      return `<button class="${cls}" data-i="${i}" style="--cell:${HEX[key]||'#777'};background:${HEX[key]||'#777'}" ${canPick?'':'tabindex="-1"'}>${content}</button>`;
    }).join('');
    return `<div class="bbStageBingo ${large?'large':''}">${cells}</div>`;
  }
  function attachPickHandlers(root){
    root.querySelectorAll('.bbStageCell.pickable').forEach(btn=>{
      btn.addEventListener('click',()=> pickCell(Number(btn.dataset.i)) );
    });
  }
  function readyListHTML(room){
    const ps = getPlayers(room);
    return `<div class="bbStageReadyList">${ps.map(([pid,p])=>`
      <div class="bbReadyRow ${p.ready?'ready':'wait'}">
        <div class="bbAvatar">${E(initial(p.name))}</div>
        <div class="bbReadyName">${E(p.name||'Speler')}${pid===currentPlayerId?' <span>jij</span>':''}</div>
        <div class="bbReadyState">${p.ready?'Klaar':'Wacht'}</div>
      </div>`).join('') || '<div class="small">Nog geen spelers.</div>'}</div>`;
  }
  function scoreboardHTML(room,r,{reveal=false,results=false}={}){
    const ps = getPlayers(room);
    const ans = r?.id ? (room.answers?.[r.id] || {}) : {};
    const cor = r?.id ? (room.correct?.[r.id] || {}) : {};
    const animate = ps.length <= 5;
    return `<div class="bbStageScoreList">${ps.map(([pid,p])=>{
      const has = ans[pid] && typeof ans[pid].answer !== 'undefined';
      const text = has ? (String(ans[pid].answer).trim() || 'Leeg antwoord') : 'Nog niet ingevuld';
      const key = `${r?.id||''}:${pid}:${has?text:''}`;
      const isNew = has && !seenAnswers.has(key);
      if(has) seenAnswers.add(key);
      const st = results ? cor[pid] : undefined;
      const cls = st===true?'good':st===false?'bad':has?'sent':'wait';
      const icon = results ? (st===true?'✓':'×') : (has?'✓':'…');
      const anim = animate && isNew ? 'newAnswer' : '';
      return `<div class="bbStageScoreRow ${cls} ${anim}">
        <div class="bbAvatar">${E(initial(p.name))}</div>
        <div class="bbScoreWho"><strong>${E(p.name||'Speler')}${pid===currentPlayerId?' <span>jij</span>':''}</strong><small>${has?'Ingezonden':'Wacht op antwoord'}</small></div>
        <div class="bbScoreAnswer">${has && (reveal || pid===currentPlayerId || ownAnswer(room,r)) ? E(text) : (has?'Ingezonden':'—')}</div>
        <div class="bbScoreIcon">${icon}</div>
      </div>`;
    }).join('')}</div>`;
  }
  function correctBlock(r){
    const a = r?.correctAnswer || {};
    if(!a.track && !a.artist) return '';
    return `<div class="bbCorrectTop">
      <div class="bbCorrectLabel">Juiste antwoord</div>
      <div class="bbCorrectTrack">${E(a.track||'-')}</div>
      <div class="bbCorrectMeta">${E(a.artist||'-')}${a.year?' — '+E(a.year):''}</div>
    </div>`;
  }
  function stage(root, cls, html){
    root.className = 'compactDashboard bbStageDashboard '+cls;
    root.innerHTML = `<section class="bbStageShell">${html}</section>`;
    attachPickHandlers(root);
  }
  function renderLobby(root,room){
    stage(root,'stageLobby',`
      <img src="bb_logo.png" class="bbStageLogo" alt="Bingo Beats">
      <h2>Wachten op de host</h2>
      <p class="bbStageSub">Iedereen klaar? Dan kan de ronde starten.</p>
      ${readyListHTML(room)}
      <div class="bbCardWrap"><h3>Jouw bingokaart</h3>${cardHTML(room,null,{large:false})}</div>
    `);
  }
  function renderPicking(root,room,r){
    stage(root,'stagePicking',`
      <img src="bb_logo.png" class="bbStageLogo small" alt="Bingo Beats">
      <h2>Het kleurenrad draait</h2>
      <p class="bbStageSub">De categorie wordt gekozen...</p>
      <div class="bbStageSpinnerMini">🎡</div>
    `);
  }
  function renderReady(root,room,r){
    stage(root,'stageReady',`
      <img src="bb_logo.png" class="bbStageLogo small" alt="Bingo Beats">
      <div class="bbChosenCard" style="--chosen:${HEX[r.colorKey]||'#FFCC33'}">
        <div class="bbChosenDot"></div>
        <h2>${E(r.colorName||'KLEUR')}</h2>
        <p>${E(r.category||'')}</p>
      </div>
      <p class="bbStageSub">Het nummer start direct...</p>
    `);
  }
  function renderAnswering(root,room,r){
    const own = ownAnswer(room,r);
    const left = secondsLeft(r);
    if(own){
      stage(root,'stageScore',`
        <img src="bb_logo.png" class="bbStageLogo mini" alt="Bingo Beats">
        <div class="bbOwnSubmitted"><span>Jouw antwoord</span><strong>${E(String(own.answer||'').trim()||'Leeg antwoord')}</strong></div>
        <h2>Live antwoorden</h2>
        <p class="bbStageSub">Je ziet antwoorden zodra spelers insturen. Nog niemand ziet wat goed is.</p>
        ${scoreboardHTML(room,r,{reveal:false,results:false})}
        <div class="bbBottomTimer">⏱ ${left ?? '--'} sec</div>
      `);
      return;
    }
    stage(root,'stageAnswer',`
      <img src="bb_logo.png" class="bbStageLogo mini" alt="Bingo Beats">
      <div class="bbRoundBadge" style="--chosen:${HEX[r.colorKey]||'#FFCC33'}"><span></span>${E(r.colorName||'')} · ${E(r.category||'')}</div>
      <div class="bbCountdownBig" style="--pct:${timerPct(r)}"><span>${left ?? ''}</span></div>
      <h2>${E(categoryQuestion(r.category))}</h2>
      <input id="bbStageAnswerInput" class="bbStageInput" value="${E(draft)}" placeholder="Typ je antwoord..." autocomplete="off">
      <button id="bbStageSubmitBtn" class="bbStageSubmit">VERSTUREN</button>
    `);
    const inp = q('bbStageAnswerInput');
    inp?.addEventListener('input', e=>{ draft = e.target.value; });
    inp?.addEventListener('keydown', e=>{ if(e.key==='Enter') q('bbStageSubmitBtn')?.click(); });
    q('bbStageSubmitBtn')?.addEventListener('click',()=>{
      const v = (q('bbStageAnswerInput')?.value || '').trim();
      if(!v) return alert('Vul eerst je antwoord in.');
      draft = '';
      submitAnswerValue(v);
    });
    setTimeout(()=>inp?.focus(),50);
  }
  function renderLocked(root,room,r){
    stage(root,'stageReveal',`
      <img src="bb_logo.png" class="bbStageLogo mini" alt="Bingo Beats">
      ${correctBlock(r) || '<h2>Tijd voorbij</h2><p class="bbStageSub">Wachten op de host...</p>'}
      <h2>Alle antwoorden</h2>
      ${scoreboardHTML(room,r,{reveal:true,results:false})}
      <p class="bbStageSub">De host controleert nu wie goed zat.</p>
    `);
  }
  function renderJudged(root,room,r){
    const good = room.correct?.[r.id]?.[currentPlayerId] === true;
    const me = room.players?.[currentPlayerId] || {};
    const picked = me.lastPickedRound === r.id;
    if(good && !picked){
      stage(root,'stagePickCard',`
        <img src="bb_logo.png" class="bbStageLogo mini" alt="Bingo Beats">
        <h2>GOED ANTWOORD!</h2>
        <p class="bbStageSub">Kies één <strong>${E(r.colorName||'')}</strong> vakje</p>
        ${cardHTML(room,r,{large:true,pick:true})}
        <p class="bbStageSub bottom">Tik op een opgelicht vakje</p>
      `);
      return;
    }
    if(good && picked){
      stage(root,'stageLobby',`
        <img src="bb_logo.png" class="bbStageLogo" alt="Bingo Beats">
        <h2>Vakje gekozen</h2>
        <p class="bbStageSub">Wachten op de volgende ronde...</p>
        <div class="bbCardWrap">${cardHTML(room,r,{large:false})}</div>
      `);
      return;
    }
    stage(root,'stageBad',`
      <img src="bb_logo.png" class="bbStageLogo" alt="Bingo Beats">
      <h2>HELAAS!</h2>
      <p class="bbStageSub">Deze was lastig...</p>
      ${correctBlock(r)}
      <p class="bbStageSub">Wachten op de volgende ronde...</p>
    `);
  }

  // Definitieve renderer: vervangt 4-vakken-layout volledig.
  renderCompactDashboard = function(room,r){
    const root = q('screenDashboard');
    if(!root) return;
    document.body.classList.add('bbStageMode');
    if(!r?.id) return renderLobby(root,room);
    if(r.status === 'picking') return renderPicking(root,room,r);
    if(r.status === 'ready') return renderReady(root,room,r);
    if(r.status === 'answering') return renderAnswering(root,room,r);
    if(r.status === 'locked') return renderLocked(root,room,r);
    if(r.status === 'judged') return renderJudged(root,room,r);
    return renderLobby(root,room);
  };

  // Zorg dat de topheader op spelersscherm niet teveel ruimte pakt.
  function applyV94Mode(){ document.body.classList.add('bbStageMode'); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', applyV94Mode); else applyV94Mode();
})();

/* =========================
   V98 - SPOTIFY AFSPÉELTEST VOOR START RONDE
   - Start ronde doet eerst een echte stille playback-test
   - Geen kleurenrad / ronde als Spotify niet echt kan afspelen
   - Voorkomt 'device not found' pas tijdens het spel
   ========================= */
(function(){
  const q = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function waitForSpotifyDeviceV98(timeoutMs = 6500){
    const token = await getToken();
    if(!token) throw new Error('Login eerst met Spotify.');
    if(!window.Spotify) throw new Error('Spotify Web Player is nog niet geladen. Wacht kort en probeer opnieuw.');

    if(!deviceId){
      await activatePlayer();
    } else if(player){
      try{ await player.connect(); }catch(e){}
    }

    const start = Date.now();
    while(!deviceId && Date.now() - start < timeoutMs){
      await sleep(250);
    }
    if(!deviceId) throw new Error('Geen actieve Bingo Beats Spotify-speler gevonden. Open Spotify niet op een ander apparaat en klik opnieuw op START RONDE.');

    // Maak de Bingo Beats speler expliciet het actieve apparaat.
    try{
      await api('https://api.spotify.com/v1/me/player', {
        method:'PUT',
        body: JSON.stringify({ device_ids:[deviceId], play:false })
      });
      await sleep(450);
    }catch(e){
      // Sommige accounts/devices geven hier soms 204/lege responses of tijdelijke errors.
      // De echte test hieronder bepaalt of afspelen werkt.
    }

    return deviceId;
  }

  async function spotifyPlaybackPreflightV98(track){
    if(!track?.uri) throw new Error('Geen testnummer beschikbaar. Upload eerst je muzieklijst.');
    if(q('hostStatus')) q('hostStatus').textContent = 'Spotify wordt getest vóór het spel begint...';
    if(q('startRoundBtn')){ q('startRoundBtn').disabled = true; q('startRoundBtn').textContent = '🔎 Spotify testen...'; }

    await waitForSpotifyDeviceV98();

    // Stille echte test: mute de Web Player, speel heel kort af, pauzeer direct.
    // Dit vangt device_not_found vóórdat spelers het kleurenrad zien.
    let oldVolume = null;
    try{
      if(player && typeof player.getVolume === 'function') oldVolume = await player.getVolume();
    }catch(e){}
    try{
      if(player && typeof player.setVolume === 'function') await player.setVolume(0);
    }catch(e){}

    try{
      await api(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method:'PUT',
        body: JSON.stringify({ uris:[track.uri], position_ms:0 })
      });
      await sleep(550);
      await api('https://api.spotify.com/v1/me/player/pause', { method:'PUT', body:'{}' }).catch(()=>{});
    }catch(e){
      throw new Error('Spotify kan nu niet afspelen: ' + (e.message || 'device not found'));
    }finally{
      try{ if(player && typeof player.setVolume === 'function') await player.setVolume(oldVolume ?? .8); }catch(e){}
    }

    localStorage.bb_spotify_preflight_ok_at = String(Date.now());
    if(q('hostStatus')) q('hostStatus').textContent = 'Spotify getest: afspelen werkt. Ronde wordt gestart...';
    return true;
  }

  function rollbackUsedTrackV98(track){
    try{
      if(!track?.id) return;
      const used = JSON.parse(localStorage.hb_used || '[]').filter(id => id !== track.id);
      localStorage.hb_used = JSON.stringify(used);
      if(typeof updateStatus === 'function') updateStatus();
    }catch(e){}
  }

  // Start ronde: eerst Spotify écht testen, daarna pas rad/ronde starten.
  startRound = async function(){
    if(!currentRoomCode) return alert('Maak eerst een kamer.');
    try{
      const snap = await db.ref('rooms/'+currentRoomCode).once('value');
      const room = snap.val() || {};
      if(!allReady(room)) return alert('Nog niet iedereen is READY.');

      currentTrack = chooseTrack();
      if(!currentTrack) return alert('Upload eerst je muzieklijst.');

      try{
        await spotifyPlaybackPreflightV98(currentTrack);
      }catch(e){
        rollbackUsedTrackV98(currentTrack);
        currentTrack = null;
        if(q('startRoundBtn')){ q('startRoundBtn').disabled = false; q('startRoundBtn').textContent = '🎲 START RONDE'; }
        if(q('hostStatus')) q('hostStatus').textContent = 'Spotify-test mislukt. Los dit eerst op en start daarna de ronde.';
        alert(
          e.message + '\n\n' +
          'Oplossing:\n' +
          '1. Zorg dat Spotify niet actief is op een ander apparaat.\n' +
          '2. Klik op Activeer Spotify-speler.\n' +
          '3. Wacht tot je ziet dat de speler actief is.\n' +
          '4. Klik daarna opnieuw op START RONDE.'
        );
        return;
      }

      const up = {};
      Object.keys(room.players || {}).forEach(pid => up[`rooms/${currentRoomCode}/players/${pid}/ready`] = false);
      await db.ref().update(up);
      return startRoundVisual(currentRoomCode);
    }catch(e){
      if(q('startRoundBtn')){ q('startRoundBtn').disabled = false; q('startRoundBtn').textContent = '🎲 START RONDE'; }
      alert('Start ronde mislukt: ' + e.message);
    }
  };

  // Afspelen tijdens de ronde: geen answer-screen meer als Spotify faalt.
  playHidden = async function(){
    try{
      if(!currentTrack) return alert('Geen nummer gekozen. Druk eerst op START RONDE.');
      if(q('playBtn')){ q('playBtn').disabled = true; q('playBtn').textContent = '🎵 Nummer speelt...'; }

      await waitForSpotifyDeviceV98();

      const dur = (Number(q('duration')?.value) || 20) * 1000;
      let pos = 0;
      if(q('randomStart')?.checked && currentTrack.duration_ms > dur + 40000){
        const max = Math.max(0, currentTrack.duration_ms - dur - 5000);
        pos = Math.floor(20000 + Math.random() * Math.max(1, max - 20000));
      }

      // Eerst Spotify echt starten. Pas daarna krijgen spelers het antwoordscherm.
      await api(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method:'PUT',
        body: JSON.stringify({ uris:[currentTrack.uri], position_ms:pos })
      });

      const deadline = Date.now() + dur;
      await db.ref('rooms/'+currentRoomCode+'/currentRound').update({
        status:'answering',
        deadlineMs: deadline,
        musicStartedAt: firebase.database.ServerValue.TIMESTAMP
      });

      clearTimeout(lockTimer);
      lockTimer = setTimeout(lockRound, dur);
      clearTimeout(stopTimer);
      stopTimer = setTimeout(stopPlayback, dur);
      if(q('stopBtn')) q('stopBtn').disabled = false;
      if(q('showAnswerBtn')) q('showAnswerBtn').disabled = true;
      if(q('hostStatus')) q('hostStatus').textContent = 'Muziek speelt. Spelers kunnen nu antwoorden.';
    }catch(e){
      alert('Afspelen mislukt vóór de ronde startte: ' + e.message);
      try{ await db.ref('rooms/'+currentRoomCode+'/currentRound').update({status:'ready'}); }catch(_e){}
      if(q('playBtn')){ q('playBtn').disabled = false; q('playBtn').textContent = '🎵 Speel verborgen nummer'; }
      if(q('hostStatus')) q('hostStatus').textContent = 'Spotify speelt niet af. Controleer de speler en probeer opnieuw.';
    }
  };
})();


/* =========================
   V99 - TEST VOOR JE BEGINT KNOP
   - Host kan vóór spelstart Spotify + CSV + device + echt afspelen testen
   - Speelt 5 seconden een testliedje uit de CSV af
   - Spelers zien tijdens de test een popup: "Testlied speelt..."
   ========================= */
(function(){
  const q = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function ensureTestButton(){
    if(q('bbPreGameTestBtn')) return;
    const startBtn = q('startRoundBtn');
    if(!startBtn) return;
    const btn = document.createElement('button');
    btn.id = 'bbPreGameTestBtn';
    btn.type = 'button';
    btn.className = 'secondary bbPreGameTestBtn';
    btn.textContent = '🔊 TEST VOOR JE BEGINT';
    btn.addEventListener('click', runSpotifyPreGameTestV99);
    startBtn.parentNode.insertBefore(btn, startBtn);
  }

  function setTestStatus(msg, ok){
    const el = q('hostStatus');
    if(el){
      el.textContent = msg || '';
      el.classList.toggle('statusOk', ok === true);
      el.classList.toggle('statusBad', ok === false);
    }
  }

  async function waitForDeviceV99(timeoutMs = 7000){
    const token = await getToken();
    if(!token) throw new Error('Je bent niet ingelogd bij Spotify. Klik eerst op Login met Spotify.');
    if(!window.Spotify) throw new Error('Spotify Web Player is nog niet geladen. Wacht kort en probeer opnieuw.');

    if(!deviceId){
      await activatePlayer();
    } else if(player){
      try{ await player.connect(); }catch(e){}
    }

    const start = Date.now();
    while(!deviceId && Date.now() - start < timeoutMs){
      await sleep(250);
    }
    if(!deviceId){
      throw new Error('Geen actief Spotify-apparaat gevonden. Open Spotify op dit apparaat en probeer opnieuw.');
    }

    // Zet de Bingo Beats speler actief, maar start nog niet.
    try{
      await api('https://api.spotify.com/v1/me/player', {
        method: 'PUT',
        body: JSON.stringify({ device_ids: [deviceId], play: false })
      });
      await sleep(500);
    }catch(e){
      // Niet meteen blokkeren; de echte play-test bepaalt of het werkt.
    }
    return deviceId;
  }

  function getCsvTestTrackV99(){
    if(!Array.isArray(tracks) || !tracks.length) return null;
    // Neem de eerste track met een geldige Spotify URI. Verbruikt geen ronde/used-lijst.
    return tracks.find(t => t && t.uri && /^spotify:track:/.test(t.uri)) || tracks[0];
  }

  async function publishTestStateV99(status, extra={}){
    if(!currentRoomCode) return;
    try{
      await db.ref('rooms/'+currentRoomCode+'/spotifyTest').set({
        status,
        at: firebase.database.ServerValue.TIMESTAMP,
        ...extra
      });
    }catch(e){}
  }

  async function runSpotifyPreGameTestV99(){
    const btn = q('bbPreGameTestBtn');
    try{
      if(!currentRoomCode) throw new Error('Maak eerst een kamer.');
      const testTrack = getCsvTestTrackV99();
      if(!testTrack?.uri) throw new Error('Upload eerst een CSV/muzieklijst met Spotify-tracks.');

      if(btn){ btn.disabled = true; btn.textContent = '🔎 Test loopt...'; }
      setTestStatus('Stap 1/4: Spotify-login controleren...', null);
      const token = await getToken();
      if(!token) throw new Error('Je bent niet ingelogd bij Spotify.');

      setTestStatus('Stap 2/4: Spotify-apparaat zoeken...', null);
      await waitForDeviceV99();

      setTestStatus('Stap 3/4: CSV-track controleren...', null);
      if(!testTrack.name || !testTrack.artists) throw new Error('CSV-track mist titel of artiest.');

      setTestStatus('Stap 4/4: Testliedje wordt 5 seconden afgespeeld...', null);
      await publishTestStateV99('playing', { track: testTrack.name || '', artist: testTrack.artists || '' });

      // Speel testnummer hoorbaar af. Niet muten, want host moet echt horen dat het werkt.
      await api(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({ uris: [testTrack.uri], position_ms: 0 })
      });

      await sleep(5000);
      try{ await api('https://api.spotify.com/v1/me/player/pause', {method:'PUT', body:'{}'}); }catch(e){}

      localStorage.bb_spotify_preflight_ok_at = String(Date.now());
      await publishTestStateV99('done', { track: testTrack.name || '', artist: testTrack.artists || '' });
      setTestStatus('✅ Test geslaagd. Spotify speelt af en het spel kan beginnen.', true);
      if(btn){ btn.disabled = false; btn.textContent = '✅ TEST GESLAAGD'; setTimeout(()=>{ if(btn) btn.textContent='🔊 TEST VOOR JE BEGINT'; }, 2500); }
    }catch(e){
      try{ await publishTestStateV99('error', { message: e.message || 'Test mislukt' }); }catch(_e){}
      setTestStatus('❌ Test mislukt: ' + (e.message || 'Onbekende fout'), false);
      alert('Test mislukt:\n\n' + (e.message || 'Onbekende fout') + '\n\nControleer Spotify en probeer opnieuw.');
      if(btn){ btn.disabled = false; btn.textContent = '🔊 TEST VOOR JE BEGINT'; }
    }
  }

  function ensurePlayerTestOverlayV99(){
    let o = q('bbPlayerTestOverlay');
    if(o) return o;
    o = document.createElement('div');
    o.id = 'bbPlayerTestOverlay';
    o.className = 'bbPlayerTestOverlay hidden';
    o.innerHTML = `<div class="bbPlayerTestCard">
      <img src="bb_logo_gold.png" alt="Bingo Beats" class="bbPlayerTestLogo">
      <div class="bbPlayerTestTitle">Testlied speelt...</div>
      <div class="bbPlayerTestText">De host controleert of Spotify goed afspeelt.</div>
    </div>`;
    document.body.appendChild(o);
    return o;
  }

  function showPlayerTestOverlayV99(test){
    const o = ensurePlayerTestOverlayV99();
    const title = o.querySelector('.bbPlayerTestTitle');
    const text = o.querySelector('.bbPlayerTestText');
    if(test?.status === 'playing'){
      if(title) title.textContent = 'Testlied speelt...';
      if(text) text.textContent = 'Even wachten. De host controleert Spotify.';
      o.classList.remove('hidden');
      o.classList.add('show');
    }else if(test?.status === 'done'){
      if(title) title.textContent = 'Spotify werkt!';
      if(text) text.textContent = 'De host kan het spel starten.';
      o.classList.remove('hidden');
      o.classList.add('show');
      setTimeout(()=>{ o.classList.add('hidden'); o.classList.remove('show'); }, 1600);
    }else if(test?.status === 'error'){
      if(title) title.textContent = 'Spotify-test mislukt';
      if(text) text.textContent = 'Wacht tot de host dit heeft opgelost.';
      o.classList.remove('hidden');
      o.classList.add('show');
      setTimeout(()=>{ o.classList.add('hidden'); o.classList.remove('show'); }, 3000);
    }else{
      o.classList.add('hidden');
      o.classList.remove('show');
    }
  }

  // Voeg button toe zodra de host-app is opgebouwd.
  const oldWireApp = wireApp;
  wireApp = function(){
    oldWireApp.apply(this, arguments);
    setTimeout(ensureTestButton, 50);
  };
  setTimeout(ensureTestButton, 300);

  // Laat spelers de test-pop-up zien wanneer host test draait.
  if(typeof listenPlayer === 'function' && !window.__listenPlayerV99Wrapped){
    window.__listenPlayerV99Wrapped = true;
    const oldListenPlayer = listenPlayer;
    listenPlayer = function(room){
      oldListenPlayer.apply(this, arguments);
      if(room){
        db.ref('rooms/'+room+'/spotifyTest').off('value.bbV99');
        db.ref('rooms/'+room+'/spotifyTest').on('value', s => showPlayerTestOverlayV99(s.val() || null));
      }
    };
  }
})();

/* =========================
   V101 - Real viewport height helper
   Houdt iPhone/Samsung/Safari layout binnen het zichtbare scherm.
   ========================= */
(function(){
  function setVH(){
    try{
      const h = (window.visualViewport && window.visualViewport.height) ? window.visualViewport.height : window.innerHeight;
      document.documentElement.style.setProperty('--bb-real-vh', (h * 0.01) + 'px');
    }catch(e){}
  }
  setVH();
  window.addEventListener('resize', setVH, {passive:true});
  window.addEventListener('orientationchange', ()=>setTimeout(setVH, 250), {passive:true});
  if(window.visualViewport){
    visualViewport.addEventListener('resize', setVH, {passive:true});
    visualViewport.addEventListener('scroll', setVH, {passive:true});
  }
  document.addEventListener('DOMContentLoaded', setVH);
})();

/* =========================
   V102 - Testpopup spelers robuust + Start ronde gebruikt geslaagde test
   - Spelers krijgen altijd test-popup als host TEST VOOR JE BEGINT draait
   - Start ronde test Spotify niet opnieuw; vereist wel een geslaagde pre-game test
   ========================= */
(function(){
  const q = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function E(s){
    return String(s ?? '').replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
  }

  function ensurePlayerTestOverlayV102(){
    let o = q('bbPlayerTestOverlay');
    if(!o){
      o = document.createElement('div');
      o.id = 'bbPlayerTestOverlay';
      o.className = 'bbPlayerTestOverlay hidden';
      document.body.appendChild(o);
    }
    o.innerHTML = `<div class="bbPlayerTestCard v102">
      <img src="bb_logo_gold.png" alt="Bingo Beats" class="bbPlayerTestLogo">
      <div class="bbPlayerTestTitle">HOREN WE IETS?!</div>
      <div class="bbPlayerTestText">Testlied speelt nu. Check even of Spotify geluid geeft 🎵</div>
    </div>`;
    return o;
  }

  function showPlayerTestOverlayV102(test){
    const o = ensurePlayerTestOverlayV102();
    const title = o.querySelector('.bbPlayerTestTitle');
    const text = o.querySelector('.bbPlayerTestText');
    if(test && test.status === 'playing'){
      if(title) title.textContent = 'HOREN WE IETS?!';
      if(text) text.innerHTML = `Testlied speelt nu.<br><strong>Check even of Spotify geluid geeft 🎵</strong>`;
      o.classList.remove('hidden');
      requestAnimationFrame(()=>o.classList.add('show'));
    }else if(test && test.status === 'done'){
      if(title) title.textContent = 'TOP, SPOTIFY WERKT!';
      if(text) text.textContent = 'De host kan het spel starten.';
      o.classList.remove('hidden');
      requestAnimationFrame(()=>o.classList.add('show'));
      setTimeout(()=>{ o.classList.remove('show'); setTimeout(()=>o.classList.add('hidden'),260); }, 1800);
    }else if(test && test.status === 'error'){
      if(title) title.textContent = 'OEPS, GEEN MUZIEK';
      if(text) text.textContent = 'De host lost Spotify even op.';
      o.classList.remove('hidden');
      requestAnimationFrame(()=>o.classList.add('show'));
      setTimeout(()=>{ o.classList.remove('show'); setTimeout(()=>o.classList.add('hidden'),260); }, 3200);
    }else{
      o.classList.remove('show');
      setTimeout(()=>o.classList.add('hidden'),260);
    }
  }

  let bbTestListenRoomV102 = '';
  function getPlayerRoomV102(){
    return (currentRoomCode || new URLSearchParams(location.search).get('room') || localStorage.hb_player_room || '').toUpperCase();
  }

  function attachPlayerTestListenerV102(){
    try{
      if(!db) return;
      const room = getPlayerRoomV102();
      if(!room || room === bbTestListenRoomV102) return;
      if(bbTestListenRoomV102) db.ref('rooms/'+bbTestListenRoomV102+'/spotifyTest').off('value.bbV102');
      bbTestListenRoomV102 = room;
      db.ref('rooms/'+room+'/spotifyTest').on('value.bbV102', s => showPlayerTestOverlayV102(s.val() || null));
    }catch(e){}
  }

  const oldSetupPlayerModeV102 = typeof setupPlayerMode === 'function' ? setupPlayerMode : null;
  if(oldSetupPlayerModeV102 && !window.__setupPlayerModeV102Wrapped){
    window.__setupPlayerModeV102Wrapped = true;
    setupPlayerMode = function(){
      const ret = oldSetupPlayerModeV102.apply(this, arguments);
      setTimeout(attachPlayerTestListenerV102, 80);
      setTimeout(attachPlayerTestListenerV102, 700);
      return ret;
    };
  }

  const oldListenPlayerV102 = typeof listenPlayer === 'function' ? listenPlayer : null;
  if(oldListenPlayerV102 && !window.__listenPlayerV102Wrapped){
    window.__listenPlayerV102Wrapped = true;
    listenPlayer = function(){
      const ret = oldListenPlayerV102.apply(this, arguments);
      setTimeout(attachPlayerTestListenerV102, 80);
      return ret;
    };
  }

  setInterval(()=>{
    if(document.body.classList.contains('playerMode')) attachPlayerTestListenerV102();
  }, 1000);

  function lastTestOkV102(){
    const t = Number(localStorage.bb_spotify_preflight_ok_at || 0);
    // Test blijft 60 minuten geldig, of totdat de host opnieuw laadt/test wil doen.
    return t && (Date.now() - t < 60 * 60 * 1000);
  }

  // Start ronde: NIET opnieuw Spotify testen. Wel blokkeren als de host nog nooit succesvol getest heeft.
  startRound = async function(){
    if(!currentRoomCode) return alert('Maak eerst een kamer.');
    try{
      if(!lastTestOkV102()){
        alert('Doe eerst de knop TEST VOOR JE BEGINT.\n\nDaarmee controleren we één keer of Spotify en je CSV echt kunnen afspelen. Daarna start de ronde zonder extra Spotify-test.');
        if(q('hostStatus')) q('hostStatus').textContent = 'Doe eerst TEST VOOR JE BEGINT.';
        return;
      }
      const snap = await db.ref('rooms/'+currentRoomCode).once('value');
      const room = snap.val() || {};
      if(!allReady(room)) return alert('Nog niet iedereen is READY.');
      currentTrack = chooseTrack();
      if(!currentTrack) return alert('Upload eerst je muzieklijst.');
      const up = {};
      Object.keys(room.players || {}).forEach(pid => up[`rooms/${currentRoomCode}/players/${pid}/ready`] = false);
      await db.ref().update(up);
      if(q('hostStatus')) q('hostStatus').textContent = 'Ronde start. Spotify is al getest.';
      return startRoundVisual(currentRoomCode);
    }catch(e){
      if(q('startRoundBtn')){ q('startRoundBtn').disabled = false; q('startRoundBtn').textContent = '🎲 START RONDE'; }
      alert('Start ronde mislukt: ' + (e.message || e));
    }
  };
})();

/* =========================
   V108 - Vanuit V102: READY-lobby na iedere ronde + geen dubbel BB-logo
   - Goed antwoord: vakje kiezen zonder extra groot BB-logo boven de kaart
   - Na fout antwoord direct terug naar lobby met READY-knop
   - Na goed antwoord en vakje kiezen direct terug naar lobby met READY-knop
   - Zodra iedereen READY is na een beoordeelde ronde start de host automatisch de volgende ronde
   ========================= */
(function(){
  const q = id => document.getElementById(id);
  const E = s => String(s ?? '').replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
  const HEX2 = {yellow:'#FFCC33', pink:'#00D4C7', purple:'#FF8A1F', blue:'#7ED957', green:'#FF5A5F', free:'#FFCC33'};
  const COLOR_LABEL = {yellow:'GOUD', pink:'AQUA', purple:'ORANJE', blue:'LIME', green:'KORAAL', free:'FREE'};
  let lastAutoStartRoundV108 = '';

  function players(room){ return Object.entries(room?.players || {}); }
  function initial(n){ return String(n || 'S').trim().slice(0,1).toUpperCase() || 'S'; }
  function me(room){ return room?.players?.[currentPlayerId] || {}; }
  function isBingoRound(room, r){
    const bs = Object.values(room?.bingos || {});
    return !!(r?.id && bs.some(b => b?.roundId === r.id));
  }
  function questionText(r){
    try{ if(typeof questionFor === 'function') return questionFor(r?.category); }catch(e){}
    try{ if(typeof categoryQuestion === 'function') return categoryQuestion(r?.category); }catch(e){}
    return 'Hoe heet deze track?';
  }
  function secondsLeft(r){
    if(!r?.deadlineMs) return null;
    return Math.max(0, Math.ceil((Number(r.deadlineMs) - Date.now()) / 1000));
  }
  function timerPct(r){
    const left = secondsLeft(r);
    if(left === null) return 100;
    const total = Number(r.seconds || q('duration')?.value || 20) || 20;
    return Math.max(0, Math.min(100, (left / total) * 100));
  }
  function setReadyV108(){
    if(!currentRoomCode || !currentPlayerId) return;
    db.ref('rooms/'+currentRoomCode+'/players/'+currentPlayerId+'/ready').set(true);
  }
  window.bbSetReadyV108 = setReadyV108;

  function readyList(room){
    const ps = players(room);
    return `<div class="bbStageReadyList v108">${ps.map(([pid,p])=>`
      <button type="button" class="bbReadyRow ${p.ready?'ready':'wait'}" data-view-card="${E(pid)}">
        <div class="bbAvatar">${E(initial(p.name))}</div>
        <div class="bbReadyName">${E(p.name || 'Speler')}${pid===currentPlayerId?' <span>jij</span>':''}</div>
        <div class="bbReadyState">${p.ready?'READY':'Wacht'}</div>
      </button>`).join('') || '<div class="small">Nog geen spelers.</div>'}</div>`;
  }
  function readyButton(room){
    const p = me(room);
    return p.ready
      ? `<button class="bbReadyBig isReady" type="button" disabled>READY ✓</button>`
      : `<button class="bbReadyBig" type="button" onclick="bbSetReadyV108()">READY</button>`;
  }
  function card(room, r, opts={}){
    const p = me(room), c = p.card || [], marked = p.marked || {};
    const large = !!opts.large, pick = !!opts.pick;
    let cells = Array.from({length:25},(_,i)=>{
      const raw = c[i] || (i===12 ? 'free' : 'yellow');
      const key = (i===12 || raw === 'free') ? 'free' : raw;
      const isFree = key === 'free';
      const isMarked = !!marked[i] || isFree;
      const canPick = pick && r?.id && key === r.colorKey && !isMarked && !isFree;
      const content = isFree ? 'BB' : (isMarked ? 'BB' : '');
      return `<button type="button" class="bbStageCell v108cell cell-${E(key)} ${isFree?'free':''} ${isMarked?'marked':''} ${canPick?'pickable':''}" data-i="${i}" style="--cell:${HEX2[key] || '#777'};background:${HEX2[key] || '#777'}" ${canPick?'':'tabindex="-1"'}>${content ? `<span class="bbMiniMark">${content}</span>` : ''}</button>`;
    }).join('');
    return `<div class="bbStageBingo v108 ${large?'large':''}">${cells}</div>`;
  }
  function attachPick(root){
    root.querySelectorAll('.bbStageCell.pickable').forEach(btn=>{
      btn.addEventListener('click',()=> pickCell(Number(btn.dataset.i)) );
    });
    root.querySelectorAll('[data-view-card]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const pid = btn.getAttribute('data-view-card');
        if(pid) showOtherCard(roomCacheV108, pid);
      });
    });
  }
  let roomCacheV108 = null;
  function otherCardHTML(room, pid){
    const p = room?.players?.[pid] || {}, c = p.card || [], marked = p.marked || {};
    const cells = Array.from({length:25},(_,i)=>{
      const raw = c[i] || (i===12 ? 'free' : 'yellow');
      const key = (i===12 || raw === 'free') ? 'free' : raw;
      const isFree = key === 'free';
      const isMarked = !!marked[i] || isFree;
      const content = isFree ? 'BB' : (isMarked ? 'BB' : '');
      return `<div class="bbStageCell v108cell cell-${E(key)} ${isFree?'free':''} ${isMarked?'marked':''}" style="--cell:${HEX2[key] || '#777'};background:${HEX2[key] || '#777'}">${content ? `<span class="bbMiniMark">${content}</span>` : ''}</div>`;
    }).join('');
    return `<div class="bbStageBingo v108 other">${cells}</div>`;
  }
  function showOtherCard(room, pid){
    const p = room?.players?.[pid];
    if(!p) return;
    let o = q('bbOtherCardOverlay');
    if(!o){
      o = document.createElement('div');
      o.id = 'bbOtherCardOverlay';
      o.className = 'bbOtherCardOverlay hidden';
      document.body.appendChild(o);
    }
    o.innerHTML = `<div class="bbOtherCardBox">
      <button type="button" class="bbOtherClose" onclick="document.getElementById('bbOtherCardOverlay').classList.add('hidden')">×</button>
      <h2>${E(p.name || 'Speler')}</h2>
      ${otherCardHTML(room, pid)}
      <p class="bbStageSub bottom">Bingokaart bekijken</p>
    </div>`;
    o.classList.remove('hidden');
  }
  function scoreHTML(room,r,{reveal=false,results=false}={}){
    const ps = players(room), ans = r?.id ? (room.answers?.[r.id] || {}) : {}, cor = r?.id ? (room.correct?.[r.id] || {}) : {};
    const ownSubmitted = !!ans[currentPlayerId];
    return `<div class="bbStageScoreList">${ps.map(([pid,p])=>{
      const has = ans[pid] && typeof ans[pid].answer !== 'undefined';
      const text = has ? (String(ans[pid].answer).trim() || 'Leeg antwoord') : 'Nog niet ingevuld';
      const st = results ? cor[pid] : undefined;
      const cls = st===true?'good':st===false?'bad':has?'sent':'wait';
      const icon = results ? (st===true?'✓':'×') : (has?'✓':'…');
      const showText = has && (reveal || pid === currentPlayerId || ownSubmitted);
      return `<div class="bbStageScoreRow ${cls}">
        <div class="bbAvatar">${E(initial(p.name))}</div>
        <div class="bbScoreWho"><strong>${E(p.name||'Speler')}${pid===currentPlayerId?' <span>jij</span>':''}</strong><small>${has?'Ingezonden':'Wacht op antwoord'}</small></div>
        <div class="bbScoreAnswer">${showText ? E(text) : (has?'Ingezonden':'—')}</div>
        <div class="bbScoreIcon">${icon}</div>
      </div>`;
    }).join('')}</div>`;
  }
  function correctBlock(r){
    const a = r?.correctAnswer || {};
    if(!a.track && !a.artist) return '';
    return `<div class="bbCorrectTop"><div class="bbCorrectLabel">Juiste antwoord</div><div class="bbCorrectTrack">${E(a.track||'-')}</div><div class="bbCorrectMeta">${E(a.artist||'-')}${a.year?' — '+E(a.year):''}</div></div>`;
  }
  function stage(root, cls, html, room){
    root.className = 'compactDashboard bbStageDashboard '+cls;
    root.innerHTML = `<section class="bbStageShell">${html}</section>`;
    roomCacheV108 = room;
    attachPick(root);
  }
  function renderLobby(root, room, msg='Wachten op de host', sub='Iedereen klaar? Dan kan de ronde starten.'){
    stage(root,'stageLobby',`
      <img src="bb_logo.png" class="bbStageLogo" alt="Bingo Beats">
      <h2>${E(msg)}</h2>
      <p class="bbStageSub">${E(sub)}</p>
      ${readyList(room)}
      <div class="bbCardWrap"><h3>Jouw bingokaart</h3>${card(room,null,{large:false})}</div>
      ${readyButton(room)}
    `, room);
  }
  function renderJudgedV108(root, room, r){
    const good = room.correct?.[r.id]?.[currentPlayerId] === true;
    const p = me(room);
    const picked = p.lastPickedRound === r.id;
    if(good && !picked){
      stage(root,'stagePickCard',`
        <h2>GOED ANTWOORD!</h2>
        <p class="bbStageSub">Kies één <strong>${E(r.colorName || COLOR_LABEL[r.colorKey] || 'kleur')}</strong> vakje</p>
        ${card(room,r,{large:true,pick:true})}
        <p class="bbStageSub bottom">Tik op een opgelicht vakje</p>
      `, room);
      return;
    }
    if(good && picked){
      return renderLobby(root, room, 'Vakje gekozen', 'Klik op READY voor de volgende ronde.');
    }
    return renderLobby(root, room, 'HELAAS!', 'Klik op READY voor de volgende ronde.');
  }
  function renderAnswering(root,room,r){
    const own = r?.id ? (room.answers?.[r.id]?.[currentPlayerId]) : null;
    const left = secondsLeft(r);
    if(own){
      stage(root,'stageScore',`
        <img src="bb_logo.png" class="bbStageLogo mini" alt="Bingo Beats">
        <div class="bbOwnSubmitted"><span>Jouw antwoord</span><strong>${E(String(own.answer||'').trim()||'Leeg antwoord')}</strong></div>
        <h2>Live antwoorden</h2>
        <p class="bbStageSub">Antwoorden verschijnen zodra spelers insturen. Nog niemand ziet wat goed is.</p>
        ${scoreHTML(room,r,{reveal:false,results:false})}
        <div class="bbBottomTimer">⏱ ${left ?? '--'} sec</div>
      `, room);
      return;
    }
    stage(root,'stageAnswer',`
      <img src="bb_logo.png" class="bbStageLogo mini" alt="Bingo Beats">
      <div class="bbRoundBadge" style="--chosen:${HEX2[r.colorKey]||'#FFCC33'}"><span></span>${E(r.colorName||'')} · ${E(r.category||'')}</div>
      <div class="bbCountdownBig" style="--pct:${timerPct(r)}"><span>${left ?? ''}</span></div>
      <h2 class="bbCategoryTitle">🎯 ${E(r.category||'Categorie')}</h2>
      <input id="bbStageAnswerInput" class="bbStageInput" value="" placeholder="Typ je antwoord..." autocomplete="off">
      <button id="bbStageSubmitBtn" class="bbStageSubmit">VERSTUREN</button>
    `, room);
    const inp = q('bbStageAnswerInput');
    inp?.addEventListener('keydown', e=>{ if(e.key==='Enter') q('bbStageSubmitBtn')?.click(); });
    q('bbStageSubmitBtn')?.addEventListener('click',()=>{
      const v = (q('bbStageAnswerInput')?.value || '').trim();
      if(!v) return alert('Vul eerst je antwoord in.');
      submitAnswerValue(v);
    });
    setTimeout(()=>inp?.focus(),50);
  }

  const oldRenderV108 = typeof renderCompactDashboard === 'function' ? renderCompactDashboard : null;
  renderCompactDashboard = function(room,r){
    const root = q('screenDashboard');
    if(!root) return;
    document.body.classList.add('bbStageMode');
    if(!r?.id) return renderLobby(root, room);
    if(r.status === 'judged') return renderJudgedV108(root, room, r);
    if(r.status === 'answering') return renderAnswering(root, room, r);
    if(r.status === 'locked'){
      return stage(root,'stageReveal',`
        <img src="bb_logo.png" class="bbStageLogo mini" alt="Bingo Beats">
        ${correctBlock(r) || '<h2>Tijd voorbij</h2><p class="bbStageSub">Wachten op de host...</p>'}
        <h2>Alle antwoorden</h2>
        ${scoreHTML(room,r,{reveal:true,results:false})}
        <p class="bbStageSub">De host controleert nu wie goed zat.</p>
      `, room);
    }
    return oldRenderV108 ? oldRenderV108(room,r) : renderLobby(root, room);
  };

  // Publiceer resultaten: niemand wordt automatisch READY. Iedere speler moet zelf in de lobby READY klikken.
  publishResults = function(){
    if(!currentRoomCode) return;
    db.ref('rooms/'+currentRoomCode).once('value').then(s=>{
      const room = s.val() || {}, r = room.currentRound || {}, up = {};
      up[`rooms/${currentRoomCode}/currentRound/status`] = 'judged';
      Object.keys(room.players || {}).forEach(pid=>{
        up[`rooms/${currentRoomCode}/players/${pid}/ready`] = false;
      });
      return db.ref().update(up);
    }).then(()=>{ if(q('hostStatus')) q('hostStatus').textContent = 'Resultaten verzonden. Wachten op READY.'; });
  };

  // Vakje kiezen: na keuze terug naar lobby, maar nog NIET ready.
  pickCell = function(i){
    db.ref('rooms/'+currentRoomCode+'/players/'+currentPlayerId).once('value').then(s=>{
      const p = s.val() || {}, marked = p.marked || {}, c = p.card || [];
      if(!activeRound?.id) return;
      if(c[i] !== activeRound.colorKey || marked[i]) return;
      marked[i] = true;
      const bingo = checkBingo(marked);
      return db.ref('rooms/'+currentRoomCode+'/players/'+currentPlayerId).update({
        marked,
        bingo,
        lastPickedRound: activeRound.id,
        ready: false
      }).then(()=>{
        if(bingo) return db.ref('rooms/'+currentRoomCode+'/bingos').push({name:currentPlayerName,roundId:activeRound.id,at:firebase.database.ServerValue.TIMESTAMP});
      });
    });
  };

  // Host: na een beoordeelde ronde automatisch door zodra iedereen READY is.
  function maybeAutoStart(room){
    try{
      const r = room.currentRound || {};
      if(r.status !== 'judged') return;
      if(isBingoRound(room,r)) return;
      if(!allReady(room)) return;
      const key = (currentRoomCode || '') + ':' + r.id;
      if(lastAutoStartRoundV108 === key) return;
      lastAutoStartRoundV108 = key;
      if(q('hostStatus')) q('hostStatus').textContent = 'Iedereen is READY. Volgende ronde start automatisch...';
      setTimeout(()=>{
        db.ref('rooms/'+currentRoomCode).once('value').then(s=>{
          const latest = s.val() || {}, lr = latest.currentRound || {};
          if(lr.id === r.id && lr.status === 'judged' && allReady(latest) && !isBingoRound(latest,lr)) startRound();
        });
      }, 1200);
    }catch(e){}
  }

  if(typeof hostReadyState === 'function' && !window.__hostReadyStateV108Wrapped){
    window.__hostReadyStateV108Wrapped = true;
    const oldHostReadyState = hostReadyState;
    hostReadyState = function(room){
      const r = room?.currentRound || {};
      if(r.status === 'judged'){
        const b = q('startRoundBtn');
        if(b){
          b.disabled = true;
          b.textContent = allReady(room) ? '🚀 Volgende ronde start...' : '⏳ Wachten op READY';
        }
        const notReady = players(room).filter(([pid,p])=>!p.ready).map(([pid,p])=>p.name || 'Speler');
        if(q('hostStatus')) q('hostStatus').textContent = notReady.length ? 'Nog niet ready: '+notReady.join(', ') : 'Iedereen is READY. Volgende ronde start automatisch...';
        maybeAutoStart(room);
        return;
      }
      return oldHostReadyState.apply(this, arguments);
    };
  }
})();

/* =========================
   V114 - Jury van Bingo Beats + schone nieuwe kamer
   - Nieuwe kamer/nieuw spel wist oude host-uitslagen uit beeld
   - Jury is coulant maar niet te soepel
   - Typfouten/fonetisch/getallen worden goedgekeurd
   - Ontbrekend belangrijk titelwoord wordt jury-stemming
   - Foute spelers gaan na beoordeling naar lobby + READY
   ========================= */
(function(){
  const q = id => document.getElementById(id);
  const E = s => (typeof esc === 'function' ? esc(String(s ?? '')) : String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])));

  function clearHostRoundUIV114(){
    try{ clearTimeout(lockTimer); clearTimeout(stopTimer); clearInterval(dashTimer); }catch(_e){}
    try{ currentTrack = null; currentRoundId = ''; activeRound = null; }catch(_e){}
    ['hostAnswerArea','hostPickerArea','hostScoreboard','hostRoundInfo'].forEach(id=>{ const el=q(id); if(el) el.innerHTML=''; });
    q('hostScorePanel')?.classList.add('hidden');
    q('hostBingoPanel')?.classList.add('hidden');
    if(q('playBtn')){ q('playBtn').disabled=true; q('playBtn').textContent='🎵 Speel verborgen nummer'; }
    if(q('stopBtn')) q('stopBtn').disabled=true;
    if(q('showAnswerBtn')) q('showAnswerBtn').disabled=true;
    if(q('hostStatus')) q('hostStatus').textContent='Schone kamer. Wachten op spelers.';
  }
  const oldCreateRoomV114 = typeof createRoom === 'function' ? createRoom : null;
  if(oldCreateRoomV114 && !window.__bbCreateRoomV114){
    window.__bbCreateRoomV114 = true;
    createRoom = function(){ clearHostRoundUIV114(); return oldCreateRoomV114.apply(this, arguments); };
  }
  const oldNewGameV114 = typeof bbStartNewGameSameRoom === 'function' ? bbStartNewGameSameRoom : null;
  if(oldNewGameV114 && !window.__bbNewGameV114){
    window.__bbNewGameV114 = true;
    bbStartNewGameSameRoom = function(){ clearHostRoundUIV114(); return oldNewGameV114.apply(this, arguments); };
  }

  const filler = new Set(['the','a','an','de','het','een','van','in','on','at','to','for','of','and','&','with','feat','ft']);
  const variantWords = ['radio edit','radio mix','single edit','edit','remix','live','extended mix','extended','club mix','acoustic','instrumental','remastered','remaster','version','mix'];
  const numMap = {zero:'0',one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9',ten:'10',won:'1',to:'2',too:'2',for:'4'};

  function stripVariants(s){
    s = String(s||'');
    s = s.replace(/\([^)]*\)/g, m => variantWords.some(v=>m.toLowerCase().includes(v)) ? ' ' : m);
    s = s.replace(/\[[^\]]*\]/g, m => variantWords.some(v=>m.toLowerCase().includes(v)) ? ' ' : m);
    s = s.replace(/\s[-–—]\s.*\b(radio|edit|remix|mix|live|extended|acoustic|instrumental|remaster|version|feat|ft|with)\b.*$/i, '');
    s = s.replace(/\b(feat\.?|ft\.?|with)\b.*$/i, '');
    for(const v of variantWords){
      const re = new RegExp('\\b'+v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','ig');
      s = s.replace(re,' ');
    }
    return s;
  }
  function baseNorm(s){
    s = stripVariants(s).toLowerCase();
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    s = s.replace(/['’`]/g,'');
    s = s.replace(/&/g,' and ');
    s = s.replace(/\+/g,' and ');
    s = s.replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
    return s.split(' ').map(w=>numMap[w]||w).join(' ');
  }
  function tokens(s){ return baseNorm(s).split(' ').filter(Boolean); }
  function coreTokens(s){ return tokens(s).filter(t=>!filler.has(t)); }
  function lev(a,b){
    a=String(a||''); b=String(b||'');
    if(a===b) return 0; if(!a.length) return b.length; if(!b.length) return a.length;
    const dp = Array(b.length+1).fill(0).map((_,i)=>i);
    for(let i=1;i<=a.length;i++){
      let prev=dp[0]; dp[0]=i;
      for(let j=1;j<=b.length;j++){
        const tmp=dp[j];
        dp[j]=Math.min(dp[j]+1, dp[j-1]+1, prev+(a[i-1]===b[j-1]?0:1));
        prev=tmp;
      }
    }
    return dp[b.length];
  }
  function similarity(a,b){
    a=baseNorm(a); b=baseNorm(b);
    if(!a && !b) return 1; if(!a || !b) return 0;
    const d=lev(a,b), m=Math.max(a.length,b.length)||1;
    return 1-(d/m);
  }
  function wordClose(a,b){
    a=baseNorm(a); b=baseNorm(b);
    if(a===b) return true;
    if(!a || !b) return false;
    const d = lev(a,b), m=Math.max(a.length,b.length);
    if(m<=4) return d<=1;
    if(m<=7) return d<=2;
    return d<=3 || (1-d/m)>=0.72;
  }
  function multisetCover(correct, given){
    const used = new Array(given.length).fill(false);
    let hit=0;
    for(const cw of correct){
      let best=-1, bestScore=-999;
      for(let i=0;i<given.length;i++){
        if(used[i]) continue;
        const gw=given[i];
        let score = cw===gw ? 100 : (wordClose(cw,gw) ? 80 - lev(cw,gw) : -100);
        if(score>bestScore){ bestScore=score; best=i; }
      }
      if(best>=0 && bestScore>0){ used[best]=true; hit++; }
    }
    return {hit,total:correct.length,missing:Math.max(0,correct.length-hit)};
  }
  function categoryKind(cat){
    const c=String(cat||'').toLowerCase();
    if(c.includes('artiest') || c.includes('artist')) return 'artist';
    if(c.includes('jaar') || c.includes('jaartal') || c.includes('+/-') || c.includes('±')) return 'year';
    if(c.includes('decennium') || c.includes('decade')) return 'decade';
    return 'title';
  }
  function correctForKind(kind, ans){
    ans = ans || {};
    if(kind==='artist') return ans.artist || '';
    if(kind==='year') return ans.year || '';
    if(kind==='decade') return ans.year || '';
    return ans.track || '';
  }
  function parseYearInput(v){
    const s=String(v||'').trim().toLowerCase().replace(/[’']/g,'');
    let m=s.match(/\b(19\d{2}|20\d{2})\b/); if(m) return Number(m[1]);
    m=s.match(/\b(\d{2})\b/); if(m){ const n=Number(m[1]); return n<=35 ? 2000+n : 1900+n; }
    return null;
  }
  function decadeFromYear(y){ y=Number(y); if(!y) return null; return Math.floor(y/10)*10; }
  function parseDecade(v){
    const s=String(v||'').toLowerCase();
    if(/nineties/.test(s)) return 1990;
    if(/eighties/.test(s)) return 1980;
    if(/seventies/.test(s)) return 1970;
    if(/sixties/.test(s)) return 1960;
    if(/\b00s\b|jaren\s*00|\b00\b/.test(s)) return 2000;
    if(/\b10s\b|jaren\s*10|\b10\b/.test(s)) return 2010;
    if(/\b20s\b|jaren\s*20|\b20\b/.test(s)) return 2020;
    const y = parseYearInput(s); if(y) return decadeFromYear(y);
    const m=s.match(/\b(60|70|80|90)\s*(s|'s)?\b/); if(m) return 1900+Number(m[1]);
    return null;
  }
  function judgeText(correct, given, kind){
    const cRaw=String(correct||''), gRaw=String(given||'');
    if(!gRaw.trim()) return {good:false, review:false, reason:'Geen antwoord'};
    if(kind==='year'){
      const cy=parseYearInput(cRaw), gy=parseYearInput(gRaw);
      if(!cy || !gy) return {good:false, review:false, reason:'Geen geldig jaar'};
      return {good:Math.abs(cy-gy)<=2, review:false, reason:Math.abs(cy-gy)<=2?'Binnen marge':'Buiten marge'};
    }
    if(kind==='decade'){
      const cy=parseYearInput(cRaw), cd=decadeFromYear(cy), gd=parseDecade(gRaw);
      return {good:!!cd && cd===gd, review:false, reason:!!cd && cd===gd?'Zelfde decennium':'Ander decennium'};
    }
    const c=baseNorm(cRaw), g=baseNorm(gRaw);
    if(c && g && c===g) return {good:true, review:false, reason:'Exact genoeg'};

    const cTokAll=tokens(cRaw), gTokAll=tokens(gRaw);
    const ct=coreTokens(cRaw), gt=coreTokens(gRaw);

    // Gezellige jury: duidelijke tik-/fonetische fouten zijn goed.
    if(similarity(c,g)>=0.80) return {good:true, review:false, reason:'Duidelijke typefout'};

    if(ct.length===0) return {good:false, review:false, reason:'Geen juist antwoord beschikbaar'};
    const cov=multisetCover(ct,gt);
    const ratio=cov.hit/ct.length;

    // Voorbeeld: In The Summertime -> Summertime. Het kernwoord klopt, maar de titel is te kaal: jury twijfelt.
    if(kind==='title' && ct.length===1 && gt.length===1 && cov.missing===0 && cTokAll.length>=3 && gTokAll.length<=1){
      return {good:false, review:true, reason:'Antwoord lijkt onvolledig'};
    }

    if(cov.missing===0) return {good:true, review:false, reason:'Alle belangrijke woorden herkend'};
    if(ct.length>=3 && cov.missing===1 && ratio>=0.66) return {good:false, review:true, reason:'Belangrijk woord ontbreekt'};
    if(ct.length===2 && cov.hit===1 && gt.length===1) return {good:false, review:true, reason:'Antwoord lijkt onvolledig'};
    if(kind==='artist'){
      // Soepel voor fonetische/typefouten, streng voor bandleden of andere artiesten.
      if(similarity(c,g)>=0.70 && gt.length>=1) return {good:true, review:false, reason:'Artiest duidelijk bedoeld'};
    }
    return {good:false, review:false, reason:'Onvoldoende herkenbaar'};
  }
  function judgeOneV114(r, answer){
    const kind=categoryKind(r?.category);
    const correct=correctForKind(kind, r?.correctAnswer||{});
    return {...judgeText(correct, answer, kind), kind, correct};
  }
  window.bbJudgeOneV114 = judgeOneV114;

  async function runAIJuryV114(roomCode, forceStatus){
    const snap=await db.ref('rooms/'+roomCode).once('value');
    const room=snap.val()||{}, r=room.currentRound||{};
    if(!r.id || !r.correctAnswer) return;
    const ans=room.answers?.[r.id]||{}, players=room.players||{}, up={}, reviews=[];
    Object.keys(players).forEach(pid=>{
      const text=ans[pid]?.answer || '';
      const j=judgeOneV114(r,text);
      up[`rooms/${roomCode}/correct/${r.id}/${pid}`] = j.review ? 'review' : !!j.good;
      up[`rooms/${roomCode}/juryMeta/${r.id}/${pid}`] = {kind:j.kind, reason:j.reason, correct:j.correct, answer:text, review:!!j.review};
      if(j.review) reviews.push(pid);
      up[`rooms/${roomCode}/players/${pid}/ready`] = false;
    });
    up[`rooms/${roomCode}/currentRound/juryDone`] = true;
    up[`rooms/${roomCode}/currentRound/reviewList`] = reviews;
    up[`rooms/${roomCode}/currentRound/reviewIndex`] = 0;
    if(forceStatus) up[`rooms/${roomCode}/currentRound/status`] = reviews.length ? 'review' : forceStatus;
    await db.ref().update(up);
    return {reviews, room, r};
  }
  window.bbRunAIJuryV114 = runAIJuryV114;

  // Timer afgelopen: kort antwoordmoment, AI beoordeelt, daarna scoreboard/jury.
  lockRound = function(){
    if(!currentRoomCode) return;
    publishAnswer()
      .then(()=>runAIJuryV114(currentRoomCode, null))
      .then(res=>{
        const hasReviews = res?.reviews?.length;
        return db.ref('rooms/'+currentRoomCode+'/currentRound').update({status:'locked'}).then(()=>{
          setTimeout(()=>db.ref('rooms/'+currentRoomCode+'/currentRound').update({status: hasReviews ? 'review' : 'judged'}), 2200);
        });
      })
      .then(()=>{ if(q('hostStatus')) q('hostStatus').textContent='Jury van Bingo Beats heeft de antwoorden beoordeeld.'; })
      .catch(e=>alert('Jury/timer fout: '+(e.message||e)));
  };
  publishResults = function(){
    if(!currentRoomCode) return;
    runAIJuryV114(currentRoomCode, 'judged').then(()=>{ if(q('hostStatus')) q('hostStatus').textContent='Jury-scorebord verzonden.'; });
  };

  // Host correctie: als goed -> speler kan alsnog kiezen. Als fout -> gekozen vakje terugdraaien als bekend.
  scoreboardClick = function(e){
    const btn=e.target.closest('button[data-pid]'); if(!btn) return;
    e.preventDefault();
    const pid=btn.dataset.pid, good=btn.dataset.good==='true';
    db.ref('rooms/'+currentRoomCode).once('value').then(s=>{
      const room=s.val()||{}, r=room.currentRound||{}, p=room.players?.[pid]||{}, up={};
      if(!r.id) throw Error('Geen actieve ronde.');
      up[`rooms/${currentRoomCode}/correct/${r.id}/${pid}`]=good;
      up[`rooms/${currentRoomCode}/players/${pid}/ready`]=false;
      if(good){
        up[`rooms/${currentRoomCode}/players/${pid}/lastPickedRound`]=null;
      }else{
        const idx = p.lastPickedIndex;
        if(p.lastPickedRound===r.id && idx!==undefined && idx!==null){
          up[`rooms/${currentRoomCode}/players/${pid}/marked/${idx}`]=null;
        }
        if(p.lastPickedRound===r.id){
          up[`rooms/${currentRoomCode}/players/${pid}/lastPickedRound`]=null;
          up[`rooms/${currentRoomCode}/players/${pid}/lastPickedIndex`]=null;
        }
      }
      return db.ref().update(up);
    }).then(()=>{ if(q('hostStatus')) q('hostStatus').textContent='Beoordeling aangepast.'; }).catch(e=>alert(e.message));
  };

  // Bestaande pickCell uitbreiden met lastPickedIndex voor correctie terugdraaien.
  pickCell = function(i){
    db.ref('rooms/'+currentRoomCode+'/players/'+currentPlayerId).once('value').then(s=>{
      const p=s.val()||{}, marked=p.marked||{}, c=p.card||[];
      const r=activeRound || {};
      if(!r?.id) return;
      if(c[i]!==r.colorKey || marked[i]) return;
      marked[i]=true;
      const bingo = (typeof checkBingo==='function') ? checkBingo(marked) : false;
      return db.ref('rooms/'+currentRoomCode+'/players/'+currentPlayerId).update({marked,bingo,lastPickedRound:r.id,lastPickedIndex:i,ready:false}).then(()=>{
        if(bingo) return db.ref('rooms/'+currentRoomCode+'/bingos').push({name:currentPlayerName,roundId:r.id,at:firebase.database.ServerValue.TIMESTAMP});
      });
    });
  };

  function currentReviewPid(r){ const list=Array.isArray(r?.reviewList)?r.reviewList:[]; return list[Number(r?.reviewIndex)||0] || ''; }
  function submitJuryVoteV114(pid, vote){
    if(!currentRoomCode || !activeRound?.id || !currentPlayerId) return;
    db.ref(`rooms/${currentRoomCode}/juryVotes/${activeRound.id}/${pid}/${currentPlayerId}`).set(vote===true).then(()=>maybeFinalizeReviewV114(pid));
  }
  window.bbSubmitJuryVoteV114 = submitJuryVoteV114;
  async function maybeFinalizeReviewV114(pid){
    const snap=await db.ref('rooms/'+currentRoomCode).once('value');
    const room=snap.val()||{}, r=room.currentRound||{};
    if(r.status!=='review' || currentReviewPid(r)!==pid) return;
    const voters=Object.keys(room.players||{}).filter(x=>x!==pid);
    const votes=room.juryVotes?.[r.id]?.[pid]||{};
    const all = voters.length===0 || voters.every(v=>typeof votes[v] !== 'undefined');
    if(!all) return;
    let yes=0,no=0; voters.forEach(v=>votes[v]===true?yes++:no++);
    const approved = yes>=no;
    const list=Array.isArray(r.reviewList)?r.reviewList:[], next=(Number(r.reviewIndex)||0)+1, up={};
    up[`rooms/${currentRoomCode}/correct/${r.id}/${pid}`]=approved;
    up[`rooms/${currentRoomCode}/juryResults/${r.id}/${pid}`]={approved, yes, no};
    if(next<list.length){ up[`rooms/${currentRoomCode}/currentRound/reviewIndex`]=next; }
    else { up[`rooms/${currentRoomCode}/currentRound/status`]='judged'; }
    await db.ref().update(up);
  }
  function renderReviewV114(root, room, r){
    const pid=currentReviewPid(r), p=room.players?.[pid]||{}, meta=room.juryMeta?.[r.id]?.[pid]||{}, votes=room.juryVotes?.[r.id]?.[pid]||{};
    const isOwner=pid===currentPlayerId, hasVoted=typeof votes[currentPlayerId] !== 'undefined';
    const voters=Object.keys(room.players||{}).filter(x=>x!==pid);
    const received=voters.filter(v=>typeof votes[v]!=='undefined').length;
    const buttons = isOwner ? '<p class="bbStageSub">Jij mag niet stemmen op je eigen antwoord.</p>' : hasVoted ? '<button class="bbReadyBig isReady" disabled>Stem ontvangen ✓</button>' : `<div class="bbJuryButtons"><button type="button" onclick="bbSubmitJuryVoteV114('${E(pid)}',true)">GOEDKEUREN</button><button type="button" class="secondary" onclick="bbSubmitJuryVoteV114('${E(pid)}',false)">AFKEUREN</button></div>`;
    const html=`<section class="bbStageShell bbJuryShell">
      <img src="bb_logo.png" class="bbStageLogo mini" alt="Bingo Beats">
      <h2>Jury van Bingo Beats twijfelt</h2>
      <p class="bbStageSub">De Jury van Bingo Beats twijfelt over het antwoord van <strong>${E(p.name||'Speler')}</strong>.</p>
      <div class="bbJuryCompare"><div><span>Juiste antwoord</span><strong>${E(meta.correct||'-')}</strong></div><div><span>Ingevuld</span><strong>${E(meta.answer||'Leeg antwoord')}</strong></div></div>
      <p class="bbStageSub">${E(meta.reason||'Help de jury met een beslissing!')}</p>
      ${buttons}
      <p class="bbStageSub bottom">${received} / ${voters.length} stemmen ontvangen</p>
    </section>`;
    root.className='compactDashboard bbStageDashboard stageJury';
    root.innerHTML=html;
  }

  // Eind-renderer: review-status toevoegen + review in scorebord tonen.
  const previousRenderV114 = typeof renderCompactDashboard === 'function' ? renderCompactDashboard : null;
  renderCompactDashboard = function(room,r){
    const root=q('screenDashboard');
    if(!root) return;
    if(r?.status==='review') return renderReviewV114(root,room,r);
    return previousRenderV114 ? previousRenderV114(room,r) : null;
  };

  // Host score toont review als 🤔 en knoppen blijven bruikbaar.
  renderHostScore = function(room){
    const r=room.currentRound||{}; if(!r.id||!q('hostScoreboard')) return;
    q('hostScorePanel')?.classList.remove('hidden');
    if(q('hostRoundInfo')) q('hostRoundInfo').textContent=`${r.colorEmoji||''} ${r.colorName||''} — ${r.category||''} — ${r.status||''}`;
    const ps=room.players||{}, ans=room.answers?.[r.id]||{}, cor=room.correct?.[r.id]||{};
    q('hostScoreboard').innerHTML=Object.entries(ps).map(([pid,p])=>{
      const st=cor[pid], cls=st===true?'scoreGood':st===false?'scoreBad':st==='review'?'scorePending':'scorePending';
      const label=st==='review'?'🤔 Jury':st===true?'✅ Goed':st===false?'❌ Fout':'—';
      return `<div class="scoreCard ${cls}"><div>${E(p.name||'Speler')}</div><div>${E(ans[pid]?.answer||'Geen antwoord')}</div><div><strong>${label}</strong><br><button type="button" class="goodBtn ${st===true?'goodSelected':''}" data-pid="${pid}" data-good="true">✅</button><button type="button" class="badBtn ${st===false?'badSelected':''}" data-pid="${pid}" data-good="false">❌</button></div></div>`;
    }).join('');
  };
})();


/* =========================
   V115 - Spelerscherm categorie + gezellige jury polish
   - Countdown toont alleen kleur + categorienaam
   - Geen vraagzin meer zoals 'Hoe heet deze track?'
   - Bij GO korte trilling, geen geluid
   - Host opent schoon en verbergt oude wheel-overlays
   ========================= */
(function(){
  const q=id=>document.getElementById(id);
  const oldSetupHostV115 = typeof setupHostMode === 'function' ? setupHostMode : null;
  if(oldSetupHostV115 && !window.__setupHostV115Clean){
    window.__setupHostV115Clean = true;
    setupHostMode = function(){
      try{ document.body.classList.remove('bbStageMode','bbKeyboardOpen','playerMode'); }catch(e){}
      try{ window.__bbWheelV110?.hideWheelV110?.(); window.__bbWheelV92?.hideWheelFull?.(0); }catch(e){}
      const o=q('bbWheelFullOverlayV92'); if(o){ o.classList.add('hidden'); o.style.display='none'; }
      return oldSetupHostV115.apply(this, arguments);
    };
  }
})();

/* =========================
   V116 - Categorietekst onder timer fix
   - Onder de timer staat altijd alleen de categorienaam
   - Geen automatische vraagzinnen meer tijdens pre-count of answering
   ========================= */
(function(){
  const q = id => document.getElementById(id);
  const E = s => (typeof esc === 'function' ? esc(String(s ?? '')) : String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])));
  const HEX = {yellow:'#FFCC33', pink:'#00D4C7', purple:'#FF8A1F', blue:'#7ED957', green:'#FF5A5F', free:'#101716'};
  function secondsLeft(r){
    if(!r?.deadlineMs) return null;
    return Math.max(0, Math.ceil((Number(r.deadlineMs)-Date.now())/1000));
  }
  function timerPct(r){
    const left = secondsLeft(r);
    const sec = Math.max(1, Number(r?.seconds)||20);
    return left === null ? 100 : Math.max(0, Math.min(100, left / sec * 100));
  }
  function precountLeft(r){
    const end = Number(r?.precountEndsAt || 0);
    if(!end) return 0;
    return Math.max(0, Math.ceil((end - Date.now())/1000));
  }
  function categoryLabel(r){
    return String(r?.category || 'Categorie').trim() || 'Categorie';
  }
  function setStage(root, cls, html){
    document.body.classList.add('bbStageMode');
    root.className = 'compactDashboard bbStageDashboard ' + cls;
    root.innerHTML = html;
  }

  const previousRenderV116 = typeof renderCompactDashboard === 'function' ? renderCompactDashboard : null;
  renderCompactDashboard = function(room,r){
    const root = q('screenDashboard');
    if(!root) return previousRenderV116 ? previousRenderV116(room,r) : null;

    if(r?.status === 'precount'){
      const left = precountLeft(r);
      const goText = left ? String(left) : 'GO';
      setStage(root,'stagePrecount stageAnswer',`<section class="bbStageShell">
        <img src="bb_logo.png" class="bbStageLogo mini" alt="Bingo Beats">
        <div class="bbRoundBadge" style="--chosen:${HEX[r.colorKey]||'#FFCC33'}"><span></span>${E(r.colorName||'')} · ${E(categoryLabel(r))}</div>
        <div class="bbPrecountBig" style="--chosen:${HEX[r.colorKey]||'#FFCC33'}"><span>${E(goText)}</span></div>
        <h2 class="bbCategoryTitle">🎯 ${E(categoryLabel(r))}</h2>
        <input class="bbStageInput" value="" placeholder="Maak je klaar..." autocomplete="off" disabled>
        <button class="bbStageSubmit" disabled>${left ? 'START OVER '+left : 'START!'}</button>
        <p class="bbStageSub">Het liedje start zo meteen.</p>
      </section>`);
      return;
    }

    if(r?.status === 'answering'){
      const own = r?.id ? (room.answers?.[r.id]?.[currentPlayerId]) : null;
      if(!own){
        const left = secondsLeft(r);
        setStage(root,'stageAnswer',`<section class="bbStageShell">
          <img src="bb_logo.png" class="bbStageLogo mini" alt="Bingo Beats">
          <div class="bbRoundBadge" style="--chosen:${HEX[r.colorKey]||'#FFCC33'}"><span></span>${E(r.colorName||'')} · ${E(categoryLabel(r))}</div>
          <div class="bbCountdownBig" style="--pct:${timerPct(r)};--chosen:${HEX[r.colorKey]||'#FFCC33'}"><span>${left ?? ''}</span></div>
          <h2 class="bbCategoryTitle">🎯 ${E(categoryLabel(r))}</h2>
          <input id="bbStageAnswerInput" class="bbStageInput" value="" placeholder="Typ je antwoord..." autocomplete="off">
          <button id="bbStageSubmitBtn" class="bbStageSubmit">VERSTUREN</button>
        </section>`);
        const inp = q('bbStageAnswerInput');
        inp?.addEventListener('keydown', e=>{ if(e.key==='Enter') q('bbStageSubmitBtn')?.click(); });
        q('bbStageSubmitBtn')?.addEventListener('click',()=>{
          const v=(q('bbStageAnswerInput')?.value||'').trim();
          if(!v) return alert('Vul eerst je antwoord in.');
          if(typeof submitAnswerValue === 'function') submitAnswerValue(v);
        });
        setTimeout(()=>inp?.focus(),50);
        return;
      }
    }
    return previousRenderV116 ? previousRenderV116(room,r) : null;
  };
})();

/* =========================
   V117 - Categorie UI + Jury + Clean Host
   - Spelerscherm: boven alleen kleur, categorienaam alleen onder timer
   - Maximaal 1 BB-logo: stage-logo's verborgen
   - Categorie-specifieke Jury van Bingo Beats
   - Nieuwe kamer/nieuw spel maakt hostscore schoon
   ========================= */
(function(){
  const q=id=>document.getElementById(id);
  const E=s=>(typeof esc==='function'?esc(String(s??'')):String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])));
  const HEX={yellow:'#FFCC33',pink:'#00D4C7',purple:'#FF8A1F',blue:'#7ED957',green:'#FF5A5F',free:'#101716'};
  function catLabel(r){return String(r?.category||'Categorie').trim()||'Categorie'}
  function secondsLeft117(r){if(!r?.deadlineMs)return null;return Math.max(0,Math.ceil((Number(r.deadlineMs)-Date.now())/1000))}
  function timerPct117(r){const left=secondsLeft117(r),sec=Math.max(1,Number(r?.seconds)||20);return left===null?100:Math.max(0,Math.min(100,left/sec*100))}
  function precountLeft117(r){const end=Number(r?.precountEndsAt||0);return end?Math.max(0,Math.ceil((end-Date.now())/1000)):0}
  function setStage117(root,cls,html){document.body.classList.add('bbStageMode');root.className='compactDashboard bbStageDashboard '+cls;root.innerHTML=html}

  // Oude vraagzinnen uitschakelen: overal waar oude code nog vraagt, gewoon categorienaam teruggeven.
  window.bbCategoryLabelV117=catLabel;
  try{ if(typeof questionForCategoryV93==='function') questionForCategoryV93=function(cat){return String(cat||'Categorie')}; }catch(e){}
  try{ if(typeof categoryQuestion==='function') categoryQuestion=function(cat){return String(cat||'Categorie')}; }catch(e){}
  try{ if(typeof questionFor==='function') questionFor=function(cat){return String(cat||'Categorie')}; }catch(e){}

  const prevRender117=typeof renderCompactDashboard==='function'?renderCompactDashboard:null;
  renderCompactDashboard=function(room,r){
    const root=q('screenDashboard');
    if(!root) return prevRender117?prevRender117(room,r):null;

    if(r?.status==='precount'){
      const left=precountLeft117(r),goText=left?String(left):'GO';
      setStage117(root,'stagePrecount stageAnswer',`<section class="bbStageShell bbNoInnerLogo">
        <div class="bbRoundBadge bbColorOnly" style="--chosen:${HEX[r.colorKey]||'#FFCC33'}"><span></span>${E(r.colorName||'KLEUR')}</div>
        <div class="bbPrecountBig" style="--chosen:${HEX[r.colorKey]||'#FFCC33'}"><span>${E(goText)}</span></div>
        <h2 class="bbCategoryTitle">🎯 ${E(catLabel(r))}</h2>
        <input class="bbStageInput" value="" placeholder="Maak je klaar..." autocomplete="off" disabled>
        <button class="bbStageSubmit" disabled>${left?'START OVER '+left:'START!'}</button>
        <p class="bbStageSub">Het liedje start zo meteen.</p>
      </section>`);
      return;
    }

    if(r?.status==='answering'){
      const own=r?.id?(room.answers?.[r.id]?.[currentPlayerId]):null;
      if(!own){
        const left=secondsLeft117(r);
        setStage117(root,'stageAnswer',`<section class="bbStageShell bbNoInnerLogo">
          <div class="bbRoundBadge bbColorOnly" style="--chosen:${HEX[r.colorKey]||'#FFCC33'}"><span></span>${E(r.colorName||'KLEUR')}</div>
          <div class="bbCountdownBig" style="--pct:${timerPct117(r)};--chosen:${HEX[r.colorKey]||'#FFCC33'}"><span>${left??''}</span></div>
          <h2 class="bbCategoryTitle">🎯 ${E(catLabel(r))}</h2>
          <input id="bbStageAnswerInput" class="bbStageInput" value="" placeholder="Typ je antwoord..." autocomplete="off">
          <button id="bbStageSubmitBtn" class="bbStageSubmit">VERSTUREN</button>
        </section>`);
        const inp=q('bbStageAnswerInput');
        inp?.addEventListener('keydown',e=>{if(e.key==='Enter')q('bbStageSubmitBtn')?.click()});
        q('bbStageSubmitBtn')?.addEventListener('click',()=>{const v=(q('bbStageAnswerInput')?.value||'').trim();if(!v)return alert('Vul eerst je antwoord in.');if(typeof submitAnswerValue==='function')submitAnswerValue(v)});
        setTimeout(()=>inp?.focus(),50);
        return;
      }
    }
    return prevRender117?prevRender117(room,r):null;
  };

  function cleanHostUi117(){
    try{['hostAnswerArea','hostScoreboard','hostRoundInfo','hostBingoMessage'].forEach(id=>{const el=q(id);if(el)el.innerHTML=''})}catch(e){}
    try{q('hostScorePanel')?.classList.add('hidden');q('hostBingoPanel')?.classList.add('hidden')}catch(e){}
    try{if(q('hostPickerArea'))q('hostPickerArea').innerHTML='🎮<br>Klaar om te spelen'}catch(e){}
    try{if(q('hostStatus'))q('hostStatus').textContent='Nieuwe start. Maak of hervat een kamer.'}catch(e){}
  }
  window.bbCleanHostUi117=cleanHostUi117;
  document.addEventListener('click',e=>{if(e.target?.id==='newRoomBtn'||e.target?.id==='confirmNewGameBtn'||e.target?.id==='newGameBtn')cleanHostUi117()},true);

  // ===== Jury van Bingo Beats V117 =====
  const STOP=new Set(['the','de','het','een','a','an','of','van']);
  const WORDNUM={zero:'0',one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9',ten:'10',eleven:'11',twelve:'12'};
  function stripMixInfo(s){
    s=String(s||'');
    s=s.replace(/\s*[\(\[][^\)\]]*(radio\s*edit|edit|remix|mix|live|extended|acoustic|instrumental|remaster|version|club|single)[^\)\]]*[\)\]]/ig,'');
    s=s.replace(/\s*[-–—]\s*.*\b(radio\s*edit|edit|remix|mix|live|extended|acoustic|instrumental|remaster|version|club|single)\b.*$/ig,'');
    s=s.replace(/\s+(feat\.?|ft\.?|featuring)\s+.*$/ig,'');
    return s.trim();
  }
  function baseNorm117(s){
    s=stripMixInfo(s).toLowerCase();
    s=s.replace(/&/g,' and ');
    Object.entries(WORDNUM).forEach(([w,n])=>{s=s.replace(new RegExp('\\b'+w+'\\b','g'),n)});
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  }
  function tokens117(s){const b=baseNorm117(s);return b?b.split(' ').filter(Boolean):[]}
  function coreTokens117(s){return tokens117(s).filter(w=>!STOP.has(w))}
  function lev117(a,b){a=String(a||'');b=String(b||'');const m=a.length,n=b.length,dp=Array.from({length:m+1},()=>Array(n+1).fill(0));for(let i=0;i<=m;i++)dp[i][0]=i;for(let j=0;j<=n;j++)dp[0][j]=j;for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return dp[m][n]}
  function sim117(a,b){a=baseNorm117(a);b=baseNorm117(b);if(!a&&!b)return 1;if(!a||!b)return 0;const m=Math.max(a.length,b.length);return 1-lev117(a,b)/m}
  function wordClose117(a,b){a=baseNorm117(a);b=baseNorm117(b);if(a===b)return true;if(!a||!b)return false;if((a==='i'&&b==='it')||(a==='it'&&b==='i'))return true;const d=lev117(a,b),m=Math.max(a.length,b.length);if(m<=4)return d<=1;if(m<=7)return d<=2;return d<=3||(1-d/m)>=0.72}
  function cover117(correct,given){const used=new Array(given.length).fill(false);let hit=0;for(const cw of correct){let best=-1,score=-999;for(let i=0;i<given.length;i++){if(used[i])continue;const gw=given[i];let sc=cw===gw?100:(wordClose117(cw,gw)?80-lev117(cw,gw):-100);if(sc>score){score=sc;best=i}}if(best>=0&&score>0){used[best]=true;hit++}}return{hit,total:correct.length,missing:Math.max(0,correct.length-hit)}}
  function parseYear117(v){const s=String(v||'').toLowerCase().replace(/[’']/g,'');let m=s.match(/\b(19\d{2}|20\d{2})\b/);if(m)return Number(m[1]);m=s.match(/\b(\d{2})\b/);if(m){const n=Number(m[1]);return n<=35?2000+n:1900+n}return null}
  function decade117(y){y=Number(y);return y?Math.floor(y/10)*10:null}
  function parseDecade117(v){const s=String(v||'').toLowerCase();if(/nineties/.test(s))return 1990;if(/eighties/.test(s))return 1980;if(/seventies/.test(s))return 1970;if(/sixties/.test(s))return 1960;if(/\b00s\b|jaren\s*00|\b00\b/.test(s))return 2000;if(/\b10s\b|jaren\s*10|\b10\b/.test(s))return 2010;if(/\b20s\b|jaren\s*20|\b20\b/.test(s))return 2020;let m=s.match(/\b(60|70|80|90)\s*(s|'s)?\b/);if(m)return 1900+Number(m[1]);const y=parseYear117(s);return y?decade117(y):null}
  function kind117(cat){const c=String(cat||'').toLowerCase();if((c.includes('voor')&&c.includes('na'))||c.includes('2001'))return'beforeafter';if(c.includes('decennium')||c.includes('decade'))return'decade';if(c.includes('jaartal')||c.includes('jaar')||c.includes('+/-')||c.includes('±'))return'year';if(c.includes('artiest')||c.includes('artist'))return'artist';return'title'}
  function correct117(kind,ans){ans=ans||{};if(kind==='beforeafter'){const y=parseYear117(ans.year);return y&&y<2001?'voor':'na'}if(kind==='artist')return ans.artist||'';if(kind==='year'||kind==='decade')return ans.year||'';return ans.track||''}
  function judge117(r,answer){
    const kind=kind117(r?.category), corr=correct117(kind,r?.correctAnswer||{}), raw=String(answer||'').trim();
    if(!raw)return{good:false,review:false,reason:'Geen antwoord',kind,correct:corr};
    if(kind==='beforeafter'){
      const g=baseNorm117(raw);let val='';if(['voor','ervoor','before'].includes(g))val='voor';if(['na','erna','after'].includes(g))val='na';return{good:val===corr,review:false,reason:val?(val===corr?'Voor/na klopt':'Voor/na klopt niet'):'Antwoord moet voor of na zijn',kind,correct:corr};
    }
    if(kind==='year'){
      const cy=parseYear117(corr),gy=parseYear117(raw);const ok=!!cy&&!!gy&&Math.abs(cy-gy)<=2;return{good:ok,review:false,reason:ok?'Binnen marge':'Buiten marge',kind,correct:corr};
    }
    if(kind==='decade'){
      const cd=decade117(parseYear117(corr)),gd=parseDecade117(raw);const ok=!!cd&&cd===gd;return{good:ok,review:false,reason:ok?'Zelfde decennium':'Ander decennium',kind,correct:corr};
    }
    const c=baseNorm117(corr),g=baseNorm117(raw);
    if(c&&g&&c===g)return{good:true,review:false,reason:'Exact genoeg',kind,correct:corr};
    // Coulanter voor duidelijke typefouten zoals Gravity -> grqvity.
    if((kind==='title'||kind==='artist')&&c&&g){
      const d=lev117(c,g), m=Math.max(c.length,g.length);
      if(m>=5 && d<=2) return{good:true,review:false,reason:'Duidelijke typefout',kind,correct:corr};
    }
    if(sim117(corr,raw)>=0.74)return{good:true,review:false,reason:'Duidelijk bedoeld',kind,correct:corr};
    const allC=tokens117(corr),allG=tokens117(raw),ct=coreTokens117(corr),gt=coreTokens117(raw);
    if(!ct.length)return{good:false,review:false,reason:'Geen juist antwoord beschikbaar',kind,correct:corr};
    const cov=cover117(ct,gt),ratio=cov.hit/ct.length;
    if(kind==='title'&&ct.length===1&&gt.length===1&&cov.missing===0&&allC.length>=3&&allG.length<=1)return{good:false,review:true,reason:'Antwoord lijkt onvolledig',kind,correct:corr};
    if(cov.missing===0)return{good:true,review:false,reason:'Alle belangrijke woorden herkend',kind,correct:corr};
    if(kind==='title'&&ct.length>=3&&cov.missing===1&&ratio>=0.66)return{good:false,review:true,reason:'Belangrijk woord ontbreekt',kind,correct:corr};
    if(kind==='title'&&ct.length===2&&cov.hit===1&&gt.length===1)return{good:false,review:true,reason:'Antwoord lijkt onvolledig',kind,correct:corr};
    if(kind==='artist'&&sim117(corr,raw)>=0.68&&gt.length>=1)return{good:true,review:false,reason:'Artiest duidelijk bedoeld',kind,correct:corr};
    return{good:false,review:false,reason:'Onvoldoende herkenbaar',kind,correct:corr};
  }
  window.bbJudgeOneV117=judge117;
  async function runJury117(roomCode,forceStatus){
    const snap=await db.ref('rooms/'+roomCode).once('value');const room=snap.val()||{},r=room.currentRound||{};if(!r.id||!r.correctAnswer)return{reviews:[],room,r};
    const ans=room.answers?.[r.id]||{},players=room.players||{},up={},reviews=[];
    Object.keys(players).forEach(pid=>{const text=ans[pid]?.answer||'';const j=judge117(r,text);up[`rooms/${roomCode}/correct/${r.id}/${pid}`]=j.review?'review':!!j.good;up[`rooms/${roomCode}/juryMeta/${r.id}/${pid}`]={kind:j.kind,reason:j.reason,correct:j.correct,answer:text,review:!!j.review};if(j.review)reviews.push(pid)});
    up[`rooms/${roomCode}/currentRound/juryDone`]=true;up[`rooms/${roomCode}/currentRound/reviewList`]=reviews;up[`rooms/${roomCode}/currentRound/reviewIndex`]=0;if(forceStatus)up[`rooms/${roomCode}/currentRound/status`]=reviews.length?'review':forceStatus;await db.ref().update(up);return{reviews,room,r};
  }
  window.bbRunJuryV117=runJury117;
  lockRound=function(){
    if(!currentRoomCode)return;publishAnswer().then(()=>runJury117(currentRoomCode,null)).then(res=>{const has=!!res?.reviews?.length;return db.ref('rooms/'+currentRoomCode+'/currentRound').update({status:'locked'}).then(()=>setTimeout(()=>db.ref('rooms/'+currentRoomCode+'/currentRound').update({status:has?'review':'judged'}),2200))}).then(()=>{if(q('hostStatus'))q('hostStatus').textContent='Jury van Bingo Beats heeft de antwoorden beoordeeld.'}).catch(e=>alert('Jury/timer fout: '+(e.message||e)))};
  publishResults=function(){if(!currentRoomCode)return;runJury117(currentRoomCode,'judged').then(()=>{if(q('hostStatus'))q('hostStatus').textContent='Jury-scorebord verzonden.'})};
})();


/* =========================
   V131 - Carrousel + Lichtronde, geen draaiend rad meer
   - Vervangt de oude wiel/rad-flow volledig in actieve code
   - Host en spelers zien dezelfde gekozen animatie
   - 12 seconden: snel naar rustig naar duidelijke stop
   ========================= */
(function(){
  const q=id=>document.getElementById(id);
  const E=s=>(typeof esc==='function'?esc(String(s??'')):String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])));
  const HEX={yellow:'#FFCC33',pink:'#00D4C7',purple:'#FF8A1F',blue:'#7ED957',green:'#FF5A5F'};
  const EMOJI={yellow:'🟡',pink:'🩵',purple:'🟠',blue:'🟢',green:'🔴'};
  const NAME={yellow:'GOUD',pink:'AQUA',purple:'ORANJE',blue:'LIME',green:'KORAAL'};
  const INPUT={yellow:'cat-yellow',pink:'cat-pink',purple:'cat-purple',blue:'cat-blue',green:'cat-green'};
  const KEYS=['yellow','pink','purple','blue','green'];
  const INTRO_MS=12000;
  let activeIntroKey='';
  let rafId=null;

  function colorObj(key){
    const c=(typeof COLORS!=='undefined'&&COLORS.find(x=>x.key===key))||{};
    return {key,name:c.name||NAME[key]||'KLEUR',emoji:c.emoji||EMOJI[key]||'',hex:c.hex||HEX[key]||'#FFCC33',input:c.input||INPUT[key]};
  }
  function categoryFor(color){try{return q(color.input)?.value||'Geen categorie'}catch(_e){return'Geen categorie'}}
  function pickOne(a){return a[Math.floor(Math.random()*a.length)]}
  function easeOutCubic(t){return 1-Math.pow(1-t,3)}

  function makeSequence(targetKey, len=85){
    const seq=[];
    for(let i=0;i<len;i++) seq.push(KEYS[(i*7+i*3+Math.floor(i/2))%KEYS.length]);
    const targetIndex=len-8;
    seq[targetIndex]=targetKey;
    return {seq,targetIndex};
  }
  function randomIntro(targetKey){
    const mode=Math.random()<0.5?'carousel':'lights';
    const data=makeSequence(targetKey);
    return {mode,seq:data.seq,targetIndex:data.targetIndex};
  }

  function ensureOverlay(){
    let o=q('bbIntroOverlayV131');
    if(!o){o=document.createElement('div');o.id='bbIntroOverlayV131';o.className='bbIntroOverlayV131 hidden';document.body.appendChild(o)}
    return o;
  }
  function cancelAnim(){if(rafId){cancelAnimationFrame(rafId);rafId=null}}
  function hideOldVisuals(){
    // Oude rad/wiel-elementen hard verbergen als ze nog in DOM staan uit eerdere versies/cache.
    document.querySelectorAll('#bbWheelFullOverlayV92,#bbWheelV123Overlay,#bbWheelV125Overlay,.bbWheelFullCardV92,.bbWheelInlineV110,.bbWheelInlineV121,.bbWheelInlineV122,.bbWheelInlineV123,.bbWheelHostStatusV125,.bbWheelHostResultV125,.wheelWrap,.wheel,.showWheel,.dashWheel').forEach(el=>{
      if(el.closest('#bbIntroOverlayV131')) return;
      el.style.setProperty('display','none','important');
      el.style.setProperty('visibility','hidden','important');
      if(el.id&&el.id!=='bbIntroOverlayV131') el.innerHTML='';
    });
  }
  function hideIntro(){
    cancelAnim();activeIntroKey='';
    const o=q('bbIntroOverlayV131');
    if(o){o.classList.add('hidden');o.classList.remove('show');o.innerHTML=''}
  }

  function carouselHTML(seq,targetIndex,roundId){
    return `<div class="bbIntroCardV131 carousel" data-round="${E(roundId||'')}" data-target="${targetIndex}">
      <div class="bbIntroPointerV131"></div>
      <div class="bbIntroTitleV131">Categorie wordt gekozen...</div>
      <div class="bbCarouselWindowV131">
        <div class="bbCarouselTrackV131">${seq.map((k,i)=>`<span class="bbCarouselSegV131" data-i="${i}" data-key="${E(k)}" style="--seg:${HEX[k]}"></span>`).join('')}</div>
      </div>
      <div class="bbIntroHintV131">Even spannend...</div>
    </div>`;
  }
  function lightsHTML(targetKey,roundId){
    return `<div class="bbIntroCardV131 lights" data-round="${E(roundId||'')}" data-target-key="${E(targetKey)}">
      <div class="bbIntroTitleV131">Categorie wordt gekozen...</div>
      <div class="bbLightRingV131">
        ${KEYS.map((k,i)=>`<div class="bbLightNodeV131" data-key="${E(k)}" data-i="${i}" style="--seg:${HEX[k]}"><span>${EMOJI[k]}</span></div>`).join('')}
      </div>
      <div class="bbIntroHintV131">De lampjes lopen rond...</div>
    </div>`;
  }
  function resultHTML(color,cat){
    return `<div class="bbIntroResultV131" style="--result:${color.hex}">
      <div class="bbIntroResultDotV131"></div>
      <div class="bbIntroResultNameV131">${E(color.emoji)} ${E(color.name)}</div>
      <div class="bbIntroResultCatV131">${E(cat||'')}</div>
    </div>`;
  }
  function animateCarousel(card,targetIndex){
    const track=card.querySelector('.bbCarouselTrackV131');
    const win=card.querySelector('.bbCarouselWindowV131');
    if(!track||!win)return;
    // BELANGRIJK: niet rekenen met alleen segment-breedte, want CSS heeft margin/gap.
    // We pakken het echte doelvakje uit de DOM en zetten het midden daarvan exact onder de witte lijn.
    const targetEl=track.querySelector(`.bbCarouselSegV131[data-i="${targetIndex}"]`) || track.children[targetIndex];
    if(!targetEl)return;
    const winW=win.getBoundingClientRect().width||window.innerWidth;
    const targetCenter=targetEl.offsetLeft + (targetEl.offsetWidth/2);
    const end=(winW/2)-targetCenter;
    const start=Math.min(140, winW/4);
    track.style.transform=`translate3d(${start}px,0,0)`;
    const t0=performance.now();
    function frame(now){
      const t=Math.min(1,(now-t0)/INTRO_MS);
      const e=easeOutCubic(t);
      const x=start+(end-start)*e;
      track.style.transform=`translate3d(${x}px,0,0)`;
      if(t<1) rafId=requestAnimationFrame(frame);
      else{track.style.transform=`translate3d(${end}px,0,0)`;rafId=null;}
    }
    rafId=requestAnimationFrame(frame);
  }
  function animateLights(card,targetKey){
    const nodes=[...card.querySelectorAll('.bbLightNodeV131')];
    if(!nodes.length)return;
    const targetIdx=Math.max(0,KEYS.indexOf(targetKey));
    // Kies een totaal aantal stappen dat exact eindigt op targetIdx.
    // 80 is deelbaar door 5, dus 80 + targetIdx eindigt altijd op targetIdx.
    // Hierdoor is er geen correctie-stap of terugstap meer na het stoppen.
    const totalSteps=80+targetIdx;
    const t0=performance.now();
    let lastStep=-1;
    function setActive(i, final=false){
      const idx=((i%nodes.length)+nodes.length)%nodes.length;
      if(idx===lastStep && !final) return;
      lastStep=idx;
      nodes.forEach(n=>n.classList.remove('active','final'));
      const n=nodes[idx];
      if(n)n.classList.add('active');
      if(final&&n)n.classList.add('final');
    }
    function frame(now){
      const t=Math.min(1,(now-t0)/INTRO_MS);
      const e=easeOutCubic(t);
      const step=Math.min(totalSteps,Math.floor(e*totalSteps));
      if(t<1){
        setActive(step,false);
        rafId=requestAnimationFrame(frame);
      }else{
        setActive(totalSteps,true);
        rafId=null;
      }
    }
    rafId=requestAnimationFrame(frame);
  }
  function showIntro(mode,seq,targetIndex,targetKey,roundId){
    const introKey=[mode,targetIndex,targetKey,roundId].join(':');
    const o=ensureOverlay();
    hideOldVisuals();
    if(activeIntroKey===introKey && o.classList.contains('show')) return;
    cancelAnim();activeIntroKey=introKey;
    if(mode==='lights') o.innerHTML=lightsHTML(targetKey,roundId);
    else o.innerHTML=carouselHTML(seq,targetIndex,roundId);
    o.classList.remove('hidden');o.classList.add('show');
    const card=o.querySelector('.bbIntroCardV131');
    if(mode==='lights') animateLights(card,targetKey); else animateCarousel(card,targetIndex);
  }
  function showResult(color,cat){
    cancelAnim();activeIntroKey='result';hideOldVisuals();
    const o=ensureOverlay();o.innerHTML=resultHTML(color,cat);o.classList.remove('hidden');o.classList.add('show');
  }

  // Oude publieke wiel-API's neutraal maken zodat oudere listeners niets opnieuw kunnen tonen.
  window.__bbWheelV92={showWheelFull:()=>{},showWheelResult:()=>{},hideWheelFull:()=>{}};
  window.__bbWheelV110={showWheelV110:()=>{},showResultV110:()=>{},hideWheelV110:()=>{},wheelHTMLV110:()=>''};
  window.__bbWheelV119={showWheel:()=>{},showResult:()=>{},hideWheel:()=>{},wheelHTML:()=>'',resultHTML:()=>''};
  window.__bbWheelFixedV121={showIndex:()=>{},showKey:()=>{},showResult:()=>{},hide:()=>{},htmlWheel:()=>'',htmlResult:()=>''};
  window.__bbIntroV131={showIntro,showResult,hideIntro};

  if(typeof pickerHTML==='function') pickerHTML=function(){return '<div class="bbIntroHostStatusV131">Categorie wordt gekozen...</div>'};

  startRoundVisual=function(room){
    hideIntro();hideOldVisuals();
    if(q('hostAnswerArea'))q('hostAnswerArea').innerHTML='';
    if(q('playBtn')){q('playBtn').disabled=true;q('playBtn').textContent='🎵 Nummer start zo...'}
    if(q('showAnswerBtn'))q('showAnswerBtn').disabled=true;
    if(q('hostPickerArea'))q('hostPickerArea').innerHTML='<div class="bbIntroHostStatusV131">Categorie wordt gekozen...</div>';

    const color=pickOne((typeof COLORS!=='undefined'&&COLORS.length)?COLORS.map(c=>colorObj(c.key)):KEYS.map(colorObj));
    const cat=categoryFor(color);
    const intro=randomIntro(color.key);
    currentRoundId='r_'+Date.now();

    db.ref('rooms/'+room+'/currentRound').set({
      id:currentRoundId,
      status:'picking',
      pickerMode:'introV131',
      introMode:intro.mode,
      introSequence:intro.seq,
      introTargetIndex:intro.targetIndex,
      pendingColorKey:color.key,
      pendingColorName:color.name,
      pendingColorEmoji:color.emoji,
      pendingCategory:cat,
      pickerStartedAt:firebase.database.ServerValue.TIMESTAMP,
      seconds:Number(q('duration')?.value)||20
    }).then(()=>showIntro(intro.mode,intro.seq,intro.targetIndex,color.key,currentRoundId));

    setTimeout(()=>{
      try{if(typeof flash==='function')flash()}catch(_e){}
      showResult(color,cat);
      if(q('hostPickerArea'))q('hostPickerArea').innerHTML=`<div class="bbIntroHostResultV131">${E(color.emoji)} ${E(color.name)}<br><span>${E(cat)}</span></div>`;
      const ends=Date.now()+3000;
      db.ref('rooms/'+room+'/currentRound').set({
        id:currentRoundId,
        status:'precount',
        pickerMode:'introV131',
        introMode:intro.mode,
        introSequence:intro.seq,
        introTargetIndex:intro.targetIndex,
        colorKey:color.key,
        colorName:color.name,
        colorEmoji:color.emoji,
        category:cat,
        seconds:Number(q('duration')?.value)||20,
        precountStartedAt:firebase.database.ServerValue.TIMESTAMP,
        precountEndsAt:ends
      }).then(()=>{
        q('hostScorePanel')?.classList.remove('hidden');
        if(q('hostStatus'))q('hostStatus').textContent='Categorie gekozen. 3-2-1... daarna start het nummer.';
        setTimeout(()=>{hideIntro();if(typeof playHidden==='function')playHidden()},3000);
      });
    },INTRO_MS);
  };

  const previousRender=typeof renderCompactDashboard==='function'?renderCompactDashboard:null;
  renderCompactDashboard=function(room,r){
    if(r&&r.status==='picking'){
      const root=q('screenDashboard');
      if(root){document.body.classList.add('bbStageMode');root.className='compactDashboard bbStageDashboard stageIntroV131';root.innerHTML='<section class="bbIntroPlayerStatusV131">Categorie wordt gekozen...</section>'}
      const seq=Array.isArray(r.introSequence)&&r.introSequence.length?r.introSequence:makeSequence(r.pendingColorKey||'yellow').seq;
      const target=Number.isFinite(Number(r.introTargetIndex))?Number(r.introTargetIndex):makeSequence(r.pendingColorKey||'yellow').targetIndex;
      showIntro(r.introMode||'carousel',seq,target,r.pendingColorKey||'yellow',r.id||'');
      return;
    }
    if(r&&r.status!=='picking')hideIntro();
    return previousRender?previousRender(room,r):null;
  };

  let listeningRoom='';
  function roomCode(){return(currentRoomCode||new URLSearchParams(location.search).get('room')||localStorage.hb_player_room||localStorage.hb_host_room||'').toUpperCase()}
  function attach(){
    try{
      if(!db)return;const room=roomCode();if(!room||room===listeningRoom)return;
      if(listeningRoom)db.ref('rooms/'+listeningRoom+'/currentRound').off('value.bbIntroV131');
      listeningRoom=room;
      db.ref('rooms/'+room+'/currentRound').on('value.bbIntroV131',s=>{
        const r=s.val()||{};hideOldVisuals();
        if(r.status==='picking'){
          const seq=Array.isArray(r.introSequence)&&r.introSequence.length?r.introSequence:makeSequence(r.pendingColorKey||'yellow').seq;
          const target=Number.isFinite(Number(r.introTargetIndex))?Number(r.introTargetIndex):makeSequence(r.pendingColorKey||'yellow').targetIndex;
          showIntro(r.introMode||'carousel',seq,target,r.pendingColorKey||'yellow',r.id||'');
          if(q('hostPickerArea'))q('hostPickerArea').innerHTML='<div class="bbIntroHostStatusV131">Categorie wordt gekozen...</div>';
        }else hideIntro();
      });
    }catch(_e){}
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(attach,250));
  setInterval(()=>{attach();hideOldVisuals()},600);
})();

/* =========================
   V134 - Alleen carrousel + timer fix
   - Lichtjesanimatie volledig uit de actieve flow
   - Ook oude/current rounds met introMode='lights' worden als carrousel getoond
   - Timer/precount telt lokaal door en blijft niet op 20 staan
   ========================= */
(function(){
  const q=id=>document.getElementById(id);
  const KEY_MAP={yellow:'#FFCC33',pink:'#00D4C7',purple:'#FF8A1F',blue:'#7ED957',green:'#FF5A5F'};
  let uiTicker=null;
  let lastRoomSnap=null;
  let lastRoundSnap=null;

  function safeMakeSequence(targetKey,len=85){
    if(typeof makeSequence==='function') return makeSequence(targetKey,len);
    const keys=['yellow','pink','purple','blue','green'];
    const seq=[];
    for(let i=0;i<len;i++) seq.push(keys[(i*7+i*3+Math.floor(i/2))%keys.length]);
    const targetIndex=len-8;
    seq[targetIndex]=targetKey||'yellow';
    return {seq,targetIndex};
  }

  function forceCarouselData(r){
    const key=r?.pendingColorKey || r?.colorKey || 'yellow';
    const made=safeMakeSequence(key);
    return {
      mode:'carousel',
      seq:Array.isArray(r?.introSequence)&&r.introSequence.length?r.introSequence:made.seq,
      target:Number.isFinite(Number(r?.introTargetIndex))?Number(r.introTargetIndex):made.targetIndex,
      key
    };
  }

  function secondsLeft(r){
    if(!r?.deadlineMs) return null;
    return Math.max(0,Math.ceil((Number(r.deadlineMs)-Date.now())/1000));
  }
  function precountLeft(r){
    const end=Number(r?.precountEndsAt||0);
    return end?Math.max(0,Math.ceil((end-Date.now())/1000)):0;
  }
  function pct(r){
    const left=secondsLeft(r), sec=Math.max(1,Number(r?.seconds)||20);
    return left===null?100:Math.max(0,Math.min(100,left/sec*100));
  }

  function patchVisibleTimer(){
    const r=lastRoundSnap;
    if(!r) return;
    if(r.status==='precount'){
      const left=precountLeft(r), txt=left?String(left):'GO';
      document.querySelectorAll('.bbPrecountBig span').forEach(el=>el.textContent=txt);
      document.querySelectorAll('.bbStageSubmit[disabled]').forEach(el=>el.textContent=left?'START OVER '+left:'START!');
    }
    if(r.status==='answering'){
      const left=secondsLeft(r);
      document.querySelectorAll('.bbCountdownBig span').forEach(el=>el.textContent=left??'');
      document.querySelectorAll('.bbCountdownBig').forEach(el=>{
        el.style.setProperty('--pct',String(pct(r)));
        el.style.setProperty('--chosen',KEY_MAP[r.colorKey]||'#FFCC33');
      });
    }
  }
  function startTicker(){
    if(uiTicker) return;
    uiTicker=setInterval(patchVisibleTimer,250);
  }

  // Forceer nieuwe rondes naar carrousel en niet meer naar lichtjes.
  if(typeof randomIntro==='function'){
    randomIntro=function(targetKey){
      const data=safeMakeSequence(targetKey);
      return {mode:'carousel',seq:data.seq,targetIndex:data.targetIndex};
    };
  }

  // Negeer lichtjesfunctie volledig, mocht oude code hem toch aanroepen.
  if(typeof animateLights==='function') animateLights=function(){};
  if(typeof lightsHTML==='function') lightsHTML=function(){return ''};

  // Wrapper om showIntro nooit meer lights te laten tonen.
  if(typeof showIntro==='function'){
    const oldShowIntro=showIntro;
    showIntro=function(mode,seq,targetIndex,targetKey,roundId){
      return oldShowIntro('carousel',seq,targetIndex,targetKey,roundId);
    };
  }

  // Wrapper om player render bij te houden + timers lokaal te laten doorlopen.
  if(typeof renderCompactDashboard==='function'){
    const prev=renderCompactDashboard;
    renderCompactDashboard=function(room,r){
      lastRoomSnap=room; lastRoundSnap=r; startTicker();
      if(r && r.status==='picking'){
        try{
          const d=forceCarouselData(r);
          if(typeof showIntro==='function') showIntro('carousel',d.seq,d.target,d.key,r.id||'');
        }catch(_e){}
      }
      const out=prev(room,r);
      setTimeout(patchVisibleTimer,30);
      return out;
    };
  }

  // Extra Firebase listener: als een oude ronde introMode=lights bevat, toon alsnog carrousel.
  let boundRoom='';
  function currentRoom(){return (window.currentRoomCode||currentRoomCode||new URLSearchParams(location.search).get('room')||localStorage.hb_player_room||localStorage.hb_host_room||'').toUpperCase();}
  function bindRoundListener(){
    try{
      if(!db) return;
      const room=currentRoom();
      if(!room || room===boundRoom) return;
      if(boundRoom) db.ref('rooms/'+boundRoom+'/currentRound').off('value.bbV134');
      boundRoom=room;
      db.ref('rooms/'+room+'/currentRound').on('value.bbV134',s=>{
        const r=s.val()||{};
        lastRoundSnap=r; startTicker(); setTimeout(patchVisibleTimer,30);
        if(r.status==='picking'){
          const d=forceCarouselData(r);
          if(typeof showIntro==='function') showIntro('carousel',d.seq,d.target,d.key,r.id||'');
        }
      });
    }catch(_e){}
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(bindRoundListener,300));
  setInterval(bindRoundListener,800);
})();

/* =========================
   V136 - DJ Pads enige categorie-animatie
   - Alle oude rad/carrousel/lichtjes overlays worden verborgen
   - Host en speler zien dezelfde DJ Pads animatie
   - 12 seconden, eindigt rechtstreeks op gekozen kleur
   ========================= */
(function(){
  const q=id=>document.getElementById(id);
  const E=s=>(typeof esc==='function'?esc(String(s??'')):String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])));
  const INTRO_MS=12000;
  const KEYS=['yellow','pink','purple','blue','green'];
  const FALLBACK={
    yellow:{key:'yellow',name:'GOUD',emoji:'🟡',hex:'#FFCC33',input:'cat-yellow'},
    pink:{key:'pink',name:'AQUA',emoji:'🩵',hex:'#00D4C7',input:'cat-pink'},
    purple:{key:'purple',name:'ORANJE',emoji:'🟠',hex:'#FF8A1F',input:'cat-purple'},
    blue:{key:'blue',name:'LIME',emoji:'🟢',hex:'#7ED957',input:'cat-blue'},
    green:{key:'green',name:'KORAAL',emoji:'🔴',hex:'#FF5A5F',input:'cat-green'}
  };
  let raf=null;
  let activeKey='';
  let boundRoom='';

  function colorObj(key){
    const base=FALLBACK[key]||FALLBACK.yellow;
    const fromColors=(typeof COLORS!=='undefined'&&Array.isArray(COLORS))?COLORS.find(c=>c.key===key):null;
    return {...base,...(fromColors||{})};
  }
  function pickColor(){
    if(typeof COLORS!=='undefined'&&Array.isArray(COLORS)&&COLORS.length){
      const c=COLORS[Math.floor(Math.random()*COLORS.length)];
      return colorObj(c.key);
    }
    return colorObj(KEYS[Math.floor(Math.random()*KEYS.length)]);
  }
  function categoryFor(c){try{return q(c.input)?.value||'Geen categorie'}catch(_){return 'Geen categorie'}}
  function easeOutCubic(t){return 1-Math.pow(1-t,3)}
  function cancel(){if(raf){cancelAnimationFrame(raf);raf=null}}

  function hideOld(){
    document.querySelectorAll('#bbIntroOverlayV131,#bbWheelFullOverlayV92,#bbWheelV123Overlay,#bbWheelV125Overlay,.bbWheelFullCardV92,.bbWheelInlineV110,.bbWheelInlineV121,.bbWheelInlineV122,.bbWheelInlineV123,.bbWheelHostStatusV125,.bbWheelHostResultV125,.wheelWrap,.wheel,.showWheel,.dashWheel,.bbCarouselWindowV131,.bbLightRingV131').forEach(el=>{
      if(el.id==='bbDjPadsOverlayV136')return;
      el.style.setProperty('display','none','important');
      el.style.setProperty('visibility','hidden','important');
      el.classList?.add?.('hidden');
    });
  }
  function overlay(){
    let o=q('bbDjPadsOverlayV136');
    if(!o){o=document.createElement('div');o.id='bbDjPadsOverlayV136';o.className='bbDjPadsOverlayV136 hidden';document.body.appendChild(o)}
    return o;
  }
  function hideDj(){cancel();activeKey='';const o=q('bbDjPadsOverlayV136');if(o){o.classList.add('hidden');o.classList.remove('show');o.innerHTML=''}}

  function padsHTML(roundId){
    return `<div class="bbDjPadsCardV136" data-round="${E(roundId||'')}">
      <div class="bbDjPadsTitleV136">Categorie wordt gekozen...</div>
      <div class="bbDjMixerV136">
        ${KEYS.map(k=>{const c=colorObj(k);return `<div class="bbDjPadV136" data-key="${E(k)}" style="--pad:${E(c.hex)}"><div class="bbDjPadEmojiV136">${E(c.emoji)}</div><div class="bbDjPadNameV136">${E(c.name)}</div></div>`}).join('')}
      </div>
      <div class="bbDjBeatV136"><span></span><span></span><span></span><span></span><span></span></div>
      <div class="bbDjPadsSubV136">DJ kiest de categorie...</div>
    </div>`;
  }
  function resultHTML(c,cat){
    return `<div class="bbDjPadsResultV136" style="--pad:${E(c.hex)}">
      <div class="bbDjResultDotV136"></div>
      <div class="bbDjResultNameV136">${E(c.emoji)} ${E(c.name)}</div>
      <div class="bbDjResultCatV136">${E(cat||'')}</div>
    </div>`;
  }
  function setActive(o,key,final=false){
    o.querySelectorAll('.bbDjPadV136').forEach(p=>p.classList.remove('active','final','near'));
    o.querySelectorAll('.bbDjPadV136').forEach(p=>{
      if(p.dataset.key===key){p.classList.add('active');if(final)p.classList.add('final')}
    });
  }
  function showDj(roundId,targetKey,startedAt){
    hideOld();
    const introKey=`${roundId||''}:${targetKey||''}`;
    const o=overlay();
    if(activeKey!==introKey || !o.classList.contains('show')){
      cancel(); activeKey=introKey; o.innerHTML=padsHTML(roundId); o.classList.remove('hidden'); o.classList.add('show');
    }
    const start=Number(startedAt)||Date.now();
    const targetIdx=Math.max(0,KEYS.indexOf(targetKey));
    const totalSteps=65+targetIdx; // 13 rondes + gekozen kleur, eindigt altijd exact op doel
    let last=-1;
    function frame(){
      const t=Math.min(1,(Date.now()-start)/INTRO_MS);
      const e=easeOutCubic(t);
      const step=Math.min(totalSteps,Math.floor(e*totalSteps));
      if(step!==last){last=step;setActive(o,KEYS[step%KEYS.length],t>=1)}
      if(t<1)raf=requestAnimationFrame(frame);else{setActive(o,targetKey,true);raf=null;}
    }
    cancel(); raf=requestAnimationFrame(frame);
  }
  function showDjResult(c,cat){
    cancel();hideOld();activeKey='result';
    const o=overlay();o.innerHTML=resultHTML(c,cat);o.classList.remove('hidden');o.classList.add('show');
    try{if(navigator.vibrate)navigator.vibrate(35)}catch(_e){}
  }

  function currentRoom(){return (window.currentRoomCode||currentRoomCode||new URLSearchParams(location.search).get('room')||localStorage.hb_player_room||localStorage.hb_host_room||'').toUpperCase()}
  function attachListener(){
    try{
      if(!db)return; const room=currentRoom(); if(!room||room===boundRoom)return;
      if(boundRoom)db.ref('rooms/'+boundRoom+'/currentRound').off('value.bbDjV136');
      boundRoom=room;
      db.ref('rooms/'+room+'/currentRound').on('value.bbDjV136',s=>{
        const r=s.val()||{}; hideOld();
        if(r.status==='picking' && r.pickerMode==='djPadsV136'){
          showDj(r.id||'',r.pendingColorKey||r.colorKey||'yellow',r.pickerStartedAt||Date.now());
          if(q('hostPickerArea'))q('hostPickerArea').innerHTML='<div class="bbDjHostStatusV136">Categorie wordt gekozen...</div>';
        }else if(r.status==='precount' || r.status==='ready' || r.status==='answering' || r.status==='locked' || r.status==='judged'){
          hideDj();
        }
      });
    }catch(_e){}
  }

  // Negeer oude intro-API's volledig.
  window.__bbWheelV92={showWheelFull:()=>{},showWheelResult:()=>{},hideWheelFull:()=>{}};
  window.__bbWheelV110={showWheelV110:()=>{},showResultV110:()=>{},hideWheelV110:()=>{},wheelHTMLV110:()=>''};
  window.__bbWheelV119={showWheel:()=>{},showResult:()=>{},hideWheel:()=>{},wheelHTML:()=>'',resultHTML:()=>''};
  window.__bbWheelFixedV121={showIndex:()=>{},showKey:()=>{},showResult:()=>{},hide:()=>{},htmlWheel:()=>'',htmlResult:()=>''};
  window.__bbIntroV131={showIntro:()=>{},showResult:()=>{},hideIntro:hideDj};
  window.__bbDjPadsV136={showDj,showDjResult,hideDj};
  if(typeof pickerHTML==='function') pickerHTML=()=>'<div class="bbDjHostStatusV136">Categorie wordt gekozen...</div>';

  // Nieuwe enige startflow: DJ pads -> resultaat -> precount -> muziek.
  startRoundVisual=function(room){
    hideDj();hideOld();
    if(q('hostAnswerArea'))q('hostAnswerArea').innerHTML='';
    if(q('playBtn')){q('playBtn').disabled=true;q('playBtn').textContent='🎵 Nummer start zo...'}
    if(q('showAnswerBtn'))q('showAnswerBtn').disabled=true;
    if(q('hostPickerArea'))q('hostPickerArea').innerHTML='<div class="bbDjHostStatusV136">Categorie wordt gekozen...</div>';

    const color=pickColor();
    const cat=categoryFor(color);
    currentRoundId='r_'+Date.now();
    const roundId=currentRoundId;
    db.ref('rooms/'+room+'/currentRound').set({
      id:roundId,
      status:'picking',
      pickerMode:'djPadsV136',
      pendingColorKey:color.key,
      pendingColorName:color.name,
      pendingColorEmoji:color.emoji,
      pendingCategory:cat,
      pickerStartedAt:firebase.database.ServerValue.TIMESTAMP,
      seconds:Number(q('duration')?.value)||20
    }).then(()=>{
      // Firebase listener toont hem ook, maar host direct starten voorkomt lege wachttijd.
      showDj(roundId,color.key,Date.now());
    });

    setTimeout(()=>{
      showDjResult(color,cat);
      if(q('hostPickerArea'))q('hostPickerArea').innerHTML=`<div class="bbDjHostResultV136">${E(color.emoji)} ${E(color.name)}<br><span>${E(cat)}</span></div>`;
      const ends=Date.now()+3000;
      db.ref('rooms/'+room+'/currentRound').set({
        id:roundId,
        status:'precount',
        pickerMode:'djPadsV136',
        colorKey:color.key,
        colorName:color.name,
        colorEmoji:color.emoji,
        category:cat,
        seconds:Number(q('duration')?.value)||20,
        precountStartedAt:firebase.database.ServerValue.TIMESTAMP,
        precountEndsAt:ends
      }).then(()=>{
        q('hostScorePanel')?.classList.remove('hidden');
        if(q('hostStatus'))q('hostStatus').textContent='Categorie gekozen. 3-2-1... daarna start het nummer.';
        setTimeout(()=>{hideDj(); if(typeof playHidden==='function')playHidden();},3000);
      });
    },INTRO_MS);
  };

  // Spelerscherm: bij picking altijd DJ pads tonen en niets anders.
  if(typeof renderCompactDashboard==='function'){
    const previous=renderCompactDashboard;
    renderCompactDashboard=function(room,r){
      hideOld();
      if(r&&r.status==='picking'&&r.pickerMode==='djPadsV136'){
        const root=q('screenDashboard');
        if(root){document.body.classList.add('bbStageMode');root.className='compactDashboard bbStageDashboard stageIntroV136';root.innerHTML='<section class="bbDjPlayerStatusV136">Categorie wordt gekozen...</section>'}
        showDj(r.id||'',r.pendingColorKey||'yellow',r.pickerStartedAt||Date.now());
        return;
      }
      if(!r || r.status!=='picking') hideDj();
      return previous?previous(room,r):null;
    };
  }

  document.addEventListener('DOMContentLoaded',()=>setTimeout(attachListener,250));
  setInterval(()=>{attachListener();hideOld()},700);
})();

/* =========================
   V137 - DJ Pads INLINE enige picking-scherm
   Fix: geen losse overlay meer die kan verdwijnen; host en speler tonen DJ pads direct in hun actieve scherm.
   ========================= */
(function(){
  const q=id=>document.getElementById(id);
  const E=s=>(typeof esc==='function'?esc(String(s??'')):String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])));
  const INTRO_MS=12000;
  const KEYS=['yellow','pink','purple','blue','green'];
  const DEF={
    yellow:{key:'yellow',name:'GOUD',emoji:'🟡',hex:'#FFCC33',input:'cat-yellow'},
    pink:{key:'pink',name:'AQUA',emoji:'🩵',hex:'#00D4C7',input:'cat-pink'},
    purple:{key:'purple',name:'ORANJE',emoji:'🟠',hex:'#FF8A1F',input:'cat-purple'},
    blue:{key:'blue',name:'LIME',emoji:'🟢',hex:'#7ED957',input:'cat-blue'},
    green:{key:'green',name:'KORAAL',emoji:'🔴',hex:'#FF5A5F',input:'cat-green'}
  };
  let inlineTimers={};
  function col(key){
    const from=(typeof COLORS!=='undefined'&&Array.isArray(COLORS))?COLORS.find(c=>c.key===key):null;
    return {...(DEF[key]||DEF.yellow),...(from||{})};
  }
  function pickCol(){
    if(typeof COLORS!=='undefined'&&Array.isArray(COLORS)&&COLORS.length){return col(COLORS[Math.floor(Math.random()*COLORS.length)].key)}
    return col(KEYS[Math.floor(Math.random()*KEYS.length)]);
  }
  function catFor(c){try{return q(c.input)?.value||'Geen categorie'}catch(_){return 'Geen categorie'}}
  function stopInline(id){ if(inlineTimers[id]){clearInterval(inlineTimers[id]); delete inlineTimers[id];} }
  function hideAllOld(){
    // Verberg alleen oude rad/carrousel/licht/overlay elementen, nooit de inline DJ pads.
    document.querySelectorAll('#bbDjPadsOverlayV136,#bbIntroOverlayV131,#bbWheelFullOverlayV92,#bbWheelV123Overlay,#bbWheelV125Overlay,.bbWheelFullCardV92,.bbWheelInlineV110,.bbWheelInlineV121,.bbWheelInlineV122,.bbWheelInlineV123,.bbWheelHostStatusV125,.bbWheelHostResultV125,.wheelWrap,.wheel,.showWheel,.dashWheel,.bbCarouselWindowV131,.bbLightRingV131').forEach(el=>{
      el.style.setProperty('display','none','important');
      el.style.setProperty('visibility','hidden','important');
      el.classList?.add?.('hidden');
    });
  }
  function djInlineHTML(targetKey, roundId, size){
    const target=col(targetKey||'yellow');
    return `<div class="bbDjInlineV137 ${size==='host'?'host':'player'}" data-target="${E(target.key)}" data-round="${E(roundId||'')}">
      <div class="bbDjInlineTitleV137">Categorie wordt gekozen...</div>
      <div class="bbDjInlineMixerV137">
        ${KEYS.map(k=>{const c=col(k);return `<div class="bbDjInlinePadV137" data-key="${E(k)}" style="--pad:${E(c.hex)}"><div class="bbDjInlineEmojiV137">${E(c.emoji)}</div><div class="bbDjInlineNameV137">${E(c.name)}</div></div>`}).join('')}
      </div>
      <div class="bbDjInlineBarsV137"><span></span><span></span><span></span><span></span><span></span></div>
      <div class="bbDjInlineSubV137">DJ kiest de categorie...</div>
    </div>`;
  }
  function djResultHTML(key, cat){
    const c=col(key||'yellow');
    return `<div class="bbDjInlineResultV137" style="--pad:${E(c.hex)}"><div class="bbDjInlineResultDotV137"></div><div class="bbDjInlineResultNameV137">${E(c.emoji)} ${E(c.name)}</div><div class="bbDjInlineResultCatV137">${E(cat||'')}</div></div>`;
  }
  function runInline(container, targetKey, startedAt, roundId){
    if(!container)return;
    hideAllOld();
    const box=container.querySelector('.bbDjInlineV137');
    if(!box)return;
    const timerId=(container.id||'dj')+'_'+(roundId||'');
    stopInline(timerId);
    const start=Number(startedAt)||Date.now();
    const targetIdx=Math.max(0,KEYS.indexOf(targetKey||'yellow'));
    const totalSteps=65+targetIdx;
    function set(k,final){
      box.querySelectorAll('.bbDjInlinePadV137').forEach(p=>p.classList.remove('active','final'));
      box.querySelectorAll('.bbDjInlinePadV137').forEach(p=>{if(p.dataset.key===k){p.classList.add('active'); if(final)p.classList.add('final')}});
    }
    const tick=()=>{
      const t=Math.min(1,(Date.now()-start)/INTRO_MS);
      const e=1-Math.pow(1-t,3);
      const step=Math.min(totalSteps,Math.floor(e*totalSteps));
      const k=t>=1?(targetKey||'yellow'):KEYS[step%KEYS.length];
      set(k,t>=1);
      if(t>=1)stopInline(timerId);
    };
    tick();
    inlineTimers[timerId]=setInterval(tick,80);
  }

  // Oude animatie API's neutraal maken.
  window.__bbWheelV92={showWheelFull:()=>{},showWheelResult:()=>{},hideWheelFull:()=>{}};
  window.__bbWheelV110={showWheelV110:()=>{},showResultV110:()=>{},hideWheelV110:()=>{},wheelHTMLV110:()=>''};
  window.__bbWheelV119={showWheel:()=>{},showResult:()=>{},hideWheel:()=>{},wheelHTML:()=>'',resultHTML:()=>''};
  window.__bbWheelFixedV121={showIndex:()=>{},showKey:()=>{},showResult:()=>{},hide:()=>{},htmlWheel:()=>'',htmlResult:()=>''};
  window.__bbIntroV131={showIntro:()=>{},showResult:()=>{},hideIntro:()=>{}};
  window.__bbDjPadsV136={showDj:()=>{},showDjResult:()=>{},hideDj:()=>{}};
  if(typeof pickerHTML==='function') pickerHTML=()=>djInlineHTML('yellow','', 'host');

  // Enige startflow: DJ pads inline -> resultaat -> precount -> muziek.
  startRoundVisual=function(room){
    hideAllOld();
    if(q('hostAnswerArea'))q('hostAnswerArea').innerHTML='';
    if(q('playBtn')){q('playBtn').disabled=true;q('playBtn').textContent='🎵 Nummer start zo...'}
    if(q('showAnswerBtn'))q('showAnswerBtn').disabled=true;
    const color=pickCol();
    const cat=catFor(color);
    currentRoundId='r_'+Date.now();
    const roundId=currentRoundId;
    if(q('hostPickerArea')){q('hostPickerArea').innerHTML=djInlineHTML(color.key,roundId,'host');runInline(q('hostPickerArea'),color.key,Date.now(),roundId)}
    db.ref('rooms/'+room+'/currentRound').set({
      id:roundId,status:'picking',pickerMode:'djPadsV137',
      pendingColorKey:color.key,pendingColorName:color.name,pendingColorEmoji:color.emoji,pendingCategory:cat,
      pickerStartedAt:firebase.database.ServerValue.TIMESTAMP,seconds:Number(q('duration')?.value)||20
    });
    setTimeout(()=>{
      if(q('hostPickerArea'))q('hostPickerArea').innerHTML=djResultHTML(color.key,cat);
      const ends=Date.now()+3000;
      db.ref('rooms/'+room+'/currentRound').set({
        id:roundId,status:'precount',pickerMode:'djPadsV137',
        colorKey:color.key,colorName:color.name,colorEmoji:color.emoji,category:cat,
        seconds:Number(q('duration')?.value)||20,precountStartedAt:firebase.database.ServerValue.TIMESTAMP,precountEndsAt:ends
      }).then(()=>{
        q('hostScorePanel')?.classList.remove('hidden');
        if(q('hostStatus'))q('hostStatus').textContent='Categorie gekozen. 3-2-1... daarna start het nummer.';
        setTimeout(()=>{hideAllOld();if(typeof playHidden==='function')playHidden();},3000);
      });
    },INTRO_MS);
  };

  // Speler: bij status picking altijd inline DJ pads in het echte spelersscherm.
  if(typeof renderCompactDashboard==='function'){
    const prevV137=renderCompactDashboard;
    renderCompactDashboard=function(room,r){
      hideAllOld();
      if(r && r.status==='picking'){
        const root=q('screenDashboard');
        const target=r.pendingColorKey||r.colorKey||'yellow';
        if(root){
          document.body.classList.add('bbStageMode');
          root.className='compactDashboard bbStageDashboard stageIntroV137';
          root.innerHTML=`<section id="bbDjPlayerInlineMountV137" class="bbDjPlayerInlineMountV137">${djInlineHTML(target,r.id||'', 'player')}</section>`;
          runInline(q('bbDjPlayerInlineMountV137'),target,r.pickerStartedAt||Date.now(),r.id||'');
        }
        return;
      }
      return prevV137?prevV137(room,r):null;
    };
  }
})();

/* =========================
   V138 - SINGLE SOURCE DJ PADS FIX
   Fixes category mismatch: engine chooses one color once, DJ animation only reads that color.
   ========================= */
(function(){
  const $id=id=>document.getElementById(id);
  const E=s=>(typeof esc==='function'?esc(String(s??'')):String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])));
  const KEYS=['yellow','pink','purple','blue','green'];
  const FALLBACK={
    yellow:{key:'yellow',name:'GOUD',emoji:'🟡',hex:'#FFCC33',input:'cat-yellow'},
    pink:{key:'pink',name:'AQUA',emoji:'🩵',hex:'#00D4C7',input:'cat-pink'},
    purple:{key:'purple',name:'ORANJE',emoji:'🟠',hex:'#FF8A1F',input:'cat-purple'},
    blue:{key:'blue',name:'LIME',emoji:'🟢',hex:'#7ED957',input:'cat-blue'},
    green:{key:'green',name:'KORAAL',emoji:'🔴',hex:'#FF5A5F',input:'cat-green'}
  };
  const INTRO_MS=12000;
  const rafs=new WeakMap();
  function colorObj(key){
    const from=(typeof COLORS!=='undefined'&&Array.isArray(COLORS))?COLORS.find(c=>c.key===key):null;
    return {...(FALLBACK[key]||FALLBACK.yellow),...(from||{})};
  }
  function chooseColorOnce(){
    const list=(typeof COLORS!=='undefined'&&Array.isArray(COLORS)&&COLORS.length)?COLORS.map(c=>c.key):KEYS;
    return colorObj(list[Math.floor(Math.random()*list.length)]||'yellow');
  }
  function categoryForColor(c){try{return $id(c.input)?.value||'Geen categorie'}catch(_){return 'Geen categorie'}}
  function hideLegacy(){
    document.querySelectorAll('#bbDjPadsOverlayV136,#bbIntroOverlayV131,#bbWheelFullOverlayV92,#bbWheelV123Overlay,#bbWheelV125Overlay,.bbWheelFullCardV92,.bbWheelInlineV110,.bbWheelInlineV121,.bbWheelInlineV122,.bbWheelInlineV123,.bbWheelHostStatusV125,.bbWheelHostResultV125,.wheelWrap,.wheel,.showWheel,.dashWheel,.bbCarouselWindowV131,.bbLightRingV131').forEach(el=>{
      if(el.closest('.bbDjFinalV138')) return;
      el.style.setProperty('display','none','important');
      el.style.setProperty('visibility','hidden','important');
      el.classList?.add?.('hidden');
    });
  }
  function html(targetKey, roundId){
    return `<div class="bbDjFinalV138" data-target="${E(targetKey)}" data-round="${E(roundId||'')}">
      <div class="bbDjFinalTitleV138">Categorie wordt gekozen...</div>
      <div class="bbDjFinalPadsV138">
        ${KEYS.map(k=>{const c=colorObj(k);return `<div class="bbDjFinalPadV138" data-key="${E(k)}" style="--pad:${E(c.hex)}"><div>${E(c.emoji)}</div><strong>${E(c.name)}</strong></div>`}).join('')}
      </div>
      <div class="bbDjFinalBarsV138"><span></span><span></span><span></span><span></span><span></span></div>
      <div class="bbDjFinalSubV138">DJ kiest de categorie...</div>
    </div>`;
  }
  function resultHtml(key,cat){
    const c=colorObj(key);
    return `<div class="bbDjFinalResultV138" style="--pad:${E(c.hex)}"><div class="bbDjFinalDotV138"></div><div class="bbDjFinalNameV138">${E(c.emoji)} ${E(c.name)}</div><div class="bbDjFinalCatV138">${E(cat||'')}</div></div>`;
  }
  function setPad(mount,key,final){
    const box=mount?.querySelector?.('.bbDjFinalV138'); if(!box) return;
    box.querySelectorAll('.bbDjFinalPadV138').forEach(p=>p.classList.remove('active','final','near'));
    box.querySelectorAll('.bbDjFinalPadV138').forEach(p=>{if(p.dataset.key===key){p.classList.add('active');if(final)p.classList.add('final')}});
  }
  function run(mount,targetKey,startedAt,roundId){
    if(!mount) return;
    hideLegacy();
    if(!mount.querySelector('.bbDjFinalV138') || mount.querySelector('.bbDjFinalV138')?.dataset.round!==String(roundId||'')){
      mount.innerHTML=html(targetKey,roundId);
    }
    const old=rafs.get(mount); if(old) cancelAnimationFrame(old);
    const start=Number(startedAt)||Date.now();
    const targetIdx=Math.max(0,KEYS.indexOf(targetKey));
    const steps=(KEYS.length*15)+targetIdx; // exact eindigt op targetKey
    let lastKey='';
    const ease=t=>1-Math.pow(1-t,3);
    function frame(){
      const t=Math.min(1,(Date.now()-start)/INTRO_MS);
      // Laatste 350ms altijd op de doelkleur vastzetten. Geen nabeweging, geen mismatch.
      const final=t>=0.97;
      const key=final?targetKey:KEYS[Math.floor(ease(t)*steps)%KEYS.length];
      if(key!==lastKey || final){setPad(mount,key,final);lastKey=key;}
      if(t<1){const id=requestAnimationFrame(frame);rafs.set(mount,id);}else{setPad(mount,targetKey,true);rafs.delete(mount);}
    }
    frame();
  }
  function renderPlayerPicking(r){
    const root=$id('screenDashboard'); if(!root) return;
    document.body.classList.add('bbStageMode');
    root.className='compactDashboard bbStageDashboard stageIntroV138';
    const key=r.pendingColorKey||r.colorKey||'yellow';
    const roundId=r.id||'';
    const existing=$id('bbDjFinalPlayerMountV138');
    if(!existing || existing.dataset.round!==String(roundId)){
      root.innerHTML=`<section id="bbDjFinalPlayerMountV138" class="bbDjFinalPlayerMountV138" data-round="${E(roundId)}"></section>`;
    }
    run($id('bbDjFinalPlayerMountV138'),key,r.pickerStartedAt||Date.now(),roundId);
  }
  function renderHostPicking(r){
    const mount=$id('hostPickerArea'); if(!mount) return;
    const key=r.pendingColorKey||r.colorKey||'yellow';
    run(mount,key,r.pickerStartedAt||Date.now(),r.id||'');
  }

  // Zet oude animatie-API's neutraal.
  window.__bbWheelV92={showWheelFull:()=>{},showWheelResult:()=>{},hideWheelFull:()=>{}};
  window.__bbWheelV110={showWheelV110:()=>{},showResultV110:()=>{},hideWheelV110:()=>{},wheelHTMLV110:()=>''};
  window.__bbWheelV119={showWheel:()=>{},showResult:()=>{},hideWheel:()=>{},wheelHTML:()=>'',resultHTML:()=>''};
  window.__bbWheelFixedV121={showIndex:()=>{},showKey:()=>{},showResult:()=>{},hide:()=>{},htmlWheel:()=>'',htmlResult:()=>''};
  window.__bbIntroV131={showIntro:()=>{},showResult:()=>{},hideIntro:()=>{}};
  window.__bbDjPadsV136={showDj:()=>{},showDjResult:()=>{},hideDj:()=>{}};
  if(typeof pickerHTML==='function') pickerHTML=()=>'<div class="bbDjFinalHostStatusV138">Categorie wordt gekozen...</div>';

  // Startflow: kies kleur ÉÉN keer en sla die meteen als enige waarheid op in Firebase.
  startRoundVisual=function(room){
    hideLegacy();
    if($id('hostAnswerArea')) $id('hostAnswerArea').innerHTML='';
    if($id('playBtn')){$id('playBtn').disabled=true;$id('playBtn').textContent='🎵 Nummer start zo...'}
    if($id('showAnswerBtn')) $id('showAnswerBtn').disabled=true;
    const color=chooseColorOnce();
    const cat=categoryForColor(color);
    currentRoundId='r_'+Date.now();
    const roundId=currentRoundId;
    const started=Date.now();
    // BELANGRIJK: colorKey/category staan al tijdens picking vast. Animatie en spel lezen dezelfde velden.
    const round={
      id:roundId,status:'picking',pickerMode:'djPadsV138',
      colorKey:color.key,colorName:color.name,colorEmoji:color.emoji,category:cat,
      pendingColorKey:color.key,pendingColorName:color.name,pendingColorEmoji:color.emoji,pendingCategory:cat,
      pickerStartedAt:started,seconds:Number($id('duration')?.value)||20
    };
    if($id('hostPickerArea')) run($id('hostPickerArea'),color.key,started,roundId);
    db.ref('rooms/'+room+'/currentRound').set(round);
    setTimeout(()=>{
      if($id('hostPickerArea')) $id('hostPickerArea').innerHTML=resultHtml(color.key,cat);
      const ends=Date.now()+3000;
      db.ref('rooms/'+room+'/currentRound').update({
        status:'precount',pickerMode:'djPadsV138',
        colorKey:color.key,colorName:color.name,colorEmoji:color.emoji,category:cat,
        precountStartedAt:Date.now(),precountEndsAt:ends
      }).then(()=>{
        $id('hostScorePanel')?.classList.remove('hidden');
        if($id('hostStatus')) $id('hostStatus').textContent='Categorie gekozen. 3-2-1... daarna start het nummer.';
        setTimeout(()=>{hideLegacy(); if(typeof playHidden==='function') playHidden();},3000);
      });
    },INTRO_MS);
  };

  if(typeof renderCompactDashboard==='function'){
    const prev=renderCompactDashboard;
    renderCompactDashboard=function(room,r){
      hideLegacy();
      if(r && r.status==='picking'){
        renderPlayerPicking(r);
        return;
      }
      return prev?prev(room,r):null;
    };
  }
  let bound='';
  function bind(){
    try{
      if(!db) return;
      const room=(window.currentRoomCode||currentRoomCode||new URLSearchParams(location.search).get('room')||localStorage.hb_player_room||localStorage.hb_host_room||'').toUpperCase();
      if(!room||room===bound) return;
      if(bound) db.ref('rooms/'+bound+'/currentRound').off('value.bbV138');
      bound=room;
      db.ref('rooms/'+room+'/currentRound').on('value.bbV138',s=>{
        const r=s.val()||{};
        hideLegacy();
        if(r.status==='picking'){
          if($id('hostPickerArea') && !document.body.classList.contains('playerMode')) renderHostPicking(r);
        }
      });
    }catch(_e){}
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(bind,250));
  setInterval(()=>{bind();hideLegacy();},800);
})();

/* =========================
   V139 - Antwoordscherm + Scoreboard flow
   - Na tijd op: spelers zien JUIST ANTWOORD met TITEL / ARTIEST / JAAR en knop VERDER
   - Daarna scoreboard deze ronde
   - Bij twijfel eerst jury beoordelen
   - Daarna knop NAAR BINGOKAART of NAAR LOBBY
   - Lobby: Klaar voor de volgende? + OKAY, LET'S GO?!
   ========================= */
(function(){
  const q = id => document.getElementById(id);
  const E = s => (typeof esc === 'function' ? esc(String(s ?? '')) : String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])));
  const HEX = {yellow:'#FFCC33', pink:'#00D4C7', purple:'#FF8A1F', blue:'#7ED957', green:'#FF5A5F', free:'#141414'};
  const LABEL = {yellow:'GOUD', pink:'AQUA', purple:'ORANJE', blue:'LIME', green:'KORAAL', free:'BB'};

  function players(room){ return Object.entries(room?.players || {}); }
  function me(room){ return room?.players?.[currentPlayerId] || {}; }
  function storageKey(type,r){ return 'bb_v139_'+type+'_'+(r?.id||''); }
  function seen(type,r){ try{return sessionStorage.getItem(storageKey(type,r))==='1'}catch(e){return false} }
  function setSeen(type,r){ try{sessionStorage.setItem(storageKey(type,r),'1')}catch(e){} }
  function answerStatus(room,r,pid){ return r?.id ? (room.correct?.[r.id]?.[pid]) : undefined; }
  function ownStatus(room,r){ return answerStatus(room,r,currentPlayerId); }
  function pickedThisRound(room,r){ const p=me(room); return !!(r?.id && p.lastPickedRound===r.id); }
  function answerTime(room,r,pid){
    const ans = r?.id ? room.answers?.[r.id]?.[pid] : null;
    if(!ans?.submittedAt) return '';
    let start = Number(r.musicStartedAt || 0);
    if(!start && r.deadlineMs && r.seconds) start = Number(r.deadlineMs) - (Number(r.seconds)||20)*1000;
    if(!start || !Number.isFinite(start)) return '';
    const sec = Math.max(0,(Number(ans.submittedAt)-start)/1000);
    if(!Number.isFinite(sec)) return '';
    return sec < 10 ? sec.toFixed(1)+' sec' : Math.round(sec)+' sec';
  }
  function rerender(){
    try{
      if(!currentRoomCode || !db || typeof renderCompactDashboard !== 'function') return;
      db.ref('rooms/'+currentRoomCode).once('value').then(s=>{const room=s.val()||{}; renderCompactDashboard(room, room.currentRound||{});});
    }catch(e){}
  }
  window.bbV139SeenAnswer = function(roundId){
    setSeen('answer',{id:roundId});
    rerender();
  };
  window.bbV139SeenScore = function(roundId){
    setSeen('score',{id:roundId});
    try{ if(currentRoomCode && currentPlayerId) db.ref('rooms/'+currentRoomCode+'/players/'+currentPlayerId+'/ready').set(false); }catch(e){}
    rerender();
  };
  window.bbV139Ready = function(){
    try{ if(currentRoomCode && currentPlayerId) db.ref('rooms/'+currentRoomCode+'/players/'+currentPlayerId+'/ready').set(true); }catch(e){}
  };

  function stage(root, cls, html){
    document.body.classList.add('bbStageMode');
    root.className = 'compactDashboard bbStageDashboard '+cls;
    root.innerHTML = `<section class="bbStageShell bbV139Shell">${html}</section>`;
  }
  function correctAnswerScreen(root,r){
    const a = r?.correctAnswer || {};
    stage(root,'stageCorrectV139',`
      <div class="bbV139AnswerCard">
        <div class="bbV139Eyebrow">🎵 JUIST ANTWOORD</div>
        <div class="bbV139AnswerLine"><span>TITEL</span><strong>${E(a.track||'-')}</strong></div>
        <div class="bbV139AnswerLine"><span>ARTIEST</span><strong>${E(a.artist||'-')}</strong></div>
        <div class="bbV139AnswerLine"><span>JAAR</span><strong>${E(a.year||'-')}</strong></div>
        <button type="button" class="bbV139MainBtn" onclick="bbV139SeenAnswer('${E(r.id||'')}')">VERDER</button>
      </div>
    `);
  }
  function statusText(st){
    if(st === true) return {cls:'good', icon:'✅', label:'GOED'};
    if(st === false) return {cls:'bad', icon:'❌', label:'FOUT'};
    if(st === 'review') return {cls:'review', icon:'🤔', label:'TWIJFEL'};
    return {cls:'wait', icon:'…', label:'WACHT'};
  }
  function scoreScreen(root,room,r){
    const cor = r?.id ? (room.correct?.[r.id] || {}) : {};
    const ans = r?.id ? (room.answers?.[r.id] || {}) : {};
    const own = ownStatus(room,r);
    const hasReview = Object.values(cor).some(v=>v==='review') || r.status === 'review';
    let btn = '';
    if(hasReview){
      btn = `<button type="button" class="bbV139MainBtn review" onclick="bbV139SeenScore('${E(r.id||'')}')">BEOORDEEL TWIJFELGEVALLEN</button>`;
    }else if(own === true){
      btn = `<button type="button" class="bbV139MainBtn" onclick="bbV139SeenScore('${E(r.id||'')}')">NAAR BINGOKAART</button>`;
    }else{
      btn = `<button type="button" class="bbV139MainBtn lobby" onclick="bbV139SeenScore('${E(r.id||'')}')">NAAR LOBBY</button>`;
    }
    const rows = players(room).map(([pid,p])=>{
      const st = statusText(cor[pid]);
      const text = ans[pid]?.answer ? String(ans[pid].answer).trim() : 'Geen antwoord';
      const t = answerTime(room,r,pid);
      return `<div class="bbV139ScoreRow ${st.cls}">
        <div class="bbV139Avatar">${E((p.name||'?').trim().slice(0,1).toUpperCase())}</div>
        <div class="bbV139Who"><strong>${E(p.name||'Speler')}${pid===currentPlayerId?' <em>jij</em>':''}</strong><span>${E(text)}</span>${t?`<small>⏱ Antwoordtijd: ${E(t)}</small>`:''}</div>
        <div class="bbV139State"><b>${st.icon}</b><span>${st.label}</span></div>
      </div>`;
    }).join('');
    const a = r?.correctAnswer || {};
    stage(root,'stageScoreV139',`
      <div class="bbV139SmallAnswer"><span>JUIST ANTWOORD</span><strong>${E(a.track||'-')}</strong><small>${E(a.artist||'-')}${a.year?' • '+E(a.year):''}</small></div>
      <h2>SCOREBOARD DEZE RONDE</h2>
      <div class="bbV139ScoreList">${rows}</div>
      ${btn}
    `);
  }
  function cardHTML(room){
    const p = me(room), c=p.card||[], marked=p.marked||{};
    const cells = Array.from({length:25},(_,i)=>{
      const raw = c[i] || (i===12?'free':'yellow');
      const key = (i===12 || raw==='free') ? 'free' : raw;
      const mark = !!marked[i] || key==='free';
      return `<div class="bbV139Cell ${mark?'marked':''}" style="--cell:${HEX[key]||'#777'};background:${HEX[key]||'#777'}">${mark?'<span>BB</span>':''}</div>`;
    }).join('');
    return `<div class="bbV139MiniCard">${cells}</div>`;
  }
  function lobbyScreen(root,room){
    const rows = players(room).map(([pid,p])=>`<div class="bbV139ReadyRow ${p.ready?'ready':'wait'}"><strong>${E(p.name||'Speler')}${pid===currentPlayerId?' <em>jij</em>':''}</strong><span>${p.ready?'READY':'Wacht'}</span></div>`).join('');
    const p=me(room);
    stage(root,'stageLobbyV139',`
      <h2>Klaar voor de volgende?</h2>
      <div class="bbV139Lets">OKAY, LET'S GO?!</div>
      <div class="bbV139ReadyList">${rows || '<div class="small">Nog geen spelers.</div>'}</div>
      ${cardHTML(room)}
      ${p.ready?'<button class="bbV139MainBtn isReady" disabled>READY ✓</button>':'<button class="bbV139MainBtn" onclick="bbV139Ready()">READY</button>'}
    `);
  }

  if(typeof renderCompactDashboard === 'function'){
    const previousV139 = renderCompactDashboard;
    renderCompactDashboard = function(room,r){
      const root = q('screenDashboard');
      if(!root) return;
      const isEnd = r && r.id && ['locked','review','judged'].includes(r.status);
      if(isEnd){
        if(!seen('answer',r)) return correctAnswerScreen(root,r);
        if(!seen('score',r)) return scoreScreen(root,room,r);
        if(r.status === 'review') return previousV139 ? previousV139(room,r) : null;
        const st = ownStatus(room,r);
        if(st === true && !pickedThisRound(room,r)) return previousV139 ? previousV139(room,r) : null;
        return lobbyScreen(root,room);
      }
      return previousV139 ? previousV139(room,r) : null;
    };
  }
})();

/* =========================
   V140 - Flow polish
   - Live antwoorden: geen groen vinkje meer voordat er beoordeeld is
   - Na bingovakje kiezen eerst VERDER, daarna lobby + READY
   - Lobby terug naar lijst met READY/Wacht, geen grote bingokaart
   - Juist antwoord + scoreboard compacter
   - Bingokaart vakjes altijd exact even groot
   ========================= */
(function(){
  const q = id => document.getElementById(id);
  const E = s => (typeof esc === 'function' ? esc(String(s ?? '')) : String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])));
  const HEX = {yellow:'#FFCC33', pink:'#00D4C7', purple:'#FF8A1F', blue:'#7ED957', green:'#FF5A5F', free:'#141414'};
  function players(room){ return Object.entries(room?.players || {}); }
  function me(room){ return room?.players?.[currentPlayerId] || {}; }
  function k(type,r){ return 'bb_v140_'+type+'_'+(r?.id||''); }
  function seen(type,r){ try{return sessionStorage.getItem(k(type,r))==='1'}catch(e){return false} }
  function setSeen(type,r){ try{sessionStorage.setItem(k(type,r),'1')}catch(e){} }
  function status(room,r,pid){ return r?.id ? (room.correct?.[r.id]?.[pid]) : undefined; }
  function ownStatus(room,r){ return status(room,r,currentPlayerId); }
  function picked(room,r){ return !!(r?.id && me(room).lastPickedRound===r.id); }
  function answerTime(room,r,pid){
    const ans = r?.id ? room.answers?.[r.id]?.[pid] : null;
    if(!ans?.submittedAt) return '';
    let start = Number(r.musicStartedAt || 0);
    if(!start && r.deadlineMs && r.seconds) start = Number(r.deadlineMs) - (Number(r.seconds)||20)*1000;
    if(!start || !Number.isFinite(start)) return '';
    const sec = Math.max(0,(Number(ans.submittedAt)-start)/1000);
    if(!Number.isFinite(sec)) return '';
    return sec < 10 ? sec.toFixed(1)+' sec' : Math.round(sec)+' sec';
  }
  function rerender(){
    try{ if(!currentRoomCode || !db || typeof renderCompactDashboard!=='function') return;
      db.ref('rooms/'+currentRoomCode).once('value').then(s=>{const room=s.val()||{}; renderCompactDashboard(room, room.currentRound||{});});
    }catch(e){}
  }
  window.bbV140SeenAnswer = function(roundId){ setSeen('answer',{id:roundId}); rerender(); };
  window.bbV140SeenScore = function(roundId){ setSeen('score',{id:roundId}); try{ db.ref('rooms/'+currentRoomCode+'/players/'+currentPlayerId+'/ready').set(false); }catch(e){} rerender(); };
  window.bbV140SeenPicked = function(roundId){ setSeen('picked',{id:roundId}); try{ db.ref('rooms/'+currentRoomCode+'/players/'+currentPlayerId+'/ready').set(false); }catch(e){} rerender(); };
  window.bbV140Ready = function(){ try{ db.ref('rooms/'+currentRoomCode+'/players/'+currentPlayerId+'/ready').set(true); }catch(e){} };

  function stage(root, cls, html){
    document.body.classList.add('bbStageMode');
    root.className = 'compactDashboard bbStageDashboard '+cls;
    root.innerHTML = `<section class="bbStageShell bbV140Shell">${html}</section>`;
  }
  function correctAnswerScreen(root,r){
    const a = r?.correctAnswer || {};
    stage(root,'stageCorrectV140',`
      <div class="bbV140AnswerCard">
        <div class="bbV140Eyebrow">🎵 JUIST ANTWOORD</div>
        <div class="bbV140AnswerGrid">
          <div><span>TITEL</span><strong>${E(a.track||'-')}</strong></div>
          <div><span>ARTIEST</span><strong>${E(a.artist||'-')}</strong></div>
          <div><span>JAAR</span><strong>${E(a.year||'-')}</strong></div>
        </div>
        <button type="button" class="bbV140MainBtn" onclick="bbV140SeenAnswer('${E(r.id||'')}')">VERDER</button>
      </div>
    `);
  }
  function stObj(st){
    if(st===true) return {cls:'good',icon:'✅',label:'GOED'};
    if(st===false) return {cls:'bad',icon:'❌',label:'FOUT'};
    if(st==='review') return {cls:'review',icon:'🤔',label:'TWIJFEL'};
    return {cls:'wait',icon:'…',label:'WACHT'};
  }
  function scoreScreen(root,room,r){
    const cor = r?.id ? (room.correct?.[r.id] || {}) : {};
    const ans = r?.id ? (room.answers?.[r.id] || {}) : {};
    const own = ownStatus(room,r);
    const hasReview = Object.values(cor).some(v=>v==='review') || r.status === 'review';
    let btn = hasReview
      ? `<button type="button" class="bbV140MainBtn review" onclick="bbV140SeenScore('${E(r.id||'')}')">BEOORDEEL TWIJFELGEVALLEN</button>`
      : own===true
        ? `<button type="button" class="bbV140MainBtn" onclick="bbV140SeenScore('${E(r.id||'')}')">NAAR BINGOKAART</button>`
        : `<button type="button" class="bbV140MainBtn lobby" onclick="bbV140SeenScore('${E(r.id||'')}')">NAAR LOBBY</button>`;
    const rows = players(room).map(([pid,p])=>{
      const st = stObj(cor[pid]);
      const text = ans[pid]?.answer ? String(ans[pid].answer).trim() : 'Geen antwoord';
      const t = answerTime(room,r,pid);
      return `<div class="bbV140ScoreRow ${st.cls}">
        <div class="bbV140Avatar">${E((p.name||'?').trim().slice(0,1).toUpperCase())}</div>
        <div class="bbV140Who"><strong>${E(p.name||'Speler')}${pid===currentPlayerId?' <em>jij</em>':''}</strong><span>${E(text)}</span>${t?`<small>⏱ ${E(t)}</small>`:''}</div>
        <div class="bbV140State"><b>${st.icon}</b><span>${st.label}</span></div>
      </div>`;
    }).join('');
    const a = r?.correctAnswer || {};
    stage(root,'stageScoreV140',`
      <div class="bbV140SmallAnswer"><span>JUIST ANTWOORD</span><strong>${E(a.track||'-')}</strong><small>${E(a.artist||'-')}${a.year?' • '+E(a.year):''}</small></div>
      <h2>SCOREBOARD DEZE RONDE</h2>
      <div class="bbV140ScoreList">${rows}</div>
      <div class="bbV140ButtonBottom">${btn}</div>
    `);
  }
  function pickedScreen(root,room,r){
    stage(root,'stagePickedV140',`
      <h2>Vakje gekozen</h2>
      <p class="bbStageSub">Je bingovakje is opgeslagen.</p>
      <button type="button" class="bbV140MainBtn" onclick="bbV140SeenPicked('${E(r.id||'')}')">VERDER NAAR LOBBY</button>
    `);
  }
  function lobbyScreen(root,room){
    const rows = players(room).map(([pid,p])=>`<div class="bbV140ReadyRow ${p.ready?'ready':'wait'}"><strong>${E(p.name||'Speler')}${pid===currentPlayerId?' <em>jij</em>':''}</strong><span>${p.ready?'READY':'Wacht'}</span></div>`).join('');
    const p = me(room);
    stage(root,'stageLobbyV140',`
      <h2>Klaar voor de volgende?</h2>
      <div class="bbV140Lets">OKAY, LET'S GO?!</div>
      <div class="bbV140ReadyList">${rows || '<div class="small">Nog geen spelers.</div>'}</div>
      <div class="bbV140ButtonBottom">${p.ready?'<button class="bbV140MainBtn isReady" disabled>READY ✓</button>':'<button class="bbV140MainBtn" onclick="bbV140Ready()">READY</button>'}</div>
    `);
  }
  function liveAnswerScreen(root,room,r){
    const ans = r?.id ? (room.answers?.[r.id] || {}) : {};
    const own = ans[currentPlayerId];
    const rows = players(room).map(([pid,p])=>{
      const has = ans[pid] && typeof ans[pid].answer !== 'undefined';
      const text = has ? (String(ans[pid].answer).trim() || 'Leeg antwoord') : 'Nog niet ingevuld';
      return `<div class="bbV140LiveRow ${has?'sent':'wait'}">
        <div class="bbV140Avatar">${E((p.name||'?').trim().slice(0,1).toUpperCase())}</div>
        <div class="bbV140Who"><strong>${E(p.name||'Speler')}${pid===currentPlayerId?' <em>jij</em>':''}</strong><span>${has?'Ingezonden':'Wacht op antwoord'}</span></div>
        <div class="bbV140LiveAnswer">${has?E(text):'—'}</div>
      </div>`;
    }).join('');
    const t = answerTime(room,r,currentPlayerId);
    stage(root,'stageLiveV140',`
      <div class="bbV140Own"><span>Jouw antwoord</span><strong>${E(String(own?.answer||'').trim()||'Leeg antwoord')}</strong></div>
      <h2>Live antwoorden</h2>
      <p class="bbStageSub">Antwoorden verschijnen zodra spelers insturen. Nog niemand ziet wat goed is.</p>
      <div class="bbV140ScoreList live">${rows}</div>
      <div class="bbV140AnswerTime">${t?'⚡ Ingevuld na '+E(t):'⏱ Ingezonden'}</div>
    `);
  }

  if(typeof renderCompactDashboard === 'function'){
    const prev = renderCompactDashboard;
    renderCompactDashboard = function(room,r){
      const root = q('screenDashboard');
      if(!root) return;
      if(r?.status === 'answering' && room.answers?.[r.id]?.[currentPlayerId]) return liveAnswerScreen(root,room,r);
      const isEnd = r && r.id && ['locked','review','judged'].includes(r.status);
      if(isEnd){
        if(!seen('answer',r)) return correctAnswerScreen(root,r);
        if(!seen('score',r)) return scoreScreen(root,room,r);
        if(r.status === 'review') return prev ? prev(room,r) : null;
        const st = ownStatus(room,r);
        if(st === true && !picked(room,r)) return prev ? prev(room,r) : null;
        if(st === true && picked(room,r) && !seen('picked',r)) return pickedScreen(root,room,r);
        return lobbyScreen(root,room);
      }
      return prev ? prev(room,r) : null;
    };
  }
})();
