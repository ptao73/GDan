import { cardLabel } from '../engine/cards.js';

function comboText(combo) {
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
  return `手${option.handCount} 火${option.fireCount} 控${option.keyScore} 闷${option.interruptionProbability}% 接风${option.controlRecapture}%`;
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
        <p className="warn" style={{ marginBottom: '8px' }}>⚠ 残局模式 — 对手理论手数 ≤ 4，每一手牌至关重要</p>
      )}
      <div className="god-overview-grid">
        <p>对手火力：{godViewData.overview.opponentFireTotal}</p>
        <p>队友火力：{godViewData.overview.teammateFireTotal}</p>
        <p>阻断概率：{godViewData.realtime.interruptionProbability}%</p>
        <p>接风价值：{godViewData.realtime.backupValue}%</p>
      </div>

      <div className="god-composition">
        <h3>组牌最优化对比（A/B）</h3>
        <p className="hint">
          推荐：{godViewData.composition.recommended === 'aggressive' ? '方案B 进攻型' : '方案A 稳健型'}，
          {godViewData.composition.reason}
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
              （对手火力变化 {godViewData.tribute.best.oppFireDelta >= 0 ? '+' : ''}
              {godViewData.tribute.best.oppFireDelta}）
            </p>
          )}
          {godViewData.tribute.worst && godViewData.tribute.worst !== godViewData.tribute.best && (
            <p className="warn">
              最差进贡：
              {cardLabel(godViewData.tribute.worst.card)}
              （对手火力变化 {godViewData.tribute.worst.oppFireDelta >= 0 ? '+' : ''}
              {godViewData.tribute.worst.oppFireDelta}）
            </p>
          )}
        </div>
      )}

      <div className="god-players-grid">
        {godViewData.players.map((player) => (
          <section key={player.seat} className={`god-seat role-${player.role}`}>
            <header>
              <h3>
                {player.seatName}家（{roleText(player.role)}）
              </h3>
              <span className="god-threat">威胁 {player.threatScore}</span>
            </header>
            <p>
              理论手数 {player.preferred.handCount} | 火力 {player.preferred.fireCount} | 炸弹{' '}
              {player.preferred.bombCount} | 控牌 {player.preferred.keyScore} | 推荐
              {strategyText(player.preferredStrategy)}
            </p>
            <p className="god-combo-line">
              组牌建议：{player.preferred.combos.map((combo) => comboText(combo)).join(' · ') || '--'}
            </p>
            <details>
              <summary>查看手牌（{player.cards.length}）</summary>
              <p className="god-ghost-cards">{player.cards.map((card) => cardLabel(card)).join(' ')}</p>
            </details>
          </section>
        ))}
      </div>
    </article>
  );
}
