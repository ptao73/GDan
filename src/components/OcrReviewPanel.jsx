import { useState } from 'react';
import { STANDARD_RANKS, SUITS } from '../engine/cards.js';
import { HAND_CARD_COUNT, toReadableCard } from '../utils/handImport.js';

const SUIT_LABELS = { S: '♠', H: '♥', C: '♣', D: '♦' };

export default function OcrReviewPanel({ ocrReview, onConfirm, onCancel }) {
  const [cards, setCards] = useState(() => [...ocrReview.cardSpecs]);
  const [addSuit, setAddSuit] = useState('S');
  const [addRank, setAddRank] = useState('A');

  const diff = HAND_CARD_COUNT - cards.length;

  function removeCard(index) {
    setCards((prev) => prev.filter((_, i) => i !== index));
  }

  function addCard() {
    if (cards.length >= HAND_CARD_COUNT) return;
    setCards((prev) => [...prev, { suit: addSuit, rank: addRank }]);
  }

  function addJoker(type) {
    if (cards.length >= HAND_CARD_COUNT) return;
    setCards((prev) => [...prev, { suit: 'JOKER', rank: type }]);
  }

  return (
    <section className="panel ocr-review-panel">
      <h2>OCR 识别审查</h2>
      <p className="ocr-review-info">
        原始识别 {ocrReview.rawCount} 张，去重后 {cards.length} 张
        {diff > 0 ? `，还需添加 ${diff} 张` : diff < 0 ? `，需删除 ${-diff} 张` : '，数量正确'}
      </p>

      {/* 牌面标签列表 */}
      <div className="ocr-review-tags">
        {cards.map((spec, index) => (
          <span key={`${spec.suit}-${spec.rank}-${index}`} className="ocr-tag">
            {toReadableCard(spec)}
            <button className="ocr-tag-remove" onClick={() => removeCard(index)} type="button">
              ×
            </button>
          </span>
        ))}
      </div>

      {/* 添加牌区 */}
      <div className="ocr-review-add">
        <select value={addSuit} onChange={(e) => setAddSuit(e.target.value)}>
          {SUITS.map((s) => (
            <option key={s} value={s}>{SUIT_LABELS[s]} {s}</option>
          ))}
        </select>
        <select value={addRank} onChange={(e) => setAddRank(e.target.value)}>
          {STANDARD_RANKS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <button type="button" onClick={addCard} disabled={cards.length >= HAND_CARD_COUNT}>
          添加
        </button>
        <button type="button" onClick={() => addJoker('SJ')} disabled={cards.length >= HAND_CARD_COUNT}>
          +小王
        </button>
        <button type="button" onClick={() => addJoker('BJ')} disabled={cards.length >= HAND_CARD_COUNT}>
          +大王
        </button>
      </div>

      {/* 操作按钮 */}
      <div className="ocr-review-actions">
        <button type="button" onClick={() => onConfirm(cards)} disabled={cards.length !== HAND_CARD_COUNT}>
          确认导入（{cards.length}/{HAND_CARD_COUNT}）
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          取消
        </button>
      </div>
    </section>
  );
}
