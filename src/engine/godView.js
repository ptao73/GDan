import { isBomb } from './combos.js';
import { solveBestScheme } from './solver.js';

export const SEAT_NAME = {
  E: '东',
  S: '南',
  W: '西',
  N: '北'
};

const SEAT_ORDER = ['E', 'S', 'W', 'N'];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toPercent(value) {
  return Math.round(clamp(value, 0, 1) * 100);
}

function countFireCombos(combos = []) {
  return combos.filter((combo) => isBomb(combo.type)).length;
}

function countBombCombos(combos = []) {
  return combos.filter((combo) => isBomb(combo.type)).length;
}

function countSingles(combos = []) {
  return combos.filter((combo) => combo.type === 'single').length;
}

function seatDistance(from, to) {
  const a = SEAT_ORDER.indexOf(from);
  const b = SEAT_ORDER.indexOf(to);
  if (a < 0 || b < 0) return 0;
  return (b - a + SEAT_ORDER.length) % SEAT_ORDER.length;
}

function teammateSeatOf(seat) {
  const index = SEAT_ORDER.indexOf(seat);
  if (index < 0) return 'W';
  return SEAT_ORDER[(index + 2) % SEAT_ORDER.length];
}

function resolveRole(seat, userSeat) {
  if (seat === userSeat) return 'self';
  if (seat === teammateSeatOf(userSeat)) return 'teammate';
  return 'opponent';
}

function snapshotScheme(result) {
  const combos = result?.combos || [];
  const detail = result?.detail || {};
  return {
    score: result?.score ?? 0,
    handCount: detail.handCount ?? combos.length,
    shapeScore: detail.shapeScore ?? 0,
    burstScore: detail.burstScore ?? 0,
    keyScore: detail.keyScore ?? 0,
    fireCount: countFireCombos(combos),
    bombCount: countBombCombos(combos),
    singleCount: countSingles(combos),
    combos: combos.slice(),
    rawResult: result || null
  };
}

function threatScore(snapshot, role) {
  const base =
    snapshot.fireCount * 11 +
    Math.max(0, 10 - snapshot.handCount) * 5 +
    snapshot.keyScore * 2 +
    snapshot.burstScore * 2 -
    snapshot.singleCount * 1.5;
  if (role === 'self') return Math.max(0, Math.round(base * 0.85));
  if (role === 'teammate') return Math.max(0, Math.round(base * 0.92));
  return Math.max(0, Math.round(base * 1.08));
}

function averageSnapshot(players, role) {
  const scoped = players.filter((item) => item.role === role);
  if (scoped.length === 0) {
    return {
      handCount: 0,
      fireCount: 0,
      keyScore: 0
    };
  }

  return {
    handCount: scoped.reduce((sum, item) => sum + item.preferred.handCount, 0) / scoped.length,
    fireCount: scoped.reduce((sum, item) => sum + item.preferred.fireCount, 0) / scoped.length,
    keyScore: scoped.reduce((sum, item) => sum + item.preferred.keyScore, 0) / scoped.length
  };
}

export function isEndgame(players) {
  if (!players || players.length === 0) return false;
  return players.some((p) => p.role === 'opponent' && p.preferred && p.preferred.handCount <= 4);
}

function interruptionProbability(scheme, opponentsAvg, endgameFlag = false) {
  const egMul = endgameFlag ? 2 : 1;
  const vulnerability =
    scheme.singleCount * 0.9 + scheme.handCount * 0.3 + Math.max(0, 4 - scheme.fireCount) * 0.9;
  const raw =
    0.16 +
    opponentsAvg.fireCount * 0.055 * egMul +
    opponentsAvg.keyScore * 0.018 * egMul +
    vulnerability * 0.026 -
    scheme.fireCount * 0.04 -
    scheme.keyScore * 0.03;
  return clamp(raw, 0.05, 0.95);
}

function controlRecaptureProbability(scheme, opponentsAvg) {
  const raw =
    0.24 +
    scheme.fireCount * 0.08 +
    scheme.keyScore * 0.05 +
    Math.max(0, 8 - scheme.handCount) * 0.05 -
    opponentsAvg.fireCount * 0.02;
  return clamp(raw, 0.05, 0.95);
}

function backupValue(selfSnapshot, teammateSnapshot, opponentsAvg) {
  const teammateMomentum =
    teammateSnapshot.fireCount * 0.08 +
    teammateSnapshot.keyScore * 0.05 +
    Math.max(0, opponentsAvg.handCount - teammateSnapshot.handCount) * 0.07;
  const supportNeed = Math.max(0, selfSnapshot.handCount - teammateSnapshot.handCount) * 0.03;
  const raw = 0.34 + teammateMomentum - supportNeed;
  return clamp(raw, 0.05, 0.95);
}

function summarizeComposition(scheme, opponentsAvg, endgameFlag = false) {
  const interrupt = interruptionProbability(scheme, opponentsAvg, endgameFlag);
  const recapture = controlRecaptureProbability(scheme, opponentsAvg);

  const explanationParts = [];
  if (scheme.fireCount >= 3) {
    explanationParts.push(`火力充足（${scheme.fireCount} 个炸弹）`);
  }
  if (scheme.singleCount >= 4) {
    explanationParts.push(`孤张较多（${scheme.singleCount} 张），容易被管住`);
  }
  if (opponentsAvg.fireCount > 3) {
    explanationParts.push('对手炸弹强，建议优先保护自己不被管住');
  }

  const explanation =
    explanationParts.length > 0
      ? explanationParts.join('；') + '。'
      : '当前组牌方案较为均衡。';

  return {
    ...scheme,
    interruptionProbability: toPercent(interrupt),
    controlRecapture: toPercent(recapture),
    explanation
  };
}

export function analyzeTribute(selfCards, opponentCards, trumpRank, options = {}) {
  const timeLimitMs = options.timeLimitMs ?? 400;
  const maxBranch = options.maxBranch ?? 16;

  if (!selfCards || selfCards.length === 0 || !opponentCards || !trumpRank) {
    return null;
  }

  // 对手当前 baseline fireCount
  const baselineResult = solveBestScheme(opponentCards, trumpRank, {
    timeLimitMs,
    maxBranch,
    topK: 1
  });
  const baselineFireCount = snapshotScheme(baselineResult).fireCount;

  // 只分析大牌（A、K、Q）和配牌，避免遍历所有 27 张
  const seen = new Set();
  const candidates = selfCards.filter((card) => {
    const key = `${card.suit}-${card.rank}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const results = candidates.map((card) => {
    // 自己移除该牌后的手牌
    const selfAfter = selfCards.filter((c) => c.id !== card.id);
    // 对手获得该牌后的手牌
    const oppAfter = [...opponentCards, card];

    const selfResult = solveBestScheme(selfAfter, trumpRank, {
      timeLimitMs,
      maxBranch,
      topK: 1
    });
    const selfFireAfter = snapshotScheme(selfResult).fireCount;

    const oppResult = solveBestScheme(oppAfter, trumpRank, {
      timeLimitMs,
      maxBranch,
      topK: 1
    });
    const oppFireAfter = snapshotScheme(oppResult).fireCount;

    return {
      card,
      oppFireDelta: oppFireAfter - baselineFireCount,
      selfFireLoss: selfFireAfter,
      risk: oppFireAfter - baselineFireCount
    };
  });

  // 按风险排序：risk 最小的 = 最优进贡牌
  results.sort((a, b) => a.risk - b.risk);

  return {
    best: results[0] || null,
    worst: results[results.length - 1] || null,
    all: results
  };
}

function normalizePlayers(tableDealPlayers = []) {
  const bySeat = new Map(
    tableDealPlayers.map((player) => [
      player.seat,
      { seat: player.seat, cards: player.cards || [] }
    ])
  );
  return SEAT_ORDER.map((seat) => bySeat.get(seat) || { seat, cards: [] });
}

export function analyzeGodView(
  tableDeal,
  { userSeat = 'E', timeLimitMs = 1800, maxBranch = 24 } = {}
) {
  const players = normalizePlayers(tableDeal?.players || []);
  const trumpRank = tableDeal?.trumpRank;
  if (!trumpRank) {
    return null;
  }

  const evaluatedPlayers = players.map((player) => {
    const result = solveBestScheme(player.cards, trumpRank, {
      timeLimitMs,
      maxBranch,
      topK: 2
    });
    const role = resolveRole(player.seat, userSeat);
    const preferred = snapshotScheme(result);

    return {
      seat: player.seat,
      seatName: SEAT_NAME[player.seat] || player.seat,
      role,
      relativePos: seatDistance(userSeat, player.seat),
      cards: player.cards,
      preferred,
      threatScore: 0
    };
  });

  const opponentAvg = averageSnapshot(evaluatedPlayers, 'opponent');
  const selfPlayer = evaluatedPlayers.find((player) => player.role === 'self');
  const teammatePlayer = evaluatedPlayers.find((player) => player.role === 'teammate');

  const withThreats = evaluatedPlayers.map((player) => ({
    ...player,
    threatScore: threatScore(player.preferred, player.role)
  }));

  const sortedThreats = [...withThreats]
    .filter((player) => player.role !== 'self')
    .sort((a, b) => b.threatScore - a.threatScore)
    .map((player, index) => ({
      seat: player.seat,
      seatName: player.seatName,
      role: player.role,
      threatScore: player.threatScore,
      rank: index + 1
    }));

  const endgameFlag = isEndgame(evaluatedPlayers);

  const defaultSnapshot = {
    score: 0,
    handCount: 0,
    shapeScore: 0,
    burstScore: 0,
    keyScore: 0,
    fireCount: 0,
    bombCount: 0,
    singleCount: 0,
    combos: []
  };

  const selfSnapshot = selfPlayer?.preferred || defaultSnapshot;
  const mateSnapshot = teammatePlayer?.preferred || defaultSnapshot;
  const composition = summarizeComposition(selfSnapshot, opponentAvg, endgameFlag);

  const interruption = interruptionProbability(selfSnapshot, opponentAvg, endgameFlag);
  const backup = backupValue(selfSnapshot, mateSnapshot, opponentAvg);

  // 进贡分析：自己的牌 vs 威胁最大的对手
  const topOpponent = sortedThreats.find((t) => t.role === 'opponent');
  const topOpponentPlayer = topOpponent
    ? evaluatedPlayers.find((p) => p.seat === topOpponent.seat)
    : null;
  const tribute =
    selfPlayer && topOpponentPlayer
      ? analyzeTribute(selfPlayer.cards, topOpponentPlayer.cards, trumpRank, {
          timeLimitMs: Math.min(timeLimitMs, 400),
          maxBranch: Math.min(maxBranch, 16)
        })
      : null;

  return {
    generatedAt: Date.now(),
    endgameFlag,
    trumpRank,
    userSeat,
    teammateSeat: teammateSeatOf(userSeat),
    players: withThreats,
    threats: sortedThreats,
    overview: {
      opponentFireTotal: withThreats
        .filter((player) => player.role === 'opponent')
        .reduce((sum, player) => sum + player.preferred.fireCount, 0),
      teammateFireTotal: mateSnapshot.fireCount,
      opponentBombTotal: withThreats
        .filter((player) => player.role === 'opponent')
        .reduce((sum, player) => sum + player.preferred.bombCount, 0),
      teammateBombTotal: mateSnapshot.bombCount
    },
    realtime: {
      handsToFinish: withThreats.map((player) => ({
        seat: player.seat,
        seatName: player.seatName,
        role: player.role,
        hands: player.preferred.handCount
      })),
      interruptionProbability: toPercent(interruption),
      backupValue: toPercent(backup)
    },
    composition,
    tribute
  };
}
