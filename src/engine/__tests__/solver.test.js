import { describe, it, expect } from 'vitest';
import { solveBestScheme, compareSchemeResult } from '../solver.js';
import { decorateCard, createTableDeal } from '../cards.js';

// 辅助函数：快速创建带装饰的牌
function makeCards(specs, trumpRank = '2') {
  return specs.map((spec, i) => {
    const card = { id: `t-${i}`, suit: spec[0], rank: spec[1] };
    return decorateCard(card, trumpRank);
  });
}

describe('solveBestScheme', () => {
  it('空手牌返回空结果', () => {
    const result = solveBestScheme([], '2');
    expect(result.combos).toEqual([]);
    expect(result.score).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(result.exact).toBe(true);
    expect(result.searchNodes).toBe(0);
  });

  it('单张牌返回单张 combo', () => {
    const cards = makeCards([['S', 'A']]);
    const result = solveBestScheme(cards, '2');
    expect(result.combos).toHaveLength(1);
    expect(result.combos[0].type).toBe('single');
    expect(result.combos[0].cards).toHaveLength(1);
  });

  it('4 张同 rank 能识别炸弹', () => {
    // 4 张 7 + 1 张单牌
    const cards = makeCards([
      ['S', '7'],
      ['H', '7'],
      ['C', '7'],
      ['D', '7'],
      ['S', '3']
    ]);
    const result = solveBestScheme(cards, '2');
    // 结果应包含炸弹类型
    const hasBomb = result.combos.some((c) => c.type === 'bomb4');
    expect(hasBomb).toBe(true);
    // 所有牌都应被分配
    const totalCards = result.combos.reduce((sum, c) => sum + c.cards.length, 0);
    expect(totalCards).toBe(5);
  });

  it('包含顺子的手牌能正确识别', () => {
    const cards = makeCards([
      ['S', '3'],
      ['H', '4'],
      ['C', '5'],
      ['D', '6'],
      ['S', '7']
    ]);
    const result = solveBestScheme(cards, '2');
    // 5 张连续牌应能形成顺子
    const hasStraight = result.combos.some((c) => c.type === 'straight');
    expect(hasStraight).toBe(true);
  });

  it('包含百搭牌（逢人配）的手牌正确处理', () => {
    // 打 5 时，红桃 5 是逢人配
    const cards = makeCards(
      [
        ['H', '5'],
        ['S', 'A'],
        ['S', 'A']
      ],
      '5'
    );
    const result = solveBestScheme(cards, '5');
    // 所有牌都应被分配
    const totalCards = result.combos.reduce((sum, c) => sum + c.cards.length, 0);
    expect(totalCards).toBe(3);
    expect(result.score).toBeGreaterThan(0);
  });

  it('超时机制：设极短 timeLimitMs 仍能返回结果', () => {
    // 用较多牌让搜索有足够的工作量
    const cards = makeCards([
      ['S', '3'], ['H', '4'], ['C', '5'], ['D', '6'], ['S', '7'],
      ['H', '8'], ['C', '9'], ['D', '10'], ['S', 'J'], ['H', 'Q'],
      ['C', 'K'], ['D', 'A'], ['S', '2']
    ]);
    const result = solveBestScheme(cards, '2', { timeLimitMs: 1 });
    // 即使超时也应返回有效结果
    expect(result.combos.length).toBeGreaterThan(0);
    const totalCards = result.combos.reduce((sum, c) => sum + c.cards.length, 0);
    expect(totalCards).toBe(13);
    expect(typeof result.timedOut).toBe('boolean');
  });

  it('真实 27 张牌局面在合理时间内返回结果', () => {
    const deal = createTableDeal();
    const eastCards = deal.players.find((p) => p.seat === 'E').cards;
    expect(eastCards).toHaveLength(27);

    const start = performance.now();
    const result = solveBestScheme(eastCards, deal.trumpRank, {
      timeLimitMs: 5000,
      maxBranch: 20,
      topK: 3
    });
    const elapsed = performance.now() - start;

    expect(result.combos.length).toBeGreaterThan(0);
    const totalCards = result.combos.reduce((sum, c) => sum + c.cards.length, 0);
    expect(totalCards).toBe(27);
    expect(typeof result.score).toBe('number');
    // 应在 6 秒内完成（留余量）
    expect(elapsed).toBeLessThan(6000);
  });
});

describe('compareSchemeResult', () => {
  it('两个 null 返回 0', () => {
    expect(compareSchemeResult(null, null)).toBe(0);
  });

  it('null vs 有效结果：null 排后面', () => {
    const valid = { score: 10, detail: {}, combos: [] };
    expect(compareSchemeResult(null, valid)).toBe(1);
    expect(compareSchemeResult(valid, null)).toBe(-1);
  });

  it('分数高的排前面', () => {
    const a = { score: 20, detail: {}, combos: [] };
    const b = { score: 10, detail: {}, combos: [] };
    expect(compareSchemeResult(a, b)).toBeLessThan(0);
  });

  it('同分时手数少的排前面', () => {
    const a = { score: 20, detail: { handCount: 5 }, combos: [] };
    const b = { score: 20, detail: { handCount: 8 }, combos: [] };
    expect(compareSchemeResult(a, b)).toBeLessThan(0);
  });

  it('同分同手数时拆炸牌数少的排前面', () => {
    const a = { score: 20, detail: { handCount: 5 }, splitBombCards: 0, combos: [] };
    const b = { score: 20, detail: { handCount: 5 }, splitBombCards: 3, combos: [] };
    expect(compareSchemeResult(a, b)).toBeLessThan(0);
  });
});
