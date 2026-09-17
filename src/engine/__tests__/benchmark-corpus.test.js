import { describe, it, expect } from 'vitest';
import { loadCorpus, benchmarkCase } from '../../../benchmarks/run.js';
import { isWildcardCard } from '../cards.js';

describe('Solver Benchmark Corpus', () => {
  const corpus = loadCorpus();

  it('contains at least 10 curated cases covering all target difficulty tiers', () => {
    expect(corpus.length).toBeGreaterThanOrEqual(10);

    const difficulties = new Set(corpus.map((c) => c.difficulty));
    expect(difficulties.has('easy')).toBe(true);
    expect(difficulties.has('medium')).toBe(true);
    expect(difficulties.has('hard')).toBe(true);
    expect(difficulties.has('wildcard')).toBe(true);
  });

  it('every benchmark case has required metadata and exactly 27 legal cards', () => {
    for (const benchCase of corpus) {
      expect(typeof benchCase.id).toBe('string');
      expect(typeof benchCase.name).toBe('string');
      expect(typeof benchCase.trumpRank).toBe('string');
      expect(typeof benchCase.description).toBe('string');
      expect(Array.isArray(benchCase.cards)).toBe(true);
      expect(benchCase.cards).toHaveLength(27);

      // Verify 2-deck legality: no card token appears more than twice
      const tokenCounts = {};
      let wildcardCount = 0;
      for (const tok of benchCase.cards) {
        tokenCounts[tok] = (tokenCounts[tok] || 0) + 1;
        expect(tokenCounts[tok]).toBeLessThanOrEqual(2);

        if (tok.startsWith('H-')) {
          const rank = tok.split('-')[1];
          if (isWildcardCard({ suit: 'H', rank }, benchCase.trumpRank)) {
            wildcardCount += 1;
          }
        }
      }

      // Max 2 wildcards per hand in standard 2-deck Guandan
      expect(wildcardCount).toBeLessThanOrEqual(2);
    }
  });

  it('solver successfully partitions all 27 cards across all corpus cases without timeout', () => {
    for (const benchCase of corpus) {
      const result = benchmarkCase(benchCase, { iterations: 1, timeLimitMs: 3000 });
      expect(result.timedOut).toBe(false);
      expect(result.searchNodes).toBeGreaterThan(0);
      expect(typeof result.score).toBe('number');
      expect(result.handCount).toBeGreaterThan(0);
      expect(result.combos.length).toBeGreaterThan(0);
    }
  });
});
