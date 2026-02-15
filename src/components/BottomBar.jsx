export default function BottomBar({
  assignedCardsCount,
  canAnalyze,
  isSolving,
  submitScoring
}) {
  return (
    <section className="bottom-action-bar">
      <div className="bottom-action-meta">
        <strong>开始分析</strong>
        <span>已分配 {assignedCardsCount}/27，需满 27 张方可提交</span>
      </div>
      <button onClick={submitScoring} disabled={!canAnalyze}>
        {isSolving ? '专家正在计算中...' : '开始分析（AI对照）'}
      </button>
    </section>
  );
}
