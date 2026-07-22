/* Bingo Beats V177 — visuele presentatielaag. Spelwerking blijft in app.js en app-v176.js. */
(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  function enhance(){
    document.documentElement.classList.add('bbV177');
    document.body.classList.add('bbV177Theme');
    document.querySelectorAll('.bbHostStepTab').forEach((tab,index)=>{
      tab.setAttribute('aria-label',`Stap ${index+1}: ${tab.querySelector('small')?.textContent||''}`);
    });
    const room=q('playerRoomCode');
    if(room && !room.closest('.bbJoinCode')){
      const parent=room.parentElement;
      if(parent){
        parent.classList.add('bbJoinCode');
        parent.insertAdjacentHTML('afterbegin','<span>KAMERCODE</span>');
      }
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance,{once:true});else enhance();
})();
