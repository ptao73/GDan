import { solveBestScheme } from '../engine/solver.js';

self.onmessage = (event) => {
  const {
    requestId,
    cards,
    trumpRank,
    timeLimitMs,
    maxBranch,
    topK,
    targetScore,
    stopAfterSurpass
  } = event.data || {};

  try {
    const solverOptions = {
      timeLimitMs: typeof timeLimitMs === 'number' ? timeLimitMs : 3000,
      maxBranch: typeof maxBranch === 'number' ? maxBranch : undefined,
      topK: typeof topK === 'number' ? topK : undefined,
      targetScore: typeof targetScore === 'number' ? targetScore : undefined,
      stopAfterSurpass: Boolean(stopAfterSurpass)
    };

    const result = solveBestScheme(cards || [], trumpRank, solverOptions);
    self.postMessage({ requestId, result });
  } catch (error) {
    self.postMessage({
      requestId,
      error: error instanceof Error ? error.message : 'AI worker failed'
    });
  }
};
