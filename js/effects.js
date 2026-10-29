
/*
 * Pokereza Poker — Effects Module
 *
 * Централизованное управление визуальными эффектами.
 *
 * Здесь настраиваются:
 * - появление общих карт и карт победителя;
 * - анимация надписей действий и ожидания хода ИИ;
 * - эффект ALL-IN;
 * - появление победной надписи и её свечение;
 * - анимация полёта фишек;
 * - переходы кнопок, меню и информационных окон;
 * - поведение анимаций при системной настройке reduced motion.
 *
 * Постоянные цвета, размеры, шрифты и расположение элементов
 * остаются в css/style.css.
 */

const EFFECTS_STYLE_ID = 'pokereza-effects-styles';

const EFFECTS_CSS = String.raw`

/* =========================================
   КАРТЫ
   ========================================= */


.community {
  transition: top .9s cubic-bezier(.22,.75,.25,1);
}

.community.ai-winner-board {
  animation: aiWinnerBoardDrop .9s cubic-bezier(.22,.75,.25,1) both;
}

@keyframes aiWinnerBoardDrop {
  from {
    top: 50%;
  }
  to {
    top: 60%;
  }
}


.community .card.reveal-card {
  animation: cardReveal .55s cubic-bezier(.22,.75,.25,1) both;
  backface-visibility: hidden;
}

@keyframes cardReveal {
  0% {
    opacity: 0;
    transform: translate3d(0,-9px,0) scale(.975);
  }
  100% {
    opacity: 1;
    transform: translate3d(0,0,0) scale(1);
  }
}

.hole {
  transition: top .35s ease, gap .35s ease;
}

.hole .card {
  transition: width .35s ease, height .35s ease, box-shadow .25s, border-color .25s;
}

.opponent-cards.ai-winner-cards,
.opponent-cards.ai-winner-cards.revealed {
  animation: aiWinnerCardsIn .65s cubic-bezier(.22,.75,.25,1) .5s both;
  transition: none !important;
}

.hole.folded-hole {
  transition: none !important;
}

@keyframes aiWinnerCardsIn {
  from {
    opacity: 0;
    transform: translate(-50%,8px) scale(.94);
  }
  to {
    opacity: 1;
    transform: translate(-50%,0) scale(1);
  }
}


/* =========================================
   ПОБЕДА
   ========================================= */

.win-display {
  animation: winEntrance .8s cubic-bezier(.16,1,.3,1) both;
}

.win-word {
  animation: winGlow 1.2s ease-in-out infinite alternate;
}

@keyframes winEntrance {
  0% {
    opacity: 0;
    transform: translate(-50%,12px) scale(.45);
  }
  65% {
    opacity: 1;
    transform: translate(-50%,-4px) scale(1.12);
  }
  100% {
    opacity: 1;
    transform: translate(-50%,0) scale(1);
  }
}

@keyframes winGlow {
  from {
    filter: brightness(1);
    text-shadow:
      0 0 3px #fff4bc,
      0 0 8px #ffd04a,
      0 0 15px #e99b19,
      0 3px 4px #000;
  }
  to {
    filter: brightness(1.25);
    text-shadow:
      0 0 5px #fff8d6,
      0 0 13px #ffd04a,
      0 0 24px #e99b19,
      0 3px 4px #000;
  }
}


/* =========================================
   НАДПИСИ ДЕЙСТВИЙ ИГРОКОВ
   ========================================= */

/* Анимация надписи «ДУМАЕТ» */

.action-label.thinking {
  animation: thinkingPulse 1.05s ease-in-out infinite;
}

.action-label.thinking:after {
  animation: thinkingDots 1.2s steps(4,end) infinite;
}

@keyframes thinkingDots {
  0% {
    content: "";
  }
  25% {
    content: ".";
  }
  50% {
    content: "..";
  }
  75%,
  100% {
    content: "...";
  }
}

@keyframes thinkingPulse {
  0%,
  100% {
    opacity: .72;
    text-shadow: 0 2px 4px #000, 0 0 5px #fff2;
  }
  50% {
    opacity: 1;
    text-shadow: 0 2px 4px #000, 0 0 10px #ffffff88;
  }
}

/* Эффект надписи ALL-IN */

.action-label.allin-label {
  animation: allinFlame .55s ease-in-out infinite alternate;
}

@keyframes allinFlame {
  from {
    transform: translateX(-50%) scale(1);
    filter:
      drop-shadow(0 0 3px #ffd34f)
      drop-shadow(0 0 6px #ff6500)
      drop-shadow(0 0 10px #f20e21);
  }
  to {
    transform: translateX(-50%) scale(1.055);
    filter:
      drop-shadow(0 0 4px #fff1a8)
      drop-shadow(0 0 10px #ff6500)
      drop-shadow(0 0 15px #f20e21);
  }
}


/* =========================================
   КНОПКИ ИГРОВОГО ИНТЕРФЕЙСА
   ========================================= */

.act {
  transition: filter .15s, box-shadow .15s, transform .15s;
}

.next-hand.visible {
  animation: nextButtonIn .4s ease-out both;
}

@keyframes nextButtonIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}


/* =========================================
   ПОЛЁТ ФИШЕК
   ========================================= */

@keyframes chipFlight {
  0% {
    transform: translate(-50%,-50%) translate(0,0) scale(.72);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  75% {
    opacity: 1;
  }
  100% {
    transform:
      translate(-50%,-50%)
      translate(var(--dx),var(--dy))
      scale(.55);
    opacity: 0;
  }
}

.flying-chip.fly {
  animation: chipFlight .8s cubic-bezier(.22,.75,.25,1) forwards;
}


/* =========================================
   ГЛАВНОЕ МЕНЮ И ПРИВЕТСТВИЕ
   ========================================= */

.start-screen {
  transition: opacity .45s ease, visibility .45s ease;
}

.start-panel {
  animation: panelEnter .55s cubic-bezier(.22,.75,.25,1) both;
}

.welcome-panel {
  animation: panelEnter .45s ease both;
}

.menu-button {
  transition:
    transform .25s ease,
    filter .25s ease,
    box-shadow .25s ease,
    background .3s ease;
}


/* =========================================
   ИНФОРМАЦИОННЫЕ ОКНА
   ========================================= */

.info-overlay {
  transition: opacity .38s ease, visibility .38s ease;
}

.info-panel {
  transition:
    opacity .38s cubic-bezier(.22,.75,.25,1),
    transform .38s cubic-bezier(.22,.75,.25,1);
}

.info-close {
  transition: filter .25s, transform .25s;
}


/* =========================================
   СПИСОК ОБНОВЛЕНИЙ
   ========================================= */

.update-item {
  animation: updateEnter .42s ease forwards;
}

.update-item:nth-child(1) {
  animation-delay: .08s;
}

.update-item:nth-child(2) {
  animation-delay: .14s;
}

.update-item:nth-child(3) {
  animation-delay: .2s;
}

.update-item:nth-child(4) {
  animation-delay: .26s;
}

.update-item:nth-child(5) {
  animation-delay: .32s;
}

@keyframes panelEnter {
  from {
    opacity: 0;
    transform: translateY(12px) scale(.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes updateEnter {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}


/* =========================================
   ФОРМА СООБЩЕНИЯ ОБ ОШИБКЕ
   ========================================= */

.report-option {
  transition:
    border-color .2s,
    background .2s,
    box-shadow .2s;
}


/* =========================================
   НАПОМИНАНИЕ ОБ ОБРАТНОЙ СВЯЗИ
   ========================================= */

.feedback-reminder {
  transition: opacity .3s ease, visibility .3s ease;
}

.feedback-panel {
  transition: transform .3s ease;
}


/* =========================================
   УМЕНЬШЕННОЕ ДВИЖЕНИЕ
   ========================================= */

@media (prefers-reduced-motion: reduce) {
  .flying-chip.fly {
    animation-duration: .15s;
  }

  .community .card.reveal-card,
  .win-display,
  .win-word,
  .next-hand.visible {
    animation: none;
  }

  .community,
  .hole,
  .hole .card,
  .opponent-cards.ai-winner-cards,
  .opponent-cards.ai-winner-cards .mini-card {
    transition: none !important;
  }

  .start-panel,
  .info-panel,
  .update-item {
    animation: none !important;
    transition: none !important;
    opacity: 1;
    transform: none;
  }

  .feedback-panel,
  .feedback-reminder {
    transition: none !important;
  }
}

`;


/**
 * Создаёт менеджер визуальных эффектов.
 *
 * @param {Object} options
 * @param {Function} options.getBetChipConfig
 * @param {string[]} options.seatClass
 * @param {Function} options.getPaused
 *
 * @returns {{
 *   animateBetChip: Function,
 *   clearFlyingChips: Function
 * }}
 */
export function createEffects({
  getBetChipConfig,
  seatClass,
  getPaused = () => false
}) {
  if (typeof getBetChipConfig !== 'function') {
    throw new TypeError('createEffects: getBetChipConfig должен быть функцией');
  }

  if (!Array.isArray(seatClass)) {
    throw new TypeError('createEffects: seatClass должен быть массивом');
  }

  installEffectsStyles();

  /**
   * Подключает CSS с анимациями один раз.
   */
  function installEffectsStyles() {
    if (document.getElementById(EFFECTS_STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = EFFECTS_STYLE_ID;
    style.textContent = EFFECTS_CSS;
    document.head.appendChild(style);
  }

  /**
   * Удаляет все летящие фишки.
   */
  function clearFlyingChips() {
    document.querySelectorAll('.flying-chip').forEach(chip => {
      chip.remove();
    });
  }

  /**
   * Анимирует перемещение фишек от игрока к его ставке.
   *
   * Геометрия и количество фишек определяются текущим интерфейсом
   * и конфигурацией фишек. Тайминги и сама CSS-анимация находятся выше.
   *
   * @param {number} playerIndex Индекс игрока.
   * @param {number} amount Размер поставленной суммы.
   */
  function animateBetChip(playerIndex, amount = 0) {
    if (getPaused()) return;
    if (!Number.isInteger(playerIndex)) return;
    if (playerIndex < 0 || playerIndex >= seatClass.length) return;
    if (!Number.isFinite(amount) || amount <= 0) return;

    const seat = document.querySelector(
      `.seat.${seatClass[playerIndex]}`
    );

    const avatar = seat?.querySelector('.avatar');
    const betDisplay = document.querySelector(
      `.hand-bet.b${playerIndex}`
    );

    if (!avatar || !betDisplay) return;

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    const from = avatar.getBoundingClientRect();
    const to = betDisplay.getBoundingClientRect();

    const startX = from.left + from.width / 2;
    const startY = from.top + from.height / 2;
    const endX = to.left + to.width / 2;
    const endY = to.top + to.height / 2;

    const config = getBetChipConfig(amount);

    if (!config || !Number.isFinite(config.count) || config.count <= 0) {
      return;
    }

    const count = config.count;
    const flyingClass = config.color === 'blue'
      ? 'blue-flying'
      : 'gold-flying';

    for (let n = 0; n < count; n++) {
      const chip = document.createElement('div');

      chip.className = `flying-chip ${flyingClass}`;

      if (config.color === 'gold') {
        chip.textContent = '♠';
      }

      const offsetX = (n - (count - 1) / 2) * 8;
      const offsetY = (n % 2 === 0 ? -1 : 1)
        * Math.ceil(n / 2)
        * 5;

      const startX2 = startX + offsetX;
      const startY2 = startY + offsetY;

      chip.style.left = `${startX2}px`;
      chip.style.top = `${startY2}px`;

      chip.style.setProperty(
        '--dx',
        `${endX - startX2 + (n - (count - 1) / 2) * 5}px`
      );

      chip.style.setProperty(
        '--dy',
        `${endY - startY2}px`
      );

      chip.style.animationDelay = reduceMotion
        ? '0ms'
        : `${n * 75}ms`;

      document.body.appendChild(chip);

      requestAnimationFrame(() => {
        if (chip.isConnected) {
          chip.classList.add('fly');
        }
      });

      chip.addEventListener('animationend', () => {
        chip.remove();
      }, { once: true });

      // Страховочное удаление на случай, если animationend не сработает.
      setTimeout(() => {
        if (chip.isConnected) {
          chip.remove();
        }
      }, 1300 + (reduceMotion ? 0 : n * 75));
    }
  }

  return {
    animateBetChip,
    clearFlyingChips
  };
}
