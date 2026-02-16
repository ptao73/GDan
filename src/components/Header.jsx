export default function Header() {
  return (
    <header className="hero festival-hero">
      <img
        className="dragon-ornament dragon-left-img"
        src="/ornaments/dragon-left.png"
        alt=""
        aria-hidden="true"
      />
      <div className="hero-center">
        <span className="hero-pearl-shell" aria-hidden="true">
          <img className="hero-pearl" src="/ornaments/peal.png" alt="" />
        </span>
        <h1>掼蛋组牌评分系统</h1>
        <p>两副牌 108 张，每局发 27 张。先组牌，再与 AI 方案对照训练。</p>
      </div>
      <img
        className="dragon-ornament dragon-right-img"
        src="/ornaments/dragon-left.png"
        alt=""
        aria-hidden="true"
      />
    </header>
  );
}
