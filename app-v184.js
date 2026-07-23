/* Bingo Beats V184 — echte Spotify-status en opgeschoonde playlistflow. */
(function(){
  'use strict';

  const q=id=>document.getElementById(id);

  function showSpotifyState(loggedIn,label){
    document.body.classList.toggle('bbSpotifyLoggedIn',loggedIn);
    document.body.classList.toggle('bbSpotifyLoggedOut',!loggedIn);
    const status=q('loginStatus');
    if(status) status.textContent=label;
    const activate=q('activateBtn');
    if(activate) activate.disabled=!loggedIn;
  }

  function clearInvalidSpotifySession(){
    ['spotify_access_token','spotify_refresh_token','spotify_expires_at'].forEach(key=>localStorage.removeItem(key));
    try{
      accessToken='';
      refreshToken='';
      expiresAt=0;
    }catch(error){}
  }

  async function syncSpotifyStatus(){
    showSpotifyState(false,'Nog niet ingelogd.');
    try{
      const token=typeof getToken==='function' ? await getToken() : '';
      if(!token) return false;
      const me=typeof api==='function' ? await api('https://api.spotify.com/v1/me') : null;
      if(!me?.id) throw new Error('Spotify-account niet bevestigd');
      showSpotifyState(true,'Ingelogd als: '+(me.display_name||me.email||'Spotify gebruiker'));
      return true;
    }catch(error){
      clearInvalidSpotifySession();
      showSpotifyState(false,'Nog niet ingelogd.');
      return false;
    }
  }

  function cleanMusicScreen(){
    document.documentElement.classList.add('bbV184');

    const playlistLabel=q('playlistSelect')?.closest('.bbMusicRowCopy')?.querySelector('small');
    if(playlistLabel) playlistLabel.textContent='Kies playlist';

    const search=q('bbPlaylistSearchInput')?.closest('.bbPlaylistSearch');
    if(search) search.remove();

    document.querySelectorAll('.bbFixedQuestionCategories .bbCategoryIcon').forEach(icon=>{
      icon.textContent='';
    });

    showSpotifyState(false,'Nog niet ingelogd.');
    syncSpotifyStatus();
  }

  if(typeof updateStatus==='function'){
    updateStatus=syncSpotifyStatus;
  }

  window.addEventListener('pageshow',syncSpotifyStatus);
  window.addEventListener('storage',event=>{
    if(String(event.key||'').startsWith('spotify_')) syncSpotifyStatus();
  });

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',cleanMusicScreen,{once:true});
  }else{
    cleanMusicScreen();
  }
})();
