export const STANDARD_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const SUITS = ['S', 'H', 'C', 'D'];

export const RANK_VALUE = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
  SJ: 16,
  BJ: 17
};

const SUIT_VALUE = {
  D: 1,
  C: 2,
  H: 3,
  S: 4,
  JOKER: 5
};

export function isJoker(card) {
  return card.rank === 'SJ' || card.rank === 'BJ';
}

export function isWildcardCard(card, trumpRank) {
  return card.suit === 'H' && card.rank === trumpRank;
}

export function createFullDeck() {
  const cards = [];
  let id = 1;

  for (let deck = 1; deck <= 2; deck += 1) {
    for (const suit of SUITS) {
      for (const rank of STANDARD_RANKS) {
        cards.push({
          id: `c-${id}`,
          deck,
          suit,
          rank
        });
        id += 1;
      }
    }

    cards.push({ id: `c-${id}`, deck, suit: 'JOKER', rank: 'SJ' });
    id += 1;
    cards.push({ id: `c-${id}`, deck, suit: 'JOKER', rank: 'BJ' });
    id += 1;
  }

  return cards;
}

export function shuffleCards(cards) {
  const next = [...cards];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function randomTrumpRank() {
  const index = Math.floor(Math.random() * STANDARD_RANKS.length);
  return STANDARD_RANKS[index];
}

export function decorateCard(card, trumpRank) {
  return {
    ...card,
    isJoker: isJoker(card),
    isTrumpRank: card.rank === trumpRank,
    isWildcard: isWildcardCard(card, trumpRank)
  };
}

export function cardSortValue(card, trumpRank) {
  const rankValue = RANK_VALUE[card.rank] || 0;
  const trumpBoost = card.rank === trumpRank && !isJoker(card) ? 0.4 : 0;
  const suitValue = SUIT_VALUE[card.suit] || 0;
  const jokerBoost = isJoker(card) ? 100 : 0;
  return jokerBoost + rankValue * 10 + suitValue + trumpBoost;
}

export function sortCards(cards, trumpRank) {
  return [...cards].sort((a, b) => {
    const delta = cardSortValue(a, trumpRank) - cardSortValue(b, trumpRank);
    if (delta !== 0) {
      return delta;
    }
    return a.id.localeCompare(b.id);
  });
}

export function createDeal() {
  const trumpRank = randomTrumpRank();
  const shuffled = shuffleCards(createFullDeck());
  const dealt = shuffled.slice(0, 27).map((card) => decorateCard(card, trumpRank));
  return {
    trumpRank,
    dealtCards: sortCards(dealt, trumpRank)
  };
}

export function suitLabel(suit) {
  if (suit === 'S') return '♠';
  if (suit === 'H') return '♥';
  if (suit === 'C') return '♣';
  if (suit === 'D') return '♦';
  return '';
}

export function cardLabel(card) {
  if (card.rank === 'SJ') return '小王';
  if (card.rank === 'BJ') return '大王';
  return `${suitLabel(card.suit)}${card.rank}`;
}

export function isStandardRank(rank) {
  return STANDARD_RANKS.includes(rank);
}

export function rankValue(rank) {
  return RANK_VALUE[rank] || 0;
}
