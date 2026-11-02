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
const GAME_VERSION='v0.5.10 alpha';
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
let allInAnimationUntil = 0;
      let firstAllInSeat = -1;
let allInLightTimer = null;

function startAllInTableLight(playerIndex) {
  if (firstAllInSeat !== -1) return;

  firstAllInSeat = playerIndex;
 requestAnimationFrame(() => {
  const avatarWrap = document.querySelector(
    `#seats .${seatClass[playerIndex]} .avatar-wrap`
  );

  if (firstAllInSeat === playerIndex) {
    avatarWrap?.classList.add('allin-flame-active');
  }
});
  const table = $('table');
  if (!table) return;

  if (allInLightTimer !== null) {
    clearTimeout(allInLightTimer);
  }

    const seat = document.querySelector(
    `#seats .${seatClass[playerIndex]} .avatar`
  );

  const tableRect = table.getBoundingClientRect();

  let startAngle = 0;

  if (seat) {
    const rect = seat.getBoundingClientRect();

    const avatarX = rect.left + rect.width / 2;
    const avatarY = rect.top + rect.height / 2;
    const centerX = tableRect.left + tableRect.width / 2;
    const centerY = tableRect.top + tableRect.height / 2;

    startAngle = Math.atan2(
      avatarX - centerX,
      -(avatarY - centerY)
    ) * 180 / Math.PI;

    if (startAngle < 0) startAngle += 360;
  }

  const trail = document.createElement('div');
  trail.className = 'allin-light-trail';

  table.querySelector('.allin-light-trail')?.remove();

   trail.style.setProperty(
    '--allin-start-angle',
    `${startAngle}deg`
  );
  table.appendChild(trail);
  table.classList.remove('allin-light-finished');
  table.classList.add('allin-light-active');

  allInLightTimer = setTimeout(() => {
    table.classList.remove('allin-light-active');
    table.classList.add('allin-light-finished');
    allInLightTimer = null;
  }, 3000);
}

function resetAllInTableLight() {
  if (allInLightTimer !== null) {
    clearTimeout(allInLightTimer);
    allInLightTimer = null;
  }

  firstAllInSeat = -1;
document.querySelectorAll(
  '#seats .avatar-wrap.allin-flame-active'
).forEach(el => {
  el.classList.remove('allin-flame-active');
});
  const table = $('table');
  if (!table) return;

  table.classList.remove(
    'allin-light-active',
    'allin-light-finished'
  );

  table.querySelector('.allin-light-trail')?.remove();
}
let allInAdvanceTimer = null;
function cancelAllInAdvanceTimer() {
  if (allInAdvanceTimer !== null) {
    clearTimeout(allInAdvanceTimer);
    allInAdvanceTimer = null;
  }

  allInAnimationUntil = 0;
}
let renderedBoardCount=0,winnerIds=[],winnerPayouts={},winnerCombo='';
let humanWinnerReveal=false,winningCards=[],humanFoldedCards=false;
let aiWinnerReveal=false,aiWinnerId=-1,aiWinningCards=[];
let chipFlightId=0,blindSequenceTimer=null,gameStarted=false,gamePaused=false,savedGameState=null; let dealInProgress=false; let communityDealingIndices = new Set(); let userHoleRevealBack = false; let aiShowdownRevealBack = false;let initialDealInProgress = false;
let lastBetFlight = Promise.resolve();      
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
 const actionDuration = label === 'ALL-IN' ? 3500 : duration; if (label === 'ALL-IN') {
  allInAnimationUntil = Date.now() + 3500;
} p.actionTimer = setTimeout(() => {   if (p.actionId !== id) return;   p.actionTimer = null;   p.labelAction = '';   p.labelAmount = 0;   if (!gamePaused) render(); }, actionDuration);
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
    dealInProgress,
    initialDealInProgress,
    userHoleRevealBack,
aiShowdownRevealBack,
    communityDealingIndices: [...communityDealingIndices],
   board,
currentHandAnalysis: players[user] &&
  !players[user].folded &&
  players[user].hole?.length
    ? analyzeHand([...players[user].hole, ...board])
    : null,

aiWinnerAnalysis: aiWinningCards.length &&
  players[aiWinnerId]?.hole?.length
    ? analyzeHand([...players[aiWinnerId].hole, ...board])
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

function clearDealSequence() {
  dealInProgress = false;
  communityDealingIndices.clear();

  document.querySelectorAll('.dealing-card').forEach(el => {
    el.getAnimations().forEach(animation => animation.cancel());
    el.remove();
  });

  $('deckStack')?.classList.remove('deck-visible');
}

function waitForDeal(ms, handTick) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(handTick === tick && !gamePaused);
    }, ms);
  });
}

function flyDealtCard(playerIndex, handTick, reduceMotion) {
  return new Promise(resolve => {
    if (handTick !== tick || gamePaused) {
      resolve(false);
      return;
    }

    const isUser = playerIndex === user;
    const target = isUser
      ? $('hole')
      : $('opponentCards').querySelector(`.${cardPos[playerIndex]}`);

    const deckStack = $('deckStack');
    const table = $('table');

    if (!target || !deckStack || !table) {
      resolve(false);
      return;
    }

    if (reduceMotion) {
      resolve(true);
      return;
    }

             // Всегда рассчитываем позиции в контейнере из двух карт.
    const targetClone = target.cloneNode(false);
    targetClone.style.visibility = 'hidden';

    const placeholders = [];

    for (let i = 0; i < 2; i++) {
      const placeholder = document.createElement(isUser ? 'div' : 'span');

      placeholder.className = isUser
        ? 'card back deal-placeholder'
        : 'mini-card deal-placeholder';

      targetClone.appendChild(placeholder);
      placeholders.push(placeholder);
    }

    target.parentElement.appendChild(targetClone);

    
const dealtCount = Math.min(
  1,
  players[playerIndex].dealtCount || 0
);

const cardIndex = playerIndex === 3
  ? 1 - dealtCount
  : dealtCount;


    const targetRect =
      placeholders[cardIndex].getBoundingClientRect();

    targetClone.remove();
    const deckRect = deckStack.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();

    const startWidth = deckRect.width;
const startHeight = deckRect.height;

// Учитываем рамку стола — начало координат находится внутри неё.
const tableOriginX = tableRect.left + table.clientLeft;
const tableOriginY = tableRect.top + table.clientTop;

const startX = deckRect.left - tableOriginX +
  deckRect.width / 2 - startWidth / 2;
const startY = deckRect.top - tableOriginY +
  deckRect.height / 2 - startHeight / 2;

const endX = targetRect.left - tableOriginX;
const endY = targetRect.top - tableOriginY;

    const flyingCard = document.createElement('div');
flyingCard.className = isUser
  ? 'card back dealing-card'
  : 'mini-card dealing-card';

    Object.assign(flyingCard.style, {
      left: `${startX}px`,
      top: `${startY}px`,
      width: `${startWidth}px`,
      height: `${startHeight}px`
    });

    table.appendChild(flyingCard);

    let completed = false;

    const finishAnimation = success => {
      if (completed) return;
      completed = true;
      flyingCard.remove();

      resolve(success && handTick === tick && !gamePaused);
    };

    const animation = flyingCard.animate([
      {
        left: `${startX}px`,
        top: `${startY}px`,
        width: `${startWidth}px`,
        height: `${startHeight}px`
      },
      {
        left: `${endX}px`,
        top: `${endY}px`,
        width: `${targetRect.width}px`,
        height: `${targetRect.height}px`
      }
    ], {
      duration: 280,
      easing: 'cubic-bezier(.2,.8,.2,1)',
      fill: 'forwards'
    });

    animation.onfinish = () => finishAnimation(true);
    animation.oncancel = () => finishAnimation(false);
  });
}
      async function revealUserHoleCards(handTick, reduceMotion) {
  userHoleRevealBack = true;
  render();

 if (reduceMotion) {
  initialDealInProgress = false;
  userHoleRevealBack = false;
  render();
  return true;
}

  const backs = [...$('hole').querySelectorAll('.card.back')];

  await Promise.all(backs.map(el => el.animate(
    [
      { transform: 'perspective(700px) rotateY(0deg)' },
      { transform: 'perspective(700px) rotateY(90deg)' }
    ],
    {
      duration: 180,
      easing: 'ease-in',
      fill: 'forwards'
    }
  ).finished.catch(() => {})));

  if (handTick !== tick || gamePaused) return false;

 initialDealInProgress = false;
userHoleRevealBack = false;
render();

const faces = [...$('hole').querySelectorAll('.card')];

  await Promise.all(faces.map(el => el.animate(
    [
      {
        transform: 'perspective(700px) rotateY(-90deg)',
        opacity: 0.8
      },
      {
        transform: 'perspective(700px) rotateY(0deg)',
        opacity: 1
      }
    ],
    {
      duration: 220,
      easing: 'ease-out',
      fill: 'both'
    }
  ).finished.catch(() => {})));

  if (handTick !== tick || gamePaused) return false;

  render();
  return true;
}
function flyCommunityCard(cardIndex, handTick, reduceMotion) {
  return new Promise(resolve => {
    if (handTick !== tick || gamePaused) {
      resolve(false);
      return;
    }

    const target = $('community').querySelector(
      `.community-slot[data-index="${cardIndex}"]`
    );

    const deckStack = $('deckStack');
    const table = $('table');

    if (!target || !deckStack || !table) {
      resolve(false);
      return;
    }

    if (reduceMotion) {
      resolve(true);
      return;
    }

    const targetRect = target.getBoundingClientRect();
    const deckRect = deckStack.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();

    const tableOriginX = tableRect.left + table.clientLeft;
    const tableOriginY = tableRect.top + table.clientTop;

    const startX =
      deckRect.left - tableOriginX +
      deckRect.width / 2 - deckRect.width / 2;

    const startY =
      deckRect.top - tableOriginY +
      deckRect.height / 2 - deckRect.height / 2;

    const endX = targetRect.left - tableOriginX;
    const endY = targetRect.top - tableOriginY;

    const flyingCard = document.createElement('div');
    flyingCard.className = 'card back dealing-card';

    Object.assign(flyingCard.style, {
      left: `${startX}px`,
      top: `${startY}px`,
      width: `${deckRect.width}px`,
      height: `${deckRect.height}px`
    });

    table.appendChild(flyingCard);

    let completed = false;

    const finishAnimation = success => {
      if (completed) return;

      completed = true;
      flyingCard.remove();

      resolve(success && handTick === tick && !gamePaused);
    };

    const animation = flyingCard.animate([
      {
        left: `${startX}px`,
        top: `${startY}px`,
        width: `${deckRect.width}px`,
        height: `${deckRect.height}px`
      },
      {
        left: `${endX}px`,
        top: `${endY}px`,
        width: `${targetRect.width}px`,
        height: `${targetRect.height}px`
      }
    ], {
      duration: 340,
      easing: 'cubic-bezier(.2,.8,.2,1)',
      fill: 'forwards'
    });

    animation.onfinish = () => finishAnimation(true);
    animation.oncancel = () => finishAnimation(false);
  });
}

async function dealCommunityCards(cardIndices, handTick) {
  const reduceMotion =
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  communityDealingIndices = new Set(cardIndices);
  dealInProgress = true;
  busy = true;

  $('deckStack').classList.add('deck-visible');
  render();

  for (const cardIndex of cardIndices) {
    if (handTick !== tick || gamePaused) return;

    const completed = await flyCommunityCard(
      cardIndex,
      handTick,
      reduceMotion
    );

    if (!completed) return;


communityDealingIndices.delete(cardIndex);

const communitySlot = $('community').querySelector(
  `.community-slot[data-index="${cardIndex}"]`
);

const communityCard = communitySlot?.querySelector('.card');

if (communityCard && !reduceMotion) {
  // Сначала показываем рубашку карты.
  communityCard.className = 'card back';
  communityCard.innerHTML = '';
  communityCard.classList.remove('deal-pending');

  // Первая половина: рубашка поворачивается ребром.
  const turnAway = communityCard.animate(
    [
      { transform: 'perspective(700px) rotateY(0deg)' },
      { transform: 'perspective(700px) rotateY(90deg)' }
    ],
    {
      duration: 60,
      easing: 'ease-in',
      fill: 'forwards'
    }
  );

  try {
    await turnAway.finished;
  } catch {}

  if (handTick !== tick || gamePaused) return;

  // Меняем рубашку на лицевую сторону в момент поворота ребром.
  communityCard.outerHTML = card(board[cardIndex]);

  const faceCard = communitySlot.querySelector('.card');

  if (faceCard) {
    const turnBack = faceCard.animate(
      [
        {
          transform: 'perspective(700px) rotateY(-90deg)',
          opacity: 0.8
        },
        {
          transform: 'perspective(700px) rotateY(0deg)',
          opacity: 1
        }
      ],
      {
        duration: 75,
        easing: 'ease-out',
        fill: 'both'
      }
    );

    try {
      await turnBack.finished;
    } catch {}
  }

  render();
} else {
  // Для режима уменьшенной анимации показываем карту сразу.
  render();
}


    if (
      !reduceMotion &&
      !(await waitForDeal(90, handTick))
    ) {
      return;
    }
  }

  $('deckStack').classList.remove('deck-visible');

  if (!(await waitForDeal(reduceMotion ? 0 : 300, handTick))) {
    return;
  }

  dealInProgress = false;
  busy = false;
  render();

  if (activeCount() <= 1) {
    runOutBoard();
    return;
  }

  rebuildQueueFromStart((firstToAct + N - 2) % N);
  advanceQueue();
}

async function dealInitialCards(smallBlindSeat, bigBlindSeat, handTick) {
  initialDealInProgress = true;
  const reduceMotion =
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  $('deckStack').classList.add('deck-visible');
  render();

  // Два круга: по одной карте каждому активному игроку.
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < players.length; i++) {
      if (handTick !== tick || gamePaused) return;
      if (players[i].folded) continue;

      const completed = await flyDealtCard(i, handTick, reduceMotion);

      if (!completed) return;

      players[i].dealtCount =
        Math.min(2, (players[i].dealtCount || 0) + 1);

      // Лицевые стороны видны только у пользователя.
      // У ИИ отображаются исключительно рубашки.
      render();

      if (!reduceMotion && !(await waitForDeal(75, handTick))) {
        return;
      }
    }
  }

  if (handTick !== tick || gamePaused) return;

  $('deckStack').classList.remove('deck-visible');

  if (!(await waitForDeal(reduceMotion ? 0 : 320, handTick))) {
    return;
  }

  dealInProgress = false;

  if (!(await revealUserHoleCards(handTick, reduceMotion))) {
    return;
  }

  initialDealInProgress = false;
  busy = false;
  render();
  // Только после раздачи карт начинаем выставление блайндов.
  // Только после раздачи карт начинаем выставление блайндов.
  const sbAmount = post(smallBlindSeat, sb);
  const bbAmount = post(bigBlindSeat, bb);

  currentBet = Math.max(...players.map(p => p.bet));

  clearActedFlags();
  rebuildQueueFromStart(firstToAct);
  actor = -1;

  render();
  runBlindSequence(
    smallBlindSeat,
    sbAmount,
    bigBlindSeat,
    bbAmount,
    handTick
  );
}


function newHand() {
  tick++;
  const thisHandTick = tick;

  clearDealSequence();
  busy = false;
  pendingAISeat = -1;

  clearTurnTimer();
  clearBlindSequence();
  clearActionTimers();
  resetBetSlider();

  $('notice').classList.remove('show');
  $('notice').innerHTML = '';

  winnerIds = [];
  winnerPayouts = {};
  winnerCombo = '';
  humanWinnerReveal = false;
  winningCards = [];
  humanFoldedCards = false;
  aiWinnerReveal = false;
  userHoleRevealBack = false;
aiShowdownRevealBack = false;
  aiWinnerId = -1;
  aiWinningCards = [];

  $('hole').classList.remove(
    'winner-hole',
    'ai-loser-hole',
    'folded-hole'
  );
  $('community').classList.remove('ai-winner-board');
  $('table').classList.remove('ai-winner-state');
  $('nextHand').classList.remove('visible');

  if (players[user] && players[user].stack <= 0) {
    logit('Стек пуст — нажми «Сбросить стек»');
    render();
    return;
  }

  handNo++;
  shuffle();
  resetAllInTableLight();
  board = [];
  renderedBoardCount = 0;
  $('community').innerHTML = '';

  pot = 0;
  currentBet = 0;
  street = 0;
  over = false;
  log = [];

  players.forEach(p => {
    p.folded = p.stack <= 0;
    p.hole = p.folded ? [] : [deck.pop(), deck.pop()];
    p.dealtCount = 0;
    p.allin = false;
    p.bet = 0;
    p.total = 0;
    p.action = '';
    p.actionAmount = 0;
    p.labelAction = '';
    p.labelAmount = 0;
    p.actionTimer = null;
    p.actionId = (p.actionId || 0) + 1;
    p.actedStreet = -1;
  });

  firstToAct = (firstToAct + 1) % N;

  const smallBlindSeat = (firstToAct + N - 2) % N;
  const bigBlindSeat = (firstToAct + N - 1) % N;

  clearActedFlags();
  rebuildQueueFromStart(firstToAct);

  actor = -1;
  dealInProgress = true;
  busy = true;

  logit('Новая раздача');
  render();

  dealInitialCards(
    smallBlindSeat,
    bigBlindSeat,
    thisHandTick
  );
}

function advanceQueue(){
 if (over || gamePaused || dealInProgress) return;
   if (allInAnimationUntil > Date.now()) {
   if (allInAdvanceTimer !== null) {
     clearTimeout(allInAdvanceTimer);
   }

   allInAdvanceTimer = setTimeout(() => {
     allInAdvanceTimer = null;

     if (!over && !gamePaused && !dealInProgress) {
       advanceQueue();
     }
   }, allInAnimationUntil - Date.now());

   return;
 }
 while(actQueue.length&&hasActedThisStreet(actQueue[0]))actQueue.shift();if(actQueue.length===0){advanceStreet();return}
 actor=actQueue[0];const p=players[actor];if(p){p.action='';p.actionAmount=0}render();if(actor!==user)scheduleAI(actor);
}
async function collectBetsVisually(handTick) {
  const soleWinner = live().length === 1 ? live()[0] : null;
const bets = players.map(p =>
  p === soleWinner ? 0 : Number(p.bet) || 0
);
  if (bets.some(amount => amount > 0)) {
    await effects.animateBetsToPot(bets);

    if (handTick !== tick || gamePaused) return false;
  }
if (soleWinner && soleWinner.bet > 0) {
  soleWinner.stack += soleWinner.bet;
  soleWinner.bet = 0;
}
  collectBetsIntoPot();
  render();

  const reduceMotion = matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  if (!(await waitForDeal(reduceMotion ? 150 : 350, handTick))) {
    return false;
  }

  return true;
}

async function advanceStreet() {
  if (over || gamePaused || dealInProgress) return;

  tick++;
  const handTick = tick;
  await lastBetFlight;

  if (handTick !== tick || gamePaused) return;
  busy = true;
  dealInProgress = true;
  clearTurnTimer();
  render();

  const collected = await collectBetsVisually(handTick);

  if (!collected) return;

  if (live().length <= 1) {
    dealInProgress = false;
    busy = false;
    finish();
    return;
  }

  let newCards;

  if (street === 0) {
    newCards = [deck.pop(), deck.pop(), deck.pop()];
    street = 1;
  } else if (street === 1) {
    newCards = [deck.pop()];
    street = 2;
  } else if (street === 2) {
    newCards = [deck.pop()];
    street = 3;
  } else {
    dealInProgress = false;
    busy = false;
    finish();
    return;
  }

  const startIndex = board.length;

  board.push(...newCards);

  currentBet = 0;
  clearActedFlags();
  logit('Открыты общие карты');

  dealCommunityCards(
    Array.from(
      { length: newCards.length },
      (_, i) => startIndex + i
    ),
    handTick
  );
}
function scheduleAI(i){
 if(over||gamePaused||dealInProgress||busy||queueHead()!==i||!eligible(i)||hasActedThisStreet(i))return;
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
 else if(a.t==='allin'){const amount=p.stack;if(amount<=0)return false;p.stack=0;p.bet+=amount;p.total+=amount;chipAmount=amount;p.allin=true;currentBet=Math.max(currentBet,p.bet);raised=currentBet>oldBet;if (firstAllInSeat === -1) {   startAllInTableLight(i); } showAction(i,'ALL-IN');logit(p.name+': ALL-IN')}
 p.actedStreet=street;dequeue(i);tick++;resetBetSlider();if(chipAmount>0){   render();   lastBetFlight = new Promise(resolve => {     requestAnimationFrame(async () => {       await effects.animateBetChip(i, chipAmount);       resolve();     });   }); }
 if(raised){rebuildQueueFromStart((i+1)%N);const k=actQueue.indexOf(i);if(k>=0)actQueue.splice(k,1);actQueue.forEach(idx=>{players[idx].actedStreet=-1})}
 render();return true;
}
async function runOutBoard() {   if (over || gamePaused || dealInProgress) return;    tick++;   const handTick = tick;    busy = true;   dealInProgress = true;   clearTurnTimer();   render();    const collected = await collectBetsVisually(handTick);    if (!collected) return;    while (board.length < 5) {     board.push(deck.pop());   }    street = 4;   dealInProgress = false;   busy = false;    render();   finish(); }

const feedbackReminder = initFeedbackReminder({
  $,
  getHandNo: () => handNo,
  getGamePaused: () => gamePaused,
  getTournamentMode: () => tournamentMode
});
 async function animateAIShowdownCards(handTick) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    aiShowdownRevealBack = false;
    render();
    return;
  }

  const backs = [
    ...document.querySelectorAll('.ai-seat-cards .ai-reveal-back')
  ];

  await Promise.all(backs.map(el => el.animate(
    [
      { transform: 'perspective(700px) rotateY(0deg)' },
      { transform: 'perspective(700px) rotateY(90deg)' }
    ],
    {
      duration: 180,
      easing: 'ease-in',
      fill: 'forwards'
    }
  ).finished.catch(() => {})));

  if (handTick !== tick || gamePaused) return;

  aiShowdownRevealBack = false;
  render();

  const faces = [
    ...document.querySelectorAll('.ai-seat-cards .mini-card')
  ];

  await Promise.all(faces.map(el => el.animate(
    [
      {
        transform: 'perspective(700px) rotateY(-90deg)',
        opacity: 0.8
      },
      {
        transform: 'perspective(700px) rotateY(0deg)',
        opacity: 1
      }
    ],
    {
      duration: 220,
      easing: 'ease-out',
      fill: 'both'
    }
  ).finished.catch(() => {})));

  if (handTick === tick && !gamePaused) render();
}     
function finish(){
 if(over)return; tick++; busy=false; pendingAISeat=-1; clearTurnTimer(); clearBlindSequence(); clearActionTimers(); over=true; actQueue=[];  const survivors = live(); if (survivors.length === 1 && survivors[0].bet > 0) {   survivors[0].stack += survivors[0].bet;   survivors[0].bet = 0; }  collectBetsIntoPot();
 let winners=[],winnerScore=null;humanWinnerReveal=false;winningCards=[];aiWinnerReveal=false;aiWinnerId=-1;aiWinningCards=[];
 if(survivors.length===1)winners=survivors;else{street=4;const ranked=survivors.map(p=>({p,s:score([...p.hole,...board])})).sort((a,b)=>cmp(b.s,a.s));winnerScore=ranked[0].s;winners=ranked.filter(x=>cmp(x.s,winnerScore)===0).map(x=>x.p)}
 const each=Math.floor(pot/winners.length),rem=pot%winners.length;winnerIds=[];winnerPayouts={};
 winners.forEach((p,i)=>{const payout=each+(i===0?rem:0);p.stack+=payout;const idx=players.indexOf(p);winnerIds.push(idx);winnerPayouts[idx]=payout});
 winnerCombo=survivors.length>1&&winnerScore?handNames[winnerScore[0]]:'БЕЗ ВСКРЫТИЯ';const userWon=winners.includes(players[user]);
 if(userWon){humanWinnerReveal=true;if(survivors.length>1&&board.length===5)winningCards=bestFive([...players[user].hole,...board]).cards}
 else{const aiWinners=winners.filter(p=>players.indexOf(p)!==user);if(aiWinners.length>0){aiWinnerReveal=survivors.length>1;aiWinnerId=players.indexOf(aiWinners[0]);humanFoldedCards=true;if(survivors.length>1&&board.length===5)aiWinningCards=bestFive([...aiWinners[0].hole,...board]).cards}}
  aiShowdownRevealBack = survivors.length > 1;
$('message').textContent=userWon?'Победа!':`Победитель: ${winners.map(p=>p.name).join(', ')}`;
render();

if (aiShowdownRevealBack) {
  animateAIShowdownCards(tick);
}
 feedbackReminder.showAfterThirdHand();
}
function userAct(t){
 if(over||busy||dealInProgress||gamePaused||actor!==user||!eligible(user)||queueHead()!==user||hasActedThisStreet(user))return;
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
 if(!gameStarted||gamePaused||dealInProgress||initialDealInProgress)return;
 savedGameState=captureGameState();cancelAllInAdvanceTimer();tournamentClock.stop(true);savedGameState.blindRemaining=blindRemaining;gamePaused=true;tick++;clearTurnTimer();clearBlindSequence();clearActionTimers();busy=false;
 $('startScreen').classList.remove('hidden');$('startScreen').classList.add('exit-mode');$('exitMenuButtons').classList.add('visible');$('playButton').style.display='none';
 $('startScreen').querySelector('.start-version').textContent=DISPLAY_VERSION;
$('gameVersionDisplay').textContent=DISPLAY_VERSION;
}
function restoreSavedGame(){
 if(!savedGameState)return;
 cancelAllInAdvanceTimer();
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
if (!over && !dealInProgress) {
  advanceQueue();
}
}
function resetStacksAndRestart(){
 cancelAllInAdvanceTimer();
 gamePaused=false;clearTurnTimer();clearBlindSequence();clearActionTimers();tick++;clearDealSequence();busy=false;pendingAISeat=-1;
 winnerIds=[];winnerPayouts={};winnerCombo='';humanWinnerReveal=false;winningCards=[];humanFoldedCards=false;aiWinnerReveal=false;aiShowdownRevealBack=false;userHoleRevealBack=false;aiWinnerId=-1;aiWinningCards=[];
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
