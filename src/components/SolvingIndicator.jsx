// AI 计算时的跳动圆点动画指示器
import { useI18n } from '../i18n/index.js';

export default function SolvingIndicator({ progress }) {
  const { t } = useI18n();
  const text = progress
    ? t('ai.solvingProgress', { current: progress.current, total: progress.total })
    : t('ai.solving');

  return (
    <span className="solving-indicator">
      <span className="solving-dot" />
      <span className="solving-dot" />
      <span className="solving-dot" />
      <span>{text}</span>
    </span>
  );
}
