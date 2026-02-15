import {
  STANDARD_RANKS,
  SUITS,
  isJoker,
  isWildcardCard,
  rankValue
} from './cards.js';

export const COMBO_LABELS = {
  single: '单张',
  pair: '对子',
  triple: '三条',
  threeWithPair: '三带二',
  straight: '顺子',
  wood: '木板',
  steel: '钢板',
  straightFlush: '同花顺',
  bomb4: '4张炸弹',
  bomb5: '5张炸弹',
  bomb6: '6张炸弹',
  bomb7: '7张炸弹',
  bomb8: '8张炸弹',
  tianwang: '天王炸'
};

const COMBO_PRIORITY = {
  tianwang: 140,
  bomb8: 132,
  bomb7: 131,
  bomb6: 130,
  straightFlush: 122,
  bomb5: 120,
  steel: 93,
  wood: 92,
  bomb4: 90,
  threeWithPair: 80,
  straight: 78,
  triple: 68,
  pair: 60,
  single: 50
};

const LINEAR_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const STRAIGHT_CANDIDATES = buildSequenceCandidates(5);
const WOOD_CANDIDATES = buildSequenceCandidates(3);
const STEEL_CANDIDATES = buildSequenceCandidates(2);

const JOKER_RANKS = new Set(['SJ', 'BJ']);

function buildSequenceCandidates(length) {
  const list = [];
  for (let i = 0; i <= LINEAR_RANKS.length - length; i += 1) {
    list.push(LINEAR_RANKS.slice(i, i + length));
  }
  return list;
}

function isJokerRank(rank) {
  return JOKER_RANKS.has(rank);
}

function splitCards(cards, trumpRank) {
  const wildcards = [];
  const fixed = [];

  for (const card of cards) {
    if (!isJoker(card) && isWildcardCard(card, trumpRank)) {
      wildcards.push(card);
    } else {
      fixed.push(card);
    }
  }

  const jokers = fixed.filter((card) => isJoker(card));
  const fixedNoJoker = fixed.filter((card) => !isJoker(card));

  return {
    wildcards,
    fixed,
    jokers,
    fixedNoJoker
  };
}

function rankStrength(rank, trumpRank) {
  if (!rank) return 0;
  if (rank === trumpRank) return 24;
  if (rank === 'BJ') return 23;
  if (rank === 'SJ') return 22;
  return rankValue(rank);
}

function sortDefinitions(definitions, trumpRank) {
  return definitions.sort((a, b) => {
    const pa = COMBO_PRIORITY[a.type] || 0;
    const pb = COMBO_PRIORITY[b.type] || 0;
    if (pa !== pb) {
      return pb - pa;
    }

    const ra = rankStrength(a.mainRank, trumpRank);
    const rb = rankStrength(b.mainRank, trumpRank);
    if (ra !== rb) {
      return rb - ra;
    }

    const sa = a.sequence ? a.sequence.join('-') : '';
    const sb = b.sequence ? b.sequence.join('-') : '';
    return sb.localeCompare(sa);
  });
}

function countByRank(cards) {
  const map = new Map();
  for (const card of cards) {
    map.set(card.rank, (map.get(card.rank) || 0) + 1);
  }
  return map;
}

function matchNOfKind(cards, size, trumpRank) {
  if (cards.length !== size) return [];

  const { wildcards, fixed } = splitCards(cards, trumpRank);
  const fixedRankCounts = countByRank(fixed);

  if (fixedRankCounts.size > 1) {
    return [];
  }

  if (fixedRankCounts.size === 1) {
    const [targetRank] = [...fixedRankCounts.keys()];
    const fixedCount = fixedRankCounts.get(targetRank) || 0;

    if (isJokerRank(targetRank)) {
      if (wildcards.length > 0 || fixedCount !== size) return [];
      return [{ mainRank: targetRank }];
    }

    if (fixedCount + wildcards.length === size) {
      return [{ mainRank: targetRank }];
    }

    return [];
  }

  if (wildcards.length === size) {
    return [{ mainRank: trumpRank || 'A' }];
  }

  return [];
}

function matchSequencePattern(fixedCards, wildcardCount, candidate, copiesPerRank) {
  const rankCounts = countByRank(fixedCards);
  const required = new Set(candidate);

  for (const [rank, count] of rankCounts.entries()) {
    if (!required.has(rank)) {
      return false;
    }
    if (count > copiesPerRank) {
      return false;
    }
  }

  let missing = 0;
  for (const rank of candidate) {
    const used = rankCounts.get(rank) || 0;
    missing += Math.max(0, copiesPerRank - used);
  }

  return missing <= wildcardCount;
}

function matchStraight(cards, trumpRank) {
  if (cards.length !== 5) return [];

  const { wildcards, jokers, fixedNoJoker } = splitCards(cards, trumpRank);
  if (jokers.length > 0) return [];

  const matched = [];
  for (const candidate of STRAIGHT_CANDIDATES) {
    if (matchSequencePattern(fixedNoJoker, wildcards.length, candidate, 1)) {
      matched.push({
        mainRank: candidate[candidate.length - 1],
        sequence: candidate
      });
    }
  }

  return matched;
}

function matchWood(cards, trumpRank) {
  if (cards.length !== 6) return [];

  const { wildcards, jokers, fixedNoJoker } = splitCards(cards, trumpRank);
  if (jokers.length > 0) return [];

  const matched = [];
  for (const candidate of WOOD_CANDIDATES) {
    if (matchSequencePattern(fixedNoJoker, wildcards.length, candidate, 2)) {
      matched.push({
        mainRank: candidate[candidate.length - 1],
        sequence: candidate
      });
    }
  }

  return matched;
}

function matchSteel(cards, trumpRank) {
  if (cards.length !== 6) return [];

  const { wildcards, jokers, fixedNoJoker } = splitCards(cards, trumpRank);
  if (jokers.length > 0) return [];

  const matched = [];
  for (const candidate of STEEL_CANDIDATES) {
    if (matchSequencePattern(fixedNoJoker, wildcards.length, candidate, 3)) {
      matched.push({
        mainRank: candidate[candidate.length - 1],
        sequence: candidate
      });
    }
  }

  return matched;
}

function matchStraightFlush(cards, trumpRank) {
  if (cards.length !== 5) return [];

  const { wildcards, jokers, fixedNoJoker } = splitCards(cards, trumpRank);
  if (jokers.length > 0) return [];

  const suitSet = new Set(fixedNoJoker.map((card) => card.suit));
  if (suitSet.size > 1) return [];

  const suitCandidates = suitSet.size === 1 ? [...suitSet] : SUITS;
  const matched = [];

  for (const suit of suitCandidates) {
    for (const candidate of STRAIGHT_CANDIDATES) {
      if (matchSequencePattern(fixedNoJoker, wildcards.length, candidate, 1)) {
        matched.push({
          mainRank: candidate[candidate.length - 1],
          sequence: candidate,
          suit
        });
      }
    }
  }

  return matched;
}

function matchThreeWithPair(cards, trumpRank) {
  if (cards.length !== 5) return [];

  const { wildcards, fixed } = splitCards(cards, trumpRank);
  const fixedRanks = [...new Set(fixed.map((card) => card.rank))];
  const candidateRanks = [...new Set([...STANDARD_RANKS, 'SJ', 'BJ', ...fixedRanks])];

  const matches = [];

  for (const tripleRank of candidateRanks) {
    for (const pairRank of candidateRanks) {
      if (pairRank === tripleRank) continue;

      let tripleFixed = 0;
      let pairFixed = 0;
      let valid = true;

      for (const card of fixed) {
        if (card.rank === tripleRank) {
          tripleFixed += 1;
        } else if (card.rank === pairRank) {
          pairFixed += 1;
        } else {
          valid = false;
          break;
        }
      }

      if (!valid || tripleFixed > 3 || pairFixed > 2) continue;

      const needTriple = 3 - tripleFixed;
      const needPair = 2 - pairFixed;

      if (isJokerRank(tripleRank) && needTriple > 0) continue;
      if (isJokerRank(pairRank) && needPair > 0) continue;

      if (needTriple + needPair <= wildcards.length) {
        matches.push({
          mainRank: tripleRank,
          tripleRank,
          pairRank
        });
      }
    }
  }

  return matches;
}

function matchTianwang(cards) {
  if (cards.length !== 4) return false;
  const counts = countByRank(cards);
  return (counts.get('SJ') || 0) === 2 && (counts.get('BJ') || 0) === 2 && counts.size === 2;
}

function dedupeDefinitions(defs) {
  const map = new Map();
  for (const def of defs) {
    const key = [
      def.type,
      def.mainRank || '',
      def.sequence ? def.sequence.join('-') : '',
      def.suit || '',
      def.tripleRank || '',
      def.pairRank || ''
    ].join('|');
    if (!map.has(key)) {
      map.set(key, def);
    }
  }
  return [...map.values()];
}

export function detectComboTypes(cards, trumpRank) {
  if (!cards || cards.length === 0) return [];

  const defs = [];
  const size = cards.length;

  if (size === 1) {
    defs.push({ type: 'single', mainRank: cards[0].rank });
  }

  if (size === 2) {
    for (const match of matchNOfKind(cards, 2, trumpRank)) {
      defs.push({ type: 'pair', ...match });
    }
  }

  if (size === 3) {
    for (const match of matchNOfKind(cards, 3, trumpRank)) {
      defs.push({ type: 'triple', ...match });
    }
  }

  if (size === 4) {
    if (matchTianwang(cards)) {
      defs.push({ type: 'tianwang', mainRank: 'BJ' });
    }
    for (const match of matchNOfKind(cards, 4, trumpRank)) {
      defs.push({ type: 'bomb4', ...match });
    }
  }

  if (size === 5) {
    for (const match of matchStraightFlush(cards, trumpRank)) {
      defs.push({ type: 'straightFlush', ...match });
    }
    for (const match of matchNOfKind(cards, 5, trumpRank)) {
      defs.push({ type: 'bomb5', ...match });
    }
    for (const match of matchStraight(cards, trumpRank)) {
      defs.push({ type: 'straight', ...match });
    }
    for (const match of matchThreeWithPair(cards, trumpRank)) {
      defs.push({ type: 'threeWithPair', ...match });
    }
  }

  if (size === 6) {
    for (const match of matchNOfKind(cards, 6, trumpRank)) {
      defs.push({ type: 'bomb6', ...match });
    }
    for (const match of matchWood(cards, trumpRank)) {
      defs.push({ type: 'wood', ...match });
    }
    for (const match of matchSteel(cards, trumpRank)) {
      defs.push({ type: 'steel', ...match });
    }
  }

  if (size === 7) {
    for (const match of matchNOfKind(cards, 7, trumpRank)) {
      defs.push({ type: 'bomb7', ...match });
    }
  }

  if (size === 8) {
    for (const match of matchNOfKind(cards, 8, trumpRank)) {
      defs.push({ type: 'bomb8', ...match });
    }
  }

  const withLabels = dedupeDefinitions(defs).map((def) => ({
    ...def,
    label: COMBO_LABELS[def.type]
  }));

  return sortDefinitions(withLabels, trumpRank);
}

export function comboCardsKey(cards) {
  return [...cards]
    .map((card) => card.id)
    .sort((a, b) => a.localeCompare(b))
    .join(',');
}

export function comboKey(combo) {
  return comboCardsKey(combo.cards);
}

export function createCombo(cards, trumpRank, desired) {
  const definitions = detectComboTypes(cards, trumpRank);
  if (definitions.length === 0) {
    return null;
  }

  let picked;
  if (typeof desired === 'number') {
    picked = definitions[desired] || definitions[0];
  } else if (typeof desired === 'string') {
    picked = definitions.find((def) => def.type === desired) || definitions[0];
  } else if (desired && typeof desired === 'object') {
    const key = [
      desired.type,
      desired.mainRank || '',
      desired.sequence ? desired.sequence.join('-') : '',
      desired.suit || '',
      desired.tripleRank || '',
      desired.pairRank || ''
    ].join('|');

    picked =
      definitions.find(
        (def) =>
          [
            def.type,
            def.mainRank || '',
            def.sequence ? def.sequence.join('-') : '',
            def.suit || '',
            def.tripleRank || '',
            def.pairRank || ''
          ].join('|') === key
      ) || definitions[0];
  } else {
    picked = definitions[0];
  }

  return {
    type: picked.type,
    label: picked.label,
    cards: [...cards],
    mainRank: picked.mainRank || null,
    sequence: picked.sequence ? [...picked.sequence] : null,
    suit: picked.suit || null,
    tripleRank: picked.tripleRank || null,
    pairRank: picked.pairRank || null
  };
}

export function describeDefinition(definition) {
  if (!definition) return '';

  if (definition.type === 'straight' || definition.type === 'straightFlush') {
    return `${definition.label} (${definition.sequence.join('-')})`;
  }

  if (definition.type === 'wood' || definition.type === 'steel') {
    return `${definition.label} (${definition.sequence.join('-')})`;
  }

  if (definition.type === 'threeWithPair') {
    return `${definition.label} (${definition.tripleRank}带${definition.pairRank})`;
  }

  if (definition.mainRank) {
    return `${definition.label} (${definition.mainRank})`;
  }

  return definition.label;
}

export function comboPriority(type) {
  return COMBO_PRIORITY[type] || 0;
}

export function isBomb(comboType) {
  return comboType === 'bomb4' || comboType === 'bomb5' || comboType === 'bomb6' || comboType === 'bomb7' || comboType === 'bomb8' || comboType === 'tianwang';
}

export function isFireCombo(comboType) {
  return isBomb(comboType) || comboType === 'straightFlush';
}
