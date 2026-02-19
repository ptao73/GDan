import { cardLabel } from '../engine/cards.js';
import { comboKey } from '../engine/combos.js';
import { scoreComboNoRound, scoreScheme } from '../engine/scoring.js';
import SolvingIndicator from './SolvingIndicator.jsx';

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

function comboText(item) {
  const cards = (item.combo.cards || []).map((card) => cardLabel(card)).join(' ');
  return `${item.combo.label}（${item.total}分）：${cards}`;
}

function comboCategory(item) {
  if (item.burstScore > 0) return 'fire';
  if (item.keyScore > 0) return 'key';
  if (item.combo.type === 'pair') return 'pair';
  if (item.combo.type === 'single') return 'single';
  return 'shape';
}

function ComboColumn({ title, items, emptyText, showLoading = false }) {
  return (
    <section className="combo-column">
      <h3>{title}</h3>
      {showLoading ? <SolvingIndicator /> : null}
      <ul className="combo-list ai-list">
        {items.length === 0 ? (
          <li className="combo-empty">{emptyText}</li>
        ) : (
          items.map((item) => {
            const key = comboKey(item.combo);
            const category = comboCategory(item);
            return (
              <li key={`${key}-${item.originIndex}`} className={`combo-${category}`}>
                <div className="combo-line">
                  <span>{comboText(item)}</span>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}

export default function ComboList({ userCombos, trumpRank, aiResult, aiStatus }) {
  const sortedUserItems = buildSortableItems(userCombos, trumpRank);
  const sortedAiItems = aiResult ? buildSortableItems(aiResult.combos || [], trumpRank) : [];
  const userTotal = scoreScheme(userCombos, trumpRank).total;

  return (
    <div className="combo-compare">
      <div className="combo-compare-grid">
        <ComboColumn
          title={`我的组牌（总分 ${userTotal}）`}
          items={sortedUserItems}
          emptyText="尚未成组。"
        />

        <ComboColumn
          title={`AI推荐${aiResult ? `（总分 ${aiResult.score}）` : ''}`}
          items={sortedAiItems}
          emptyText="完成组牌后将自动给出 AI 推荐。"
          showLoading={aiStatus === 'running'}
        />
      </div>
    </div>
  );
}
