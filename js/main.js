import { ranks, score, cmp, bestFive, handNames, analyzeHand } from './poker.js';
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
// Настройки турнира: стартовый стек, уровни блайндов и управление таймером.
// getTournamentSettings — длительность одного уровня, заданная в tournament.js.
import {
  getStartingStack,
  getBlindLevels,
  createTournamentClock,
  getTournamentSettings
} from './tournament.js';
import { createRenderer } from './render.js';
import { createEffects } from './effects.js';
import { initUpdates } from './updates.js';
import { initFeedbackReminder } from './feedback.js';
(()=>{'use strict';
const suits=[['♠',0],['♥',1],['♦',1],['♣',0]];
const $=id=>document.getElementById(id),user=0;
const seatClass=['s3','s2','s0','s1'],cardPos=['','c2','c0','c1'];
const streetNames=['ПРЕФЛОП','ФЛОП','ТЁРН','РИВЕР','ШОУДАУН'],N=4;
const GAME_VERSION='v0.5.8 alpha';
const DISPLAY_VERSION=GAME_VERSION;
// Текущий режим турнира: classic или highroller.
let tournamentMode = 'classic';
let blindLevel = 0;
// Оставшееся время текущего уровня в миллисекундах.
// Длительность автоматически берётся из tournament.js.
let blindRemaining = getTournamentSettings(tournamentMode).blindLevelDuration;
const BUG_REPORT_ENDPOINT='https://pokereza-bug-reporter.17-rezan.workers.dev/report';
let players=[],deck=[],board=[],pot=0,currentBet=0,street=0,actor=-1,handNo=0;
let over=false,busy=false,sb=10,bb=20,log=[],tick=0,turnTimer=null,actQueue=[],firstToAct=3;
let renderedBoardCount=0,winnerIds=[],winnerPayouts={},winnerCombo='';
let humanWinnerReveal=false,winningCards=[],humanFoldedCards=false;
let aiWinnerReveal=false,aiWinnerId=-1,aiWinningCards=[];
let chipFlightId=0,blindSequenceTimer=null,gameStarted=false,gamePaused=false,savedGameState=null;
const effects = createEffects({
  getBetChipConfig,
  seatClass,
  getPaused: () => gamePaused
});
let pendingAISeat=-1;
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
 if(resetClock){blindLevel=0;blindRemaining=getTournamentSettings(tournamentMode).blindLevelDuration;}
 [sb,bb]=getBlindLevels(tournamentMode)[blindLevel]||getBlindLevels(tournamentMode)[0];
 updateTournamentDisplay();
}
function updateTournamentDisplay(){
 const high=tournamentMode==='highroller';
 $('blindsDisplay').textContent=`БЛАЙНДЫ ${fmt(sb)} / ${fmt(bb)}`;
 $('handStatus').textContent=high?`HIGH ROLLER · УР. ${blindLevel+1} · ${Math.ceil(Math.max(0,blindRemaining)/1000)}с`:'';
 $('table').classList.toggle('high-roller',high);
 $('tableWatermark').textContent=high?'HIGH ROLLER':'POKEREZA';
}
const tournamentClock = createTournamentClock({
  getMode: () => tournamentMode,
  getPaused: () => gamePaused,
  getLevel: () => blindLevel,
  setLevel: value => {
    blindLevel = value;
  },
  getRemaining: () => blindRemaining,
  setRemaining: value => {
    blindRemaining = value;
  },
  setBlinds: ([small, big]) => {
    sb = small;
    bb = big;
  },
  updateDisplay: updateTournamentDisplay,
  render: () => render()
});
function chooseTournament(mode){
 tournamentMode=mode;applyTournamentMode(true);
 $('tournamentOverlay').classList.remove('visible');
 if(!gameStarted){players.forEach(p=>p.stack=getStartingStack(tournamentMode))}
 else if(gamePaused){savedGameState=null;resetStacksAndRestart()}
}

initUpdates({ $, closeOverlays });


function collectBetsIntoPot(){const amount=players.reduce((sum,p)=>sum+(Number(p.bet)||0),0);if(amount>0){pot+=amount;players.forEach(p=>{p.bet=0})}currentBet=0}
function clearTurnTimer(){if(turnTimer!==null){clearTimeout(turnTimer);turnTimer=null}}
function clearBlindSequence(){if(blindSequenceTimer!==null){clearTimeout(blindSequenceTimer);blindSequenceTimer=null}}
function clearActionTimers(){
 players.forEach(p=>{
  if(p.actionTimer){
   clearTimeout(p.actionTimer);
   p.actionTimer=null;
  }

  p.actionId=(p.actionId||0)+1;
  p.action='';
  p.actionAmount=0;
  p.labelAction='';
  p.labelAmount=0;
 });

 effects.clearFlyingChips();
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
function runBlindSequence(sbi,sbAmount,bbi,bbAmount,handTick){
 render();const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;showAction(sbi,'М. БЛАЙНД',sbAmount,1000);render();requestAnimationFrame(()=>effects.animateBetChip(sbi,sbAmount));
 blindSequenceTimer=setTimeout(()=>{blindSequenceTimer=null;if(over||handTick!==tick||gamePaused)return;showAction(bbi,'Б. БЛАЙНД',bbAmount,1000);render();requestAnimationFrame(()=>effects.animateBetChip(bbi,bbAmount));
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

const { render, renderHandBets, renderCommunity } = createRenderer({
  $,
  getState: () => ({
    players,
    pot,
    street,
    tournamentMode,
    blindLevel,
    blindRemaining,
    sb,
    bb,
    humanWinnerReveal,
    aiWinnerReveal,
    humanFoldedCards,
    winningCards,
    aiWinningCards,
    aiWinnerId,
    winnerIds,
    winnerPayouts,
    winnerCombo,
    actor,
    over,
    busy,
    gamePaused,
    actQueue,
    currentBet,
        gameStarted,
    board,
    currentHandAnalysis: players[user] &&
      !players[user].folded &&
      players[user].hole?.length
        ? analyzeHand([...players[user].hole, ...board])
        : null
  }),
  card,
  miniCard,
  fmt,
  getBetChipConfig,
  streetNames,
  seatClass,
  cardPos,
  eligible,
  hasActedThisStreet,
  getRenderedBoardCount: () => renderedBoardCount,
  setRenderedBoardCount: value => {
    renderedBoardCount = value;
  }
});

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
 p.actedStreet=street;dequeue(i);tick++;resetBetSlider();if(chipAmount>0){render();requestAnimationFrame(()=>effects.animateBetChip(i,chipAmount))}
 if(raised){rebuildQueueFromStart((i+1)%N);const k=actQueue.indexOf(i);if(k>=0)actQueue.splice(k,1);actQueue.forEach(idx=>{players[idx].actedStreet=-1})}
 render();return true;
}
function runOutBoard(){if(over||gamePaused)return;tick++;busy=false;clearTurnTimer();collectBetsIntoPot();while(board.length<5)board.push(deck.pop());street=4;render();finish()}

const feedbackReminder = initFeedbackReminder({
  $,
  getHandNo: () => handNo,
  getGamePaused: () => gamePaused,
  getTournamentMode: () => tournamentMode
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
 feedbackReminder.showAfterThirdHand();
}
function userAct(t){
 if(over||busy||gamePaused||actor!==user||!eligible(user)||queueHead()!==user||hasActedThisStreet(user))return;
 const call=Math.max(0,currentBet-players[user].bet);let a;if(t==='fold')a={t:'fold'};else if(t==='call')a=call?{t:'call'}:{t:'check'};else if(t==='raise'){const amount=Number($('betRange').value);a={t:call?'raise':'bet',amt:call?Math.max(currentBet+bb,amount):amount}}else if(t==='allin')a={t:'allin'};else return;
 if(applyAction(user,a))advanceQueue();
}
function start(){
 players=[{name:'Вы',icon:'♠',style:'user',stack:getStartingStack(tournamentMode)},{name:'Тайтовый',icon:'♞',style:'tight',stack:getStartingStack(tournamentMode)},{name:'Стратег',icon:'♜',style:'balanced',stack:getStartingStack(tournamentMode)},{name:'Агрессор',icon:'♛',style:'aggressive',stack:getStartingStack(tournamentMode)}];
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
 savedGameState=captureGameState();tournamentClock.stop(true);savedGameState.blindRemaining=blindRemaining;gamePaused=true;tick++;clearTurnTimer();clearBlindSequence();clearActionTimers();busy=false;
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
 savedGameState=null;render();renderHandBets();tournamentClock.start();
 if(!over&&actor!==user&&eligible(actor)&&actQueue.includes(actor)&&!hasActedThisStreet(actor))scheduleAI(actor);
}
function resetStacksAndRestart(){
 gamePaused=false;clearTurnTimer();clearBlindSequence();clearActionTimers();tick++;busy=false;pendingAISeat=-1;
 winnerIds=[];winnerPayouts={};winnerCombo='';humanWinnerReveal=false;winningCards=[];humanFoldedCards=false;aiWinnerReveal=false;aiWinnerId=-1;aiWinningCards=[];
 tournamentClock.stop(false);applyTournamentMode(true);players.forEach(p=>{p.stack=getStartingStack(tournamentMode);p.bet=0;p.total=0;p.folded=false;p.allin=false;p.action='';p.actionAmount=0;p.labelAction='';p.labelAmount=0;p.actedStreet=-1;p.hole=[]});
 deck=[];board=[];pot=0;currentBet=0;street=0;actor=-1;handNo=0;over=true;actQueue=[];firstToAct=3;log=[];renderedBoardCount=0;savedGameState=null;gameStarted=true;
 $('community').innerHTML='';$('hole').innerHTML='';$('opponentCards').innerHTML='';$('handBets').innerHTML='';$('seats').innerHTML='';$('pot').textContent='0';$('message').textContent='Новая игра';resetBetSlider();
 $('startScreen').classList.add('hidden');$('startScreen').classList.remove('exit-mode');$('exitMenuButtons').classList.remove('visible');$('playButton').style.display='';
 $('feedbackReminder').classList.remove('visible');
 newHand();tournamentClock.start();
}
$('tournamentSelectButton').addEventListener('click',()=>{$('tournamentOverlay').classList.add('visible')});
$('classicModeButton').addEventListener('click',()=>chooseTournament('classic'));
$('highRollerModeButton').addEventListener('click',()=>chooseTournament('highroller'));
$('closeTournamentButton').addEventListener('click',()=>$('tournamentOverlay').classList.remove('visible'));
$('tournamentOverlay').addEventListener('click',event=>{if(event.target===$('tournamentOverlay'))$('tournamentOverlay').classList.remove('visible')});
$('exitButton').addEventListener('click',pauseGameForMenu);
$('resumeButton').addEventListener('click',restoreSavedGame);
$('restartButton').addEventListener('click',resetStacksAndRestart);
$('playButton').addEventListener('click',()=>{if(gameStarted)return;gameStarted=true;gamePaused=false;$('startScreen').classList.add('hidden');applyTournamentMode(false);newHand();tournamentClock.start()});
$('aboutButton').addEventListener('click',()=>{closeOverlays();$('infoOverlay').classList.add('visible')});

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
