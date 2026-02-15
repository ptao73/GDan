import { cardSortValue, isJoker, isWildcardCard, STANDARD_RANKS } from './cards.js';
import { COMBO_LABELS, comboPriority, detectComboTypes } from './combos.js';
import { roundCorrection, scoreComboNoRound, scoreScheme } from './scoring.js';

const MAX_COMBO_SIZE = 8;
const DEFAULT_TIME_LIMIT = 3000;
const DEFAULT_MAX_BRANCH = 24;
const MAX_POOL_SIZE = 13;

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

function generateCandidates(remaining, trumpRank, maxBranch) {
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
        const estimate = component.total * 8 + combo.cards.length * 2 + comboPriority(combo.type);

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
    return [{ ...fallback, component, estimate: component.total }];
  }

  return candidates.slice(0, maxBranch);
}

function greedyBaseline(cards, trumpRank, maxBranch) {
  let remaining = [...cards];
  const combos = [];
  let partial = 0;

  while (remaining.length > 0) {
    const candidates = generateCandidates(remaining, trumpRank, maxBranch);
    const picked = candidates[0];
    combos.push(cloneCombo(picked));
    partial += picked.component.total;
    remaining = removeCards(remaining, picked.cards);
  }

  const total = partial + roundCorrection(combos.length);
  return {
    combos,
    score: total
  };
}

function stateKey(remaining, comboCount) {
  return `${comboCount}|${remaining.map((card) => card.id).join('.')}`;
}

function theoreticalUpperBound(partialScore, remainCount) {
  return partialScore + remainCount * 4 + 12;
}

export function solveBestScheme(cards, trumpRank, options = {}) {
  const startAt = nowMs();
  const timeLimitMs = options.timeLimitMs ?? DEFAULT_TIME_LIMIT;
  const maxBranch = options.maxBranch ?? DEFAULT_MAX_BRANCH;
  const deadline = startAt + timeLimitMs;

  const sorted = [...cards].sort((a, b) => cardSortValue(a, trumpRank) - cardSortValue(b, trumpRank));

  const baseline = greedyBaseline(sorted, trumpRank, maxBranch);
  let bestScore = baseline.score;
  let bestCombos = cloneComboList(baseline.combos);
  let timedOut = false;

  const memo = new Map();
  const current = [];

  const dfs = (remaining, partialScore) => {
    if (nowMs() > deadline) {
      timedOut = true;
      return;
    }

    if (remaining.length === 0) {
      const total = partialScore + roundCorrection(current.length);
      if (total > bestScore) {
        bestScore = total;
        bestCombos = cloneComboList(current);
      }
      return;
    }

    const optimistic = theoreticalUpperBound(partialScore, remaining.length);
    if (optimistic <= bestScore) {
      return;
    }

    const key = stateKey(remaining, current.length);
    const seen = memo.get(key);
    if (seen !== undefined && seen >= partialScore) {
      return;
    }
    memo.set(key, partialScore);

    const candidates = generateCandidates(remaining, trumpRank, maxBranch);
    for (const candidate of candidates) {
      if (nowMs() > deadline) {
        timedOut = true;
        return;
      }

      const nextRemaining = removeCards(remaining, candidate.cards);
      current.push(cloneCombo(candidate));
      dfs(nextRemaining, partialScore + candidate.component.total);
      current.pop();

      if (timedOut) {
        return;
      }
    }
  };

  dfs(sorted, 0);

  const elapsedMs = Math.round(nowMs() - startAt);
  const scored = scoreScheme(bestCombos, trumpRank);

  return {
    combos: bestCombos,
    score: scored.total,
    detail: scored.detail,
    comboBreakdown: scored.comboBreakdown,
    timedOut,
    elapsedMs,
    exact: !timedOut
  };
}
