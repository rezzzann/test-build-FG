
export function getBetChipConfig(amount) {
  const value = Math.max(0, Number(amount) || 0);

  if (value < 50) return { count: 1, color: 'gold' };
  if (value < 100) return { count: 2, color: 'gold' };
  if (value < 200) return { count: 3, color: 'gold' };
  if (value < 400) return { count: 1, color: 'blue' };
  if (value < 700) return { count: 2, color: 'blue' };

  return { count: 3, color: 'blue' };
}

export function getBetChipCount(amount) {
  return getBetChipConfig(amount).count;
}

export function getBetChipClass(amount) {
  return getBetChipConfig(amount).color === 'blue'
    ? 'blue-chip'
    : 'gold-chip';
}

