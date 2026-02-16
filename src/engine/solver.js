import { cardSortValue, isJoker, isWildcardCard, STANDARD_RANKS } from './cards.js';
import { COMBO_LABELS, comboPriority, detectComboTypes, isFireCombo } from './combos.js';
import { roundCorrection, scoreComboNoRound, scoreScheme } from './scoring.js';

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
      remaining.filter(
        (card) => !isJoker(card) && cyclicRankDistance(card.rank, anchor.rank) <= 4
      )
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
  return [combo.type, cardKey, combo.mainRank || '', combo.sequence ? combo.sequence.join('-') : '', combo.suit || '', combo.tripleRank || '', combo.pairRank || ''].join('|');
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

function candidateEstimate(combo, component, bombProtection) {
  const splitPenalty = splitBombPenalty(combo, bombProtection);
  return component.total * 8 + combo.cards.length * 2 + comboPriority(combo.type) - splitPenalty;
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
        const estimate = candidateEstimate(combo, component, bombProtection);

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
        estimate: candidateEstimate(fallback, component, bombProtection)
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

function stateKey(remaining, comboCount) {
  return `${comboCount}|${remaining.map((card) => card.id).join('.')}`;
}

function theoreticalUpperBound(partialScore, remainCount, minHandsPossible) {
  let roundUpper = 0;
  if (minHandsPossible <= 8) {
    roundUpper = roundCorrection(minHandsPossible);
  } else if (minHandsPossible > 10) {
    roundUpper = roundCorrection(minHandsPossible);
  }
  return partialScore + remainCount * 4 + roundUpper + 12;
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

  const aHands = a.detail?.handCount ?? Number.POSITIVE_INFINITY;
  const bHands = b.detail?.handCount ?? Number.POSITIVE_INFINITY;
  if (aHands !== bHands) {
    return aHands - bHands;
  }

  const aScore = Number.isFinite(a.score) ? a.score : Number.NEGATIVE_INFINITY;
  const bScore = Number.isFinite(b.score) ? b.score : Number.NEGATIVE_INFINITY;
  if (aScore !== bScore) {
    return bScore - aScore;
  }

  const aSplit = Number.isFinite(a.splitBombCards)
    ? a.splitBombCards
    : Number.POSITIVE_INFINITY;
  const bSplit = Number.isFinite(b.splitBombCards)
    ? b.splitBombCards
    : Number.POSITIVE_INFINITY;
  if (aSplit !== bSplit) {
    return aSplit - bSplit;
  }

  const aFire = Number.isFinite(a.fireComboCount)
    ? a.fireComboCount
    : Number.NEGATIVE_INFINITY;
  const bFire = Number.isFinite(b.fireComboCount)
    ? b.fireComboCount
    : Number.NEGATIVE_INFINITY;
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

export function solveBestScheme(cards, trumpRank, options = {}) {
  const startAt = nowMs();
  const timeLimitMs = options.timeLimitMs ?? DEFAULT_TIME_LIMIT;
  const maxBranch = options.maxBranch ?? DEFAULT_MAX_BRANCH;
  const topK = Math.max(1, Math.min(10, Math.floor(options.topK ?? DEFAULT_TOP_K)));
  const targetScore =
    typeof options.targetScore === 'number' ? options.targetScore : null;
  const stopAfterSurpass =
    Boolean(options.stopAfterSurpass) && targetScore !== null;
  const deadline = startAt + timeLimitMs;

  const sorted = [...cards].sort((a, b) => cardSortValue(a, trumpRank) - cardSortValue(b, trumpRank));
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
  const baseline = greedyBaseline(sorted, trumpRank, maxBranch, bombProtection);
  const topSeen = new Set();
  const topResults = [];
  const baselineResult = buildSchemeResult(baseline.combos, trumpRank, bombProtection);
  pushTopResult(topResults, topSeen, baselineResult, topK);

  let timedOut = false;
  let stoppedAfterTarget = false;
  let surpassedTarget = targetScore !== null && baselineResult.score > targetScore;
  let searchNodes = 0;

  const memo = new Map();
  const current = [];

  const dfs = (remaining, partialScore) => {
    if (stoppedAfterTarget || timedOut) {
      return;
    }
    searchNodes += 1;

    if (nowMs() > deadline) {
      timedOut = true;
      return;
    }

    if (remaining.length === 0) {
      const evaluated = buildSchemeResult(current, trumpRank, bombProtection);
      pushTopResult(topResults, topSeen, evaluated, topK);

      if (targetScore !== null && evaluated.score > targetScore) {
        surpassedTarget = true;
        if (stopAfterSurpass) {
          stoppedAfterTarget = true;
        }
      }
      return;
    }

    const bestResult = topResults[0] || baselineResult;
    const minHandsPossible = current.length + Math.ceil(remaining.length / MAX_COMBO_SIZE);
    if (bestResult && minHandsPossible > bestResult.detail.handCount) {
      return;
    }

    const optimistic = theoreticalUpperBound(partialScore, remaining.length, minHandsPossible);
    if (bestResult && minHandsPossible === bestResult.detail.handCount && optimistic < bestResult.score) {
      return;
    }

    const key = stateKey(remaining, current.length);
    const seen = memo.get(key);
    if (seen !== undefined && seen >= partialScore) {
      return;
    }
    memo.set(key, partialScore);

    const candidates = generateCandidates(remaining, trumpRank, maxBranch, bombProtection);
    for (const candidate of candidates) {
      if (stoppedAfterTarget || timedOut) {
        return;
      }
      if (nowMs() > deadline) {
        timedOut = true;
        return;
      }

      const nextRemaining = removeCards(remaining, candidate.cards);
      current.push(cloneCombo(candidate));
      dfs(nextRemaining, partialScore + candidate.component.total);
      current.pop();

      if (timedOut || stoppedAfterTarget) {
        return;
      }
    }
  };

  dfs(sorted, 0);

  const elapsedMs = Math.round(nowMs() - startAt);
  const finalTop = topResults.length > 0 ? topResults : [baselineResult];
  const publicTop = finalTop.map((item) => toPublicResult(item));
  const best = publicTop[0];

  return {
    ...best,
    timedOut,
    elapsedMs,
    exact: !timedOut && !stoppedAfterTarget,
    stopReason: timedOut
      ? 'timeout'
      : stoppedAfterTarget
      ? 'target-surpassed'
      : 'completed',
    surpassedTarget,
    searchNodes,
    topResults: publicTop,
    alternatives: publicTop.slice(1)
  };
}
