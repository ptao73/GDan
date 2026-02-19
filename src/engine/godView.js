import { isFireCombo } from './combos.js';
import { compareSchemeResult, solveDualRecommendation } from './solver.js';

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
  return combos.filter((combo) => isFireCombo(combo.type)).length;
}

function countBombCombos(combos = []) {
  return combos.filter(
    (combo) =>
      combo.type === 'bomb4' ||
      combo.type === 'bomb5' ||
      combo.type === 'bomb6' ||
      combo.type === 'bomb7' ||
      combo.type === 'bomb8' ||
      combo.type === 'tianwang'
  ).length;
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

function preferredScheme(dualResult) {
  if (!dualResult?.ceiling && !dualResult?.control) return null;
  if (!dualResult?.ceiling) return { key: 'stable', result: dualResult.control };
  if (!dualResult?.control) return { key: 'aggressive', result: dualResult.ceiling };
  return compareSchemeResult(dualResult.ceiling, dualResult.control) < 0
    ? { key: 'aggressive', result: dualResult.ceiling }
    : { key: 'stable', result: dualResult.control };
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
    combos: combos.slice(0, 6),
    rawResult: result || null
  };
}

function threatScore(snapshot, role) {
  const base =
    snapshot.fireCount * 11 +
    snapshot.bombCount * 7 +
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

function interruptionProbability(scheme, opponentsAvg) {
  const vulnerability =
    scheme.singleCount * 0.9 +
    scheme.handCount * 0.3 +
    Math.max(0, 4 - scheme.fireCount) * 0.9;
  const raw =
    0.16 +
    opponentsAvg.fireCount * 0.055 +
    opponentsAvg.keyScore * 0.018 +
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

function summarizeOptions(control, aggressive, opponentsAvg) {
  const stableInterrupt = interruptionProbability(control, opponentsAvg);
  const aggressiveInterrupt = interruptionProbability(aggressive, opponentsAvg);
  const stableRecapture = controlRecaptureProbability(control, opponentsAvg);
  const aggressiveRecapture = controlRecaptureProbability(aggressive, opponentsAvg);

  const stableEdge = stableRecapture - stableInterrupt;
  const aggressiveEdge = aggressiveRecapture - aggressiveInterrupt;
  const recommended = aggressiveEdge > stableEdge ? 'aggressive' : 'stable';

  return {
    stable: {
      ...control,
      interruptionProbability: toPercent(stableInterrupt),
      controlRecapture: toPercent(stableRecapture),
      edge: Number(stableEdge.toFixed(3))
    },
    aggressive: {
      ...aggressive,
      interruptionProbability: toPercent(aggressiveInterrupt),
      controlRecapture: toPercent(aggressiveRecapture),
      edge: Number(aggressiveEdge.toFixed(3))
    },
    recommended,
    reason:
      recommended === 'aggressive'
        ? '进攻型的控场收益更高，且被闷住风险没有显著上升。'
        : '稳健型的被闷住概率更低，综合容错更好。'
  };
}

function normalizePlayers(tableDealPlayers = []) {
  const bySeat = new Map(
    tableDealPlayers.map((player) => [player.seat, { seat: player.seat, cards: player.cards || [] }])
  );
  return SEAT_ORDER.map((seat) => bySeat.get(seat) || { seat, cards: [] });
}

export function analyzeGodView(
  tableDeal,
  {
    userSeat = 'E',
    timeLimitMs = 1800,
    maxBranch = 24
  } = {}
) {
  const players = normalizePlayers(tableDeal?.players || []);
  const trumpRank = tableDeal?.trumpRank;
  if (!trumpRank) {
    return null;
  }

  const evaluatedPlayers = players.map((player) => {
    const dual = solveDualRecommendation(player.cards, trumpRank, {
      timeLimitMs,
      maxBranch,
      topK: 2
    });
    const best = preferredScheme(dual);
    const role = resolveRole(player.seat, userSeat);
    const stable = snapshotScheme(dual.control);
    const aggressive = snapshotScheme(dual.ceiling);
    const preferred = best?.key === 'aggressive' ? aggressive : stable;

    return {
      seat: player.seat,
      seatName: SEAT_NAME[player.seat] || player.seat,
      role,
      relativePos: seatDistance(userSeat, player.seat),
      cards: player.cards,
      preferredStrategy: best?.key || 'stable',
      preferred,
      options: {
        stable,
        aggressive
      },
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
  const composition = summarizeOptions(
    selfPlayer?.options?.stable || defaultSnapshot,
    selfPlayer?.options?.aggressive || defaultSnapshot,
    opponentAvg
  );

  const interruption = interruptionProbability(selfSnapshot, opponentAvg);
  const backup = backupValue(selfSnapshot, mateSnapshot, opponentAvg);

  return {
    generatedAt: Date.now(),
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
    composition
  };
}
