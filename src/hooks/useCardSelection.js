// 选牌逻辑 Hook
import { useMemo, useState } from 'react';
import { comboKey, createCombo, detectComboTypes } from '../engine/combos.js';
import { MATRIX_RANKS } from './gameStateConstants.js';
import { pickAutoTriple, pickAutoPair } from './autoComplete.js';

export function useCardSelection({ trumpRank, dealtCards, isSolving, clearScoringResult, setNotice }) {
  const [userCombos, setUserCombos] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedTypeIndex, setSelectedTypeIndex] = useState(0);

  // --- 计算属性 ---
  const usedIdSet = useMemo(() => {
    const set = new Set();
    for (const combo of userCombos) {
      for (const card of combo.cards) {
        set.add(card.id);
      }
    }
    return set;
  }, [userCombos]);

  const remainingCards = useMemo(
    () => dealtCards.filter((card) => !usedIdSet.has(card.id)),
    [dealtCards, usedIdSet]
  );

  const selectedCards = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return remainingCards.filter((card) => selectedSet.has(card.id));
  }, [remainingCards, selectedIds]);

  const candidateTypes = useMemo(
    () => detectComboTypes(selectedCards, trumpRank),
    [selectedCards, trumpRank]
  );

  const userComboKeySet = useMemo(
    () => new Set(userCombos.map((combo) => comboKey(combo))),
    [userCombos]
  );

  const assignedCardsCount = dealtCards.length - remainingCards.length;

  const matrixCounts = useMemo(() => {
    const counts = {};
    for (const card of remainingCards) {
      if (!MATRIX_RANKS.includes(card.rank)) continue;
      if (!['S', 'H', 'C', 'D'].includes(card.suit)) continue;
      const key = `${card.suit}-${card.rank}`;
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [remainingCards]);

  const rankTotals = useMemo(() => {
    const totals = {};
    for (const rank of MATRIX_RANKS) {
      totals[rank] = 0;
    }
    for (const card of remainingCards) {
      if (MATRIX_RANKS.includes(card.rank)) {
        totals[card.rank] += 1;
      }
    }
    return totals;
  }, [remainingCards]);

  const jokersRemain = useMemo(
    () => remainingCards.filter((card) => card.rank === 'SJ' || card.rank === 'BJ').length,
    [remainingCards]
  );

  const wildcardRemain = useMemo(
    () => remainingCards.filter((card) => card.suit === 'H' && card.rank === trumpRank).length,
    [remainingCards, trumpRank]
  );

  // --- 操作方法 ---
  function toggleCard(cardId) {
    if (isSolving) return;
    clearScoringResult();
    setSelectedIds((prev) => {
      if (prev.includes(cardId)) {
        return prev.filter((id) => id !== cardId);
      }
      return [...prev, cardId];
    });
  }

  function removeGroup(index) {
    if (isSolving) return;
    clearScoringResult();
    setUserCombos((prev) => prev.filter((_, i) => i !== index));
  }

  function confirmGroup() {
    if (isSolving) return;
    if (selectedCards.length === 0) {
      setNotice('请先选择要成组的牌。');
      return;
    }

    if (candidateTypes.length === 0) {
      setNotice('当前选择无法组成合法牌型。');
      return;
    }

    const picked = candidateTypes[selectedTypeIndex] || candidateTypes[0];
    const combo = createCombo(selectedCards, trumpRank, picked);

    if (!combo) {
      setNotice('成组失败，请重新选择。');
      return;
    }

    clearScoringResult();
    setUserCombos((prev) => [...prev, combo]);
    setSelectedIds([]);
  }

  function resetSelection() {
    if (isSolving) return;
    setSelectedIds([]);
  }

  function autoCompleteRemaining(submitScoringFn, aiResult) {
    if (isSolving) return Promise.resolve();
    if (remainingCards.length === 0) {
      if (aiResult) {
        setNotice('当前已完成组牌并给出 AI 推荐。');
        return Promise.resolve();
      }
      return submitScoringFn();
    }

    clearScoringResult();
    const pool = [...remainingCards];
    const generated = [];
    let tripleCount = 0;
    let pairCount = 0;

    while (pool.length >= 3) {
      const nextTriple = pickAutoTriple(pool, trumpRank);
      if (!nextTriple) break;

      const tripleCards = [pool[nextTriple.i], pool[nextTriple.j], pool[nextTriple.k]];
      const tripleCombo = createCombo(tripleCards, trumpRank, nextTriple.definition);
      if (!tripleCombo || tripleCombo.type !== 'triple') break;

      generated.push(tripleCombo);
      tripleCount += 1;
      pool.splice(nextTriple.k, 1);
      pool.splice(nextTriple.j, 1);
      pool.splice(nextTriple.i, 1);
    }

    while (pool.length >= 2) {
      const nextPair = pickAutoPair(pool, trumpRank);
      if (!nextPair) break;

      const pairCards = [pool[nextPair.i], pool[nextPair.j]];
      const pairCombo = createCombo(pairCards, trumpRank, nextPair.definition);
      if (!pairCombo || pairCombo.type !== 'pair') break;

      generated.push(pairCombo);
      pairCount += 1;
      pool.splice(nextPair.j, 1);
      pool.splice(nextPair.i, 1);
    }

    let singleCount = 0;
    for (const card of pool) {
      const singleCombo = createCombo([card], trumpRank, 'single');
      if (!singleCombo) continue;
      generated.push(singleCombo);
      singleCount += 1;
    }

    if (generated.length === 0) {
      setNotice('自动补全失败，请手动完成组牌。');
      return Promise.resolve();
    }

    setUserCombos((prev) => [...prev, ...generated]);
    setSelectedIds([]);
    setSelectedTypeIndex(0);
    setNotice(
      `已自动补全：${tripleCount} 个三张，${pairCount} 个对子，${singleCount} 张单牌。正在提交并生成 AI 推荐。`
    );
    return Promise.resolve();
  }

  function resetCardState() {
    setUserCombos([]);
    setSelectedIds([]);
    setSelectedTypeIndex(0);
  }

  return {
    userCombos,
    setUserCombos,
    selectedIds,
    setSelectedIds,
    selectedTypeIndex,
    setSelectedTypeIndex,
    usedIdSet,
    remainingCards,
    selectedCards,
    candidateTypes,
    userComboKeySet,
    assignedCardsCount,
    matrixCounts,
    rankTotals,
    jokersRemain,
    wildcardRemain,
    toggleCard,
    removeGroup,
    confirmGroup,
    resetSelection,
    autoCompleteRemaining,
    resetCardState
  };
}
