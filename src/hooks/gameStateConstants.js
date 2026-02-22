// 游戏状态管理所需的常量和工具函数
import { compareSchemeResult } from '../engine/solver.js';

export const MATRIX_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const AI_MODE_STORAGE_KEY = 'guandan-ai-search-mode';

export const AI_SEARCH_MODE_OPTIONS = [
  {
    value: 'fast',
    label: '速度优先',
    description: '更快返回结果，适合频繁训练'
  },
  {
    value: 'balanced',
    label: '均衡',
    description: '速度与质量折中（推荐）'
  },
  {
    value: 'quality',
    label: '质量优先',
    description: '更深搜索，耗时更长'
  }
];

export const AI_MODE_LABEL_MAP = Object.fromEntries(
  AI_SEARCH_MODE_OPTIONS.map((item) => [item.value, item.label])
);

export const AI_SEARCH_PROFILES_BY_MODE = {
  fast: [
    { mode: 'worker', timeLimitMs: 1800, maxBranch: 18 },
    { mode: 'worker', timeLimitMs: 2600, maxBranch: 22 },
    { mode: 'local', timeLimitMs: 3200, maxBranch: 24 }
  ],
  balanced: [
    { mode: 'worker', timeLimitMs: 3000, maxBranch: 24 },
    { mode: 'worker', timeLimitMs: 4500, maxBranch: 30 },
    { mode: 'worker', timeLimitMs: 6000, maxBranch: 36 },
    { mode: 'local', timeLimitMs: 6500, maxBranch: 34 },
    { mode: 'local', timeLimitMs: 9000, maxBranch: 44 }
  ],
  quality: [
    { mode: 'worker', timeLimitMs: 4500, maxBranch: 30 },
    { mode: 'worker', timeLimitMs: 7000, maxBranch: 38 },
    { mode: 'worker', timeLimitMs: 9500, maxBranch: 46 },
    { mode: 'local', timeLimitMs: 10000, maxBranch: 44 },
    { mode: 'local', timeLimitMs: 13000, maxBranch: 52 }
  ]
};

export const GOD_VIEW_TIME_LIMIT_MS = {
  fast: 420,
  balanced: 650,
  quality: 920
};

export const GOD_VIEW_MAX_BRANCH = {
  fast: 16,
  balanced: 20,
  quality: 24
};

export function isIosLikeDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isClassicIos = /iPad|iPhone|iPod/.test(ua);
  const isIpadDesktopUa = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return isClassicIos || isIpadDesktopUa;
}

export function resolveAiProfiles(modeKey, iosOptimized) {
  const base = AI_SEARCH_PROFILES_BY_MODE[modeKey] || AI_SEARCH_PROFILES_BY_MODE.balanced;
  if (!iosOptimized) {
    return base;
  }

  const timeCaps = [2200, 3200, 4200, 5200, 6200];
  return base.map((profile, index) => ({
    ...profile,
    timeLimitMs: Math.min(profile.timeLimitMs, timeCaps[index] || 6200),
    maxBranch: Math.max(16, Math.min(profile.maxBranch || 24, profile.mode === 'worker' ? 34 : 30))
  }));
}

export function buildDealKey(cards, trumpRank) {
  if (!cards || cards.length === 0) {
    return '';
  }
  return `${trumpRank}|${cards.map((card) => card.id).join('.')}`;
}

export function buildTableDealKey(tableDeal) {
  if (
    !tableDeal?.trumpRank ||
    !Array.isArray(tableDeal.players) ||
    tableDeal.players.length === 0
  ) {
    return '';
  }

  const seatOrder = ['E', 'S', 'W', 'N'];
  const bySeat = new Map(tableDeal.players.map((player) => [player.seat, player.cards || []]));
  const parts = seatOrder.map((seat) => (bySeat.get(seat) || []).map((card) => card.id).join('.'));
  return `${tableDeal.trumpRank}|${parts.join('/')}`;
}

export function isBetterResult(next, current) {
  return compareSchemeResult(next, current) < 0;
}

export function phaseOneSize(modeKey, profileCount) {
  if (profileCount <= 1) return profileCount;
  return modeKey === 'fast' ? 1 : Math.min(2, profileCount);
}
