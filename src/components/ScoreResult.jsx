export default function ScoreResult({ userScore }) {
  return (
    <article className="panel">
      <h2>评分结果</h2>
      {userScore ? (
        <div className="score-grid">
          <p>
            用户总分：<strong>{userScore.total}</strong>
          </p>
          <p>牌型分：{userScore.detail.shapeScore}</p>
          <p>火力分：{userScore.detail.burstScore}</p>
          <p>关键牌分：{userScore.detail.keyScore}</p>
          <p>轮次修正：{userScore.detail.roundScore}</p>
          <p>总手数：{userScore.detail.handCount}</p>
        </div>
      ) : (
        <p className="hint">完成 27 张组牌后点击提交评分。</p>
      )}
    </article>
  );
}
