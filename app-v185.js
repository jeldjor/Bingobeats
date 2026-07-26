/* Bingo Beats V185 — betrouwbaar licentiescherm op iPhone/PWA. */
(function(){
  'use strict';

  const LICENSE_CODE='TEST-2026';
  const q=id=>document.getElementById(id);

  function setStatus(message,success){
    const status=q('licenseStatus');
    if(!status)return;
    status.textContent=message;
    status.className='small '+(success?'licenseSuccess':'licenseError');
  }

  function activateFromLicenseScreen(event){
    event?.preventDefault?.();
    const input=q('licenseInput');
    const code=String(input?.value||'').trim().toUpperCase();
    if(code!==LICENSE_CODE){
      setStatus(code?'Deze licentiecode is niet geldig.':'Vul eerst je licentiecode in.',false);
      input?.focus?.();
      return;
    }

    try{
      localStorage.setItem('bb_license',JSON.stringify({
        code:LICENSE_CODE,
        active:true,
        type:'test',
        activatedAt:new Date().toISOString()
      }));
    }catch(error){
      setStatus('Activeren lukt niet. Open Bingo Beats opnieuw in Safari.',false);
      return;
    }

    setStatus('Licentie geactiveerd. Bingo Beats wordt geopend…',true);
    const button=q('licenseBtn');
    if(button){
      button.disabled=true;
      button.textContent='OPENEN…';
    }

    /* Een schone herstart voorkomt dat oude of beschadigde lokale speldata
       de eerste initialisatie van de app kan blokkeren. */
    setTimeout(()=>location.reload(),300);
  }

  function initLicenseFallback(){
    const button=q('licenseBtn');
    const input=q('licenseInput');
    if(!button||button.dataset.bbV185Wired)return;
    button.dataset.bbV185Wired='true';
    button.addEventListener('click',activateFromLicenseScreen);
    input?.addEventListener('keydown',event=>{
      if(event.key==='Enter')activateFromLicenseScreen(event);
    });

    const logo=q('licenseLogo');
    if(logo){
      logo.hidden=false;
      logo.style.display='block';
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',initLicenseFallback,{once:true});
  }else{
    initLicenseFallback();
  }
})();
