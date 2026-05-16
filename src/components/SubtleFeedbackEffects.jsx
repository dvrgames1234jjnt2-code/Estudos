import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SubtleFeedbackEffects({ event }) {
  const [activeEvent, setActiveEvent] = useState(null);

  useEffect(() => {
    if (event?.timestamp) {
      setActiveEvent(event);
      const timer = setTimeout(() => setActiveEvent(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [event]);

  if (!activeEvent) return null;

  const lbl = (activeEvent.label || '').toLowerCase();
  
  let effectType = 'neutral';
  let gameText = '';
  let gameSubtext = '';

  if (lbl.includes('err') || lbl.includes('branc') || lbl.includes('esqueci')) {
    effectType = 'error';
    gameText = 'FOCO!';
    gameSubtext = 'Continue tentando';
  } else if (lbl.includes('auto')) {
    effectType = 'perfect'; 
    gameText = 'SENSACIONAL!';
    gameSubtext = 'PERFEITO! +20 XP';
  } else if (lbl.includes('rápido') || lbl.includes('rapido')) {
    effectType = 'fast'; 
    gameText = 'EXCELENTE!';
    gameSubtext = 'VELOCIDADE MÁXIMA +10 XP';
  } else if (lbl.includes('pensei')) {
    effectType = 'thought';
    gameText = 'BOA!';
    gameSubtext = 'Bom raciocínio';
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
            {/* Gamified Floating Text */}
            <FloatingText text={gameText} subtext={gameSubtext} type={effectType} />

            {/* Screen Shake for Errors */}
            {effectType === 'error' && <ScreenShake />}

            {/* Subtle Flash for Perfects */}
            {effectType === 'perfect' && <SubtleFlash />}

            {/* Conditional Renders for Different Subtle Effects */}
            {effectType === 'perfect' && (
              <SubtleConfetti colorPalette={['#2ECC71', '#27AE60', '#A9DFBF', '#ffffff', '#F1C40F']} count={50} />
            )}
            {effectType === 'fast' && (
              <>
                <SubtleStreak />
                <SubtleConfetti 
                  colorPalette={['#3b82f6', '#60a5fa', '#93c5fd', '#ffffff', '#00d4ff']} 
                  count={40} 
                />
              </>
            )}
            {effectType === 'thought' && <SubtlePulse />}
            {effectType === 'error' && <SubtleImpact />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// 0. Screen Shake Effect
function ScreenShake() {
  useEffect(() => {
    const root = document.querySelector('.study-main-layout');
    if (root) {
      root.classList.add('juice-shake');
      const timer = setTimeout(() => root.classList.remove('juice-shake'), 400);
      return () => clearTimeout(timer);
    }
  }, []);
  return null;
}

// 0.1 Subtle Flash Effect
function SubtleFlash() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.4, 0] }}
      transition={{ duration: 0.3 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#fff',
        zIndex: 999,
        pointerEvents: 'none'
      }}
    />
  );
}

// 0. Floating Gamified Text
function FloatingText({ text, subtext, type }) {
  const colors = {
    perfect: '#2ECC71',
    fast: '#3b82f6',
    thought: '#F59E0B',
    error: '#EF4444',
    neutral: '#94A3B8'
  };

  return (
    <motion.div
      className="game-floating-text"
      initial={{ y: 50, opacity: 0, scale: 0.2, rotate: -15 }}
      animate={{ 
        y: -180, 
        opacity: [0, 1, 1, 0], 
        scale: [0.2, 2, 1.5, 1],
        rotate: [-15, 5, 0]
      }}
      transition={{ duration: 2.5, ease: "backOut" }}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        textShadow: `0 0 40px ${colors[type]}, 0 0 80px ${colors[type]}44`
      }}
    >
      <motion.span 
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ repeat: Infinity, duration: 0.6 }}
        style={{ 
          color: colors[type], 
          fontWeight: 900, 
          fontSize: '2.5rem', 
          fontFamily: 'Outfit',
          letterSpacing: '0.05em',
          filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.5))'
        }}
      >
        {text}
      </motion.span>
      {subtext && (
        <span style={{ 
          color: '#fff', 
          fontSize: '0.9rem', 
          fontWeight: 800, 
          opacity: 0.9,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          marginTop: '8px'
        }}>
          {subtext}
        </span>
      )}
    </motion.div>
  );
}

// 1. Subtle Confetti for Automático / Rápido
function SubtleConfetti({ colorPalette = ['#2ECC71', '#27AE60', '#A9DFBF'], count = 12 }) {
  const dots = Array.from({ length: count });
  return (
    <motion.div 
      className="subtle-confetti-root"
      initial={{ scale: 0.5 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {dots.map((_, i) => {
        const angle = (i / dots.length) * Math.PI * 2;
        const startRadius = 80; // Start away from the text
        const endRadius = 220 + Math.random() * 100; // Explode far out
        
        const startX = Math.cos(angle) * startRadius;
        const startY = Math.sin(angle) * startRadius;
        const endX = Math.cos(angle) * endRadius;
        const endY = Math.sin(angle) * endRadius;
        
        return (
          <motion.div
            key={i}
            className="subtle-dot"
            initial={{ x: startX, y: startY, scale: 0, opacity: 1 }}
            animate={{ 
              x: endX, 
              y: endY, 
              scale: [0, 2.5, 0], // Big dots
              opacity: [1, 1, 0]
            }}
            transition={{ 
              duration: 2.0,
              ease: "circOut",
              delay: Math.random() * 0.1
            }}
            style={{
              backgroundColor: colorPalette[i % colorPalette.length],
              boxShadow: `0 0 20px ${colorPalette[i % colorPalette.length]}`,
              width: '10px',
              height: '10px',
              left: '-5px',
              top: '-5px'
            }}
          />
        );
      })}
    </motion.div>
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
      transition={{ duration: 1.5, ease: "easeOut" }}
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
      transition={{ duration: 1.2 }}
    />
  );
}
