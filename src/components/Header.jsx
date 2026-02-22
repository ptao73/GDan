import { useEffect, useState } from 'react';

const RANK_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export default function Header({
  onNewDeal,
  onAutoComplete,
  onConfirmGroup,
  onImport,
  newDealDisabled = false,
  autoCompleteDisabled = false,
  confirmDisabled = false,
  importDisabled = false,
  trumpRank = '2'
}) {
  const [compact, setCompact] = useState(false);

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

  const rankIndex = Math.max(0, RANK_ORDER.indexOf(trumpRank));
  const lightnessShift = Math.round((rankIndex / (RANK_ORDER.length - 1)) * 8 - 4);

  const actionItems = [
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
    },
    {
      key: 'import',
      full: '导入',
      compact: '导入',
      icon: '⇅',
      onClick: onImport,
      disabled: importDisabled
    }
  ];

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
          {actionItems.map((item) => (
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
