import { ranks, score, cmp, bestFive, handNames } from './poker.js';
import { decide } from './ai.js';
import {
  live as getLive,
  activeCount as countActive,
  eligible as isEligible,
  clearActedFlags as resetActedFlags,
  hasActedThisStreet as didAct,
  rebuildQueueFromStart as makeActionQueue,
  dequeue as removeFromQueue,
  queueHead as getQueueHead
} from './round.js';
import { card, miniCard, fmt } from './format.js';
import {
  getBetChipConfig,
  getBetChipCount,
  getBetChipClass
} from './chips.js';
import { createShuffledDeck } from './deck.js';
import { initBugReport } from './report.js';
import { getStartingStack, getBlindLevels } from './tournament.js';
(()=>{'use strict';
const suits=[['♠',0],['♥',1],['♦',1],['♣',0]];
const $=id=>document.getElementById(id),user=0;
const seatClass=['s3','s2','s0','s1'],cardPos=['','c2','c0','c1'];
const streetNames=['ПРЕФЛОП','ФЛОП','ТЁРН','РИВЕР','ШОУДАУН'],N=4;
const GAME_VERSION='v0.5.6 alpha';
const DISPLAY_VERSION=GAME_VERSION;
const BLIND_LEVELS={
 classic:[[10,20],[25,50],[50,100],[100,200],[150,300],[200,400],[250,500],[300,600],[400,800]],
 highroller:[[100,200],[200,400],[250,500],[500,1000],[750,1500],[1000,2000],[1500,3000],[2000,4000],[4000,8000]]
};
let tournamentMode='classic',blindLevel=0,blindRemaining=180000,blindDeadline=0,tournamentTimer=null,tournamentDisplayTimer=null;
const BUG_REPORT_ENDPOINT='https://pokereza-bug-reporter.17-rezan.workers.dev/report';
const feedbackReminderShown=new Set();
let players=[],deck=[],board=[],pot=0,currentBet=0,street=0,actor=-1,handNo=0;
let over=false,busy=false,sb=10,bb=20,log=[],tick=0,turnTimer=null,actQueue=[],firstToAct=3;
let renderedBoardCount=0,winnerIds=[],winnerPayouts={},winnerCombo='';
let humanWinnerReveal=false,winningCards=[],humanFoldedCards=false;
let aiWinnerReveal=false,aiWinnerId=-1,aiWinningCards=[];
let chipFlightId=0,blindSequenceTimer=null,gameStarted=false,gamePaused=false,savedGameState=null;
let pendingAISeat=-1;

function modeStartingStack(){return tournamentMode==='highroller'?10000:1000}
function currentBlindLevels(){return BLIND_LEVELS[tournamentMode]||BLIND_LEVELS.classic}
function applyTournamentMode(resetClock=true){
 const high=tournamentMode==='highroller';
 const slider=$('betRange');
 slider.min=high?'200':'20';
 slider.max=high?'10000':'1000';
 slider.step='10';
 const current=Number(slider.value)||Number(slider.min);
 slider.value=String(Math.min(Number(slider.max),Math.max(Number(slider.min),current)));
 $('betValue').textContent=slider.value;
 $('table').classList.toggle('high-roller',high);
 $('tableWatermark').textContent=high?'HIGH ROLLER':'POKEREZA';
 if(resetClock){blindLevel=0;blindRemaining=180000}
 [sb,bb]=currentBlindLevels()[blindLevel]||currentBlindLevels()[0];
 updateTournamentDisplay();
}
function updateTournamentDisplay(){
 const high=tournamentMode==='highroller';
 $('blindsDisplay').textContent=`БЛАЙНДЫ ${fmt(sb)} / ${fmt(bb)}`;
 $('handStatus').textContent=high?`HIGH ROLLER · УР. ${blindLevel+1} · ${Math.ceil(Math.max(0,blindRemaining)/1000)}с`:'';
 $('table').classList.toggle('high-roller',high);
 $('tableWatermark').textContent=high?'HIGH ROLLER':'POKEREZA';
}
function stopTournamentClock(preserve=true){
 if(tournamentTimer!==null){if(preserve)blindRemaining=Math.max(0,blindDeadline-Date.now());clearTimeout(tournamentTimer);tournamentTimer=null}
 if(tournamentDisplayTimer!==null){clearInterval(tournamentDisplayTimer);tournamentDisplayTimer=null}
}
function startTournamentClock(){
 if(gamePaused||tournamentTimer!==null)return;
 if(blindRemaining<=0)blindRemaining=180000;
 blindDeadline=Date.now()+blindRemaining;
 tournamentDisplayTimer=setInterval(()=>{blindRemaining=Math.max(0,blindDeadline-Date.now());updateTournamentDisplay()},250);
 tournamentTimer=setTimeout(()=>{
  tournamentTimer=null;
  if(tournamentDisplayTimer!==null){clearInterval(tournamentDisplayTimer);tournamentDisplayTimer=null}
  if(gamePaused)return;
  const levels=currentBlindLevels();
  if(blindLevel<levels.length-1){
   blindLevel++;[sb,bb]=levels[blindLevel];blindRemaining=180000;updateTournamentDisplay();render();startTournamentClock();
  }else{
   blindRemaining=0;updateTournamentDisplay();
  }
 },blindRemaining);
}
function chooseTournament(mode){
 tournamentMode=mode;applyTournamentMode(true);
 $('tournamentOverlay').classList.remove('visible');
 if(!gameStarted){players.forEach(p=>p.stack=modeStartingStack())}
 else if(gamePaused){savedGameState=null;resetStacksAndRestart()}
}
function capUpdateHistory(){
 const list=$('updateList');
 if(!list)return;
 while(list.querySelectorAll('.update-item').length>20){
  const items=list.querySelectorAll('.update-item');
  items[items.length-1].remove();
 }
}
function setUpdatesExpanded(expanded){
 const list=$('updateList'),button=$('toggleUpdatesButton');
 if(!list||!button)return;
 list.classList.toggle('show-all',expanded);
 button.textContent=expanded?'СКРЫТЬ ВСЕ':'ПОКАЗАТЬ ЕЩЁ';
 button.setAttribute('aria-expanded',String(expanded));
 button.hidden=list.querySelectorAll('.update-item').length<=5;
}
capUpdateHistory();
setUpdatesExpanded(false);
$('toggleUpdatesButton').addEventListener('click',()=>{
 const list=$('updateList');
 setUpdatesExpanded(!list.classList.contains('show-all'));
});

function collectBetsIntoPot(){const amount=players.reduce((sum,p)=>sum+(Number(p.bet)||0),0);if(amount>0){pot+=amount;players.forEach(p=>{p.bet=0})}currentBet=0}
function clearTurnTimer(){if(turnTimer!==null){clearTimeout(turnTimer);turnTimer=null}}
function clearBlindSequence(){if(blindSequenceTimer!==null){clearTimeout(blindSequenceTimer);blindSequenceTimer=null}}
function clearActionTimers(){
 players.forEach(p=>{if(p.actionTimer){clearTimeout(p.actionTimer);p.actionTimer=null}p.actionId=(p.actionId||0)+1;p.action='';p.actionAmount=0;p.labelAction='';p.labelAmount=0});
 document.querySelectorAll('.flying-chip').forEach(el=>el.remove());
}
function showAction(i,text,amount=0,duration=2000){
 const p=players[i];if(!p)return;if(p.actionTimer){clearTimeout(p.actionTimer);p.actionTimer=null}
 p.actionId=(p.actionId||0)+1;const id=p.actionId,label=String(text).toUpperCase();
 p.action=label;p.actionAmount=Number(amount)||0;p.labelAction=label;p.labelAmount=0;
 p.actionTimer=setTimeout(()=>{if(p.actionId!==id)return;p.actionTimer=null;p.labelAction='';p.labelAmount=0;if(!gamePaused)render()},duration);
}
function showThinking(i){
 const p=players[i];if(!p)return;if(p.actionTimer){clearTimeout(p.actionTimer);p.actionTimer=null}
 p.actionId=(p.actionId||0)+1;const id=p.actionId;p.labelAction='ДУМАЕТ';p.labelAmount=0;
 p.actionTimer=setTimeout(()=>{if(p.actionId!==id)return;p.actionTimer=null;if(p.labelAction==='ДУМАЕТ'){p.labelAction='';p.labelAmount=0;if(!gamePaused)render()}},2000);
}

function animateBetChip(playerIndex,amount=0){
 const seat=document.querySelector(`.seat.${seatClass[playerIndex]}`),avatar=seat?.querySelector('.avatar'),betDisplay=document.querySelector(`.hand-bet.b${playerIndex}`);
 if(!avatar||!betDisplay||amount<=0||gamePaused)return;
 const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches,from=avatar.getBoundingClientRect(),to=betDisplay.getBoundingClientRect();
 const startX=from.left+from.width/2,startY=from.top+from.height/2,endX=to.left+to.width/2,endY=to.top+to.height/2,config=getBetChipConfig(amount),count=config.count,flyingClass=config.color==='blue'?'blue-flying':'gold-flying';
 for(let n=0;n<count;n++){const chip=document.createElement('div');chip.className=`flying-chip ${flyingClass}`;if(config.color==='gold')chip.textContent='♠';
  const offsetX=(n-(count-1)/2)*8,offsetY=(n%2===0?-1:1)*Math.ceil(n/2)*5,startX2=startX+offsetX,startY2=startY+offsetY;
  chip.style.left=startX2+'px';chip.style.top=startY2+'px';chip.style.setProperty('--dx',(endX-startX2+(n-(count-1)/2)*5)+'px');chip.style.setProperty('--dy',(endY-startY2)+'px');chip.style.animationDelay=(reduceMotion?0:n*75)+'ms';document.body.appendChild(chip);
  requestAnimationFrame(()=>{if(chip.isConnected)chip.classList.add('fly')});chip.addEventListener('animationend',()=>chip.remove(),{once:true});setTimeout(()=>{if(chip.isConnected)chip.remove()},1300+(reduceMotion?0:n*75));
 }
}
function runBlindSequence(sbi,sbAmount,bbi,bbAmount,handTick){
 render();const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;showAction(sbi,'М. БЛАЙНД',sbAmount,1000);render();requestAnimationFrame(()=>animateBetChip(sbi,sbAmount));
 blindSequenceTimer=setTimeout(()=>{blindSequenceTimer=null;if(over||handTick!==tick||gamePaused)return;showAction(bbi,'Б. БЛАЙНД',bbAmount,1000);render();requestAnimationFrame(()=>animateBetChip(bbi,bbAmount));
  blindSequenceTimer=setTimeout(()=>{blindSequenceTimer=null;if(!over&&handTick===tick&&!gamePaused)advanceQueue()},reduceMotion?200:1100);
 },reduceMotion?200:1100);
}
function shuffle() {   deck = createShuffledDeck(ranks, suits); }

function live() {
  return getLive(players);
}

function activeCount() {
  return countActive(players);
}

function eligible(i) {
  return isEligible(players, i);
}

function clearActedFlags() {
  resetActedFlags(players);
}

function hasActedThisStreet(i) {
  return didAct(players, i, street);
}

function rebuildQueueFromStart(startIdx) {
  actQueue = makeActionQueue(players, startIdx, N);
}

function dequeue(i) {
  removeFromQueue(actQueue, i);
}

function queueHead() {
  return getQueueHead(actQueue);
}
function logit(s) {
  log.unshift(s);
  log = log.slice(0, 3);
  $('message').textContent = s;
}
function actionClass(action){const classes={'РЕЙЗ':'raise-label','ФОЛД':'fold-label','КОЛЛ':'call-label','ЧЕК':'check-label','СТАВКА':'bet-label','ALL-IN':'allin-label','М. БЛАЙНД':'small-blind-label','Б. БЛАЙНД':'big-blind-label'};return classes[action]||''}
function actionMarkup(action,amount){if(['М. БЛАЙНД','Б. БЛАЙНД','СТАВКА','РЕЙЗ'].includes(action))return `<span class="bet-action-name">${action}</span>`;return action==='ДУМАЕТ'?'ДУМАЕТ…':action}
function stateMarkup(p,i){if(p.folded)return'ФОЛД';if(p.allin)return'ALL-IN';if(i===actor&&!over)return'ХОД';if(p.action==='М. БЛАЙНД')return'М. БЛАЙНД';if(p.action==='Б. БЛАЙНД')return'Б. БЛАЙНД';if(p.action==='СТАВКА'||p.action==='РЕЙЗ')return`${p.action} ${fmt(p.actionAmount||0)} PP`;if(p.action)return p.action;return'В ИГРЕ'}
function renderHandBets(){
 $('handBets').innerHTML=players.map((p,i)=>{if(p.folded||p.bet<=0)return'';const config=getBetChipConfig(p.bet),cls=config.color==='blue'?'blue-chip':'gold-chip',chips=Array.from({length:config.count},()=>cls==='blue-chip'?'<span class="blue-chip"></span>':'<span class="gold-chip"></span>').join('');return `<div class="hand-bet b${i} visible" data-player="${i}" aria-label="Ставка ${fmt(p.bet)} PP"><span class="bet-chips">${chips}</span><span class="bet-total">${fmt(p.bet)} PP</span></div>`}).join('');
}
function renderCommunity(){
 const el=$('community'),count=board.length;el.classList.toggle('ai-winner-board',aiWinnerReveal);$('table').classList.toggle('ai-winner-state',aiWinnerReveal);
 if(count===0){el.innerHTML='';renderedBoardCount=0;return}
 if(count===renderedBoardCount){[...el.children].forEach((node,i)=>node.classList.toggle('winning-card',humanWinnerReveal&&winningCards.includes(board[i])||aiWinnerReveal&&aiWinningCards.includes(board[i])));return}
 const previousCount=renderedBoardCount;el.innerHTML=board.map((c,i)=>{const isNew=i>=previousCount,isWinning=humanWinnerReveal&&winningCards.includes(c)||aiWinnerReveal&&aiWinningCards.includes(c);return `<div class="card ${c.red?'red':''} ${isNew?'reveal-card':''} ${isWinning?'winning-card':''}"><span class="rank">${c.r==='T'?'10':c.r}</span><span class="center">${c.s}</span></div>`}).join('');renderedBoardCount=count;
}
function render(){
 if(!players.length)return;
 $('pot').textContent=fmt(pot);$('street').textContent=streetNames[Math.min(street,4)];
 $('handStatus').textContent=tournamentMode==='highroller'?`HIGH ROLLER · УР. ${blindLevel+1} · ${Math.ceil(Math.max(0,blindRemaining)/1000)}с`:'';
 $('blindsDisplay').textContent=`БЛАЙНДЫ ${fmt(sb)} / ${fmt(bb)}`;
 renderCommunity();const holeEl=$('hole');holeEl.classList.toggle('winner-hole',humanWinnerReveal);holeEl.classList.toggle('ai-loser-hole',aiWinnerReveal);holeEl.classList.toggle('folded-hole',humanFoldedCards);
 holeEl.innerHTML=players[user].hole.map(c=>{const html=card(c);return humanWinnerReveal&&winningCards.includes(c)?html.replace('class="card','class="card winning-card'):html}).join('');
 $('seats').innerHTML=players.map((p,i)=>{const cls=seatClass[i],action=p.labelAction||'',thinking=action==='ДУМАЕТ',labelClass=actionClass(action),userClass=i===user?'user-seat':'',isWinner=winnerIds.includes(i);
  const winMarkup=isWinner?`<div class="win-display visible"><div class="win-word">WIN</div><div class="win-prize">+${fmt(winnerPayouts[i]||0)} PP</div><div class="win-combo">${winnerCombo}</div></div>`:'';
  return `<div class="seat ${cls} ${userClass} ${i===actor&&!over?'active':''} ${p.folded?'folded':''}">${winMarkup}<div class="action-label ${thinking?'thinking':''} ${labelClass}">${actionMarkup(action,p.labelAmount||0)}</div><div class="avatar-wrap"><div class="avatar">${p.icon}</div></div><div><div class="name">${i===user?'Вы':p.name}</div><div class="stack">${fmt(p.stack)} PP</div><div class="state">${stateMarkup(p,i)}</div></div></div>`}).join('');
 $('opponentCards').innerHTML=players.map((p,i)=>{if(i===user)return'';const pos=cardPos[i];if(!pos)return'';const revealed=over&&!p.folded,isAIWinner=aiWinnerReveal&&i===aiWinnerId;return `<div class="opponent-cards ${pos} ${revealed?'revealed':''} ${isAIWinner?'ai-winner-cards':''}">${p.hole.map(c=>miniCard(c,revealed,isAIWinner&&aiWinningCards.includes(c))).join('')}</div>`}).join('');
 renderHandBets();$('betValue').textContent=$('betRange').value;
 const canAct=!over&&!busy&&!gamePaused&&actor===user&&eligible(user)&&actQueue.includes(user)&&!hasActedThisStreet(user);
 $('fold').disabled=!canAct;$('checkCall').disabled=!canAct;$('raise').disabled=!canAct;$('allin').disabled=!canAct;
 $('checkCall').textContent=currentBet>players[user].bet?'КОЛЛ '+fmt(currentBet-players[user].bet):'ЧЕК';
 const isRaise=currentBet>players[user].bet;$('raise').textContent=isRaise?'РЕЙЗ':'СТАВКА';$('raise').classList.toggle('bet-mode',!isRaise);
 $('nextHand').classList.toggle('visible',over);$('exitButton').classList.toggle('visible',gameStarted);
}
function post(i,n){const p=players[i],v=Math.min(n,p.stack);p.stack-=v;p.bet+=v;p.total+=v;if(!p.stack)p.allin=true;return v}
function resetBetSlider(){const slider=$('betRange');slider.value=slider.min;$('betValue').textContent=slider.value}
function newHand(){
 tick++;const thisHandTick=tick;busy=false;pendingAISeat=-1;clearTurnTimer();clearBlindSequence();clearActionTimers();resetBetSlider();$('notice').classList.remove('show');$('notice').innerHTML='';
 winnerIds=[];winnerPayouts={};winnerCombo='';humanWinnerReveal=false;winningCards=[];humanFoldedCards=false;aiWinnerReveal=false;aiWinnerId=-1;aiWinningCards=[];
 $('hole').classList.remove('winner-hole','ai-loser-hole','folded-hole');$('community').classList.remove('ai-winner-board');$('table').classList.remove('ai-winner-state');$('nextHand').classList.remove('visible');
 if(players[user]&&players[user].stack<=0){logit('Стек пуст — нажми «Сбросить стек»');render();return}
 handNo++;shuffle();board=[];renderedBoardCount=0;$('community').innerHTML='';pot=0;currentBet=0;street=0;over=false;log=[];
 players.forEach(p=>{p.hole=[deck.pop(),deck.pop()];p.folded=p.stack<=0;p.allin=false;p.bet=0;p.total=0;p.action='';p.actionAmount=0;p.labelAction='';p.labelAmount=0;p.actionTimer=null;p.actionId=(p.actionId||0)+1;p.actedStreet=-1});
 firstToAct=(firstToAct+1)%N;const sbi=(firstToAct+N-2)%N,bbi=(firstToAct+N-1)%N;
 const sbAmount=post(sbi,sb),bbAmount=post(bbi,bb);currentBet=Math.max(...players.map(p=>p.bet));clearActedFlags();rebuildQueueFromStart(firstToAct);actor=-1;logit('Новая раздача');runBlindSequence(sbi,sbAmount,bbi,bbAmount,thisHandTick);
}
function advanceQueue(){
 if(over||gamePaused)return;if(live().length<=1){finish();return}if(activeCount()<=1){runOutBoard();return}
 while(actQueue.length&&hasActedThisStreet(actQueue[0]))actQueue.shift();if(actQueue.length===0){advanceStreet();return}
 actor=actQueue[0];const p=players[actor];if(p){p.action='';p.actionAmount=0}render();if(actor!==user)scheduleAI(actor);
}
function advanceStreet(){
 if(over||gamePaused)return;tick++;busy=false;clearTurnTimer();if(live().length<=1){finish();return}collectBetsIntoPot();
 if(street===0){board.push(deck.pop(),deck.pop(),deck.pop());street=1}else if(street===1){board.push(deck.pop());street=2}else if(street===2){board.push(deck.pop());street=3}else{finish();return}
 currentBet=0;clearActedFlags();logit('Открыты общие карты');render();if(activeCount()<=1){runOutBoard();return}rebuildQueueFromStart((firstToAct+N-2)%N);advanceQueue();
}
function scheduleAI(i){
 if(over||gamePaused||busy||queueHead()!==i||!eligible(i)||hasActedThisStreet(i))return;
 busy=true;pendingAISeat=i;const myTick=tick;
 turnTimer=setTimeout(()=>{if(myTick!==tick||over||gamePaused){if(myTick===tick)busy=false;return}turnTimer=null;if(queueHead()!==i||!eligible(i)||hasActedThisStreet(i)){busy=false;pendingAISeat=-1;return}
  showThinking(i);render();turnTimer=setTimeout(()=>{if(myTick!==tick||over||gamePaused){if(myTick===tick)busy=false;return}turnTimer=null;if(queueHead()!==i||!eligible(i)||hasActedThisStreet(i)){busy=false;pendingAISeat=-1;return}
   const call=Math.max(0,currentBet-players[i].bet),action=decide(players[i],call,board,currentBet,bb);busy=false;pendingAISeat=-1;if(applyAction(i,action,myTick))advanceQueue();
  },Math.floor(Math.random()*2501)+1000);
 },1200);
}
function applyAction(i,a,myTick){
 if(over||gamePaused)return false;if(typeof myTick==='number'&&myTick!==tick)return false;if(queueHead()!==i||!eligible(i)||hasActedThisStreet(i))return false;
 const p=players[i],oldBet=currentBet,call=Math.max(0,currentBet-p.bet);let raised=false,chipAmount=0;
 if(a.t==='fold'){p.folded=true;if(i===user)humanFoldedCards=true;showAction(i,'ФОЛД');logit(p.name+': ФОЛД')}
 else if(a.t==='check'){if(call>0)a={t:'call'};else{showAction(i,'ЧЕК');logit(p.name+': ЧЕК')}}
 if(a.t==='call'){const amount=Math.min(call,p.stack);if(amount===0){showAction(i,'ЧЕК');logit(p.name+': ЧЕК')}else{p.stack-=amount;p.bet+=amount;p.total+=amount;chipAmount=amount;if(p.stack===0)p.allin=true;const label=p.allin?'ALL-IN':'КОЛЛ';showAction(i,label);logit(p.name+': '+label)}}
 else if(a.t==='bet'||a.t==='raise'){const requested=Number(a.amt)||bb*2,target=Math.max(currentBet===0?bb:currentBet+bb,requested),amount=Math.min(Math.max(0,target-p.bet),p.stack);
  if(amount>0){p.stack-=amount;p.bet+=amount;p.total+=amount;chipAmount=amount;if(p.stack===0)p.allin=true;currentBet=Math.max(currentBet,p.bet);raised=currentBet>oldBet;const label=p.allin?'ALL-IN':(oldBet>0?'РЕЙЗ':'СТАВКА');showAction(i,label,amount);logit(p.name+': '+label+' '+fmt(amount)+' PP')}
  else if(call>0){const amountToCall=Math.min(call,p.stack);p.stack-=amountToCall;p.bet+=amountToCall;p.total+=amountToCall;chipAmount=amountToCall;if(p.stack===0)p.allin=true;showAction(i,p.allin?'ALL-IN':'КОЛЛ');logit(p.name+': '+(p.allin?'ALL-IN':'КОЛЛ'))}else{showAction(i,'ЧЕК');logit(p.name+': ЧЕК')}}
 else if(a.t==='allin'){const amount=p.stack;if(amount<=0)return false;p.stack=0;p.bet+=amount;p.total+=amount;chipAmount=amount;p.allin=true;currentBet=Math.max(currentBet,p.bet);raised=currentBet>oldBet;showAction(i,'ALL-IN');logit(p.name+': ALL-IN')}
 p.actedStreet=street;dequeue(i);tick++;resetBetSlider();if(chipAmount>0){render();requestAnimationFrame(()=>animateBetChip(i,chipAmount))}
 if(raised){rebuildQueueFromStart((i+1)%N);const k=actQueue.indexOf(i);if(k>=0)actQueue.splice(k,1);actQueue.forEach(idx=>{players[idx].actedStreet=-1})}
 render();return true;
}
function runOutBoard(){if(over||gamePaused)return;tick++;busy=false;clearTurnTimer();collectBetsIntoPot();while(board.length<5)board.push(deck.pop());street=4;render();finish()}

function showFeedbackReminderAfterThirdHand(){
 const modeKey=tournamentMode;
 if(handNo!==3||gamePaused||feedbackReminderShown.has(modeKey))return;
 feedbackReminderShown.add(modeKey);
 $('feedbackReminder').classList.add('visible');
}
$('feedbackDismiss').addEventListener('click',()=>{
 $('feedbackReminder').classList.remove('visible');
});

function finish(){
 if(over)return;tick++;busy=false;pendingAISeat=-1;clearTurnTimer();clearBlindSequence();clearActionTimers();over=true;actQueue=[];collectBetsIntoPot();
 const survivors=live();let winners=[],winnerScore=null;humanWinnerReveal=false;winningCards=[];aiWinnerReveal=false;aiWinnerId=-1;aiWinningCards=[];
 if(survivors.length===1)winners=survivors;else{street=4;const ranked=survivors.map(p=>({p,s:score([...p.hole,...board])})).sort((a,b)=>cmp(b.s,a.s));winnerScore=ranked[0].s;winners=ranked.filter(x=>cmp(x.s,winnerScore)===0).map(x=>x.p)}
 const each=Math.floor(pot/winners.length),rem=pot%winners.length;winnerIds=[];winnerPayouts={};
 winners.forEach((p,i)=>{const payout=each+(i===0?rem:0);p.stack+=payout;const idx=players.indexOf(p);winnerIds.push(idx);winnerPayouts[idx]=payout});
 winnerCombo=survivors.length>1&&winnerScore?handNames[winnerScore[0]]:'БЕЗ ВСКРЫТИЯ';const userWon=winners.includes(players[user]);
 if(userWon){humanWinnerReveal=true;if(survivors.length>1&&board.length===5)winningCards=bestFive([...players[user].hole,...board]).cards}
 else{const aiWinners=winners.filter(p=>players.indexOf(p)!==user);if(aiWinners.length>0){aiWinnerReveal=true;aiWinnerId=players.indexOf(aiWinners[0]);humanFoldedCards=true;if(survivors.length>1&&board.length===5)aiWinningCards=bestFive([...aiWinners[0].hole,...board]).cards}}
 $('message').textContent=userWon?'Победа!':`Победитель: ${winners.map(p=>p.name).join(', ')}`;render();
 showFeedbackReminderAfterThirdHand();
}
function userAct(t){
 if(over||busy||gamePaused||actor!==user||!eligible(user)||queueHead()!==user||hasActedThisStreet(user))return;
 const call=Math.max(0,currentBet-players[user].bet);let a;if(t==='fold')a={t:'fold'};else if(t==='call')a=call?{t:'call'}:{t:'check'};else if(t==='raise'){const amount=Number($('betRange').value);a={t:call?'raise':'bet',amt:call?Math.max(currentBet+bb,amount):amount}}else if(t==='allin')a={t:'allin'};else return;
 if(applyAction(user,a))advanceQueue();
}
function start(){
 players=[{name:'Вы',icon:'♠',style:'user',stack:modeStartingStack()},{name:'Тайтовый',icon:'♞',style:'tight',stack:modeStartingStack()},{name:'Стратег',icon:'♜',style:'balanced',stack:modeStartingStack()},{name:'Агрессор',icon:'♛',style:'aggressive',stack:modeStartingStack()}];
 $('fold').onclick=()=>userAct('fold');$('checkCall').onclick=()=>userAct('call');$('raise').onclick=()=>userAct('raise');$('allin').onclick=()=>userAct('allin');$('nextHand').onclick=()=>{if(!gamePaused)newHand()};
 $('betRange').oninput=()=>$('betValue').textContent=$('betRange').value;
 $('newHand').onclick=()=>{if(!gamePaused){if(over)newHand();else logit('Завершите текущую раздачу')}};
 $('reset').onclick=()=>{if(!gamePaused)resetStacksAndRestart()};resetBetSlider();
}
function captureGameState(){
 return{
  players:players.map(p=>({...p,hole:p.hole?.map(c=>({...c})),bet:Number(p.bet)||0,total:Number(p.total)||0,actionTimer:null,actionId:(p.actionId||0)+1})),
  deck:deck.map(c=>({...c})),board:board.map(c=>({...c})),pot,currentBet,street,actor,handNo,over,sb,bb,log:[...log],tick,
  actQueue:[...actQueue],firstToAct,renderedBoardCount,winnerIds:[...winnerIds],winnerPayouts:{...winnerPayouts},winnerCombo,
  humanWinnerReveal,winningCards:winningCards.map(c=>({...c})),humanFoldedCards,aiWinnerReveal,aiWinnerId,aiWinningCards:aiWinningCards.map(c=>({...c})),
  pendingAISeat,tournamentMode,blindLevel,blindRemaining,betRangeValue:$('betRange').value,blindSequencePending:blindSequenceTimer!==null
 };
}
function pauseGameForMenu(){
 if(!gameStarted||gamePaused)return;
 savedGameState=captureGameState();stopTournamentClock(true);savedGameState.blindRemaining=blindRemaining;gamePaused=true;tick++;clearTurnTimer();clearBlindSequence();clearActionTimers();busy=false;
 $('startScreen').classList.remove('hidden');$('startScreen').classList.add('exit-mode');$('exitMenuButtons').classList.add('visible');$('playButton').style.display='none';
 $('startScreen').querySelector('.start-version').textContent=DISPLAY_VERSION;
$('gameVersionDisplay').textContent=DISPLAY_VERSION;
}
function restoreSavedGame(){
 if(!savedGameState)return;
 const s=savedGameState;
 players=s.players.map(p=>({...p,actionTimer:null}));deck=s.deck.map(c=>({...c}));board=s.board.map(c=>({...c}));
 pot=s.pot;currentBet=s.currentBet;street=s.street;actor=s.actor;handNo=s.handNo;over=s.over;sb=s.sb;bb=s.bb;log=[...s.log];tick=Math.max(tick,s.tick)+1;
 actQueue=[...s.actQueue];firstToAct=s.firstToAct;renderedBoardCount=s.renderedBoardCount;winnerIds=[...s.winnerIds];winnerPayouts={...s.winnerPayouts};winnerCombo=s.winnerCombo;
 humanWinnerReveal=s.humanWinnerReveal;winningCards=s.winningCards.map(c=>({...c}));humanFoldedCards=s.humanFoldedCards;aiWinnerReveal=s.aiWinnerReveal;aiWinnerId=s.aiWinnerId;aiWinningCards=s.aiWinningCards.map(c=>({...c}));
 pendingAISeat=s.pendingAISeat;tournamentMode=s.tournamentMode||tournamentMode;blindLevel=s.blindLevel??blindLevel;blindRemaining=s.blindRemaining??blindRemaining;applyTournamentMode(false);gamePaused=false;busy=false;clearTurnTimer();clearBlindSequence();clearActionTimers();
 $('betRange').value=String(Math.min(Number($('betRange').max),Math.max(Number($('betRange').min),Number(s.betRangeValue)||Number($('betRange').min))));$('betValue').textContent=$('betRange').value;
 $('community').innerHTML='';renderedBoardCount=0;renderCommunity();
 $('startScreen').classList.add('hidden');$('startScreen').classList.remove('exit-mode');$('exitMenuButtons').classList.remove('visible');$('playButton').style.display='';
 savedGameState=null;render();renderHandBets();startTournamentClock();
 if(!over&&actor!==user&&eligible(actor)&&actQueue.includes(actor)&&!hasActedThisStreet(actor))scheduleAI(actor);
}
function resetStacksAndRestart(){
 gamePaused=false;clearTurnTimer();clearBlindSequence();clearActionTimers();tick++;busy=false;pendingAISeat=-1;
 winnerIds=[];winnerPayouts={};winnerCombo='';humanWinnerReveal=false;winningCards=[];humanFoldedCards=false;aiWinnerReveal=false;aiWinnerId=-1;aiWinningCards=[];
 stopTournamentClock(false);applyTournamentMode(true);players.forEach(p=>{p.stack=modeStartingStack();p.bet=0;p.total=0;p.folded=false;p.allin=false;p.action='';p.actionAmount=0;p.labelAction='';p.labelAmount=0;p.actedStreet=-1;p.hole=[]});
 deck=[];board=[];pot=0;currentBet=0;street=0;actor=-1;handNo=0;over=true;actQueue=[];firstToAct=3;log=[];renderedBoardCount=0;savedGameState=null;gameStarted=true;
 $('community').innerHTML='';$('hole').innerHTML='';$('opponentCards').innerHTML='';$('handBets').innerHTML='';$('seats').innerHTML='';$('pot').textContent='0';$('message').textContent='Новая игра';resetBetSlider();
 $('startScreen').classList.add('hidden');$('startScreen').classList.remove('exit-mode');$('exitMenuButtons').classList.remove('visible');$('playButton').style.display='';
 $('feedbackReminder').classList.remove('visible');
 newHand();startTournamentClock();
}
$('tournamentSelectButton').addEventListener('click',()=>{$('tournamentOverlay').classList.add('visible')});
$('classicModeButton').addEventListener('click',()=>chooseTournament('classic'));
$('highRollerModeButton').addEventListener('click',()=>chooseTournament('highroller'));
$('closeTournamentButton').addEventListener('click',()=>$('tournamentOverlay').classList.remove('visible'));
$('tournamentOverlay').addEventListener('click',event=>{if(event.target===$('tournamentOverlay'))$('tournamentOverlay').classList.remove('visible')});
$('exitButton').addEventListener('click',pauseGameForMenu);
$('resumeButton').addEventListener('click',restoreSavedGame);
$('restartButton').addEventListener('click',resetStacksAndRestart);
$('playButton').addEventListener('click',()=>{if(gameStarted)return;gameStarted=true;gamePaused=false;$('startScreen').classList.add('hidden');applyTournamentMode(false);newHand();startTournamentClock()});
$('aboutButton').addEventListener('click',()=>{closeOverlays();$('infoOverlay').classList.add('visible')});
$('updatesButton').addEventListener('click',()=>{closeOverlays();setUpdatesExpanded(false);$('updatesOverlay').classList.add('visible')});

function closeOverlays(){$('infoOverlay').classList.remove('visible');$('updatesOverlay').classList.remove('visible');$('reportOverlay').classList.remove('visible');$('tournamentOverlay').classList.remove('visible')}
initBugReport({
  $,
  gameVersion: GAME_VERSION,
  endpoint: BUG_REPORT_ENDPOINT,
  closeOverlays
});
$('closeAboutButton').addEventListener('click',closeOverlays);$('closeUpdatesButton').addEventListener('click',closeOverlays);$('closeReportButton').addEventListener('click',closeOverlays);
$('infoOverlay').addEventListener('click',event=>{if(event.target===$('infoOverlay'))closeOverlays()});
$('updatesOverlay').addEventListener('click',event=>{if(event.target===$('updatesOverlay'))closeOverlays()});
$('reportOverlay').addEventListener('click',event=>{if(event.target===$('reportOverlay'))closeOverlays()});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){if($('feedbackReminder').classList.contains('visible'))return;if(gameStarted&&$('startScreen').classList.contains('exit-mode'))restoreSavedGame();else closeOverlays()}});
$('closeWelcomeButton').addEventListener('click',()=>{$('welcomeOverlay').classList.add('closed');$('welcomeOverlay').setAttribute('aria-hidden','true')}); $('startScreen').querySelector('.start-version').textContent=DISPLAY_VERSION;
$('gameVersionDisplay').textContent=DISPLAY_VERSION;
applyTournamentMode(true);start();
})();
