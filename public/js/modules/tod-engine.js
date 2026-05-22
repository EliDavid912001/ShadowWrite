/** Fisher-Yates shuffle + draw-without-replacement deck */

export function fisherYatesShuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createDeck(source) {
  return fisherYatesShuffle(source);
}

export function drawFromDeck(deck) {
  if (!deck.length) return { card: null, deck };
  const card = deck.pop();
  return { card, deck };
}
