import './App.css';
import { useGameState } from './hooks/useGameState.js';
import Header from './components/Header.jsx';
import CardMatrix from './components/CardMatrix.jsx';
import ComboList from './components/ComboList.jsx';
import StatsPanel from './components/StatsPanel.jsx';
import HistoryPanel from './components/HistoryPanel.jsx';
import GodViewPanel from './components/GodViewPanel.jsx';

export default function App() {
  const g = useGameState();
  const canConfirmFromHeader =
    !g.isSolving && g.selectedCards.length > 0 && g.candidateTypes.length > 0;
  const autoCompleteDisabledFromHeader =
    g.isSolving || (g.remainingCards.length === 0 && Boolean(g.aiResult));
  const handImportDisabled = g.isSolving || g.isImportingHand;

  return (
    <main className="page">
      <Header
        onNewDeal={g.handlePrimaryAction}
        onAutoComplete={g.autoCompleteAndSubmit}
        onConfirmGroup={g.confirmGroup}
        onImport={g.openImportDialog}
        newDealDisabled={g.primaryActionDisabled}
        autoCompleteDisabled={autoCompleteDisabledFromHeader}
        confirmDisabled={!canConfirmFromHeader}
        importDisabled={handImportDisabled}
        trumpRank={g.trumpRank}
      />

      {/* Toast 通知：右下角浮动，key 驱动动画重播 */}
      {g.notice ? (
        <p key={g.notice} className="notice">
          {g.notice}
        </p>
      ) : null}

      <section className="layout-grid main-grid">
        <article className="panel cards-panel">
          <div className="cards-main">
            <div className="cards-main-tools">
              <label className="mode-selector cards-mode-selector">
                <span>AI搜索档位</span>
                <select
                  value={g.aiSearchMode}
                  onChange={(event) => g.setAiSearchMode(event.target.value)}
                  disabled={g.isSolving}
                >
                  {g.aiSearchModeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className={`ghost ${g.godViewEnabled ? 'ghost-active' : ''}`}
                onClick={g.toggleGodView}
                disabled={g.isSolving || !g.tableDeal}
              >
                {g.godViewStatus === 'running' && !g.godViewEnabled
                  ? '上帝视角计算中...'
                  : g.godViewEnabled
                    ? '收起上帝视角'
                    : '上帝视角'}
              </button>
              <input
                ref={g.importInputRef}
                className="hidden-input"
                type="file"
                accept="application/json,image/*"
                onChange={g.importHistory}
              />
            </div>
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
            removeGroup={g.removeGroup}
            isSolving={g.isSolving}
          />
        </article>
      </section>

      {g.godViewEnabled ? (
        <section className="layout-grid main-grid">
          <GodViewPanel godViewData={g.godViewData} godViewStatus={g.godViewStatus} />
        </section>
      ) : null}

      <section id="stats-section" className="layout-grid">
        <StatsPanel stats={g.stats} />
        <HistoryPanel history={g.history} />
      </section>
    </main>
  );
}
