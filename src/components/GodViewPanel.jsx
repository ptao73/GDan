import { isBomb } from '../engine/combos.js';
import { scoreComboNoRound, scoreScheme } from '../engine/scoring.js';
import { comboRankVector, compareComboDisplayOrder } from '../utils/comboDisplay.js';
import {
  localizedCardLabel,
  localizedComboLabel,
  localizeGodExplanation,
  useI18n
} from '../i18n/index.js';

function roleText(role, t) {
  if (role === 'self') return t('labels.self');
  if (role === 'teammate') return t('labels.teammate');
  return t('labels.opponent');
}

function comboCategory(item) {
  if (isBomb(item.combo.type)) return 'fire';
  if (item.combo.type === 'single' && item.total > 0) return 'key';
  if (item.combo.type === 'pair') return 'pair';
  if (item.combo.type === 'single') return 'single';
  return 'shape';
}

function buildSeatComboItems(player, trumpRank) {
  return (player?.preferred?.combos || [])
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

function comboLineText(item, t) {
  const cards = (item.combo.cards || []).map((card) => localizedCardLabel(card, t)).join(' ');
  return `${localizedComboLabel(item.combo, t)} (${item.total} ${t('labels.score')}): ${cards}`;
}

export default function GodViewPanel({
  godViewData,
  godViewStatus,
  godViewStale,
  onRefresh,
  onImportHand
}) {
  const { t } = useI18n();

  if (godViewStatus === 'running') {
    return (
      <article className="panel god-view-panel">
        <h2>{t('app.godView')}</h2>
        <p className="hint">{t('godView.running')}</p>
      </article>
    );
  }

  if (godViewStatus === 'failed') {
    return (
      <article className="panel god-view-panel">
        <h2>{t('app.godView')}</h2>
        <p className="warn">{t('godView.failed')}</p>
      </article>
    );
  }

  if (!godViewData) {
    return (
      <article className="panel god-view-panel">
        <h2>{t('app.godView')}</h2>
        <p className="hint">{t('godView.waiting')}</p>
      </article>
    );
  }

  return (
    <article className="panel god-view-panel">
      <h2>{t('app.godView')}</h2>
      {godViewStale && (
        <p
          className="warn"
          style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {t('godView.stale')}
          {onRefresh && (
            <button className="ghost" onClick={onRefresh} style={{ fontSize: '0.85em' }}>
              {t('godView.refresh')}
            </button>
          )}
        </p>
      )}
      {godViewData.endgameFlag && (
        <p className="warn" style={{ marginBottom: '8px' }}>
          {t('godView.endgame')}
        </p>
      )}
      <div className="god-players-grid">
        {godViewData.players.map((player) => {
          const seatItems = buildSeatComboItems(player, godViewData.trumpRank);
          const seatTotal = player.preferred?.combos?.length
            ? scoreScheme(player.preferred.combos, godViewData.trumpRank).total
            : 0;
          return (
            <section key={player.seat} className={`god-seat role-${player.role}`}>
              <header>
                <h3>
                  {t('godView.seat', {
                    seat: t(`seats.${player.seat}`),
                    role: roleText(player.role, t)
                  })}
                </h3>
                <span className="god-seat-score">
                  {t('godView.seatScore', { score: seatTotal })}
                </span>
                <span className="god-threat">
                  {t('godView.threatScore', { score: player.threatScore })}
                </span>
              </header>
              <ul className="combo-list god-seat-combo-list">
                {seatItems.length === 0 ? (
                  <li className="combo-empty">{t('godView.noSuggestion')}</li>
                ) : (
                  seatItems.map((item) => {
                    const key = `${player.seat}-${item.originIndex}-${item.combo.type}`;
                    const category = comboCategory(item);
                    return (
                      <li key={key} className={`combo-${category}`}>
                        <div className="combo-line">
                          <span>{comboLineText(item, t)}</span>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
              <button
                className="ghost god-import-btn"
                onClick={() => onImportHand(player.cards, player.seat)}
              >
                {t('godView.importSeatHand', { count: player.cards.length })}
              </button>
            </section>
          );
        })}
      </div>

      <div className="god-analysis-stack">
        <div className="god-overview-grid">
          <p>
            {t('godView.overviewOpponentBombs', { count: godViewData.overview.opponentBombTotal })}
          </p>
          <p>
            {t('godView.overviewTeammateBombs', { count: godViewData.overview.teammateBombTotal })}
          </p>
          <p>
            {t('godView.interruption', { value: godViewData.realtime.interruptionProbability })}
          </p>
          <p>{t('godView.backup', { value: godViewData.realtime.backupValue })}</p>
        </div>

        <div className="god-composition">
          <h3>{t('godView.composition')}</h3>
          <p>
            {t('godView.compositionSummary', {
              hands: godViewData.composition.handCount,
              bombs: godViewData.composition.bombCount,
              key: godViewData.composition.keyScore,
              interruption: godViewData.composition.interruptionProbability,
              recapture: godViewData.composition.controlRecapture
            })}
          </p>
          {godViewData.composition.explanation && (
            <p className="god-explanation">
              {localizeGodExplanation(godViewData.composition.explanation, t)}
            </p>
          )}
        </div>

        {godViewData.tribute && (
          <div className="god-tribute">
            <h3>{t('godView.tribute')}</h3>
            {godViewData.tribute.best && (
              <p>
                {t('godView.bestTribute', {
                  card: localizedCardLabel(godViewData.tribute.best.card, t),
                  delta: `${godViewData.tribute.best.oppFireDelta >= 0 ? '+' : ''}${godViewData.tribute.best.oppFireDelta}`
                })}
              </p>
            )}
            {godViewData.tribute.worst &&
              godViewData.tribute.worst !== godViewData.tribute.best && (
                <p className="warn">
                  {t('godView.worstTribute', {
                    card: localizedCardLabel(godViewData.tribute.worst.card, t),
                    delta: `${godViewData.tribute.worst.oppFireDelta >= 0 ? '+' : ''}${godViewData.tribute.worst.oppFireDelta}`
                  })}
                </p>
              )}
          </div>
        )}
      </div>
    </article>
  );
}
