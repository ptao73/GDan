import PlayingCard from './PlayingCard.jsx';

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const JOKER_RANKS = ['BJ', 'SJ'];
const MATRIX_COLUMNS = [...JOKER_RANKS, ...RANKS];
const SUIT_ROWS = [
  { key: 'S', label: '♠', isRed: false },
  { key: 'H', label: '♥', isRed: true },
  { key: 'C', label: '♣', isRed: false },
  { key: 'D', label: '♦', isRed: true }
];

export default function CardMatrix({
  remainingCards,
  selectedIds,
  toggleCard,
  trumpRank,
  isSolving
}) {
  const matrix = {};
  const jokerMatrix = { BJ: [], SJ: [] };
  for (const card of remainingCards) {
    if (card.rank === 'SJ' || card.rank === 'BJ') {
      jokerMatrix[card.rank].push(card);
      continue;
    }

    const key = `${card.suit}-${card.rank}`;
    if (!matrix[key]) {
      matrix[key] = [];
    }
    matrix[key].push(card);
  }

  jokerMatrix.BJ.sort((a, b) => a.id.localeCompare(b.id));
  jokerMatrix.SJ.sort((a, b) => a.id.localeCompare(b.id));

  return (
    <div className="matrix-board">
      <div className="card-matrix-grid">
        <div className="matrix-head-row">
          <span className="matrix-corner" />
          {MATRIX_COLUMNS.map((rank) => (
            <span
              key={`head-${rank}`}
              className={`matrix-rank-head ${JOKER_RANKS.includes(rank) ? 'joker-head' : ''}`}
            >
              {rank === 'BJ' ? '大王' : rank === 'SJ' ? '小王' : rank}
            </span>
          ))}
        </div>

        <div className="matrix-body">
          {SUIT_ROWS.map((suit, rowIndex) => (
            <div key={suit.key} className={`matrix-row matrix-row-${rowIndex}`}>
              <span className={`matrix-suit-head ${suit.isRed ? 'red' : ''}`}>
                {suit.label}
              </span>
              {MATRIX_COLUMNS.map((rank) => {
                const isJokerColumn = JOKER_RANKS.includes(rank);
                const isVirtualJokerCell = isJokerColumn && suit.key !== 'S';
                const key = isJokerColumn ? `J-${rank}-${suit.key}` : `${suit.key}-${rank}`;
                const cardsInCell = isJokerColumn
                  ? suit.key === 'S'
                    ? jokerMatrix[rank]
                    : []
                  : matrix[`${suit.key}-${rank}`] || [];

                return (
                  <div
                    key={key}
                    className={`matrix-card-cell ${cardsInCell.length === 0 ? 'empty' : ''} ${
                      isVirtualJokerCell ? 'joker-virtual' : ''
                    }`}
                  >
                    {cardsInCell.length === 0 ? (
                      isVirtualJokerCell ? null : <span className="matrix-empty-slot" />
                    ) : (
                      <div className={`matrix-stack ${cardsInCell.length > 1 ? 'has-pair' : ''}`}>
                        {cardsInCell.map((card) => (
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
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
