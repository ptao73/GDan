#!/usr/bin/env node
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { decorateCard } from '../src/engine/cards.js';
import { solveBestScheme } from '../src/engine/solver.js';

export function parseToken(token, id, trumpRank) {
  if (token === 'SJ' || token === 'JOKER-SJ') {
    return decorateCard({ id: `bench-${id}`, suit: 'JOKER', rank: 'SJ' }, trumpRank);
  }
  if (token === 'BJ' || token === 'JOKER-BJ') {
    return decorateCard({ id: `bench-${id}`, suit: 'JOKER', rank: 'BJ' }, trumpRank);
  }
  const [suit, rank] = token.split('-');
  return decorateCard({ id: `bench-${id}`, suit, rank }, trumpRank);
}

export function loadCorpus(corpusPath) {
  const fileUrl = corpusPath
    ? new URL(corpusPath, import.meta.url)
    : new URL('./corpus.json', import.meta.url);
  const raw = fs.readFileSync(fileUrl, 'utf-8');
  return JSON.parse(raw);
}

export function benchmarkCase(benchCase, options = {}) {
  const { iterations = 3, timeLimitMs = 3000 } = options;
  const { id, difficulty, trumpRank, cards: tokens } = benchCase;

  if (tokens.length !== 27) {
    throw new Error(`Case ${id} has invalid card count: ${tokens.length} (must be 27)`);
  }

  const cards = tokens.map((tok, i) => parseToken(tok, i + 1, trumpRank));

  // Warmup run
  const warmupResult = solveBestScheme(cards, trumpRank, { timeLimitMs });

  // Timed iterations
  const timings = [];
  let lastResult = warmupResult;
  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now();
    lastResult = solveBestScheme(cards, trumpRank, { timeLimitMs });
    timings.push(performance.now() - start);
  }

  const avgElapsed = timings.reduce((a, b) => a + b, 0) / timings.length;
  const minElapsed = Math.min(...timings);
  const maxElapsed = Math.max(...timings);

  const cardCountInCombos = lastResult.combos.reduce((sum, c) => sum + c.cards.length, 0);
  if (cardCountInCombos !== 27) {
    throw new Error(`Case ${id} solver partitioned ${cardCountInCombos}/27 cards`);
  }

  return {
    id,
    difficulty,
    trumpRank,
    avgMs: Number(avgElapsed.toFixed(2)),
    minMs: Number(minElapsed.toFixed(2)),
    maxMs: Number(maxElapsed.toFixed(2)),
    searchNodes: lastResult.searchNodes,
    score: lastResult.score,
    handCount: lastResult.detail?.handCount ?? lastResult.combos.length,
    fireComboCount: lastResult.fireComboCount ?? 0,
    timedOut: lastResult.timedOut,
    combos: lastResult.combos.map((c) => c.label)
  };
}

export function runBenchmarkSuite(options = {}) {
  const { iterations = 3, filter = null, corpusPath = null, silent = false } = options;

  const corpus = loadCorpus(corpusPath);
  const selected = filter
    ? corpus.filter((c) => c.id.includes(filter) || c.difficulty === filter)
    : corpus;

  if (selected.length === 0) {
    if (!silent) {
      console.warn(`No benchmark cases matched filter: "${filter}"`);
    }
    return { cases: [], summary: null };
  }

  const results = [];
  for (const c of selected) {
    const res = benchmarkCase(c, { iterations });
    results.push(res);
  }

  const totalTime = results.reduce((sum, r) => sum + r.avgMs, 0);
  const totalNodes = results.reduce((sum, r) => sum + r.searchNodes, 0);
  const totalTimedOut = results.filter((r) => r.timedOut).length;

  const summary = {
    totalCases: results.length,
    iterationsPerCase: iterations,
    totalAvgMs: Number(totalTime.toFixed(2)),
    meanMsPerHand: Number((totalTime / results.length).toFixed(2)),
    totalSearchNodes: totalNodes,
    meanNodesPerHand: Math.round(totalNodes / results.length),
    allCompleted: totalTimedOut === 0
  };

  return { cases: results, summary };
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  const options = {
    iterations: 3,
    filter: null,
    json: false
  };

  for (const arg of args) {
    if (arg.startsWith('--iterations=')) {
      const val = parseInt(arg.split('=')[1], 10);
      if (!Number.isNaN(val) && val > 0) options.iterations = val;
    } else if (arg.startsWith('--case=')) {
      options.filter = arg.split('=')[1];
    } else if (arg === '--json') {
      options.json = true;
    }
  }

  return options;
}

function printTable(suite) {
  const { cases, summary } = suite;
  console.log('='.repeat(80));
  console.log(
    `Guandan Solver Benchmark Suite (${summary.totalCases} cases, ${summary.iterationsPerCase} iterations each)`
  );
  console.log('='.repeat(80));
  console.log(
    `${'Case ID'.padEnd(38)} ${'Diff.'.padEnd(9)} ${'Avg(ms)'.padStart(8)} ${'Nodes'.padStart(6)} ${'Score'.padStart(6)} ${'Hands'.padStart(6)} ${'Bombs'.padStart(6)}`
  );
  console.log('-'.repeat(80));

  for (const r of cases) {
    const id = r.id.length > 38 ? `${r.id.slice(0, 35)}...` : r.id.padEnd(38);
    const diff = r.difficulty.padEnd(9);
    const avg = r.avgMs.toFixed(1).padStart(8);
    const nodes = String(r.searchNodes).padStart(6);
    const score = String(r.score).padStart(6);
    const hands = String(r.handCount).padStart(6);
    const bombs = String(r.fireComboCount).padStart(6);
    console.log(`${id} ${diff} ${avg} ${nodes} ${score} ${hands} ${bombs}`);
  }

  console.log('-'.repeat(80));
  console.log('Summary:');
  console.log(`  Total Hands:        ${summary.totalCases}`);
  console.log(`  Total Time (avg):   ${summary.totalAvgMs} ms (~${summary.meanMsPerHand} ms/hand)`);
  console.log(
    `  Total Search Nodes: ${summary.totalSearchNodes} (~${summary.meanNodesPerHand} nodes/hand)`
  );
  console.log(
    `  Timeout Status:     ${summary.allCompleted ? 'All completed within deadline (0 timeouts)' : 'WARNING: Some cases timed out'}`
  );
  console.log('='.repeat(80));
}

// CLI entry point
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*[\\/]/, ''))) {
  const options = parseCliArgs();
  const suite = runBenchmarkSuite(options);

  if (options.json) {
    console.log(JSON.stringify(suite, null, 2));
  } else {
    printTable(suite);
  }

  if (!suite.summary?.allCompleted) {
    process.exit(1);
  }
}
