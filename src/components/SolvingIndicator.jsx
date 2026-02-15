// AI 计算时的跳动圆点动画指示器
export default function SolvingIndicator() {
  return (
    <span className="solving-indicator">
      <span className="solving-dot" />
      <span className="solving-dot" />
      <span className="solving-dot" />
      <span>专家正在计算中</span>
    </span>
  );
}
