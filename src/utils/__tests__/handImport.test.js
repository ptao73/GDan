import { describe, expect, it } from 'vitest';
import { createFullDeck } from '../../engine/cards.js';
import {
  HAND_CARD_COUNT,
  createTableDealFromEastCards,
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
});
