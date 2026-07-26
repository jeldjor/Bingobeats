/* Bingo Beats V186 — licentie direct openen, zonder herlaadlus. */
(function(){
  'use strict';

  const LICENSE_CODE='TEST-2026';
  const q=id=>document.getElementById(id);
  let opening=false;

  function setStatus(message,success){
    const status=q('licenseStatus');
    if(!status)return;
    status.textContent=message;
    status.className='small '+(success?'licenseSuccess':'licenseError');
  }

  function storedLicenseIsValid(){
    try{
      const saved=JSON.parse(localStorage.getItem('bb_license')||'null');
      if(saved?.code===LICENSE_CODE && saved?.active===true)return true;
    }catch(_error){}
    return /(?:^|;\s*)bb_license_active=1(?:;|$)/.test(document.cookie||'');
  }

  function saveLicense(){
    const value=JSON.stringify({
      code:LICENSE_CODE,
      active:true,
      type:'test',
      activatedAt:new Date().toISOString()
    });
    let saved=false;
    try{
      localStorage.setItem('bb_license',value);
      saved=true;
    }catch(_error){}
    try{
      document.cookie='bb_license_active=1; max-age=31536000; path=/; SameSite=Lax';
      saved=true;
    }catch(_error){}
    return saved;
  }

  function revealApp(){
    if(opening)return;
    opening=true;

    const license=q('licenseScreen');
    if(license){
      license.classList.add('hidden');
      license.hidden=true;
      license.setAttribute('aria-hidden','true');
      license.style.setProperty('display','none','important');
    }

    q('mainHeader')?.classList.remove('hidden');
    const playerMode=!!new URLSearchParams(location.search).get('room');
    q(playerMode?'playerApp':'hostApp')?.classList.remove('hidden');
    q(playerMode?'hostApp':'playerApp')?.classList.add('hidden');

    try{
      if(typeof window.unlockApp==='function')window.unlockApp();
      else if(typeof unlockApp==='function')unlockApp();
    }catch(error){
      console.error('Bingo Beats starten:',error);
    }
  }

  function activate(event){
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();

    const input=q('licenseInput');
    const code=String(input?.value||'').trim().toUpperCase();
    if(code!==LICENSE_CODE){
      setStatus(code?'Deze licentiecode is niet geldig.':'Vul eerst je licentiecode in.',false);
      input?.focus?.();
      return;
    }

    if(!saveLicense()){
      setStatus('Activeren lukt niet. Open Bingo Beats eenmaal in Safari.',false);
      return;
    }

    setStatus('Licentie geactiveerd.',true);
    revealApp();
  }

  function init(){
    const button=q('licenseBtn');
    const input=q('licenseInput');

    /* Capture voorkomt dat oudere activatiecode daarna alsnog de pagina herlaadt. */
    button?.addEventListener('click',activate,true);
    input?.addEventListener('keydown',event=>{
      if(event.key==='Enter')activate(event);
    },true);

    if(storedLicenseIsValid())revealApp();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init,{once:true});
  }else{
    init();
  }
})();
