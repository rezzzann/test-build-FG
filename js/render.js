
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
    if (['М. БЛАЙНД', 'Б. БЛАЙНД', 'СТАВКА', 'РЕЙЗ'].includes(action)) {
      return `<span class="bet-action-name">${action}</span>`;
    }
    return action === 'ДУМАЕТ' ? 'ДУМАЕТ…' : action;
  }

  function stateMarkup(p, i, actor, over) {
    if (p.folded) return 'ФОЛД';
    if (p.allin) return 'ALL-IN';
    if (i === actor && !over) return 'ХОД';
    if (p.action === 'М. БЛАЙНД') return 'М. БЛАЙНД';
    if (p.action === 'Б. БЛАЙНД') return 'Б. БЛАЙНД';
    if (p.action === 'СТАВКА' || p.action === 'РЕЙЗ') {
      return `${p.action} ${fmt(p.actionAmount || 0)} PP`;
    }
    if (p.action) return p.action;
    return 'В ИГРЕ';
  }

  function renderHandBets() {
    const { players } = getState();

    $('handBets').innerHTML = players.map((p, i) => {
      if (p.folded || p.bet <= 0) return '';

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
      humanWinnerReveal
    } = state;

    // После проигрыша на вскрытии особая обводка скрывается.
    if (over && !humanWinnerReveal) return false;

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
  aiWinnerAnalysis
} = state;

const showComboCore = shouldShowComboCore(state);
const el = $('community');
const count = board.length;

// Сохраняем сдвиг карт и состояние стола при победе ИИ.
el.classList.toggle('ai-winner-board', !!aiWinnerReveal);
$('table').classList.toggle('ai-winner-state', !!aiWinnerReveal);

    if (count === 0) {
      el.innerHTML = '';
      setRenderedBoardCount(0);
      return;
    }

    const renderedBoardCount = getRenderedBoardCount();

    if (count === renderedBoardCount) {
      [...el.children].forEach((node, i) => {
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

const isInWinningHand =
  humanWinnerReveal
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
    : showComboCore && !aiWinnerReveal &&
      !!currentHandAnalysis?.coreCards.includes(currentCard)
);

node.classList.toggle(
  'not-in-combo',
  (humanWinnerReveal || aiWinnerReveal) && !isInWinningHand
);

node.classList.remove('hand-card');
      });

      return;
    }

    
    el.innerHTML = board.map((c, i) => {
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

      return `<div class="card ${c.red ? 'red' : ''} ${isNew ? 'reveal-card' : ''} ${isAICore ? 'winning-card' : ''} ${isCoreCard && !aiWinnerReveal ? 'combo-core' : ''} ${isDimmed ? 'not-in-combo' : ''}"><span class="rank">${c.r === 'T' ? '10' : c.r}</span><span class="center">${c.s}</span></div>`;
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
      currentHandAnalysis,
      aiWinnerAnalysis
    } = s;

    const showComboCore = shouldShowComboCore(s);

    $('pot').textContent = fmt(pot);
    $('street').textContent = streetNames[Math.min(street, 4)];

    const handSummary = $('handSummary');

    if (handSummary) {
      handSummary.textContent = currentHandAnalysis
        ? currentHandAnalysis.name
        : '';

      handSummary.classList.toggle(
        'visible',
        !!currentHandAnalysis
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

    holeEl.innerHTML = players[0].hole.map(c => {
      let html = card(c);

      // Зелёная обводка — только основные карты текущей комбинации.
      if (
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

if (
  (humanWinnerReveal || aiWinnerReveal) &&
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
      const thinking = action === 'ДУМАЕТ';
      const labelClass = actionClass(action);
      const userClass = i === 0 ? 'user-seat' : '';
      const isWinner = winnerIds.includes(i);

      const winMarkup = isWinner
        ? `<div class="win-display visible"><div class="win-word">WIN</div><div class="win-prize">+${fmt(winnerPayouts[i] || 0)} PP</div><div class="win-combo">${winnerCombo}</div></div>`
        : '';

      return `<div class="seat ${cls} ${userClass} ${i === actor && !over ? 'active' : ''} ${p.folded ? 'folded' : ''}">${winMarkup}<div class="action-label ${thinking ? 'thinking' : ''} ${labelClass}">${actionMarkup(action)}</div><div class="avatar-wrap"><div class="avatar">${p.icon}</div></div><div><div class="name">${i === 0 ? 'Вы' : p.name}</div><div class="stack">${fmt(p.stack)} PP</div><div class="state">${stateMarkup(p, i, actor, over)}</div></div></div>`;
    }).join('');

    $('opponentCards').innerHTML = players.map((p, i) => {
      if (i === 0) return '';

      const pos = cardPos[i];
      if (!pos) return '';

      const revealed = over && !p.folded;
      const isAIWinner = aiWinnerReveal && i === aiWinnerId;

      return `<div class="opponent-cards ${pos} ${revealed ? 'revealed' : ''} ${isAIWinner ? 'ai-winner-cards' : ''}">${p.hole.map(c => {   const isInWinningHand =     isAIWinner && aiWinningCards.includes(c);    const isAICore =     isAIWinner &&     !!aiWinnerAnalysis?.coreCards.includes(c);    let html = miniCard(c, revealed, isAICore);    if (     (humanWinnerReveal || aiWinnerReveal) &&     !isInWinningHand   ) {     html = html.replace(       'class="mini-card',       'class="mini-card not-in-combo'     );   }    return html; }).join('')}</div>`;
    }).join('');

    renderHandBets();
    $('betValue').textContent = $('betRange').value;

    const canAct =
      !over &&
      !busy &&
      !gamePaused &&
      actor === 0 &&
      eligible(0) &&
      actQueue.includes(0) &&
      !hasActedThisStreet(0);

    $('fold').disabled = !canAct;
    $('checkCall').disabled = !canAct;
    $('raise').disabled = !canAct;
    $('allin').disabled = !canAct;

    $('checkCall').textContent =
      currentBet > players[0].bet
        ? 'КОЛЛ ' + fmt(currentBet - players[0].bet)
        : 'ЧЕК';

    const isRaise = currentBet > players[0].bet;
    $('raise').textContent = isRaise ? 'РЕЙЗ' : 'СТАВКА';
    $('raise').classList.toggle('bet-mode', !isRaise);

    $('nextHand').classList.toggle('visible', over);
    $('exitButton').classList.toggle('visible', gameStarted);
  }

  return { render, renderHandBets, renderCommunity };
}
