import React, { useMemo, useState } from 'react';
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import './Quiz.css';

const QuizViewer = ({ questions }) => {
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);

  const normalized = useMemo(() => (
    (questions || []).map((question) => ({
      questionText: question.questionText || question.question || '',
      options: question.options || [],
      correctAnswer: String(question.correctAnswer || question.answer || '').toUpperCase(),
      explanation: question.explanation || '',
    }))
  ), [questions]);

  if (!normalized.length) return null;

  const handleSelect = (qIndex, optionId) => {
    if (showResults) return;
    setAnswers((prev) => ({ ...prev, [qIndex]: optionId }));
  };

  const reset = () => {
    setAnswers({});
    setShowResults(false);
  };

  const score = normalized.reduce((total, question, index) => (
    answers[index] === question.correctAnswer ? total + 1 : total
  ), 0);

  return (
    <div className="quiz-container">
      <div className="quiz-game-header">
        <div>
          <strong>Bài luyện tập</strong>
          <span>{Object.keys(answers).length}/{normalized.length} câu đã chọn</span>
        </div>
        <button type="button" className="quiz-reset" onClick={reset}>
          <RotateCcw size={16} />
          Làm lại
        </button>
      </div>

      {normalized.map((question, qIndex) => (
        <div key={qIndex} className="quiz-card">
          <div className="quiz-question">
            <strong>Câu {qIndex + 1}:</strong> {question.questionText}
          </div>
          <div className="quiz-options">
            {question.options.map((option, oIndex) => {
              const optionId = String(option.id || option.letter || String.fromCharCode(65 + oIndex)).toUpperCase();
              const isSelected = answers[qIndex] === optionId;
              const isCorrect = question.correctAnswer === optionId;
              let optionClass = 'quiz-option';

              if (isSelected) optionClass += ' selected';
              if (showResults) {
                if (isCorrect) optionClass += ' correct';
                else if (isSelected && !isCorrect) optionClass += ' incorrect';
              }

              return (
                <button
                  key={optionId}
                  type="button"
                  className={optionClass}
                  onClick={() => handleSelect(qIndex, optionId)}
                >
                  <span className="quiz-option-letter">{optionId}</span>
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
            disabled={Object.keys(answers).length !== normalized.length}
          >
            Chấm điểm
          </button>
        ) : (
          <div className="quiz-score-banner">
            Kết quả của bạn: <strong>{score} / {normalized.length}</strong>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizViewer;
