/* Bingo Beats V178 — pure visuele afwerking op de bestaande knoppen en spelwerking. */
(function(){
  'use strict';
  function enhance(){
    document.documentElement.classList.add('bbV178');
    document.body.classList.add('bbV178Theme');

    // Alleen labels en toegankelijkheid verbeteren; er worden geen knoppen aangemaakt.
    document.querySelectorAll('.bbHostStepTab').forEach((tab,index)=>{
      const label=tab.querySelector('small')?.textContent?.trim()||'';
      tab.setAttribute('aria-label',`Stap ${index+1}: ${label}`);
    });

    const join=document.getElementById('screenJoin');
    if(join) join.setAttribute('aria-label','Bingo Beats speler aanmelden');

    // Houd de actieve stap herkenbaar voor CSS en schermlezers.
    const syncStep=()=>{
      document.querySelectorAll('[data-host-step-panel]').forEach(panel=>{
        panel.setAttribute('aria-hidden',panel.classList.contains('active')?'false':'true');
      });
    };
    syncStep();
    const host=document.getElementById('hostApp');
    if(host) new MutationObserver(syncStep).observe(host,{subtree:true,attributes:true,attributeFilter:['class']});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',enhance,{once:true});
  else enhance();
})();
