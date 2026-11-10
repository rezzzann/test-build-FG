import { createFireVfx } from './fire-vfx.js';
export function createRenderer({
  $,
  getState,
  card,
  miniCard,
  fmt,
  getBetChipConfig,
  streetNames,
  seatClass,
  cardPos,
  eligible,
  hasActedThisStreet,
  getRenderedBoardCount,
  setRenderedBoardCount
}) {
  let winnerAnimationPlayed = false;
  let previousLabelActions = [];
  let labelAnimationUntil = [];
  let allinInfoAppearUntil = [];
  // Единый WebGL-эффект ALL-IN для всех игроков.
const fireVfx = createFireVfx({
  table: $('table'),
  seatsRoot: $('seats')
});
  function actionClass(action) {
    const classes = {
      'РЕЙЗ': 'raise-label',
      'ФОЛД': 'fold-label',
      'КОЛЛ': 'call-label',
      'ЧЕК': 'check-label',
      'СТАВКА': 'bet-label',
      'ALL-IN': 'allin-label',
      'М. БЛАЙНД': 'small-blind-label',
      'Б. БЛАЙНД': 'big-blind-label'
    };
    return classes[action] || '';
  }

function actionMarkup(action) {
  const actionLabels = {
    'ФОЛД': 'сбросил',
    'КОЛЛ': 'уровнял',
    'ЧЕК': 'пропустил',
    'СТАВКА': 'поставил',
    'РЕЙЗ': 'поднял'
  };

  if (['М. БЛАЙНД', 'Б. БЛАЙНД', 'СТАВКА', 'РЕЙЗ'].includes(action)) {
    return `<span class="bet-action-name">${actionLabels[action] || action}</span>`;
  }

  if (action === 'ДУМАЕТ') {
    return 'ДУМАЕТ<span class="thinking-dots"><i>.</i><i>.</i><i>.</i></span>';
  }

  return actionLabels[action] || action;
}

function stateMarkup(p, i, actor, over, street) {
  if (p.eliminated) return 'ВЫБЫЛ';
  if (p.folded) return 'ФОЛД';
  if (p.allin) return 'ALL-IN';

  // Блайнды
  if (p.action === 'М. БЛАЙНД') return 'М. БЛАЙНД';
  if (p.action === 'Б. БЛАЙНД') return 'Б. БЛАЙНД';

  // Ставки без суммы PP
  if (p.action === 'СТАВКА') return 'СТАВКА';
  if (p.action === 'РЕЙЗ') return 'РЕЙЗ';

  if (i === actor && !over && p.actedStreet !== street) return 'ХОД';

  // Остальные действия: КОЛЛ, ЧЕК и т. д.
  if (p.action) return p.action;

  return 'В ИГРЕ';
}

function renderHandBets() {
  const container = $('handBets');

  // Во время сбора ставок сохраняем текущие элементы
  // и не пересоздаём их до завершения анимации.
  if (container.classList.contains('is-collecting')) {
    return;
  }

  const { players } = getState();

  container.innerHTML = players.map((p, i) => {
    if (p.folded || p.bet <= 0 || p.blindBetPending) return '';

    const config = getBetChipConfig(p.bet);
    const cls = config.color === 'blue' ? 'blue-chip' : 'gold-chip';

    const chips = Array.from(
      { length: config.count },
      () => cls === 'blue-chip'
        ? '<span class="blue-chip"></span>'
        : '<span class="gold-chip"></span>'
    ).join('');

    return `<div class="hand-bet b${i} visible" data-player="${i}" aria-label="Ставка ${fmt(p.bet)} PP"><span class="bet-chips">${chips}</span><span class="bet-total">${fmt(p.bet)} PP</span></div>`;
  }).join('');
}
function shouldShowComboCore(state) {
  const {
    currentHandAnalysis,
    street,
    over,
    humanWinnerReveal,
    dealInProgress,
    initialDealInProgress,
    communityDealingIndices = []
  } = state;

  // После проигрыша на вскрытии подсветка пользователя отключена.
  if (over && !humanWinnerReveal) return false;

  // Не показываем подсветку до полного завершения раздачи карт.
  if (
    dealInProgress ||
    initialDealInProgress ||
    communityDealingIndices.length > 0
  ) {
    return false;
  }

  // Префлоп: выделяем только карманную пару.
  if (street === 0) {
    return currentHandAnalysis?.score?.[0] === 1;
  }

  // На остальных улицах показываем основные карты комбинации.
  return true;
}

function renderCommunity() {
  const state = getState();

  const {
    board,
    humanWinnerReveal,
    aiWinnerReveal,
    winningCards,
    aiWinningCards,
    currentHandAnalysis,
    aiWinnerAnalysis,
    communityDealingIndices = []
  } = state;

  const showComboCore = shouldShowComboCore(state);
  const el = $('community');
  const count = board.length;

  $('table').classList.toggle('ai-winner-state', !!aiWinnerReveal);

  const renderedBoardCount = getRenderedBoardCount();

  // Пять постоянных слотов не дают общим картам смещаться.
  if (
    count === renderedBoardCount &&
    el.children.length === 5
  ) {
    [...el.children].forEach((slot, i) => {
      if (i >= count) return;

      const node = slot.querySelector('.card');
      if (!node) return;

      const currentCard = board[i];

      const isHumanCore =
        !!humanWinnerReveal &&
        !!currentHandAnalysis?.coreCards.includes(currentCard);

      const isAIWinningCard =
        !!aiWinnerReveal &&
        aiWinningCards.includes(currentCard);

      const isAICore =
        !!aiWinnerReveal &&
        !!aiWinnerAnalysis?.coreCards.includes(currentCard);

      const isInWinningHand = humanWinnerReveal
        ? winningCards.includes(currentCard)
        : isAIWinningCard;

      node.classList.toggle(
        'winning-card',
        isAICore
      );

      node.classList.toggle(
        'combo-core',
        humanWinnerReveal
          ? isHumanCore
          : showComboCore &&
            !aiWinnerReveal &&
            !!currentHandAnalysis?.coreCards.includes(currentCard)
      );

      node.classList.toggle(
        'not-in-combo',
        (humanWinnerReveal || aiWinnerReveal) &&
          !isInWinningHand
      );
      node.classList.toggle(
  'winning-lift-target',
  isInWinningHand
);

      node.classList.toggle(
        'deal-pending',
        communityDealingIndices.includes(i)
      );

      node.classList.remove('hand-card');
    });

    return;
  }

  // Всегда создаём пять позиций, даже если открыты не все карты.
  el.innerHTML = Array.from({ length: 5 }, (_, i) => {
    const c = board[i];

    if (!c) {
      return `<div class="community-slot" data-index="${i}"></div>`;
    }

    const isNew = i >= renderedBoardCount;

    const isHumanCore =
      !!humanWinnerReveal &&
      !!currentHandAnalysis?.coreCards.includes(c);

    const isAICore =
      !!aiWinnerReveal &&
      !!aiWinnerAnalysis?.coreCards.includes(c);

    const isWinningCard = humanWinnerReveal
      ? winningCards.includes(c)
      : !!aiWinnerReveal && aiWinningCards.includes(c);

    const isCoreCard = humanWinnerReveal
      ? isHumanCore
      : aiWinnerReveal
        ? isAICore
        : showComboCore &&
          !!currentHandAnalysis?.coreCards.includes(c);

    const isDimmed =
      (humanWinnerReveal || aiWinnerReveal) &&
      !isWinningCard;

    const pending = communityDealingIndices.includes(i);

    const cardHTML = `
      <div class="card ${c.red ? 'red' : ''} ${isNew ? 'reveal-card' : ''} ${isAICore ? 'winning-card' : ''} ${isCoreCard && !aiWinnerReveal ? 'combo-core' : ''} ${isWinningCard ? 'winning-lift-target' : ''} ${isDimmed ? 'not-in-combo' : ''} ${pending ? 'deal-pending' : ''}">
        <span class="rank">${c.r === 'T' ? '10' : c.r}</span>
        <span class="center">${c.s}</span>
      </div>
    `;

    return `
      <div class="community-slot" data-index="${i}">
        ${cardHTML}
      </div>
    `;
  }).join('');

  setRenderedBoardCount(count);
}

  function render() {
    const s = getState();

    if (!s.players.length) return;

    const {
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
      testManualNextHand,
      dealInProgress,
      collectingBets,
      betControlOpen,
      initialDealInProgress,
      currentHandAnalysis,
      aiWinnerAnalysis,
      userHoleRevealBack,
aiShowdownRevealBack,
    } = s;
if (!over || !winnerIds.length) {
  winnerAnimationPlayed = false;
}

const animateWinnerEntrance =
  over && winnerIds.length > 0 && !winnerAnimationPlayed;

if (animateWinnerEntrance) {
  winnerAnimationPlayed = true;
}
    const showComboCore = shouldShowComboCore(s);
    const showUserCombo =
  (!dealInProgress || collectingBets) && !userHoleRevealBack;
    $('pot').textContent = fmt(pot);
    $('street').textContent = streetNames[Math.min(street, 4)];

    const handSummary = $('handSummary');

   if (handSummary) {
  handSummary.textContent =
    showUserCombo && currentHandAnalysis
      ? currentHandAnalysis.name
      : '';

  handSummary.classList.toggle(
    'visible',
    showUserCombo && !!currentHandAnalysis
  );
}

    $('handStatus').textContent = tournamentMode === 'highroller'
      ? `HIGH ROLLER · УР. ${blindLevel + 1} · ${Math.ceil(Math.max(0, blindRemaining) / 1000)}с`
      : '';

    $('blindsDisplay').textContent = `БЛАЙНДЫ ${fmt(sb)} / ${fmt(bb)}`;

    renderCommunity();

    const holeEl = $('hole');
    holeEl.classList.toggle('winner-hole', humanWinnerReveal);
    holeEl.classList.toggle('ai-loser-hole', aiWinnerReveal);
    holeEl.classList.toggle('folded-hole', humanFoldedCards);

    holeEl.innerHTML = players[0].hole   .slice(     0,     Number.isInteger(players[0].dealtCount)       ? players[0].dealtCount       : players[0].hole.length   )   .map(c => {
        let html = (initialDealInProgress || userHoleRevealBack)
  ? '<div class="card back"></div>'
  : card(c);

      // Зелёная обводка — только основные карты текущей комбинации.
     if (
  showUserCombo &&
  showComboCore &&
  currentHandAnalysis?.coreCards.includes(c)
) {
        html = html.replace(
          'class="card',
          'class="card combo-core'
        );
      }

  const isInWinningHand =
  humanWinnerReveal && winningCards.includes(c);
      if (isInWinningHand) {
  html = html.replace(
    'class="card',
    'class="card winning-lift-target'
  );
}

if (
  (humanWinnerReveal || aiWinnerReveal) &&
  !(humanWinnerReveal && winnerCombo === 'БЕЗ ВСКРЫТИЯ') &&
  !isInWinningHand
) {
  html = html.replace(
    'class="card',
    'class="card not-in-combo'
  );
}
      return html;
    }).join('');

    $('seats').innerHTML = players.map((p, i) => {
      const cls = seatClass[i];
      const action = p.labelAction || '';
      const wasAllIn = previousLabelActions[i] === 'ALL-IN';

if (wasAllIn && action !== 'ALL-IN') {
  allinInfoAppearUntil[i] = Date.now() + 500;
}

const animateInfoReturn =
  Date.now() < (allinInfoAppearUntil[i] || 0);

if (previousLabelActions[i] !== action) {
  previousLabelActions[i] = action;
  labelAnimationUntil[i] = action && action !== 'ДУМАЕТ'
    ? Date.now() + (action === 'ALL-IN' ? 3500 : 350)
    : 0;
}

const animateAction =
  !!action &&
  action !== 'ДУМАЕТ' &&
  Date.now() < (labelAnimationUntil[i] || 0);
const allinElapsed = action === 'ALL-IN'
  ? Math.max(0, 3.5 - Math.max(0, labelAnimationUntil[i] - Date.now()) / 1000)
  : 0;

const thinking = action === 'ДУМАЕТ';

const thinkingElapsed = thinking &&
  Number.isFinite(p.thinkingStartedAt)
    ? Math.max(0, (performance.now() - p.thinkingStartedAt) / 1000)
    : 0;

const animationStyles = [];

if (action === 'ALL-IN' && animateAction) {
  animationStyles.push(`--allin-elapsed:${allinElapsed}s`);
}

if (thinking) {
  animationStyles.push(
    `--thinking-animation-delay:-${thinkingElapsed.toFixed(3)}s`
  );
}

const animationStyle = animationStyles.length
  ? `style="${animationStyles.join(';')}"`
  : '';

const labelClass = actionClass(action);
      const userClass = i === 0 ? 'user-seat' : '';
      const isWinner = winnerIds.includes(i);

     const winMarkup = isWinner
  ? `<div class="win-display visible ${animateWinnerEntrance ? 'win-entrance' : ''}"><div class="win-word">WIN</div><div class="win-prize">+${fmt(winnerPayouts[i] || 0)} PP</div><div class="win-combo">${winnerCombo}</div></div>`
  : '';

const showAISeatCards =
  i !== 0 &&
  over &&
  !p.folded &&
  (humanWinnerReveal || aiWinnerReveal);

const isAIWinner = aiWinnerReveal && i === aiWinnerId;

const winnerCardsMarkup = showAISeatCards
  ? `<div class="ai-seat-cards">${p.hole.map(c => {
    if (aiShowdownRevealBack) {
  return '<span class="mini-card ai-reveal-back"></span>';
}
      const isInWinningHand =
        isAIWinner && aiWinningCards.includes(c);

      const isAICore =
        isAIWinner &&
        !!aiWinnerAnalysis?.coreCards.includes(c);

      let html = miniCard(c, true, isAICore);
if (isInWinningHand) {
  html = html.replace(
    'class="mini-card',
    'class="mini-card winning-lift-target'
  );
}
      if (isAIWinner && !isInWinningHand) {
  html = html.replace(
    'class="mini-card',
    'class="mini-card not-in-combo'
  );
}
      return html;
    }).join('')}</div>`
  : '';
const seatInfoMarkup = i === 0 && p.eliminated && p.showTournamentStats
  ? `
    <div class="seat-info stats-visible">
      <div class="seat-stat-line">ПОБЕД: ${p.tournamentStats.wins}</div>
      <div class="seat-stat-line">ПОРАЖЕНИЙ: ${p.tournamentStats.losses}</div>
      <div class="seat-stat-line">МАКС. СТЕК: ${fmt(p.tournamentStats.maxStack)} PP</div>
    </div>
  `
  : `
    <div class="seat-info ${p.statsReturning ? 'info-return' : ''}">
      <div class="name">${i === 0 ? 'Вы' : p.name}</div>
      <div class="stack">${p.eliminated ? 'ПОСМОТРЕТЬ' : `${fmt(p.stack)} PP`}</div>
      <div class="state">${stateMarkup(p, i, actor, over, street)}</div>
    </div>
  `;
      return `<div data-player-index="${i}" class="seat ${p.eliminated ? 'eliminated' : ''} ${animateInfoReturn ? 'allin-info-appear' : ''} ${cls} ${p.allinFlame ? 'allin-flame-active' : ''} ${userClass} ${i === actor && !over ? 'active' : ''} ${p.folded ? 'folded' : ''}">${winMarkup}${winnerCardsMarkup}<div class="action-label ${thinking ? 'thinking' : ''} ${labelClass} ${animateAction ? 'action-label-animate' : ''}" ${animationStyle}>${actionMarkup(action)}</div><div class="avatar-wrap"><div class="avatar">${p.icon}</div></div>${seatInfoMarkup}</div>`;
    }).join('');

    $('opponentCards').innerHTML = players.map((p, i) => {
      if (i === 0) return '';
      if (p.folded) return '';

      const pos = cardPos[i];
      if (!pos) return '';

      const revealed = over && !p.folded && (humanWinnerReveal || aiWinnerReveal);
      const isAIWinner = aiWinnerReveal && i === aiWinnerId;
     if (revealed) return '';

      return `<div class="opponent-cards ${pos} ${revealed ? 'revealed' : ''} ${isAIWinner ? 'ai-winner-cards' : ''}">${p.hole
  .slice(
    0,
    Number.isInteger(p.dealtCount)
      ? p.dealtCount
      : p.hole.length
  )
  .map(c => {   const isInWinningHand =     isAIWinner && aiWinningCards.includes(c);    const isAICore =     isAIWinner &&     !!aiWinnerAnalysis?.coreCards.includes(c);    let html = miniCard(c, revealed, isAICore);    if (     (humanWinnerReveal || aiWinnerReveal) &&     !isInWinningHand   ) {     html = html.replace(       'class="mini-card',       'class="mini-card not-in-combo'     );   }    return html; }).join('')}</div>`;
    }).join('');

    renderHandBets();
   


const canAct =
  !over &&
  !busy &&
  !gamePaused &&
  actor === 0 &&
  eligible(0) &&
  actQueue.includes(0) &&
  !hasActedThisStreet(0);

const showPreActionMode =
  gameStarted &&
  !over &&
  !gamePaused &&
  actor !== 0;

const canPreAct =
  showPreActionMode &&
  !dealInProgress &&
  !initialDealInProgress &&
  !betControlOpen &&
  actor >= 0 &&
  actQueue.includes(0) &&
  eligible(0) &&
  !hasActedThisStreet(0);
const pending = s.pendingPreAction;
  const hideUserActions =
  over ||
  players[0].folded ||
  players[0].eliminated ||
  initialDealInProgress ||
  (players[0].dealtCount || 0) < 2;


const setActionButton = (id, label, actionType, selectedClass) => {
  const button = $(id);
  button.style.display = hideUserActions ? 'none' : '';
  const selected = pending?.type === actionType;

  button.disabled = !(canAct || canPreAct);

  button.classList.toggle('pre-action-mode', showPreActionMode);
  button.classList.toggle('pre-action-selected', showPreActionMode && selected);
  button.classList.toggle(selectedClass, showPreActionMode && selected);

  button.innerHTML = `
    ${showPreActionMode
      ? `<span class="pre-action-dot ${selected ? 'selected' : ''}"></span>`
      : ''}
    <span class="action-button-label">${label}</span>
  `;
};


setActionButton('fold', betControlOpen ? 'ОТМЕНА' : 'FOLD', 'fold', 'pre-action-fold');

const callAvailable = currentBet > players[0].bet;

setActionButton(
  'checkCall',
  callAvailable
    ? `CALL <span class="call-amount">${fmt(currentBet - players[0].bet)}</span>`
    : 'CHECK',
  callAvailable ? 'call' : 'check',
  'pre-action-call'
);

const raiseButton = $('raise');
    raiseButton.style.display = hideUserActions ? 'none' : '';

raiseButton.disabled = !(canAct || canPreAct);

raiseButton.classList.toggle('pre-action-mode', showPreActionMode);
raiseButton.classList.toggle(
  'pre-action-selected',
  showPreActionMode && pending?.type === 'allCall'
);
raiseButton.classList.toggle(
  'pre-action-allcall',
  showPreActionMode && pending?.type === 'allCall'
);

raiseButton.innerHTML = `
  ${showPreActionMode
    ? `<span class="pre-action-dot ${pending?.type === 'allCall' ? 'selected' : ''}"></span>`
    : ''}
  <span class="action-button-label">
    ${showPreActionMode
      ? 'RAISE<br>ALL'
      : betControlOpen
        ? callAvailable ? 'RAISE' : 'BET'
        : callAvailable ? 'RAISE' : 'BET'}
  </span>
`;

raiseButton.classList.toggle('bet-mode', !callAvailable);
raiseButton.classList.toggle('bet-confirming', betControlOpen);


    $('nextHand').classList.toggle(   'visible',   over && testManualNextHand );
    $('exitButton').classList.toggle('visible', gameStarted);
    $('exitButton').disabled = dealInProgress || initialDealInProgress;
    // Обновляем положение огня после отрисовки карточек игроков.
fireVfx.update();
    // Восстанавливаем подъём победных карт после повторной отрисовки.
if (s.winningLiftActive) {
  document
    .querySelectorAll('.winning-lift-target')
    .forEach(card => {
      card.classList.add('winning-lift');
    });
}
  }

  return {
  render,
  renderHandBets,
  renderCommunity,

  igniteFire(playerIndex) {
    fireVfx.ignite(playerIndex);
  },

  startFireWarmup(playerIndex, options) {
    fireVfx.startWarmup(playerIndex, options);
  },

  flareFire(playerIndex) {
    fireVfx.flare(playerIndex);
  },

  extinguishFire(playerIndexes, callback) {
    if (Array.isArray(playerIndexes)) {
      fireVfx.extinguishPlayers(
        playerIndexes,
        callback
      );
    } else {
      fireVfx.extinguish(playerIndexes);
    }
  }
};
}
