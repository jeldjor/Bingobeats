/*
 * Bingo Beats V176
 * Premium interface + officiële spelregels:
 * - 4 normale rondes, daarna een BingoBeats Round
 * - score: +100 goed, +50 snelste (normale ronde)
 * - verborgen Beat Bomb + Beat Engineer
 * - blokwinnaar kiest één voordeel
 * - uitleg in lobby en vóór iedere BingoBeats Round
 */
(function(){
  'use strict';

  const V='176';
  const q=id=>document.getElementById(id);
  const E=value=>(typeof esc==='function'?esc(String(value??'')):String(value??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])));
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const ADVANTAGES={
    timePressure:'Time Pressure',
    doubleTrouble:'Double Trouble',
    engineer:'Engineer Unlock',
    extraTime:'Extra Time',
    joker:'Joker'
  };
  let serverOffset=0;
  let pendingSpecialRound=0;
  let lastRoomSnapshot=null;
  let lastRoundSnapshot=null;
  let scoringBusy=false;
  let autoStartedAfterAdvantage='';
  let viewedPlayerId='';
  const specialIntroSeen=new Set();

  function now(){return Date.now()+serverOffset;}
  function isHostClient(){return !isPlayerPage() || document.body.classList.contains('bbHostPlayerMode');}
  function activeEntries(room){return Object.entries(room?.players||{}).filter(([,p])=>p&&p.online!==false);}
  function cleanName(value){return String(value||'Speler').replace(/^🎤\s*/,'').trim()||'Speler';}
  function gameState(room){return room?.gameState||{};}
  function currentScore(player){return Number(player?.score||0);}
  function currentBlockScore(player){return Number(player?.blockScore||0);}
  function safeKey(value){return String(value||'').replace(/[.#$\[\]/]/g,'_');}

  function hash(text){let h=2166136261;for(const c of String(text||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
  function availableCardIndexes(card){return (Array.isArray(card)?card:[]).map((c,i)=>({c,i})).filter(x=>x.c&&x.c!=='free').map(x=>x.i);}
  function derivedPowerCells(pid,card,existing){
    const list=availableCardIndexes(card);
    const base={...(existing||{})};
    if(!list.length)return base;
    if(!Number.isInteger(base.bombIndex))base.bombIndex=list[hash(pid+'|bomb')%list.length];
    if(!Number.isInteger(base.engineerIndex)){
      const alternatives=list.filter(i=>i!==base.bombIndex);
      base.engineerIndex=alternatives[hash(pid+'|engineer')%alternatives.length];
    }
    base.bombTriggered=!!base.bombTriggered;
    base.engineerFound=!!base.engineerFound;
    base.engineerActive=!!base.engineerActive;
    base.engineerUsed=!!base.engineerUsed;
    return base;
  }
  function secondBombIndex(pid,card,power){
    const list=availableCardIndexes(card).filter(i=>i!==power.bombIndex&&i!==power.engineerIndex);
    return list.length?list[hash(pid+'|bomb2')%list.length]:null;
  }

  async function ensurePlayerPower(roomCode,pid){
    if(!roomCode||!pid||!db)return;
    const ref=db.ref(`rooms/${roomCode}/players/${pid}`);
    const snap=await ref.once('value');
    const p=snap.val()||{};
    if(!Array.isArray(p.card)||!p.card.length)return;
    const power=derivedPowerCells(pid,p.card,p.powerCells);
    const patch={powerCells:power};
    if(typeof p.score!=='number')patch.score=0;
    if(typeof p.blockScore!=='number')patch.blockScore=0;
    await ref.update(patch);
  }

  async function ensureRoomState(roomCode){
    if(!roomCode||!db)return;
    const ref=db.ref(`rooms/${roomCode}/gameState`);
    const snap=await ref.once('value');
    if(!snap.exists()){
      await ref.set({roundNumber:0,blockRound:0,version:V,createdAt:firebase.database.ServerValue.TIMESTAMP});
    }else if(snap.val()?.version!==V){
      await ref.update({version:V});
    }
    const room=(await db.ref(`rooms/${roomCode}`).once('value')).val()||{};
    await Promise.all(Object.keys(room.players||{}).map(pid=>ensurePlayerPower(roomCode,pid).catch(()=>{})));
  }

  function effectiveDeadline(room,r,pid){
    let deadline=Number(r?.deadlineMs||0);
    if(!deadline||r?.isBingoBeats)return deadline;
    const adv=r?.advantage||gameState(room).activeAdvantage||null;
    const n=Number(r?.roundNumber||0);
    if(!adv||n<Number(adv.startRound||0)||n>Number(adv.endRound||0))return deadline;
    if(adv.type==='timePressure'&&pid!==adv.ownerId)deadline-=5000;
    if(adv.type==='extraTime'&&pid===adv.ownerId)deadline+=5000;
    return deadline;
  }

  function showOverlay(id){q(id)?.classList.remove('hidden');}
  function hideOverlay(id){q(id)?.classList.add('hidden');}

  function showLobbyRules(force=false){
    if(!currentRoomCode&&!force)return;
    const key=`bb_rules_${currentRoomCode||'preview'}_${currentPlayerId||'guest'}`;
    if(!force&&sessionStorage.getItem(key)==='1')return;
    showOverlay('bbV176RulesOverlay');
  }
  function closeLobbyRules(){
    if(currentRoomCode)sessionStorage.setItem(`bb_rules_${currentRoomCode}_${currentPlayerId||'guest'}`,'1');
    hideOverlay('bbV176RulesOverlay');
  }

  function showSpecialIntro(asHost,nonce){
    const key=String(nonce||'special');
    if(!asHost&&specialIntroSeen.has(key))return;
    specialIntroSeen.add(key);
    q('bbV176SpecialStart')?.classList.toggle('hidden',!asHost);
    q('bbV176SpecialPlayerClose')?.classList.toggle('hidden',asHost);
    q('bbV176SpecialCloseX')?.classList.toggle('hidden',asHost);
    showOverlay('bbV176SpecialOverlay');
  }

  function effectPopup(kind){
    let overlay=q('bbV176EffectOverlay');
    if(!overlay){
      overlay=document.createElement('div');
      overlay.id='bbV176EffectOverlay';
      overlay.className='bbV176Overlay hidden';
      document.body.appendChild(overlay);
    }
    const config={
      bomb:{icon:'💥',title:'Beat Bomb!',text:'Al je aangevinkte vakken zijn verdwenen. De bom kan niet opnieuw afgaan.'},
      repaired:{icon:'👷',title:'Engineer redt je kaart!',text:'Je Beat Engineer repareert de explosie. Je aangevinkte vakken blijven staan.'},
      engineer:{icon:'👷',title:'Beat Engineer gevonden!',text:'Je Engineer is actief en beschermt je één keer tegen een Beat Bomb.'}
    }[kind];
    if(!config)return;
    overlay.innerHTML=`<div class="bbV176Modal bbV176EffectCard"><div class="bbV176EffectIcon">${config.icon}</div><span class="bbV176Eyebrow">SPECIAAL VAK</span><h2>${E(config.title)}</h2><p>${E(config.text)}</p><button type="button" class="bbV176Primary" id="bbV176EffectClose">Verder</button></div>`;
    overlay.classList.remove('hidden');
    q('bbV176EffectClose')?.addEventListener('click',()=>overlay.classList.add('hidden'),{once:true});
    if(kind==='bomb'||kind==='repaired')setTimeout(()=>overlay.classList.add('hidden'),5200);
  }

  function cardCellIcon(index,marked,power){
    if((index===power.bombIndex||index===power.bomb2Index)&&power.bombTriggeredIndexes?.[index])return '💣';
    if(index===power.bombIndex&&power.bombTriggered)return '💣';
    if(index===power.bomb2Index&&power.bomb2Triggered)return '💣';
    if(index===power.engineerIndex&&power.engineerFound&&!power.engineerUsed)return '👷';
    return marked?'🐵':'';
  }

  function decoratePowerCells(container,player,pid){
    if(!container||!player)return;
    const cells=Array.from(container.children).filter(el=>el.nodeType===1);
    if(cells.length<20)return;
    const power=derivedPowerCells(pid,player.card,player.powerCells);
    cells.forEach((cell,index)=>{
      cell.dataset.i=cell.dataset.i??String(index);
      cell.classList.remove('bbPowerBomb','bbPowerEngineer','used');
      if((index===power.bombIndex&&power.bombTriggered)||(index===power.bomb2Index&&power.bomb2Triggered))cell.classList.add('bbPowerBomb');
      if(index===power.engineerIndex&&power.engineerFound&&!power.engineerUsed)cell.classList.add('bbPowerEngineer');
      if(index===power.engineerIndex&&power.engineerUsed)cell.classList.add('used');
    });
  }

  function decorateAllCards(room){
    const me=room?.players?.[currentPlayerId];
    if(me){
      document.querySelectorAll('#screenDashboard .bbV160OwnMiniCard,#screenDashboard .compactBingoCard,#screenDashboard .bbOverlayBingo,#screenDashboard .bbV176Card').forEach(c=>decoratePowerCells(c,me,currentPlayerId));
      const feedback=q('bbFeedbackOverlay');
      feedback?.querySelectorAll('.bbOverlayBingo').forEach(c=>decoratePowerCells(c,me,currentPlayerId));
    }
    const modal=q('bbV160CardModal');
    const viewed=room?.players?.[viewedPlayerId];
    if(modal&&viewed)modal.querySelectorAll('.bbV160OwnMiniCard').forEach(c=>decoratePowerCells(c,viewed,viewedPlayerId));
  }

  function updateHeader(room,r){
    const me=room?.players?.[currentPlayerId];
    const count=activeEntries(room).length;
    if(q('bbHostHeaderPlayers'))q('bbHostHeaderPlayers').textContent=`👥 ${count}`;
    if(q('modeText')){
      const role=isHostClient()?'HOST':'SPELER';
      q('modeText').textContent=me?`${role} • ${currentScore(me)} PT`:role;
    }
    const n=Number(r?.roundNumber||gameState(room).roundNumber||0);
    const block=((Math.max(1,n)-1)%5)+1;
    if(q('bbV176RoundProgress'))q('bbV176RoundProgress').textContent=`Ronde ${block} van 5`;
    if(q('bbV176RoundType')){
      q('bbV176RoundType').textContent=r?.isBingoBeats?'BINGOBEATS ROUND':'NORMALE RONDE';
      q('bbV176RoundType').classList.toggle('special',!!r?.isBingoBeats);
    }
  }

  function activeAdvantage(room,r){
    const adv=r?.advantage||gameState(room).activeAdvantage;
    if(!adv)return null;
    const n=Number(r?.roundNumber||gameState(room).roundNumber||0);
    return n>=Number(adv.startRound||0)&&n<=Number(adv.endRound||0)?adv:null;
  }

  function jokerOwnerFor(room,r){
    if(r?.jokerOwnerId)return r.jokerOwnerId;
    const adv=activeAdvantage(room,r);
    return adv?.type==='joker'&&adv.jokerUsed&&Number(adv.jokerRound)===Number(r?.roundNumber||0)?adv.ownerId:'';
  }

  function injectRoundBanner(root,room,r){
    if(!root||!r?.id)return;
    const adv=activeAdvantage(room,r);
    const jokerOwner=jokerOwnerFor(room,r);
    root.querySelectorAll('.bbV176GlobalBanner').forEach(el=>el.remove());
    if(jokerOwner){
      const owner=room.players?.[jokerOwner];
      const text=currentPlayerId===jokerOwner?`🃏 Jouw Joker is actief — alleen jouw antwoord telt.`:`🃏 ${cleanName(owner?.name)} gebruikt een Joker — alleen diens antwoord telt.`;
      const banner=document.createElement('div');banner.className='bbV176Banner bbV176GlobalBanner';banner.textContent=text;root.prepend(banner);
      if(currentPlayerId!==jokerOwner&&r.status==='answering'){
        const input=root.querySelector('#bbStageAnswerInput,#scoreAnswerInput');
        const button=root.querySelector('#bbStageSubmitBtn,#scoreSubmitAnswerBtn');
        if(input){input.disabled=true;input.placeholder='Joker actief';}
        if(button)button.disabled=true;
      }
    }
  }

  function lobbyExtras(root,room,r){
    if(!root?.classList.contains('bbV160LobbyStage'))return;
    const gs=gameState(room),adv=gs.activeAdvantage;
    if(adv?.type==='joker'&&adv.ownerId===currentPlayerId&&!adv.jokerUsed){
      let bar=root.querySelector('.bbV176BottomBar');
      if(!bar){bar=document.createElement('div');bar.className='bbV176BottomBar';root.appendChild(bar);}
      if(!bar.querySelector('.bbV176JokerBtn')){
        const btn=document.createElement('button');btn.type='button';btn.className='bbV176JokerBtn';btn.textContent='🃏 Gebruik Joker in volgende ronde';btn.addEventListener('click',activateJoker);bar.appendChild(btn);
      }
    }
  }

  async function activateJoker(){
    if(!currentRoomCode||!currentPlayerId)return;
    const ref=db.ref(`rooms/${currentRoomCode}/gameState`);
    const snap=await ref.once('value');const gs=snap.val()||{},adv=gs.activeAdvantage||{};
    if(adv.type!=='joker'||adv.ownerId!==currentPlayerId||adv.jokerUsed)return;
    await ref.child('activeAdvantage').update({jokerUsed:true,jokerRound:Number(gs.roundNumber||0)+1});
  }

  function normalPostRender(room,r){
    const root=q('screenDashboard');
    if(!root)return;
    decorateAllCards(room);
    injectRoundBanner(root,room,r);
    lobbyExtras(root,room,r);
  }

  function timerText(deadline){
    const left=Math.max(0,Math.ceil((Number(deadline||0)-now())/1000));
    return `00:${String(left).padStart(2,'0')}`;
  }

  function specialTop(room,r){
    const me=room.players?.[currentPlayerId]||{};
    const deadline=effectiveDeadline(room,r,currentPlayerId)||r.deadlineMs;
    return `<div class="bbV176Topbar"><div>${bbAnimalFor(currentPlayerId,me)} ${E(cleanName(me.name||currentPlayerName))} • ${currentScore(me)} PT</div><div class="bbV176Timer" data-bb-special-timer>${r.status==='answering'?timerText(deadline):'★'}</div><div>👥 ${activeEntries(room).length}</div></div>`;
  }

  function specialFields(){
    return [
      ['era','Voor of na 2001','Bijv. voor 2001'],
      ['artist','Naam van artiest','Artiest'],
      ['decade','Decennium','Bijv. jaren 90'],
      ['year','Jaartal ± 2','Bijv. 1998'],
      ['title','Titel van track','Titel']
    ].map(([id,label,placeholder])=>`<div class="bbV176Field"><label for="bbSpecial_${id}">${label}</label><input id="bbSpecial_${id}" data-special-field="${id}" maxlength="100" placeholder="${placeholder}" autocomplete="off"></div>`).join('');
  }

  function specialCardHtml(player,pid,canPick){
    const card=Array.isArray(player?.card)?player.card:[];
    const marked=player?.marked||{};
    const power=derivedPowerCells(pid,card,player?.powerCells);
    return `<div class="bbV176Card">${card.map((c,i)=>{
      const isMarked=!!marked[i]||c==='free';
      const pickable=canPick&&!isMarked;
      const icon=cardCellIcon(i,isMarked,power);
      return `<button type="button" class="bbV176Cell ${isMarked?'marked':''} ${pickable?'pickable':''}" data-i="${i}" style="--cell:${colorHex(c)}" ${pickable?'':'disabled'}>${icon}</button>`;
    }).join('')}</div>`;
  }

  function renderSpecial(room,r){
    const root=q('screenDashboard');if(!root)return;
    const me=room.players?.[currentPlayerId]||{};
    const ownAnswer=room.answers?.[r.id]?.[currentPlayerId];
    const result=room.specialResults?.[r.id]?.[currentPlayerId];
    const jokerOwner=jokerOwnerFor(room,r),jokerBlocked=!!jokerOwner&&jokerOwner!==currentPlayerId;
    const jokerName=cleanName(room.players?.[jokerOwner]?.name||'de blokwinnaar');
    activeRound=r;
    root.className='compactDashboard bbV176Stage';

    if(r.status==='picking'||r.status==='precount'||r.status==='ready'){
      root.innerHTML=`${specialTop(room,r)}<section class="bbV176MainCard bbV176Waiting"><div><div class="bbV176SpecialStar">★</div><div class="bbV176Kicker">BINGOBEATS ROUND</div><h2>Vijf categorieën.<br>Één nummer.</h2><p>${r.status==='ready'?'De muziek kan elk moment starten.':'De speciale ronde wordt klaargezet…'}</p></div></section><div class="bbV176Banner">60 seconden • 100 punten per goed antwoord • 4/5 = vrij vak</div>`;
    }else if(r.status==='answering'&&!ownAnswer&&jokerBlocked){
      root.innerHTML=`${specialTop(room,r)}<section class="bbV176MainCard bbV176Waiting"><div><div class="bbV176WaitingIcon">🃏</div><div class="bbV176Kicker">JOKER ACTIEF</div><h2>Alleen ${E(jokerName)} speelt deze ronde</h2><p>Jouw antwoorden tellen deze ronde automatisch als fout.</p></div></section><div class="bbV176Banner">De Joker geldt alleen voor deze ronde.</div>`;
    }else if(r.status==='answering'&&!ownAnswer){
      root.innerHTML=`${specialTop(room,r)}<section class="bbV176MainCard"><div class="bbV176SpecialForm"><div><div class="bbV176Kicker">BINGOBEATS ROUND</div><h2>Wat weet jij van dit nummer?</h2></div><div class="bbV176FiveFields">${specialFields()}</div><button type="button" id="bbV176SpecialSubmit" class="bbV176Submit">Verstuur alle 5 antwoorden</button></div></section><div class="bbV176Banner">${jokerOwner?'🃏 Jouw Joker is actief — alleen jouw antwoorden tellen.':'Vul alles in; een leeg veld telt als fout.'}</div>`;
      q('bbV176SpecialSubmit')?.addEventListener('click',submitSpecialAnswers);
    }else if((r.status==='answering'||r.status==='locked'||r.status==='review')&&ownAnswer){
      root.innerHTML=`${specialTop(room,r)}<section class="bbV176MainCard bbV176Waiting"><div><div class="bbV176WaitingIcon">🎧</div><div class="bbV176Kicker">ANTWOORDEN INGELEVERD</div><h2>Alles staat vast</h2><p>Wacht op de uitslag van de BingoBeats Round.</p></div></section><div class="bbV176Banner">Jouw vijf antwoorden zijn veilig opgeslagen.</div>`;
    }else if(r.status==='judged'&&result){
      const count=Number(result.count||0),canPick=count>=4&&me.lastPickedRound!==r.id;
      const details=Array.isArray(result.details)?result.details:[false,false,false,false,false];
      root.innerHTML=`${specialTop(room,r)}<section class="bbV176MainCard"><div class="bbV176Kicker">UITSLAG BINGOBEATS ROUND</div><h2>${count} van 5 goed</h2><p>${canPick?'Top! Kies nu één vrij vak op je kaart.':count>=4?'Je vrije vak is gekozen.':'Je hebt minimaal 4 goede antwoorden nodig voor een vrij vak.'}</p><div class="bbV176ResultGrid">${details.map(ok=>`<span class="${ok?'good':'bad'}">${ok?'✓':'×'}</span>`).join('')}</div><div class="bbV176Points"><span>Deze ronde</span><strong>+${count*100}</strong></div>${specialCardHtml(me,currentPlayerId,canPick)}</section><div class="bbV176BottomBar"><div class="bbV176Banner">${canPick?'Tik op ieder nog leeg vak — ook Bomb of Engineer kan hieronder zitten.':'Maak je klaar voor het volgende blok.'}</div>${canPick?'':'<button type="button" id="bbV176ReadyNext">READY</button>'}</div>`;
      root.querySelectorAll('.bbV176Cell.pickable').forEach(btn=>btn.addEventListener('click',()=>pickCell(Number(btn.dataset.i))));
      q('bbV176ReadyNext')?.addEventListener('click',()=>db.ref(`rooms/${currentRoomCode}/players/${currentPlayerId}/ready`).set(true));
      decorateAllCards(room);
    }else{
      root.innerHTML=`${specialTop(room,r)}<section class="bbV176MainCard bbV176Waiting"><div><div class="bbV176WaitingIcon">⚖️</div><h2>Uitslag wordt berekend</h2><p>Een ogenblik…</p></div></section><div></div>`;
    }
    updateSpecialTimer(room,r);
    updateHeader(room,r);
    maybeShowAdvantage(room);
  }

  let specialTimerId=null;
  function updateSpecialTimer(room,r){
    clearInterval(specialTimerId);
    if(r?.status!=='answering')return;
    const tick=()=>{
      const el=document.querySelector('[data-bb-special-timer]');
      if(!el)return;
      const deadline=effectiveDeadline(room,r,currentPlayerId)||r.deadlineMs;
      el.textContent=timerText(deadline);
      if(Number(deadline||0)<=now())clearInterval(specialTimerId);
    };
    tick();specialTimerId=setInterval(tick,250);
  }

  async function submitSpecialAnswers(){
    if(!currentRoomCode||!currentPlayerId||!activeRound?.id)return;
    const fields={};document.querySelectorAll('[data-special-field]').forEach(input=>fields[input.dataset.specialField]=String(input.value||'').trim().slice(0,100));
    if(Object.values(fields).every(v=>!v))return alert('Vul eerst je antwoorden in.');
    const round=(await db.ref(`rooms/${currentRoomCode}/currentRound`).once('value')).val()||{};
    if(round.id!==activeRound.id||round.status!=='answering')return alert('De antwoordtijd is voorbij.');
    const deadline=effectiveDeadline(lastRoomSnapshot||{},round,currentPlayerId)||round.deadlineMs;
    if(deadline&&now()>deadline+300)return alert('De antwoordtijd is voorbij.');
    const ref=db.ref(`rooms/${currentRoomCode}/answers/${round.id}/${currentPlayerId}`);
    const payload={special:true,answers:fields,answer:Object.values(fields).join(' | '),submittedAt:firebase.database.ServerValue.TIMESTAMP};
    const result=await ref.transaction(current=>current||payload,false);
    if(!result.committed)alert('Je antwoorden waren al ingeleverd.');
  }

  function norm(value){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' en ').replace(/[^a-z0-9]+/g,' ').trim();}
  function wordSimilarity(given,correct){
    const a=norm(given),b=norm(correct);if(!a||!b)return false;if(a===b||a.includes(b)||b.includes(a))return true;
    const aa=new Set(a.split(' ').filter(x=>x.length>1)),bb=new Set(b.split(' ').filter(x=>x.length>1));
    const common=[...aa].filter(x=>bb.has(x)).length;return common>=Math.max(1,Math.ceil(Math.min(aa.size,bb.size)*.65));
  }
  function evaluateSpecial(answer,correct){
    const a=answer?.answers||{};
    const year=Number(String(correct?.year||'').match(/\d{4}/)?.[0]||0);
    const eraCorrect=year&&year<=2001?'voor':'na';
    const era=norm(a.era);
    const eraOk=eraCorrect==='voor'?/(voor|before|ouder|tot|<)/.test(era):/(na|after|nieuwer|vanaf|>)/.test(era);
    const artistOk=wordSimilarity(a.artist,correct?.artist);
    const decade=Math.floor(year/10)*10;
    const decadeText=norm(a.decade).replace(/jaren|jaar|s/g,'');
    const decadeOk=!!year&&(decadeText.includes(String(decade))||decadeText.includes(String(decade%100).padStart(2,'0')));
    const givenYear=Number(String(a.year||'').match(/\d{4}/)?.[0]||0);
    const yearOk=!!year&&!!givenYear&&Math.abs(givenYear-year)<=2;
    const titleOk=wordSimilarity(a.title,correct?.track);
    const details=[eraOk,artistOk,decadeOk,yearOk,titleOk];
    return{details,count:details.filter(Boolean).length};
  }

  async function evaluateSpecialRound(roomCode,roundId){
    const room=(await db.ref(`rooms/${roomCode}`).once('value')).val()||{};
    const r=room.currentRound||{};if(r.id!==roundId)return;
    const correct=r.correctAnswer||answerObject?.()||{};
    const answers=room.answers?.[roundId]||{},jokerOwner=jokerOwnerFor(room,r);
    const updates={};
    for(const [pid] of activeEntries(room)){
      const blocked=!!jokerOwner&&pid!==jokerOwner;
      const result=blocked?{details:[false,false,false,false,false],count:0}:evaluateSpecial(answers[pid]||{},correct);
      updates[`specialResults/${roundId}/${pid}`]={...result,eligibleFreePick:!blocked&&result.count>=4,jokerBlocked:blocked};
      updates[`correct/${roundId}/${pid}`]=!blocked&&result.count>=4;
      if(blocked||result.count<4)updates[`players/${pid}/ready`]=true;
    }
    updates['currentRound/status']='judged';
    updates['currentRound/correctAnswer']=correct;
    updates['currentRound/correctAnswerShown']=true;
    await db.ref(`rooms/${roomCode}`).update(updates);
  }

  async function scoreRound(room,r){
    if(scoringBusy||!isHostClient()||!currentRoomCode||!r?.id||r.status!=='judged')return;
    if(room.scoredRounds?.[r.id])return;
    scoringBusy=true;
    let claimRef=null,claimCommitted=false;
    try{
      claimRef=db.ref(`rooms/${currentRoomCode}/scoreClaims/${safeKey(r.id)}`);
      const claim=await claimRef.transaction(current=>current?undefined:{at:firebase.database.ServerValue.TIMESTAMP,by:currentPlayerId||'host'},false);
      if(!claim.committed)return;
      claimCommitted=true;
      const latest=(await db.ref(`rooms/${currentRoomCode}`).once('value')).val()||{};
      const round=latest.currentRound||{};
      if(round.id!==r.id||latest.scoredRounds?.[r.id]){try{await claimRef.remove();}catch(_e){}return;}
      const entries=activeEntries(latest),points={},answers=latest.answers?.[r.id]||{},correct=latest.correct?.[r.id]||{},updates={};
      if(round.isBingoBeats){
        const jokerOwner=jokerOwnerFor(latest,round);
        for(const [pid] of entries)points[pid]=jokerOwner&&pid!==jokerOwner?0:Number(latest.specialResults?.[r.id]?.[pid]?.count||0)*100;
      }else{
        const good=entries.filter(([pid])=>correct[pid]===true&&(!round.jokerOwnerId||pid===round.jokerOwnerId)).map(([pid])=>pid);
        let fastest='';
        if(good.length){fastest=good.slice().sort((a,b)=>Number(answers[a]?.submittedAt||Infinity)-Number(answers[b]?.submittedAt||Infinity))[0];}
        for(const [pid] of entries){
          let isGood=correct[pid]===true;
          if(round.jokerOwnerId&&pid!==round.jokerOwnerId){isGood=false;updates[`correct/${r.id}/${pid}`]=false;}
          points[pid]=isGood?100+(pid===fastest?50:0):0;
        }
      }
      let winnerId='',winnerBlock=-Infinity;
      for(const [pid,p] of entries){
        const add=Number(points[pid]||0),newScore=currentScore(p)+add,newBlock=currentBlockScore(p)+add;
        updates[`players/${pid}/score`]=newScore;updates[`players/${pid}/blockScore`]=newBlock;updates[`roundPoints/${r.id}/${pid}`]=add;
        if(newBlock>winnerBlock){winnerBlock=newBlock;winnerId=pid;}
      }
      updates[`scoredRounds/${r.id}`]=true;
      if(round.isBingoBeats&&winnerId){
        updates['gameState/pendingAdvantageWinnerId']=winnerId;
        updates['gameState/pendingAdvantageWinnerName']=cleanName(latest.players?.[winnerId]?.name);
        updates['gameState/pendingAdvantageRound']=Number(round.roundNumber||0);
        updates['gameState/lastBlockWinnerId']=winnerId;
      }
      await db.ref(`rooms/${currentRoomCode}`).update(updates);
    }catch(error){
      console.error('V176 scoreRound',error);
      if(claimCommitted&&claimRef)try{await claimRef.remove();}catch(_e){}
    }finally{scoringBusy=false;}
  }

  function maybeShowAdvantage(room){
    const gs=gameState(room),winner=gs.pendingAdvantageWinnerId;
    if(!winner||winner!==currentPlayerId)return hideOverlay('bbV176AdvantageOverlay');
    if(q('bbV176AdvantageText'))q('bbV176AdvantageText').textContent=`${cleanName(gs.pendingAdvantageWinnerName||room.players?.[winner]?.name)}, je won dit blok. Kies één voordeel voor de volgende vijf rondes.`;
    showOverlay('bbV176AdvantageOverlay');
  }

  async function chooseAdvantage(type){
    if(!ADVANTAGES[type]||!currentRoomCode||!currentPlayerId)return;
    const room=(await db.ref(`rooms/${currentRoomCode}`).once('value')).val()||{},gs=gameState(room);
    if(gs.pendingAdvantageWinnerId!==currentPlayerId)return;
    const startRound=Number(gs.roundNumber||0)+1,endRound=startRound+4;
    const adv={type,ownerId:currentPlayerId,ownerName:cleanName(room.players?.[currentPlayerId]?.name),startRound,endRound,chosenAt:firebase.database.ServerValue.TIMESTAMP,jokerUsed:false};
    const updates={'gameState/activeAdvantage':adv,'gameState/pendingAdvantageWinnerId':null,'gameState/pendingAdvantageWinnerName':null,'gameState/pendingAdvantageRound':null};
    Object.keys(room.players||{}).forEach(pid=>updates[`players/${pid}/blockScore`]=0);
    if(type==='engineer'){
      const p=room.players?.[currentPlayerId]||{},power=derivedPowerCells(currentPlayerId,p.card,p.powerCells);
      updates[`players/${currentPlayerId}/powerCells`]={...power,engineerFound:true,engineerActive:true,engineerUsed:false};
    }
    if(type==='doubleTrouble'){
      for(const [pid,p] of Object.entries(room.players||{}))if(pid!==currentPlayerId){
        const power=derivedPowerCells(pid,p.card,p.powerCells),idx=secondBombIndex(pid,p.card,power);
        if(Number.isInteger(idx))updates[`players/${pid}/powerCells`]={...power,bomb2Index:idx,bomb2Triggered:false};
      }
    }
    await db.ref(`rooms/${currentRoomCode}`).update(updates);
    hideOverlay('bbV176AdvantageOverlay');
  }

  async function startSpecialRound(){
    hideOverlay('bbV176SpecialOverlay');
    if(!currentRoomCode)return false;
    const preflightAt=Number(localStorage.bb_spotify_preflight_ok_at||0);
    if(!preflightAt||Date.now()-preflightAt>60*60*1000){alert('Doe eerst de knop TEST VOOR JE BEGINT.');return false;}
    const room=(await db.ref(`rooms/${currentRoomCode}`).once('value')).val()||{};
    const next=pendingSpecialRound||Number(gameState(room).roundNumber||0)+1;
    if(next%5!==0)return false;
    if(typeof allReady==='function'&&!allReady(room)){alert('Nog niet iedereen is READY.');return false;}
    if(!Array.isArray(tracks)||!tracks.length){alert('Laad eerst een Spotify-playlist.');return false;}
    const claim=await db.ref(`rooms/${currentRoomCode}/startClaims/special_${next}`).transaction(current=>current?undefined:{at:firebase.database.ServerValue.TIMESTAMP,by:currentPlayerId||'host'},false);
    if(!claim.committed)return false;
    currentTrack=chooseTrack();if(!currentTrack){await db.ref(`rooms/${currentRoomCode}/startClaims/special_${next}`).remove();return false;}
    currentRoundId='bb_'+Date.now();
    const updates={};activeEntries(room).forEach(([pid])=>updates[`players/${pid}/ready`]=false);
    const adv=gameState(room).activeAdvantage||null;
    const jokerOwner=adv?.type==='joker'&&adv.jokerUsed&&Number(adv.jokerRound)===next?adv.ownerId:null;
    updates['gameState/roundNumber']=next;updates['gameState/blockRound']=5;updates['gameState/specialIntro']=null;
    updates['currentRound']={id:currentRoundId,status:'picking',isBingoBeats:true,roundNumber:next,blockRound:5,seconds:60,pickerStartedAt:firebase.database.ServerValue.TIMESTAMP,advantage:adv,jokerOwnerId:jokerOwner};
    await db.ref(`rooms/${currentRoomCode}`).update(updates);
    localStorage.setItem('bb_round_track_'+currentRoomCode,JSON.stringify({roundId:currentRoundId,track:currentTrack}));
    if(q('hostPickerArea'))q('hostPickerArea').innerHTML='<div class="bbV176SpecialStar">★</div><h2>BingoBeats Round</h2><p>Vijf categorieën • zestig seconden</p>';
    if(q('playBtn'))q('playBtn').disabled=true;
    await wait(1700);
    await db.ref(`rooms/${currentRoomCode}/currentRound`).update({status:'ready'});
    if(q('playBtn'))q('playBtn').disabled=false;
    if(q('showAnswerBtn'))q('showAnswerBtn').disabled=false;
    pendingSpecialRound=0;
    return true;
  }

  async function showSpecialRoundIntro(next){
    pendingSpecialRound=next;
    const nonce=`special_${next}_${Date.now()}`;
    await db.ref(`rooms/${currentRoomCode}/gameState/specialIntro`).set({active:true,roundNumber:next,nonce,at:firebase.database.ServerValue.TIMESTAMP});
    showSpecialIntro(true,nonce);
  }

  async function playSpecial(){
    try{
      if(!currentTrack)return alert('Geen nummer gekozen.');
      if(!deviceId){await activatePlayer();await wait(1200);}
      if(!deviceId)return alert('Geen Spotify-speler actief. Activeer eerst de Spotify-speler.');
      let pos=0,duration=60000;
      if(q('randomStart')?.checked&&currentTrack.duration_ms>duration+40000){const max=Math.max(0,currentTrack.duration_ms-duration-5000);pos=Math.floor(20000+Math.random()*Math.max(1,max-20000));}
      await api(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,{method:'PUT',body:JSON.stringify({uris:[currentTrack.uri],position_ms:pos})});
      const deadline=now()+duration;
      await db.ref(`rooms/${currentRoomCode}/currentRound`).update({status:'answering',deadlineMs:deadline,musicStartedAt:firebase.database.ServerValue.TIMESTAMP});
      if(q('playBtn')){q('playBtn').disabled=true;q('playBtn').textContent='★ BingoBeats Round speelt';}
      if(q('stopBtn'))q('stopBtn').disabled=false;
      clearTimeout(lockTimer);lockTimer=setTimeout(()=>lockRound(),duration+150);
      clearTimeout(stopTimer);stopTimer=setTimeout(()=>stopPlayback(),duration);
    }catch(error){alert('Afspelen mislukt: '+(error.message||error));}
  }

  async function lockSpecial(){
    if(!currentRoomCode)return;
    await publishAnswer();
    const r=(await db.ref(`rooms/${currentRoomCode}/currentRound`).once('value')).val()||{};
    if(!r.id||!r.isBingoBeats)return;
    await db.ref(`rooms/${currentRoomCode}/currentRound`).update({status:'locked'});
    await evaluateSpecialRound(currentRoomCode,r.id);
  }

  async function pickWithPower(index){
    if(!currentRoomCode||!currentPlayerId||!activeRound?.id)return;
    const room=lastRoomSnapshot||(await db.ref(`rooms/${currentRoomCode}`).once('value')).val()||{};
    const specialCount=Number(room.specialResults?.[activeRound.id]?.[currentPlayerId]?.count||0);
    const freeChoice=!!activeRound.isBingoBeats&&specialCount>=4;
    const ref=db.ref(`rooms/${currentRoomCode}/players/${currentPlayerId}`);
    let event='';let announce=false;
    const result=await ref.transaction(data=>{
      const p=data||{},card=Array.isArray(p.card)?p.card:[],marked={...(p.marked||{})},power=derivedPowerCells(currentPlayerId,card,p.powerCells);
      if(!card[index]||card[index]==='free'||marked[index]||p.lastPickedRound===activeRound.id)return;
      if(!freeChoice&&card[index]!==activeRound.colorKey)return;
      const isBomb1=index===power.bombIndex&&!power.bombTriggered;
      const isBomb2=index===power.bomb2Index&&!power.bomb2Triggered;
      if(index===power.engineerIndex&&!power.engineerFound){
        marked[index]=true;power.engineerFound=true;power.engineerActive=true;event='engineer';
      }else if(isBomb1||isBomb2){
        if(isBomb1)power.bombTriggered=true;else power.bomb2Triggered=true;
        if(power.engineerActive&&!power.engineerUsed){
          marked[index]=true;power.engineerUsed=true;power.engineerActive=false;event='repaired';
        }else{
          Object.keys(marked).forEach(k=>delete marked[k]);event='bomb';
        }
      }else marked[index]=true;
      const bingo=typeof checkBingo==='function'?checkBingo(marked):false;announce=bingo&&!p.bingo;
      return{...p,marked,powerCells:power,bingo:!!(p.bingo||bingo),lastPickedRound:activeRound.id,lastPickedIndex:index,ready:true};
    },false);
    if(result.committed){
      if(event)effectPopup(event);
      if(announce)await db.ref(`rooms/${currentRoomCode}/bingos`).push({name:currentPlayerName,playerId:currentPlayerId,roundId:activeRound.id,at:firebase.database.ServerValue.TIMESTAMP});
    }
  }

  async function resetGameSameRoom(){
    if(!currentRoomCode){closeNewGameModal?.();return;}
    try{
      const room=(await db.ref(`rooms/${currentRoomCode}`).once('value')).val()||{},updates={currentRound:null,answers:null,correct:null,bingos:null,bingoDecision:null,juryMeta:null,juryVotes:null,juryResults:null,juryClaims:null,lockClaims:null,startClaims:null,scoreClaims:null,scoredRounds:null,roundPoints:null,specialResults:null,gameState:{roundNumber:0,blockRound:0,version:V,createdAt:firebase.database.ServerValue.TIMESTAMP}};
      for(const pid of Object.keys(room.players||{})){
        const card=genCard(),power=derivedPowerCells(pid,card,null);
        updates[`players/${pid}/card`]=card;updates[`players/${pid}/marked`]={};updates[`players/${pid}/powerCells`]=power;updates[`players/${pid}/bingo`]=false;updates[`players/${pid}/ready`]=false;updates[`players/${pid}/lastPickedRound`]=null;updates[`players/${pid}/lastPickedIndex`]=null;updates[`players/${pid}/score`]=0;updates[`players/${pid}/blockScore`]=0;
      }
      await db.ref(`rooms/${currentRoomCode}`).update(updates);
      closeNewGameModal?.();q('hostBingoPanel')?.classList.add('hidden');q('bingoFullOverlay')?.classList.add('hidden');
      if(q('hostStatus'))q('hostStatus').textContent='Nieuw spel gestart. Scores en speciale vakken zijn gereset.';
    }catch(error){alert('Nieuw spel starten mislukt: '+(error.message||error));}
  }

  function roomUpdate(room,r){
    lastRoomSnapshot=room||{};lastRoundSnapshot=r||{};
    updateHeader(room,r);
    const intro=gameState(room).specialIntro;
    if(intro?.active&&intro.nonce){
      if(isHostClient()){
        pendingSpecialRound=Number(intro.roundNumber||0);
        showSpecialIntro(true,intro.nonce);
      }else showSpecialIntro(false,intro.nonce);
    }
    if(!intro?.active&&r?.isBingoBeats)hideOverlay('bbV176SpecialOverlay');
    if(!isHostClient()&&!r?.id)showLobbyRules(false);
    maybeShowAdvantage(room);
    if(r?.status==='judged')scoreRound(room,r);
    if(isHostClient()&&r?.isBingoBeats&&r.status==='judged'&&room.scoredRounds?.[r.id]&&!gameState(room).pendingAdvantageWinnerId&&typeof allReady==='function'&&allReady(room)){
      const hasBingo=Object.values(room.bingos||{}).some(b=>b?.roundId===r.id);
      const key=`${currentRoomCode||''}:${r.id}`;
      if(!hasBingo&&autoStartedAfterAdvantage!==key){
        autoStartedAfterAdvantage=key;
        setTimeout(()=>startRound(),650);
      }
    }
  }

  function wireUi(){
    q('bbV176RulesClose')?.addEventListener('click',closeLobbyRules);
    q('bbV176RulesCloseX')?.addEventListener('click',closeLobbyRules);
    q('bbJoinRulesBtn')?.addEventListener('click',()=>showLobbyRules(true));
    q('bbV176SpecialStart')?.addEventListener('click',startSpecialRound);
    q('bbV176SpecialPlayerClose')?.addEventListener('click',()=>hideOverlay('bbV176SpecialOverlay'));
    q('bbV176SpecialCloseX')?.addEventListener('click',()=>hideOverlay('bbV176SpecialOverlay'));
    document.querySelectorAll('[data-bb-advantage]').forEach(btn=>btn.addEventListener('click',()=>chooseAdvantage(btn.dataset.bbAdvantage)));
    try{db?.ref?.('.info/serverTimeOffset').on('value',s=>serverOffset=Number(s.val()||0));}catch(e){}
    if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(error=>console.warn('Service worker niet actief:',error));
  }

  /* ---- Patch de bestaande V175-functies zonder de Spotify/Firebase-basis te vervangen. ---- */
  const previousCreateRoom=typeof createRoom==='function'?createRoom:null;
  if(previousCreateRoom)createRoom=async function(){const code=await previousCreateRoom.apply(this,arguments);const room=code||currentRoomCode;if(room)await ensureRoomState(room).catch(console.error);return room;};

  const previousRestoreHost=typeof restoreHost==='function'?restoreHost:null;
  if(previousRestoreHost)restoreHost=function(){const result=previousRestoreHost.apply(this,arguments);setTimeout(()=>ensureRoomState(currentRoomCode).catch(()=>{}),450);return result;};

  const previousJoin=typeof joinPlayer==='function'?joinPlayer:null;
  if(previousJoin)joinPlayer=function(){const result=previousJoin.apply(this,arguments);setTimeout(()=>{ensurePlayerPower(currentRoomCode,currentPlayerId).catch(()=>{});showLobbyRules(false);},650);return result;};

  if(typeof window.bbEnsureHostPlayer==='function'){
    const previousEnsureHost=window.bbEnsureHostPlayer;
    window.bbEnsureHostPlayer=async function(room){const result=await previousEnsureHost.apply(this,arguments);await ensurePlayerPower(room,currentPlayerId).catch(()=>{});await ensureRoomState(room).catch(()=>{});return result;};
  }

  const previousStartRound=typeof startRound==='function'?startRound:null;
  if(previousStartRound)startRound=async function(){
    if(!currentRoomCode)return false;
    const before=(await db.ref(`rooms/${currentRoomCode}`).once('value')).val()||{};
    const pendingWinner=gameState(before).pendingAdvantageWinnerId;
    if(pendingWinner&&before.players?.[pendingWinner]?.online!==false){if(q('hostStatus'))q('hostStatus').textContent=`Wachten tot ${cleanName(before.players?.[pendingWinner]?.name)} een voordeel kiest.`;return false;}
    const next=Number(gameState(before).roundNumber||0)+1;
    if(next%5===0){await showSpecialRoundIntro(next);return false;}
    const oldId=before.currentRound?.id||'';
    const result=await previousStartRound.apply(this,arguments);
    if(result===false)return false;
    for(let i=0;i<12;i++){
      await wait(100);
      const room=(await db.ref(`rooms/${currentRoomCode}`).once('value')).val()||{},r=room.currentRound||{};
      if(r.id&&r.id!==oldId){
        const adv=gameState(before).activeAdvantage||null;
        const jokerOwner=adv?.type==='joker'&&adv.jokerUsed&&Number(adv.jokerRound)===next?adv.ownerId:null;
        await db.ref(`rooms/${currentRoomCode}`).update({'gameState/roundNumber':next,'gameState/blockRound':((next-1)%5)+1,'currentRound/roundNumber':next,'currentRound/blockRound':((next-1)%5)+1,'currentRound/isBingoBeats':false,'currentRound/advantage':adv,'currentRound/jokerOwnerId':jokerOwner});
        return result;
      }
    }
    return result;
  };

  const previousPlayHidden=typeof playHidden==='function'?playHidden:null;
  if(previousPlayHidden)playHidden=async function(){
    const r=(await db.ref(`rooms/${currentRoomCode}/currentRound`).once('value')).val()||{};
    return r.isBingoBeats?playSpecial():previousPlayHidden.apply(this,arguments);
  };

  const previousLockRound=typeof lockRound==='function'?lockRound:null;
  if(previousLockRound)lockRound=async function(){
    const r=currentRoomCode?(await db.ref(`rooms/${currentRoomCode}/currentRound`).once('value')).val()||{}:{};
    return r.isBingoBeats?lockSpecial():previousLockRound.apply(this,arguments);
  };

  const previousPublishResults=typeof publishResults==='function'?publishResults:null;
  if(previousPublishResults)publishResults=async function(){
    const r=currentRoomCode?(await db.ref(`rooms/${currentRoomCode}/currentRound`).once('value')).val()||{}:{};
    return r.isBingoBeats?lockSpecial():previousPublishResults.apply(this,arguments);
  };

  submitAnswerValue=async function(value){
    const answer=String(value||'').trim();if(!answer)return alert('Vul eerst je antwoord in.');
    if(!currentRoomCode||!currentPlayerId||!activeRound?.id)return;
    const room=(await db.ref(`rooms/${currentRoomCode}`).once('value')).val()||{},round=room.currentRound||{};
    if(round.id!==activeRound.id||round.status!=='answering')return alert('Deze antwoordronde is afgelopen.');
    const deadline=effectiveDeadline(room,round,currentPlayerId);
    if(deadline&&now()>deadline+300)return alert('De antwoordtijd is voorbij.');
    const payload={answer:answer.slice(0,100),submittedAt:firebase.database.ServerValue.TIMESTAMP};
    const result=await db.ref(`rooms/${currentRoomCode}/answers/${round.id}/${currentPlayerId}`).transaction(current=>current||payload,false);
    if(!result.committed)alert('Je antwoord was al ingeleverd.');
  };

  pickCell=pickWithPower;
  bbStartNewGameSameRoom=resetGameSameRoom;

  if(typeof renderCompactDashboard==='function'){
    const previousRender=renderCompactDashboard;
    renderCompactDashboard=function(room,r){
      roomUpdate(room,r);
      if(r?.isBingoBeats){renderSpecial(room,r);return;}
      const adjusted=r?.id?{...r,deadlineMs:effectiveDeadline(room,r,currentPlayerId)||r.deadlineMs}:r;
      const view=adjusted&&adjusted!==r?{...room,currentRound:adjusted}:room;
      const result=previousRender.call(this,view,adjusted);
      requestAnimationFrame(()=>normalPostRender(room,r));
      return result;
    };
  }

  if(typeof renderHostPlayers==='function'){
    const previousHostPlayers=renderHostPlayers;
    renderHostPlayers=function(room){
      const result=previousHostPlayers.apply(this,arguments);
      roomUpdate(room,room?.currentRound||{});
      const box=q('hostPlayers');
      if(box){
        box.querySelectorAll('.bbV160HostChip').forEach((row,index)=>{
          const entry=activeEntries(room)[index];if(!entry)return;
          let score=row.querySelector('.bbV176HostScore');
          if(!score){score=document.createElement('em');score.className='bbV176HostScore';row.appendChild(score);}
          score.textContent=`${currentScore(entry[1])} pt`;
        });
      }
      return result;
    };
  }

  if(typeof window.bbV160ShowCard==='function'){
    const previousShowCard=window.bbV160ShowCard;
    window.bbV160ShowCard=function(pid){viewedPlayerId=pid;const result=previousShowCard.apply(this,arguments);setTimeout(()=>decorateAllCards(lastRoomSnapshot||{}),0);return result;};
  }

  document.addEventListener('DOMContentLoaded',()=>setTimeout(wireUi,80));
  window.bbV176={showLobbyRules,startSpecialRound,chooseAdvantage,ensureRoomState};
})();
