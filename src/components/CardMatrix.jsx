const MATRIX_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const MATRIX_SUITS = [
  { key: 'S', label: '♠' },
  { key: 'H', label: '♥' },
  { key: 'C', label: '♣' },
  { key: 'D', label: '♦' }
];

export default function CardMatrix({ matrixCounts, rankTotals, trumpRank }) {
  return (
    <div className="matrix-board">
      <div className="rank-strip">
        {MATRIX_RANKS.map((rank) => (
          <span key={rank} className={`rank-tag ${rank === trumpRank ? 'trump' : ''}`}>
            {rank}
          </span>
        ))}
      </div>
      <div className="matrix-grid" role="table" aria-label="13x4 手牌矩阵">
        <div className="matrix-row matrix-head">
          <span className="matrix-label head">花色</span>
          {MATRIX_RANKS.map((rank) => (
            <span
              key={`head-${rank}`}
              className={`matrix-label ${rank === trumpRank ? 'trump-column' : ''}`}
            >
              {rankTotals[rank]}
            </span>
          ))}
        </div>
        {MATRIX_SUITS.map((suit) => (
          <div className="matrix-row" key={suit.key}>
            <span className={`matrix-label suit ${suit.key === 'H' ? 'heart' : ''}`}>
              {suit.label}
            </span>
            {MATRIX_RANKS.map((rank) => {
              const key = `${suit.key}-${rank}`;
              const count = matrixCounts[key] || 0;
              const isTrumpColumn = rank === trumpRank;
              const isWildcardCell = suit.key === 'H' && rank === trumpRank;
              return (
                <span
                  key={key}
                  className={`matrix-cell ${isTrumpColumn ? 'trump-column' : ''} ${
                    isWildcardCell ? 'wildcard-cell' : ''
                  }`}
                >
                  {count}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <p className="hint">13×4 矩阵：级牌列高亮，♥级牌即逢人配。</p>
    </div>
  );
}
