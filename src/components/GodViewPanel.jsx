import { cardLabel } from '../engine/cards.js';
import { scoreComboNoRound } from '../engine/scoring.js';

function comboLabel(combo) {
  if (!combo) return '';
  if (combo.sequence) {
    return `${combo.label}(${combo.sequence.join('-')})`;
  }
  if (combo.type === 'threeWithPair') {
    return `${combo.label}(${combo.tripleRank}带${combo.pairRank})`;
  }
  if (combo.mainRank) {
    return `${combo.label}(${combo.mainRank})`;
  }
  return combo.label;
}

function roleText(role) {
  if (role === 'self') return '我';
  if (role === 'teammate') return '队友';
  return '对手';
}

function strategyText(key) {
  return key === 'aggressive' ? '进攻型' : '稳健型';
}

function optionSummary(option) {
  if (!option) return '--';
  return `手${option.handCount} 炸${option.bombCount} 控${option.keyScore} 闷${option.interruptionProbability}% 接风${option.controlRecapture}%`;
}

function comboCategory(item) {
  if (item.burstScore > 0) return 'fire';
  if (item.keyScore > 0) return 'key';
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

function comboLineText(item) {
  const cards = (item.combo.cards || []).map((card) => cardLabel(card)).join(' ');
  return `${comboLabel(item.combo)}（${item.total}分）：${cards}`;
}

export default function GodViewPanel({ godViewData, godViewStatus }) {
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
      {godViewData.endgameFlag && (
        <p className="warn" style={{ marginBottom: '8px' }}>
          ⚠ 残局模式 — 对手理论手数 ≤ 4，每一手牌至关重要
        </p>
      )}
      <div className="god-players-grid">
        {godViewData.players.map((player) => {
          const seatItems = buildSeatComboItems(player, godViewData.trumpRank);
          return (
            <section key={player.seat} className={`god-seat role-${player.role}`}>
              <header>
                <h3>
                  {player.seatName}家（{roleText(player.role)}）
                </h3>
                <span className="god-threat">威胁 {player.threatScore}</span>
              </header>
              <p className="god-seat-metrics">
                理论手数 {player.preferred.handCount} | 炸弹 {player.preferred.bombCount} | 控牌{' '}
                {player.preferred.keyScore} | 推荐{strategyText(player.preferredStrategy)}
              </p>
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
          <h3>组牌最优化对比（A/B）</h3>
          <p className="hint">
            推荐：
            {godViewData.composition.recommended === 'aggressive' ? '方案B 进攻型' : '方案A 稳健型'}
            ，{godViewData.composition.reason}
          </p>
          {godViewData.composition.explanation && (
            <p className="god-explanation">{godViewData.composition.explanation}</p>
          )}
          <div className="god-composition-grid">
            <p className={godViewData.composition.recommended === 'stable' ? 'picked' : ''}>
              方案A 稳健型：{optionSummary(godViewData.composition.stable)}
            </p>
            <p className={godViewData.composition.recommended === 'aggressive' ? 'picked' : ''}>
              方案B 进攻型：{optionSummary(godViewData.composition.aggressive)}
            </p>
          </div>
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
