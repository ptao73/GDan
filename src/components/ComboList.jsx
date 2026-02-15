import { cardLabel } from '../engine/cards.js';
import { comboKey } from '../engine/combos.js';

function comboText(combo) {
  const cards = (combo.cards || []).map((card) => cardLabel(card)).join(' ');
  if (combo.sequence) {
    return `${combo.label}(${combo.sequence.join('-')})：${cards}`;
  }
  if (combo.type === 'threeWithPair') {
    return `${combo.label}(${combo.tripleRank}带${combo.pairRank})：${cards}`;
  }
  if (combo.mainRank) {
    return `${combo.label}(${combo.mainRank})：${cards}`;
  }
  return `${combo.label}：${cards}`;
}

export default function ComboList({
  userCombos,
  aiResult,
  aiComboKeySet,
  aiHasRecommendation,
  removeGroup,
  isSolving
}) {
  return (
    <ul className="combo-list">
      {userCombos.map((combo, index) => {
        const key = comboKey(combo);
        const compareClass = aiResult && aiHasRecommendation
          ? aiComboKeySet.has(key)
            ? 'same'
            : 'removed'
          : '';
        return (
          <li key={`${key}-${index}`} className={compareClass}>
            <span>{comboText(combo)}</span>
            <button className="ghost" onClick={() => removeGroup(index)} disabled={isSolving}>
              拆组
            </button>
          </li>
        );
      })}
    </ul>
  );
}
