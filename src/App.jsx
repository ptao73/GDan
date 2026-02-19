import './App.css';
import { useGameState } from './hooks/useGameState.js';
import Header from './components/Header.jsx';
import CardMatrix from './components/CardMatrix.jsx';
import SelectionPanel from './components/SelectionPanel.jsx';
import ComboList from './components/ComboList.jsx';
import StatsPanel from './components/StatsPanel.jsx';
import HistoryPanel from './components/HistoryPanel.jsx';
import BottomBar from './components/BottomBar.jsx';
import GodViewPanel from './components/GodViewPanel.jsx';

export default function App() {
  const g = useGameState();

  return (
    <main className="page">
      <Header />

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
              <button className="ghost" onClick={g.exportHistory} disabled={g.isSolving}>
                导出JSON
              </button>
              <button className="ghost" onClick={g.openImportDialog} disabled={g.isSolving}>
                导入JSON
              </button>
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
                accept="application/json"
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
          <SelectionPanel
            selectedCards={g.selectedCards}
            candidateTypes={g.candidateTypes}
            selectedTypeIndex={g.selectedTypeIndex}
            setSelectedTypeIndex={g.setSelectedTypeIndex}
            confirmGroup={g.confirmGroup}
            resetSelection={g.resetSelection}
            autoCompleteAndSubmit={g.autoCompleteAndSubmit}
            autoFillDisabled={g.isSolving || (g.remainingCards.length === 0 && Boolean(g.aiResult))}
            isSolving={g.isSolving}
          />
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

      <section className="layout-grid">
        <StatsPanel stats={g.stats} />
        <HistoryPanel history={g.history} />
      </section>

      <BottomBar
        assignedCardsCount={g.assignedCardsCount}
        isSolving={g.isSolving}
        handlePrimaryAction={g.handlePrimaryAction}
        primaryActionLabel={g.primaryActionLabel}
        primaryActionDisabled={g.primaryActionDisabled}
        aiSearchModeLabel={g.aiSearchModeLabel}
      />
    </main>
  );
}
