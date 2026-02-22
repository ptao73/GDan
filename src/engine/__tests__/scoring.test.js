import { describe, it, expect } from 'vitest';
import {
  handTypeScore,
  roundCorrection,
  scoreComboNoRound,
  scoreScheme,
  wildcardUtilityPenalty
} from '../scoring.js';
import { decorateCard } from '../cards.js';

function makeCombo(type, mainRank, cards, extra = {}) {
  return {
    type,
    mainRank,
    cards: cards.map((spec, i) =>
      decorateCard({ id: `t-${i}`, suit: spec[0], rank: spec[1] }, '2')
    ),
    label: type,
    ...extra
  };
}

describe('handTypeScore — 单张', () => {
  it('大王 +2', () => {
    const combo = makeCombo('single', 'BJ', [['JOKER', 'BJ']]);
    expect(handTypeScore(combo, '2')).toBe(2);
  });

  it('小王 +1', () => {
    const combo = makeCombo('single', 'SJ', [['JOKER', 'SJ']]);
    expect(handTypeScore(combo, '2')).toBe(1);
  });

  it('A / K / Q / J / 级牌 +1', () => {
    expect(handTypeScore(makeCombo('single', 'A', [['S', 'A']]), '2')).toBe(1);
    expect(handTypeScore(makeCombo('single', 'K', [['S', 'K']]), '2')).toBe(1);
    expect(handTypeScore(makeCombo('single', 'J', [['S', 'J']]), '2')).toBe(1);
    // 级牌（打 5 时红桃 5 是逢人配）
    const wc = makeCombo('single', '5', [['H', '5']]);
    wc.cards = wc.cards.map((c) => decorateCard({ ...c }, '5'));
    expect(handTypeScore(wc, '5')).toBe(1);
  });

  it('8-10 = 0', () => {
    expect(handTypeScore(makeCombo('single', '8', [['S', '8']]), '2')).toBe(0);
    expect(handTypeScore(makeCombo('single', '10', [['S', '10']]), '2')).toBe(0);
  });

  it('≤7 = -1', () => {
    expect(handTypeScore(makeCombo('single', '3', [['S', '3']]), '2')).toBe(-1);
    expect(handTypeScore(makeCombo('single', '7', [['S', '7']]), '2')).toBe(-1);
  });
});

describe('handTypeScore — 对子', () => {
  it('A 对 +1', () => {
    const combo = makeCombo('pair', 'A', [['S', 'A'], ['H', 'A']]);
    expect(handTypeScore(combo, '2')).toBe(1);
  });

  it('K 对 +1', () => {
    const combo = makeCombo('pair', 'K', [['S', 'K'], ['H', 'K']]);
    expect(handTypeScore(combo, '2')).toBe(1);
  });

  it('级牌对 +1', () => {
    const combo = makeCombo('pair', '5', [['S', '5'], ['D', '5']]);
    expect(handTypeScore(combo, '5')).toBe(1);
  });

  it('8-10 对 = 0', () => {
    expect(handTypeScore(makeCombo('pair', '10', [['S', '10'], ['H', '10']]), '2')).toBe(0);
  });

  it('≤7 对 = -1', () => {
    expect(handTypeScore(makeCombo('pair', '3', [['S', '3'], ['H', '3']]), '2')).toBe(-1);
  });
});

describe('handTypeScore — 三带二', () => {
  it('主牌 ≤9 = 0', () => {
    const combo = makeCombo('threeWithPair', '7', [
      ['S', '7'], ['H', '7'], ['C', '7'], ['S', '3'], ['H', '3']
    ], { tripleRank: '7', pairRank: '3' });
    expect(handTypeScore(combo, '2')).toBe(0);
  });

  it('主牌 10+ = +1', () => {
    const combo = makeCombo('threeWithPair', 'K', [
      ['S', 'K'], ['H', 'K'], ['C', 'K'], ['S', '3'], ['H', '3']
    ], { tripleRank: 'K', pairRank: '3' });
    expect(handTypeScore(combo, '2')).toBe(1);
  });
});

describe('handTypeScore — 木板/钢板', () => {
  it('主牌 ≤7 = +1', () => {
    const combo = makeCombo('wood', '5', [
      ['S', '4'], ['H', '4'], ['S', '5'], ['H', '5']
    ]);
    expect(handTypeScore(combo, '2')).toBe(1);
  });

  it('主牌 8+ = +2', () => {
    const combo = makeCombo('wood', '9', [
      ['S', '8'], ['H', '8'], ['S', '9'], ['H', '9']
    ]);
    expect(handTypeScore(combo, '2')).toBe(2);
  });
});

describe('handTypeScore — 顺子', () => {
  it('主牌 ≤9 = 0', () => {
    const combo = makeCombo('straight', '9', [
      ['S', '5'], ['H', '6'], ['C', '7'], ['D', '8'], ['S', '9']
    ]);
    expect(handTypeScore(combo, '2')).toBe(0);
  });

  it('主牌 10+ = +1', () => {
    const combo = makeCombo('straight', 'A', [
      ['S', '10'], ['H', 'J'], ['C', 'Q'], ['D', 'K'], ['S', 'A']
    ]);
    expect(handTypeScore(combo, '2')).toBe(1);
  });
});

describe('handTypeScore — 炸弹', () => {
  it('天王炸 = +6', () => {
    const combo = makeCombo('tianwang', 'BJ', [
      ['JOKER', 'BJ'], ['JOKER', 'BJ'], ['JOKER', 'SJ'], ['JOKER', 'SJ']
    ]);
    expect(handTypeScore(combo, '2')).toBe(6);
  });

  it('6/7/8 张炸 = +5', () => {
    const combo = makeCombo('bomb6', 'A', [
      ['S', 'A'], ['H', 'A'], ['C', 'A'], ['D', 'A'], ['S', 'A'], ['H', 'A']
    ]);
    expect(handTypeScore(combo, '2')).toBe(5);
  });

  it('同花顺 = +4', () => {
    const combo = makeCombo('straightFlush', 'A', [
      ['S', '10'], ['S', 'J'], ['S', 'Q'], ['S', 'K'], ['S', 'A']
    ]);
    expect(handTypeScore(combo, '2')).toBe(4);
  });

  it('常规炸弹 主牌 J+ = +3', () => {
    const combo = makeCombo('bomb4', 'A', [
      ['S', 'A'], ['H', 'A'], ['C', 'A'], ['D', 'A']
    ]);
    expect(handTypeScore(combo, '2')).toBe(3);
  });

  it('常规炸弹 主牌 ≤10 = +2', () => {
    const combo = makeCombo('bomb4', '7', [
      ['S', '7'], ['H', '7'], ['C', '7'], ['D', '7']
    ]);
    expect(handTypeScore(combo, '2')).toBe(2);
  });

  it('5 张炸弹 主牌 K = +3', () => {
    const combo = makeCombo('bomb5', 'K', [
      ['S', 'K'], ['H', 'K'], ['C', 'K'], ['D', 'K'], ['S', 'K']
    ]);
    expect(handTypeScore(combo, '2')).toBe(3);
  });
});

describe('roundCorrection（轮次修正 v3.1）', () => {
  it('≤7 轮加分：(8-BT)×3', () => {
    expect(roundCorrection(7)).toBe(3);
    expect(roundCorrection(6)).toBe(6);
    expect(roundCorrection(5)).toBe(9);
  });

  it('8-11 轮为 0', () => {
    expect(roundCorrection(8)).toBe(0);
    expect(roundCorrection(9)).toBe(0);
    expect(roundCorrection(10)).toBe(0);
    expect(roundCorrection(11)).toBe(0);
  });

  it('≥12 轮扣分：(11-BT)×3', () => {
    expect(roundCorrection(12)).toBe(-3);
    expect(roundCorrection(13)).toBe(-6);
  });
});

describe('scoreComboNoRound', () => {
  it('返回 { total } 与 handTypeScore 一致', () => {
    const combo = makeCombo('bomb4', 'A', [
      ['S', 'A'], ['H', 'A'], ['C', 'A'], ['D', 'A']
    ]);
    const result = scoreComboNoRound(combo, '2');
    expect(result.total).toBe(3);
  });
});

describe('scoreScheme', () => {
  it('总分 = Σ 牌型得分 + 轮次得分', () => {
    const combos = [
      makeCombo('bomb4', 'A', [['S', 'A'], ['H', 'A'], ['C', 'A'], ['D', 'A']]),
      makeCombo('pair', 'K', [['S', 'K'], ['H', 'K']]),
      makeCombo('single', 'BJ', [['JOKER', 'BJ']])
    ];
    const result = scoreScheme(combos, '2');
    // bomb4 A = +3, pair K = +1, single BJ = +2 → 牌型合计 6
    // 3 手 → turnScore = (8-3)*3 = 15
    expect(result.total).toBe(6 + 15);
    expect(result.detail.handCount).toBe(3);
    expect(result.detail.turnScore).toBe(15);
  });

  it('detail 不含旧版子分数字段', () => {
    const combos = [makeCombo('single', 'BJ', [['JOKER', 'BJ']])];
    const result = scoreScheme(combos, '2');
    expect(result.detail).not.toHaveProperty('shapeScore');
    expect(result.detail).not.toHaveProperty('burstScore');
    expect(result.detail).not.toHaveProperty('keyScore');
    expect(result.detail).not.toHaveProperty('strategy');
  });
});

describe('wildcardUtilityPenalty（搜索启发式）', () => {
  it('炸弹中使用逢人配不扣分', () => {
    const combo = makeCombo('bomb5', '8', [
      ['S', '8'], ['H', '8'], ['C', '8'], ['D', '8'], ['H', '2']
    ]);
    combo.cards = combo.cards.map((c) => decorateCard({ ...c }, '2'));
    expect(wildcardUtilityPenalty(combo, '2')).toBe(0);
  });

  it('单张逢人配不扣分', () => {
    const card = decorateCard({ id: 't-0', suit: 'H', rank: '5' }, '5');
    const combo = { type: 'single', mainRank: '5', cards: [card] };
    expect(wildcardUtilityPenalty(combo, '5')).toBe(0);
  });
});
