# GDan — Guandan Hand Grouping & AI Scoring Trainer

GDan is an open-source, browser-based training and analysis tool for **Guandan (掼蛋)** hand grouping, rule validation, scoring, and AI-assisted comparison. It runs as a PWA and keeps the core analysis in the browser.

**Live demo:** https://gdan.vercel.app

> 中文说明见下方。Contributions, bug reports, benchmark cases, and documentation improvements are welcome.

## Why this project exists

Guandan hand grouping is a constrained search problem: a 27-card hand may have many legal decompositions, and the strongest grouping depends on card type, bombs, control cards, wildcard usage, and expected number of turns. GDan makes this process inspectable by combining deterministic rule logic, a scoring model, and background AI search.

## Highlights

- Rule recognition for singles, pairs, triples, full houses, straights, consecutive pairs/triples, bombs, straight flushes, and joker bombs
- Wildcard handling for the heart level card (逢人配)
- AI-assisted grouping search with multiple depth levels and Web Worker execution
- Visual comparison between user grouping and AI suggestions
- Four-player “god view” analysis
- JSON and image import with OCR review and de-duplication
- Local history and statistics with IndexedDB
- PWA/offline support
- Unit tests for core engine behavior

## Tech stack

- React 18 + Vite 5
- Web Worker
- IndexedDB
- Tesseract.js
- Vitest
- ESLint + Prettier
- PWA / Service Worker

## Quick start

```bash
npm install
npm run dev
```

Before opening a pull request:

```bash
npm run lint
npm run format:check
npm test
npm run benchmark
npm run build
```

## Roadmap

- [x] Add reproducible solver benchmark cases
- [ ] Improve OCR robustness across mobile screenshots and camera images
- [ ] Expand English documentation and examples
- [ ] Add performance profiling for deep search
- [ ] Add more edge-case tests for wildcard and bomb combinations
- [ ] Improve accessibility and mobile interaction

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). For non-trivial changes, please open an issue first so the scope can be discussed.

## License

MIT — see [LICENSE](./LICENSE).

---

# 掼蛋组牌评分系统

一款基于浏览器的掼蛋（双副牌升级）手牌组牌练习与 AI 评分工具，支持 PWA 离线使用。

## 功能特性

- **随机发牌** — 两副牌 108 张中随机发 27 张，随机确定「打几」
- **规则识别** — 支持单张、对子、三条、三带二、顺子、木板、钢板、炸弹（4-8）、同花顺、天王炸
- **红桃级牌（逢人配）** — 作为万能牌参与合法牌型判断（不替代王）
- **评分体系** — 牌型分 + 火力分 + 关键牌力 + 轮次修正
- **组牌交互** — 点选手牌、实时牌型提示、确认成组、拆组
- **自动补全** — 剩余牌一键补成对子/单张
- **AI 搜索** — 多档位搜索（快速 / 均衡 / 深度），Web Worker 后台执行，超时自动降级
- **可视化对比** — 红色（AI 拆开）、绿色（AI 新整合）、灰色（双方相同）
- **上帝视角** — 查看四家完整牌面与组牌分析
- **手牌导入**
  - JSON 文件导入（支持多种字段格式）
  - 拍照 / 图片上传，通过 Tesseract OCR 识别牌面
  - OCR 智能去重（左上角 + 右下角重复识别自动合并）
  - 审查编辑面板（去重后数量不符时可手动增删牌再确认导入）
- **历史记录** — IndexedDB 本地存储对局记录与统计数据，支持导入导出
- **统计分析** — 最优命中率、分差分布、手数与炸弹偏好、训练建议
- **PWA** — 支持添加到主屏幕，Service Worker 离线缓存

## 项目结构

```text
benchmarks/          # 求解器基准测试集与运行脚本
src/
├── engine/          # 核心引擎：发牌、牌型识别、评分、求解算法
├── components/      # React 组件
├── hooks/           # 状态管理
├── workers/         # Web Worker：后台 AI 计算
├── services/        # IndexedDB 持久化
├── utils/           # 导入解析、OCR 去重等
├── App.jsx
└── main.jsx
```

## 注意事项

- AI 搜索已实现超时降级机制，复杂局面下返回结果可能是「较优」而非全局最优。
- OCR 图片识别依赖 Tesseract.js CDN，首次使用需要联网加载。
