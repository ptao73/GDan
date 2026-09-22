import { languageLocale, useI18n } from '../i18n/index.js';

function formatTime(timestamp, language) {
  return new Date(timestamp).toLocaleString(languageLocale(language), { hour12: false });
}

export default function HistoryPanel({ history }) {
  const { language, t } = useI18n();

  return (
    <article className="panel">
      <h2>{t('panels.recentGames')}</h2>
      <ul className="history-list">
        {history.map((item) => (
          <li key={item.id}>
            <span>{formatTime(item.timestamp, language)}</span>
            <span>{t('panels.historyLevel', { rank: item.trumpRank })}</span>
            <span>
              {t('labels.user')} {item.userScore}
            </span>
            <span>
              {t('labels.ai')} {item.aiScore}
            </span>
            <span>
              {item.isOptimal
                ? t('panels.optimal')
                : t('panels.gap', { count: Math.max(0, item.aiScore - item.userScore) })}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}
