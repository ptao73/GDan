import { describe, it, expect } from 'vitest';
import {
  roundCorrection,
  scoreComboNoRound,
  scoreScheme,
  wildcardUtilityPenalty,
  isolationPenalty
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

describe('roundCorrection（轮次修正）', () => {
  it('8 手及以下加分', () => {
    expect(roundCorrection(7)).toBe(4); // 2*(9-7)
    expect(roundCorrection(8)).toBe(2); // 2*(9-8)
  });

  it('9-10 手为 0', () => {
    expect(roundCorrection(9)).toBe(0);
    expect(roundCorrection(10)).toBe(0);
  });

  it('11 手及以上扣分', () => {
    expect(roundCorrection(11)).toBe(-2);
    expect(roundCorrection(13)).toBe(-6);
  });
});

describe('scoreComboNoRound', () => {
  it('4 炸有火力分', () => {
    const combo = makeCombo('bomb4', 'A', [
      ['S', 'A'],
      ['H', 'A'],
      ['C', 'A'],
      ['D', 'A']
    ]);
    const result = scoreComboNoRound(combo, '2');
    expect(result.burstScore).toBeGreaterThan(0);
  });

  it('天王炸火力分最高', () => {
    const combo = makeCombo('tianwang', 'BJ', [
      ['JOKER', 'BJ'],
      ['JOKER', 'BJ'],
      ['JOKER', 'SJ'],
      ['JOKER', 'SJ']
    ]);
    const result = scoreComboNoRound(combo, '2');
    expect(result.burstScore).toBe(6);
  });

  it('大王单张有控牌分', () => {
    const combo = makeCombo('single', 'BJ', [['JOKER', 'BJ']]);
    const result = scoreComboNoRound(combo, '2');
    expect(result.keyScore).toBe(3);
  });

  it('A 对有控牌分', () => {
    const combo = makeCombo('pair', 'A', [
      ['S', 'A'],
      ['H', 'A']
    ]);
    const result = scoreComboNoRound(combo, '2');
    expect(result.keyScore).toBe(2);
  });
});

describe('wildcardUtilityPenalty（百搭效用惩罚）', () => {
  it('炸弹中使用逢人配不扣分', () => {
    const combo = makeCombo('bomb5', '8', [
      ['S', '8'],
      ['H', '8'],
      ['C', '8'],
      ['D', '8'],
      ['H', '2']
    ]);
    // 打 2 时红桃 2 是逢人配
    combo.cards = combo.cards.map((c) => decorateCard({ ...c }, '2'));
    expect(wildcardUtilityPenalty(combo, '2')).toBe(0);
  });

  it('单张逢人配不扣分（作为控牌）', () => {
    const card = decorateCard({ id: 't-0', suit: 'H', rank: '5' }, '5');
    const combo = { type: 'single', mainRank: '5', cards: [card] };
    expect(wildcardUtilityPenalty(combo, '5')).toBe(0);
  });
});

describe('isolationPenalty（孤立弱牌惩罚）', () => {
  it('低于 8 的单张扣分', () => {
    const combos = [makeCombo('single', '3', [['S', '3']]), makeCombo('single', '4', [['H', '4']])];
    expect(isolationPenalty(combos, '2')).toBe(2);
  });

  it('大小王不算孤立弱牌', () => {
    const combos = [
      makeCombo('single', 'BJ', [['JOKER', 'BJ']]),
      makeCombo('single', 'SJ', [['JOKER', 'SJ']])
    ];
    expect(isolationPenalty(combos, '2')).toBe(0);
  });
});

describe('scoreScheme', () => {
  it('返回含 total 和 detail 的结果', () => {
    const combos = [
      makeCombo('bomb4', 'A', [
        ['S', 'A'],
        ['H', 'A'],
        ['C', 'A'],
        ['D', 'A']
      ]),
      makeCombo('pair', 'K', [
        ['S', 'K'],
        ['H', 'K']
      ]),
      makeCombo('single', 'BJ', [['JOKER', 'BJ']])
    ];
    const result = scoreScheme(combos, '2');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('detail');
    expect(result.detail).toHaveProperty('handCount', 3);
    expect(result.detail).not.toHaveProperty('strategy');
  });

  it('总分 = 牌型分 + 火力分 + 控牌分 + 轮次修正 - 孤立弱牌惩罚', () => {
    const combos = [
      makeCombo('bomb4', 'A', [
        ['S', 'A'],
        ['H', 'A'],
        ['C', 'A'],
        ['D', 'A']
      ])
    ];
    const result = scoreScheme(combos, '2');
    const d = result.detail;
    expect(result.total).toBe(
      d.shapeScore + d.burstScore + d.keyScore + d.roundScore - d.isolationPenalty
    );
  });
});
