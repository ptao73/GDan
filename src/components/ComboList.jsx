import { cardLabel } from '../engine/cards.js';
import { comboKey } from '../engine/combos.js';
import { scoreComboNoRound } from '../engine/scoring.js';
import SolvingIndicator from './SolvingIndicator.jsx';

function comboText(combo) {
  const cards = (combo.cards || []).map((card) => cardLabel(card)).join(' ');
  if (combo.sequence) {
    return `${combo.label}(${combo.sequence.join('-')})：${cards}`;
  }
  if (combo.type === 'threeWithPair') {
    return `${combo.label}(${combo.tripleRank}带${combo.pairRank})：${cards}`;
  }
  if (combo.mainRank) {
    return `${combo.label}(${combo.mainRank})：${cards}`;
  }
  return `${combo.label}：${cards}`;
}

function buildSortableItems(combos, trumpRank) {
  return combos
    .map((combo, index) => {
      const score = scoreComboNoRound(combo, trumpRank);
      return {
        combo,
        originIndex: index,
        total: score.total,
        shapeScore: score.shapeScore,
        burstScore: score.burstScore,
        keyScore: score.keyScore
      };
    })
    .sort((a, b) => {
      if (a.total !== b.total) return b.total - a.total;
      if (a.burstScore !== b.burstScore) return b.burstScore - a.burstScore;
      if (a.shapeScore !== b.shapeScore) return b.shapeScore - a.shapeScore;
      if (a.keyScore !== b.keyScore) return b.keyScore - a.keyScore;
      return a.originIndex - b.originIndex;
    });
}

function scoreChipText(item) {
  return `总${item.total} / 牌${item.shapeScore} 火${item.burstScore} 关${item.keyScore}`;
}

export default function ComboList({
  userCombos,
  trumpRank,
  aiResult,
  aiComboKeySet,
  userComboKeySet,
  aiHasRecommendation,
  aiStatus,
  userScore,
  aiScoreView,
  removeGroup,
  isSolving,
}) {
  const sortedUserItems = buildSortableItems(userCombos, trumpRank);
  const sortedAiItems = aiResult ? buildSortableItems(aiResult.combos || [], trumpRank) : [];
  const hasAiColumn = Boolean(aiResult);

  return (
    <div className="combo-compare">
      <div className="combo-compare-grid">
        <section className="combo-column">
          <h3>我的组牌（按单组分值降序）</h3>
          <ul className="combo-list">
            {sortedUserItems.length === 0 ? (
              <li className="combo-empty">尚未成组。</li>
            ) : (
              sortedUserItems.map((item) => {
                const key = comboKey(item.combo);
                const compareClass = hasAiColumn && aiHasRecommendation
                  ? aiComboKeySet.has(key)
                    ? 'same'
                    : 'removed'
                  : '';
                return (
                  <li key={`user-${key}-${item.originIndex}`} className={compareClass}>
                    <div className="combo-line">
                      <span>{comboText(item.combo)}</span>
                      <span className="combo-score-chip">{scoreChipText(item)}</span>
                    </div>
                    <button
                      className="ghost"
                      onClick={() => removeGroup(item.originIndex)}
                      disabled={isSolving}
                    >
                      拆组
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </section>

        <section className="combo-column">
          <h3>AI推荐（按单组分值降序）</h3>
          {aiStatus === 'running' ? <SolvingIndicator /> : null}
          <ul className="combo-list ai-list">
            {!hasAiColumn ? (
              <li className="combo-empty">点击“AI分析”后展示。</li>
            ) : sortedAiItems.length === 0 ? (
              <li className="combo-empty">当前无可展示的 AI 组牌。</li>
            ) : (
              sortedAiItems.map((item) => {
                const key = comboKey(item.combo);
                const compareClass = aiHasRecommendation
                  ? userComboKeySet.has(key)
                    ? 'same'
                    : 'added'
                  : 'same';
                return (
                  <li key={`ai-${key}-${item.originIndex}`} className={compareClass}>
                    <div className="combo-line">
                      <span>{comboText(item.combo)}</span>
                      <span className="combo-score-chip">{scoreChipText(item)}</span>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
          {hasAiColumn && !aiHasRecommendation ? (
            <p className="hint">当前 AI 最高分未超过玩家，本轮不作为推荐方案。</p>
          ) : null}
        </section>
      </div>

      <div className="combo-score-compare">
        <h3>得分对比</h3>
        <div className="score-compare-grid">
          <p className="head">指标</p>
          <p className="head">玩家</p>
          <p className="head">AI</p>

          <p>总分</p>
          <p>{userScore ? userScore.total : '--'}</p>
          <p>{aiScoreView ? aiScoreView.total : '--'}</p>

          <p>牌型分</p>
          <p>{userScore ? userScore.detail.shapeScore : '--'}</p>
          <p>{aiScoreView ? aiScoreView.detail.shapeScore : '--'}</p>

          <p>火力分</p>
          <p>{userScore ? userScore.detail.burstScore : '--'}</p>
          <p>{aiScoreView ? aiScoreView.detail.burstScore : '--'}</p>

          <p>关键牌分</p>
          <p>{userScore ? userScore.detail.keyScore : '--'}</p>
          <p>{aiScoreView ? aiScoreView.detail.keyScore : '--'}</p>

          <p>轮次修正</p>
          <p>{userScore ? userScore.detail.roundScore : '--'}</p>
          <p>{aiScoreView ? aiScoreView.detail.roundScore : '--'}</p>

          <p>总手数</p>
          <p>{userScore ? userScore.detail.handCount : '--'}</p>
          <p>{aiScoreView ? aiScoreView.detail.handCount : '--'}</p>
        </div>
      </div>
    </div>
  );
}
