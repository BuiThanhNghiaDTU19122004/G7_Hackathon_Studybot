import React, { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import './Quiz.css';

const QuizViewer = ({ questions }) => {
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);

  if (!questions || questions.length === 0) return null;

  const handleSelect = (qIndex, optionLetter) => {
    if (showResults) return;
    setAnswers((prev) => ({ ...prev, [qIndex]: optionLetter }));
  };

  const calculateScore = () => {
    let score = 0;
    questions.forEach((question, index) => {
      if (answers[index] === question.correctAnswer) score += 1;
    });
    return score;
  };

  return (
    <div className="quiz-container">
      {questions.map((question, qIndex) => (
        <div key={qIndex} className="quiz-card">
          <div className="quiz-question">
            <strong>Câu {qIndex + 1}:</strong> {question.questionText}
          </div>
          <div className="quiz-options">
            {question.options.map((option, oIndex) => {
              const isSelected = answers[qIndex] === option.letter;
              const isCorrect = question.correctAnswer === option.letter;
              let optionClass = 'quiz-option';

              if (isSelected) optionClass += ' selected';
              if (showResults) {
                if (isCorrect) optionClass += ' correct';
                else if (isSelected && !isCorrect) optionClass += ' incorrect';
              }

              return (
                <button
                  key={oIndex}
                  type="button"
                  className={optionClass}
                  onClick={() => handleSelect(qIndex, option.letter)}
                >
                  <span className="quiz-option-letter">{option.letter}</span>
                  <span className="quiz-option-text">{option.text}</span>
                  {showResults && isCorrect && <CheckCircle2 size={18} className="quiz-icon-correct" />}
                  {showResults && isSelected && !isCorrect && <XCircle size={18} className="quiz-icon-incorrect" />}
                </button>
              );
            })}
          </div>
          {showResults && question.explanation && (
            <div className="quiz-explanation">
              <strong>Giải thích:</strong> {question.explanation}
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
