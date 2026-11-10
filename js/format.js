
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
export function compactFmt(n) {
  const value = Math.max(0, Math.round(Number(n) || 0));

  if (value < 1000) return String(value);

  const units = [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K']
  ];

  for (const [divisor, suffix] of units) {
    if (value >= divisor) {
      const integer = Math.floor(value / divisor);
      const fraction = String(value % divisor)
        .padStart(Math.log10(divisor), '0')
        .replace(/0+$/, '');

      return `${integer}${fraction ? '.' + fraction : ''}${suffix}`;
    }
  }

  return String(value);
}
