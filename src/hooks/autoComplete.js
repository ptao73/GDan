// 自动补全辅助函数：pickAutoTriple 和 pickAutoPair
import { detectComboTypes } from '../engine/combos.js';

export function pickAutoTriple(cards, trumpRank) {
  let picked = null;

  for (let i = 0; i < cards.length - 2; i += 1) {
    for (let j = i + 1; j < cards.length - 1; j += 1) {
      for (let k = j + 1; k < cards.length; k += 1) {
        const tripleCards = [cards[i], cards[j], cards[k]];
        const definition = detectComboTypes(tripleCards, trumpRank).find(
          (item) => item.type === 'triple'
        );
        if (!definition) continue;

        const rankSet = new Set(tripleCards.map((card) => card.rank));
        const sameRankScore = rankSet.size === 1 ? 2 : rankSet.size === 2 ? 1 : 0;
        const sortedIds = [cards[i].id, cards[j].id, cards[k].id].sort((a, b) =>
          a.localeCompare(b)
        );
        const idKey = sortedIds.join('|');
        const candidate = {
          i,
          j,
          k,
          definition,
          score: sameRankScore,
          idKey
        };

        if (
          !picked ||
          candidate.score > picked.score ||
          (candidate.score === picked.score && candidate.idKey < picked.idKey)
        ) {
          picked = candidate;
        }
      }
    }
  }

  return picked;
}

export function pickAutoPair(cards, trumpRank) {
  let picked = null;

  for (let i = 0; i < cards.length - 1; i += 1) {
    for (let j = i + 1; j < cards.length; j += 1) {
      const pairCards = [cards[i], cards[j]];
      const definition = detectComboTypes(pairCards, trumpRank).find(
        (item) => item.type === 'pair'
      );
      if (!definition) continue;

      const sameRank = cards[i].rank === cards[j].rank ? 1 : 0;
      const sortedIds = [cards[i].id, cards[j].id].sort((a, b) => a.localeCompare(b));
      const idKey = sortedIds.join('|');
      const candidate = {
        i,
        j,
        definition,
        score: sameRank,
        idKey
      };

      if (
        !picked ||
        candidate.score > picked.score ||
        (candidate.score === picked.score && candidate.idKey < picked.idKey)
      ) {
        picked = candidate;
      }
    }
  }

  return picked;
}
