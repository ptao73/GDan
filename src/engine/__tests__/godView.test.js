import { describe, it, expect } from 'vitest';
import { createTableDeal } from '../cards.js';
import { analyzeGodView, isEndgame, analyzeTribute } from '../godView.js';

describe('analyzeGodView', () => {
  it('返回包含所有必需字段的分析结果', () => {
    const deal = createTableDeal();
    const result = analyzeGodView(deal, { userSeat: 'E', timeLimitMs: 300, maxBranch: 12 });

    expect(result).not.toBeNull();
    expect(result.trumpRank).toBe(deal.trumpRank);
    expect(result.userSeat).toBe('E');
    expect(result.players).toHaveLength(4);
    expect(typeof result.endgameFlag).toBe('boolean');
    expect(result.composition).toBeDefined();
    expect(typeof result.composition.explanation).toBe('string');
    expect(result.composition.explanation.length).toBeGreaterThan(0);
    expect(typeof result.composition.interruptionProbability).toBe('number');
    expect(typeof result.composition.controlRecapture).toBe('number');
  });

  it('trumpRank 缺失时返回 null', () => {
    const result = analyzeGodView({ players: [] }, { userSeat: 'E' });
    expect(result).toBeNull();
  });

  it('返回值包含 tribute 字段', () => {
    const deal = createTableDeal();
    const result = analyzeGodView(deal, { userSeat: 'E', timeLimitMs: 300, maxBranch: 12 });
    // tribute 可能为 null（如果没有对手数据），但字段本身应该存在
    expect('tribute' in result).toBe(true);
  });
});

describe('isEndgame', () => {
  it('当对手手数 ≤ 4 时返回 true', () => {
    const players = [
      { role: 'self', preferred: { handCount: 10 } },
      { role: 'teammate', preferred: { handCount: 8 } },
      { role: 'opponent', preferred: { handCount: 3 } },
      { role: 'opponent', preferred: { handCount: 7 } }
    ];
    expect(isEndgame(players)).toBe(true);
  });

  it('没有对手手数 ≤ 4 时返回 false', () => {
    const players = [
      { role: 'self', preferred: { handCount: 10 } },
      { role: 'teammate', preferred: { handCount: 8 } },
      { role: 'opponent', preferred: { handCount: 6 } },
      { role: 'opponent', preferred: { handCount: 7 } }
    ];
    expect(isEndgame(players)).toBe(false);
  });

  it('空数组返回 false', () => {
    expect(isEndgame([])).toBe(false);
    expect(isEndgame(null)).toBe(false);
  });
});

describe('analyzeTribute', () => {
  it('对有效输入返回 best 和 worst', () => {
    const deal = createTableDeal();
    const selfPlayer = deal.players.find((p) => p.seat === 'E');
    const opponent = deal.players.find((p) => p.seat === 'S');

    const result = analyzeTribute(selfPlayer.cards, opponent.cards, deal.trumpRank, {
      timeLimitMs: 200,
      maxBranch: 10
    });

    expect(result).not.toBeNull();
    expect(result.best).not.toBeNull();
    expect(result.worst).not.toBeNull();
    expect(result.best.card).toBeDefined();
    expect(typeof result.best.oppFireDelta).toBe('number');
    expect(typeof result.best.risk).toBe('number');
    // best 的 risk 应 ≤ worst 的 risk
    expect(result.best.risk).toBeLessThanOrEqual(result.worst.risk);
  });

  it('空输入返回 null', () => {
    expect(analyzeTribute([], [], '2')).toBeNull();
    expect(analyzeTribute(null, null, '2')).toBeNull();
  });
});

describe('composition explanation', () => {
  it('explanation 包含中文文字', () => {
    const deal = createTableDeal();
    const result = analyzeGodView(deal, { userSeat: 'E', timeLimitMs: 300, maxBranch: 12 });
    // explanation 应包含中文字符
    expect(result.composition.explanation).toMatch(/[\u4e00-\u9fff]/);
  });
});
