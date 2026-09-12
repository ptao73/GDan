# Contributing to GDan

Thanks for your interest in improving GDan.

## Development setup

```bash
npm install
npm run dev
```

Before opening a pull request, please run:

```bash
npm run lint
npm run format:check
npm test
npm run build
```

## Contribution workflow

1. Create an issue for non-trivial changes so the scope can be discussed first.
2. Create a focused branch from `main`.
3. Keep commits small and descriptive.
4. Add or update tests when changing the game engine, scoring rules, solver, or import logic.
5. Open a pull request explaining the problem, approach, and validation performed.

## Good first contribution areas

- Improve English documentation and examples.
- Add benchmark cases for solver quality and performance.
- Improve OCR robustness for imported card images.
- Add tests for edge cases in Guandan combinations and wildcard handling.
- Improve accessibility and mobile usability.

## Reporting bugs

Please include:

- Steps to reproduce
- Expected behavior
- Actual behavior
- Browser and device information
- A sample hand or import file when relevant

## Scope

GDan is intended as a training and analysis tool for Guandan hand grouping and scoring. Contributions should keep the core engine deterministic, testable, and understandable.
