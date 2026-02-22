// AI 计算时的跳动圆点动画指示器
export default function SolvingIndicator({ progress }) {
  const text = progress
    ? `专家正在计算中 ${progress.current}/${progress.total}`
    : '专家正在计算中';

  return (
    <span className="solving-indicator">
      <span className="solving-dot" />
      <span className="solving-dot" />
      <span className="solving-dot" />
      <span>{text}</span>
    </span>
  );
}
