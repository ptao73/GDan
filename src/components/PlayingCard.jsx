import { suitLabel } from '../engine/cards.js';
import { localizedCardLabel, useI18n } from '../i18n/index.js';
import './PlayingCard.css';

// 单张扑克牌组件：纯 CSS 绘制的真实扑克牌效果
export default function PlayingCard({ card, isSelected, onClick, disabled }) {
  const { t } = useI18n();
  const isRed = card.suit === 'H' || card.suit === 'D';
  const isJoker = card.rank === 'SJ' || card.rank === 'BJ';
  const isBigJoker = card.rank === 'BJ';

  // 牌面显示内容
  const displayRank = isJoker ? 'J' : card.rank;
  const displaySuit = isJoker ? '' : suitLabel(card.suit);
  const centerText = isJoker ? t('card.joker') : suitLabel(card.suit);

  let cls = 'playing-card';
  if (isSelected) cls += ' selected';
  if (isRed && !isJoker) cls += ' red';
  if (card.isWildcard) cls += ' wild';
  if (isJoker) {
    cls += ' joker';
    cls += isBigJoker ? ' joker-big' : ' joker-small';
  }

  return (
    <button
      className={cls}
      onClick={onClick}
      disabled={disabled}
      aria-label={localizedCardLabel(card, t)}
    >
      <span className="card-tl">
        <span className="card-rank">{displayRank}</span>
        <span className="card-suit-small">{displaySuit}</span>
      </span>
      <span className="card-center">{centerText}</span>
      <span className="card-br">
        <span className="card-rank">{displayRank}</span>
        <span className="card-suit-small">{displaySuit}</span>
      </span>
    </button>
  );
}
