import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import './Flashcard.css';

const FlashcardViewer = ({ cards }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  if (!cards || cards.length === 0) return null;

  const currentCard = cards[currentIndex];
  const front = currentCard.front || currentCard.term || '';
  const back = currentCard.back || currentCard.definition || '';

  const goTo = (nextIndex) => {
    setIsFlipped(false);
    window.setTimeout(() => setCurrentIndex(nextIndex), 140);
  };

  return (
    <div className="flashcard-container">
      <div className="flashcard-header">
        <span className="flashcard-counter">Thẻ {currentIndex + 1} / {cards.length}</span>
        <span className="flashcard-hint">
          Nhấn vào thẻ để lật <RotateCcw size={14} style={{ display: 'inline', marginLeft: '4px' }} />
        </span>
      </div>

      <button className="flashcard-scene" type="button" onClick={() => setIsFlipped(!isFlipped)}>
        <span className={`flashcard ${isFlipped ? 'is-flipped' : ''}`}>
          <span className="flashcard-face flashcard-front">
            <span className="flashcard-label">Mặt trước</span>
            <span className="flashcard-content">{front}</span>
          </span>
          <span className="flashcard-face flashcard-back">
            <span className="flashcard-label">Mặt sau</span>
            <span className="flashcard-content">{back}</span>
          </span>
        </span>
      </button>

      <div className="flashcard-controls">
        <button className="flashcard-btn" onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0}>
          <ChevronLeft size={20} /> Trước
        </button>
        <button className="flashcard-btn primary" onClick={() => goTo(currentIndex + 1)} disabled={currentIndex === cards.length - 1}>
          Tiếp <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
};

export default FlashcardViewer;
