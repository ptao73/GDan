import PlayingCard from './PlayingCard.jsx';

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
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
  const jokers = [];
  for (const card of remainingCards) {
    if (card.rank === 'SJ' || card.rank === 'BJ') {
      jokers.push(card);
      continue;
    }

    const key = `${card.suit}-${card.rank}`;
    if (!matrix[key]) {
      matrix[key] = [];
    }
    matrix[key].push(card);
  }

  const sortedJokers = [...jokers].sort((a, b) => {
    if (a.rank === b.rank) return a.id.localeCompare(b.id);
    return a.rank === 'BJ' ? -1 : 1;
  });

  return (
    <div className="matrix-board">
      <div className="card-matrix-grid">
        <span className="matrix-corner" />
        {RANKS.map((rank) => (
          <span
            key={`head-${rank}`}
            className={`matrix-rank-head ${rank === trumpRank ? 'trump' : ''}`}
          >
            {rank}
          </span>
        ))}

        {SUIT_ROWS.map((suit) => (
          <div key={suit.key} className="matrix-row">
            <span className={`matrix-suit-head ${suit.isRed ? 'red' : ''}`}>
              {suit.label}
            </span>
            {RANKS.map((rank) => {
              const key = `${suit.key}-${rank}`;
              const cardsInCell = matrix[key] || [];
              const isTrumpColumn = rank === trumpRank;
              const isWildColumn = suit.key === 'H' && rank === trumpRank;

              return (
                <div
                  key={key}
                  className={`matrix-card-cell ${isTrumpColumn ? 'trump-col' : ''} ${
                    isWildColumn ? 'wild-col' : ''
                  } ${cardsInCell.length === 0 ? 'empty' : ''}`}
                >
                  {cardsInCell.length === 0 ? (
                    <span className="matrix-empty-slot" />
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

      <div className="matrix-joker-row">
        <span className="joker-label">王</span>
        <div className="joker-lane">
          {sortedJokers.length > 0 ? (
            <div className={`matrix-stack joker-stack ${sortedJokers.length > 1 ? 'has-pair' : ''}`}>
              {sortedJokers.map((card) => (
                <PlayingCard
                  key={card.id}
                  card={card}
                  isSelected={selectedIds.includes(card.id)}
                  onClick={() => toggleCard(card.id)}
                  disabled={isSolving}
                />
              ))}
            </div>
          ) : (
            <span className="matrix-empty-slot joker-empty" />
          )}
        </div>
      </div>
      <p className="hint">点选矩阵中的牌进行选择。级牌列高亮，♥级牌即逢人配。</p>
    </div>
  );
}
