import { isWildcardCard, rankValue } from './cards.js';
import { isFireCombo } from './combos.js';

// ── 单张评分 ──
function scoreSingle(card, trumpRank) {
  if (!card) return 0;
  if (card.rank === 'BJ') return 2;
  if (card.rank === 'SJ') return 1;
  if (card.rank === trumpRank) return 1;
  const rv = rankValue(card.rank);
  if (rv >= 11) return 1; // J, Q, K, A
  if (rv >= 8) return 0; // 8, 9, 10
  return -1; // ≤7
}

// ── 对子 / 三条评分（共用逻辑）──
function scorePairOrTriple(mainRank, trumpRank) {
  if (mainRank === trumpRank) return 1;
  const rv = rankValue(mainRank);
  if (rv >= 11) return 1; // J, Q, K, A
  if (rv >= 8) return 0; // 8, 9, 10
  return -1; // ≤7
}

// ── 三带二评分（主牌由三条决定）──
function scoreThreeWithPair(tripleRank, trumpRank) {
  if (tripleRank === trumpRank) return 1;
  const rv = rankValue(tripleRank);
  if (rv >= 10) return 1; // 10, J, Q, K, A
  return 0; // ≤9
}

// ── 木板 / 钢板评分 ──
function scoreWoodSteel(mainRank, trumpRank) {
  if (mainRank === trumpRank) return 2;
  const rv = rankValue(mainRank);
  if (rv >= 8) return 2; // 8, 9, 10, J, Q, K, A
  return 1; // ≤7
}

// ── 顺子评分 ──
function scoreStraight(mainRank, trumpRank) {
  if (mainRank === trumpRank) return 1;
  const rv = rankValue(mainRank);
  if (rv >= 10) return 1; // 10, J, Q, K, A
  return 0; // ≤9
}

// ── 炸弹评分 ──
function scoreBomb(combo, trumpRank) {
  if (combo.type === 'tianwang') return 6;
  if (combo.type === 'bomb6' || combo.type === 'bomb7' || combo.type === 'bomb8') return 5;
  if (combo.type === 'straightFlush') return 4;
  // bomb4 / bomb5 — 常规炸弹
  const rank = combo.mainRank;
  if (rank === trumpRank) return 3;
  const rv = rankValue(rank);
  if (rv >= 11) return 3; // J, Q, K, A
  return 2; // ≤10
}

// ── 单组牌型评分（不含轮次）──
export function handTypeScore(combo, trumpRank) {
  if (!combo || !combo.type) return 0;

  if (isFireCombo(combo.type)) {
    return scoreBomb(combo, trumpRank);
  }

  switch (combo.type) {
    case 'single':
      return scoreSingle(combo.cards?.[0], trumpRank);
    case 'pair':
      return scorePairOrTriple(combo.mainRank, trumpRank);
    case 'triple':
      return scorePairOrTriple(combo.mainRank, trumpRank);
    case 'threeWithPair':
      return scoreThreeWithPair(combo.tripleRank || combo.mainRank, trumpRank);
    case 'wood':
    case 'steel':
      return scoreWoodSteel(combo.mainRank, trumpRank);
    case 'straight':
      return scoreStraight(combo.mainRank, trumpRank);
    default:
      return 0;
  }
}

// 向后兼容：solver / GodViewPanel 仍通过此函数获取单组得分
export function scoreComboNoRound(combo, trumpRank) {
  const total = handTypeScore(combo, trumpRank);
  return { total };
}

// ── 轮次修正 ──
export function roundCorrection(handCount) {
  if (handCount <= 8) {
    return (9 - handCount) * 3;
  }
  if (handCount <= 11) {
    return 0;
  }
  return (11 - handCount) * 3;
}

// ── 整体方案评分 ──
// 总分 = Σ 牌型得分 + 轮次得分
export function scoreScheme(combos, trumpRank) {
  const comboBreakdown = combos.map((combo) => {
    const score = handTypeScore(combo, trumpRank);
    return {
      type: combo.type,
      label: combo.label,
      mainRank: combo.mainRank,
      score
    };
  });

  const handCount = combos.length;
  const turnScore = roundCorrection(handCount);
  const total = comboBreakdown.reduce((sum, item) => sum + item.score, 0) + turnScore;

  return {
    total,
    detail: {
      handCount,
      turnScore
    },
    comboBreakdown
  };
}

// ── 以下函数仅供 solver 搜索启发式使用，不参与最终评分 ──

// 百搭牌边际效用惩罚（搜索时降低百搭用于低价值牌型的优先级）
export function wildcardUtilityPenalty(combo, trumpRank) {
  if (!combo.cards || combo.cards.length === 0) return 0;
  if (isFireCombo(combo.type)) return 0;
  if (combo.type === 'single') return 0;

  let wildcardCount = 0;
  for (const card of combo.cards) {
    if (isWildcardCard(card, trumpRank)) {
      wildcardCount += 1;
    }
  }
  if (wildcardCount === 0) return 0;

  const rv = rankValue(combo.mainRank || '2');
  if (rv >= 11) return 0;
  const penaltyPerCard = rv <= 7 ? 2 : 1;
  return wildcardCount * penaltyPerCard;
}
