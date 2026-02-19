import { analyzeGodView } from '../engine/godView.js';

self.onmessage = (event) => {
  const { requestId, tableDeal, userSeat, timeLimitMs, maxBranch } = event.data || {};

  try {
    const result = analyzeGodView(tableDeal, {
      userSeat: userSeat || 'E',
      timeLimitMs: typeof timeLimitMs === 'number' ? timeLimitMs : 650,
      maxBranch: typeof maxBranch === 'number' ? maxBranch : 20
    });
    self.postMessage({ requestId, result });
  } catch (error) {
    self.postMessage({
      requestId,
      error: error instanceof Error ? error.message : 'God view worker failed'
    });
  }
};
