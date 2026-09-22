import { useI18n } from '../i18n/index.js';

export default function ErrorBoundaryContent() {
  const { t } = useI18n();

  return (
    <>
      <h2>{t('errorBoundary.title')}</h2>
      <p style={{ margin: '12px 0', color: '#5e5e5e' }}>{t('errorBoundary.message')}</p>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: '8px',
          padding: '10px 20px',
          borderRadius: '10px',
          background: '#0d3b47',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontSize: '15px'
        }}
      >
        {t('errorBoundary.reload')}
      </button>
    </>
  );
}
