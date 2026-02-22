import { useEffect, useMemo, useState } from 'react';
import { createTableDeal } from '../engine/cards.js';
import { comboKey } from '../engine/combos.js';
import {
  AI_MODE_LABEL_MAP,
  AI_SEARCH_MODE_OPTIONS,
  buildDealKey
} from './gameStateConstants.js';
import { useCardSelection } from './useCardSelection.js';
import { useAiSearch } from './useAiSearch.js';
import { useGodView } from './useGodView.js';
import { useHistory } from './useHistory.js';

/**
 * 游戏核心状态管理 Hook（主协调层）
 * 组合 useCardSelection、useAiSearch、useGodView、useHistory 四个子 hook
 */
export function useGameState() {
  // --- 基本状态 ---
  const [trumpRank, setTrumpRank] = useState('2');
  const [dealtCards, setDealtCards] = useState([]);
  const [tableDeal, setTableDeal] = useState(null);
  const [userScore, setUserScore] = useState(null);
  const [notice, setNotice] = useState('');

  // --- 子 Hooks ---
  const aiSearch = useAiSearch({ trumpRank, dealtCards, setNotice });
  const godView = useGodView({ setNotice, runGodViewWithWorker: aiSearch.runGodViewWithWorker });
  const historyHook = useHistory({ setNotice, isSolving: aiSearch.isSolving });

  const cardSelection = useCardSelection({
    trumpRank,
    dealtCards,
    isSolving: aiSearch.isSolving,
    clearScoringResult: () => {
      setUserScore(null);
      aiSearch.clearScoringResult();
    },
    setNotice
  });

  // --- 计算属性 ---
  const aiComboKeySet = useMemo(
    () => new Set((aiSearch.aiResult?.combos || []).map((combo) => comboKey(combo))),
    [aiSearch.aiResult]
  );

  const primaryActionLabel = '新开局';
  const primaryActionDisabled = aiSearch.isSolving;
  const aiScoreView = aiSearch.aiResult ? { total: aiSearch.aiResult.score, detail: aiSearch.aiResult.detail } : null;
  const aiHasRecommendation = Boolean(aiSearch.aiResult && userScore && aiSearch.aiResult.score > userScore.total);
  const aiSearchModeLabel = AI_MODE_LABEL_MAP[aiSearch.aiSearchMode] || AI_MODE_LABEL_MAP.balanced;

  // --- 副作用 ---
  useEffect(() => {
    cardSelection.setSelectedTypeIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardSelection.selectedIds]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // 监听 userCombos 变化，标记上帝视角数据过期
  useEffect(() => {
    godView.markGodViewStale();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardSelection.userCombos]);

  // --- 操作方法 ---
  function resetRoundState(nextCards, nextTrumpRank, nextTableDeal = null) {
    setTrumpRank(nextTrumpRank);
    setDealtCards(nextCards);
    setTableDeal(nextTableDeal);
    cardSelection.resetCardState();
    setUserScore(null);
    aiSearch.clearScoringResult();
    godView.resetGodViewState();
    aiSearch.autoSubmitRef.current.key = '';
  }

  function startNewDeal() {
    if (aiSearch.isSolving) {
      setNotice('AI 计算中，请等待当前分析完成。');
      return;
    }

    aiSearch.cancelPendingSearches('新牌局已开始，取消旧搜索。');
    aiSearch.resetPrecomputeState();
    godView.resetGodViewPrecomputeState();

    const nextTableDeal = createTableDeal();
    const eastCards = nextTableDeal.players.find((player) => player.seat === 'E')?.cards || [];
    resetRoundState(eastCards, nextTableDeal.trumpRank, nextTableDeal);
    aiSearch.kickOffPrecompute(eastCards, nextTableDeal.trumpRank, aiSearch.aiSearchMode, true);
    godView.kickOffGodViewPrecompute(nextTableDeal, aiSearch.aiSearchMode, true);
    setNotice(`新牌局已开始，当前打几：${nextTableDeal.trumpRank}。AI 与上帝视角已后台预计算。`);
  }

  // 初始化
  useEffect(() => {
    startNewDeal();
    historyHook.refreshHistoryAndStats().catch(() => {
      setNotice('历史数据加载失败');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 模式切换后重新预计算
  useEffect(() => {
    if (dealtCards.length !== 27) return;
    aiSearch.kickOffPrecompute(dealtCards, trumpRank, aiSearch.aiSearchMode, false);
    if (tableDeal?.players?.length === 4) {
      godView.kickOffGodViewPrecompute(tableDeal, aiSearch.aiSearchMode, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiSearch.aiSearchMode, aiSearch.iosOptimized, trumpRank, dealtCards, tableDeal]);

  // 自动提交评分
  useEffect(() => {
    if (aiSearch.isSolving) return;
    if (aiSearch.aiResult) return;
    if (dealtCards.length !== 27) return;
    if (cardSelection.remainingCards.length !== 0) return;
    if (cardSelection.userCombos.length === 0) return;

    const comboSig = cardSelection.userCombos
      .map((combo) => comboKey(combo))
      .sort((a, b) => a.localeCompare(b))
      .join('||');
    const submitKey = `${buildDealKey(dealtCards, trumpRank)}|${comboSig}`;
    if (!submitKey || aiSearch.autoSubmitRef.current.key === submitKey) return;

    aiSearch.autoSubmitRef.current.key = submitKey;
    handleSubmitScoring().catch(() => {
      // submitScoring already sets user notice on failure.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiSearch.isSolving, aiSearch.aiResult, dealtCards, cardSelection.remainingCards, cardSelection.userCombos, trumpRank]);

  function handlePrimaryAction() {
    if (aiSearch.isSolving) {
      setNotice('专家正在计算中，请稍后。');
      return;
    }
    startNewDeal();
  }

  async function handleSubmitScoring() {
    const result = await aiSearch.submitScoring({
      userCombos: cardSelection.userCombos,
      remainingCards: cardSelection.remainingCards,
      tableDeal,
      takeGodViewSnapshot: godView.takeGodViewSnapshot,
      setGodViewData: godView.setGodViewData,
      setGodViewStatus: godView.setGodViewStatus,
      setGodViewEnabled: godView.setGodViewEnabled,
      refreshHistoryAndStats: historyHook.refreshHistoryAndStats
    });
    if (result && result.userScoreResult) {
      setUserScore(result.userScoreResult);
    }
    return result;
  }

  async function autoCompleteAndSubmit() {
    await cardSelection.autoCompleteRemaining(handleSubmitScoring, aiSearch.aiResult);
  }

  function handleSetAiSearchMode(nextMode) {
    aiSearch.handleChangeAiSearchMode(nextMode, {
      kickOffPrecomputeFn: aiSearch.kickOffPrecompute,
      kickOffGodViewPrecomputeFn: godView.kickOffGodViewPrecompute,
      tableDeal
    });
  }

  function handleToggleGodView() {
    return godView.toggleGodView(tableDeal, aiSearch.aiSearchMode);
  }

  function handleRefreshGodView() {
    godView.refreshGodView(tableDeal, aiSearch.aiSearchMode);
  }

  function handleImportHistory(event) {
    return historyHook.importHistory(event, {
      trumpRank,
      aiSearchMode: aiSearch.aiSearchMode,
      cancelPendingSearches: aiSearch.cancelPendingSearches,
      resetPrecomputeState: aiSearch.resetPrecomputeState,
      resetGodViewPrecomputeState: godView.resetGodViewPrecomputeState,
      resetRoundState,
      kickOffPrecompute: aiSearch.kickOffPrecompute,
      kickOffGodViewPrecompute: godView.kickOffGodViewPrecompute
    });
  }

  return {
    trumpRank,
    dealtCards,
    userCombos: cardSelection.userCombos,
    selectedIds: cardSelection.selectedIds,
    selectedTypeIndex: cardSelection.selectedTypeIndex,
    setSelectedTypeIndex: cardSelection.setSelectedTypeIndex,
    userScore,
    aiResult: aiSearch.aiResult,
    aiStatus: aiSearch.aiStatus,
    aiSearchProgress: aiSearch.aiSearchProgress,
    history: historyHook.history,
    stats: historyHook.stats,
    notice,
    importInputRef: historyHook.importInputRef,
    remainingCards: cardSelection.remainingCards,
    selectedCards: cardSelection.selectedCards,
    candidateTypes: cardSelection.candidateTypes,
    userComboKeySet: cardSelection.userComboKeySet,
    aiComboKeySet,
    isSolving: aiSearch.isSolving,
    isImportingHand: historyHook.isImportingHand,
    assignedCardsCount: cardSelection.assignedCardsCount,
    matrixCounts: cardSelection.matrixCounts,
    rankTotals: cardSelection.rankTotals,
    jokersRemain: cardSelection.jokersRemain,
    wildcardRemain: cardSelection.wildcardRemain,
    aiScoreView,
    aiHasRecommendation,
    aiSearchMode: aiSearch.aiSearchMode,
    aiSearchModeLabel,
    aiSearchModeOptions: AI_SEARCH_MODE_OPTIONS,
    tableDeal,
    godViewEnabled: godView.godViewEnabled,
    godViewStatus: godView.godViewStatus,
    godViewData: godView.godViewData,
    godViewStale: godView.godViewStale,
    godViewReady: godView.godViewReady,
    ghostHints: godView.ghostHints,
    primaryActionLabel,
    primaryActionDisabled,
    startNewDeal,
    handlePrimaryAction,
    toggleCard: cardSelection.toggleCard,
    removeGroup: cardSelection.removeGroup,
    confirmGroup: cardSelection.confirmGroup,
    resetSelection: cardSelection.resetSelection,
    autoCompleteAndSubmit,
    submitScoring: handleSubmitScoring,
    setAiSearchMode: handleSetAiSearchMode,
    toggleGodView: handleToggleGodView,
    refreshGodView: handleRefreshGodView,
    exportHistory: historyHook.exportHistory,
    openImportDialog: historyHook.openImportDialog,
    importHistory: handleImportHistory,
    ocrReview: historyHook.ocrReview,
    confirmOcrReview: historyHook.confirmOcrReview,
    cancelOcrReview: historyHook.cancelOcrReview
  };
}
