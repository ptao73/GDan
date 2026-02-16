import './App.css';
import { useGameState } from './hooks/useGameState.js';
import Header from './components/Header.jsx';
import CardMatrix from './components/CardMatrix.jsx';
import SelectionPanel from './components/SelectionPanel.jsx';
import ComboList from './components/ComboList.jsx';
import StatsPanel from './components/StatsPanel.jsx';
import HistoryPanel from './components/HistoryPanel.jsx';
import BottomBar from './components/BottomBar.jsx';

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
          <div className="cards-layout">
            <div className="cards-side">
              <h2>手牌区</h2>
              <p className="cards-trump">当前打 "{g.trumpRank}"</p>
            </div>
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
              />
            </div>
          </div>
          <SelectionPanel
            selectedCards={g.selectedCards}
            candidateTypes={g.candidateTypes}
            selectedTypeIndex={g.selectedTypeIndex}
            setSelectedTypeIndex={g.setSelectedTypeIndex}
            confirmGroup={g.confirmGroup}
            resetSelection={g.resetSelection}
            isSolving={g.isSolving}
          />
        </article>

        <article className="panel combos-panel">
          <h2>已组牌区</h2>
          <div className="submit-actions">
            <span className={`assign-state ${g.canAnalyze ? 'ok' : 'pending'}`}>
              已分配 {g.assignedCardsCount}/27
            </span>
            <button onClick={g.handlePrimaryAction} disabled={g.primaryActionDisabled}>
              {g.primaryActionLabel}
            </button>
          </div>
          <ComboList
            userCombos={g.userCombos}
            trumpRank={g.trumpRank}
            aiResult={g.aiResult}
            aiComboKeySet={g.aiComboKeySet}
            userComboKeySet={g.userComboKeySet}
            aiHasRecommendation={g.aiHasRecommendation}
            aiStatus={g.aiStatus}
            userScore={g.userScore}
            aiScoreView={g.aiScoreView}
            removeGroup={g.removeGroup}
            isSolving={g.isSolving}
          />
        </article>
      </section>

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
