import { cardLabel } from '../engine/cards.js';
import { comboKey } from '../engine/combos.js';
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

function differenceHint(userScore, aiScore) {
  if (!userScore || !aiScore) return '';

  const gap = aiScore.total - userScore.total;
  if (gap <= 0) {
    return '你的方案已达到 AI 当前结果。';
  }

  const handGap = userScore.detail.handCount - aiScore.detail.handCount;
  if (handGap > 0) {
    return `AI 方案少 ${handGap} 手，轮次修正更优，是主要分差来源。`;
  }

  const burstGap = aiScore.detail.burstScore - userScore.detail.burstScore;
  if (burstGap > 0) {
    return `AI 在火力得分上多 ${burstGap} 分，更多保留了高价值爆发牌型。`;
  }

  const shapeGap = aiScore.detail.shapeScore - userScore.detail.shapeScore;
  if (shapeGap > 0) {
    return `AI 在牌型结构得分上多 ${shapeGap} 分，组合点数档位更高。`;
  }

  return `AI 总分高 ${gap} 分，建议重点检查三带二与连续结构的拆分。`;
}

export default function AiResult({
  aiResult,
  aiStatus,
  userScore,
  aiScoreView,
  userComboKeySet
}) {
  return (
    <article className="panel">
      <h2>AI方案</h2>
      {aiStatus === 'running' ? <SolvingIndicator /> : null}
      {aiResult ? (
        <>
          <p>
            {aiResult.timedOut ? 'AI较优方案' : 'AI最优方案'}：<strong>{aiResult.score}</strong>
          </p>
          <p>
            计算耗时：{aiResult.elapsedMs}ms
            {aiResult.timedOut ? '（超时降级，返回当前最佳方案）' : ''}
          </p>
          <p className="diff-legend">
            <span className="tag removed">红色：AI拆开了你的组合</span>
            <span className="tag added">绿色：AI新整合出的组合</span>
            <span className="tag same">灰色：双方一致</span>
          </p>
          <p className="hint">{differenceHint(userScore, aiScoreView)}</p>
          <ul className="combo-list ai-list">
            {aiResult.combos.map((combo, index) => {
              const key = comboKey(combo);
              const compareClass = userComboKeySet.has(key) ? 'same' : 'added';
              return (
                <li key={`${key}-${index}`} className={compareClass}>
                  <span>{comboText(combo)}</span>
                </li>
              );
            })}
          </ul>
          {aiScoreView ? (
            <div className="score-grid compact">
              <p>AI牌型分：{aiScoreView.detail.shapeScore}</p>
              <p>AI火力分：{aiScoreView.detail.burstScore}</p>
              <p>AI关键牌分：{aiScoreView.detail.keyScore}</p>
              <p>AI轮次修正：{aiScoreView.detail.roundScore}</p>
              <p>AI总手数：{aiScoreView.detail.handCount}</p>
            </div>
          ) : null}
        </>
      ) : (
        <p className="hint">提交评分后展示 AI 对照和差异解释。</p>
      )}
    </article>
  );
}
