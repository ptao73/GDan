// 上帝视角 Hook
import { useMemo, useRef, useState } from 'react';
import { analyzeGodView } from '../engine/godView.js';
import {
  GOD_VIEW_MAX_BRANCH,
  GOD_VIEW_TIME_LIMIT_MS,
  buildTableDealKey
} from './gameStateConstants.js';

export function useGodView({ setNotice, runGodViewWithWorker }) {
  const [godViewEnabled, setGodViewEnabled] = useState(false);
  const [godViewStatus, setGodViewStatus] = useState('idle');
  const [godViewData, setGodViewData] = useState(null);
  const [godViewStale, setGodViewStale] = useState(false);

  const godViewPrecomputeRef = useRef({
    tableDealKey: '',
    status: 'idle',
    promise: null,
    result: null,
    error: null
  });

  const godViewReady = godViewStatus === 'ready' && Boolean(godViewData);

  const ghostHints = useMemo(() => {
    if (!godViewData?.players) return [];
    return godViewData.players
      .filter((item) => item.role === 'opponent')
      .map((item) => ({
        seat: item.seat,
        seatName: item.seatName,
        bombCount: item.preferred.bombCount,
        hands: item.preferred.handCount
      }))
      .sort((a, b) => b.bombCount - a.bombCount);
  }, [godViewData]);

  function resetGodViewPrecomputeState() {
    godViewPrecomputeRef.current = {
      tableDealKey: '',
      status: 'idle',
      promise: null,
      result: null,
      error: null
    };
  }

  function resetGodViewState() {
    setGodViewEnabled(false);
    setGodViewStatus('idle');
    setGodViewData(null);
    setGodViewStale(false);
  }

  function markGodViewStale() {
    if (godViewData) {
      setGodViewStale(true);
    }
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

    const task = runGodViewWithWorker(nextTableDeal, {
      userSeat: 'E',
      timeLimitMs,
      maxBranch
    }).catch(() =>
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
        setGodViewStale(false);
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
      } catch (_error) {
        return null;
      }
    }

    return null;
  }

  async function toggleGodView(tableDeal, aiSearchMode) {
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
      const workerOpts = {
        userSeat: 'E',
        timeLimitMs: GOD_VIEW_TIME_LIMIT_MS[aiSearchMode] || GOD_VIEW_TIME_LIMIT_MS.balanced,
        maxBranch: GOD_VIEW_MAX_BRANCH[aiSearchMode] || GOD_VIEW_MAX_BRANCH.balanced
      };
      let fallback;
      try {
        fallback = await runGodViewWithWorker(tableDeal, workerOpts);
      } catch (_workerErr) {
        fallback = analyzeGodView(tableDeal, workerOpts);
      }
      if (fallback) {
        setGodViewData(fallback);
        setGodViewStatus('ready');
      } else {
        setGodViewStatus('failed');
      }
    } catch (_error) {
      setGodViewStatus('failed');
      setNotice('上帝视角分析失败，请重试。');
    }
  }

  function refreshGodView(tableDeal, aiSearchMode) {
    kickOffGodViewPrecompute(tableDeal, aiSearchMode, true);
  }

  return {
    godViewEnabled,
    setGodViewEnabled,
    godViewStatus,
    setGodViewStatus,
    godViewData,
    setGodViewData,
    godViewStale,
    setGodViewStale,
    godViewReady,
    ghostHints,
    resetGodViewPrecomputeState,
    resetGodViewState,
    markGodViewStale,
    kickOffGodViewPrecompute,
    takeGodViewSnapshot,
    toggleGodView,
    refreshGodView
  };
}
