import { describe, it, expect } from 'vitest';
import {
  createFullDeck,
  decorateCard,
  isJoker,
  isWildcardCard,
  cardSortValue,
  sortCards,
  createDeal,
  createTableDeal,
  cardLabel,
  suitLabel,
  isStandardRank,
  rankValue,
  STANDARD_RANKS,
  TABLE_SEATS
} from '../cards.js';

describe('createFullDeck', () => {
  it('生成 108 张牌（两副牌）', () => {
    const deck = createFullDeck();
    expect(deck).toHaveLength(108);
  });

  it('包含 4 张王牌（两副各有大小王）', () => {
    const deck = createFullDeck();
    const jokers = deck.filter((c) => c.rank === 'SJ' || c.rank === 'BJ');
    expect(jokers).toHaveLength(4);
  });

  it('每张牌都有唯一 id', () => {
    const deck = createFullDeck();
    const ids = new Set(deck.map((c) => c.id));
    expect(ids.size).toBe(108);
  });
});

describe('isJoker', () => {
  it('识别小王', () => {
    expect(isJoker({ rank: 'SJ' })).toBe(true);
  });

  it('识别大王', () => {
    expect(isJoker({ rank: 'BJ' })).toBe(true);
  });

  it('普通牌不是王', () => {
    expect(isJoker({ rank: 'A', suit: 'S' })).toBe(false);
  });
});

describe('isWildcardCard（逢人配）', () => {
  it('红桃级牌是逢人配', () => {
    expect(isWildcardCard({ suit: 'H', rank: '5' }, '5')).toBe(true);
  });

  it('非红桃级牌不是逢人配', () => {
    expect(isWildcardCard({ suit: 'S', rank: '5' }, '5')).toBe(false);
  });

  it('红桃但非级牌不是逢人配', () => {
    expect(isWildcardCard({ suit: 'H', rank: '6' }, '5')).toBe(false);
  });
});

describe('decorateCard', () => {
  it('正确标记逢人配和级牌', () => {
    const card = decorateCard({ id: 'c-1', suit: 'H', rank: '5' }, '5');
    expect(card.isWildcard).toBe(true);
    expect(card.isTrumpRank).toBe(true);
    expect(card.isJoker).toBe(false);
  });

  it('正确标记大王', () => {
    const card = decorateCard({ id: 'c-1', suit: 'JOKER', rank: 'BJ' }, '5');
    expect(card.isJoker).toBe(true);
    expect(card.isWildcard).toBe(false);
  });
});

describe('cardSortValue', () => {
  it('大王排序值最高', () => {
    const bj = cardSortValue({ rank: 'BJ', suit: 'JOKER' }, '5');
    const a = cardSortValue({ rank: 'A', suit: 'S' }, '5');
    expect(bj).toBeGreaterThan(a);
  });

  it('级牌有额外加成', () => {
    const trump = cardSortValue({ rank: '5', suit: 'S' }, '5');
    const normal = cardSortValue({ rank: '5', suit: 'S' }, '6');
    expect(trump).toBeGreaterThan(normal);
  });
});

describe('sortCards', () => {
  it('按值从小到大排序', () => {
    const cards = [
      { id: 'c-1', rank: 'A', suit: 'S' },
      { id: 'c-2', rank: '3', suit: 'H' },
      { id: 'c-3', rank: 'BJ', suit: 'JOKER' }
    ];
    const sorted = sortCards(cards, '5');
    expect(sorted[0].rank).toBe('3');
    expect(sorted[1].rank).toBe('A');
    expect(sorted[2].rank).toBe('BJ');
  });
});

describe('createDeal', () => {
  it('发 27 张牌并确定打几', () => {
    const deal = createDeal();
    expect(deal.dealtCards).toHaveLength(27);
    expect(STANDARD_RANKS).toContain(deal.trumpRank);
  });
});

describe('createTableDeal', () => {
  it('为四家各发 27 张牌', () => {
    const table = createTableDeal();
    expect(table.players).toHaveLength(4);
    for (const player of table.players) {
      expect(player.cards).toHaveLength(27);
      expect(TABLE_SEATS).toContain(player.seat);
    }
  });

  it('四家牌总数 = 108', () => {
    const table = createTableDeal();
    const total = table.players.reduce((sum, p) => sum + p.cards.length, 0);
    expect(total).toBe(108);
  });

  it('没有重复的牌 id', () => {
    const table = createTableDeal();
    const allIds = table.players.flatMap((p) => p.cards.map((c) => c.id));
    expect(new Set(allIds).size).toBe(108);
  });
});

describe('cardLabel', () => {
  it('大王标签', () => {
    expect(cardLabel({ rank: 'BJ' })).toBe('大王');
  });

  it('小王标签', () => {
    expect(cardLabel({ rank: 'SJ' })).toBe('小王');
  });

  it('普通牌标签', () => {
    expect(cardLabel({ rank: 'A', suit: 'S' })).toBe('♠A');
  });
});

describe('suitLabel', () => {
  it('返回正确花色符号', () => {
    expect(suitLabel('S')).toBe('♠');
    expect(suitLabel('H')).toBe('♥');
    expect(suitLabel('C')).toBe('♣');
    expect(suitLabel('D')).toBe('♦');
  });
});

describe('isStandardRank / rankValue', () => {
  it('A 是标准点数', () => {
    expect(isStandardRank('A')).toBe(true);
  });

  it('BJ 不是标准点数', () => {
    expect(isStandardRank('BJ')).toBe(false);
  });

  it('A 的值是 14', () => {
    expect(rankValue('A')).toBe(14);
  });
});
