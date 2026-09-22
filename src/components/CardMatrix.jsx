import PlayingCard from './PlayingCard.jsx';
import { useI18n } from '../i18n/index.js';

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
  isSolving,
  ghostHints = []
}) {
  const { t } = useI18n();
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
      <div className="matrix-meta">
        <h2>{t('labels.cardArea')}</h2>
        <span
          className="matrix-trump-badge"
          aria-label={`${t('labels.currentLevel')} ${trumpRank}`}
        >
          {t('labels.currentLevel')} {trumpRank} <span className="trump-heart">♥</span>
        </span>
        {ghostHints.length > 0 ? (
          <div className="ghost-hint-strip" aria-label={t('labels.ghostHints')}>
            {ghostHints.map((hint) => (
              <span key={hint.seat} className="ghost-hint-chip">
                {t(`seats.${hint.seat}`)} {t('labels.bombs')} {hint.bombCount} {t('labels.hands')}{' '}
                {hint.hands}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="matrix-stage">
        <div className="matrix-scroll">
          <div className="card-matrix-grid">
            <div className="matrix-body">
              {SUIT_ROWS.map((suit, rowIndex) => (
                <div key={suit.key} className={`matrix-row matrix-row-${rowIndex}`}>
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
                          isVirtualJokerCell ? null : (
                            <span className="matrix-empty-slot" />
                          )
                        ) : (
                          <div
                            className={`matrix-stack ${cardsInCell.length > 1 ? 'has-pair' : ''}`}
                          >
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
      </div>
    </div>
  );
}
