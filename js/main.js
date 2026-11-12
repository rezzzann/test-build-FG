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
import { card, miniCard, fmt, compactFmt } from './format.js';
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
import { createBetControl } from './bet-control.js';
import { createWinnerChipVfx } from './winner-chip-vfx.js';
import { initUpdates } from './updates.js';
import { initFeedbackReminder } from './feedback.js';
import { initializeTournamentStats,recordCompletedHand} from './player-stats.js';
(()=>{'use strict';
const suits=[['♠',0],['♥',1],['♦',1],['♣',0]];
const $=id=>document.getElementById(id),user=0;
      const winnerChipVfx = createWinnerChipVfx();
const seatClass=['s3','s2','s0','s1'],cardPos=['','c2','c0','c1'];
const streetNames=['ПРЕФЛОП','ФЛОП','ТЁРН','РИВЕР','ШОУДАУН'],N=4;
const GAME_VERSION='v0.5.18 alpha';
      // ВРЕМЕННЫЙ ТЕСТ: все ИИ идут ALL-IN в первой раздаче.
const TEST_FIRST_HAND_AI_ALL_IN = false;
     // Временно возвращает ручной переход к следующей раздаче.
const TEST_MANUAL_NEXT_HAND = false;
      // ALL-IN для всех ИИ на каждой раздаче.
const TEST_ALL_HANDS_AI_ALL_IN = false;
// Включение / отключение таймера хода.
const TEST_ACTION_CLOCK_ENABLED = true;
const DISPLAY_VERSION=GAME_VERSION;
// Текущий режим турнира: classic или highroller.
let tournamentMode = 'classic';
let blindLevel = 0;
// Оставшееся время текущего уровня в миллисекундах.
// Длительность автоматически берётся из tournament.js.
let blindRemaining = getTournamentSettings(tournamentMode).blindLevelDuration;
const BUG_REPORT_ENDPOINT='https://pokereza-bug-reporter.17-rezan.workers.dev/report';
let players=[],deck=[],board=[],pot=0,currentBet=0,street=0,actor=-1,handNo=0;
      // Таймер хода игрока и визуальный таймер ИИ.

const ACTION_CLOCK_DURATION = 15000;
let actionClockTimer = null;
let activeTurnClock = null;
let turnClockOverlay = null;
let pendingActionClockRestore = null;

function getActionClockSnapshot() {
  if (!activeTurnClock) return null;

  const elapsed = performance.now() - activeTurnClock.startedAt;

  return {
    seat: activeTurnClock.seat,
    remaining: Math.max(0, activeTurnClock.duration - elapsed)
  };
}

function updateTurnClockOverlay() {
  if (!turnClockOverlay || !activeTurnClock) return;

  const seat = document.querySelector(
    `.seat[data-player-index="${activeTurnClock.seat}"]`
  );

  if (!seat) return;

  const rect = seat.getBoundingClientRect();

  turnClockOverlay.style.left = `${rect.left}px`;
  turnClockOverlay.style.top = `${rect.top}px`;
  turnClockOverlay.style.width = `${rect.width}px`;
  turnClockOverlay.style.height = `${rect.height}px`;
  turnClockOverlay.style.borderRadius = getComputedStyle(seat).borderRadius;
  const svg = turnClockOverlay.querySelector('svg');
const rectShape = svg?.querySelector('rect');

if (svg && rectShape) {
  const width = rect.width;
  const height = rect.height;
  const radius = parseFloat(
    getComputedStyle(seat).borderTopLeftRadius
  ) || 0;

  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);

  rectShape.setAttribute('x', '1.5');
  rectShape.setAttribute('y', '1.5');
  rectShape.setAttribute('width', Math.max(0, width - 3));
  rectShape.setAttribute('height', Math.max(0, height - 3));
  rectShape.setAttribute('rx', radius);
}
}

function clearActionClock() {
  if (actionClockTimer !== null) {
    clearTimeout(actionClockTimer);
    actionClockTimer = null;
  }

  if (turnClockOverlay) {
    turnClockOverlay.remove();
    turnClockOverlay = null;
  }

  activeTurnClock = null;
}

function startActionClock(seat) {
    if (!TEST_ACTION_CLOCK_ENABLED) {
    clearActionClock();
    return;
  }
  // Не перезапускаем таймер при повторном вызове
  // для того же игрока в рамках того же хода.
  if (
    activeTurnClock &&
    activeTurnClock.seat === seat &&
    activeTurnClock.tick === tick
  ) {
    updateTurnClockOverlay();
    return;
  }

  clearActionClock();

  const restoredClock =
    pendingActionClockRestore?.seat === seat
      ? pendingActionClockRestore
      : null;

  pendingActionClockRestore = null;

  const remaining = restoredClock
    ? restoredClock.remaining
    : ACTION_CLOCK_DURATION;

  const elapsed = ACTION_CLOCK_DURATION - remaining;

  activeTurnClock = {
    seat,
    tick,
    startedAt: performance.now(),
    duration: remaining
  };

 const overlay = document.createElement('div');
overlay.className = 'turn-clock-overlay';

overlay.innerHTML = `
  <svg aria-hidden="true">
    <rect
      pathLength="1000"
      fill="none"
      stroke="#39ff78"
      stroke-width="3"
      stroke-dasharray="1000"
      stroke-dashoffset="1000"
    />
  </svg>
`;

document.body.appendChild(overlay);
  turnClockOverlay = overlay;
  updateTurnClockOverlay();
    const clockRect = overlay.querySelector('rect');

  if (clockRect && elapsed > 0) {
    clockRect.style.animationDelay = `-${elapsed}ms`;
  }

  // Для ИИ таймер только визуальный.
  if (seat !== user) return;

  const handTick = tick;

  actionClockTimer = setTimeout(() => {
    actionClockTimer = null;

    if (
      !activeTurnClock ||
      activeTurnClock.seat !== user ||
      tick !== handTick ||
      actor !== user ||
      over ||
      gamePaused ||
      busy ||
      dealInProgress ||
      queueHead() !== user ||
      !eligible(user) ||
      hasActedThisStreet(user)
    ) {
      clearActionClock();
      return;
    }

    userAct('fold');
  }, remaining);
}

window.addEventListener('resize', updateTurnClockOverlay);

      let pendingPreAction = null;
      let playerStatsViewTimers = [];
let over=false,busy=false,sb=10,bb=20,log=[],tick=0,turnTimer=null,actQueue=[],firstToAct=3; let dealerSeat=0;
      let winnerChipAnimating = false;
let allInAnimationUntil = 0; let allInAdvanceTimer = null;
  let firstAllInSeat = -1;
let allInLightTimer = null;
let allInLightCleanupTimer = null;
let allInLightEndHandler = null;
      function registerPlayerAllIn(playerIndex) {
  const player = players[playerIndex];

  if (
    !player ||
    !player.allin ||
    player.allinFlame
  ) return;

  player.allinFlame = true;

  // Первый ALL-IN запускает круговой свет.
  if (firstAllInSeat === -1) {
    startAllInTableLight(playerIndex);
    return;
  }

  // Все последующие ALL-IN:
  // только плавное появление верхнего и бокового пламени.
  startFireWarmup(playerIndex, {
    mode: 'regular',
    startHeight: 0,
    endHeight: playerIndex === 0 ? 30 : 15,
    sideOpacity: 0,
    secondary: 1
  });

  render();
}

// После вскрытия сохраняем огонь только победителям.
function settleAllInFire(winnerIndexes) {
  // Если в раздаче не было ALL-IN — ничего не делаем.
  if (firstAllInSeat === -1) return;

  const winnerSet = new Set(winnerIndexes);

  // Определяем игроков, которые действительно пошли ALL-IN,
  // проиграли раздачу и у которых ещё горит пламя.
  const loserIndexes = players
    .map((player, index) => index)
    .filter(index =>
      !winnerSet.has(index) &&
      players[index].allinFlame
    );

  if (loserIndexes.length === 0) return;

  // Затухает только пламя проигравших ALL-IN игроков.
  extinguishFire(loserIndexes, () => {
    loserIndexes.forEach(index => {
      players[index].allinFlame = false;
    });

    render();
  });
}
function startAllInTableLight(playerIndex) {
  if (firstAllInSeat !== -1) return;

  firstAllInSeat = playerIndex;

  const table = $('table');
  if (!table) return;

  if (allInLightTimer !== null) {
    clearTimeout(allInLightTimer);
    allInLightTimer = null;
  }

  if (allInLightCleanupTimer !== null) {
    clearTimeout(allInLightCleanupTimer);
    allInLightCleanupTimer = null;
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

  table.classList.remove(
    'allin-light-extinguishing',
    'allin-light-finished'
  );

  trail.style.setProperty(
    '--allin-start-angle',
    `${startAngle}deg`
  );

  table.appendChild(trail);

  function finishLight() {
    if (!table.classList.contains('allin-light-active')) {
      return;
    }

    table.classList.remove('allin-light-active');
    table.classList.add('allin-light-finished');

    if (allInLightTimer !== null) {
      clearTimeout(allInLightTimer);
      allInLightTimer = null;
    }

    trail.removeEventListener(
      'animationend',
      handleLightAnimationEnd
    );

    allInLightEndHandler = null;

   // Вспышку получает только первый ALL-IN.
// Если он проиграл, его огонь уже затухает.
if (
  firstAllInSeat !== -1 &&
  (
    !over ||
    (firstAllInSeat === user && winnerIds.includes(firstAllInSeat))
  )
) {
  flareFire(firstAllInSeat);
  render();
}
  }

  function handleLightAnimationEnd(event) {
    if (event.animationName !== 'allinLightRun') return;

    finishLight();
  }

  allInLightEndHandler = handleLightAnimationEnd;

  trail.addEventListener(
    'animationend',
    handleLightAnimationEnd
  );

  table.classList.add('allin-light-active');
  // Запускаем слабое верхнее пламя одновременно с лучом.
const firstPlayer = players[playerIndex];

if (firstPlayer) {
  firstPlayer.allinFlame = true;

  startFireWarmup(playerIndex, {
    mode: 'first',
    startHeight: 0,
    endHeight: playerIndex === 0 ? 30 : 15,
    sideOpacity: 1,
    secondary: 0
  });

  render();
}

  // Резервный запуск, если браузер не отправит animationend.
  allInLightTimer = setTimeout(
    finishLight,
    1400
  );
}

function resetAllInTableLight() {
  if (allInLightTimer !== null) {
    clearTimeout(allInLightTimer);
    allInLightTimer = null;
  }

  const table = $('table');
  const trail = table?.querySelector('.allin-light-trail');

  // Отменяем ожидающий запуск огня,
  // если новая раздача началась до завершения луча.
  if (trail && allInLightEndHandler) {
    trail.removeEventListener(
      'animationend',
      allInLightEndHandler
    );
  }

  allInLightEndHandler = null;
  firstAllInSeat = -1;

  if (table) {
    table.classList.remove(
      'allin-light-active',
      'allin-light-finished'
    );

    if (trail) {
      table.classList.add('allin-light-extinguishing');

      if (allInLightCleanupTimer !== null) {
        clearTimeout(allInLightCleanupTimer);
      }

      allInLightCleanupTimer = setTimeout(() => {
        trail.remove();

        table.classList.remove(
          'allin-light-extinguishing'
        );

        allInLightCleanupTimer = null;
      }, 900);

    } else {
      table.classList.remove(
        'allin-light-extinguishing'
      );
    }
  }

  const hasActiveFlame = players.some(
    player => player.allinFlame
  );

  if (hasActiveFlame) {
    // Сначала затухает пламя.
    // Флаги убираются только после завершения анимации.
extinguishFire(() => {
  players.forEach(player => {
    player.allinFlame = false;
  });

  // Убираем только класс пламени,
  // не перерисовывая весь игровой интерфейс.
  document
    .querySelectorAll('#seats .seat.allin-flame-active')
    .forEach(seat => {
      seat.classList.remove('allin-flame-active');
    });
});

  } else {
    players.forEach(player => {
      player.allinFlame = false;
    });
  }
}
function cancelAllInAdvanceTimer() {
  if (allInAdvanceTimer !== null) {
    clearTimeout(allInAdvanceTimer);
    allInAdvanceTimer = null;
  }

  allInAnimationUntil = 0;
}
let renderedBoardCount=0,winnerIds=[],winnerPayouts={},winnerCombo='';
let humanWinnerReveal=false,winningCards=[],humanFoldedCards=false,winningLiftActive=false;
let aiWinnerReveal=false,aiWinnerId=-1,aiWinningCards=[];
let chipFlightId=0,blindSequenceTimer=null,gameStarted=false,gamePaused=false,savedGameState=null; let dealInProgress=false; let autoPauseRequested = false; let autoPauseActive = false; let pageIsHidden = document.visibilityState === 'hidden'; let betFlightInProgress = false; let communityDealingIndices = new Set(); let userHoleRevealBack = false; let aiShowdownRevealBack = false;let initialDealInProgress = false;
      let collectingBets = false;
let betControlOpen = false;

// Временные значения стека для отображения до старта полёта фишек.
let stackDisplayOverrides = {};
      // Состояние плавного обновления подсветки комбинации.
let comboDisplayAnalysis = null;
let comboDisplayLocked = false;
let comboDisplayShowCore = false;
let comboTransitionPhase = '';
let lastBetFlight = Promise.resolve();      
const effects = createEffects({
  getBetChipConfig,
  seatClass,
  getPaused: () => gamePaused
});
let pendingAISeat=-1;
      let aiDecisionTimerState = null;
let pendingAIDelayRestore = null;

function getAIDelaySnapshot() {
  if (!aiDecisionTimerState) return null;

  return {
    seat: aiDecisionTimerState.seat,
    stage: aiDecisionTimerState.stage,
    remaining: Math.max(
      0,
      aiDecisionTimerState.duration -
      (performance.now() - aiDecisionTimerState.startedAt)
    )
  };
}
function applyTournamentMode(resetClock=true){
 const high=tournamentMode==='highroller';
 $('table').classList.toggle('high-roller',high);
 $('tableWatermark').textContent=high?'HIGH ROLLER':'POKEREZA';
 if(resetClock){blindLevel=0;blindRemaining=getTournamentSettings(tournamentMode).blindLevelDuration;}
 [sb,bb]=getBlindLevels(tournamentMode)[blindLevel]||getBlindLevels(tournamentMode)[0];
 updateTournamentDisplay();
}

function updateTournamentDisplay() {
  const high = tournamentMode === 'highroller';

  const blindsDisplay = $('blindsDisplay');
  const blindsValues = $('blindsValues');
  const nextBlinds = `${compactFmt(sb)} / ${compactFmt(bb)}`;

  if (blindsDisplay && blindsValues) {
    const previousBlinds = blindsDisplay.dataset.blinds;

    if (previousBlinds !== nextBlinds) {
      blindsValues.textContent = nextBlinds;
      blindsDisplay.dataset.blinds = nextBlinds;

      // Анимация только при реальном изменении блайндов.
      if (previousBlinds) {
        blindsDisplay.classList.remove('level-up');
        void blindsDisplay.offsetWidth;
        blindsDisplay.classList.add('level-up');
      }
    }
  }

  $('handStatus').textContent = high
    ? `HIGH ROLLER · УР. ${blindLevel + 1} · ${Math.ceil(Math.max(0, blindRemaining) / 1000)}с`
    : '';

  $('table').classList.toggle('high-roller', high);
  $('tableWatermark').textContent = high ? 'HIGH ROLLER' : 'POKEREZA';
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
   p.thinkingStartedAt = 0;
 });

 effects.clearFlyingChips();
}
function clearPlayerStatsViewTimers() {
  playerStatsViewTimers.forEach(timer => {
    if (timer !== null) clearTimeout(timer);
  });

  playerStatsViewTimers = [];
}
function showAction(i,text,amount=0,duration=2000){
 const p=players[i];if(!p)return;if(p.actionTimer){clearTimeout(p.actionTimer);p.actionTimer=null}
 p.actionId=(p.actionId||0)+1;const id=p.actionId,label=String(text).toUpperCase();
 p.action=label;p.actionAmount=Number(amount)||0;p.labelAction=label;p.labelAmount=0;p.thinkingStartedAt=0;
 const actionDuration = label === 'ALL-IN' ? 2000 : duration; if (label === 'ALL-IN') {
  allInAnimationUntil = Date.now() + 1500;
} p.actionTimer = setTimeout(() => {   if (p.actionId !== id) return;   p.actionTimer = null;   p.labelAction = '';   p.labelAmount = 0;   if (!gamePaused) render(); }, actionDuration);
}
function showThinking(i){
  const p = players[i];
  if (!p) return;

  if (p.actionTimer) {
    clearTimeout(p.actionTimer);
    p.actionTimer = null;
  }

  p.actionId = (p.actionId || 0) + 1;
  p.labelAction = 'ДУМАЕТ';
  p.labelAmount = 0;
  p.thinkingStartedAt = performance.now();
}
      function clearThinking(i) {
  const p = players[i];

  if (!p || p.labelAction !== 'ДУМАЕТ') return;

  if (p.actionTimer) {
    clearTimeout(p.actionTimer);
    p.actionTimer = null;
  }

  p.actionId = (p.actionId || 0) + 1;
  p.labelAction = '';
  p.labelAmount = 0;
  p.thinkingStartedAt = 0;

  if (!gamePaused) render();
}
function runBlindSequence(sbi, sbAmount, bbi, bbAmount, handTick) {
  render();

  const reduceMotion = matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  // Сначала показываем малый блайнд.
  showAction(sbi, 'М. БЛАЙНД', sbAmount, 1000);
  render();

  if (sbAmount > 0) {
    requestAnimationFrame(() => {
      effects.animateBetChip(   sbi,   sbAmount,   () => releaseStackDisplay(sbi) );
    });
  }

  // Затем переходим к большому блайнду.
  blindSequenceTimer = setTimeout(() => {
    blindSequenceTimer = null;

    if (over || handTick !== tick || gamePaused) return;

    // Теперь разрешаем отображение ставки большого блайнда.
    if (players[bbi]) {
      players[bbi].blindBetPending = false;
    }

    // ALL-IN большого блайнда регистрируем именно сейчас.
    if (bbAmount > 0 && players[bbi]?.allin) {
      registerPlayerAllIn(bbi);
    }

    showAction(bbi, 'Б. БЛАЙНД', bbAmount, 1000);
    render();

    if (bbAmount > 0) {
      requestAnimationFrame(() => {
        effects.animateBetChip(   bbi,   bbAmount,   () => releaseStackDisplay(bbi) );
      });
    }

    // После завершения анимации разрешаем первый ход.
    blindSequenceTimer = setTimeout(() => {
      blindSequenceTimer = null;

      if (!over && handTick === tick && !gamePaused) {
        advanceQueue();
      }
    }, reduceMotion ? 200 : 1100);

  }, reduceMotion ? 200 : 1100);
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
function nextSeatWithChips(fromSeat) {
  for (let step = 1; step <= N; step++) {
    const index = (fromSeat + step) % N;

    if (players[index] && players[index].stack > 0) {
      return index;
    }
  }

  return -1;
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

const {   render,   renderHandBets,   renderCommunity,   startFireWarmup,
flareFire,   extinguishFire } = createRenderer({
  $,
  getState: () => ({
    players,
    stackDisplayOverrides,
    pot,
    street,
    tournamentMode,
    blindLevel,
    blindRemaining,
    sb,
    bb,
    humanWinnerReveal,
    winningLiftActive,
    aiWinnerReveal,
    humanFoldedCards,
    winningCards,
    aiWinningCards,
    aiWinnerId,
    winnerIds,
    winnerPayouts,
    winnerCombo,
    actor,
pendingPreAction,
over,
    busy,
    gamePaused,
    actQueue,
    currentBet,
        gameStarted,
        testManualNextHand: TEST_MANUAL_NEXT_HAND,
    dealInProgress,
    collectingBets,
    betControlOpen,
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
   comboDisplayAnalysis,
comboDisplayLocked,
comboDisplayShowCore,
comboTransitionPhase,

aiWinnerAnalysis: aiWinningCards.length &&
  players[aiWinnerId]?.hole?.length
    ? analyzeHand([...players[aiWinnerId].hole, ...board])
    : null
  }),
  card,
  miniCard,
  fmt,
  compactFmt,
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
      const betControl = createBetControl({
  table: $('table'),
  getState: () => ({
    players,
    user,
    currentBet,
    bb
  }),
  format: compactFmt
});
function setWinnerChipControlsLocked(locked) {
  winnerChipAnimating = locked;

  ['nextHand', 'newHand', 'reset', 'exitButton']
    .forEach(id => {
      const control = $(id);
      if (control) control.disabled = locked;
    });
}

function playWinnerChipForWinner(winnerIndexes) {
  // Фишка предназначена исключительно пользователю.
  if (
    !winnerIndexes.includes(user) ||
    !players[user]?.wentAllInThisHand ||
    live().length <= 1
  ) {
    return Promise.resolve();
  }

  const target = document.querySelector(
    '#seats .seat.user-seat > div:last-child'
  );

  if (!target) return Promise.resolve();

  setWinnerChipControlsLocked(true);

  let animation;

  try {
    animation = winnerChipVfx.play(
      target,
      winnerPayouts[user] || 0
    );
  } catch (error) {
    console.error('Winner chip animation error:', error);
    setWinnerChipControlsLocked(false);
    return Promise.resolve();
  }

  return Promise.resolve(animation)
    .catch(error => {
      console.error('Winner chip animation error:', error);
    })
    .finally(() => {
      setWinnerChipControlsLocked(false);
    });
}
      function releaseStackDisplay(playerIndex) {
  if (!Object.prototype.hasOwnProperty.call(
    stackDisplayOverrides,
    playerIndex
  )) {
    return;
  }

  delete stackDisplayOverrides[playerIndex];
  render();
}
function post(i, n) {
  const p = players[i];

  if (!p || p.folded || p.stack <= 0) return 0;

  const v = Math.min(n, p.stack);
  if (v <= 0) return 0;

  stackDisplayOverrides[i] = p.stack;

  p.stack -= v;
  p.bet += v;
  p.total += v;

  if (p.stack === 0) {
    p.allin = true;
  }

  return v;
}
function resetBetSlider() {   betControlOpen = false;   betControl.reset(); }

function clearDealSequence() {
  dealInProgress = false;
  collectingBets = false;
initialDealInProgress = false;
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
async function transitionComboDisplay(handTick) {
  const nextAnalysis =
    players[user] &&
    !players[user].folded &&
    players[user].hole?.length
      ? analyzeHand([...players[user].hole, ...board])
      : null;

  const nextShowCore = street === 0
    ? nextAnalysis?.score?.[0] === 1
    : !!nextAnalysis;

  const getSignature = analysis => {
    if (!analysis) return '';

    const cards = (analysis.coreCards || [])
      .map(c => `${c.r}${c.s}`)
      .sort()
      .join('|');

    return `${analysis.name}|${cards}`;
  };

  const previousSignature = getSignature(comboDisplayAnalysis);
  const nextSignature = getSignature(nextAnalysis);

  // Если комбинация не изменилась, оставляем подсветку без анимации.
  if (
    previousSignature === nextSignature &&
    comboDisplayShowCore === nextShowCore
  ) {
    comboDisplayAnalysis = nextAnalysis;
    comboDisplayLocked = false;
    comboTransitionPhase = '';
    render();
    return true;
  }

  const reduceMotion = matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  const duration = reduceMotion ? 0 : 1200;

  // Старая комбинация остаётся зафиксированной.
  // Плавно убираем её рамки и подпись.
  comboTransitionPhase = 'out';
  render();

  if (!(await waitForDeal(duration, handTick))) return false;

  // Устанавливаем новую комбинацию и запускаем её появление.
  comboDisplayAnalysis = nextAnalysis;
  comboDisplayShowCore = nextShowCore;
  comboDisplayLocked = false;
  comboTransitionPhase = 'in';
  render();

  if (!(await waitForDeal(duration, handTick))) return false;

  comboTransitionPhase = '';
  render();

  return true;
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
targetClone.style.cssText = target.style.cssText;
targetClone.style.visibility = 'hidden';
targetClone.style.pointerEvents = 'none';
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

const cardIndex = dealtCount;


const targetPlaceholder = placeholders[cardIndex];
const targetRect = targetPlaceholder.getBoundingClientRect();

const targetWidth = targetPlaceholder.offsetWidth;
const targetHeight = targetPlaceholder.offsetHeight;

// Угол полёта должен совпадать с конечным веером.
const targetRotation = isUser
  ? (cardIndex === 0 ? '-8deg' : '8deg')
  : (cardIndex === 0 ? '-10deg' : '10deg');
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

const endX =
  targetRect.left -
  tableOriginX +
  (targetRect.width - targetWidth) / 2;

const endY =
  targetRect.top -
  tableOriginY +
  (targetRect.height - targetHeight) / 2;

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
    height: `${startHeight}px`,
    rotate: '0deg'
  },
  {
    left: `${endX}px`,
    top: `${endY}px`,
    width: `${targetWidth}px`,
    height: `${targetHeight}px`,
    rotate: targetRotation
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
      duration: 240,
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
      duration: 240,
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

async function dealCommunityCards(cardIndices, handTick, isRunout = false) {
  const reduceMotion =
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  communityDealingIndices = new Set(cardIndices);
  dealInProgress = true;
  busy = true;

  $('deckStack').classList.add('deck-visible');
  render();

  for (const cardIndex of cardIndices) {
    if (handTick !== tick || gamePaused) return;
    if (isRunout) {
      street = cardIndex === 3 ? 2 : 3;
    }
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
      duration: 120,
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
        duration: 120,
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

   // Если игроков, способных продолжать ставки, осталось не больше одного,
  // не скрываем колоду и автоматически раздаём оставшиеся карты.
  if (!isRunout && activeCount() <= 1) {
    await runOutBoard(handTick);
    return;
  }

  $('deckStack').classList.remove('deck-visible');

  if (!(await waitForDeal(reduceMotion ? 0 : 300, handTick))) {
    return;
  }

  if (isRunout) {
    street = 4;
  }

   dealInProgress = false;

  // При обычном переходе обновляем комбинацию только после раздачи.
  if (!isRunout) {
    busy = true;

    const updated = await transitionComboDisplay(handTick);
    if (!updated) return;
} else {
  comboDisplayAnalysis = null;
  comboDisplayShowCore = false;
  comboDisplayLocked = false;
  comboTransitionPhase = '';
}

  busy = false;
  render();

  // После автоматической раздачи всех оставшихся карт — шоудаун.
  if (isRunout) {
    finish();
    return;
  }

  // Обычный режим: начинаем следующий круг ставок.
  rebuildQueueFromStart(nextSeatWithChips(dealerSeat));
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

// Скрываем большой блайнд до его очереди анимации.
players[bigBlindSeat].blindBetPending = bbAmount > 0;

// Малый блайнд регистрируем сразу.
if (sbAmount > 0 && players[smallBlindSeat].allin) {
  registerPlayerAllIn(smallBlindSeat);
}

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
  pendingPreAction = null;
  clearActionClock();

  if (winnerChipAnimating) return;

  // Применяем новый уровень только перед фактическим началом раздачи.
  tournamentClock.applyPendingLevel();
  // Очищаем незавершённые события предыдущей раздачи.
  cancelAllInAdvanceTimer();

  // Не переносим ожидание анимации фишек в новую раздачу.
  lastBetFlight = Promise.resolve();
stackDisplayOverrides = {};
  initialDealInProgress = false;
  comboDisplayAnalysis = null;
comboDisplayLocked = false;
comboDisplayShowCore = false;
comboTransitionPhase = '';

  tick++;
  const thisHandTick = tick;

  clearDealSequence();
  busy = false;
  pendingAISeat = -1;
  aiDecisionTimerState = null;
pendingAIDelayRestore = null;

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
  winningLiftActive = false;
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

winnerChipVfx.fadeOut();
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
    p.wentAllInThisHand = false;
p.blindBetPending = false;
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

  const playersWithChips = players.filter(
  p => p.stack > 0
).length;

if (playersWithChips < 2) {
  over = true;
  dealInProgress = false;
  busy = false;

  const champion = players.find(p => p.stack > 0);
  logit(`Турнир завершён. Победитель: ${champion?.name || '—'}`);
  render();
  return;
}

// Передвигаем дилера к следующему игроку с фишками.
dealerSeat = nextSeatWithChips(dealerSeat);

let smallBlindSeat;
let bigBlindSeat;

if (playersWithChips === 2) {
  // Хедз-ап: дилер ставит малый блайнд.
  smallBlindSeat = dealerSeat;
  bigBlindSeat = nextSeatWithChips(dealerSeat);

  // Дилер первым действует на префлопе.
  firstToAct = dealerSeat;
} else {
  // Обычная игра: дилер → малый → большой блайнд.
  smallBlindSeat = nextSeatWithChips(dealerSeat);
  bigBlindSeat = nextSeatWithChips(smallBlindSeat);

  // Первый ход после большого блайнда.
  firstToAct = nextSeatWithChips(bigBlindSeat);
}
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

function tryAutoPause() {
  if (
    !autoPauseRequested ||
    !gameStarted ||
    gamePaused
  ) {
    return false;
  }

  // Не прерываем игровые переходы и анимации.
  if (
    winnerChipAnimating ||
    busy ||
    betFlightInProgress ||
    dealInProgress ||
    initialDealInProgress ||
    comboTransitionPhase ||
    blindSequenceTimer !== null
  ) {
    return false;
  }

  pauseGameForMenu();

  if (gamePaused) {
    autoPauseRequested = false;
    autoPauseActive = true;
    return true;
  }

  return false;
}
      
function advanceQueue(){
  if (over || gamePaused || dealInProgress) return;

  if (autoPauseRequested) {
    if (tryAutoPause()) return;

    // Не запускаем следующий ход, пока ожидаем
    // завершения текущей анимации или перехода.
    if (
      busy ||
      betFlightInProgress ||
      initialDealInProgress ||
      comboTransitionPhase ||
      blindSequenceTimer !== null ||
      winnerChipAnimating
    ) {
      return;
    }
  }

  // Если остался один игрок — сразу объявляем его победителем.
  if (live().length <= 1) {
    finish();
    return;
  }

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
 actor = actQueue[0];

const p = players[actor];

if (p) {
  p.action = '';
  p.actionAmount = 0;
}

// Проверяем предварительное действие пользователя.
if (actor === user && pendingPreAction) {
  const action = pendingPreAction;
  pendingPreAction = null;

  const isUnconditional =
    action.type === 'fold' ||
    action.type === 'allCall';

  const situationUnchanged =
    currentBet === action.expectedCurrentBet &&
    players[user].bet === action.expectedPlayerBet;

  if (isUnconditional || situationUnchanged) {
    const actionType =
      action.type === 'fold'
        ? 'fold'
        : action.type === 'check'
          ? 'check'
          : 'call';

    if (applyAction(user, { t: actionType })) {
      advanceQueue();
      return;
    }
  }
}

render();

// Запускаем таймер после обновления карточки игрока.
startActionClock(actor);

if (actor !== user) {
  scheduleAI(actor);
}
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
  clearActionClock();

  tick++;
  const handTick = tick;
  await lastBetFlight;

  if (handTick !== tick || gamePaused) return;

// Сохраняем подсветку предыдущей улицы до начала любых анимаций.
comboDisplayAnalysis =
  players[user] &&
  !players[user].folded &&
  players[user].hole?.length
    ? analyzeHand([...players[user].hole, ...board])
    : null;

comboDisplayShowCore = street === 0
  ? comboDisplayAnalysis?.score?.[0] === 1
  : !!comboDisplayAnalysis;

comboDisplayLocked = true;
comboTransitionPhase = '';

busy = true;
dealInProgress = true;
collectingBets = true;
clearTurnTimer();
render();

const collected = await collectBetsVisually(handTick);

collectingBets = false;

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
function scheduleAI(i) {
  if (
    over ||
    gamePaused ||
    dealInProgress ||
    busy ||
    queueHead() !== i ||
    !eligible(i) ||
    hasActedThisStreet(i)
  ) return;

  busy = true;
  pendingAISeat = i;

  const myTick = tick;

  const restored =
    pendingAIDelayRestore?.seat === i
      ? pendingAIDelayRestore
      : null;

  pendingAIDelayRestore = null;

  const startStage = (stage, duration) => {
    const state = {
      seat: i,
      stage,
      duration,
      startedAt: performance.now()
    };

    aiDecisionTimerState = state;

    turnTimer = setTimeout(() => {
      if (aiDecisionTimerState !== state) return;

      turnTimer = null;

      if (myTick !== tick || over || gamePaused) {
        return;
      }

      if (
        queueHead() !== i ||
        !eligible(i) ||
        hasActedThisStreet(i)
      ) {
        aiDecisionTimerState = null;
        busy = false;
        pendingAISeat = -1;
        clearThinking(i);
        return;
      }

      if (stage === 'beforeThinking') {
        showThinking(i);
        render();

        const thinkingDuration =
          Math.floor(Math.random() * 2501) + 1000;

        startStage('thinking', thinkingDuration);
        return;
      }

      aiDecisionTimerState = null;

      const call = Math.max(0, currentBet - players[i].bet);

      const forceAIAllIn =
        TEST_ALL_HANDS_AI_ALL_IN ||
        (TEST_FIRST_HAND_AI_ALL_IN && handNo === 1);

      const action = forceAIAllIn
        ? { t: 'allin' }
        : decide(players[i], call, board, currentBet, bb);

      busy = false;
      pendingAISeat = -1;

      if (applyAction(i, action, myTick)) {
        advanceQueue();
      }
    }, duration);
  };

  if (restored) {
    if (restored.stage === 'thinking') {
      showThinking(i);
      render();
    }

    startStage(restored.stage, restored.remaining);
  } else {
    startStage('beforeThinking', 1200);
  }
}
      // Анимация сброса карманных карт ИИ в центр стола.
function animateAIFoldCards(playerIndex) {
  if (playerIndex === user) return;

  const position = cardPos[playerIndex];
  if (!position) return;

  const source = document.querySelector(
    `.opponent-cards.${position}`
  );

  const table = $('table');

  if (!source || !table) return;

  const cards = [...source.querySelectorAll('.mini-card')];
  if (!cards.length) return;

  const rect = source.getBoundingClientRect();
  const tableRect = table.getBoundingClientRect();

  // Создаём независимую копию карт для анимации.
  const clone = source.cloneNode(true);

  clone.style.position = 'fixed';
  clone.style.left = `${rect.left}px`;
  clone.style.top = `${rect.top}px`;
  clone.style.right = 'auto';
  clone.style.width = `${rect.width}px`;
  clone.style.height = `${rect.height}px`;
  clone.style.margin = '0';
  clone.style.transform = 'none';
  clone.style.zIndex = '9999';
  clone.style.opacity = '1';
  clone.style.pointerEvents = 'none';

  document.body.appendChild(clone);

  const dx = tableRect.left + tableRect.width / 2 -
    (rect.left + rect.width / 2);

  const dy = tableRect.top + tableRect.height / 2 -
    (rect.top + rect.height / 2);

  // Обе карты одновременно летят к центру стола.
  const movement = clone.animate(
    [
      {
        transform: 'translate3d(0, 0, 0)',
        opacity: 1
      },
      {
        transform: `translate3d(${dx}px, ${dy}px, 0)`,
        opacity: 0
      }
    ],
    {
      duration: 700,
      easing: 'cubic-bezier(0.45, 0, 0.75, 0.4)',
      fill: 'forwards'
    }
  );

  // Каждая карта подкручивается во время полёта.
  clone.querySelectorAll('.mini-card').forEach((card, index) => {
    card.animate(
      [
        {
          transform: 'rotate(0deg) scale(1)',
          opacity: 1
        },
        {
          transform: 'rotate(360deg) scale(0.65)',
          opacity: 0
        }
      ],
      {
        duration: 700,
        easing: 'ease-in',
        fill: 'forwards'
      }
    );
  });

  movement.finished.then(
    () => clone.remove(),
    () => clone.remove()
  );
}
function applyAction(i,a,myTick){
 if(over||gamePaused)return false;if(typeof myTick==='number'&&myTick!==tick)return false;if(queueHead()!==i||!eligible(i)||hasActedThisStreet(i))return false;
  clearActionClock();
 const p = players[i]; const previousStack = p.stack; const oldBet = currentBet; const call = Math.max(0, currentBet - p.bet); let raised = false; let chipAmount = 0;
  // Если выбранная сумма не превышает текущую ставку,
// это уравнивание, а не повышение.
if ((a.t === 'bet' || a.t === 'raise') && call > 0) {
  const requested = Number(a.amt);

  if (!Number.isFinite(requested) || requested <= currentBet) {
    a = { t: 'call' };
  }
}
 if(a.t==='fold'){if(i!==user)animateAIFoldCards(i);p.folded=true;if(i===user)humanFoldedCards=true;showAction(i,'ФОЛД');logit(p.name+': ФОЛД')}
 else if(a.t==='check'){if(call>0)a={t:'call'};else{showAction(i,'ЧЕК');logit(p.name+': ЧЕК')}}
 if(a.t==='call'){const amount=Math.min(call,p.stack);if(amount===0){showAction(i,'ЧЕК');logit(p.name+': ЧЕК')}else{p.stack-=amount;p.bet+=amount;p.total+=amount;chipAmount=amount;if(p.stack===0)p.allin=true;const label=p.allin?'ALL-IN':'КОЛЛ';showAction(i,label);logit(p.name+': '+label)}}
 else if(a.t==='bet'||a.t==='raise'){   const requested=Number(a.amt)||bb;   const minimum=Math.max(bb,currentBet);   const target=Math.max(minimum,requested);   const amount=Math.min(Math.max(0,target-p.bet),p.stack);
  if(amount>0){p.stack-=amount;p.bet+=amount;p.total+=amount;chipAmount=amount;if(p.stack===0)p.allin=true;currentBet=Math.max(currentBet,p.bet);raised=currentBet>oldBet;const label=p.allin?'ALL-IN':(oldBet>0?'РЕЙЗ':'СТАВКА');showAction(i,label,amount);logit(p.name+': '+label+' '+fmt(amount)+' PP')}
  else if(call>0){const amountToCall=Math.min(call,p.stack);p.stack-=amountToCall;p.bet+=amountToCall;p.total+=amountToCall;chipAmount=amountToCall;if(p.stack===0)p.allin=true;showAction(i,p.allin?'ALL-IN':'КОЛЛ');logit(p.name+': '+(p.allin?'ALL-IN':'КОЛЛ'))}else{showAction(i,'ЧЕК');logit(p.name+': ЧЕК')}}
 else if(a.t==='allin'){const amount=p.stack;if(amount<=0)return false;p.stack=0;p.bet+=amount;p.total+=amount;chipAmount=amount;p.allin=true;currentBet=Math.max(currentBet,p.bet);raised=currentBet>oldBet;showAction(i,'ALL-IN');logit(p.name+': ALL-IN')}
  if (chipAmount > 0) {
  stackDisplayOverrides[i] = previousStack;
}
  
  // ALL-IN: сначала запускаем луч по столу.
// Пламя активируется только после завершения луча.
if (p.allin) {
  if (chipAmount > 0) {
    p.wentAllInThisHand = true;
  }

  registerPlayerAllIn(i);
}

 p.actedStreet=street; dequeue(i); tick++; resetBetSlider();  if (chipAmount > 0) {   render();   betFlightInProgress = true;    lastBetFlight = new Promise(resolve => {     requestAnimationFrame(async () => {       try {         await effects.animateBetChip(           i,           chipAmount,           () => releaseStackDisplay(i)         );       } finally {         betFlightInProgress = false;         resolve();          
 // Если пользователь ушёл во время полёта фишек,         
 // проверяем паузу до следующего игрового действия.        
  if (autoPauseRequested) {           advanceQueue();         }       }     });   }); }
 if(raised){rebuildQueueFromStart((i+1)%N);const k=actQueue.indexOf(i);if(k>=0)actQueue.splice(k,1);actQueue.forEach(idx=>{players[idx].actedStreet=-1})}
 render();return true;
}
async function runOutBoard(handTick) {
  if (over || gamePaused || handTick !== tick) return;

  const remainingIndices = [];

  // Подготавливаем только те карты, которых ещё нет на столе.
  while (board.length < 5) {
    remainingIndices.push(board.length);
    board.push(deck.pop());
  }

  // Если карты остались — анимируем их, не скрывая колоду.
  if (remainingIndices.length > 0) {
    await dealCommunityCards(
      remainingIndices,
      handTick,
      true
    );
    return;
  }

  // Все пять общих карт уже открыты.
  const reduceMotion = matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  $('deckStack').classList.remove('deck-visible');

  if (!(await waitForDeal(reduceMotion ? 0 : 300, handTick))) {
    return;
  }

  street = 4;
  dealInProgress = false;
  busy = false;
  render();
  finish();
}

const feedbackReminder = initFeedbackReminder({
  $,
  getHandNo: () => handNo,
  getGamePaused: () => gamePaused,
  getTournamentMode: () => tournamentMode,
  setGamePaused: value => {
    gamePaused = value;
  }
});
    async function liftWinningCards(handTick) {
  // Дополнительная пауза после вскрытия карт.
  await new Promise(resolve => setTimeout(resolve, 120));

  // Даём браузеру отрисовать исходное положение всех карт.
  await new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });

if (handTick !== tick || gamePaused) return;

// Сохраняем состояние подъёма для последующих перерисовок.
winningLiftActive = true;

// Запускаем подъём всех пяти карт одновременно.
  document
    .querySelectorAll('.winning-lift-target')
    .forEach(card => {
      card.classList.add('winning-lift');
    });
        // Ждём фактического завершения анимации подъёма карт.
  const liftAnimations = [
    ...document.querySelectorAll('.winning-lift')
  ].flatMap(card => card.getAnimations());

  await Promise.all(
    liftAnimations.map(animation => animation.finished.catch(() => {}))
  );
}
 
async function animateAIShowdownCards(handTick) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    aiShowdownRevealBack = false;
    render();
    await liftWinningCards(handTick);
    return;
  }

  // 1. Берём уже существующие рубашки карманных карт ИИ.
  const backs = [
    ...$('opponentCards').querySelectorAll(
      '.opponent-cards.ai-seat-cards .ai-reveal-back'
    )
  ];

  if (!backs.length) {
    console.warn('[Showdown] Не найдены рубашки карманных карт ИИ');
    return;
  }

  // 2. Первая половина переворота — точно как у пользователя.
  await Promise.all(backs.map(el => el.animate(
    [
      { transform: 'perspective(700px) rotateY(0deg)' },
      { transform: 'perspective(700px) rotateY(90deg)' }
    ],
    {
      duration: 240,
      easing: 'ease-in',
      fill: 'forwards'
    }
  ).finished.catch(() => {})));

  if (handTick !== tick || gamePaused) return;

  // 3. Меняем рубашки на лицевые стороны.
  // Рендерер сохраняет контейнеры и заменяет содержимое
  // существующих карточек, как при вскрытии карт пользователя.
  aiShowdownRevealBack = false;
  render();

  // 4. Получаем лицевые стороны после замены.
  const faces = [
    ...$('opponentCards').querySelectorAll(
      '.opponent-cards.ai-seat-cards .mini-card'
    )
  ];

  // 5. Вторая половина переворота — точно как у пользователя.
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
      duration: 240,
      easing: 'ease-out',
      fill: 'both'
    }
  ).finished.catch(() => {})));

  if (handTick !== tick || gamePaused) return;

  render();
  await liftWinningCards(handTick);
}

async function finish() {
  pendingPreAction = null;

  if (over) return;

  tick++;
  busy = false;
  pendingAISeat = -1;
  aiDecisionTimerState = null;
pendingAIDelayRestore = null;

  clearTurnTimer();
  clearActionClock();
  clearBlindSequence();
  clearActionTimers();

  over = true;
  actQueue = [];

  const survivors = live();

  if (survivors.length === 1 && survivors[0].bet > 0) {
    survivors[0].stack += survivors[0].bet;
    survivors[0].bet = 0;
  }

  collectBetsIntoPot();

  let winners = [];
  let winnerScore = null;

  humanWinnerReveal = false;
  winningCards = [];
  aiWinnerReveal = false;
  aiWinnerId = -1;
  aiWinningCards = [];

  if (survivors.length === 1) {
    winners = survivors;
  } else {
    street = 4;

    const ranked = survivors
      .map(p => ({
        p,
        s: score([...p.hole, ...board])
      }))
      .sort((a, b) => cmp(b.s, a.s));

    winnerScore = ranked[0].s;

    winners = ranked
      .filter(x => cmp(x.s, winnerScore) === 0)
      .map(x => x.p);
  }

  const each = Math.floor(pot / winners.length);
  const rem = pot % winners.length;

  winnerIds = [];
  winnerPayouts = {};

  winners.forEach((p, i) => {
    const payout = each + (i === 0 ? rem : 0);

    p.stack += payout;

    const idx = players.indexOf(p);

    winnerIds.push(idx);
    winnerPayouts[idx] = payout;
  });

  recordCompletedHand(players, winnerIds);

  const aiFlamingWinners = winnerIds.filter(
    index => index !== user && players[index]?.allinFlame
  );

  settleAllInFire(winnerIds);

  winnerCombo =
    survivors.length > 1 && winnerScore
      ? handNames[winnerScore[0]]
      : 'БЕЗ ВСКРЫТИЯ';

  const userWon = winners.includes(players[user]);

  if (userWon) {
    humanWinnerReveal = true;

    if (survivors.length > 1 && board.length === 5) {
      winningCards = bestFive([
        ...players[user].hole,
        ...board
      ]).cards;
    }
  } else {
    const aiWinners = winners.filter(
      p => players.indexOf(p) !== user
    );

    if (aiWinners.length > 0) {
      aiWinnerReveal = survivors.length > 1;
      aiWinnerId = players.indexOf(aiWinners[0]);
      humanFoldedCards = true;

      if (survivors.length > 1 && board.length === 5) {
        aiWinningCards = bestFive([
          ...aiWinners[0].hole,
          ...board
        ]).cards;
      }
    }
  }

  aiShowdownRevealBack = survivors.length > 1;

  $('message').textContent = userWon
    ? 'Победа!'
    : `Победитель: ${winners.map(p => p.name).join(', ')}`;

  render();

  aiFlamingWinners.forEach(index => flareFire(index));

  const finishedHandTick = tick;

  // Ждём завершения всех основных финальных анимаций.
  const finishAnimations = [
    playWinnerChipForWinner(winnerIds)
  ];

  if (aiShowdownRevealBack) {
    finishAnimations.push(
      animateAIShowdownCards(finishedHandTick)
    );
  }

  await Promise.all(finishAnimations);
  if (tryAutoPause()) return;

  // Не продолжаем, если игра была остановлена или перезапущена.
  if (
    finishedHandTick !== tick ||
    gamePaused ||
    !over
  ) {
    return;
  }

  // После всех финальных анимаций показываем напоминание
  // и ждём, пока пользователь закроет окно.
  await feedbackReminder.showAfterThirdHand();

  if (
    finishedHandTick !== tick ||
    gamePaused ||
    !over ||
    TEST_MANUAL_NEXT_HAND
  ) {
    return;
  }

  // Турнир заканчивается только тогда, когда фишки остались
  // у одного игрока. Если пользователь выбыл, ИИ продолжают.
  const playersWithChips = players.filter(
    p => p.stack > 0
  ).length;

if (playersWithChips < 2) {
  const champion = players.find(p => p.stack > 0);

  logit(`Турнир завершён. Победитель: ${champion?.name || '—'}`);
  render();
  return;
}

  // Три секунды после завершения анимаций.
  if (!(await waitForDeal(3000, finishedHandTick))) {
    return;
  }
  if (tryAutoPause()) return;

  if (
    finishedHandTick === tick &&
    !gamePaused &&
    over
  ) {
    newHand();
  }
}
function userAct(t, selectedAmount) {
  if (
    over ||
    busy ||
    dealInProgress ||
    gamePaused ||
    actor !== user ||
    !eligible(user) ||
    queueHead() !== user ||
    hasActedThisStreet(user)
  ) return;

  const call = Math.max(0, currentBet - players[user].bet);
  let a;

  if (t === 'fold') {
    a = { t: 'fold' };
  } else if (t === 'call') {
    a = call ? { t: 'call' } : { t: 'check' };
  } else if (t === 'raise') {
    const amount = Number(selectedAmount ?? betControl.getValue());
    a = { t: call ? 'raise' : 'bet', amt: amount };
  } else {
    return;
  }

  if (applyAction(user, a)) advanceQueue();
}
function start(){
 players=[{name:'Вы',icon:'♠',style:'user',stack:getStartingStack(tournamentMode)},{name:'Тайтовый',icon:'♞',style:'tight',stack:getStartingStack(tournamentMode)},{name:'Стратег',icon:'♜',style:'balanced',stack:getStartingStack(tournamentMode)},{name:'Агрессор',icon:'♛',style:'aggressive',stack:getStartingStack(tournamentMode)}];
  initializeTournamentStats(players);
  $('seats').addEventListener('click', event => {
  const seat = event.target.closest('.seat[data-player-index]');
  if (!seat) return;

  const index = Number(seat.dataset.playerIndex);
  const player = players[index];

  if (!player?.eliminated) return;

  if (playerStatsViewTimers[index] !== null &&
      playerStatsViewTimers[index] !== undefined) {
    clearTimeout(playerStatsViewTimers[index]);
  }

const statsAlreadyVisible = player.showTournamentStats;

player.showTournamentStats = true;

if (!statsAlreadyVisible) {
  player.statsRevealPlayed = false;
}

render();

player.statsRevealPlayed = true;

playerStatsViewTimers[index] = setTimeout(() => {
  if (players[index]) {
    players[index].showTournamentStats = false;
    players[index].statsReturning = true;
  }

  playerStatsViewTimers[index] = null;
  render();

  if (players[index]) {
    players[index].statsReturning = false;
  }
}, 5000);
});
function canUserAct() {
  return !over &&
    !busy &&
    !dealInProgress &&
    !gamePaused &&
    actor === user &&
    eligible(user) &&
    queueHead() === user &&
    !hasActedThisStreet(user);
}
function canUserPreAct() {
  return (
    !over &&
    !dealInProgress &&
    !initialDealInProgress &&
    !gamePaused &&
    !betControlOpen &&
    actor >= 0 && actor !== user &&
    actQueue.includes(user) &&
    eligible(user) &&
    !hasActedThisStreet(user)
  );
}

function selectPreAction(type) {
  if (!canUserPreAct()) return;

  if (type === 'fold' || type === 'allCall') {
    pendingPreAction = { type };
  } else {
    pendingPreAction = {
      type,
      expectedCurrentBet: currentBet,
      expectedPlayerBet: players[user].bet
    };
  }

  render();
}
function closeBetControl() {
  if (!betControlOpen) return;

  betControlOpen = false;
  betControl.close();
  render();
}

$('fold').onclick = () => {
  if (betControlOpen) {
    closeBetControl();
    return;
  }

  if (canUserAct()) {
    userAct('fold');
    return;
  }

  selectPreAction('fold');
};

$('checkCall').onclick = () => {
  closeBetControl();

  if (canUserAct()) {
    userAct('call');
    return;
  }

  if (currentBet > players[user].bet) {
    selectPreAction('call');
  } else {
    selectPreAction('check');
  }
};

$('raise').onclick = () => {
  if (canUserPreAct()) {
    selectPreAction('allCall');
    return;
  }

  if (!canUserAct()) return;

  if (!betControlOpen) {
    betControlOpen = true;
    betControl.open();
    render();
    return;
  }

  const selectedAmount = betControl.getValue();

  betControlOpen = false;
  betControl.close();
  render();

  userAct('raise', selectedAmount);
};

$('nextHand').onclick = () => {
  if (!gamePaused && TEST_MANUAL_NEXT_HAND) {
    newHand();
  }
};
 $('newHand').onclick=()=>{if(!gamePaused){if(over)newHand();else logit('Завершите текущую раздачу')}};
 $('reset').onclick=()=>{if(!gamePaused)resetStacksAndRestart()};resetBetSlider();
}
function captureGameState(){
 return{
  players:players.map(p=>({...p,hole:p.hole?.map(c=>({...c})),bet:Number(p.bet)||0,total:Number(p.total)||0,actionTimer:null,actionId:(p.actionId||0)+1})),
  deck:deck.map(c=>({...c})),board:board.map(c=>({...c})),pot,currentBet,street,actor,handNo,over,sb,bb,log:[...log],tick,
  actQueue:[...actQueue],firstToAct,dealerSeat,renderedBoardCount,winnerIds:[...winnerIds],winnerPayouts:{...winnerPayouts},winnerCombo,
   pendingPreAction: pendingPreAction
  ? { ...pendingPreAction }
  : null,
  humanWinnerReveal,winningLiftActive,winningCards:winningCards.map(c=>({...c})),humanFoldedCards,aiWinnerReveal,aiWinnerId,aiWinningCards:aiWinningCards.map(c=>({...c})),
  pendingAISeat, aiDelay: getAIDelaySnapshot(), actionClock: getActionClockSnapshot(), tournamentMode, blindLevel, blindRemaining, blindSequencePending: blindSequenceTimer !== null
 };
}
function pauseGameForMenu(){
 if(   winnerChipAnimating ||   !gameStarted ||   gamePaused ||   dealInProgress ||   initialDealInProgress ||   comboTransitionPhase ) return;  if (blindSequenceTimer !== null) {   logit('Дождись завершения выставления блайндов');   return; }
  resetBetSlider();
 savedGameState=captureGameState();cancelAllInAdvanceTimer();tournamentClock.stop(true);savedGameState.blindRemaining=blindRemaining;gamePaused=true;tick++;clearTurnTimer();clearActionClock();clearBlindSequence();clearActionTimers();busy=false;
 $('startScreen').classList.remove('hidden');$('startScreen').classList.add('exit-mode');$('exitMenuButtons').classList.add('visible');$('playButton').style.display='none';
 $('startScreen').querySelector('.start-version').textContent=DISPLAY_VERSION;
$('gameVersionDisplay').textContent=DISPLAY_VERSION;
}
function restoreSavedGame(){
    autoPauseRequested = false;
  autoPauseActive = false;
 if(!savedGameState)return;
 cancelAllInAdvanceTimer();
 const s=savedGameState;
 players=s.players.map(p=>({...p,actionTimer:null}));deck=s.deck.map(c=>({...c}));board=s.board.map(c=>({...c}));
 pot=s.pot;currentBet=s.currentBet;street=s.street;actor=s.actor;handNo=s.handNo;over=s.over;sb=s.sb;bb=s.bb;log=[...s.log];tick=Math.max(tick,s.tick)+1;
 actQueue=[...s.actQueue]; firstToAct=s.firstToAct; dealerSeat=s.dealerSeat??dealerSeat; renderedBoardCount=s.renderedBoardCount;winnerIds=[...s.winnerIds];winnerPayouts={...s.winnerPayouts};winnerCombo=s.winnerCombo;
  pendingPreAction = s.pendingPreAction
  ? { ...s.pendingPreAction }
  : null;
 humanWinnerReveal=s.humanWinnerReveal;winningLiftActive=!!s.winningLiftActive;winningCards=s.winningCards.map(c=>({...c}));humanFoldedCards=s.humanFoldedCards;aiWinnerReveal=s.aiWinnerReveal;aiWinnerId=s.aiWinnerId;aiWinningCards=s.aiWinningCards.map(c=>({...c}));
 pendingAISeat = s.pendingAISeat; pendingAIDelayRestore = s.aiDelay || null; aiDecisionTimerState = null; pendingActionClockRestore = s.actionClock || null;tournamentMode=s.tournamentMode||tournamentMode;blindLevel=s.blindLevel??blindLevel;blindRemaining=s.blindRemaining??blindRemaining;applyTournamentMode(false);gamePaused=false;busy=false;clearTurnTimer();clearBlindSequence();clearActionTimers();
 $('community').innerHTML='';renderedBoardCount=0;renderCommunity();
 $('startScreen').classList.add('hidden');$('startScreen').classList.remove('exit-mode');$('exitMenuButtons').classList.remove('visible');$('playButton').style.display='';

savedGameState = null;

render();
renderHandBets();
tournamentClock.start();

// Если раздача ещё продолжается — восстанавливаем очередь ходов.
if (!over && !dealInProgress) {
  advanceQueue();
}

// Если раздача уже завершилась во время паузы,
// запускаем следующую, если турнир ещё продолжается.
else if (over && !TEST_MANUAL_NEXT_HAND) {
  const playersWithChips = players.filter(
    p => p.stack > 0
  ).length;

  if (playersWithChips >= 2) {
    newHand();
  }
}
}

function resetStacksAndRestart(){
  pendingPreAction = null;
  if (winnerChipAnimating) return;
  cancelAllInAdvanceTimer();
  resetAllInTableLight();
clearPlayerStatsViewTimers();
  // Полный сброс ожиданий предыдущей игры.
  lastBetFlight = Promise.resolve();
  autoPauseRequested = false;
autoPauseActive = false;
betFlightInProgress = false;
  stackDisplayOverrides = {};
  comboDisplayAnalysis = null;
comboDisplayLocked = false;
comboDisplayShowCore = false;
comboTransitionPhase = '';
  initialDealInProgress = false;
  dealInProgress = false;
  busy = false;

  gamePaused = false;clearTurnTimer();clearBlindSequence();clearActionTimers();tick++;clearDealSequence();busy=false;pendingAISeat=-1;
 winnerIds=[];winnerPayouts={};winnerCombo='';humanWinnerReveal=false;winningLiftActive=false;winningCards=[];humanFoldedCards=false;aiWinnerReveal=false;aiShowdownRevealBack=false;userHoleRevealBack=false;aiWinnerId=-1;aiWinningCards=[];
 tournamentClock.stop(false);applyTournamentMode(true);players.forEach(p=>{p.stack=getStartingStack(tournamentMode);p.bet=0;p.total=0;p.folded=false;p.allin=false;p.wentAllInThisHand = false;p.allinFlame = false;p.action='';p.actionAmount=0;p.labelAction='';p.labelAmount=0;p.actedStreet=-1;p.hole=[]});initializeTournamentStats(players);
 deck=[];board=[];pot=0;currentBet=0;street=0;actor=-1;handNo=0;over=true;actQueue=[];firstToAct=3;dealerSeat=0;log=[];renderedBoardCount=0;savedGameState=null;gameStarted=true;
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
function handlePageHidden() {
  pageIsHidden = true;
  autoPauseRequested = true;

  // Если сейчас безопасный момент — ставим паузу сразу.
  // Иначе дождёмся завершения текущего игрового этапа.
  tryAutoPause();
}


function handlePageVisible() {
  pageIsHidden = false;

  // Если автопауза ожидала завершения анимации,
  // пробуем установить её при возвращении.
  if (autoPauseRequested) {
    tryAutoPause();
  }

  // Не снимаем паузу автоматически.
  // Продолжение — только по кнопке пользователя.
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    handlePageHidden();
  } else {
    handlePageVisible();
  }
});

window.addEventListener('pagehide', handlePageHidden);
window.addEventListener('pageshow', event => {
  if (event.persisted || document.visibilityState === 'visible') {
    handlePageVisible();
  }
});                                                                                                                                                                                                          
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
