import React from 'react';

const Flashcard = ({ card, isFlipped, onFlip }) => {
  if (!card) return null;

  return (
    <div className={`flashcard-widget ${isFlipped ? 'flipped' : ''}`}>
      <div className="flashcard-inner">
        {/* FRONT SIDE */}
        <div className="flashcard-front">
          <div className="card-header-top">
            <span className="pill-tag blue">{card.materia || 'Matéria'}</span>
            <span className="pill-tag orange">{card.topico || 'Tópico'}</span>
            <span className="pill-tag gray">Intermediate</span>
          </div>

          <div className="concept-label">Question & Concept</div>

          <div className="question-text-centered">
            <h2>{card.pergunta}</h2>
          </div>

          <div className="reveal-action">
            <button 
              className="reveal-btn" 
              onClick={(e) => { 
                e.stopPropagation(); 
                if (!isFlipped) onFlip(); 
              }}
              style={{ opacity: isFlipped ? 0 : 1, pointerEvents: isFlipped ? 'none' : 'auto' }}
            >
              <span>Reveal Answer</span>
              <div className="chevron-down"></div>
            </button>
          </div>
        </div>

        {/* BACK SIDE */}
        <div className="flashcard-back">
          <div className="card-header-top">
            <span className="pill-tag blue">{card.materia || 'Matéria'}</span>
            <span className="pill-tag orange">{card.topico || 'Tópico'}</span>
            <span className="pill-tag gray">Answer</span>
          </div>

          <div className="back-content-wrapper">
             {/* Upper Question Preview */}
             <div className="question-preview-container">
                <span className="preview-label">QUESTION</span>
                <p className="preview-text">{card.pergunta}</p>
             </div>

             {/* Minimal Divider */}
             <div className="back-divider"></div>

             {/* Primary Answer Section */}
             <div className="answer-section">
                <div className="answer-label-pill">
                  <span className="check-icon">✓</span>
                  <span>CORRECT ANSWER</span>
                </div>
                <div className="answer-text">
                  {card.resposta}
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Flashcard;
