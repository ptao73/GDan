import { describe, it, expect } from 'vitest';
import { detectComboTypes, isBomb, isFireCombo } from '../combos.js';
import { decorateCard } from '../cards.js';

// 辅助函数：快速创建带装饰的牌
function makeCards(specs, trumpRank = '2') {
  return specs.map((spec, i) => {
    const card = { id: `t-${i}`, suit: spec[0], rank: spec[1] };
    return decorateCard(card, trumpRank);
  });
}

describe('detectComboTypes - 单张', () => {
  it('任意一张牌都是单张', () => {
    const cards = makeCards([['S', 'A']]);
    const types = detectComboTypes(cards, '2');
    expect(types.some((d) => d.type === 'single')).toBe(true);
  });
});

describe('detectComboTypes - 对子', () => {
  it('两张同点数是对子', () => {
    const cards = makeCards([['S', '5'], ['H', '5']]);
    const types = detectComboTypes(cards, '2');
    expect(types.some((d) => d.type === 'pair')).toBe(true);
  });

  it('两张不同点数不是对子', () => {
    const cards = makeCards([['S', '5'], ['H', '6']]);
    const types = detectComboTypes(cards, '2');
    expect(types.some((d) => d.type === 'pair')).toBe(false);
  });

  it('逢人配 + 任意牌可组对子', () => {
    // 打 5，红桃 5 是逢人配
    const cards = makeCards([['H', '5'], ['S', 'K']], '5');
    const types = detectComboTypes(cards, '5');
    expect(types.some((d) => d.type === 'pair')).toBe(true);
  });
});

describe('detectComboTypes - 三条', () => {
  it('三张同点数是三条', () => {
    const cards = makeCards([['S', '7'], ['H', '7'], ['C', '7']]);
    const types = detectComboTypes(cards, '2');
    expect(types.some((d) => d.type === 'triple')).toBe(true);
  });
});

describe('detectComboTypes - 炸弹', () => {
  it('四张同点数是 4 炸', () => {
    const cards = makeCards([['S', '8'], ['H', '8'], ['C', '8'], ['D', '8']]);
    const types = detectComboTypes(cards, '2');
    expect(types.some((d) => d.type === 'bomb4')).toBe(true);
  });

  it('五张同点数是 5 炸', () => {
    const cards = makeCards([
      ['S', '8'], ['H', '8'], ['C', '8'], ['D', '8'], ['S', '8']
    ], '3');
    // 两副牌只有 4 张同花色，但五张同点数用逢人配
    // 这里用打 3 时 5 张 8（两副牌中 4 张 + 逢人配红桃3）
    const cardsWild = makeCards([
      ['S', '8'], ['H', '8'], ['C', '8'], ['D', '8'], ['H', '3']
    ], '3');
    const types = detectComboTypes(cardsWild, '3');
    expect(types.some((d) => d.type === 'bomb5')).toBe(true);
  });

  it('天王炸：两大王 + 两小王', () => {
    const cards = [
      decorateCard({ id: 't-0', suit: 'JOKER', rank: 'BJ' }, '2'),
      decorateCard({ id: 't-1', suit: 'JOKER', rank: 'BJ' }, '2'),
      decorateCard({ id: 't-2', suit: 'JOKER', rank: 'SJ' }, '2'),
      decorateCard({ id: 't-3', suit: 'JOKER', rank: 'SJ' }, '2')
    ];
    const types = detectComboTypes(cards, '2');
    expect(types.some((d) => d.type === 'tianwang')).toBe(true);
  });
});

describe('detectComboTypes - 顺子', () => {
  it('5 张连续牌是顺子', () => {
    const cards = makeCards([
      ['S', '3'], ['H', '4'], ['C', '5'], ['D', '6'], ['S', '7']
    ]);
    const types = detectComboTypes(cards, '2');
    expect(types.some((d) => d.type === 'straight')).toBe(true);
  });

  it('配牌补位的高位 A 顺子：♠J ♠Q ♠K ♠A + 配牌 = 10-J-Q-K-A', () => {
    // 当前打 J，红心 J 是配牌，应充当 10 组成顺子
    const cards = makeCards([
      ['S', 'J'], ['S', 'Q'], ['S', 'K'], ['S', 'A'], ['H', 'J']
    ], 'J');
    const types = detectComboTypes(cards, 'J');
    expect(types.some((d) => d.type === 'straight')).toBe(true);
  });

  it('配牌补位的低位 A 顺子：♠A ♠2 ♠3 ♠4 + 配牌 = A-2-3-4-5', () => {
    const cards = makeCards([
      ['S', 'A'], ['S', '2'], ['S', '3'], ['S', '4'], ['H', 'J']
    ], 'J');
    const types = detectComboTypes(cards, 'J');
    expect(types.some((d) => d.type === 'straight')).toBe(true);
  });

  it('不连续的 5 张不是顺子', () => {
    const cards = makeCards([
      ['S', '3'], ['H', '4'], ['C', '5'], ['D', '6'], ['S', '9']
    ]);
    const types = detectComboTypes(cards, '2');
    expect(types.some((d) => d.type === 'straight')).toBe(false);
  });
});

describe('detectComboTypes - 三带二', () => {
  it('3 + 2 结构是三带二', () => {
    const cards = makeCards([
      ['S', 'J'], ['H', 'J'], ['C', 'J'], ['D', '9'], ['S', '9']
    ]);
    const types = detectComboTypes(cards, '2');
    expect(types.some((d) => d.type === 'threeWithPair')).toBe(true);
  });
});

describe('detectComboTypes - 木板和钢板', () => {
  it('三连对是木板', () => {
    const cards = makeCards([
      ['S', '5'], ['H', '5'], ['S', '6'], ['H', '6'], ['S', '7'], ['H', '7']
    ]);
    const types = detectComboTypes(cards, '2');
    expect(types.some((d) => d.type === 'wood')).toBe(true);
  });

  it('二连三条是钢板', () => {
    const cards = makeCards([
      ['S', '5'], ['H', '5'], ['C', '5'], ['S', '6'], ['H', '6'], ['C', '6']
    ]);
    const types = detectComboTypes(cards, '2');
    expect(types.some((d) => d.type === 'steel')).toBe(true);
  });
});

describe('isBomb / isFireCombo', () => {
  it('bomb4 是炸弹', () => {
    expect(isBomb('bomb4')).toBe(true);
  });

  it('tianwang 是炸弹', () => {
    expect(isBomb('tianwang')).toBe(true);
  });

  it('straight 不是炸弹', () => {
    expect(isBomb('straight')).toBe(false);
  });

  it('straightFlush 是火力牌型', () => {
    expect(isFireCombo('straightFlush')).toBe(true);
  });

  it('pair 不是火力牌型', () => {
    expect(isFireCombo('pair')).toBe(false);
  });
});
