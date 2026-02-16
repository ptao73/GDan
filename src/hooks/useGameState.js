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
const AI_MODE_STORAGE_KEY = 'guandan-ai-search-mode';
const AI_SEARCH_MODE_OPTIONS = [
  {
    value: 'fast',
    label: '速度优先',
    description: '更快返回结果，适合频繁训练'
  },
  {
    value: 'balanced',
    label: '均衡',
    description: '速度与质量折中（推荐）'
  },
  {
    value: 'quality',
    label: '质量优先',
    description: '更深搜索，耗时更长'
  }
];
const AI_MODE_LABEL_MAP = Object.fromEntries(
  AI_SEARCH_MODE_OPTIONS.map((item) => [item.value, item.label])
);
const AI_SEARCH_PROFILES_BY_MODE = {
  fast: [
    { mode: 'worker', timeLimitMs: 1800, maxBranch: 18 },
    { mode: 'worker', timeLimitMs: 2600, maxBranch: 22 },
    { mode: 'local', timeLimitMs: 3200, maxBranch: 24 }
  ],
  balanced: [
    { mode: 'worker', timeLimitMs: 3000, maxBranch: 24 },
    { mode: 'worker', timeLimitMs: 4500, maxBranch: 30 },
    { mode: 'worker', timeLimitMs: 6000, maxBranch: 36 },
    { mode: 'local', timeLimitMs: 6500, maxBranch: 34 },
    { mode: 'local', timeLimitMs: 9000, maxBranch: 44 }
  ],
  quality: [
    { mode: 'worker', timeLimitMs: 4500, maxBranch: 30 },
    { mode: 'worker', timeLimitMs: 7000, maxBranch: 38 },
    { mode: 'worker', timeLimitMs: 9500, maxBranch: 46 },
    { mode: 'local', timeLimitMs: 10000, maxBranch: 44 },
    { mode: 'local', timeLimitMs: 13000, maxBranch: 52 }
  ]
};

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
  const [aiSearchMode, setAiSearchMode] = useState('balanced');
  const [primaryActionMode, setPrimaryActionMode] = useState('deal');

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
  const primaryActionLabel = primaryActionMode === 'deal' ? '新开局' : 'AI分析';
  const primaryActionDisabled = isSolving || (primaryActionMode === 'analyze' && !canAnalyze);

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
  const aiHasRecommendation = Boolean(
    aiResult && userScore && aiResult.score > userScore.total
  );
  const aiSearchModeLabel = AI_MODE_LABEL_MAP[aiSearchMode] || AI_MODE_LABEL_MAP.balanced;

  // --- 副作用 ---
  useEffect(() => {
    setSelectedTypeIndex(0);
  }, [selectedIds]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(AI_MODE_STORAGE_KEY);
      if (saved && AI_SEARCH_PROFILES_BY_MODE[saved]) {
        setAiSearchMode(saved);
      }
    } catch (error) {
      // Ignore storage failures in privacy-restricted environments.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(AI_MODE_STORAGE_KEY, aiSearchMode);
    } catch (error) {
      // Ignore storage failures in privacy-restricted environments.
    }
  }, [aiSearchMode]);

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

  function handleChangeAiSearchMode(nextMode) {
    if (isSolving) {
      setNotice('AI 正在计算中，暂不可切换搜索档位。');
      return;
    }
    if (!AI_SEARCH_PROFILES_BY_MODE[nextMode]) {
      return;
    }
    setAiSearchMode(nextMode);
    setNotice(`已切换 AI 搜索档位：${AI_MODE_LABEL_MAP[nextMode]}`);
  }

  async function findAiRecommendation(targetScore, profiles, modeKey) {
    let bestResult = null;
    let usedFallback = false;
    let attemptCount = 0;

    for (const profile of profiles) {
      attemptCount += 1;

      let result = null;
      if (profile.mode === 'worker') {
        try {
          result = await runAiSearchWithWorker(dealtCards, trumpRank, {
            timeLimitMs: profile.timeLimitMs,
            maxBranch: profile.maxBranch
          });
        } catch (error) {
          usedFallback = true;
          result = solveBestScheme(dealtCards, trumpRank, {
            timeLimitMs: Math.max(2200, profile.timeLimitMs - 400),
            maxBranch: profile.maxBranch
          });
        }
      } else {
        result = solveBestScheme(dealtCards, trumpRank, {
          timeLimitMs: profile.timeLimitMs,
          maxBranch: profile.maxBranch
        });
      }

      if (!bestResult || result.score > bestResult.score) {
        bestResult = result;
      }

      if (result.score > targetScore) {
        return {
          ai: {
            ...result,
            searchAttempts: attemptCount,
            surpassedUser: true,
            searchMode: modeKey,
            searchModeLabel: AI_MODE_LABEL_MAP[modeKey] || AI_MODE_LABEL_MAP.balanced
          },
          usedFallback
        };
      }
    }

    return {
      ai: {
        ...(bestResult || solveBestScheme(dealtCards, trumpRank, { timeLimitMs: 3000 })),
        searchAttempts: attemptCount,
        surpassedUser: false,
        searchMode: modeKey,
        searchModeLabel: AI_MODE_LABEL_MAP[modeKey] || AI_MODE_LABEL_MAP.balanced
      },
      usedFallback
    };
  }

  async function submitScoring() {
    if (isSolving) {
      setNotice('专家正在计算中，请勿重复提交。');
      return false;
    }

    if (remainingCards.length > 0) {
      setNotice(`还有 ${remainingCards.length} 张牌未分配，请完成全部 27 张组牌。`);
      return false;
    }

    try {
      const userScoreResult = scoreScheme(userCombos, trumpRank);
      setUserScore(userScoreResult);
      setAiStatus('running');

      const modeKey = aiSearchMode;
      const profiles =
        AI_SEARCH_PROFILES_BY_MODE[modeKey] || AI_SEARCH_PROFILES_BY_MODE.balanced;
      const modeLabel = AI_MODE_LABEL_MAP[modeKey] || AI_MODE_LABEL_MAP.balanced;
      const { ai, usedFallback } = await findAiRecommendation(
        userScoreResult.total,
        profiles,
        modeKey
      );
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
        aiSearchMode: modeKey,
        hasAiRecommendation: ai.score > userScoreResult.total,
        isOptimal: ai.score <= userScoreResult.total
      };

      try {
        await DataService.saveGame(gameRecord);
        await refreshHistoryAndStats();
        if (ai.score > userScoreResult.total) {
          setNotice(
            usedFallback
              ? `已找到更高分 AI 推荐（${modeLabel}，第 ${ai.searchAttempts} 轮，含降级计算）并保存本局。`
              : `已找到更高分 AI 推荐（${modeLabel}，第 ${ai.searchAttempts} 轮）并保存本局。`
          );
        } else {
          setNotice(
            `已执行${modeLabel}多轮搜索，仍未找到高于玩家得分的方案；你的方案可能已接近最优。`
          );
        }
      } catch (error) {
        setNotice('本局评分完成，但保存历史失败。');
      }
      return true;
    } catch (error) {
      setAiStatus('idle');
      setNotice('AI 计算失败，请重试。');
      return false;
    }
  }

  async function handlePrimaryAction() {
    if (isSolving) {
      setNotice('专家正在计算中，请稍后。');
      return;
    }

    if (primaryActionMode === 'deal') {
      startNewDeal();
      setPrimaryActionMode('analyze');
      return;
    }

    const success = await submitScoring();
    if (success) {
      setPrimaryActionMode('deal');
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
    aiHasRecommendation,
    aiSearchMode,
    aiSearchModeLabel,
    aiSearchModeOptions: AI_SEARCH_MODE_OPTIONS,
    primaryActionMode,
    primaryActionLabel,
    primaryActionDisabled,
    startNewDeal,
    handlePrimaryAction,
    toggleCard,
    removeGroup,
    confirmGroup,
    resetSelection,
    submitScoring,
    setAiSearchMode: handleChangeAiSearchMode,
    exportHistory,
    openImportDialog,
    importHistory,
  };
}
