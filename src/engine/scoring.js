import { isWildcardCard, rankValue } from './cards.js';
import { isFireCombo } from './combos.js';

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

// 1C: 扩展控牌加分 — 单张 + 大对子均有加分
function keyCardScore(combo, trumpRank) {
  if (combo.type === 'single') {
    const card = combo.cards[0];
    if (!card) return 0;
    if (card.rank === 'BJ') return 3;
    if (card.rank === 'SJ') return 2;
    if (isWildcardCard(card, trumpRank)) return 2;
    return 0;
  }

  if (combo.type === 'pair') {
    const rank = combo.mainRank;
    if (rank === 'A') return 2;
    if (rank === 'K') return 1;
    if (rank === trumpRank) return 1;
    return 0;
  }

  return 0;
}

// 1A: 百搭牌边际效用惩罚 — 百搭用在低牌对子/顺子上扣分（浪费），用在炸弹或作为控牌单张不扣分
export function wildcardUtilityPenalty(combo, trumpRank) {
  if (!combo.cards || combo.cards.length === 0) return 0;

  // 炸弹/同花顺/天王 — 百搭用得其所，不扣分
  if (isFireCombo(combo.type)) return 0;

  // 单张百搭 — 作为控牌使用，不扣分
  if (combo.type === 'single') return 0;

  // 统计组合中百搭牌数量
  let wildcardCount = 0;
  for (const card of combo.cards) {
    if (isWildcardCard(card, trumpRank)) {
      wildcardCount += 1;
    }
  }
  if (wildcardCount === 0) return 0;

  // 百搭用在低牌组合上扣分
  const rv = rankValue(combo.mainRank || '2');
  if (rv >= 11) return 0; // J 及以上不扣分

  // 低牌组合: 每张百搭扣 2 分; 中等牌: 扣 1 分
  const penaltyPerCard = rv <= 7 ? 2 : 1;
  return wildcardCount * penaltyPerCard;
}

// 1B: 孤立弱牌惩罚 — 低于 8 的非控牌单张每张 -1
export function isolationPenalty(combos, trumpRank) {
  let penalty = 0;
  for (const combo of combos) {
    if (combo.type !== 'single') continue;
    const card = combo.cards[0];
    if (!card) continue;
    // 控牌（大小王、百搭）不算孤立弱牌
    if (card.rank === 'BJ' || card.rank === 'SJ') continue;
    if (isWildcardCard(card, trumpRank)) continue;
    if (card.rank === trumpRank) continue;
    // 低于 8 的牌
    const rv = rankValue(card.rank);
    if (rv < 8) {
      penalty += 1;
    }
  }
  return penalty;
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
  // 1A: 百搭效用惩罚
  const wcPenalty = wildcardUtilityPenalty(combo, trumpRank);

  return {
    shapeScore,
    burstScore,
    keyScore,
    total: shapeScore + burstScore + keyScore - wcPenalty
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
  const isoP = isolationPenalty(combos, trumpRank);

  const total = shapeScore + burstScore + keyScore + roundScore - isoP;

  return {
    total,
    detail: {
      shapeScore,
      burstScore,
      keyScore,
      roundScore,
      handCount,
      isolationPenalty: isoP
    },
    comboBreakdown
  };
}
