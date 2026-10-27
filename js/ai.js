
import { ranks } from './poker.js';

export function strength(p, board) {
  const all = [...p.hole, ...board];
  const values = all.map(card => ranks.indexOf(card.r) + 2);
  const counts = {};

  values.forEach(value => {
    counts[value] = (counts[value] || 0) + 1;
  });

  const groups = Object.values(counts).sort((a, b) => b - a);
  const suitCount = {};

  all.forEach(card => {
    suitCount[card.s] = (suitCount[card.s] || 0) + 1;
  });

  const flush = Object.values(suitCount).some(count => count >= 5);
  const unique = [...new Set(values)].sort((a, b) => b - a);

  if (unique.includes(14)) unique.push(1);

  let straight = false;

  for (let i = 0; i <= unique.length - 5; i++) {
    if (unique[i] - unique[i + 4] === 4) {
      straight = true;
    }
  }

  if (flush && straight) return 8;
  if (groups[0] === 4) return 7;
  if (groups[0] === 3 && groups[1] >= 2) return 6;
  if (flush) return 5;
  if (straight) return 4;
  if (groups[0] === 3) return 3;
  if (groups[0] === 2 && groups[1] === 2) return 2;
  if (groups[0] === 2) return 1;

  const a = ranks.indexOf(p.hole[0].r);
  const b = ranks.indexOf(p.hole[1].r);

  return (
    (Math.max(a, b) >= 10 ? 0.7 : 0) +
    (Math.abs(a - b) <= 1 ? 0.3 : 0) +
    (p.hole[0].s === p.hole[1].s ? 0.25 : 0) +
    (a === b ? 0.7 : 0)
  );
}

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

