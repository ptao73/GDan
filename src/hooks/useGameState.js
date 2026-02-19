import { useEffect, useMemo, useRef, useState } from 'react';
import { createTableDeal } from '../engine/cards.js';
import {
  comboKey,
  createCombo,
  detectComboTypes
} from '../engine/combos.js';
import { scoreScheme } from '../engine/scoring.js';
import { compareSchemeResult, solveBestScheme, solveDualRecommendation } from '../engine/solver.js';
import { analyzeGodView } from '../engine/godView.js';
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
const GOD_VIEW_TIME_LIMIT_MS = {
  fast: 420,
  balanced: 650,
  quality: 920
};
const GOD_VIEW_MAX_BRANCH = {
  fast: 16,
  balanced: 20,
  quality: 24
};

function isIosLikeDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isClassicIos = /iPad|iPhone|iPod/.test(ua);
  const isIpadDesktopUa = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return isClassicIos || isIpadDesktopUa;
}

function resolveAiProfiles(modeKey, iosOptimized) {
  const base = AI_SEARCH_PROFILES_BY_MODE[modeKey] || AI_SEARCH_PROFILES_BY_MODE.balanced;
  if (!iosOptimized) {
    return base;
  }

  const timeCaps = [2200, 3200, 4200, 5200, 6200];
  return base.map((profile, index) => ({
    ...profile,
    timeLimitMs: Math.min(profile.timeLimitMs, timeCaps[index] || 6200),
    maxBranch: Math.max(
      16,
      Math.min(profile.maxBranch || 24, profile.mode === 'worker' ? 34 : 30)
    )
  }));
}

function buildDealKey(cards, trumpRank) {
  if (!cards || cards.length === 0) {
    return '';
  }
  return `${trumpRank}|${cards.map((card) => card.id).join('.')}`;
}

function buildTableDealKey(tableDeal) {
  if (!tableDeal?.trumpRank || !Array.isArray(tableDeal.players) || tableDeal.players.length === 0) {
    return '';
  }

  const seatOrder = ['E', 'S', 'W', 'N'];
  const bySeat = new Map(tableDeal.players.map((player) => [player.seat, player.cards || []]));
  const parts = seatOrder.map((seat) =>
    (bySeat.get(seat) || [])
      .map((card) => card.id)
      .join('.')
  );
  return `${tableDeal.trumpRank}|${parts.join('/')}`;
}

function isBetterResult(next, current) {
  return compareSchemeResult(next, current) < 0;
}

function phaseOneSize(modeKey, profileCount) {
  if (profileCount <= 1) return profileCount;
  return modeKey === 'fast' ? 1 : Math.min(2, profileCount);
}

/**
 * 游戏核心状态管理 Hook
 * 包含所有状态变量、计算属性、和操作方法
 */
export function useGameState() {
  // --- 基本状态 ---
  const [trumpRank, setTrumpRank] = useState('2');
  const [dealtCards, setDealtCards] = useState([]);
  const [tableDeal, setTableDeal] = useState(null);
  const [userCombos, setUserCombos] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedTypeIndex, setSelectedTypeIndex] = useState(0);

  const [userScore, setUserScore] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [aiStatus, setAiStatus] = useState('idle');
  const [aiSearchMode, setAiSearchMode] = useState('balanced');
  const [primaryActionMode, setPrimaryActionMode] = useState('deal');
  const [godViewEnabled, setGodViewEnabled] = useState(false);
  const [godViewStatus, setGodViewStatus] = useState('idle');
  const [godViewData, setGodViewData] = useState(null);
  const [iosOptimized, setIosOptimized] = useState(false);

  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [notice, setNotice] = useState('');

  const importInputRef = useRef(null);
  const precomputeRef = useRef({
    dealKey: '',
    modeKey: '',
    status: 'idle',
    promise: null,
    result: null,
    usedFallback: false,
    error: null
  });
  const godViewPrecomputeRef = useRef({
    tableDealKey: '',
    status: 'idle',
    promise: null,
    result: null,
    error: null
  });

  const { runAiSearchWithWorker, cancelPendingSearches } = useWorker();

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
  const godViewReady = godViewStatus === 'ready' && Boolean(godViewData);

  const ghostHints = useMemo(() => {
    if (!godViewData?.players) return [];
    return godViewData.players
      .filter((item) => item.role === 'opponent')
      .map((item) => ({
        seat: item.seat,
        seatName: item.seatName,
        fireCount: item.preferred.fireCount,
        bombCount: item.preferred.bombCount,
        hands: item.preferred.handCount
      }))
      .sort((a, b) => b.fireCount - a.fireCount);
  }, [godViewData]);

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
    const isIosRuntime = isIosLikeDevice();
    setIosOptimized(isIosRuntime);
    try {
      const saved = window.localStorage.getItem(AI_MODE_STORAGE_KEY);
      if (saved && AI_SEARCH_PROFILES_BY_MODE[saved]) {
        setAiSearchMode(saved);
      } else if (isIosRuntime) {
        setAiSearchMode('fast');
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

  function resetRoundState(nextCards, nextTrumpRank, nextTableDeal = null) {
    setTrumpRank(nextTrumpRank);
    setDealtCards(nextCards);
    setTableDeal(nextTableDeal);
    setUserCombos([]);
    setSelectedIds([]);
    setSelectedTypeIndex(0);
    setUserScore(null);
    setAiResult(null);
    setAiStatus('idle');
    setGodViewEnabled(false);
    setGodViewStatus('idle');
    setGodViewData(null);
  }

  function resetPrecomputeState() {
    precomputeRef.current = {
      dealKey: '',
      modeKey: '',
      status: 'idle',
      promise: null,
      result: null,
      usedFallback: false,
      error: null
    };
  }

  function resetGodViewPrecomputeState() {
    godViewPrecomputeRef.current = {
      tableDealKey: '',
      status: 'idle',
      promise: null,
      result: null,
      error: null
    };
  }

  function kickOffGodViewPrecompute(nextTableDeal, modeKey, forceRestart = false) {
    const tableDealKey = buildTableDealKey(nextTableDeal);
    if (!tableDealKey) return;

    const current = godViewPrecomputeRef.current;
    const sameTask =
      current.tableDealKey === tableDealKey &&
      (current.status === 'running' || current.status === 'ready');
    if (!forceRestart && sameTask) {
      return;
    }

    const timeLimitMs = GOD_VIEW_TIME_LIMIT_MS[modeKey] || GOD_VIEW_TIME_LIMIT_MS.balanced;
    const maxBranch = GOD_VIEW_MAX_BRANCH[modeKey] || GOD_VIEW_MAX_BRANCH.balanced;
    setGodViewStatus('running');

    const task = Promise.resolve().then(() =>
      analyzeGodView(nextTableDeal, {
        userSeat: 'E',
        timeLimitMs,
        maxBranch
      })
    );

    godViewPrecomputeRef.current = {
      tableDealKey,
      status: 'running',
      promise: task,
      result: null,
      error: null
    };

    task
      .then((payload) => {
        const latest = godViewPrecomputeRef.current;
        if (latest.promise !== task || latest.tableDealKey !== tableDealKey) {
          return;
        }

        godViewPrecomputeRef.current = {
          tableDealKey,
          status: 'ready',
          promise: task,
          result: payload,
          error: null
        };
        setGodViewData(payload);
        setGodViewStatus('ready');
      })
      .catch((error) => {
        const latest = godViewPrecomputeRef.current;
        if (latest.promise !== task || latest.tableDealKey !== tableDealKey) {
          return;
        }

        godViewPrecomputeRef.current = {
          tableDealKey,
          status: 'failed',
          promise: null,
          result: null,
          error
        };
        setGodViewStatus('failed');
      });
  }

  async function takeGodViewSnapshot(nextTableDeal) {
    const tableDealKey = buildTableDealKey(nextTableDeal);
    const snapshot = godViewPrecomputeRef.current;
    if (snapshot.tableDealKey !== tableDealKey) {
      return null;
    }

    if (snapshot.status === 'ready' && snapshot.result) {
      return snapshot.result;
    }

    if (snapshot.status === 'running' && snapshot.promise) {
      try {
        return await snapshot.promise;
      } catch (error) {
        return null;
      }
    }

    return null;
  }

  async function runSingleProfileSearch(cards, rank, profile, options = {}) {
    const dualMode = Boolean(options.dualMode);
    const solverOptions = {
      timeLimitMs: profile.timeLimitMs,
      maxBranch: profile.maxBranch,
      topK: 3,
      targetScore: options.targetScore,
      stopAfterSurpass: options.stopAfterSurpass,
      dualMode
    };

    if (profile.mode === 'worker') {
      try {
        const result = await runAiSearchWithWorker(cards, rank, solverOptions);
        return { result, usedFallback: false, dualMode };
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (
          message.includes('cancelled') ||
          message.includes('closed') ||
          message.includes('取消') ||
          message.includes('切换')
        ) {
          throw error;
        }
        if (dualMode) {
          const fallback = solveDualRecommendation(cards, rank, {
            ...solverOptions,
            timeLimitMs: Math.max(2200, profile.timeLimitMs - 400)
          });
          return { result: fallback, usedFallback: true, dualMode };
        }
        const fallback = solveBestScheme(cards, rank, {
          ...solverOptions,
          timeLimitMs: Math.max(2200, profile.timeLimitMs - 400)
        });
        return { result: fallback, usedFallback: true, dualMode: false };
      }
    }

    if (dualMode) {
      return {
        result: solveDualRecommendation(cards, rank, solverOptions),
        usedFallback: false,
        dualMode
      };
    }

    return {
      result: solveBestScheme(cards, rank, solverOptions),
      usedFallback: false,
      dualMode: false
    };
  }

  async function runProfilesSearch({
    cards,
    rank,
    profiles,
    modeKey,
    targetScore,
    stopAfterSurpass,
    initialBest,
    initialAttempts,
    dualMode
  }) {
    let bestResult = initialBest || null;
    let dualResult = null;
    let usedFallback = false;
    let attemptCount = initialAttempts || 0;
    let surpassedTarget =
      typeof targetScore === 'number' && bestResult
        ? bestResult.score > targetScore
        : false;

    for (const profile of profiles) {
      attemptCount += 1;
      const { result, usedFallback: profileFallback, dualMode: isDual } = await runSingleProfileSearch(
        cards,
        rank,
        profile,
        {
          targetScore,
          stopAfterSurpass,
          dualMode
        }
      );

      if (profileFallback) {
        usedFallback = true;
      }

      if (isDual && result.ceiling && result.control) {
        // 双策略结果 — 取两者中的最佳作为 bestResult
        dualResult = result;
        const better = isBetterResult(result.ceiling, result.control)
          ? result.ceiling
          : result.control;
        if (!bestResult || isBetterResult(better, bestResult)) {
          bestResult = better;
        }

        if (typeof targetScore === 'number') {
          if (result.ceiling.score > targetScore || result.control.score > targetScore) {
            surpassedTarget = true;
            if (stopAfterSurpass) break;
          }
        }
      } else {
        if (!bestResult || isBetterResult(result, bestResult)) {
          bestResult = result;
        }

        if (typeof targetScore === 'number' && result.score > targetScore) {
          surpassedTarget = true;
          if (stopAfterSurpass) break;
        }
      }
    }

    const resolvedBest =
      bestResult ||
      solveBestScheme(cards, rank, {
        timeLimitMs: 3000,
        topK: 3
      });

    return {
      ai: {
        ...resolvedBest,
        searchAttempts: attemptCount,
        surpassedUser:
          typeof targetScore === 'number' ? resolvedBest.score > targetScore : false,
        searchMode: modeKey,
        searchModeLabel: AI_MODE_LABEL_MAP[modeKey] || AI_MODE_LABEL_MAP.balanced,
        dualResult
      },
      usedFallback,
      surpassedTarget
    };
  }

  function kickOffPrecompute(cards, rank, modeKey, forceRestart = false) {
    const dealKey = buildDealKey(cards, rank);
    if (!dealKey) return;

    const profiles = resolveAiProfiles(modeKey, iosOptimized);
    if (profiles.length === 0) return;

    const current = precomputeRef.current;
    const sameTask =
      current.dealKey === dealKey &&
      current.modeKey === modeKey &&
      (current.status === 'running' || current.status === 'ready');

    if (!forceRestart && sameTask) {
      return;
    }

    if (forceRestart) {
      cancelPendingSearches('AI 预计算任务已切换。');
    }

    const task = runProfilesSearch({
      cards,
      rank,
      profiles,
      modeKey,
      targetScore: null,
      stopAfterSurpass: false,
      initialBest: null,
      initialAttempts: 0,
      dualMode: true
    });

    precomputeRef.current = {
      dealKey,
      modeKey,
      status: 'running',
      promise: task,
      result: null,
      usedFallback: false,
      error: null
    };

    task
      .then((payload) => {
        const latest = precomputeRef.current;
        if (latest.promise !== task || latest.dealKey !== dealKey || latest.modeKey !== modeKey) {
          return;
        }

        precomputeRef.current = {
          dealKey,
          modeKey,
          status: 'ready',
          promise: task,
          result: payload.ai,
          usedFallback: payload.usedFallback,
          error: null
        };
      })
      .catch((error) => {
        const latest = precomputeRef.current;
        if (latest.promise !== task || latest.dealKey !== dealKey || latest.modeKey !== modeKey) {
          return;
        }

        precomputeRef.current = {
          dealKey,
          modeKey,
          status: 'failed',
          promise: null,
          result: null,
          usedFallback: false,
          error
        };
      });
  }

  async function takePrecomputedResult(modeKey) {
    const dealKey = buildDealKey(dealtCards, trumpRank);
    const snapshot = precomputeRef.current;

    if (snapshot.dealKey !== dealKey || snapshot.modeKey !== modeKey) {
      return null;
    }

    if (snapshot.status === 'ready' && snapshot.result) {
      return {
        ai: snapshot.result,
        usedFallback: snapshot.usedFallback,
        fromPrecompute: true
      };
    }

    if (snapshot.status === 'running' && snapshot.promise) {
      try {
        const payload = await snapshot.promise;
        return {
          ai: payload.ai,
          usedFallback: payload.usedFallback,
          fromPrecompute: true
        };
      } catch (error) {
        return null;
      }
    }

    return null;
  }

  function startNewDeal() {
    if (isSolving) {
      setNotice('AI 计算中，请等待当前分析完成。');
      return;
    }

    cancelPendingSearches('新牌局已开始，取消旧搜索。');
    resetPrecomputeState();
    resetGodViewPrecomputeState();

    const nextTableDeal = createTableDeal();
    const eastCards = nextTableDeal.players.find((player) => player.seat === 'E')?.cards || [];
    resetRoundState(eastCards, nextTableDeal.trumpRank, nextTableDeal);
    kickOffPrecompute(eastCards, nextTableDeal.trumpRank, aiSearchMode, true);
    kickOffGodViewPrecompute(nextTableDeal, aiSearchMode, true);
    setNotice(`新牌局已开始，当前打几：${nextTableDeal.trumpRank}。AI 与上帝视角已后台预计算。`);
  }

  useEffect(() => {
    startNewDeal();
    refreshHistoryAndStats().catch(() => {
      setNotice('历史数据加载失败');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (dealtCards.length !== 27) return;
    const dealKey = buildDealKey(dealtCards, trumpRank);
    const shouldForceRestart =
      precomputeRef.current.dealKey === dealKey &&
      precomputeRef.current.modeKey &&
      precomputeRef.current.modeKey !== aiSearchMode;
    kickOffPrecompute(dealtCards, trumpRank, aiSearchMode, shouldForceRestart);
    if (tableDeal?.players?.length === 4) {
      kickOffGodViewPrecompute(tableDeal, aiSearchMode, shouldForceRestart);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiSearchMode, iosOptimized, trumpRank, dealtCards, tableDeal]);

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

    if (dealtCards.length === 27) {
      kickOffPrecompute(dealtCards, trumpRank, nextMode, true);
      if (tableDeal?.players?.length === 4) {
        kickOffGodViewPrecompute(tableDeal, nextMode, true);
      }
    }

    setNotice(`已切换 AI 搜索档位：${AI_MODE_LABEL_MAP[nextMode]}（后台将重算当前牌局）`);
  }

  async function findAiRecommendation(targetScore, profiles, modeKey) {
    const cached = await takePrecomputedResult(modeKey);
    if (cached?.ai) {
      return {
        ai: {
          ...cached.ai,
          surpassedUser: cached.ai.score > targetScore,
          searchMode: modeKey,
          searchModeLabel: AI_MODE_LABEL_MAP[modeKey] || AI_MODE_LABEL_MAP.balanced,
          fromPrecompute: true
        },
        usedFallback: cached.usedFallback
      };
    }

    const firstPhaseCount = phaseOneSize(modeKey, profiles.length);
    const phaseOneProfiles = profiles.slice(0, firstPhaseCount);
    const phaseTwoProfiles = profiles.slice(firstPhaseCount);

    const phaseOne = await runProfilesSearch({
      cards: dealtCards,
      rank: trumpRank,
      profiles: phaseOneProfiles,
      modeKey,
      targetScore,
      stopAfterSurpass: true,
      initialBest: null,
      initialAttempts: 0,
      dualMode: true
    });

    if (phaseOne.surpassedTarget || phaseTwoProfiles.length === 0) {
      return {
        ai: {
          ...phaseOne.ai,
          fromPrecompute: false
        },
        usedFallback: phaseOne.usedFallback
      };
    }

    const phaseTwo = await runProfilesSearch({
      cards: dealtCards,
      rank: trumpRank,
      profiles: phaseTwoProfiles,
      modeKey,
      targetScore,
      stopAfterSurpass: false,
      initialBest: phaseOne.ai,
      initialAttempts: phaseOne.ai.searchAttempts || 0,
      dualMode: true
    });

    return {
      ai: {
        ...phaseTwo.ai,
        fromPrecompute: false
      },
      usedFallback: phaseOne.usedFallback || phaseTwo.usedFallback
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
      const profiles = resolveAiProfiles(modeKey, iosOptimized);
      const modeLabel = AI_MODE_LABEL_MAP[modeKey] || AI_MODE_LABEL_MAP.balanced;
      const { ai, usedFallback } = await findAiRecommendation(
        userScoreResult.total,
        profiles,
        modeKey
      );
      setAiResult(ai);
      setAiStatus('done');

      const godViewSnapshot = tableDeal ? await takeGodViewSnapshot(tableDeal) : null;
      if (godViewSnapshot) {
        setGodViewData(godViewSnapshot);
        setGodViewStatus('ready');
        setGodViewEnabled(true);
      }

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
        godViewSummary: godViewSnapshot
          ? {
              interruptionProbability: godViewSnapshot.realtime?.interruptionProbability ?? null,
              backupValue: godViewSnapshot.realtime?.backupValue ?? null
            }
          : null,
        aiSearchMode: modeKey,
        hasAiRecommendation: ai.score > userScoreResult.total,
        isOptimal: ai.score <= userScoreResult.total
      };

      try {
        await DataService.saveGame(gameRecord);
        await refreshHistoryAndStats();
        if (ai.score > userScoreResult.total) {
          if (ai.fromPrecompute) {
            setNotice(
              `已使用后台预计算结果，找到更高分 AI 推荐（${modeLabel}，第 ${ai.searchAttempts} 轮）并保存本局。`
            );
          } else {
            setNotice(
              usedFallback
                ? `已找到更高分 AI 推荐（${modeLabel}，第 ${ai.searchAttempts} 轮，含降级计算）并保存本局。`
                : `已找到更高分 AI 推荐（${modeLabel}，第 ${ai.searchAttempts} 轮）并保存本局。`
            );
          }
        } else if (ai.fromPrecompute) {
          setNotice(`已直接给出后台预计算结果（${modeLabel}），你的方案可能已接近最优。`);
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

  async function toggleGodView() {
    if (!tableDeal?.players?.length) {
      setNotice('当前牌局缺少四家手牌数据，无法打开上帝视角。');
      return;
    }

    const nextEnabled = !godViewEnabled;
    setGodViewEnabled(nextEnabled);
    if (!nextEnabled) {
      return;
    }

    if (godViewData) {
      return;
    }

    setGodViewStatus('running');
    const snapshot = await takeGodViewSnapshot(tableDeal);
    if (snapshot) {
      setGodViewData(snapshot);
      setGodViewStatus('ready');
      return;
    }

    try {
      const fallback = analyzeGodView(tableDeal, {
        userSeat: 'E',
        timeLimitMs: GOD_VIEW_TIME_LIMIT_MS[aiSearchMode] || GOD_VIEW_TIME_LIMIT_MS.balanced,
        maxBranch: GOD_VIEW_MAX_BRANCH[aiSearchMode] || GOD_VIEW_MAX_BRANCH.balanced
      });
      if (fallback) {
        setGodViewData(fallback);
        setGodViewStatus('ready');
      } else {
        setGodViewStatus('failed');
      }
    } catch (error) {
      setGodViewStatus('failed');
      setNotice('上帝视角分析失败，请重试。');
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
    tableDeal,
    godViewEnabled,
    godViewStatus,
    godViewData,
    godViewReady,
    ghostHints,
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
    toggleGodView,
    exportHistory,
    openImportDialog,
    importHistory,
  };
}
