import { useEffect, useMemo, useRef, useState } from 'react';
import { createDeal } from '../engine/cards.js';
import {
  comboKey,
  createCombo,
  detectComboTypes
} from '../engine/combos.js';
import { scoreScheme } from '../engine/scoring.js';
import { solveBestScheme } from '../engine/solver.js';
import { DataService } from '../services/dataService.js';
import { useWorker } from './useWorker.js';

const MATRIX_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/**
 * 游戏核心状态管理 Hook
 * 包含所有状态变量、计算属性、和操作方法
 */
export function useGameState() {
  // --- 基本状态 ---
  const [trumpRank, setTrumpRank] = useState('2');
  const [dealtCards, setDealtCards] = useState([]);
  const [userCombos, setUserCombos] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedTypeIndex, setSelectedTypeIndex] = useState(0);

  const [userScore, setUserScore] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [aiStatus, setAiStatus] = useState('idle');

  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [notice, setNotice] = useState('');

  const importInputRef = useRef(null);
  const { runAiSearchWithWorker } = useWorker();

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

  const aiComboKeySet = useMemo(
    () => new Set((aiResult?.combos || []).map((combo) => comboKey(combo))),
    [aiResult]
  );

  const isSolving = aiStatus === 'running';
  const assignedCardsCount = dealtCards.length - remainingCards.length;
  const canAnalyze = assignedCardsCount === 27 && !isSolving;

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

  const aiScoreView = aiResult
    ? { total: aiResult.score, detail: aiResult.detail }
    : null;

  // --- 副作用 ---
  useEffect(() => {
    setSelectedTypeIndex(0);
  }, [selectedIds]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // --- 操作方法 ---
  async function refreshHistoryAndStats() {
    const [nextHistory, nextStats] = await Promise.all([
      DataService.getHistory(20),
      DataService.getStats()
    ]);
    setHistory(nextHistory);
    setStats(nextStats);
  }

  function resetRoundState(nextCards, nextTrumpRank) {
    setTrumpRank(nextTrumpRank);
    setDealtCards(nextCards);
    setUserCombos([]);
    setSelectedIds([]);
    setSelectedTypeIndex(0);
    setUserScore(null);
    setAiResult(null);
    setAiStatus('idle');
  }

  function startNewDeal() {
    if (isSolving) {
      setNotice('AI 计算中，请等待当前分析完成。');
      return;
    }
    const deal = createDeal();
    resetRoundState(deal.dealtCards, deal.trumpRank);
    setNotice(`新牌局已开始，当前打几：${deal.trumpRank}`);
  }

  useEffect(() => {
    startNewDeal();
    refreshHistoryAndStats().catch(() => {
      setNotice('历史数据加载失败');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearScoringResult() {
    setUserScore(null);
    setAiResult(null);
    setAiStatus('idle');
  }

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

  async function submitScoring() {
    if (isSolving) {
      setNotice('专家正在计算中，请勿重复提交。');
      return;
    }

    if (remainingCards.length > 0) {
      setNotice(`还有 ${remainingCards.length} 张牌未分配，请完成全部 27 张组牌。`);
      return;
    }

    const userScoreResult = scoreScheme(userCombos, trumpRank);
    setUserScore(userScoreResult);
    setAiStatus('running');

    let ai;
    let usedFallback = false;

    try {
      ai = await runAiSearchWithWorker(dealtCards, trumpRank);
    } catch (error) {
      usedFallback = true;
      ai = solveBestScheme(dealtCards, trumpRank, { timeLimitMs: 2600 });
    }

    setAiResult(ai);
    setAiStatus('done');

    const gameRecord = {
      id: `g-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      timestamp: Date.now(),
      trumpRank,
      dealtCards,
      userCombos,
      userScore: userScoreResult.total,
      userScoreDetail: userScoreResult.detail,
      aiCombos: ai.combos,
      aiScore: ai.score,
      aiScoreDetail: ai.detail,
      isOptimal: userScoreResult.total === ai.score
    };

    try {
      await DataService.saveGame(gameRecord);
      await refreshHistoryAndStats();
      setNotice(
        usedFallback
          ? 'AI Worker 异常，已使用主线程降级计算并保存本局。'
          : '本局已保存。'
      );
    } catch (error) {
      setNotice('本局评分完成，但保存历史失败。');
    }
  }

  async function exportHistory() {
    try {
      const content = await DataService.exportData();
      const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `guandan-history-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice('已导出历史数据。');
    } catch (error) {
      setNotice('导出失败。');
    }
  }

  function openImportDialog() {
    importInputRef.current?.click();
  }

  async function importHistory(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const count = await DataService.importData(text);
      await refreshHistoryAndStats();
      setNotice(`导入完成，处理 ${count} 条记录。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '导入失败。');
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  }

  return {
    trumpRank,
    dealtCards,
    userCombos,
    selectedIds,
    selectedTypeIndex,
    setSelectedTypeIndex,
    userScore,
    aiResult,
    aiStatus,
    history,
    stats,
    notice,
    importInputRef,
    remainingCards,
    selectedCards,
    candidateTypes,
    userComboKeySet,
    aiComboKeySet,
    isSolving,
    assignedCardsCount,
    canAnalyze,
    matrixCounts,
    rankTotals,
    jokersRemain,
    wildcardRemain,
    aiScoreView,
    startNewDeal,
    toggleCard,
    removeGroup,
    confirmGroup,
    resetSelection,
    submitScoring,
    exportHistory,
    openImportDialog,
    importHistory,
  };
}
