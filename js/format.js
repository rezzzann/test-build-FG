
export function card(c, back = false) {
  if (back) return '<div class="card back"></div>';

  return `<div class="card ${c.red ? 'red' : ''}"><span class="rank">${c.r === 'T' ? '10' : c.r}</span><span class="center">${c.s}</span></div>`;
}

export function miniCard(c, reveal = false, isWinning = false) {
  if (!reveal) return '<span class="mini-card"></span>';

  return `<span class="mini-card ${c.red ? 'red' : ''} ${isWinning ? 'winning-card' : ''}"><span class="mini-rank">${c.r === 'T' ? '10' : c.r}</span><span class="mini-suit">${c.s}</span></span>`;
}

export function fmt(n) {
  return Math.max(0, Math.round(n)).toLocaleString('ru-RU');
}

