import React, { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import './Quiz.css';

const QuizViewer = ({ questions }) => {
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);

  if (!questions || questions.length === 0) return null;

  const handleSelect = (qIndex, optionLetter) => {
    if (showResults) return;
    setAnswers(prev => ({ ...prev, [qIndex]: optionLetter }));
  };

  const calculateScore = () => {
    let score = 0;
    questions.forEach((q, i) => {
      if (answers[i] === q.correctAnswer) score++;
    });
    return score;
  };

  return (
    <div className="quiz-container">
      {questions.map((q, qIndex) => (
        <div key={qIndex} className="quiz-card">
          <div className="quiz-question">
            <strong>Câu {qIndex + 1}:</strong> {q.questionText}
          </div>
          <div className="quiz-options">
            {q.options.map((opt, oIndex) => {
              const isSelected = answers[qIndex] === opt.letter;
              const isCorrect = q.correctAnswer === opt.letter;
              let optionClass = 'quiz-option';
              
              if (isSelected) optionClass += ' selected';
              
              if (showResults) {
                if (isCorrect) optionClass += ' correct';
                else if (isSelected && !isCorrect) optionClass += ' incorrect';
              }

              return (
                <div 
                  key={oIndex} 
                  className={optionClass}
                  onClick={() => handleSelect(qIndex, opt.letter)}
                >
                  <span className="quiz-option-letter">{opt.letter}</span>
                  <span className="quiz-option-text">{opt.text}</span>
                  {showResults && isCorrect && <CheckCircle2 size={18} className="quiz-icon-correct" />}
                  {showResults && isSelected && !isCorrect && <XCircle size={18} className="quiz-icon-incorrect" />}
                </div>
              );
            })}
          </div>
          {showResults && q.explanation && (
            <div className="quiz-explanation">
              <strong>Giải thích:</strong> {q.explanation}
            </div>
          )}
        </div>
      ))}

      <div className="quiz-footer">
        {!showResults ? (
          <button 
            className="quiz-btn primary" 
            onClick={() => setShowResults(true)}
            disabled={Object.keys(answers).length !== questions.length}
          >
            Nộp bài
          </button>
        ) : (
          <div className="quiz-score-banner">
            Kết quả của bạn: <strong>{calculateScore()} / {questions.length}</strong>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizViewer;
