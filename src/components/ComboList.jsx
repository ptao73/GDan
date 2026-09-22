import { comboKey, isBomb } from '../engine/combos.js';
import { scoreComboNoRound, scoreScheme } from '../engine/scoring.js';
import { comboRankVector, compareComboDisplayOrder } from '../utils/comboDisplay.js';
import { localizedCardLabel, localizedComboLabel, useI18n } from '../i18n/index.js';
import SolvingIndicator from './SolvingIndicator.jsx';

function buildSortableItems(combos, trumpRank) {
  return combos
    .map((combo, index) => {
      const score = scoreComboNoRound(combo, trumpRank);
      return {
        combo,
        originIndex: index,
        cardCount: combo.cards?.length || 0,
        total: score.total,
        rankVector: comboRankVector(combo)
      };
    })
    .sort(compareComboDisplayOrder);
}

function comboText(item, t) {
  const cards = (item.combo.cards || []).map((card) => localizedCardLabel(card, t)).join(' ');
  return `${localizedComboLabel(item.combo, t)} (${item.total} ${t('labels.score')}): ${cards}`;
}

function comboCategory(item) {
  if (isBomb(item.combo.type)) return 'fire';
  if (item.combo.type === 'single' && item.total > 0) return 'key';
  if (item.combo.type === 'pair') return 'pair';
  if (item.combo.type === 'single') return 'single';
  return 'shape';
}

function ComboColumn({
  title,
  items,
  emptyText,
  showLoading = false,
  progress = null,
  onRemove = null,
  removeDisabled = false
}) {
  const { t } = useI18n();
  const canRemove = typeof onRemove === 'function';

  return (
    <section className="combo-column">
      <h3>{title}</h3>
      {showLoading ? <SolvingIndicator progress={progress} /> : null}
      <ul className="combo-list ai-list">
        {items.length === 0 ? (
          <li className="combo-empty">{emptyText}</li>
        ) : (
          items.map((item) => {
            const key = comboKey(item.combo);
            const category = comboCategory(item);
            return (
              <li key={`${key}-${item.originIndex}`} className={`combo-${category}`}>
                <div className={`combo-line${canRemove ? ' combo-line-with-action' : ''}`}>
                  <span className="combo-main-text">{comboText(item, t)}</span>
                  {canRemove ? (
                    <button
                      className="ghost combo-remove"
                      onClick={() => onRemove(item.originIndex)}
                      disabled={removeDisabled}
                    >
                      {t('labels.remove')}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}

export default function ComboList({
  userCombos,
  trumpRank,
  aiResult,
  aiStatus,
  aiSearchProgress,
  removeGroup,
  isSolving
}) {
  const { t } = useI18n();
  const sortedUserItems = buildSortableItems(userCombos, trumpRank);
  const sortedAiItems = aiResult ? buildSortableItems(aiResult.combos || [], trumpRank) : [];
  const userTotal = scoreScheme(userCombos, trumpRank).total;

  return (
    <div className="combo-compare">
      <div className="combo-compare-grid">
        <ComboColumn
          title={`${t('labels.self')} (${t('labels.totalScore')} ${userTotal})`}
          items={sortedUserItems}
          emptyText={t('panels.groupedNone')}
          onRemove={removeGroup}
          removeDisabled={isSolving}
        />

        <ComboColumn
          title={`${t('panels.aiRecommended')}${aiResult ? ` (${t('labels.totalScore')} ${aiResult.score})` : ''}`}
          items={sortedAiItems}
          emptyText={t('panels.aiEmpty')}
          showLoading={aiStatus === 'running'}
          progress={aiSearchProgress}
        />
      </div>
    </div>
  );
}
