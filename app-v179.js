/* Bingo Beats V179 — schermstatus, playlistinformatie en visuele synchronisatie. */
(function(){
  'use strict';
  const q=id=>document.getElementById(id);

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

  function syncStepClass(){
    const active=document.querySelector('[data-host-step-panel].active');
    const host=q('hostApp');
    const license=q('licenseScreen');
    const hostVisible=!!host && !host.classList.contains('hidden');
    const licenseOpen=!!license && !license.classList.contains('hidden');
    const music=active?.dataset.hostStepPanel==='1' && hostVisible && !licenseOpen && !document.body.classList.contains('playerMode');
    document.body.classList.toggle('bbHostMusicStep',music);
  }

  let loginSyncing=false;
  function syncLoginRow(){
    if(loginSyncing) return;
    const status=q('loginStatus');
    const row=document.querySelector('.bbSpotifyAccountRow');
    const caption=q('bbSpotifyCaption');
    if(!status||!row) return;
    loginSyncing=true;
    const original=(status.dataset.bbRawStatus||status.textContent||'').trim();
    const current=(status.textContent||'').trim();
    const raw=/^Ingelogd/i.test(current)||/^Nog niet/i.test(current)?current:original||current;
    status.dataset.bbRawStatus=raw;
    const logged=/^Ingelogd/i.test(raw) || !!localStorage.getItem('spotify_access_token');
    row.classList.toggle('isLoggedIn',logged);
    if(logged){
      if(caption) caption.textContent='Ingelogd als';
      let name=raw.replace(/^Ingelogd als:\s*/i,'').replace(/^Ingelogd\.?$/i,'Spotify-gebruiker').replace(/\s+—\s+speler actief\.?$/i,'').trim();
      const shown=name||'Spotify-gebruiker';
      if(status.textContent!==shown) status.textContent=shown;
    }else{
      if(caption) caption.textContent='Spotify-account';
      if(status.textContent!=='Nog niet ingelogd') status.textContent='Nog niet ingelogd';
    }
    loginSyncing=false;
  }

  function countFromSelectedOption(){
    const select=q('playlistSelect');
    const text=select?.selectedOptions?.[0]?.textContent||'';
    const m=text.match(/\((\d+)\s+nummers?\)/i);
    return m?Number(m[1]):0;
  }

  function syncPlaylistUI(){
    const select=q('playlistSelect');
    const importBtn=q('importPlaylistBtn');
    const loadBtn=q('loadPlaylistsBtn');
    const countEl=q('bbPlaylistCountValue');
    const tracks=readTracks();
    const imported=readImported();
    let options=select?Array.from(select.options).filter(o=>o.value):[];

    if(select){
      // Laat een eerder geïmporteerde playlist direct zien na opnieuw openen,
      // ook voordat de Spotify-playlistlijst opnieuw is opgehaald.
      if(imported?.id && !options.length){
        const option=document.createElement('option');
        option.value=String(imported.id);
        option.textContent=`${imported.name||'Playlist'} (${Number(imported.count)||tracks.length||0} nummers)`;
        select.replaceChildren(option);
        options=[option];
      }
      select.disabled=!options.length;
      if(imported?.id && options.some(o=>o.value===imported.id)) select.value=imported.id;
    }
    if(importBtn) importBtn.disabled=!(select?.value);
    if(loadBtn) loadBtn.textContent=(options.length||imported)?'WIJZIGEN':'LADEN';

    const selectedCount=countFromSelectedOption();
    const count=tracks.length || Number(imported?.count)||selectedCount||0;
    if(countEl) countEl.textContent=`${count} ${count===1?'nummer':'nummers'}`;
  }

  function observe(){
    const host=q('hostApp');
    if(host) new MutationObserver(syncStepClass).observe(host,{subtree:true,attributes:true,attributeFilter:['class']});
    const license=q('licenseScreen');
    if(license) new MutationObserver(syncStepClass).observe(license,{attributes:true,attributeFilter:['class']});
    new MutationObserver(syncStepClass).observe(document.body,{attributes:true,attributeFilter:['class']});
    const login=q('loginStatus');
    if(login) new MutationObserver(syncLoginRow).observe(login,{childList:true,characterData:true,subtree:true});
    const select=q('playlistSelect');
    if(select){
      new MutationObserver(syncPlaylistUI).observe(select,{childList:true,subtree:true,attributes:true});
      select.addEventListener('change',syncPlaylistUI);
    }
    q('loadPlaylistsBtn')?.addEventListener('click',()=>setTimeout(syncPlaylistUI,250));
    q('importPlaylistBtn')?.addEventListener('click',()=>{
      let tries=0;
      const timer=setInterval(()=>{
        syncPlaylistUI();
        if(++tries>40 || /geïmporteerd|klaar/i.test(q('playlistStatus')?.textContent||'')) clearInterval(timer);
      },250);
    });
    window.addEventListener('storage',syncPlaylistUI);
    window.addEventListener('bb:playlist-imported',syncPlaylistUI);
    window.addEventListener('bb:playlists-loaded',syncPlaylistUI);
  }

  function init(){
    document.documentElement.classList.add('bbV179');
    syncStepClass();
    syncLoginRow();
    syncPlaylistUI();
    observe();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
