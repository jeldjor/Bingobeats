/* Bingo Beats V181 — verwijdert de vastlopende oude startpopup. */
(function(){
  'use strict';
  const q=id=>document.getElementById(id);

  function closeOldStartPopup(){
    const overlay=q('hbHostStartOverlay');
    if(!overlay) return;
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden','true');
    sessionStorage.setItem('bb_start_popup_seen','1');
  }

  function init(){
    document.documentElement.classList.add('bbV181');
    closeOldStartPopup();

    ['hbCloseModalBtn','hbResumeRoomBtn','hbNewRoomModalBtn'].forEach(id=>{
      q(id)?.addEventListener('click',closeOldStartPopup,true);
    });

    q('hbHostStartOverlay')?.addEventListener('click',event=>{
      if(event.target===event.currentTarget) closeOldStartPopup();
    });

    document.addEventListener('keydown',event=>{
      if(event.key==='Escape') closeOldStartPopup();
    });

    // Extra beveiliging tegen oudere code of een vertraagde cache die de overlay opnieuw opent.
    const overlay=q('hbHostStartOverlay');
    if(overlay){
      new MutationObserver(()=>{
        if(!overlay.classList.contains('hidden')) closeOldStartPopup();
      }).observe(overlay,{attributes:true,attributeFilter:['class']});
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
