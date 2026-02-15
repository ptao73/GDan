import { solveBestScheme } from '../engine/solver.js';

self.onmessage = (event) => {
  const { requestId, cards, trumpRank, timeLimitMs } = event.data || {};

  try {
    const result = solveBestScheme(cards || [], trumpRank, {
      timeLimitMs: typeof timeLimitMs === 'number' ? timeLimitMs : 3000
    });

    self.postMessage({ requestId, result });
  } catch (error) {
    self.postMessage({
      requestId,
      error: error instanceof Error ? error.message : 'AI worker failed'
    });
  }
};
