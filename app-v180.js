/* Bingo Beats V180 — exact muziekscherm, status-synchronisatie en automatische Spotify-activatie. */
(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  const qa=(sel,root=document)=>Array.from(root.querySelectorAll(sel));

  function readTracks(){
    try{
      const value=JSON.parse(localStorage.getItem('hb_playlist_tracks')||'[]');
      return Array.isArray(value)?value:[];
    }catch(_e){ return []; }
  }
  function readImported(){
    try{ return JSON.parse(localStorage.getItem('bb_imported_playlist')||'null')||null; }
    catch(_e){ return null; }
  }

  function isHostVisible(){
    const host=q('hostApp');
    const license=q('licenseScreen');
    return !!host && !host.classList.contains('hidden') &&
      (!license || license.classList.contains('hidden')) &&
      !document.body.classList.contains('playerMode') &&
      !document.body.classList.contains('bbHostPlayerMode');
  }

  function syncStepClass(){
    const active=document.querySelector('[data-host-step-panel].active');
    const hostVisible=isHostVisible();
    const music=hostVisible && active?.dataset.hostStepPanel==='1';
    document.body.classList.toggle('bbHostWizardOpen',hostVisible);
    document.body.classList.toggle('bbHostMusicStep',music);
    syncPlayerCount();
  }

  function syncPlayerCount(){
    const target=q('bbMusicActivePlayers');
    if(!target) return;
    const visibleRows=qa('#hostPlayers .playerRow, #hostPlayers .bbV160HostChip');
    let count=visibleRows.length;
    const headerText=q('bbHostHeaderPlayers')?.textContent||'';
    const headerCount=Number((headerText.match(/\d+/)||[])[0]||0);
    count=Math.max(count,headerCount);
    target.textContent=String(count);
  }

  let loginSyncing=false;
  function syncLoginRow(){
    if(loginSyncing) return;
    const status=q('loginStatus');
    const row=document.querySelector('.bbSpotifyAccountRow');
    const caption=q('bbSpotifyCaption');
    if(!status||!row) return;
    loginSyncing=true;
    const current=(status.textContent||'').trim();
    const previous=(status.dataset.bbRawStatus||'').trim();
    const raw=/^(Ingelogd|Nog niet)/i.test(current)?current:(previous||current);
    status.dataset.bbRawStatus=raw;
    const logged=/^Ingelogd/i.test(raw) || !!localStorage.getItem('spotify_access_token') || !!localStorage.getItem('hb_access_token');
    row.classList.toggle('isLoggedIn',logged);
    if(logged){
      if(caption) caption.textContent='Ingelogd als';
      const name=raw
        .replace(/^Ingelogd als:\s*/i,'')
        .replace(/^Ingelogd\.?$/i,'Muziekgebruiker')
        .replace(/\s+—\s+speler actief\.?$/i,'')
        .trim();
      status.textContent=name||'Muziekgebruiker';
    }else{
      if(caption) caption.textContent='Spotify-account';
      status.textContent='Nog niet ingelogd';
    }
    loginSyncing=false;
  }

  function countFromSelectedOption(){
    const text=q('playlistSelect')?.selectedOptions?.[0]?.textContent||'';
    const match=text.match(/\((\d+)\s+nummers?\)/i);
    return match?Number(match[1]):0;
  }

  function syncPlaylistUI(){
    const select=q('playlistSelect');
    const importBtn=q('importPlaylistBtn');
    const loadBtn=q('loadPlaylistsBtn');
    const countEl=q('bbPlaylistCountValue');
    const tracks=readTracks();
    const imported=readImported();
    let options=select?Array.from(select.options).filter(option=>option.value):[];

    if(select){
      if(imported?.id && !options.length){
        const option=document.createElement('option');
        option.value=String(imported.id);
        option.textContent=`${imported.name||'Playlist'} (${Number(imported.count)||tracks.length||0} nummers)`;
        select.replaceChildren(option);
        options=[option];
      }
      select.disabled=!options.length;
      if(imported?.id && options.some(option=>option.value===String(imported.id))) select.value=String(imported.id);
    }
    if(importBtn) importBtn.disabled=!(select?.value);
    if(loadBtn) loadBtn.textContent=(options.length||imported)?'WIJZIGEN':'LADEN';

    const count=tracks.length || Number(imported?.count)||countFromSelectedOption()||0;
    if(countEl) countEl.textContent=`${count} ${count===1?'nummer':'nummers'}`;
  }

  function filterPlaylists(){
    const input=q('bbPlaylistSearchInput');
    const select=q('playlistSelect');
    if(!input||!select) return;
    const term=input.value.trim().toLocaleLowerCase('nl');
    const options=Array.from(select.options);
    let firstVisible=null;
    options.forEach(option=>{
      const visible=!term || option.textContent.toLocaleLowerCase('nl').includes(term);
      option.hidden=!visible;
      if(visible && option.value && !firstVisible) firstVisible=option;
    });
    if(term && firstVisible && select.selectedOptions[0]?.hidden){
      select.value=firstVisible.value;
      select.dispatchEvent(new Event('change',{bubbles:true}));
    }
  }

  let activationPending=false;
  async function ensurePlaybackActive(){
    if(activationPending || typeof window.activatePlayer!=='function') return;
    const hasToken=!!localStorage.getItem('spotify_access_token') || !!localStorage.getItem('hb_access_token');
    if(!hasToken) return;
    activationPending=true;
    try{ await window.activatePlayer(); }
    catch(error){ console.warn('Automatische muziekspeler-activatie:',error); }
    finally{ activationPending=false; }
  }

  function observe(){
    const host=q('hostApp');
    if(host) new MutationObserver(syncStepClass).observe(host,{subtree:true,attributes:true,attributeFilter:['class']});
    const license=q('licenseScreen');
    if(license) new MutationObserver(syncStepClass).observe(license,{attributes:true,attributeFilter:['class']});
    new MutationObserver(syncStepClass).observe(document.body,{attributes:true,attributeFilter:['class']});

    const players=q('hostPlayers');
    if(players) new MutationObserver(syncPlayerCount).observe(players,{childList:true,subtree:true,characterData:true});
    const headerPlayers=q('bbHostHeaderPlayers');
    if(headerPlayers) new MutationObserver(syncPlayerCount).observe(headerPlayers,{childList:true,subtree:true,characterData:true});

    const login=q('loginStatus');
    if(login) new MutationObserver(syncLoginRow).observe(login,{childList:true,characterData:true,subtree:true});
    const select=q('playlistSelect');
    if(select){
      new MutationObserver(()=>{syncPlaylistUI();filterPlaylists();}).observe(select,{childList:true,subtree:true,attributes:true});
      select.addEventListener('change',syncPlaylistUI);
    }
    q('bbPlaylistSearchInput')?.addEventListener('input',filterPlaylists);
    q('loadPlaylistsBtn')?.addEventListener('click',()=>{
      setTimeout(syncPlaylistUI,250);
      setTimeout(ensurePlaybackActive,50);
    });
    q('importPlaylistBtn')?.addEventListener('click',()=>{
      let tries=0;
      const timer=setInterval(()=>{
        syncPlaylistUI();
        if(++tries>40 || /geïmporteerd|klaar|actief/i.test(q('playlistStatus')?.textContent||'')) clearInterval(timer);
      },250);
      setTimeout(ensurePlaybackActive,100);
    });
    window.addEventListener('storage',()=>{syncPlaylistUI();syncLoginRow();});
    window.addEventListener('bb:playlist-imported',()=>{syncPlaylistUI();ensurePlaybackActive();});
    window.addEventListener('bb:playlists-loaded',()=>{syncPlaylistUI();filterPlaylists();ensurePlaybackActive();});
  }

  function init(){
    document.documentElement.classList.add('bbV180');
    syncStepClass();
    syncLoginRow();
    syncPlaylistUI();
    syncPlayerCount();
    observe();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
