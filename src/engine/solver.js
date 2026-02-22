/**
 * solver.js — 掼蛋组牌搜索引擎
 *
 * 整体搜索策略：
 * 1. 贪心基线（greedyBaseline）：每步取当前最高评估分的候选牌型，快速得到一个可行解。
 * 2. 波束搜索（beamSearch）：维护 beamWidth 个最优部分解并行展开，
 *    每层对每个状态生成候选，按 beamScore（部分得分 + 剩余质量估算 + 轮次修正）排序后
 *    保留 top-beamWidth 个继续搜索。超时后将未完成的状态用贪心补全。
 * 3. topK 结果：所有方案去重后按 compareSchemeResult 排序，保留前 K 个。
 *
 * 关键函数：
 * - buildCandidatePool: 以 anchor 牌为中心，按优先级收集候选池（同 rank > 百搭 > 同花色 > 近 rank > 王 > 其余）
 * - candidateEstimate: 启发式评分 = 单组得分×8 + 牌数×2 + 类型优先级 - 拆炸惩罚 - 百搭效用惩罚
 * - beamSearch: 波束搜索核心，含超时保护
 * - solveBestScheme: 整合贪心+波束，返回最终 topK 方案
 */
import { cardSortValue, isJoker, isWildcardCard, rankValue, STANDARD_RANKS } from './cards.js';
import { COMBO_LABELS, comboPriority, detectComboTypes, isFireCombo } from './combos.js';
import {
  roundCorrection,
  scoreComboNoRound,
  scoreScheme,
  wildcardUtilityPenalty
} from './scoring.js';

const MAX_COMBO_SIZE = 8;
const DEFAULT_TIME_LIMIT = 3000;
const DEFAULT_MAX_BRANCH = 24;
const DEFAULT_TOP_K = 3;
const MAX_POOL_SIZE = 13;
const BOMB_SPLIT_PENALTY_PER_CARD = 3;

const SIZE_LIMIT = {
  1: 1,
  2: 16,
  3: 20,
  4: 22,
  5: 24,
  6: 20,
  7: 12,
  8: 8
};

const RANK_INDEX = STANDARD_RANKS.reduce((acc, rank, index) => {
  acc[rank] = index;
  return acc;
}, {});

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function cloneCombo(combo) {
  return {
    type: combo.type,
    label: combo.label,
    cards: [...combo.cards],
    mainRank: combo.mainRank,
    sequence: combo.sequence ? [...combo.sequence] : null,
    suit: combo.suit || null,
    tripleRank: combo.tripleRank || null,
    pairRank: combo.pairRank || null
  };
}

function cloneComboList(combos) {
  return combos.map((combo) => cloneCombo(combo));
}

function removeCards(remaining, toRemove) {
  const idSet = new Set(toRemove.map((card) => card.id));
  return remaining.filter((card) => !idSet.has(card.id));
}

function cyclicRankDistance(rankA, rankB) {
  if (!(rankA in RANK_INDEX) || !(rankB in RANK_INDEX)) {
    return 99;
  }

  const a = RANK_INDEX[rankA];
  const b = RANK_INDEX[rankB];
  const diff = Math.abs(a - b);
  return Math.min(diff, 13 - diff);
}

/**
 * 构建候选池：以 anchor 牌为中心，按以下优先级收集最多 MAX_POOL_SIZE 张牌：
 * 1. anchor 自身
 * 2. 同 rank 的牌（便于组成对子/炸弹）
 * 3. 百搭牌（逢人配，可替代任意 rank）
 * 4. 同花色的牌（便于组同花顺）
 * 5. rank 距离 ≤ 4 的牌（便于组顺子）
 * 6. 大小王
 * 7. 其余牌
 */
function buildCandidatePool(remaining, anchor, trumpRank) {
  const ordered = [];
  const seen = new Set();

  const addMany = (cards) => {
    for (const card of cards) {
      if (seen.has(card.id)) continue;
      seen.add(card.id);
      ordered.push(card);
      if (ordered.length >= MAX_POOL_SIZE) return;
    }
  };

  addMany([anchor]);

  addMany(remaining.filter((card) => card.rank === anchor.rank));
  addMany(remaining.filter((card) => isWildcardCard(card, trumpRank)));

  if (!isJoker(anchor)) {
    addMany(remaining.filter((card) => !isJoker(card) && card.suit === anchor.suit));
    addMany(
      remaining.filter((card) => !isJoker(card) && cyclicRankDistance(card.rank, anchor.rank) <= 4)
    );
  }

  addMany(remaining.filter((card) => isJoker(card)));
  addMany(remaining);

  return ordered.slice(0, MAX_POOL_SIZE);
}

function subsetsWithAnchor(anchor, pool, size, maxCount) {
  const need = size - 1;
  const others = pool.filter((card) => card.id !== anchor.id);

  if (need === 0) {
    return [[anchor]];
  }

  if (others.length < need) {
    return [];
  }

  const result = [];
  const path = [];

  const dfs = (start) => {
    if (result.length >= maxCount) {
      return;
    }

    if (path.length === need) {
      result.push([anchor, ...path]);
      return;
    }

    for (let i = start; i < others.length; i += 1) {
      path.push(others[i]);
      dfs(i + 1);
      path.pop();

      if (result.length >= maxCount) {
        return;
      }
    }
  };

  dfs(0);
  return result;
}

function comboFromDefinition(cards, definition) {
  return {
    type: definition.type,
    label: COMBO_LABELS[definition.type],
    cards: [...cards],
    mainRank: definition.mainRank || null,
    sequence: definition.sequence ? [...definition.sequence] : null,
    suit: definition.suit || null,
    tripleRank: definition.tripleRank || null,
    pairRank: definition.pairRank || null
  };
}

function candidateKey(combo) {
  const cardKey = combo.cards
    .map((card) => card.id)
    .sort((a, b) => a.localeCompare(b))
    .join(',');
  return [
    combo.type,
    cardKey,
    combo.mainRank || '',
    combo.sequence ? combo.sequence.join('-') : '',
    combo.suit || '',
    combo.tripleRank || '',
    combo.pairRank || ''
  ].join('|');
}

function schemeKey(combos) {
  return combos
    .map((combo) => candidateKey(combo))
    .sort((a, b) => a.localeCompare(b))
    .join('||');
}

function buildBombProtection(cards) {
  const rankCardIds = new Map();

  for (const card of cards) {
    if (isJoker(card)) continue;
    const list = rankCardIds.get(card.rank) || [];
    list.push(card.id);
    rankCardIds.set(card.rank, list);
  }

  const protectedIds = new Set();
  let protectedGroups = 0;

  for (const ids of rankCardIds.values()) {
    if (ids.length < 4) continue;
    protectedGroups += Math.floor(ids.length / 4);
    for (const id of ids) {
      protectedIds.add(id);
    }
  }

  return {
    protectedIds,
    protectedGroups
  };
}

function splitBombPenalty(combo, bombProtection) {
  if (!bombProtection || bombProtection.protectedIds.size === 0) {
    return 0;
  }

  if (isFireCombo(combo.type)) {
    return 0;
  }

  let involved = 0;
  for (const card of combo.cards) {
    if (bombProtection.protectedIds.has(card.id)) {
      involved += 1;
    }
  }

  return involved * BOMB_SPLIT_PENALTY_PER_CARD;
}

/**
 * 启发式评分：对单个候选牌型的价值进行估算。
 * - component.total * 8：单组得分权重最高，鼓励选择高分牌型
 * - combo.cards.length * 2：鼓励消耗更多牌（减少手数）
 * - comboPriority：按牌型等级加分（炸弹 > 顺子 > 三条 > 对子 > 单张）
 * - splitPenalty：如果拆散了潜在炸弹中的牌，扣分
 * - wcPenalty * 4：百搭牌用于低价值牌型时扣分（鼓励将百搭用于高价值组合）
 */
function candidateEstimate(combo, component, bombProtection, trumpRank) {
  const splitPenalty = splitBombPenalty(combo, bombProtection);
  const wcPenalty = trumpRank ? wildcardUtilityPenalty(combo, trumpRank) : 0;
  return (
    component.total * 8 +
    combo.cards.length * 2 +
    comboPriority(combo.type) -
    splitPenalty -
    wcPenalty * 4
  );
}

function generateCandidates(remaining, trumpRank, maxBranch, bombProtection) {
  const anchor = remaining[0];
  if (!anchor) {
    return [];
  }

  const pool = buildCandidatePool(remaining, anchor, trumpRank);
  const candidates = [];
  const seen = new Set();

  const maxSize = Math.min(MAX_COMBO_SIZE, pool.length);
  for (let size = 1; size <= maxSize; size += 1) {
    const subsetLimit = SIZE_LIMIT[size] || 8;
    const subsets = subsetsWithAnchor(anchor, pool, size, subsetLimit);

    for (const subset of subsets) {
      const definitions = detectComboTypes(subset, trumpRank);
      for (const definition of definitions) {
        const combo = comboFromDefinition(subset, definition);
        const key = candidateKey(combo);
        if (seen.has(key)) continue;

        seen.add(key);
        const component = scoreComboNoRound(combo, trumpRank);
        const estimate = candidateEstimate(combo, component, bombProtection, trumpRank);

        candidates.push({
          ...combo,
          component,
          estimate
        });
      }
    }
  }

  candidates.sort((a, b) => {
    if (a.estimate !== b.estimate) {
      return b.estimate - a.estimate;
    }
    if (a.cards.length !== b.cards.length) {
      return b.cards.length - a.cards.length;
    }
    return b.component.total - a.component.total;
  });

  if (candidates.length === 0) {
    const fallback = {
      type: 'single',
      label: COMBO_LABELS.single,
      cards: [anchor],
      mainRank: anchor.rank,
      sequence: null,
      suit: null,
      tripleRank: null,
      pairRank: null
    };
    const component = scoreComboNoRound(fallback, trumpRank);
    return [
      {
        ...fallback,
        component,
        estimate: candidateEstimate(fallback, component, bombProtection, trumpRank)
      }
    ];
  }

  return candidates.slice(0, maxBranch);
}

function greedyBaseline(cards, trumpRank, maxBranch, bombProtection) {
  let remaining = [...cards];
  const combos = [];
  let partial = 0;

  while (remaining.length > 0) {
    const candidates = generateCandidates(remaining, trumpRank, maxBranch, bombProtection);
    const picked = candidates[0];
    combos.push(cloneCombo(picked));
    partial += picked.component.total;
    remaining = removeCards(remaining, picked.cards);
  }

  const total = combos.length === 0 ? 0 : partial + roundCorrection(combos.length);
  return {
    combos,
    score: total
  };
}

/**
 * 剩余牌质量快速估算：用于波束搜索中评估部分解的"未来潜力"。
 * - 控牌加分：大小王(+3/+2)、百搭(+2)、A(+1)
 * - 结构加分：4张同rank(+8，炸弹潜力)、3张(+3)、2张(+1)
 * - 孤张低牌扣分：rank值<8 的单张(-1)
 */
function remainingQualityEstimate(remaining, trumpRank) {
  if (remaining.length === 0) return 0;

  const rankCounts = new Map();
  let controlBonus = 0;

  for (const card of remaining) {
    const rank = card.rank;
    rankCounts.set(rank, (rankCounts.get(rank) || 0) + 1);

    // 控牌加分
    if (rank === 'BJ') controlBonus += 3;
    else if (rank === 'SJ') controlBonus += 2;
    else if (isWildcardCard(card, trumpRank)) controlBonus += 2;
    else if (rank === 'A') controlBonus += 1;
  }

  let structureBonus = 0;
  let isolatedLow = 0;

  for (const [rank, count] of rankCounts.entries()) {
    if (count >= 4) {
      structureBonus += 8; // 炸弹潜力
    } else if (count === 3) {
      structureBonus += 3;
    } else if (count === 2) {
      structureBonus += 1;
    } else if (count === 1) {
      const rv = rankValue(rank);
      if (rv < 8 && rank !== 'BJ' && rank !== 'SJ') {
        isolatedLow += 1;
      }
    }
  }

  return structureBonus + controlBonus - isolatedLow;
}

function countSplitBombCards(combos, bombProtection) {
  if (!bombProtection || bombProtection.protectedIds.size === 0) {
    return {
      splitBombCards: 0,
      fireComboCount: 0
    };
  }

  let splitBombCards = 0;
  let fireComboCount = 0;
  for (const combo of combos) {
    if (isFireCombo(combo.type)) {
      fireComboCount += 1;
      continue;
    }
    for (const card of combo.cards || []) {
      if (bombProtection.protectedIds.has(card.id)) {
        splitBombCards += 1;
      }
    }
  }

  return {
    splitBombCards,
    fireComboCount
  };
}

function buildSchemeResult(combos, trumpRank, bombProtection) {
  const scored = scoreScheme(combos, trumpRank);
  const protectionView = countSplitBombCards(combos, bombProtection);

  return {
    combos: cloneComboList(combos),
    score: scored.total,
    detail: scored.detail,
    comboBreakdown: scored.comboBreakdown,
    splitBombCards: protectionView.splitBombCards,
    fireComboCount: protectionView.fireComboCount,
    signature: schemeKey(combos)
  };
}

function toPublicResult(result) {
  return {
    combos: cloneComboList(result.combos),
    score: result.score,
    detail: { ...result.detail },
    comboBreakdown: result.comboBreakdown.map((item) => ({ ...item })),
    splitBombCards: result.splitBombCards,
    fireComboCount: result.fireComboCount
  };
}

export function compareSchemeResult(a, b) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  const aScore = Number.isFinite(a.score) ? a.score : Number.NEGATIVE_INFINITY;
  const bScore = Number.isFinite(b.score) ? b.score : Number.NEGATIVE_INFINITY;
  if (aScore !== bScore) {
    return bScore - aScore;
  }

  const aHands = a.detail?.handCount ?? Number.POSITIVE_INFINITY;
  const bHands = b.detail?.handCount ?? Number.POSITIVE_INFINITY;
  if (aHands !== bHands) {
    return aHands - bHands;
  }

  const aSplit = Number.isFinite(a.splitBombCards) ? a.splitBombCards : Number.POSITIVE_INFINITY;
  const bSplit = Number.isFinite(b.splitBombCards) ? b.splitBombCards : Number.POSITIVE_INFINITY;
  if (aSplit !== bSplit) {
    return aSplit - bSplit;
  }

  const aFire = Number.isFinite(a.fireComboCount) ? a.fireComboCount : Number.NEGATIVE_INFINITY;
  const bFire = Number.isFinite(b.fireComboCount) ? b.fireComboCount : Number.NEGATIVE_INFINITY;
  if (aFire !== bFire) {
    return bFire - aFire;
  }

  const aBurst = a.detail?.burstScore ?? Number.NEGATIVE_INFINITY;
  const bBurst = b.detail?.burstScore ?? Number.NEGATIVE_INFINITY;
  if (aBurst !== bBurst) {
    return bBurst - aBurst;
  }

  const aShape = a.detail?.shapeScore ?? Number.NEGATIVE_INFINITY;
  const bShape = b.detail?.shapeScore ?? Number.NEGATIVE_INFINITY;
  if (aShape !== bShape) {
    return bShape - aShape;
  }

  const aKey = a.detail?.keyScore ?? Number.NEGATIVE_INFINITY;
  const bKey = b.detail?.keyScore ?? Number.NEGATIVE_INFINITY;
  if (aKey !== bKey) {
    return bKey - aKey;
  }

  const aSig = a.signature || schemeKey(a.combos || []);
  const bSig = b.signature || schemeKey(b.combos || []);
  return aSig.localeCompare(bSig);
}

function pushTopResult(topResults, topSeen, candidate, topK) {
  if (!candidate) return;
  const signature = candidate.signature;
  if (!signature) return;

  const existingIndex = topResults.findIndex((item) => item.signature === signature);
  if (existingIndex >= 0) {
    if (compareSchemeResult(candidate, topResults[existingIndex]) < 0) {
      topResults[existingIndex] = candidate;
      topResults.sort(compareSchemeResult);
    }
    return;
  }

  topResults.push(candidate);
  topSeen.add(signature);
  topResults.sort(compareSchemeResult);

  if (topResults.length > topK) {
    const removed = topResults.pop();
    if (removed) {
      topSeen.delete(removed.signature);
    }
  }
}

/**
 * 波束搜索（Beam Search）：
 * 维护 beamWidth 个最优部分解，逐层展开。每一层：
 * 1. 对每个活跃状态（还有剩余牌），生成候选牌型
 * 2. 每个状态只展开 top-expandLimit 个候选（控制搜索宽度）
 * 3. 按 beamScore 排序后保留 top-beamWidth 个进入下一层
 * 4. 超时保护：检测到超时后立即停止展开，将未完成状态用贪心补全
 * 返回 { results: 完整方案列表, searchNodes: 展开节点数, timedOut: 是否超时 }
 */
function beamSearch(sorted, trumpRank, bombProtection, options) {
  const maxBranch = options.maxBranch || DEFAULT_MAX_BRANCH;
  const beamWidth = options.beamWidth || Math.max(8, Math.floor(maxBranch * 0.6));
  const deadline = options.deadline;

  // 每个 beam state: { combos, remaining, partialScore }
  let beam = [
    {
      combos: [],
      remaining: sorted,
      partialScore: 0
    }
  ];

  let searchNodes = 0;
  let timedOut = false;

  while (beam.length > 0) {
    if (deadline && nowMs() > deadline) {
      timedOut = true;
      break;
    }

    // 找到还有剩余牌的 state
    const activeBeam = beam.filter((state) => state.remaining.length > 0);
    const completedBeam = beam.filter((state) => state.remaining.length === 0);

    if (activeBeam.length === 0) {
      beam = completedBeam;
      break;
    }

    const nextCandidates = [];

    for (const state of activeBeam) {
      if (deadline && nowMs() > deadline) {
        timedOut = true;
        // 将未完成的状态也保留，用贪心补全
        nextCandidates.push(state);
        continue;
      }

      searchNodes += 1;
      const candidates = generateCandidates(state.remaining, trumpRank, maxBranch, bombProtection);

      // 只展开 top 几个候选（限制分支宽度）
      const expandLimit = Math.min(candidates.length, Math.max(3, Math.ceil(beamWidth / 2)));
      for (let i = 0; i < expandLimit; i += 1) {
        const candidate = candidates[i];
        const nextRemaining = removeCards(state.remaining, candidate.cards);
        const nextPartial = state.partialScore + candidate.component.total;
        // 快速估算剩余质量用于排序
        const quality = remainingQualityEstimate(nextRemaining, trumpRank);

        nextCandidates.push({
          combos: [...state.combos, cloneCombo(candidate)],
          remaining: nextRemaining,
          partialScore: nextPartial,
          // 综合评估分: 部分得分 + 剩余质量估算 + 轮次修正预估
          beamScore:
            nextPartial +
            quality * 0.5 +
            roundCorrection(state.combos.length + 1 + Math.ceil(nextRemaining.length / 4)) * 0.3
        });
      }
    }

    if (timedOut) {
      // 合并已完成和未完成的
      beam = [...completedBeam, ...nextCandidates];
      break;
    }

    // 保留 top beamWidth 个 + 已完成的
    nextCandidates.sort((a, b) => (b.beamScore || 0) - (a.beamScore || 0));
    beam = [...completedBeam, ...nextCandidates.slice(0, beamWidth)];
  }

  // 对未完成的状态用贪心补全
  const results = [];
  for (const state of beam) {
    let finalCombos = state.combos;
    if (state.remaining.length > 0) {
      const greedy = greedyBaseline(state.remaining, trumpRank, maxBranch, bombProtection);
      finalCombos = [...state.combos, ...greedy.combos];
    }
    const result = buildSchemeResult(finalCombos, trumpRank, bombProtection);
    results.push(result);
  }

  return { results, searchNodes, timedOut };
}

/**
 * 整体搜索流程：
 * 1. 对手牌按排序值排序
 * 2. 构建炸弹保护信息（哪些牌参与潜在炸弹）
 * 3. 先用贪心基线得到初始解
 * 4. 再用波束搜索寻找更优解
 * 5. 合并去重后返回 topK 方案，附带超时/耗时/搜索节点等元信息
 */
export function solveBestScheme(cards, trumpRank, options = {}) {
  const startAt = nowMs();
  const timeLimitMs = options.timeLimitMs ?? DEFAULT_TIME_LIMIT;
  const maxBranch = options.maxBranch ?? DEFAULT_MAX_BRANCH;
  const topK = Math.max(1, Math.min(10, Math.floor(options.topK ?? DEFAULT_TOP_K)));
  const targetScore = typeof options.targetScore === 'number' ? options.targetScore : null;
  const stopAfterSurpass = Boolean(options.stopAfterSurpass) && targetScore !== null;
  const beamWidth = options.beamWidth || Math.max(8, Math.floor(maxBranch * 0.6));
  const deadline = startAt + timeLimitMs;

  const sorted = [...cards].sort(
    (a, b) => cardSortValue(a, trumpRank) - cardSortValue(b, trumpRank)
  );
  if (sorted.length === 0) {
    const empty = {
      combos: [],
      score: 0,
      detail: {
        shapeScore: 0,
        burstScore: 0,
        keyScore: 0,
        roundScore: 0,
        handCount: 0
      },
      comboBreakdown: [],
      splitBombCards: 0,
      fireComboCount: 0
    };
    return {
      ...empty,
      timedOut: false,
      elapsedMs: 0,
      exact: true,
      stopReason: 'completed',
      surpassedTarget: false,
      searchNodes: 0,
      topResults: [empty],
      alternatives: []
    };
  }

  const bombProtection = buildBombProtection(sorted);

  // 贪心基线作为初始上界
  const baseline = greedyBaseline(sorted, trumpRank, maxBranch, bombProtection);
  const topSeen = new Set();
  const topResults = [];
  const baselineResult = buildSchemeResult(baseline.combos, trumpRank, bombProtection);
  pushTopResult(topResults, topSeen, baselineResult, topK);

  let timedOut = false;
  let surpassedTarget = targetScore !== null && baselineResult.score > targetScore;
  let searchNodes = 0;

  // 波束搜索
  if (!surpassedTarget || !stopAfterSurpass) {
    const beamResult = beamSearch(sorted, trumpRank, bombProtection, {
      maxBranch,
      beamWidth,
      deadline
    });

    searchNodes += beamResult.searchNodes;
    timedOut = beamResult.timedOut;

    for (const result of beamResult.results) {
      pushTopResult(topResults, topSeen, result, topK);
      if (targetScore !== null && result.score > targetScore) {
        surpassedTarget = true;
      }
    }
  }

  const elapsedMs = Math.round(nowMs() - startAt);
  const finalTop = topResults.length > 0 ? topResults : [baselineResult];
  const publicTop = finalTop.map((item) => toPublicResult(item));
  const best = publicTop[0];

  return {
    ...best,
    timedOut,
    elapsedMs,
    exact: !timedOut,
    stopReason: timedOut ? 'timeout' : surpassedTarget ? 'target-surpassed' : 'completed',
    surpassedTarget,
    searchNodes,
    topResults: publicTop,
    alternatives: publicTop.slice(1)
  };
}
