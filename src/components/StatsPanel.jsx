import './StatsPanel.css';
import { useI18n } from '../i18n/index.js';

// 分差分布条形图数据定义
const BUCKET_CONFIG = [
  { key: 'equal', labelKey: 'panels.gapEqual', color: 'green' },
  { key: 'close', labelKey: 'panels.gapClose', color: 'blue' },
  { key: 'medium', labelKey: 'panels.gapMedium', color: 'orange' },
  { key: 'wide', labelKey: 'panels.gapWide', color: 'red' }
];

export default function StatsPanel({ stats }) {
  const { t } = useI18n();

  return (
    <article className="panel">
      <h2>{t('panels.stats')}</h2>
      {stats ? (
        <>
          <div className="score-grid compact">
            <p>{t('panels.totalGames', { count: stats.totalGames })}</p>
            <p>{t('panels.hitRate', { value: stats.hitRate })}</p>
            <p>{t('panels.averageGap', { value: stats.avgGap })}</p>
            <p>{t('panels.userHandsAvg', { value: stats.userHandsAvg })}</p>
            <p>{t('panels.aiHandsAvg', { value: stats.aiHandsAvg })}</p>
            <p>{t('panels.userBombAvg', { value: stats.userBombAvg })}</p>
            <p>{t('panels.aiBombAvg', { value: stats.aiBombAvg })}</p>
          </div>

          {/* 分差分布 — CSS 横向条形图 */}
          <GapBarChart buckets={stats.gapBuckets} />

          <h3>{t('panels.suggestions')}</h3>
          <ul className="suggest-list">
            {stats.suggestions.map((item, index) => (
              <li key={`${item.key || item}-${index}`}>{translateSuggestion(item, t)}</li>
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
  const { t } = useI18n();
  const items = BUCKET_CONFIG.map((cfg) => ({
    ...cfg,
    label: t(cfg.labelKey),
    count: buckets[cfg.key] || 0
  }));
  const maxCount = Math.max(...items.map((b) => b.count), 1);

  return (
    <div className="stats-bar-chart">
      <h3>{t('panels.gapDistribution')}</h3>
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

function translateSuggestion(item, t) {
  if (typeof item === 'object' && item?.key) {
    return t(`statsSuggestions.${item.key}`, item.params);
  }
  return item;
}
