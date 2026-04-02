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

// Dynamically map Notion config to SRS buttons
const getDynamicTiers = (configLevels) => {
  if (!configLevels || configLevels.length === 0) return [];
  // Sort ascending by fatorDias (lowest score = hardest card first)
  const sorted = [...configLevels].sort((a, b) => a.fatorDias - b.fatorDias);
  return sorted.map((c, idx) => ({
    id: c.id || idx,
    label: c.nivel,
    desc: c.descricao,
    carga: c.carga,
    fatorDias: c.fatorDias,
    qtdDeCards: c.qtdDeCards,
    limiteDeCard: c.limiteDeCard,
    interval: c.fatorDias > 0 ? `+${c.fatorDias}d` : `${c.fatorDias}d`,
    // Color scale from red (hard) to green (easy)
    color: ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#10b981'][idx % 5],
    emoji: ['🧠', '🥶', '🤔', '⚡', '🤖'][idx % 5],
    type: ['forgot', 'partial', 'effortful', 'learning', 'mastered'][idx % 5]
  }));
};

const getStatusFromLabel = (label) => {
  const lower = (label || '').toLowerCase();
  if (lower.includes('automático')) return 'Dominado';
  if (lower.includes('branco')) return 'Aprendizado';
  return 'Revisão';
};

/**
 * Spaced Repetition Formula mapping accumulated Score to Review Interval (days).
 * - Score <= 0 -> 1 day
 * - Score > 0 -> exponential spaced repetition curve.
 */
function calculateReviewInterval(score) {
  if (score <= 0) return 1;
  return Math.round(1 + Math.pow(1.45, score * 0.5));
}

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
   MAIN COMPONENT
    ══════════════════════════════════════ */
const StudyInterface = ({ onExit, flashcards = [], onUpdateCard, configLevels = [] }) => {
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
    feedback: c.feedback || c.nivel || '', // nível SRS atual do card
    tempoSessao: c.tempoSessao || 0,
    score: c.score || 0,
    timesShown: 0,
    remainingAppearances: 1
  }));

  const [deck, setDeck] = useState(normalizedCards);
  const [completedCards, setCompletedCards] = useState([]); // Visual tracking of finished cards
  const [activeId, setActiveId] = useState(normalizedCards[0]?.id);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studiedCount, setStudiedCount] = useState(0);
  
  // Session Configuration & Limits
  const [cargaAtual, setCargaAtual] = useState(0);
  const limiteCarga = flashcards.length * 2;
  const [cardStartTime, setCardStartTime] = useState(Date.now());
  const [evaluationEvent, setEvaluationEvent] = useState(null);
  const [sessionFinished, setSessionFinished] = useState(false);
  const [sessionReason, setSessionReason] = useState('Parabéns!');
  const [showSuccess, setShowSuccess] = useState(null);

  const dynamicTiers = getDynamicTiers(configLevels);

  if (!activeId || (deck.length === 0 && !sessionFinished)) {
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
          <h1>{sessionReason}</h1>
          <p>Você revisou <strong>{studiedCount}</strong> interações hoje.</p>
          <div className="stats-row">
            <div className="stat-pill" title="Carga acumulada na sessão">
              Carga: {cargaAtual} / {limiteCarga}
            </div>
            <div className="stat-pill">Consistência +5xp</div>
          </div>
          <button className="premium-btn large" onClick={onExit}>Finalizar Sessão</button>
        </motion.div>
      </div>
    );
  }

  const activeCard = deck.find(c => c.id === activeId);
  const deckCards = deck.filter(c => c.id !== activeId);
  
  // Combine pending cards and completed cards so that completed cards "go to the back" visually
  const visualStackBase = [...deckCards, ...completedCards];
  const visibleDeck = visualStackBase.slice(0, MAX_DECK_VISIBLE);
  
  const totalCards = flashcards.length;
  // Progress can be visually derived from carga limits or just simple completed vs total
  const progress = Math.min(100, (cargaAtual / Math.max(1, limiteCarga)) * 100);

  const handlePromote = (card) => {
    // Apenas coloca na frente, não afeta a Carga.
    setDeck(prev => {
      const without = prev.filter(c => c.id !== card.id && c.id !== activeId);
      const oldActive = prev.find(c => c.id === activeId);
      return [card, ...without, oldActive].filter(Boolean);
    });
    setActiveId(card.id);
    setIsFlipped(false);
    setCardStartTime(Date.now());
  };

  const handleEvaluate = (tier) => {
    const type = tier.type;
    setEvaluationEvent({ type, timestamp: Date.now() });

    // Calcula tempo gasto na sessão para este card (em minutos)
    const elapsedMs = Date.now() - cardStartTime;
    const elapsedMinutes = Number((elapsedMs / 60000).toFixed(2));
    
    // Calcula a nova carga
    const addedCarga = tier.carga || 0;
    const newCargaTotal = cargaAtual + addedCarga;
    
    // Novo Sistema: O 'fatorDias' da configuração atua como uma Progressão de Score.
    const addedScore = tier.fatorDias || 0;
    const newScore = Math.max(0, (activeCard.score || 0) + addedScore);
    const addedDays = calculateReviewInterval(newScore);

    const now = new Date();
    let nextDate = new Date();
    nextDate.setDate(now.getDate() + addedDays);

    const lbl = (tier.label || '').toLowerCase();
    const isError = lbl.includes('err') || lbl.includes('branc') || lbl.includes('esqueci');

    if (onUpdateCard && activeId && activeCard) {
      onUpdateCard(activeId, {
        feedback: tier.label,
        status: getStatusFromLabel(tier.label),
        proximaRevisao: nextDate.toISOString(),
        ultimaRevisao: now.toISOString(),
        tempoSessao: (activeCard.tempoSessao || 0) + elapsedMinutes,
        acertos: activeCard.acertos + (isError ? 0 : 1),
        erros: activeCard.erros + (isError ? 1 : 0),
        score: newScore
      });
    }

    const without = deck.filter(c => c.id !== activeId);
    let newDeckList;
    
    // Cálculo de aparições para a mesma sessão baseado no Nível
    const qtd = tier.qtdDeCards || 0;
    const limit = tier.limiteDeCard || 1;

    let newRem = (activeCard.remainingAppearances - 1) + qtd;
    let newShown = activeCard.timesShown + 1;

    // Limita as aparições do cartão ao "limite máximo permitido" nesta sessão (baseado na config do Nível)
    if (newShown + newRem > limit) {
      newRem = limit - newShown;
    }
    if (newRem < 0) newRem = 0;

    const updatedCard = {
      ...activeCard,
      remainingAppearances: newRem,
      timesShown: newShown
    };

    if (newRem > 0) {
      // O card ainda tem aparições restantes: Vai para o final da fila (Loop)
      newDeckList = [...without, updatedCard];
    } else {
      // O card atingiu o limite de exibições ou foi completado de vez ("Automático"): Remove do ciclo
      newDeckList = without;
      setCompletedCards(prev => [...prev, updatedCard]);
    }

    setDeck(newDeckList);
    setCargaAtual(newCargaTotal);
    setStudiedCount(c => c + 1);

    if (newCargaTotal >= limiteCarga) {
      setSessionReason("Sessão Encerrada (Carga Atingida)");
      setTimeout(() => setSessionFinished(true), 800);
      return;
    }
    if (newDeckList.length === 0) {
       setSessionReason("Baralho Limpo!");
       setTimeout(() => setSessionFinished(true), 800);
       return;
    }

    setActiveId(newDeckList[0].id);
    setIsFlipped(false);
    setCardStartTime(Date.now());
  };

  return (
    <div className="study-interface premium-theme">
      <header className="study-header">
        <div className="header-brand">
          <div className="brand-logo">❂</div>
          <span className="brand-text">Mindful Scholar</span>
        </div>

        <div className="header-center">
          <div className="progress-group">
            <div className="progress-numbers" title={`Carga limite de sessão: ${limiteCarga}`}>
              <span className="current">{cargaAtual}</span>
              <span className="total">/ {limiteCarga} (Carga)</span>
            </div>
            <div className="progress-bar-bg" title="Se certar mais fácil, a barra sobe devagar!">
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
                    {dynamicTiers.map(tier => (
                      <button
                        key={tier.id}
                        className={`srs-btn`}
                        style={{
                          '--btn-color': tier.color,
                        }}
                        onClick={() => handleEvaluate(tier)}
                        title={`Carga: +${tier.carga}`}
                      >
                        <span className="srs-label">{tier.label}</span>
                        <span className="srs-desc">{tier.desc}</span>
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
            <h3 title="Quantidade de repetições restantes nesta sessão">Próximos</h3>
            <span className="badge">
              {deckCards.reduce((acc, card) => acc + (card.remainingAppearances || 1), 0)}
            </span>
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
