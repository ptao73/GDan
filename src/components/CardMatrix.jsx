import { Fragment } from 'react';
import PlayingCard from './PlayingCard.jsx';

const MATRIX_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const MATRIX_SUITS = [
  { key: 'S', label: '♠', red: false },
  { key: 'H', label: '♥', red: true },
  { key: 'C', label: '♣', red: false },
  { key: 'D', label: '♦', red: true }
];

// 13×4 矩阵：每个格子里放实际的扑克牌，点击选中/取消
export default function CardMatrix({
  remainingCards,
  selectedIds,
  toggleCard,
  trumpRank,
  isSolving
}) {
  // 按 "花色-点数" 分组，王牌单独处理
  const cardMap = {};
  const jokers = [];

  for (const card of remainingCards) {
    if (card.rank === 'SJ' || card.rank === 'BJ') {
      jokers.push(card);
      continue;
    }
    const key = `${card.suit}-${card.rank}`;
    if (!cardMap[key]) cardMap[key] = [];
    cardMap[key].push(card);
  }

  return (
    <div className="matrix-board">
      <div className="card-matrix-grid">
        {/* 表头行：点数 2-A */}
        <span className="matrix-corner" />
        {MATRIX_RANKS.map((rank) => (
          <span
            key={`h-${rank}`}
            className={`matrix-rank-head ${rank === trumpRank ? 'trump' : ''}`}
          >
            {rank}
          </span>
        ))}

        {/* 4 行花色 × 13 列点数 */}
        {MATRIX_SUITS.map((suit) => (
          <Fragment key={suit.key}>
            <span className={`matrix-suit-head ${suit.red ? 'red' : ''}`}>
              {suit.label}
            </span>
            {MATRIX_RANKS.map((rank) => {
              const cellKey = `${suit.key}-${rank}`;
              const cards = cardMap[cellKey] || [];
              const isTrump = rank === trumpRank;
              const isWild = suit.key === 'H' && rank === trumpRank;

              return (
                <div
                  key={cellKey}
                  className={`matrix-card-cell${isTrump ? ' trump-col' : ''}${isWild ? ' wild-col' : ''}${cards.length === 0 ? ' empty' : ''}`}
                >
                  {cards.map((card) => (
                    <PlayingCard
                      key={card.id}
                      card={card}
                      isSelected={selectedIds.includes(card.id)}
                      onClick={() => toggleCard(card.id)}
                      disabled={isSolving}
                    />
                  ))}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>

      {/* 王牌行 */}
      {jokers.length > 0 && (
        <div className="matrix-joker-row">
          <span className="matrix-suit-head">王</span>
          {jokers.map((card) => (
            <PlayingCard
              key={card.id}
              card={card}
              isSelected={selectedIds.includes(card.id)}
              onClick={() => toggleCard(card.id)}
              disabled={isSolving}
            />
          ))}
        </div>
      )}

      <p className="hint">点选矩阵中的牌进行选择。级牌列高亮，♥级牌即逢人配。</p>
    </div>
  );
}
