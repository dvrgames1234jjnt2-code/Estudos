import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useAnimation } from 'framer-motion';
import './StudyInterface.css';

const MAX_DECK_VISIBLE = 5;

const SUBJECT_ICONS = {
  'Conhecimentos Bancários': '🏛️',
  'Direito': '⚖️',
  'Informática': '💻',
  'Matemática': '🔢',
  'Língua Portuguesa': '✍️',
  'Raciocínio Lógico': '🧠',
  'default': '📚'
};

const SRS_TIERS = [
  { id: 1, label: 'Esqueci',   emoji: '❌', type: 'forgot',    color: '#ef4444', desc: 'Recomeçar',           interval: '1 dia'   },
  { id: 2, label: 'Aprendendo', emoji: '🌱', type: 'learning',  color: '#f97316', desc: 'Em progresso',        interval: '2 dias'  },
  { id: 4, label: 'Parcial',   emoji: '🥶', type: 'partial',   color: '#eab308', desc: 'Sei, mas não tudo',   interval: '4 dias'  },
  { id: 6, label: 'Esforço',   emoji: '💪', type: 'effortful', color: '#3b82f6', desc: 'Demorei, mas acertei',interval: '7 dias'  },
  { id: 10, label: 'Dominado', emoji: '🏆', type: 'mastered',  color: '#10b981', desc: 'Excelente',           interval: '30 dias' }
];

const getLevelFromName = (name = '') => {
  const tier = SRS_TIERS.find(t => t.label === name);
  return tier ? tier.id : 0; // 0 = novo card, sem nível ainda
};

// Todos os tiers ficam visíveis; os fora do alcance são bloqueados
const getTiersWithLock = (currentFeedback) => {
  const currentId = getLevelFromName(currentFeedback);
  const currentIndex = SRS_TIERS.findIndex(t => t.id === currentId);
  // Card novo: libera os 3 primeiros
  const maxIndex = currentIndex === -1 ? 2 : Math.min(currentIndex + 1, SRS_TIERS.length - 1);
  return SRS_TIERS.map((tier, idx) => ({ ...tier, isLocked: idx > maxIndex }));
};

const getStatusFromTier = (id) => {
  if (id >= 10) return 'Dominado';
  if (id >= 6) return 'Revisão';
  return 'Aprendizado';
};

/* ══════════════════════════════════════
   DRAGGABLE STACK CARD
   (Cards in the right sidebar, stacked & draggable)
    ══════════════════════════════════════ */
const StackCard = ({ card, index, total, onPromote }) => {
  const subjectIcon = SUBJECT_ICONS[card.subject] || SUBJECT_ICONS.default;
  const isTop = index === 0;

  const stackOffsetY = index * 9;
  const stackScale = 1 - index * 0.045;
  const stackRotate = (index % 2 === 0 ? 1 : -1) * index * 1.2;

  const x = useMotionValue(0);
  const dragRotate = useTransform(x, [-150, 0, 150], [-12, stackRotate, 12]);

  return (
    <motion.div
      layoutId={`fly-card-${card.id}`}
      className={`stack-card ${isTop ? 'is-top' : ''}`}
      style={{
        zIndex: total - index,
        top: stackOffsetY,
        scale: stackScale,
        rotate: isTop ? dragRotate : stackRotate,
        x: isTop ? x : 0,
        cursor: isTop ? 'grab' : 'default',
      }}
      animate={{ opacity: 1 - index * 0.1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      drag={isTop ? 'x' : false}
      dragSnapToOrigin
      dragElastic={0.35}
      dragConstraints={{ left: -80, right: 80 }}
      whileDrag={{ cursor: 'grabbing' }}
      onDragEnd={(_, info) => {
        if (isTop && Math.abs(info.offset.x) > 70) onPromote(card);
      }}
      onClick={() => isTop && onPromote(card)}
      transition={{
        layout: { type: 'spring', stiffness: 420, damping: 36 },
        opacity: { duration: 0.2 }
      }}
    >
      <div className="stack-card-inner">
        <div className="stack-card-icon">{subjectIcon}</div>
        <div className="stack-card-info">
          <span className="stack-card-subject">{card.subject}</span>
          <span className="stack-card-topic">{card.topic || card.assunto || '—'}</span>
        </div>
        {isTop && <div className="stack-card-badge">Próximo</div>}
      </div>
    </motion.div>
  );
};

/* ══════════════════════════════════════
   ACTIVE FLASHCARD
   (The main card being studied)
    ══════════════════════════════════════ */
const ActiveFlashcard = ({ card, isFlipped, onFlip }) => {
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    setShowExplanation(false);
  }, [card.id]);

  return (
    <motion.div
      layoutId={`fly-card-${card.id}`}
      className="flashcard-container"
      transition={{ layout: { type: 'spring', stiffness: 420, damping: 36 } }}
    >
      <motion.div 
        className="flashcard" 
        onClick={onFlip}
        initial={false}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ 
          rotateY: { type: 'spring', stiffness: 260, damping: 20 },
          layout: { type: 'spring', stiffness: 420, damping: 36 }
        }}
        style={{ transformStyle: 'preserve-3d' }}
      >

        <div className="card-face card-front">
          <div className="card-glare" />
          <div className="card-header-technical">
            <div className="header-main-title">{(card.materia || 'MATÉRIA DESCONHECIDA').toUpperCase()}</div>
            <div className="header-breadcrumb">
              <span className="bc-item">{card.topico}</span>
              <span className="bc-sep">/</span>
              <span className="bc-item">{card.assunto}</span>
              {card.subAssunto && (
                <>
                  <span className="bc-sep">→</span>
                  <span className="bc-item">{card.subAssunto}</span>
                </>
              )}
              {card.categoria && (
                <>
                  <span className="bc-sep">→</span>
                  <span className="bc-item-highlight">{card.categoria}</span>
                </>
              )}
            </div>
          </div>

          <div className="card-center-focus technical-front">
            <div className="question-type-label">
              <span className="type-badge">{(card.tipo || 'O QUE É?').toUpperCase()} ↑</span>
            </div>
            
            <div className="main-question-container">
              <h2 className="card-question-bold">{card.front}</h2>
            </div>
          </div>

          <div className="card-footer-minimal">
            <span className="hint-glow">REVELAR RESPOSTA</span>
          </div>
        </div>

        {/* BACK */}
        <div className="card-face card-back">
          <motion.div layout className="card-center-content scroll-y back-face-content">
            {/* Context Question (Small preview of the front) */}
            <motion.div layout className="back-context-question-wrapper">
              <span className="back-context-label">CONTEXTO</span>
              <p className="back-context-text">{card.front}</p>
            </motion.div>

            <motion.div layout className="answer-explanation-stack">
              <motion.div layout className="card-answer-centered">
                {card.back}
              </motion.div>
              
              <AnimatePresence mode="popLayout">
                {showExplanation && (
                  <motion.div
                    layout
                    className="explanation-bubble"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ 
                      type: 'spring', 
                      damping: 40, 
                      stiffness: 400,
                      layout: { type: 'spring', damping: 40, stiffness: 400, bounce: 0 }
                    }}
                  >
                    {card.explicacao}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>

          <div className="card-footer-minimal">
            {card.explicacao && (
              <button
                className={`subtle-exp-btn ${showExplanation ? 'expanded' : ''}`}
                onClick={(e) => { e.stopPropagation(); setShowExplanation(v => !v); }}
              >
                {showExplanation ? 'OCULTAR DETALHES' : 'VER EXPLICAÇÃO'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ══════════════════════════════════════
   STUDY EVALUATION EFFECTS
   (Dynamic particles and emojis)
    ══════════════════════════════════════ */
const StudyEvaluationEffects = ({ event }) => {
  const [activeEvent, setActiveEvent] = useState(null);

  useEffect(() => {
    if (event) {
      setActiveEvent(event);
      const timer = setTimeout(() => setActiveEvent(null), 1500);
      return () => clearTimeout(timer);
    }
  }, [event]);

  if (!activeEvent) return null;

  const renderParticles = (type, count, emojis) => {
    return Array.from({ length: count }).map((_, i) => (
      <motion.div
        key={`${type}-p-${activeEvent.timestamp}-${i}`}
        initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
        animate={{
          opacity: [0, 1, 0],
          scale: [0, Math.random() * 1.5 + 0.5, 0],
          x: (Math.random() - 0.5) * 800,
          y: (Math.random() - 0.5) * 800,
          rotate: Math.random() * 720
        }}
        transition={{ duration: 1.2, delay: i * 0.02, ease: "easeOut" }}
        style={{
          fontFamily: 'Outfit, sans-serif',
          fontSize: '1.4rem',
          fontWeight: 500,
          zIndex: 99,
          pointerEvents: 'none'
        }}
      >
        {emojis[i % emojis.length]}
      </motion.div>
    ));
  };

  return (
    <div className={`feedback-overlay-container effect-${activeEvent.type}`} style={{ position: 'absolute', inset: -150, pointerEvents: 'none', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>

      {/* ── FORGOT 🧠💥 ── */}
      {activeEvent.type === 'forgot' && (
        <>
          <motion.div
            key={`forgot-emoji-${activeEvent.timestamp}`}
            initial={{ scale: 3, opacity: 0 }}
            animate={{ scale: [3, 1, 1.2, 1], opacity: [0, 1, 1, 0], rotate: [0, -10, 10, 0] }}
            transition={{ duration: 1.2 }}
            style={{ fontSize: '8rem', zIndex: 1001, filter: 'drop-shadow(0 0 12px #ef4444)' }}
          >
            🧠💥
          </motion.div>
          {renderParticles('forgot', 30, ['☄️', '🔥', '💨', '⚠️', '💥'])}
        </>
      )}

      {/* ── EFFORTFUL 💪 ── */}
      {activeEvent.type === 'effortful' && (
        <>
          <motion.div
            key={`effortful-emoji-${activeEvent.timestamp}`}
            initial={{ scale: 0, opacity: 0, y: 60 }}
            animate={{ scale: [0, 1.4, 1.1], opacity: [0, 1, 1, 0], y: [60, -30] }}
            transition={{ duration: 1.3 }}
            style={{ fontSize: '8rem', zIndex: 1001, filter: 'drop-shadow(0 0 14px #f97316)' }}
          >
            💪
          </motion.div>
          {renderParticles('effort', 20, ['🔥', '⚡', '🎯', '💪', '✨'])}
        </>
      )}

      {/* ── PARTIAL 🥶 ── */}
      {activeEvent.type === 'partial' && (
        <>
          <motion.div
            key={`partial-emoji-${activeEvent.timestamp}`}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.5, 1.2], opacity: [0, 1, 1, 0], y: [40, -20] }}
            transition={{ duration: 1.4 }}
            style={{ fontSize: '8rem', zIndex: 1001, filter: 'drop-shadow(0 0 16px #7dd3fc)' }}
          >
            🥶
          </motion.div>
          {renderParticles('ice', 22, ['❄️', '🧊', '💨', '🌨️', '💠'])}
        </>
      )}

      {/* ── LEARNING 🌱 ── */}
      {activeEvent.type === 'learning' && (
        <>
          <motion.div
            key={`learning-emoji-${activeEvent.timestamp}`}
            initial={{ scale: 0, y: 80 }}
            animate={{ scale: [0, 1.7, 1.4], y: -130, opacity: [0, 1, 0] }}
            transition={{ duration: 1.2 }}
            style={{ fontSize: '7rem', zIndex: 1001, filter: 'drop-shadow(0 0 14px #4ade80)' }}
          >
            🌱
          </motion.div>
          {renderParticles('growth', 18, ['✨', '🌿', '🍃', '🍀', '✨'])}
        </>
      )}

      {/* ── REVIEW / KNOWING 🚀 ── */}
      {(activeEvent.type === 'review' || activeEvent.type === 'knowing') && (
        <>
          <motion.div
            key={`review-emoji-${activeEvent.timestamp}`}
            initial={{ scale: 0, x: -80, y: 80 }}
            animate={{ scale: [0, 1.4, 1.1], x: 160, y: -160, opacity: [0, 1, 0], rotate: 40 }}
            transition={{ duration: 1.2 }}
            style={{ fontSize: '7.5rem', zIndex: 1001, filter: 'drop-shadow(0 0 14px #f59e0b)' }}
          >
            🚀
          </motion.div>
          {renderParticles('rocket', 22, ['✨', '⭐', '☄️', '💫', '✩'])}
        </>
      )}

      {/* ── MASTERED / FLUENT 🏆 ── */}
      {(activeEvent.type === 'mastered' || activeEvent.type === 'fluent') && (
        <>
          <motion.div
            key={`easy-emoji-${activeEvent.timestamp}`}
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: [0, 2.2, 1.9], rotate: 0, opacity: [0, 1, 0], y: -40 }}
            transition={{ duration: 1.4, ease: 'backOut' }}
            style={{ fontSize: '9rem', zIndex: 1001, filter: 'drop-shadow(0 0 22px #facc15)' }}
          >
            🏆
          </motion.div>
          {renderParticles('master', 36, ['✨', '⭐', '🎉', '🎊', '👑'])}
        </>
      )}

      <div className="css-effect-ring" />
    </div>
  );
};

/* ══════════════════════════════════════
   MAIN COMPONENT
    ══════════════════════════════════════ */
const StudyInterface = ({ onExit, flashcards = [], onUpdateCard }) => {
  const normalizedCards = flashcards.map(c => ({
    ...c,
    id: c.id,
    front: c.pergunta || c.front || '',
    back: c.resposta || c.back || '',
    subject: c.materia || c.subject || 'Sem Matéria',
    topic: c.topico || c.topic || 'Sem Tópico',
    assunto: c.assunto || '',
    subAssunto: c.subAssunto || '',
    tipo: c.tipo || '',
    categoria: c.categoria || '',
    diff: c.acertos ? Math.min(3, Math.max(1, 3 - Math.floor(c.acertos / 5))) : (c.diff || 1),
    acertos: c.acertos || 0,
    erros: c.erros || 0,
    explicacao: c.explicacao || '',
    feedback: c.feedback || c.nivel || '' // nível SRS atual do card
  }));

  const [deck, setDeck] = useState(normalizedCards);
  const [activeId, setActiveId] = useState(normalizedCards[0]?.id);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studiedCount, setStudiedCount] = useState(0);
  const [evaluationEvent, setEvaluationEvent] = useState(null);
  const [sessionFinished, setSessionFinished] = useState(false);
  const [showSuccess, setShowSuccess] = useState(null);

  if (!activeId || deck.length === 0) {
    return (
      <div className="study-container empty-state">
        <div className="glass-card premium-shadow">
          <div className="empty-icon">🏜️</div>
          <h2>Nenhum Flashcard Encontrado</h2>
          <p>Adicione cartões no Notion para começar sua jornada.</p>
          <button className="premium-btn" onClick={onExit}>Voltar ao Dashboard</button>
        </div>
      </div>
    );
  }

  if (sessionFinished) {
    return (
      <div className="study-interface session-complete">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="completion-card glass-card"
        >
          <div className="complete-emoji">🎉</div>
          <h1>Sessão Concluída!</h1>
          <p>Você revisou <strong>{deck.length}</strong> cartões hoje.</p>
          <div className="stats-row">
            <div className="stat-pill">Consistência +5xp</div>
            <div className="stat-pill">Foco Máximo</div>
          </div>
          <button className="premium-btn large" onClick={onExit}>Finalizar Sessão</button>
        </motion.div>
      </div>
    );
  }

  const activeCard = deck.find(c => c.id === activeId);
  const deckCards = deck.filter(c => c.id !== activeId);
  const visibleDeck = deckCards.slice(0, MAX_DECK_VISIBLE);
  const totalCards = deck.length;
  const progress = (studiedCount / totalCards) * 100;

  const handlePromote = (card) => {
    setDeck(prev => {
      const without = prev.filter(c => c.id !== card.id && c.id !== activeId);
      const oldActive = prev.find(c => c.id === activeId);
      return [card, ...without, oldActive];
    });
    setActiveId(card.id);
    setIsFlipped(false);
  };

  const handleEvaluate = (tier) => {
    const type = tier.type;
    setEvaluationEvent({ type, timestamp: Date.now() });

    if (onUpdateCard && activeId) {
      const activeRaw = flashcards.find(c => c.id === activeId);
      const currentRank = tier.id;
      const lastSessionRank = getLevelFromName(activeRaw?.feedback || '');
      const isAcerto = currentRank > lastSessionRank || (currentRank === lastSessionRank && currentRank >= 6);

      const now = new Date();
      let nextDate = new Date();
      const intervals = { forgot: 1, learning: 2, partial: 4, effortful: 7, review: 15, mastered: 30 };
      nextDate.setDate(now.getDate() + (intervals[type] || 0));

      onUpdateCard(activeId, {
        feedback: tier.label,
        status: getStatusFromTier(currentRank),
        proximaRevisao: nextDate.toISOString(),
        ultimaRevisao: now.toISOString(),
        acertos: (activeRaw?.acertos || 0) + (isAcerto ? 1 : 0),
        erros: (activeRaw?.erros || 0) + (isAcerto ? 0 : 1)
      });
    }

    if (deckCards.length === 0) {
      setStudiedCount(totalCards);
      setTimeout(() => setSessionFinished(true), 800);
      return;
    }

    // Troca imediata — emoji anima em paralelo
    handlePromote(deckCards[0]);
    setStudiedCount(c => c + 1);
  };

  return (
    <div className="study-interface premium-theme">
      <StudyEvaluationEffects event={evaluationEvent} />
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            key="success-emoji"
            initial={{ y: 0, opacity: 0, scale: 0.5 }}
            animate={{ y: -150, opacity: 1, scale: 1.5 }}
            exit={{ opacity: 0, scale: 2 }}
            transition={{ duration: 0.6, ease: "circOut" }}
            style={{
              position: 'fixed',
              left: '50%',
              bottom: '20%',
              transform: 'translateX(-50%)',
              fontSize: '5rem',
              zIndex: 1000,
              pointerEvents: 'none',
              textShadow: `0 0 30px ${showSuccess.color}`
            }}
          >
            {showSuccess.emoji}
          </motion.div>
        )}
      </AnimatePresence>

      <header className="study-header">
        <div className="header-brand">
          <div className="brand-logo">❂</div>
          <span className="brand-text">Mindful Scholar</span>
        </div>

        <div className="header-center">
          <div className="progress-group">
            <div className="progress-numbers">
              <span className="current">{studiedCount}</span>
              <span className="total">/ {totalCards}</span>
            </div>
            <div className="progress-bar-bg">
              <motion.div
                className="progress-bar-fill"
                animate={{ width: `${progress}%` }}
                transition={{ type: 'spring', stiffness: 50 }}
              />
            </div>
          </div>
        </div>

        <div className="header-actions">
          <button className="exit-icon-btn" onClick={onExit} title="Sair">✕</button>
        </div>
      </header>

      <main className="study-main-layout">
        {/* Left: Active Card */}
        <div className="study-content-area">
          {activeCard && (
            <ActiveFlashcard
              key={activeCard.id}
              card={activeCard}
              isFlipped={isFlipped}
              onFlip={() => setIsFlipped(!isFlipped)}
            />
          )}

          {/* Footer: SRS Controls */}
          <footer className="study-controls">
            <AnimatePresence>
              {isFlipped && (
                <motion.div
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 50, opacity: 0 }}
                  className="srs-panel"
                >
                  <div className="srs-grid">
                    {getTiersWithLock(activeCard.feedback || activeCard.nivel).map(tier => (
                      <button
                        key={tier.id}
                        className={`srs-btn ${tier.isLocked ? 'srs-locked' : ''}`}
                        style={{
                          '--btn-color': tier.color,
                          background: tier.isLocked ? 'transparent' : `${tier.color}18`,
                          borderColor: tier.isLocked ? 'rgba(255,255,255,0.04)' : `${tier.color}44`,
                        }}
                        onClick={() => !tier.isLocked && handleEvaluate(tier)}
                        disabled={tier.isLocked}
                        title={tier.isLocked ? 'Avance um nível por vez 🔒' : tier.desc}
                      >
                        <span className="srs-emoji">{tier.isLocked ? '🔒' : tier.emoji}</span>
                        <span className="srs-label">{tier.label}</span>
                        <span className="srs-desc">{tier.desc}</span>
                        <span className="srs-interval">{tier.interval}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </footer>
        </div>

        {/* Right Side: Draggable Card Stack */}
        <aside className="study-sidebar">
          <div className="sidebar-header">
            <h3>Próximos</h3>
            <span className="badge">{deckCards.length}</span>
          </div>
          <div className="card-stack-area">
            <AnimatePresence>
              {visibleDeck.map((card, idx) => (
                <StackCard
                  key={card.id}
                  card={card}
                  index={idx}
                  total={visibleDeck.length}
                  onPromote={handlePromote}
                />
              ))}
            </AnimatePresence>
            {deckCards.length === 0 && (
              <div className="empty-stack-msg">Último cartão!</div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
};

export default StudyInterface;
