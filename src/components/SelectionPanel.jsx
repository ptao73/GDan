import { describeDefinition } from '../engine/combos.js';

export default function SelectionPanel({
  selectedCards,
  candidateTypes,
  selectedTypeIndex,
  setSelectedTypeIndex,
  confirmGroup,
  resetSelection,
  isSolving
}) {
  return (
    <div className="selection-panel">
      <h3>实时提示</h3>
      <p>
        已选牌数：<strong>{selectedCards.length}</strong>
      </p>

      {candidateTypes.length > 0 ? (
        <>
          <div className="type-options">
            {candidateTypes.map((definition, index) => (
              <button
                key={`${definition.type}-${index}`}
                className={index === selectedTypeIndex ? 'active' : ''}
                onClick={() => setSelectedTypeIndex(index)}
                disabled={isSolving}
              >
                {describeDefinition(definition)}
              </button>
            ))}
          </div>
          <div className="selection-actions">
            <button onClick={confirmGroup} disabled={isSolving}>
              确认成组
            </button>
            <button className="ghost" onClick={resetSelection} disabled={isSolving}>
              清空选择
            </button>
          </div>
        </>
      ) : (
        <p className="warn">当前选择未匹配合法牌型。</p>
      )}
    </div>
  );
}
