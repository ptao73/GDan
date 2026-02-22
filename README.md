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

## 技术栈

- React 18 + Vite 5
- Web Worker（AI 求解与上帝视角计算在后台线程运行）
- IndexedDB（本地持久化历史数据）
- Tesseract.js（OCR 图片识别，按需 CDN 加载）
- Vitest（单元测试）
- ESLint + Prettier（代码规范）
- PWA（Service Worker + Web App Manifest）

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm test` | 运行单元测试 |
| `npm run test:watch` | 测试监听模式 |
| `npm run lint` | 代码检查 |
| `npm run format` | 代码格式化 |
| `npm run build` | 生产构建 |
| `npm run preview` | 预览构建产物 |

## 项目结构

```
src/
├── engine/          # 核心引擎：发牌、牌型识别、评分、求解算法
├── components/      # React 组件：牌面矩阵、组牌列表、上帝视角、OCR 审查等
├── hooks/           # 状态管理：游戏状态、AI 搜索、卡牌选择、历史记录等
├── workers/         # Web Worker：后台 AI 计算
├── services/        # 数据服务：IndexedDB 持久化
├── utils/           # 工具函数：手牌导入解析、OCR 去重
├── App.jsx          # 主界面
└── main.jsx         # 入口文件
public/
├── manifest.webmanifest
├── sw.js            # Service Worker
├── icon.svg         # 应用图标
└── ornaments/       # 装饰素材
```

## 注意事项

- AI 搜索已实现超时降级机制，复杂局面下返回结果可能是「较优」而非全局最优。
- OCR 图片识别依赖 Tesseract.js CDN，首次使用需要联网加载。
- 建议提交前执行：`npm run lint && npm run format:check && npm test && npm run build`。
