import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SubtleFeedbackEffects({ event }) {
  const [activeEvent, setActiveEvent] = useState(null);

  useEffect(() => {
    if (event?.timestamp) {
      setActiveEvent(event);
      const timer = setTimeout(() => setActiveEvent(null), 1200);
      return () => clearTimeout(timer);
    }
  }, [event]);

  if (!activeEvent) return null;

  const lbl = (activeEvent.label || '').toLowerCase();
  
  let effectType = 'neutral';
  if (lbl.includes('err') || lbl.includes('branc') || lbl.includes('esqueci')) {
    effectType = 'error';
  } else if (lbl.includes('auto')) {
    effectType = 'perfect'; // Confetti
  } else if (lbl.includes('rápido') || lbl.includes('rapido')) {
    effectType = 'fast'; 
  } else if (lbl.includes('pensei')) {
    effectType = 'thought';
  }

  return (
    <div className="subtle-feedback-container">
      <AnimatePresence mode="popLayout">
        {activeEvent && (
          <motion.div
            key={activeEvent.timestamp}
            className={`subtle-effect-layer ${effectType}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Conditional Renders for Different Subtle Effects */}
            {effectType === 'perfect' && <SubtleConfetti />}
            {effectType === 'fast' && <SubtleStreak />}
            {effectType === 'thought' && <SubtlePulse />}
            {effectType === 'error' && <SubtleImpact />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// 1. Subtle Confetti for Automático
function SubtleConfetti() {
  const dots = Array.from({ length: 12 });
  return (
    <div className="subtle-confetti-root">
      {dots.map((_, i) => {
        const angle = (i / dots.length) * Math.PI * 2;
        const radius = 60 + Math.random() * 40;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        
        return (
          <motion.div
            key={i}
            className="subtle-dot"
            initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
            animate={{ 
              x: x, 
              y: y, 
              scale: [0, 1.5, 0],
              opacity: [1, 1, 0]
            }}
            transition={{ 
              duration: 0.6,
              ease: "easeOut",
              delay: Math.random() * 0.1
            }}
            style={{
              backgroundColor: ['#2ECC71', '#27AE60', '#A9DFBF'][i % 3]
            }}
          />
        );
      })}
    </div>
  );
}

// 2. Subtle Fast Ripple for Rápido
function SubtleStreak() {
  return (
    <motion.div 
      className="subtle-fast-streak"
      initial={{ scaleX: 0, opacity: 0, x: '-100%' }}
      animate={{ scaleX: 1, opacity: [0, 0.4, 0], x: '100%' }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    />
  );
}

// 3. Subtle Pulse for Pensei
function SubtlePulse() {
  return (
    <motion.div
      className="subtle-pulse-ring"
      initial={{ scale: 0.8, opacity: 0.5 }}
      animate={{ scale: 2, opacity: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    />
  );
}

// 4. Subtle Impact / Vignette for Errei / Branco
function SubtleImpact() {
  return (
    <motion.div
      className="subtle-error-vignette"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.15, 0] }}
      transition={{ duration: 0.4 }}
    />
  );
}
