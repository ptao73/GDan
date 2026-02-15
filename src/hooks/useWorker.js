import { useEffect, useRef } from 'react';

/**
 * 管理 Web Worker 的生命周期和通信
 * 返回 runAiSearchWithWorker 方法供 AI 搜索调用
 */
export function useWorker() {
  const workerRef = useRef(null);
  const pendingRef = useRef(new Map());

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/solverWorker.js', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (event) => {
      const { requestId, result, error } = event.data || {};
      const pending = pendingRef.current.get(requestId);
      if (!pending) return;

      clearTimeout(pending.timer);
      pendingRef.current.delete(requestId);

      if (error) {
        pending.reject(new Error(error));
      } else {
        pending.resolve(result);
      }
    };

    workerRef.current = worker;

    return () => {
      for (const pending of pendingRef.current.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error('Worker closed'));
      }
      pendingRef.current.clear();
      worker.terminate();
    };
  }, []);

  function runAiSearchWithWorker(cards, trumpRank) {
    const worker = workerRef.current;
    if (!worker) {
      return Promise.reject(new Error('Worker unavailable'));
    }

    return new Promise((resolve, reject) => {
      const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const timer = window.setTimeout(() => {
        pendingRef.current.delete(requestId);
        reject(new Error('AI worker timeout'));
      }, 3600);

      pendingRef.current.set(requestId, { resolve, reject, timer });
      worker.postMessage({ requestId, cards, trumpRank, timeLimitMs: 3000 });
    });
  }

  return { runAiSearchWithWorker };
}
