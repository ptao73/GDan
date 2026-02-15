import { isWildcardCard, rankValue } from './cards.js';

const BASIC_TYPES = new Set(['single', 'pair', 'triple', 'straight', 'threeWithPair']);
const ENHANCED_TYPES = new Set(['wood', 'steel']);

function isHighRank(rank, trumpRank) {
  if (!rank) return false;
  if (rank === trumpRank) return true;
  if (rank === 'Q' || rank === 'K' || rank === 'A') return true;
  if (rank === 'SJ' || rank === 'BJ') return true;
  return false;
}

function isMidRank(rank) {
  return rank === '8' || rank === '9' || rank === '10' || rank === 'J';
}

function basicRankScore(rank, trumpRank) {
  if (isHighRank(rank, trumpRank)) return 1;
  if (isMidRank(rank)) return 0;
  return -1;
}

function enhancedRankScore(rank, trumpRank) {
  if (isHighRank(rank, trumpRank)) return 2;
  if (isMidRank(rank)) return 1;
  return 0;
}

function fireScore(combo) {
  if (combo.type === 'tianwang') {
    return 6;
  }

  if (combo.type === 'straightFlush') {
    return 4;
  }

  if (combo.type === 'bomb8' || combo.type === 'bomb7' || combo.type === 'bomb6') {
    return 5;
  }

  if (combo.type === 'bomb5') {
    return 3;
  }

  if (combo.type === 'bomb4') {
    const value = rankValue(combo.mainRank || '2');
    return value > 10 ? 2 : 1;
  }

  return 0;
}

function keyCardScore(combo, trumpRank) {
  if (combo.type !== 'single') {
    return 0;
  }

  const card = combo.cards[0];
  if (!card) {
    return 0;
  }

  if (card.rank === 'BJ') {
    return 3;
  }

  if (card.rank === 'SJ') {
    return 2;
  }

  if (isWildcardCard(card, trumpRank)) {
    return 2;
  }

  return 0;
}

export function roundCorrection(handCount) {
  if (handCount <= 8) {
    return 2 * (9 - handCount);
  }

  if (handCount <= 10) {
    return 0;
  }

  return -2 * (handCount - 10);
}

export function scoreComboNoRound(combo, trumpRank) {
  let shapeScore = 0;

  if (BASIC_TYPES.has(combo.type)) {
    shapeScore = basicRankScore(combo.mainRank, trumpRank);
  } else if (ENHANCED_TYPES.has(combo.type)) {
    shapeScore = enhancedRankScore(combo.mainRank, trumpRank);
  }

  const burstScore = fireScore(combo);
  const keyScore = keyCardScore(combo, trumpRank);

  return {
    shapeScore,
    burstScore,
    keyScore,
    total: shapeScore + burstScore + keyScore
  };
}

export function scoreScheme(combos, trumpRank) {
  let shapeScore = 0;
  let burstScore = 0;
  let keyScore = 0;

  const comboBreakdown = combos.map((combo) => {
    const single = scoreComboNoRound(combo, trumpRank);
    shapeScore += single.shapeScore;
    burstScore += single.burstScore;
    keyScore += single.keyScore;
    return {
      type: combo.type,
      label: combo.label,
      mainRank: combo.mainRank,
      shapeScore: single.shapeScore,
      burstScore: single.burstScore,
      keyScore: single.keyScore,
      total: single.total
    };
  });

  const handCount = combos.length;
  const roundScore = roundCorrection(handCount);

  const total = shapeScore + burstScore + keyScore + roundScore;

  return {
    total,
    detail: {
      shapeScore,
      burstScore,
      keyScore,
      roundScore,
      handCount
    },
    comboBreakdown
  };
}
