import './App.css';
import { useGameState } from './hooks/useGameState.js';
import Header from './components/Header.jsx';
import CardMatrix from './components/CardMatrix.jsx';
import ComboList from './components/ComboList.jsx';
import StatsPanel from './components/StatsPanel.jsx';
import HistoryPanel from './components/HistoryPanel.jsx';
import GodViewPanel from './components/GodViewPanel.jsx';
import OcrReviewPanel from './components/OcrReviewPanel.jsx';

const OCR_STATUS_LABELS = {
  'loading-engine': '正在加载 OCR 引擎...',
  recognizing: '正在识别图片...',
  parsing: '正在解析牌面...',
  deduplicating: '正在移除重复识别...',
  review: '需要审查。'
};

export default function App() {
  const g = useGameState();

  // 智能按钮：有选中且满足组牌规则 → 确认成组；否则 → 自动补全
  const canConfirm = !g.isSolving && g.selectedCards.length > 0 && g.candidateTypes.length > 0;
  const smartAction = canConfirm ? g.confirmGroup : g.autoCompleteAndSubmit;
  const smartActionLabel = canConfirm ? '确认成组' : '自动补全';
  const smartActionIcon = canConfirm ? '✓' : '⚡';
  const smartActionDisabled = canConfirm
    ? false
    : g.isSolving || (g.remainingCards.length === 0 && Boolean(g.aiResult));

  const handImportDisabled = g.isSolving || g.isImportingHand;

  return (
    <main className="page">
      <Header
        onNewDeal={g.handlePrimaryAction}
        onSmartAction={smartAction}
        smartActionLabel={smartActionLabel}
        smartActionIcon={smartActionIcon}
        smartActionDisabled={smartActionDisabled}
        onImport={g.openImportDialog}
        onToggleGodView={g.toggleGodView}
        newDealDisabled={g.primaryActionDisabled}
        importDisabled={handImportDisabled}
        godViewEnabled={g.godViewEnabled}
        godViewDisabled={g.isSolving || !g.tableDeal}
        trumpRank={g.trumpRank}
      />

      {/* 隐藏的文件输入 */}
      <input
        ref={g.importInputRef}
        className="hidden-input"
        type="file"
        accept={g.importInputAccept}
        onChange={g.importHistory}
      />

      {g.ocrStatus !== 'idle' ? (
        <p className="ocr-status" role="status">
          {OCR_STATUS_LABELS[g.ocrStatus] || g.ocrStatus}
        </p>
      ) : null}

      {/* Toast 通知：右下角浮动，key 驱动动画重播 */}
      {g.notice ? (
        <p key={g.notice} className="notice">
          {g.notice}
        </p>
      ) : null}

      {/* OCR 审查编辑面板 */}
      {g.ocrReview ? (
        <OcrReviewPanel
          ocrReview={g.ocrReview}
          onConfirm={g.confirmOcrReview}
          onCancel={g.cancelOcrReview}
        />
      ) : null}

      <section className="layout-grid main-grid">
        <article className="panel cards-panel">
          <div className="cards-main">
            <CardMatrix
              remainingCards={g.remainingCards}
              selectedIds={g.selectedIds}
              toggleCard={g.toggleCard}
              trumpRank={g.trumpRank}
              isSolving={g.isSolving}
              ghostHints={g.ghostHints}
            />
          </div>
        </article>

        <article className="panel combos-panel">
          <h2>已组牌区</h2>
          <ComboList
            userCombos={g.userCombos}
            trumpRank={g.trumpRank}
            aiResult={g.aiResult}
            aiStatus={g.aiStatus}
            aiSearchProgress={g.aiSearchProgress}
            removeGroup={g.removeGroup}
            isSolving={g.isSolving}
          />
        </article>
      </section>

      {g.godViewEnabled ? (
        <section className="layout-grid main-grid">
          <GodViewPanel
            godViewData={g.godViewData}
            godViewStatus={g.godViewStatus}
            godViewStale={g.godViewStale}
            onRefresh={g.refreshGodView}
            onImportHand={g.importGodViewHand}
          />
        </section>
      ) : null}

      <section id="stats-section" className="layout-grid">
        <StatsPanel stats={g.stats} />
        <HistoryPanel history={g.history} />
      </section>
    </main>
  );
}
