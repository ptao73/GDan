import PlayingCard from './PlayingCard.jsx';

export default function CardHand({ remainingCards, selectedIds, toggleCard, isSolving }) {
  return (
    <div className="cards-wrap">
      {remainingCards.map((card) => (
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
}
