/* Bingo Beats V182 — houdt de modulebalk en het compacte muziekscherm synchroon. */
(function(){
  'use strict';

  function init(){
    document.documentElement.classList.add('bbV182');

    // De zichtbare modulebalk volgt de actieve hoststap; er worden geen nieuwe knoppen toegevoegd.
    const sync=()=>{
      const active=document.querySelector('[data-host-step-panel].active');
      const step=Number(active?.dataset.hostStepPanel||1);
      document.querySelectorAll('.bbHostStepTab').forEach(tab=>{
        const number=Number(tab.dataset.hostStep||0);
        tab.classList.toggle('active',number===step);
        tab.classList.toggle('done',number<step);
      });
    };

    const host=document.getElementById('hostApp');
    if(host) new MutationObserver(sync).observe(host,{subtree:true,attributes:true,attributeFilter:['class']});
    sync();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
