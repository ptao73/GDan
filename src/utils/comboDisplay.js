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
  const rankDelta = compareRankVectorDesc(a.rankVector, b.rankVector);
  if (rankDelta !== 0) return rankDelta;
  if (a.total !== b.total) return b.total - a.total;
  if (a.burstScore !== b.burstScore) return b.burstScore - a.burstScore;
  if (a.shapeScore !== b.shapeScore) return b.shapeScore - a.shapeScore;
  if (a.keyScore !== b.keyScore) return b.keyScore - a.keyScore;
  return a.originIndex - b.originIndex;
}
