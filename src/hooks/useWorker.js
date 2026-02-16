import { useEffect, useRef } from 'react';

/**
 * 管理 Web Worker 的生命周期和通信
 * 返回 runAiSearchWithWorker 方法供 AI 搜索调用
 */
export function useWorker() {
  const tasksRef = useRef(new Map());

  useEffect(() => {
    return () => {
      for (const task of tasksRef.current.values()) {
        clearTimeout(task.timer);
        task.reject(new Error('Worker closed'));
        task.worker.terminate();
      }
      tasksRef.current.clear();
    };
  }, []);

  function runAiSearchWithWorker(cards, trumpRank, options = {}) {
    const timeLimitMs = options.timeLimitMs ?? 3000;
    const maxBranch = options.maxBranch;
    const topK = options.topK;
    const targetScore = options.targetScore;
    const stopAfterSurpass = Boolean(options.stopAfterSurpass);
    const watchdogMs = Math.max(3600, timeLimitMs + 900);

    return new Promise((resolve, reject) => {
      const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const worker = new Worker(
        new URL('../workers/solverWorker.js', import.meta.url),
        { type: 'module' }
      );

      const cleanup = () => {
        const task = tasksRef.current.get(requestId);
        if (!task) return;
        clearTimeout(task.timer);
        tasksRef.current.delete(requestId);
        task.worker.terminate();
      };

      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error('AI worker timeout'));
      }, watchdogMs);

      worker.onmessage = (event) => {
        const payload = event.data || {};
        if (payload.requestId !== requestId) return;
        cleanup();
        if (payload.error) {
          reject(new Error(payload.error));
          return;
        }
        resolve(payload.result);
      };

      worker.onerror = () => {
        cleanup();
        reject(new Error('AI worker failed'));
      };

      tasksRef.current.set(requestId, { worker, resolve, reject, timer });
      worker.postMessage({
        requestId,
        cards,
        trumpRank,
        timeLimitMs,
        maxBranch,
        topK,
        targetScore,
        stopAfterSurpass
      });
    });
  }

  function cancelPendingSearches(reason = 'AI worker task cancelled') {
    for (const task of tasksRef.current.values()) {
      clearTimeout(task.timer);
      task.reject(new Error(reason));
      task.worker.terminate();
    }
    tasksRef.current.clear();
  }

  return { runAiSearchWithWorker, cancelPendingSearches };
}
