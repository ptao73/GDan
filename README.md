# 掼蛋组牌评分系统（v1.0 MVP）

本项目依据 `掼蛋组牌评分系统_技术架构文档_v1.0` 与 `v1.1 修订稿` 在当前目录实现。

## 已实现能力

- 随机发牌：两副牌 108 张中随机发 27 张，随机确定 `打几`。
- 规则识别：支持单张、对子、三条、三带二、顺子、木板、钢板、炸弹（4-8）、同花顺、天王炸。
- 红桃级牌（逢人配）：按文档作为万能牌参与合法牌型判断（不替代王）。
- 评分体系：牌型分 + 火力分 + 关键牌力 + 轮次修正（`<=8` 加分、`9-10` 为 0、`>=11` 减分）。
- 组牌交互：点选手牌、实时牌型提示、确认成组、拆组。
- 自动补全：当其余结构已完成时，可一键将剩余牌自动补成对子/单张。
- AI 搜索：默认在 `Web Worker` 中执行多轮搜索（含双策略对比），超时自动降级返回“AI较优方案”。
- 可视化对比：
  - 红色：用户有但 AI 无（被 AI 拆开）
  - 绿色：AI 新整合出的组合
  - 灰色：双方相同
- 数据存储：IndexedDB 持久化历史，包含分项得分细节。
- 统计分析：最优命中率、分差分布、手数与炸弹偏好、训练建议。
- 数据迁移：JSON 导入/导出。
- PWA 基础：`manifest` + `service worker` 离线缓存。

## 目录结构

```text
src/
  engine/        # 发牌、牌型、评分、AI 搜索
  services/      # IndexedDB DataService
  workers/       # AI Worker
  App.jsx        # 主界面
public/
  manifest.webmanifest
  sw.js
  icon.svg
```

## 本地运行

```bash
npm install
npm run dev
```

构建：

```bash
npm run build
npm run preview
```

## 注意事项

- AI 搜索已实现超时降级机制，复杂局面下返回结果可能是“较优”而非全局最优。
- 建议提交前执行：`npm run lint && npm run format:check && npm test && npm run build`。
