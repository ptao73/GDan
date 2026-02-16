export default function BottomBar({
  assignedCardsCount,
  isSolving,
  handlePrimaryAction,
  primaryActionLabel,
  primaryActionDisabled,
  aiSearchModeLabel
}) {
  return (
    <section className="bottom-action-bar">
      <div className="bottom-action-meta">
        <strong>{primaryActionLabel}</strong>
        <span>已分配 {assignedCardsCount}/27</span>
        <span>当前档位：{aiSearchModeLabel}</span>
      </div>
      <button onClick={handlePrimaryAction} disabled={primaryActionDisabled}>
        {isSolving ? '专家正在计算中...' : primaryActionLabel}
      </button>
    </section>
  );
}
