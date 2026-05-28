import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import './Flashcard.css';

const FlashcardViewer = ({ cards }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  if (!cards || cards.length === 0) return null;

  const currentCard = cards[currentIndex];

  const handleNext = (e) => {
    e.stopPropagation();
    if (currentIndex < cards.length - 1) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(prev => prev + 1), 150);
    }
  };

  const handlePrev = (e) => {
    e.stopPropagation();
    if (currentIndex > 0) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(prev => prev - 1), 150);
    }
  };

  return (
    <div className="flashcard-container">
      <div className="flashcard-header">
        <span className="flashcard-counter">
          Thẻ {currentIndex + 1} / {cards.length}
        </span>
        <span className="flashcard-hint">
          Nhấn vào thẻ để lật <RotateCcw size={14} style={{ display: 'inline', marginLeft: '4px' }} />
        </span>
      </div>

      <div className="flashcard-scene" onClick={() => setIsFlipped(!isFlipped)}>
        <div className={`flashcard ${isFlipped ? 'is-flipped' : ''}`}>
          <div className="flashcard-face flashcard-front">
            <div className="flashcard-label">Khái niệm</div>
            <div className="flashcard-content">{currentCard.term}</div>
          </div>
          <div className="flashcard-face flashcard-back">
            <div className="flashcard-label">Định nghĩa</div>
            <div className="flashcard-content">{currentCard.definition}</div>
          </div>
        </div>
      </div>

      <div className="flashcard-controls">
        <button 
          className="flashcard-btn" 
          onClick={handlePrev} 
          disabled={currentIndex === 0}
        >
          <ChevronLeft size={20} /> Trước
        </button>
        <button 
          className="flashcard-btn primary" 
          onClick={handleNext} 
          disabled={currentIndex === cards.length - 1}
        >
          Tiếp <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
};

export default FlashcardViewer;
