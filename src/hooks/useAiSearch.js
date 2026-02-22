// AI 搜索与预计算 Hook
import { useEffect, useRef, useState } from 'react';
import { scoreScheme } from '../engine/scoring.js';
import { solveBestScheme, solveDualRecommendation } from '../engine/solver.js';
import { DataService } from '../services/dataService.js';
import { useWorker } from './useWorker.js';
import {
  AI_MODE_LABEL_MAP,
  AI_MODE_STORAGE_KEY,
  AI_SEARCH_PROFILES_BY_MODE,
  buildDealKey,
  isBetterResult,
  isIosLikeDevice,
  phaseOneSize,
  resolveAiProfiles
} from './gameStateConstants.js';

export function useAiSearch({ trumpRank, dealtCards, setNotice }) {
  const [aiResult, setAiResult] = useState(null);
  const [aiStatus, setAiStatus] = useState('idle');
  const [aiSearchMode, setAiSearchModeState] = useState('balanced');
  const [aiSearchProgress, setAiSearchProgress] = useState(null);
  const [iosOptimized, setIosOptimized] = useState(false);

  const autoSubmitRef = useRef({ key: '' });
  const precomputeRef = useRef({
    dealKey: '',
    modeKey: '',
    status: 'idle',
    promise: null,
    result: null,
    usedFallback: false,
    error: null
  });

  const { runAiSearchWithWorker, runGodViewWithWorker, cancelPendingSearches } = useWorker();

  const isSolving = aiStatus === 'running';

  // 初始化 iOS 检测和模式恢复
  useEffect(() => {
    const isIosRuntime = isIosLikeDevice();
    setIosOptimized(isIosRuntime);
    try {
      const saved = window.localStorage.getItem(AI_MODE_STORAGE_KEY);
      if (saved && AI_SEARCH_PROFILES_BY_MODE[saved]) {
        setAiSearchModeState(saved);
      } else if (isIosRuntime) {
        setAiSearchModeState('fast');
      }
    } catch (_error) {
      // Ignore storage failures in privacy-restricted environments.
    }
  }, []);

  // 持久化模式切换
  useEffect(() => {
    try {
      window.localStorage.setItem(AI_MODE_STORAGE_KEY, aiSearchMode);
    } catch (_error) {
      // Ignore storage failures in privacy-restricted environments.
    }
  }, [aiSearchMode]);

  function clearScoringResult() {
    setAiResult(null);
    setAiStatus('idle');
    setAiSearchProgress(null);
    autoSubmitRef.current.key = '';
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
    dualMode,
    trackProgress
  }) {
    let bestResult = initialBest || null;
    let dualResult = null;
    let usedFallback = false;
    let attemptCount = initialAttempts || 0;
    let surpassedTarget =
      typeof targetScore === 'number' && bestResult ? bestResult.score > targetScore : false;

    const totalProfiles = profiles.length;

    for (let idx = 0; idx < profiles.length; idx += 1) {
      const profile = profiles[idx];
      attemptCount += 1;

      // 更新搜索进度
      if (trackProgress) {
        setAiSearchProgress({ current: (initialAttempts || 0) + idx + 1, total: (initialAttempts || 0) + totalProfiles });
      }

      const {
        result,
        usedFallback: profileFallback,
        dualMode: isDual
      } = await runSingleProfileSearch(cards, rank, profile, {
        targetScore,
        stopAfterSurpass,
        dualMode
      });

      if (profileFallback) {
        usedFallback = true;
      }

      if (isDual && result.ceiling && result.control) {
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
        surpassedUser: typeof targetScore === 'number' ? resolvedBest.score > targetScore : false,
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
      dualMode: true,
      trackProgress: false
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
      } catch (_error) {
        return null;
      }
    }

    return null;
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

    const totalProfileCount = profiles.length;
    const firstPhaseCount = phaseOneSize(modeKey, totalProfileCount);
    const phaseOneProfiles = profiles.slice(0, firstPhaseCount);
    const phaseTwoProfiles = profiles.slice(firstPhaseCount);

    setAiSearchProgress({ current: 1, total: totalProfileCount });

    const phaseOne = await runProfilesSearch({
      cards: dealtCards,
      rank: trumpRank,
      profiles: phaseOneProfiles,
      modeKey,
      targetScore,
      stopAfterSurpass: true,
      initialBest: null,
      initialAttempts: 0,
      dualMode: true,
      trackProgress: true
    });

    if (phaseOne.surpassedTarget || phaseTwoProfiles.length === 0) {
      setAiSearchProgress(null);
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
      dualMode: true,
      trackProgress: true
    });

    setAiSearchProgress(null);
    return {
      ai: {
        ...phaseTwo.ai,
        fromPrecompute: false
      },
      usedFallback: phaseOne.usedFallback || phaseTwo.usedFallback
    };
  }

  async function submitScoring({
    userCombos,
    remainingCards,
    tableDeal,
    takeGodViewSnapshot,
    setGodViewData,
    setGodViewStatus,
    setGodViewEnabled,
    refreshHistoryAndStats
  }) {
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
      // setUserScore is handled by the caller
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
      } catch (_error) {
        setNotice('本局评分完成，但保存历史失败。');
      }
      return { success: true, userScoreResult };
    } catch (_error) {
      setAiStatus('idle');
      setAiSearchProgress(null);
      setNotice('AI 计算失败，请重试。');
      return false;
    }
  }

  function handleChangeAiSearchMode(nextMode, { kickOffPrecomputeFn, kickOffGodViewPrecomputeFn, tableDeal }) {
    if (isSolving) {
      setNotice('AI 正在计算中，暂不可切换搜索档位。');
      return;
    }
    if (!AI_SEARCH_PROFILES_BY_MODE[nextMode]) {
      return;
    }
    setAiSearchModeState(nextMode);

    if (dealtCards.length === 27) {
      kickOffPrecomputeFn(dealtCards, trumpRank, nextMode, true);
      if (tableDeal?.players?.length === 4) {
        kickOffGodViewPrecomputeFn(tableDeal, nextMode, true);
      }
    }

    setNotice(`已切换 AI 搜索档位：${AI_MODE_LABEL_MAP[nextMode]}（后台将重算当前牌局）`);
  }

  return {
    aiResult,
    setAiResult,
    aiStatus,
    setAiStatus,
    aiSearchMode,
    aiSearchProgress,
    iosOptimized,
    isSolving,
    autoSubmitRef,
    clearScoringResult,
    resetPrecomputeState,
    kickOffPrecompute,
    findAiRecommendation,
    submitScoring,
    handleChangeAiSearchMode,
    cancelPendingSearches,
    runGodViewWithWorker
  };
}
