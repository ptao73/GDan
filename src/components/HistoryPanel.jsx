function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false });
}

export default function HistoryPanel({ history }) {
  return (
    <article className="panel">
      <h2>最近对局</h2>
      <ul className="history-list">
        {history.map((item) => (
          <li key={item.id}>
            <span>{formatTime(item.timestamp)}</span>
            <span>打几 {item.trumpRank}</span>
            <span>用户 {item.userScore}</span>
            <span>AI {item.aiScore}</span>
            <span>
              {item.isOptimal
                ? '命中最优'
                : `差 ${Math.max(0, item.aiScore - item.userScore)} 分`}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}
