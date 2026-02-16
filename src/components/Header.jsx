export default function Header() {
  return (
    <header className="hero festival-hero">
      <div className="dragon-side left" aria-hidden="true">
        <span className="dragon-body" />
        <span className="dragon-head">龍</span>
        <span className="dragon-claw">爪</span>
      </div>
      <div className="hero-center">
        <h1>掼蛋组牌评分系统</h1>
        <p>两副牌 108 张，每局发 27 张。先组牌，再与 AI 方案对照训练。</p>
      </div>
      <div className="dragon-side right" aria-hidden="true">
        <span className="dragon-body" />
        <span className="dragon-head">龍</span>
        <span className="dragon-claw">爪</span>
      </div>
    </header>
  );
}
