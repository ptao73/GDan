import './App.css';
import { useGameState } from './hooks/useGameState.js';
import Header from './components/Header.jsx';
import StatusBar from './components/StatusBar.jsx';
import CardMatrix from './components/CardMatrix.jsx';
import SelectionPanel from './components/SelectionPanel.jsx';
import ComboList from './components/ComboList.jsx';
import ScoreResult from './components/ScoreResult.jsx';
import AiResult from './components/AiResult.jsx';
import StatsPanel from './components/StatsPanel.jsx';
import HistoryPanel from './components/HistoryPanel.jsx';
import BottomBar from './components/BottomBar.jsx';

export default function App() {
  const g = useGameState();

  return (
    <main className="page">
      <Header
        startNewDeal={g.startNewDeal}
        exportHistory={g.exportHistory}
        openImportDialog={g.openImportDialog}
        importHistory={g.importHistory}
        importInputRef={g.importInputRef}
        isSolving={g.isSolving}
      />

      <StatusBar
        trumpRank={g.trumpRank}
        assignedCardsCount={g.assignedCardsCount}
        remainingCount={g.remainingCards.length}
        jokersRemain={g.jokersRemain}
        wildcardRemain={g.wildcardRemain}
      />

      {/* Toast 通知：右下角浮动，key 驱动动画重播 */}
      {g.notice ? (
        <p key={g.notice} className="notice">
          {g.notice}
        </p>
      ) : null}

      <section className="layout-grid">
        <article className="panel cards-panel">
          <h2>手牌区</h2>
          <CardMatrix
            remainingCards={g.remainingCards}
            selectedIds={g.selectedIds}
            toggleCard={g.toggleCard}
            trumpRank={g.trumpRank}
            isSolving={g.isSolving}
          />
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
          <ComboList
            userCombos={g.userCombos}
            aiResult={g.aiResult}
            aiComboKeySet={g.aiComboKeySet}
            removeGroup={g.removeGroup}
            isSolving={g.isSolving}
          />
          <div className="submit-actions">
            <span className={`assign-state ${g.canAnalyze ? 'ok' : 'pending'}`}>
              已分配 {g.assignedCardsCount}/27
            </span>
            <button onClick={g.submitScoring} disabled={!g.canAnalyze}>
              {g.isSolving ? '专家正在计算中...' : '开始分析（AI对照）'}
            </button>
          </div>
        </article>
      </section>

      <section className="layout-grid results-grid">
        <ScoreResult userScore={g.userScore} />
        <AiResult
          aiResult={g.aiResult}
          aiStatus={g.aiStatus}
          userScore={g.userScore}
          aiScoreView={g.aiScoreView}
          userComboKeySet={g.userComboKeySet}
        />
      </section>

      <section className="layout-grid">
        <StatsPanel stats={g.stats} />
        <HistoryPanel history={g.history} />
      </section>

      <BottomBar
        assignedCardsCount={g.assignedCardsCount}
        canAnalyze={g.canAnalyze}
        isSolving={g.isSolving}
        submitScoring={g.submitScoring}
      />
    </main>
  );
}
