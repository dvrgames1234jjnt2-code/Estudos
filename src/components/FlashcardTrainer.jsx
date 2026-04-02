import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Flashcard from './Flashcard';
import './FlashcardTrainer.css';

const FlashcardTrainer = () => {
  const [cards] = useState([
    { id: 1, pergunta: "What is the primary role of the Hippocampus in long-term memory formation?", resposta: "The Hippocampus acts as a switching station, coordinating the formation and retrieval of long-term memories between different brain regions.", materia: "Neuroscience", topico: "Intermediate" },
    { id: 2, pergunta: "Explain the concept of Neuroplasticity.", resposta: "Neuroplasticity is the brain's ability to reorganize itself by forming new neural connections throughout life, allowing it to adapt to injury or new experiences.", materia: "Neuroscience", topico: "Advanced" },
    { id: 3, pergunta: "What are the four lobes of the human brain?", resposta: "Frontal, Parietal, Temporal, and Occipital.", materia: "Neuroscience", topico: "Basic" },
  ]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [dealKey, setDealKey] = useState(0);

  const evaluationTiers = [
    { id: 1, label: 'Desconhecido', explanation: 'Nunca vi', time: 'Hoje', color: 'tier-box-red' },
    { id: 2, label: 'Esquecido', explanation: 'Já vi, mas esqueci', time: '1 dia', color: 'tier-box-orange' },
    { id: 3, label: 'Parcial', explanation: 'Sei partes, falta conectar', time: '2–3 dias', color: 'tier-box-yellow' },
    { id: 4, label: 'Esforçado', explanation: 'Pensei muito', time: '1–2 dias', color: 'tier-box-brown' },
    { id: 5, label: 'Consciente', explanation: 'Sei e penso rápido', time: '7–10 dias', color: 'tier-box-green' },
    { id: 6, label: 'Fluente', explanation: 'Na ponta da língua', time: '20–30+ dias', color: 'tier-box-blue' },
  ];

  const handleFlip = () => { if (!animating) setIsFlipped(!isFlipped); };

  const handleEvaluate = (tierId) => {
    if (animating) return;
    if (currentIndex < cards.length - 1) {
      setAnimating(true);
      setIsFlipped(false);
      setDealKey(k => k + 1);
      setTimeout(() => {
        setCurrentIndex(i => i + 1);
        setAnimating(false);
      }, 700);
    } else {
      alert("Sessão concluída!");
    }
  };

  const currentCard = cards[currentIndex];
  const remainingCount = cards.length - currentIndex - 1;
  const deckLayers = Math.min(remainingCount, 6);

  return (
    <div className="trainer-container">
      {/* HEADER */}
      <header className="mindful-header">
        <div className="header-left">
          <button className="exit-btn"><span>✕</span><span>EXIT SESSION</span></button>
          <div className="app-brand">Mindful Scholar</div>
        </div>
        <div className="progress-section">
          <div className="progress-label">
            SESSION PROGRESS &nbsp;
            <span style={{ color: 'var(--text-primary)' }}>{currentIndex + 1} / {cards.length} CARDS</span>
          </div>
          <div className="mindful-progress-bar">
            <div className="mindful-progress-fill" style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }} />
          </div>
        </div>
        <div className="header-right">
          <div className="timer-section"><span className="clock-icon">🕒</span><span>12:45</span></div>
        </div>
      </header>

      {/* CARD SCENE */}
      <main className="card-scene">

        {/* ── DECK 3D (esquerda) ── */}
        <div className="deck3d-wrapper">
          <div className="deck3d-stage">
            {deckLayers === 0 ? (
              <div className="deck3d-empty">
                <span>✓</span>
              </div>
            ) : (
              <>
                {/* Camadas do baralho: i=0 é mais ao fundo (esquerda), último é o topo */}
                {Array.from({ length: deckLayers }).map((_, i) => {
                  const depth = deckLayers - 1 - i; // 0 = topo
                  const xShift   = depth * -13;           // empurra para esquerda
                  const zShift   = depth * -18;           // recua no eixo Z
                  const opacity  = 1 - depth * (0.65 / deckLayers);
                  const scale    = 1 - depth * (0.04 / deckLayers);

                  return (
                    <div
                      key={i}
                      className="deck3d-card"
                      style={{
                        transform: `translateX(${xShift}px) translateZ(${zShift}px) scale(${scale})`,
                        opacity,
                        zIndex: deckLayers - depth,
                      }}
                    />
                  );
                })}

                {/* Card voador — animado via Framer Motion */}
                <AnimatePresence>
                  {animating && (
                    <motion.div
                      key={dealKey}
                      className="deck3d-card deck3d-deal"
                      initial={{ x: 0, y: 0, rotateY: -15, scale: 0.95, opacity: 1 }}
                      animate={{ x: '52vw', y: 0, rotateY: 0, scale: 1, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 140, damping: 22 }}
                      style={{ zIndex: 99, position: 'absolute', top: 0, right: 0 }}
                    />
                  )}
                </AnimatePresence>
              </>
            )}
          </div>

          {/* Label */}
          <div className="deck3d-label">
            <span className="deck3d-count">{remainingCount}</span>
            <span className="deck3d-text">restantes</span>
          </div>
        </div>

        {/* ── FLASHCARD PRINCIPAL ── */}
        <div className="card-main-slot">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentCard.id}
              initial={{ x: -220, opacity: 0, scale: 0.92, rotate: -2 }}
              animate={{ x: 0, opacity: 1, scale: 1, rotate: 0 }}
              exit={{ x: 380, opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 130, damping: 22 }}
              style={{ width: '100%' }}
            >
              <Flashcard card={currentCard} isFlipped={isFlipped} onFlip={handleFlip} />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── CARDS LEFT WIDGET (direita) ── */}
        <div className="depth-stack-behind">
          <div className="cards-left-icon">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <rect x="6" y="10" width="24" height="18" rx="4" fill="#dcfce7" stroke="#16a34a" strokeWidth="1.5"/>
              <rect x="9" y="7"  width="24" height="18" rx="4" fill="#bbf7d0" stroke="#16a34a" strokeWidth="1.5"/>
              <rect x="12" y="4" width="24" height="18" rx="4" fill="#4ade80" stroke="#16a34a" strokeWidth="1.5"/>
            </svg>
          </div>
          <div className="cards-left-count">{remainingCount}</div>
          <div className="cards-left-label">CARDS LEFT</div>
        </div>
      </main>

      {/* EVALUATION BAR */}
      <footer className="trainer-footer">
        <AnimatePresence>
          {isFlipped && !animating && (
            <motion.div
              className="evaluation-bar-container"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 15, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="evaluation-box-grid">
                {evaluationTiers.map((tier) => (
                  <button key={tier.id} className={`eval-box-btn ${tier.color}`} onClick={() => handleEvaluate(tier.id)}>
                    <span className="tier-name">{tier.label}</span>
                    <span className="tier-explanation">{tier.explanation}</span>
                    <div className="tier-time-badge">{tier.time}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </footer>
    </div>
  );
};

export default FlashcardTrainer;
