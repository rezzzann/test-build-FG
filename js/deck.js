
export function createShuffledDeck(ranks, suits) {
  const deck = [];

  for (const rank of ranks) {
    for (const [suit, red] of suits) {
      deck.push({
        r: rank,
        s: suit,
        red
      });
    }
  }

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}
