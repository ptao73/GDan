// AI 搜索与预计算 Hook
import { useEffect, useRef, useState } from 'react';
import { scoreScheme } from '../engine/scoring.js';
import { solveBestScheme } from '../engine/solver.js';
import { DataService } from '../services/dataService.js';
import { useWorker } from './useWorker.js';
import {
  AI_MODE_STORAGE_KEY,
  AI_SEARCH_PROFILES_BY_MODE,
  buildDealKey,
  isBetterResult,
  isIosLikeDevice,
  phaseOneSize,
  resolveAiProfiles
} from './gameStateConstants.js';
import { useI18n } from '../i18n/index.js';

export function useAiSearch({ trumpRank, dealtCards, setNotice }) {
  const { t } = useI18n();
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
    const solverOptions = {
      timeLimitMs: profile.timeLimitMs,
      maxBranch: profile.maxBranch,
      topK: 3,
      targetScore: options.targetScore,
      stopAfterSurpass: options.stopAfterSurpass
    };

    if (profile.mode === 'worker') {
      try {
        const result = await runAiSearchWithWorker(cards, rank, solverOptions);
        return { result, usedFallback: false };
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
        const fallback = solveBestScheme(cards, rank, {
          ...solverOptions,
          timeLimitMs: Math.max(2200, profile.timeLimitMs - 400)
        });
        return { result: fallback, usedFallback: true };
      }
    }

    return {
      result: solveBestScheme(cards, rank, solverOptions),
      usedFallback: false
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
    trackProgress
  }) {
    let bestResult = initialBest || null;
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
        setAiSearchProgress({
          current: (initialAttempts || 0) + idx + 1,
          total: (initialAttempts || 0) + totalProfiles
        });
      }

      const { result, usedFallback: profileFallback } = await runSingleProfileSearch(
        cards,
        rank,
        profile,
        {
          targetScore,
          stopAfterSurpass
        }
      );

      if (profileFallback) {
        usedFallback = true;
      }

      if (!bestResult || isBetterResult(result, bestResult)) {
        bestResult = result;
      }

      if (typeof targetScore === 'number' && result.score > targetScore) {
        surpassedTarget = true;
        if (stopAfterSurpass) break;
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
        searchModeLabel: t(`aiModes.${modeKey}`)
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
          searchModeLabel: t(`aiModes.${modeKey}`),
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
      setNotice(t('notices.scoringBusy'));
      return false;
    }

    if (remainingCards.length > 0) {
      setNotice(t('notices.incomplete', { count: remainingCards.length }));
      return false;
    }

    try {
      const userScoreResult = scoreScheme(userCombos, trumpRank);
      // setUserScore is handled by the caller
      setAiStatus('running');

      const modeKey = aiSearchMode;
      const profiles = resolveAiProfiles(modeKey, iosOptimized);
      const modeLabel = t(`aiModes.${modeKey}`);
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
            setNotice(t('ai.fromPrecompute', { mode: modeLabel, attempts: ai.searchAttempts }));
          } else {
            setNotice(
              usedFallback
                ? t('ai.recommendationFallback', {
                    mode: modeLabel,
                    attempts: ai.searchAttempts
                  })
                : t('ai.recommendation', { mode: modeLabel, attempts: ai.searchAttempts })
            );
          }
        } else if (ai.fromPrecompute) {
          setNotice(t('ai.precomputedOnly', { mode: modeLabel }));
        } else {
          setNotice(t('ai.noBetter', { mode: modeLabel }));
        }
      } catch (_error) {
        setNotice(t('notices.scoreSaved'));
      }
      return { success: true, userScoreResult };
    } catch (_error) {
      setAiStatus('idle');
      setAiSearchProgress(null);
      setNotice(t('notices.aiFailed'));
      return false;
    }
  }

  function handleChangeAiSearchMode(
    nextMode,
    { kickOffPrecomputeFn, kickOffGodViewPrecomputeFn, tableDeal }
  ) {
    if (isSolving) {
      setNotice(t('notices.searchBusy'));
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

    setNotice(t('ai.modeChanged', { mode: t(`aiModes.${nextMode}`) }));
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
