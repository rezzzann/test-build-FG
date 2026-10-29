
export const ranks = '23456789TJQKA';

function val(card) {
  return ranks.indexOf(card.r) + 2;
}

function score5(cards) {
  const values = cards.map(val).sort((a, b) => b - a);
  const counts = {};

  values.forEach(value => {
    counts[value] = (counts[value] || 0) + 1;
  });

  const groups = Object.entries(counts)
    .map(([value, count]) => ({ value: +value, count }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  const flush = cards.every(card => card.s === cards[0].s);
  const unique = [...new Set(values)].sort((a, b) => b - a);

  if (unique.includes(14)) unique.push(1);

  let straight = 0;

  for (let i = 0; i <= unique.length - 5; i++) {
    if (unique[i] - unique[i + 4] === 4) {
      straight = Math.max(straight, unique[i]);
    }
  }

  if (flush && straight) return [8, straight];

  if (groups[0].count === 4) {
    return [
      7,
      groups[0].value,
      ...groups.filter(group => group.count === 1).map(group => group.value)
    ];
  }

  if (groups[0].count === 3 && groups[1]?.count === 2) {
    return [6, groups[0].value, groups[1].value];
  }

  if (flush) return [5, ...values];
  if (straight) return [4, straight];

  if (groups[0].count === 3) {
    return [
      3,
      groups[0].value,
      ...groups.filter(group => group.count === 1)
        .map(group => group.value)
        .sort((a, b) => b - a)
    ];
  }

  const pairs = groups
    .filter(group => group.count === 2)
    .map(group => group.value)
    .sort((a, b) => b - a);

  if (pairs.length >= 2) {
    return [
      2,
      pairs[0],
      pairs[1],
      groups.find(group => group.count === 1)?.value || 0
    ];
  }

  if (pairs.length === 1) {
    return [
      1,
      pairs[0],
      ...groups.filter(group => group.count === 1)
        .map(group => group.value)
        .sort((a, b) => b - a)
    ];
  }

  return [0, ...values];
}

export function cmp(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;

    if (x !== y) return x - y;
  }

  return 0;
}

export function score(cards) {
  return bestFive(cards).score;
}

export function bestFive(cards) {
  let bestScore = null;
  let bestCards = [];

  function combine(start, selected) {
    if (selected.length === 5) {
      const currentScore = score5(selected);

      if (bestScore === null || cmp(currentScore, bestScore) > 0) {
        bestScore = currentScore;
        bestCards = selected.slice();
      }

      return;
    }

    for (let i = start; i < cards.length; i++) {
      combine(i + 1, [...selected, cards[i]]);
    }
  }

  combine(0, []);

  return {
    score: bestScore || [-1],
    cards: bestCards
  };
}


function partialScore(cards) {
  const values = cards.map(val);
  const counts = {};

  values.forEach(value => {
    counts[value] = (counts[value] || 0) + 1;
  });

  const groups = Object.entries(counts)
    .map(([value, count]) => ({
      value: Number(value),
      count
    }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  const pairs = groups
    .filter(group => group.count === 2)
    .map(group => group.value)
    .sort((a, b) => b - a);

  if (groups[0]?.count === 4) {
    return [7, groups[0].value];
  }

  if (groups[0]?.count === 3) {
    return [
      3,
      groups[0].value,
      ...groups
        .filter(group => group.count === 1)
        .map(group => group.value)
        .sort((a, b) => b - a)
    ];
  }

  if (pairs.length >= 2) {
    return [
      2,
      pairs[0],
      pairs[1],
      ...groups
        .filter(group => group.count === 1)
        .map(group => group.value)
    ];
  }

  if (pairs.length === 1) {
    return [
      1,
      pairs[0],
      ...groups
        .filter(group => group.count === 1)
        .map(group => group.value)
        .sort((a, b) => b - a)
    ];
  }

  return [0, ...values.sort((a, b) => b - a)];
}

function combinationCore(cards, handScore) {
  const category = handScore[0];

  // Стрит, флеш, фулл-хаус и стрит-флеш:
  // все пять карт составляют комбинацию.
  if ([4, 5, 6, 8].includes(category)) {
    return cards.slice();
  }

  let coreRanks = [];

  // Пара, тройка или каре.
  if ([1, 3, 7].includes(category)) {
    coreRanks = [handScore[1]];
  }

  // Две пары.
  if (category === 2) {
    coreRanks = handScore.slice(1, 3);
  }

  // Старшая карта: выделяем только старшую.
  if (category === 0) {
    const highest = Math.max(...cards.map(val));

    return cards
      .filter(card => val(card) === highest)
      .slice(0, 1);
  }

  return cards.filter(card => coreRanks.includes(val(card)));
}

export function analyzeHand(cards) {
  if (!Array.isArray(cards) || cards.length === 0) {
    return null;
  }

  const best = cards.length >= 5
    ? bestFive(cards)
    : {
        score: partialScore(cards),
        cards: cards.slice()
      };

  return {
    score: best.score,
    name: handNames[best.score[0]] || 'СТАРШАЯ КАРТА',
    cards: best.cards,
    coreCards: combinationCore(best.cards, best.score)
  };
}


export const handNames = [
  'СТАРШАЯ КАРТА',
  'ПАРА',
  'ДВЕ ПАРЫ',
  'ТРОЙКА',
  'СТРИТ',
  'ФЛЕШ',
  'ФУЛЛ-ХАУС',
  'КАРЕ',
  'СТРИТ-ФЛЕШ'
];

