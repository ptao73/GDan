import { useEffect, useRef, useState } from 'react';

const RANK_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export default function Header({
  onNewDeal,
  onAutoComplete,
  onConfirmGroup,
  onViewStats,
  onExportHistory,
  onImportHistory,
  onImportHandJson,
  onImportHandCamera,
  onImportHandPhoto,
  newDealDisabled = false,
  autoCompleteDisabled = false,
  confirmDisabled = false,
  dataToolsDisabled = false,
  trumpRank = '2'
}) {
  const [compact, setCompact] = useState(false);
  const [dataToolsOpen, setDataToolsOpen] = useState(false);
  const dataToolsRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      setCompact((prev) => {
        const nextScrollY = window.scrollY;
        if (!prev && nextScrollY > 80) return true;
        if (prev && nextScrollY < 60) return false;
        return prev;
      });
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!dataToolsOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!dataToolsRef.current?.contains(event.target)) {
        setDataToolsOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setDataToolsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [dataToolsOpen]);

  const rankIndex = Math.max(0, RANK_ORDER.indexOf(trumpRank));
  const lightnessShift = Math.round((rankIndex / (RANK_ORDER.length - 1)) * 8 - 4);

  const primaryActionItems = [
    {
      key: 'deal',
      full: '新一局',
      compact: '新一局',
      icon: '↻',
      onClick: onNewDeal,
      disabled: newDealDisabled
    },
    {
      key: 'auto',
      full: '自动补全',
      compact: '自动补全',
      icon: '⚡',
      onClick: onAutoComplete,
      disabled: autoCompleteDisabled
    },
    {
      key: 'confirm',
      full: '确认成组',
      compact: '确认成组',
      icon: '✓',
      onClick: onConfirmGroup,
      disabled: confirmDisabled
    }
  ];

  const dataToolItems = [
    { key: 'stats', label: '统计分析', onClick: onViewStats },
    { key: 'exportHistory', label: '导出历史JSON', onClick: onExportHistory },
    { key: 'importHistory', label: '导入历史JSON', onClick: onImportHistory },
    { key: 'importHandJson', label: '导入手牌JSON', onClick: onImportHandJson },
    { key: 'importHandCamera', label: '拍照识别导入', onClick: onImportHandCamera },
    { key: 'importHandPhoto', label: '上传照片识别', onClick: onImportHandPhoto }
  ];

  const handleDataToolClick = (callback) => {
    setDataToolsOpen(false);
    callback?.();
  };

  return (
    <header
      className={`hero festival-hero${compact ? ' hero-compact' : ''}`}
      style={{ '--hero-lightness-shift': `${lightnessShift}%` }}
    >
      <img
        className="dragon-ornament dragon-left-img"
        src="/ornaments/dragon-left.png"
        alt=""
        aria-hidden="true"
      />
      <div className="hero-center">
        <div className="hero-heading">
          <span className="hero-pearl-shell" aria-hidden="true">
            <img className="hero-pearl" src="/ornaments/peal.png" alt="" />
          </span>
          <h1>掼蛋组牌评分系统</h1>
        </div>
        <div className="hero-actions" role="group" aria-label="快捷操作">
          {primaryActionItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className="hero-action"
              onClick={item.onClick}
              disabled={item.disabled}
            >
              <span className="hero-action-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="hero-action-label-full">{item.full}</span>
              <span className="hero-action-label-compact">{item.compact}</span>
            </button>
          ))}
          <div
            ref={dataToolsRef}
            className={`hero-action-slot${dataToolsOpen ? ' is-open' : ''}`}
            aria-label="导入导出菜单"
          >
            <button
              type="button"
              className="hero-action"
              onClick={() => setDataToolsOpen((prev) => !prev)}
              disabled={dataToolsDisabled}
              aria-haspopup="menu"
              aria-expanded={dataToolsOpen}
            >
              <span className="hero-action-icon" aria-hidden="true">
                ⇅
              </span>
              <span className="hero-action-label-full">导入/导出</span>
              <span className="hero-action-label-compact">导入/导出</span>
            </button>
            {dataToolsOpen ? (
              <div className="hero-tools-menu" role="menu">
                {dataToolItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className="hero-tools-item"
                    role="menuitem"
                    onClick={() => handleDataToolClick(item.onClick)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
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
