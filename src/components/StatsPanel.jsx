import './StatsPanel.css';

// 分差分布条形图数据定义
const BUCKET_CONFIG = [
  { key: 'equal', label: '=0分', color: 'green' },
  { key: 'close', label: '1-2分', color: 'blue' },
  { key: 'medium', label: '3-5分', color: 'orange' },
  { key: 'wide', label: '6+分', color: 'red' }
];

export default function StatsPanel({ stats }) {
  return (
    <article className="panel">
      <h2>统计分析</h2>
      {stats ? (
        <>
          <div className="score-grid compact">
            <p>总局数：{stats.totalGames}</p>
            <p>最优命中率：{stats.hitRate}%</p>
            <p>平均分差：{stats.avgGap}</p>
            <p>用户平均手数：{stats.userHandsAvg}</p>
            <p>AI平均手数：{stats.aiHandsAvg}</p>
            <p>用户平均炸弹数：{stats.userBombAvg}</p>
            <p>AI平均炸弹数：{stats.aiBombAvg}</p>
          </div>

          {/* 分差分布 — CSS 横向条形图 */}
          <GapBarChart buckets={stats.gapBuckets} />

          <h3>建议</h3>
          <ul className="suggest-list">
            {stats.suggestions.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </>
      ) : (
        <div className="skeleton-grid">
          <div className="skeleton-line" />
          <div className="skeleton-line short" />
          <div className="skeleton-line" />
          <div className="skeleton-line short" />
        </div>
      )}
    </article>
  );
}

function GapBarChart({ buckets }) {
  const items = BUCKET_CONFIG.map((cfg) => ({
    ...cfg,
    count: buckets[cfg.key] || 0
  }));
  const maxCount = Math.max(...items.map((b) => b.count), 1);

  return (
    <div className="stats-bar-chart">
      <h3>分差分布</h3>
      {items.map((b) => (
        <div key={b.key} className="stats-bar-row">
          <span className="stats-bar-label">{b.label}</span>
          <div className="stats-bar-track">
            <div
              className={`stats-bar-fill ${b.color}`}
              style={{
                width: `${Math.max((b.count / maxCount) * 100, b.count > 0 ? 10 : 0)}%`
              }}
            >
              {b.count}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
