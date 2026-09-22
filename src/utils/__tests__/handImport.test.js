import { describe, expect, it } from 'vitest';
import { createFullDeck } from '../../engine/cards.js';
import {
  HAND_CARD_COUNT,
  createTableDealFromEastCards,
  deduplicateOcrSpecs,
  materializeHandCards,
  parseHandImportJson,
  parseHandSpecsFromText
} from '../handImport.js';

function sampleSpecs(count = HAND_CARD_COUNT) {
  return createFullDeck()
    .slice(0, count)
    .map((card) => ({
      suit: card.suit,
      rank: card.rank
    }));
}

function specsToOcrText(specs) {
  return specs
    .map((spec) => {
      if (spec.suit === 'JOKER') {
        return spec.rank === 'SJ' ? '小王' : spec.rank === 'BJ' ? '大王' : 'JOKER';
      }
      return `${spec.suit}${spec.rank}`;
    })
    .join(' ');
}

describe('handImport utils', () => {
  it('parses hand json payload from dealtCards', () => {
    const payload = {
      trumpRank: '5',
      dealtCards: sampleSpecs()
    };

    const result = parseHandImportJson(JSON.stringify(payload));
    expect(result.trumpRank).toBe('5');
    expect(result.cardSpecs).toHaveLength(HAND_CARD_COUNT);
  });

  it('parses valid JSON card arrays with English suit names', () => {
    const result = parseHandImportJson(
      JSON.stringify({
        level: 'Q',
        cards: [
          { suit: 'spades', rank: 'A' },
          { suit: 'HEARTS', rank: '10' },
          { suit: 'clubs', rank: '3' },
          { suit: 'diamonds', rank: 'K' }
        ]
      })
    );

    expect(result.trumpRank).toBe('Q');
    expect(result.cardSpecs).toEqual([
      { suit: 'S', rank: 'A' },
      { suit: 'H', rank: '10' },
      { suit: 'C', rank: '3' },
      { suit: 'D', rank: 'K' }
    ]);
  });

  it('rejects invalid JSON and missing hand arrays', () => {
    expect(() => parseHandImportJson('{not-json')).toThrow(/JSON 格式不正确/);
    expect(() => parseHandImportJson(JSON.stringify({ level: '2' }))).toThrow(/未找到手牌数组/);
  });

  it('parses ocr text with chinese labels and trump rank', () => {
    const text = '当前打：5，♠A ♥K ♣10 ♦3 小王 大王';
    const result = parseHandSpecsFromText(text);

    expect(result.trumpRank).toBe('5');
    expect(result.cardSpecs).toEqual([
      { suit: 'S', rank: 'A' },
      { suit: 'H', rank: 'K' },
      { suit: 'C', rank: '10' },
      { suit: 'D', rank: '3' },
      { suit: 'JOKER', rank: 'SJ' },
      { suit: 'JOKER', rank: 'BJ' }
    ]);
  });

  it('parses Chinese, English, and Unicode suit names', () => {
    const result = parseHandSpecsFromText(
      '黑桃A 红桃K 梅花10 方块3 SPADES Q HEARTS J CLUBS 9 DIAMONDS 8 ♤7 ♡6 ♧5 ♢4'
    );

    expect(result.cardSpecs).toEqual([
      { suit: 'S', rank: 'A' },
      { suit: 'H', rank: 'K' },
      { suit: 'C', rank: '10' },
      { suit: 'D', rank: '3' },
      { suit: 'S', rank: 'Q' },
      { suit: 'H', rank: 'J' },
      { suit: 'C', rank: '9' },
      { suit: 'D', rank: '8' },
      { suit: 'S', rank: '7' },
      { suit: 'H', rank: '6' },
      { suit: 'C', rank: '5' },
      { suit: 'D', rank: '4' }
    ]);
  });

  it('deduplicates the same OCR card twice into one card', () => {
    const parsed = parseHandSpecsFromText('♠A ♠A');
    expect(deduplicateOcrSpecs(parsed.cardSpecs)).toEqual([{ suit: 'S', rank: 'A' }]);
  });

  it('deduplicates the same OCR card four times into two cards', () => {
    const parsed = parseHandSpecsFromText('♠A ♠A ♠A ♠A');
    expect(deduplicateOcrSpecs(parsed.cardSpecs)).toEqual([
      { suit: 'S', rank: 'A' },
      { suit: 'S', rank: 'A' }
    ]);
  });

  it('normalizes small joker, big joker, and a heart level wildcard', () => {
    const parsed = parseHandSpecsFromText('小王 大王 ♥5');
    expect(parsed.cardSpecs).toEqual([
      { suit: 'JOKER', rank: 'SJ' },
      { suit: 'JOKER', rank: 'BJ' },
      { suit: 'H', rank: '5' }
    ]);

    const cards = materializeHandCards(parsed.cardSpecs, '5');
    expect(cards.find((card) => card.rank === '5' && card.suit === 'H')?.isWildcard).toBe(true);
    expect(cards.filter((card) => card.rank === 'SJ')).toHaveLength(1);
    expect(cards.filter((card) => card.rank === 'BJ')).toHaveLength(1);
  });

  it.each([
    ['fewer than 27', sampleSpecs(26), 26],
    ['exactly 27', sampleSpecs(27), 27],
    ['more than 27', sampleSpecs(28), 28]
  ])('keeps OCR materialized counts for %s cards', (_label, specs, expected) => {
    const parsed = parseHandSpecsFromText(specsToOcrText(specs));
    expect(deduplicateOcrSpecs(parsed.cardSpecs)).toHaveLength(expected);
  });

  it('materializes 27 cards into full card entities', () => {
    const cards = materializeHandCards(sampleSpecs(), '2');
    expect(cards).toHaveLength(HAND_CARD_COUNT);
    expect(new Set(cards.map((card) => card.id)).size).toBe(HAND_CARD_COUNT);
  });

  it('builds a complete table deal from imported east cards', () => {
    const eastCards = materializeHandCards(sampleSpecs(), '9');
    const tableDeal = createTableDealFromEastCards(eastCards, '9');
    expect(tableDeal.players).toHaveLength(4);
    expect(tableDeal.players.every((player) => player.cards.length === HAND_CARD_COUNT)).toBe(true);
    const allIds = tableDeal.players.flatMap((player) => player.cards.map((card) => card.id));
    expect(new Set(allIds).size).toBe(108);
  });

  it('throws when any card exceeds double-deck capacity', () => {
    const overflowSpecs = [
      { suit: 'S', rank: 'A' },
      { suit: 'S', rank: 'A' },
      { suit: 'S', rank: 'A' }
    ];
    expect(() => materializeHandCards(overflowSpecs, '2')).toThrow(/超出双副牌上限/);
  });

  it('throws when a materialized hand contains more than two copies of a card', () => {
    expect(() =>
      materializeHandCards(
        [
          { suit: 'S', rank: 'A' },
          { suit: 'S', rank: 'A' },
          { suit: 'S', rank: 'A' }
        ],
        '2'
      )
    ).toThrow(/超出双副牌上限/);
  });
});
