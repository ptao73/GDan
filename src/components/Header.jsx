export default function Header({
  startNewDeal,
  exportHistory,
  openImportDialog,
  importHistory,
  importInputRef,
  isSolving,
  aiSearchMode,
  aiSearchModeOptions,
  setAiSearchMode
}) {
  return (
    <header className="hero">
      <div>
        <h1>掼蛋组牌评分系统</h1>
        <p>两副牌 108 张，每局发 27 张。先组牌，再与 AI 方案对照训练。</p>
      </div>
      <div className="hero-actions">
        <button onClick={startNewDeal} disabled={isSolving}>
          新开牌局
        </button>
        <button className="ghost" onClick={exportHistory} disabled={isSolving}>
          导出JSON
        </button>
        <button className="ghost" onClick={openImportDialog} disabled={isSolving}>
          导入JSON
        </button>
        <label className="mode-selector">
          <span>AI搜索档位</span>
          <select
            value={aiSearchMode}
            onChange={(event) => setAiSearchMode(event.target.value)}
            disabled={isSolving}
          >
            {aiSearchModeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <input
          ref={importInputRef}
          className="hidden-input"
          type="file"
          accept="application/json"
          onChange={importHistory}
        />
      </div>
    </header>
  );
}
