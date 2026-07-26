/* Bingo Beats V189 — start zonder terugkerende licentieblokkade. */
(function(){
  'use strict';

  const q = id => document.getElementById(id);

  function removeBlockingStartLayers(){
    q('licenseScreen')?.remove();
    document.body.classList.remove('bbLicenseOpen');
    document.body.classList.add('bbAppReady');

    [
      'hbHostStartOverlay',
      'newGameModal',
      'bingoFullOverlay',
      'bbFeedbackOverlay',
      'bbPortraitOnlyOverlay',
      'bbV176RulesOverlay',
      'bbV176SpecialOverlay',
      'bbV176AdvantageOverlay'
    ].forEach(id=>{
      const element = q(id);
      if(!element || !element.classList.contains('hidden')) return;
      element.setAttribute('aria-hidden','true');
      element.style.pointerEvents = 'none';
    });
  }

  function makeCurrentWorkerTakeOver(){
    if(!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    navigator.serviceWorker.register('./sw.js?v=1890',{updateViaCache:'none'})
      .then(registration=>registration.update())
      .catch(()=>{});
  }

  function initV189(){
    document.documentElement.classList.add('bbV189');
    removeBlockingStartLayers();
    makeCurrentWorkerTakeOver();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded',initV189,{once:true});
  }else{
    initV189();
  }
})();
