/**
 * Дуговой регулятор ставки Pokereza Poker.
 * Выбирает итоговый размер ставки на текущей улице (player.bet + новая сумма).
 */
export function createBetControl({ table, getState, format }) {
  if (!table) throw new Error('createBetControl: игровой стол не найден');
  if (typeof getState !== 'function') throw new TypeError('createBetControl: getState должен быть функцией');

  const fmt = typeof format === 'function'
    ? format
    : value => Math.round(value).toLocaleString('ru-RU');
const backdrop = document.createElement('div');
backdrop.className = 'bet-control-backdrop';
table.appendChild(backdrop);
  const root = document.createElement('div');
  root.id = 'betControl';
  root.className = 'bet-control';
  root.setAttribute('aria-label', 'Выбор размера ставки');
  root.innerHTML = `
    <div class="amount-line">
      <span class="amount" id="amount">20</span>
      <span class="unit">PP</span>
    </div>

    <div class="curve-stage">
      <svg class="curve-svg" id="curveSvg" viewBox="0 0 190 275"
        role="slider" tabindex="0" aria-label="Размер ставки">
        <defs>
          <linearGradient id="railGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#85888d" />
            <stop offset=".48" stop-color="#3d4149" />
            <stop offset="1" stop-color="#252a31" />
          </linearGradient>
          <radialGradient id="knobGradient" cx="35%" cy="28%">
            <stop offset="0" stop-color="#f4d16a" />
            <stop offset=".72" stop-color="#d7a92e" />
            <stop offset="1" stop-color="#9e701b" />
          </radialGradient>
        </defs>

        <path class="curve-track-shadow" d="M42 247 C38 172 68 91 143 28" />
        <path id="rail" class="curve-track" d="M42 247 C38 172 68 91 143 28" />
        <path class="curve-inner" d="M42 247 C38 172 68 91 143 28" />
        <path id="progress" class="curve-progress" d="M42 247 C38 172 68 91 143 28" />

        <circle id="knob" class="curve-knob" cx="42" cy="247" r="25" />
        <circle id="knobCore" class="curve-knob-core" cx="42" cy="247" r="16" />

        <g id="x2Button" class="x2-marker" role="button" tabindex="0"
          aria-label="Удвоить крупнейшую ставку соперника" visibility="hidden">
          <circle r="28" fill="rgba(5,35,62,.7)" stroke="#45a9ed" stroke-width="2" />
          <text text-anchor="middle" dominant-baseline="central"
            fill="#fff" font-size="12" font-weight="900">x2</text>
        </g>
      </svg>

      <button class="curve-max" id="maxButton" type="button">MAX</button>
      <div class="step-row">
        <button class="step-btn" id="plus" type="button">+10</button>
        <button class="step-btn minus" id="minus" type="button">−10</button>
      </div>
    </div>
  `;
  table.appendChild(root);

  const $ = id => root.querySelector(`#${id}`);
  const amount = $('amount');
  const svg = $('curveSvg');
  const rail = $('rail');
  const knob = $('knob');
  const knobCore = $('knobCore');
  const progress = $('progress');
  const x2Button = $('x2Button');
  const pathLength = rail.getTotalLength();
  const step = 10;

  let value = 20;
  let dragging = false;
  let skipButtonClick = false;

  function getBounds() {
    const state = getState() || {};
    const playerIndex = Number.isInteger(state.user) ? state.user : 0;
    const player = state.players?.[playerIndex];
    const playerBet = Math.max(0, Number(player?.bet) || 0);
    const stack = Math.max(0, Number(player?.stack) || 0);
    const max = playerBet + stack;
    const bigBlind = Math.max(1, Number(state.bb) || 1);
    const currentBet = Math.max(0, Number(state.currentBet) || 0);

  // Минимальная сумма — не меньше ББ и не меньше самой высокой ставки.
const requiredMin = Math.max(bigBlind, currentBet);

    // Короткий стек может быть меньше минимального рейза: тогда MAX
    // позволяет выставить весь доступный остаток (короткий ALL-IN).
    return {
      min: Math.min(requiredMin, max),
      max,
      players: state.players || [],
      user: playerIndex
    };
  }

  function clamp(valueToClamp, min, max) {
    return Math.max(min, Math.min(max, valueToClamp));
  }

  function snapValue(rawValue, min, max) {
    if (rawValue <= min) return min;
    if (rawValue >= max) return max;
    return clamp(min + Math.round((rawValue - min) / step) * step, min, max);
  }

  function pointFor(rawValue, min, max) {
    const t = max <= min ? 0 : clamp((rawValue - min) / (max - min), 0, 1);
    return rail.getPointAtLength(pathLength * t);
  }

  function drawX2(bounds) {
    const highestOpponentBet = bounds.players.reduce((highest, player, index) => {
      if (index === bounds.user) return highest;
      return Math.max(highest, Math.max(0, Number(player?.bet) || 0));
    }, 0);

    const doubled = highestOpponentBet * 2;
    if (!highestOpponentBet || doubled < bounds.min || bounds.max <= 0) {
      x2Button.setAttribute('visibility', 'hidden');
      return;
    }

    const target = clamp(doubled, bounds.min, bounds.max);
    const point = pointFor(target, bounds.min, bounds.max);
    x2Button.setAttribute('transform', `translate(${point.x} ${point.y})`);
    x2Button.setAttribute('visibility', 'visible');
    x2Button.setAttribute(
      'aria-label',
      `Удвоить крупнейшую ставку соперника ${fmt(highestOpponentBet)} PP — ${fmt(target)} PP`
    );
  }

  function draw() {
    const bounds = getBounds();
    value = snapValue(value, bounds.min, bounds.max);

    amount.textContent = fmt(value);

    const t = bounds.max <= bounds.min
      ? 0
      : clamp((value - bounds.min) / (bounds.max - bounds.min), 0, 1);
    const point = pointFor(value, bounds.min, bounds.max);
    const used = pathLength * t;

    knob.setAttribute('cx', point.x);
    knob.setAttribute('cy', point.y);
    knobCore.setAttribute('cx', point.x);
    knobCore.setAttribute('cy', point.y);
    progress.style.strokeDasharray = `${used} ${pathLength}`;
    progress.style.strokeDashoffset = '0';

    $('minus').disabled = value <= bounds.min;
    $('plus').disabled = value >= bounds.max;
    $('minus').style.opacity = $('minus').disabled ? '.35' : '1';
    $('plus').style.opacity = $('plus').disabled ? '.35' : '1';

    svg.setAttribute('aria-valuemin', bounds.min);
    svg.setAttribute('aria-valuemax', bounds.max);
    svg.setAttribute('aria-valuenow', value);
    svg.setAttribute('aria-valuetext', `${fmt(value)} PP`);

    drawX2(bounds);
  }

  function nudge(direction) {
    const bounds = getBounds();
    value = clamp(value + direction * step, bounds.min, bounds.max);
    draw();
  }

  function valueFromPointer(event) {
    const bounds = getBounds();
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const localPoint = point.matrixTransform(matrix.inverse());

    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i <= 100; i++) {
      const candidate = rail.getPointAtLength(pathLength * i / 100);
      const distance = (candidate.x - localPoint.x) ** 2 +
        (candidate.y - localPoint.y) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }

    value = bounds.min + (bounds.max - bounds.min) * (best / 100);
    draw();
  }

  // MAX и x2 сохраняют возможность перетаскивать бегунок, начиная с кнопки.
  function enableDragFromButton(element, action) {
    let startX = 0;
    let startY = 0;
    let moved = false;
    let activePointer = null;

    element.addEventListener('pointerdown', event => {
      if (event.button !== undefined && event.button !== 0) return;
      event.stopPropagation();
      activePointer = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      moved = false;
      if (typeof element.setPointerCapture === 'function') {
        element.setPointerCapture(event.pointerId);
      }
    });

    element.addEventListener('pointermove', event => {
      if (activePointer !== event.pointerId) return;
      event.stopPropagation();
      if (!moved && Math.hypot(event.clientX - startX, event.clientY - startY) > 5) {
        moved = true;
      }
      if (moved) {
        dragging = true;
        valueFromPointer(event);
      }
    });

    const finish = event => {
      if (activePointer !== event.pointerId) return;
      event.stopPropagation();
      if (moved) {
        skipButtonClick = true;
        dragging = false;
      }
      activePointer = null;
    };

    element.addEventListener('pointerup', finish);
    element.addEventListener('pointercancel', finish);
    element.addEventListener('click', event => {
      event.stopPropagation();
      if (skipButtonClick) {
        skipButtonClick = false;
        event.preventDefault();
        return;
      }
      action();
    });
  }

  svg.addEventListener('pointerdown', event => {
    if (event.target.closest?.('#x2Button')) return;
    dragging = true;
    if (typeof svg.setPointerCapture === 'function') {
      svg.setPointerCapture(event.pointerId);
    }
    valueFromPointer(event);
  });

  svg.addEventListener('pointermove', event => {
    if (dragging) valueFromPointer(event);
  });
  svg.addEventListener('pointerup', () => { dragging = false; });
  svg.addEventListener('pointercancel', () => { dragging = false; });

  svg.addEventListener('keydown', event => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault();
      nudge(1);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault();
      nudge(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      value = getBounds().min;
      draw();
    } else if (event.key === 'End') {
      event.preventDefault();
      value = getBounds().max;
      draw();
    }
  });

  $('minus').addEventListener('click', () => nudge(-1));
  $('plus').addEventListener('click', () => nudge(1));
  enableDragFromButton($('maxButton'), () => {
    value = getBounds().max;
    draw();
  });

  const chooseX2 = () => {
    const bounds = getBounds();
    const highestOpponentBet = bounds.players.reduce((highest, player, index) => {
      if (index === bounds.user) return highest;
      return Math.max(highest, Math.max(0, Number(player?.bet) || 0));
    }, 0);
    if (!highestOpponentBet) return;
    value = clamp(highestOpponentBet * 2, bounds.min, bounds.max);
    draw();
  };
  enableDragFromButton(x2Button, chooseX2);
  x2Button.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      chooseX2();
    }
  });

function open() {
  const bounds = getBounds();
  value = bounds.min;
  backdrop.classList.add('is-active');
  root.classList.add('is-open');
  draw();
  requestAnimationFrame(draw);
}
 function close() {
  root.classList.remove('is-open');
  backdrop.classList.remove('is-active');
  dragging = false;
}

  function reset() {
    close();
    value = getBounds().min;
    draw();
  }

  function refresh() {
    draw();
  }

  function getValue() {
    const bounds = getBounds();
    return clamp(value, bounds.min, bounds.max);
  }

  draw();

  return { open, close, reset, refresh, getValue };
}
