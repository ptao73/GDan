import { rankValue } from '../engine/cards.js';

function displayRankValue(rank) {
  return rankValue(rank);
}

export function comboRankVector(combo) {
  return (combo?.cards || []).map((card) => displayRankValue(card.rank)).sort((a, b) => b - a);
}

function compareRankVectorDesc(a = [], b = []) {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const aValue = a[i] ?? -1;
    const bValue = b[i] ?? -1;
    if (aValue !== bValue) {
      return bValue - aValue;
    }
  }
  return 0;
}

export function compareComboDisplayOrder(a, b) {
  const countDelta = (b.cardCount || 0) - (a.cardCount || 0);
  if (countDelta !== 0) return countDelta;

  if (a.total !== b.total) return b.total - a.total;

  const rankDelta = compareRankVectorDesc(a.rankVector, b.rankVector);
  if (rankDelta !== 0) return rankDelta;

  return a.originIndex - b.originIndex;
}
