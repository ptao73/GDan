const DB_NAME = 'guandan-trainer-db';
const DB_VERSION = 1;
const STORE_NAME = 'games';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
  });
}

async function withStore(mode, executor) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);

    let result;
    try {
      result = executor(store, transaction);
    } catch (error) {
      reject(error);
      db.close();
      return;
    }

    transaction.oncomplete = () => {
      resolve(result);
      db.close();
    };
    transaction.onerror = () => {
      reject(transaction.error || new Error('IndexedDB transaction failed'));
      db.close();
    };
  });
}

function readAllRecords() {
  return withStore('readonly', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error('Failed to load records'));
    });
  });
}

function toSortedHistory(records, limit) {
  const sorted = [...records].sort((a, b) => b.timestamp - a.timestamp);
  if (typeof limit === 'number') {
    return sorted.slice(0, limit);
  }
  return sorted;
}

function isBombType(type) {
  return type === 'bomb4' || type === 'bomb5' || type === 'bomb6' || type === 'bomb7' || type === 'bomb8' || type === 'tianwang';
}

function countBombs(combos = []) {
  return combos.filter((combo) => isBombType(combo.type)).length;
}

function countWildcardUsage(combos = []) {
  let used = 0;
  for (const combo of combos) {
    for (const card of combo.cards || []) {
      if (card.isWildcard) {
        used += 1;
      }
    }
  }
  return used;
}

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toPercent(value) {
  return Number((value * 100).toFixed(1));
}

function buildSuggestions(stats) {
  const suggestions = [];

  if (stats.totalGames < 6) {
    suggestions.push('样本局数较少，建议先完成至少 20 局再看偏好结论。');
    return suggestions;
  }

  if (stats.avgGap > 4) {
    suggestions.push('你与 AI 平均分差偏大，优先练习减少手数与保留高价值炸弹。');
  }

  if (stats.userBombAvg + 0.35 < stats.aiBombAvg) {
    suggestions.push('你偏向拆炸弹去补结构，统计显示可尝试提高炸弹保留率。');
  }

  if (stats.userHandsAvg - stats.aiHandsAvg > 0.6) {
    suggestions.push('你的平均手数高于 AI，建议优先考虑顺子/木板降低总手数。');
  }

  if (stats.wildcardAsSingleRate > 0.4) {
    suggestions.push('逢人配作为单张留存比例偏高，可尝试优先用于高收益结构。');
  }

  if (suggestions.length === 0) {
    suggestions.push('当前组牌习惯较稳定，建议继续提升复杂牌局下的手数控制。');
  }

  return suggestions;
}

function buildStats(records) {
  const totalGames = records.length;

  if (totalGames === 0) {
    return {
      totalGames: 0,
      optimalHits: 0,
      hitRate: 0,
      avgGap: 0,
      gapBuckets: {
        equal: 0,
        close: 0,
        medium: 0,
        wide: 0
      },
      userBombAvg: 0,
      aiBombAvg: 0,
      userHandsAvg: 0,
      aiHandsAvg: 0,
      wildcardAsSingleRate: 0,
      suggestions: ['暂无历史数据，先开始组牌训练。']
    };
  }

  const gaps = records.map((item) => Math.max(0, (item.aiScore || 0) - (item.userScore || 0)));
  const optimalHits = records.filter((item) => item.isOptimal).length;

  const userBombAvg = average(records.map((item) => countBombs(item.userCombos)));
  const aiBombAvg = average(records.map((item) => countBombs(item.aiCombos)));

  const userHandsAvg = average(
    records.map((item) => (item.userScoreDetail?.handCount ? item.userScoreDetail.handCount : item.userCombos?.length || 0))
  );

  const aiHandsAvg = average(
    records.map((item) => (item.aiScoreDetail?.handCount ? item.aiScoreDetail.handCount : item.aiCombos?.length || 0))
  );

  let wildcardAsSingleCount = 0;
  let wildcardTotal = 0;
  for (const item of records) {
    const userCombos = item.userCombos || [];
    for (const combo of userCombos) {
      for (const card of combo.cards || []) {
        if (card.isWildcard) {
          wildcardTotal += 1;
          if (combo.type === 'single') {
            wildcardAsSingleCount += 1;
          }
        }
      }
    }
  }

  const gapBuckets = {
    equal: gaps.filter((gap) => gap === 0).length,
    close: gaps.filter((gap) => gap >= 1 && gap <= 2).length,
    medium: gaps.filter((gap) => gap >= 3 && gap <= 5).length,
    wide: gaps.filter((gap) => gap >= 6).length
  };

  const stats = {
    totalGames,
    optimalHits,
    hitRate: toPercent(optimalHits / totalGames),
    avgGap: Number(average(gaps).toFixed(2)),
    gapBuckets,
    userBombAvg: Number(userBombAvg.toFixed(2)),
    aiBombAvg: Number(aiBombAvg.toFixed(2)),
    userHandsAvg: Number(userHandsAvg.toFixed(2)),
    aiHandsAvg: Number(aiHandsAvg.toFixed(2)),
    wildcardAsSingleRate: wildcardTotal === 0 ? 0 : Number((wildcardAsSingleCount / wildcardTotal).toFixed(2))
  };

  return {
    ...stats,
    suggestions: buildSuggestions(stats)
  };
}

export const DataService = {
  async saveGame(record) {
    await withStore('readwrite', (store) => {
      store.put(record);
    });
  },

  async getHistory(limit = 50) {
    const records = await readAllRecords();
    return toSortedHistory(records, limit);
  },

  async getStats() {
    const records = await readAllRecords();
    return buildStats(records);
  },

  async exportData() {
    const records = await readAllRecords();
    return JSON.stringify(toSortedHistory(records), null, 2);
  },

  async importData(jsonText) {
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (error) {
      throw new Error('导入失败：JSON 格式不正确');
    }

    if (!Array.isArray(parsed)) {
      throw new Error('导入失败：数据必须是数组');
    }

    await withStore('readwrite', (store) => {
      for (const item of parsed) {
        if (!item || typeof item !== 'object' || !item.id) {
          continue;
        }
        store.put(item);
      }
    });

    return parsed.length;
  }
};
