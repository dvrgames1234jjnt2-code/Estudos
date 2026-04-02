import React from 'react';

const DeckStack = ({ total, current, type = 'source' }) => {
  const isSource = type === 'source';
  const label = isSource ? "BARALHO" : "CONCLUÍDO";
  const count = isSource ? `${current + 1} / ${total}` : `${current} / ${total}`;
  const progress = isSource ? ((current + 1) / total) * 100 : (current / total) * 100;

  return (
    <div className={`deck-stack ${type}`}>
      {/* 8-Layer 3D Stack */}
      <div className="stack-card s8"></div>
      <div className="stack-card s7"></div>
      <div className="stack-card s6"></div>
      <div className="stack-card s5"></div>
      <div className="stack-card s4"></div>
      <div className="stack-card s3"></div>
      <div className="stack-card s2"></div>
      <div className="stack-card s1"></div>

      {/* Main deck info Widget */}
      <div className="deck-info">
        <h2 className="widget-title">{label}</h2>
        <span className="count-indicator">{count}</span>
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default DeckStack;
