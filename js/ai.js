
 // Центральный модуль ИИ: уровни сложности и выбор действий.
 // Текущая стратегия сохранена без изменения поведения.

import { strength } from './ai-analysis.js';

// Пока реализован только лёгкий уровень.
// Настройки сложности пока не меняют алгоритм принятия решений.
export const AI_DIFFICULTIES = Object.freeze({
  easy: Object.freeze({
    id: 'easy',
    name: 'Лёгкий'
  })
});

export const DEFAULT_AI_DIFFICULTY = 'easy';

// Текущая стратегия лёгкого уровня.
// Интерфейс decide() сохранён для совместимости с main.js.
export function decide(p, call, board, currentBet, bb) {
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
