/* Bingo Beats V187 — herstelt aanrakingen en verwijdert oude startblokkades. */
(function(){
  'use strict';

  const LICENSE_CODE='TEST-2026';
  const q=id=>document.getElementById(id);
  let appReady=false;

  function validLicense(){
    try{
      const saved=JSON.parse(localStorage.getItem('bb_license')||'null');
      if(saved?.code===LICENSE_CODE && saved?.active===true) return true;
    }catch(_error){}
    return /(?:^|;\s*)bb_license_active=1(?:;|$)/.test(document.cookie||'');
  }

  function saveLicense(){
    try{
      localStorage.setItem('bb_license',JSON.stringify({
        code:LICENSE_CODE,
        active:true,
        type:'test',
        activatedAt:new Date().toISOString()
      }));
      document.cookie='bb_license_active=1; max-age=31536000; path=/; SameSite=Lax';
      return true;
    }catch(_error){
      return false;
    }
  }

  function hideStartupOverlays(){
    [
      'hbHostStartOverlay',
      'bbV176RulesOverlay',
      'bbV176SpecialOverlay',
      'bbV176AdvantageOverlay',
      'bingoFullOverlay',
      'newGameModal',
      'bbFeedbackOverlay',
      'bbPortraitOnlyOverlay',
      'bbWheelFullOverlayV92',
      'bbWheelV123Overlay',
      'bbWheelV125Overlay'
    ].forEach(id=>{
      const element=q(id);
      if(!element) return;
      element.classList.remove('show');
      element.classList.add('hidden');
      element.setAttribute('aria-hidden','true');
      element.style.pointerEvents='none';
    });
  }

  function showLicense(message=''){
    document.body.classList.add('bbLicenseOpen');
    document.body.classList.remove('bbAppReady');
    const screen=q('licenseScreen');
    if(screen){
      screen.hidden=false;
      screen.classList.remove('hidden');
      screen.removeAttribute('aria-hidden');
      screen.style.removeProperty('display');
    }
    q('mainHeader')?.classList.add('hidden');
    q('hostApp')?.classList.add('hidden');
    q('playerApp')?.classList.add('hidden');
    if(message && q('licenseStatus')){
      q('licenseStatus').textContent=message;
      q('licenseStatus').className='small licenseError';
    }
  }

  function openApp(){
    if(appReady) return;
    appReady=true;
    hideStartupOverlays();

    /* Verwijderen is veiliger dan alleen verbergen: het element kan dan
       op iPhone nooit meer onzichtbaar alle aanrakingen opvangen. */
    q('licenseScreen')?.remove();
    document.body.classList.remove('bbLicenseOpen');
    document.body.classList.add('bbAppReady');

    q('mainHeader')?.classList.remove('hidden');
    const playerMode=!!new URLSearchParams(location.search).get('room');
    q(playerMode?'playerApp':'hostApp')?.classList.remove('hidden');
    q(playerMode?'hostApp':'playerApp')?.classList.add('hidden');

    try{
      const alreadyInitialised=typeof db!=='undefined' && !!db;
      if(!alreadyInitialised){
        if(typeof window.unlockApp==='function') window.unlockApp();
        else if(typeof unlockApp==='function') unlockApp();
      }
    }catch(error){
      console.error('Bingo Beats initialiseren:',error);
    }
  }

  function activate(event){
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    const input=q('licenseInput');
    const code=String(input?.value||'').trim().toUpperCase();
    if(code!==LICENSE_CODE){
      showLicense(code?'Deze licentiecode is niet geldig.':'Vul eerst je licentiecode in.');
      input?.focus?.();
      return;
    }
    if(!saveLicense()){
      showLicense('Activeren lukt niet. Open Bingo Beats eenmaal in Safari.');
      return;
    }
    openApp();
  }

  function setHostStep(value){
    const step=Math.max(1,Math.min(4,Number(value)||1));
    if(typeof window.bbHostWizardSetStep==='function'){
      window.bbHostWizardSetStep(step);
      return;
    }
    document.querySelectorAll('[data-host-step-panel]').forEach(panel=>{
      panel.classList.toggle('active',Number(panel.dataset.hostStepPanel)===step);
    });
    document.querySelectorAll('[data-host-step]').forEach(tab=>{
      const number=Number(tab.dataset.hostStep);
      tab.classList.toggle('active',number===step);
      tab.classList.toggle('done',number<step);
    });
  }

  function wireInteractionFallback(){
    document.addEventListener('click',event=>{
      const target=event.target?.closest?.('[data-host-step],[data-host-go]');
      if(!target || document.body.classList.contains('bbLicenseOpen')) return;
      const value=target.dataset.hostStep||target.dataset.hostGo;
      setHostStep(value);
    },true);
  }

  function init(){
    document.documentElement.classList.add('bbV187');
    /* Vervang de twee licentiebedieningen één keer. Daarmee verdwijnen
       alle oudere, onderling botsende click- en herlaadhandlers. */
    const oldButton=q('licenseBtn');
    const button=oldButton?.cloneNode(true);
    if(oldButton && button) oldButton.replaceWith(button);
    const oldInput=q('licenseInput');
    const input=oldInput?.cloneNode(true);
    if(oldInput && input){
      input.value=oldInput.value;
      oldInput.replaceWith(input);
    }
    button?.addEventListener('click',activate,true);
    input?.addEventListener('keydown',event=>{
      if(event.key==='Enter') activate(event);
    },true);
    wireInteractionFallback();

    if(validLicense()) openApp();
    else showLicense();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init,{once:true});
  }else{
    init();
  }
})();
