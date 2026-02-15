export default function StatusBar({
  trumpRank,
  assignedCardsCount,
  remainingCount,
  jokersRemain,
  wildcardRemain
}) {
  return (
    <section className="status-bar">
      <span>
        当前打几：<strong>{trumpRank}</strong>
      </span>
      <span>
        红桃级牌（逢人配）：<strong>♥{trumpRank}</strong>
      </span>
      <span>
        已分配：<strong>{assignedCardsCount}/27</strong>
      </span>
      <span>
        剩余牌：<strong>{remainingCount}</strong>（王 {jokersRemain}，逢人配 {wildcardRemain}）
      </span>
    </section>
  );
}
