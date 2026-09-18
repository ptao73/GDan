# Solver Benchmark Suite

A reproducible benchmark suite for evaluating Guandan (掼蛋) hand solver quality, runtime performance, and search depth across algorithmic changes.

## Overview

The corpus contains 10 curated 27-card hands across four difficulty categories:

- **Easy (2 hands)**: Clear natural bombs, independent straights, and non-conflicting full houses with minimal split ambiguity.
- **Medium (3 hands)**: Typical competitive trade-offs (e.g., straight vs. full-house competition, triplet splitting, and trump conservation vs. sequence utility).
- **Hard (3 hands)**: High combinatorial density and search branching (e.g., dual overlapping sequences, straight flush vs. 4-bomb dilemmas, and steel plate vs. bomb competition).
- **Wildcard-heavy (2 hands)**: Hands with dual wildcards (Heart trumps) testing wildcard allocation heuristics, bomb elevation, and straight flush synthesis.

All hands strictly adhere to standard 2-deck Guandan rules (27 cards per player, max 2 identical cards per hand, and max 2 wildcards).

## Running Benchmarks

Run the full suite with default 3 iterations per case:

```bash
npm run benchmark
```

### CLI Options

Filter by difficulty or case ID:

```bash
node benchmarks/run.js --case=wildcard
node benchmarks/run.js --case=easy-01
```

Set custom iteration count:

```bash
node benchmarks/run.js --iterations=5
```

Output machine-readable JSON:

```bash
node benchmarks/run.js --json
```

## Metrics Recorded

- **Avg(ms)**: Mean solver execution time across iterations.
- **Nodes**: Number of beam search / combinatorial nodes explored.
- **Score**: Evaluated scoring of the top recommended hand partition.
- **Hands**: Total number of plays/combos required to exhaust the 27 cards.
- **Bombs**: Number of bomb and straight-flush combinations identified.
- **Timeout Status**: Whether the solver completed strictly within the configured time budget.
