import { cardLabel } from '../engine/cards.js';
import { isBomb } from '../engine/combos.js';
import { scoreComboNoRound, scoreScheme } from '../engine/scoring.js';
import { comboRankVector, compareComboDisplayOrder } from '../utils/comboDisplay.js';

function roleText(role) {
  if (role === 'self') return '我';
  if (role === 'teammate') return '队友';
  return '对手';
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

function comboLineText(item) {
  const cards = (item.combo.cards || []).map((card) => cardLabel(card)).join(' ');
  return `${item.combo.label}（${item.total}分）：${cards}`;
}

export default function GodViewPanel({ godViewData, godViewStatus, godViewStale, onRefresh }) {
  if (godViewStatus === 'running') {
    return (
      <article className="panel god-view-panel">
        <h2>上帝视角</h2>
        <p className="hint">正在计算四家全局分析，请稍候...</p>
      </article>
    );
  }

  if (godViewStatus === 'failed') {
    return (
      <article className="panel god-view-panel">
        <h2>上帝视角</h2>
        <p className="warn">分析失败，请重新开局或再次点击上帝视角。</p>
      </article>
    );
  }

  if (!godViewData) {
    return (
      <article className="panel god-view-panel">
        <h2>上帝视角</h2>
        <p className="hint">发牌后会后台预计算。点击“上帝视角”可查看四家牌局因果分析。</p>
      </article>
    );
  }

  return (
    <article className="panel god-view-panel">
      <h2>上帝视角</h2>
      {godViewStale && (
        <p className="warn" style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          组牌已变化，当前分析可能不准确
          {onRefresh && (
            <button className="ghost" onClick={onRefresh} style={{ fontSize: '0.85em' }}>
              刷新分析
            </button>
          )}
        </p>
      )}
      {godViewData.endgameFlag && (
        <p className="warn" style={{ marginBottom: '8px' }}>
          ⚠ 残局模式 — 对手理论手数 ≤ 4，每一手牌至关重要
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
                  {player.seatName}家（{roleText(player.role)}）
                </h3>
                <span className="god-seat-score">总分 {seatTotal}</span>
                <span className="god-threat">威胁 {player.threatScore}</span>
              </header>
              <ul className="combo-list god-seat-combo-list">
                {seatItems.length === 0 ? (
                  <li className="combo-empty">暂无牌形建议。</li>
                ) : (
                  seatItems.map((item) => {
                    const key = `${player.seat}-${item.originIndex}-${item.combo.type}`;
                    const category = comboCategory(item);
                    return (
                      <li key={key} className={`combo-${category}`}>
                        <div className="combo-line">
                          <span>{comboLineText(item)}</span>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
              <details>
                <summary>查看手牌（{player.cards.length}）</summary>
                <p className="god-ghost-cards">
                  {player.cards.map((card) => cardLabel(card)).join(' ')}
                </p>
              </details>
            </section>
          );
        })}
      </div>

      <div className="god-analysis-stack">
        <div className="god-overview-grid">
          <p>对手炸弹：{godViewData.overview.opponentBombTotal}</p>
          <p>队友炸弹：{godViewData.overview.teammateBombTotal}</p>
          <p>阻断概率：{godViewData.realtime.interruptionProbability}%</p>
          <p>接风价值：{godViewData.realtime.backupValue}%</p>
        </div>

        <div className="god-composition">
          <h3>组牌分析</h3>
          <p>
            手{godViewData.composition.handCount} 炸{godViewData.composition.bombCount} 控{godViewData.composition.keyScore} 闷{godViewData.composition.interruptionProbability}% 接风{godViewData.composition.controlRecapture}%
          </p>
          {godViewData.composition.explanation && (
            <p className="god-explanation">{godViewData.composition.explanation}</p>
          )}
        </div>

        {godViewData.tribute && (
          <div className="god-tribute">
            <h3>进贡分析</h3>
            {godViewData.tribute.best && (
              <p>
                最优进贡：
                {cardLabel(godViewData.tribute.best.card)}
                （对手炸弹变化 {godViewData.tribute.best.oppFireDelta >= 0 ? '+' : ''}
                {godViewData.tribute.best.oppFireDelta}）
              </p>
            )}
            {godViewData.tribute.worst &&
              godViewData.tribute.worst !== godViewData.tribute.best && (
                <p className="warn">
                  最差进贡：
                  {cardLabel(godViewData.tribute.worst.card)}
                  （对手炸弹变化 {godViewData.tribute.worst.oppFireDelta >= 0 ? '+' : ''}
                  {godViewData.tribute.worst.oppFireDelta}）
                </p>
              )}
          </div>
        )}
      </div>
    </article>
  );
}
