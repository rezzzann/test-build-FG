
 // Центральный модуль ИИ: реестр сложностей и выбор стратегии.
 // Игровой движок продолжает вызывать decide(p, call, board, currentBet, bb).

import { strength } from './ai-analysis.js';

// Описания подключённых уровней сложности.
export const AI_DIFFICULTIES = Object.freeze({
  easy: Object.freeze({
    id: 'easy',
    name: 'Лёгкий'
  })
});

export const DEFAULT_AI_DIFFICULTY = 'easy';

let activeDifficulty = DEFAULT_AI_DIFFICULTY;

// Выбор сложности без изменения игрового движка.
export function setAIDifficulty(difficulty) {
  if (!AI_STRATEGIES[difficulty]) {
    return false;
  }

  activeDifficulty = difficulty;
  return true;
}

export function getAIDifficulty() {
  return activeDifficulty;
}

// Лёгкий ИИ. Существующая логика сохранена.
function decideEasy(p, call, board, currentBet, bb) {
  const st = strength(p, board) + Math.random() * 0.35;
  const style = p.style;

  if (style === 'tight' && st < 1.3 && call > bb * 2) {
    return { t: 'fold' };
  }

  if (style === 'careful' && st < 1.6 && call > bb * 2) {
    return { t: 'fold' };
  }

  if (style === 'calling' && Math.random() < 0.72) {
    return { t: call ? 'call' : 'check' };
  }

  if (style === 'aggressive' && st > 0.8 && Math.random() < 0.55) {
    return {
      t: call ? 'raise' : 'bet',
      amt: Math.min(p.stack, Math.max(bb * 2, currentBet + bb * 2))
    };
  }

  if (st > 2.4 && Math.random() < 0.55) {
    return {
      t: call ? 'raise' : 'bet',
      amt: Math.min(p.stack, Math.max(bb * 2, currentBet + bb * 2))
    };
  }

  if (!call) return { t: 'check' };

  if (st > 0.8 && Math.random() < 0.6) {
    return { t: 'call' };
  }

  return { t: 'fold' };
}

// Реестр стратегий. Здесь подключаются новые уровни сложности.
const AI_STRATEGIES = Object.freeze({
  easy: decideEasy
});

// Совместимый интерфейс: main.js менять не нужно.
export function decide(p, call, board, currentBet, bb) {
  const strategy = AI_STRATEGIES[activeDifficulty]
    || AI_STRATEGIES[DEFAULT_AI_DIFFICULTY];

  return strategy(p, call, board, currentBet, bb);
}
