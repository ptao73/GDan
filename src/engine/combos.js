/**
 * combos.js — 掼蛋牌型检测引擎
 *
 * 概述：
 * 本模块负责识别 11 种掼蛋牌型：
 *   单张、对子、三条、三带二、顺子(5张)、木板(3×2连对)、
 *   钢板(2×3连三)、同花顺、4~8 张炸弹、天王炸(双大小王)。
 *
 * 性能策略 — 位掩码加速：
 *   顺子/木板/钢板等顺序牌型需要匹配 A-2-3-…-K-A 的连续 rank 窗口。
 *   为避免逐张比较，将每张牌的 rank 映射到 14-bit 位掩码（A 占 bit0 和 bit13），
 *   通过 AND 运算快速排除不可能的 candidate，再做精确检查。
 *
 * 百搭牌（逢人配）处理：
 *   红桃打几对应的牌作为万能替身，可替代任意 rank 参与组牌。
 *   splitCards() 将手牌分为百搭牌和固定牌两组，匹配时只需计算固定牌的缺口是否 ≤ 百搭数。
 */
import { STANDARD_RANKS, SUITS, isJoker, isWildcardCard, rankValue } from './cards.js';

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

// 2A: 为每个 rank 分配一个 bit 位置 (0~13)，用于位掩码快速匹配
const RANK_BIT_INDEX = {};
for (let i = 0; i < LINEAR_RANKS.length; i += 1) {
  // A 出现两次 (index 0 和 13)，取较高位
  RANK_BIT_INDEX[LINEAR_RANKS[i]] = i;
}
// A 同时在位置 0 和 13，用 index 0 和 13 都映射
// 这里选择保留最后一次赋值(13)，但 A 在 candidate 里会通过 candidateMask 正确处理

/**
 * 预计算指定长度的顺序候选列表。
 * 在 LINEAR_RANKS (A-2-3-…-K-A) 上滑动窗口，生成所有可能的连续 rank 序列，
 * 并为每个序列预计算位掩码（mask），供 matchSequencePattern 做快速排除。
 */
function buildSequenceCandidates(length) {
  const list = [];
  for (let i = 0; i <= LINEAR_RANKS.length - length; i += 1) {
    const ranks = LINEAR_RANKS.slice(i, i + length);
    // 2A: 预计算 bitmask — 每个 candidate 的所需 rank 位集合
    let mask = 0;
    for (let j = 0; j < ranks.length; j += 1) {
      mask |= 1 << (i + j);
    }
    list.push({ ranks, mask });
  }
  return list;
}

const STRAIGHT_CANDIDATES = buildSequenceCandidates(5);
const WOOD_CANDIDATES = buildSequenceCandidates(3);
const STEEL_CANDIDATES = buildSequenceCandidates(2);

const JOKER_RANKS = new Set(['SJ', 'BJ']);

/**
 * 快速统计函数：用 Uint8Array 做 rank 计数，同时生成 presence mask。
 * counts[i] = 第 i 个 LINEAR_RANKS 位置上的牌数量
 * mask = 14-bit 整数，bit i 置 1 表示该位置有牌存在
 * 用于 matchSequencePattern 的快速排除阶段。
 */
function rankPresenceMask(cards) {
  const counts = new Uint8Array(14); // 对应 LINEAR_RANKS 14 个位置
  let mask = 0;
  for (const card of cards) {
    const rank = card.rank;
    // 找到 rank 在 LINEAR_RANKS 中的位置
    for (let i = 0; i < LINEAR_RANKS.length; i += 1) {
      if (LINEAR_RANKS[i] === rank) {
        counts[i] += 1;
        mask |= 1 << i;
      }
    }
  }
  return { mask, counts };
}

function isJokerRank(rank) {
  return JOKER_RANKS.has(rank);
}

/**
 * 将手牌分离为：百搭牌（逢人配）和固定牌（含大小王）。
 * 百搭牌 = 非大小王的红桃打几牌，可替代任意 rank。
 * 返回 { wildcards, fixed, jokers, fixedNoJoker }。
 */
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
      // 大小王不能组成对子，只能作为单张
      if (size === 2) return [];
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

/**
 * 两阶段匹配顺序牌型：
 * 1) 快速排除：用 fixedMask & ~candidateMask 判断固定牌是否存在候选窗口之外的 rank，
 *    有则直接失败。A 的双向处理：A 在 bit0 和 bit13 都有映射，
 *    如果 candidate 包含其中一个 A 位，不应因另一个 A 位而误排除。
 * 2) 精确检查：统计每个候选 rank 位置的固定牌数量与 copiesPerRank 的缺口，
 *    确认百搭牌数量足以填补所有缺口。
 */
function matchSequencePattern(
  fixedCards,
  wildcardCount,
  candidate,
  copiesPerRank,
  fixedMask,
  fixedCounts
) {
  const { ranks, mask: candidateMask } = candidate;

  // 快速排除：如果 fixed 牌中有 candidate 不覆盖的 rank，直接失败
  // 注意：A 在 LINEAR_RANKS 中占两个位置 (bit 0 和 bit 13)，
  // 如果 candidate 覆盖了其中一个 A 位，另一个 A 位不应导致排除
  if (fixedMask !== undefined) {
    let adjustedFixedMask = fixedMask;
    const A_LOW = 1 << 0;
    const A_HIGH = 1 << 13;
    if (candidateMask & A_HIGH) adjustedFixedMask &= ~A_LOW;
    if (candidateMask & A_LOW) adjustedFixedMask &= ~A_HIGH;
    if ((adjustedFixedMask & ~candidateMask) !== 0) {
      return false;
    }
  }

  // 精确检查: 使用预计算的 counts（如果有）或回退到 countByRank
  if (fixedCounts) {
    let missing = 0;
    for (let i = 0; i < LINEAR_RANKS.length; i += 1) {
      if ((candidateMask & (1 << i)) === 0) {
        // 这个位置不在 candidate 中，如果 fixed 有这个 rank 就失败
        // 但 A 占两个位置 (0 和 13)，如果另一个 A 位在 candidate 中则跳过
        if (fixedCounts[i] > 0) {
          if (LINEAR_RANKS[i] === 'A') {
            const otherABit = i === 0 ? 13 : 0;
            if (candidateMask & (1 << otherABit)) continue;
          }
          return false;
        }
      }
    }
    // 统计各 candidate rank 的缺口
    const countedRanks = new Set();
    for (let j = 0; j < ranks.length; j += 1) {
      const rank = ranks[j];
      if (countedRanks.has(rank)) continue;
      countedRanks.add(rank);
      // 只统计 candidate 覆盖的位置上的 count
      // （A 在 index 0 和 13 都出现，但只应取 candidate 对应位的 count）
      let bestCount = 0;
      for (let i = 0; i < LINEAR_RANKS.length; i += 1) {
        if (LINEAR_RANKS[i] === rank && (candidateMask & (1 << i)) !== 0) {
          bestCount += fixedCounts[i];
        }
      }
      if (bestCount > copiesPerRank) return false;
      missing += Math.max(0, copiesPerRank - bestCount);
    }
    return missing <= wildcardCount;
  }

  // 回退路径：无预计算数据时使用原逻辑
  const rankCounts = countByRank(fixedCards);
  const required = new Set(ranks);

  for (const [rank, count] of rankCounts.entries()) {
    if (!required.has(rank)) return false;
    if (count > copiesPerRank) return false;
  }

  let missing = 0;
  for (const rank of ranks) {
    const used = rankCounts.get(rank) || 0;
    missing += Math.max(0, copiesPerRank - used);
  }
  return missing <= wildcardCount;
}

// 2D: 更新 matchStraight/matchWood/matchSteel 使用新版 candidate 格式和预计算 mask
function matchStraight(cards, trumpRank) {
  if (cards.length !== 5) return [];

  const { wildcards, jokers, fixedNoJoker } = splitCards(cards, trumpRank);
  if (jokers.length > 0) return [];

  const { mask: fixedMask, counts: fixedCounts } = rankPresenceMask(fixedNoJoker);
  const matched = [];
  for (const candidate of STRAIGHT_CANDIDATES) {
    if (
      matchSequencePattern(fixedNoJoker, wildcards.length, candidate, 1, fixedMask, fixedCounts)
    ) {
      matched.push({
        mainRank: candidate.ranks[candidate.ranks.length - 1],
        sequence: candidate.ranks
      });
    }
  }

  return matched;
}

function matchWood(cards, trumpRank) {
  if (cards.length !== 6) return [];

  const { wildcards, jokers, fixedNoJoker } = splitCards(cards, trumpRank);
  if (jokers.length > 0) return [];

  const { mask: fixedMask, counts: fixedCounts } = rankPresenceMask(fixedNoJoker);
  const matched = [];
  for (const candidate of WOOD_CANDIDATES) {
    if (
      matchSequencePattern(fixedNoJoker, wildcards.length, candidate, 2, fixedMask, fixedCounts)
    ) {
      matched.push({
        mainRank: candidate.ranks[candidate.ranks.length - 1],
        sequence: candidate.ranks
      });
    }
  }

  return matched;
}

function matchSteel(cards, trumpRank) {
  if (cards.length !== 6) return [];

  const { wildcards, jokers, fixedNoJoker } = splitCards(cards, trumpRank);
  if (jokers.length > 0) return [];

  const { mask: fixedMask, counts: fixedCounts } = rankPresenceMask(fixedNoJoker);
  const matched = [];
  for (const candidate of STEEL_CANDIDATES) {
    if (
      matchSequencePattern(fixedNoJoker, wildcards.length, candidate, 3, fixedMask, fixedCounts)
    ) {
      matched.push({
        mainRank: candidate.ranks[candidate.ranks.length - 1],
        sequence: candidate.ranks
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
  const { mask: fixedMask, counts: fixedCounts } = rankPresenceMask(fixedNoJoker);
  const matched = [];

  for (const suit of suitCandidates) {
    for (const candidate of STRAIGHT_CANDIDATES) {
      if (
        matchSequencePattern(fixedNoJoker, wildcards.length, candidate, 1, fixedMask, fixedCounts)
      ) {
        matched.push({
          mainRank: candidate.ranks[candidate.ranks.length - 1],
          sequence: candidate.ranks,
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
  return (
    comboType === 'bomb4' ||
    comboType === 'bomb5' ||
    comboType === 'bomb6' ||
    comboType === 'bomb7' ||
    comboType === 'bomb8' ||
    comboType === 'tianwang' ||
    comboType === 'straightFlush'
  );
}

export function isFireCombo(comboType) {
  return isBomb(comboType);
}
