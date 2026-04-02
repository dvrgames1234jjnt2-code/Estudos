import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { MOCK_LEVELS } from '../data/mockData';
import { downloadFlashcardsAsTSV } from '../utils/exportUtils';
import { handleRawTextImport, parsePastedTextToCards } from '../utils/importUtils';
import { LayoutGrid, ListOrdered, GripVertical } from 'lucide-react';
import './Dashboard.css';

// --- Helper Functions ---
const isReadyForToday = (nextReviewStr) => {
  if (!nextReviewStr) return true; // If no date, consider it ready (new)
  const next = new Date(nextReviewStr);
  const now = new Date();
  return next <= now;
};


const MateriaCard = ({ materia, topics, flashcards, onStartStudy, onDragOverTopico, onDropTopico }) => {
  const [expandedTopic, setExpandedTopic] = useState(null);
  const materiaCards = flashcards.filter(c => (c.materia?.trim() || 'Sem Matéria') === materia);
  const dueCards = materiaCards.filter(c => isReadyForToday(c.proximaRevisao));

  const toggleTopic = (topic) => {
    setExpandedTopic(expandedTopic === topic ? null : topic);
  };
  
  return (
    <motion.div 
      className="materia-card glass-panel"
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5, boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}
    >
      <div className="materia-card-header">
        <div className="materia-info">
          <h3 className="materia-name">{materia}</h3>
          <span className="materia-count">{materiaCards.length} cartões</span>
        </div>
        {dueCards.length > 0 && (
          <div className="materia-due-badge">
            <span className="pulse-dot"></span>
            {dueCards.length} prontos
          </div>
        )}
      </div>

      <div className="materia-topics-list">
        {topics.map(topic => {
          const topicCards = materiaCards.filter(c => (c.topico?.trim() || 'Sem Tópico') === topic);
          const topicDue = topicCards.filter(c => isReadyForToday(c.proximaRevisao));
          const isExpanded = expandedTopic === topic;

          // Feedback breakdown for this topic
          const levelCounts = MOCK_LEVELS.map(level => {
            const count = topicCards.filter(c => {
               const status = (c.feedback || 'desconhecido').toLowerCase();
               return status === level.name.toLowerCase() || status === level.id.toLowerCase();
            }).length;
            return { ...level, count };
          }).filter(l => l.count > 0);
          
          return (
            <div key={topic} className="topic-container">
              <motion.div 
                className={`topic-item ${isExpanded ? 'expanded' : ''}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('topicName', topic);
                  e.dataTransfer.setData('fromMateria', materia);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  onDragOverTopico(e);
                }}
                onDrop={(e) => onDropTopico(e, materia)}
                onClick={() => toggleTopic(topic)}
                layout
              >
                <span className="topic-icon">{isExpanded ? '📂' : '📁'}</span>
                <span className="topic-name">{topic}</span>
                <span className="topic-badge">{topicCards.length}</span>
                {topicDue.length > 0 && <span className="topic-due-indicator"></span>}
              </motion.div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div 
                    className="topic-expansion"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                  >
                    <div className="topic-content-grid">
                      <div className="topic-level-list">
                        <p className="expansion-label">Progresso</p>
                        {levelCounts.map(l => (
                          <div key={l.id} className="topic-level-row">
                            <div className="level-indicator">
                              <span className="level-dot-sm" style={{ backgroundColor: l.color }}></span>
                              <span className="level-name-sm">{l.name}</span>
                            </div>
                            <span className="level-count-sm">{l.count}</span>
                          </div>
                        ))}
                      </div>

                      {topicDue.length > 0 && (
                        <div className="topic-due-list">
                          <p className="expansion-label">Prontos p/ Hoje ({topicDue.length})</p>
                          <div className="due-questions-scroll">
                            {topicDue.slice(0, 10).map(card => (
                              <div key={card.id} className="due-question-item">
                                <span className="due-bullet">•</span>
                                <span className="due-text">{card.pergunta}</span>
                              </div>
                            ))}
                            {topicDue.length > 10 && <p className="more-cards-hint">+ {topicDue.length - 10} outros...</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <button 
        className="materia-study-btn" 
        onClick={() => onStartStudy(dueCards)}
        disabled={dueCards.length === 0}
      >
        {dueCards.length > 0 ? 'Estudar Agora' : 'Tudo em Dia'}
      </button>
    </motion.div>
  );
};
const ReorderableCardList = ({ cards, setCards }) => {
  return (
    <div className="reorder-list-container glass-panel">
      <div className="reorder-list-header">
        <div className="col-drag"></div>
        <div className="col-text">PERGUNTA</div>
        <div className="col-meta">MATÉRIA</div>
        <div className="col-meta">ASSUNTO</div>
        <div className="col-meta">TÓPICO</div>
        <div className="col-meta">SUB ASSUNTO</div>
        <div className="col-meta">CATEGORIA</div>
      </div>
      
      <Reorder.Group axis="y" values={cards} onReorder={setCards} className="reorder-group">
        {cards.map((card) => (
          <Reorder.Item key={card.id} value={card} className="reorder-item-card">
            <div className="drag-handle">
              <GripVertical size={16} />
            </div>
            
            <div className="col-text card-main-text">
              {card.pergunta}
            </div>

            <div className="col-meta">
              <span className="mini-pill">{card.materia || '---'}</span>
            </div>

            <div className="col-meta">
              <span className="mini-pill accent">{card.assunto || '---'}</span>
            </div>

            <div className="col-meta">
              <span className="meta-text">{card.topico || '---'}</span>
            </div>

            <div className="col-meta">
              <span className="meta-text">{card.subAssunto || '---'}</span>
            </div>

            <div className="col-meta">
              <span className="meta-text secondary">{card.categoria || '---'}</span>
            </div>
          </Reorder.Item>
        ))}
      </Reorder.Group>
    </div>
  );
};

const DueCardsFeed = ({ dueCards, onStartStudy }) => {
  const [viewMode, setViewMode] = useState('decks'); // 'decks' or 'list'
  const [orderedCards, setOrderedCards] = useState([]);

  useEffect(() => {
    setOrderedCards(dueCards);
  }, [dueCards]);

  if (dueCards.length === 0) return null;

  // Grouping cards by Subject (Materia)
  const groupedCards = dueCards.reduce((groups, card) => {
    const m = card.materia || 'Geral';
    if (!groups[m]) groups[m] = [];
    groups[m].push(card);
    return groups;
  }, {});

  return (
    <motion.section 
      className="review-feed-section"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <div className="feed-header">
        <div className="feed-title-wrap">
          <h2 className="feed-title">Sua Agenda</h2>
          <p className="feed-subtitle">{dueCards.length} cartões aguardando revisão</p>
        </div>

        <div className="feed-controls">
          <div className="view-toggle-pills">
            <button 
              className={`toggle-pill ${viewMode === 'decks' ? 'active' : ''}`}
              onClick={() => setViewMode('decks')}
            >
              <LayoutGrid size={14} /> Decks
            </button>
            <button 
              className={`toggle-pill ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <ListOrdered size={14} /> Reordenar
            </button>
          </div>
          <button className="feed-study-all-btn" onClick={() => onStartStudy(orderedCards)}>
            Estudar Tudo
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'decks' ? (
          <motion.div 
            key="decks"
            className="feed-groups-grid"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            {Object.entries(groupedCards).map(([materia, cards], index) => (
              <SubjectDeck 
                key={materia}
                cards={cards} 
                materia={materia} 
                index={index}
                onClick={() => onStartStudy(cards)} 
              />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <ReorderableCardList cards={orderedCards} setCards={setOrderedCards} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
};

const SUBJECT_ICONS = {
  'Conhecimentos Bancários': '🏛️',
  'Direito': '⚖️',
  'Informática': '💻',
  'Matemática': '🔢',
  'Língua Portuguesa': '✍️',
  'Raciocínio Lógico': '🧠',
  'default': '📚'
};

const SubjectDeck = ({ cards, materia, index, onClick }) => {
  const total = cards.length;
  const icon = SUBJECT_ICONS[materia] || SUBJECT_ICONS.default;
  
  return (
    <motion.div 
      className="subject-deck-wrapper"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -5 }}
      onClick={onClick}
    >
      <div className="subject-deck-stack">
        <div className="deck-layer layer-0"></div>
        <div className="deck-layer layer-1"></div>
        <div className="deck-layer layer-2">
          <div className="deck-cover-content">
            <div className="deck-main-icon">{icon}</div>
            <div className="deck-count-overlay">{total}</div>
            <p className="deck-title-text">{materia}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// --- Main Dashboard ---
export default function Dashboard({ onStartStudy, flashcards, isLoading, fetchError }) {
  const [dragOverMateria, setDragOverMateria] = useState(null);
  const [importStatus, setImportStatus] = useState(null); // { current, total }
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importMeta, setImportMeta] = useState({
    deck: "",
    deckPai: "",
    materia: "",
    topico: "",
    assunto: ""
  });

  // PREVIEW TABULAR logic
  const previewCards = useMemo(() => {
    return parsePastedTextToCards(importText, importMeta);
  }, [importText, importMeta]);

  const handleExport = () => {
    downloadFlashcardsAsTSV(flashcards);
  };

  const handleConfirmImport = async () => {
    if (!importText.trim()) return alert("Cole algum texto para importar.");
    
    setShowImportModal(false);
    setImportStatus({ current: 0, total: 100 });
    
    await handleRawTextImport(
      importText,
      importMeta,
      (curr, tot) => setImportStatus({ current: curr, total: tot }),
      (success, total) => {
        setImportStatus(null);
        alert(`Sucesso! ${success} de ${total} cartões importados.`);
        window.location.reload();
      }
    );
  };

  // Derive Materia -> Topic mapping
  const materiaMap = useMemo(() => {
    const map = {};
    flashcards.forEach(c => {
      const m = c.materia?.trim() || 'Sem Matéria';
      const t = c.topico?.trim() || 'Sem Tópico';
      if (!map[m]) map[m] = new Set();
      map[m].add(t);
    });
    // Convert sets to sorted arrays
    return Object.fromEntries(
      Object.entries(map).map(([m, tSet]) => [m, Array.from(tSet).sort()])
    );
  }, [flashcards]);

  const totalCards = flashcards?.length || 0;
  const cardsReadyToday = useMemo(() => flashcards?.filter(c => isReadyForToday(c.proximaRevisao)).length || 0, [flashcards]);

  const cardsByLevel = useMemo(() => {
    const counts = {};
    MOCK_LEVELS.forEach(l => counts[l.id] = 0);
    (flashcards || []).forEach(c => {
      const statusLabel = (c.feedback || 'desconhecido').toLowerCase();
      const matchLevel = MOCK_LEVELS.find(l => l.name.toLowerCase() === statusLabel) || MOCK_LEVELS[0];
      if (counts[matchLevel.id] !== undefined) counts[matchLevel.id]++;
    });
    return counts;
  }, [flashcards]);

  const handleDropTopic = (e, toMateria) => {
    e.preventDefault();
    const topicName = e.dataTransfer.getData('topicName');
    const fromMateria = e.dataTransfer.getData('fromMateria');
    
    if (fromMateria === toMateria) return;

    // In a real app, this would trigger a Notion API bulk update
    console.log(`Mover tópico "${topicName}" de "${fromMateria}" para "${toMateria}"`);
    alert(`Mover "${topicName}" para "${toMateria}" - (Funcionalidade de persistência em lote sendo implementada)`);
  };

  if (fetchError) {
    return (
      <div className="dashboard-container error-state">
        <div className="error-card glass-panel">
          <h2>Erro de Conexão</h2>
          <p>{fetchError}</p>
          <button onClick={() => window.location.reload()}>Tentar Novamente</button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="dashboard-container loading-state">
        <motion.div 
          animate={{ rotate: 360 }} 
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="loader"
        />
        <h2>Sincronizando com Notion...</h2>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-left">
          <h1 className="dashboard-title">Mindful Scholar</h1>
          <p className="dashboard-subtitle">Sincronizado com seu Notion.</p>
        </div>
        
        <div className="header-actions">
          <div className="data-management-bar">
            <button className="mgmt-btn" onClick={() => setShowImportModal(true)} title="Importar via Texto">
              <span className="btn-icon">📥</span> Importar
            </button>
            <button className="mgmt-btn" onClick={handleExport} title="Exportar TSV">
              <span className="btn-icon">📤</span> Exportar
            </button>
          </div>

          <motion.button 
            className="primary-study-btn" 
            onClick={() => onStartStudy(flashcards.filter(c => isReadyForToday(c.proximaRevisao)))}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Estudar Tudo ({cardsReadyToday})
          </motion.button>
        </div>
      </header>

      {importStatus && (
        <div className="import-overlay">
          <div className="import-progress-card glass-panel">
            <h3>Preparando seu Conhecimento...</h3>
            <div className="progress-track">
              <motion.div 
                className="progress-fill"
                initial={{ width: 0 }}
                animate={{ width: `${(importStatus.current / importStatus.total) * 100}%` }}
                transition={{ type: "spring", bounce: 0, duration: 0.5 }}
              />
            </div>
            <p className="progress-text">{importStatus.current} de {importStatus.total} cartões</p>
            <span className="loader-sm"></span>
            <p className="progress-subtext">Por favor, mantenha esta aba aberta.</p>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showImportModal && (
          <div className="import-modal-overlay">
            <motion.div 
              className="import-modal glass-panel"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="modal-header">
                <h2>Importação Rápida</h2>
                <button className="close-modal" onClick={() => setShowImportModal(false)}>✕</button>
              </div>

              <div className="modal-body">
                <div className="meta-inputs-grid">
                  <div className="input-field">
                    <label>Assunto</label>
                    <input 
                      placeholder="Ex: Direito Civil"
                      value={importMeta.assunto}
                      onChange={e => setImportMeta({ ...importMeta, assunto: e.target.value })}
                    />
                  </div>
                  <div className="input-field">
                    <label>Matéria</label>
                    <input 
                      placeholder="Ex: Contratos"
                      value={importMeta.materia}
                      onChange={e => setImportMeta({ ...importMeta, materia: e.target.value })}
                    />
                  </div>
                  <div className="input-field">
                    <label>Tópico</label>
                    <input 
                      placeholder="Ex: Validade"
                      value={importMeta.topico}
                      onChange={e => setImportMeta({ ...importMeta, topico: e.target.value })}
                    />
                  </div>
                  <div className="input-field">
                    <label>Deck</label>
                    <input 
                      placeholder="Ex: OAB"
                      value={importMeta.deck}
                      onChange={e => setImportMeta({ ...importMeta, deck: e.target.value })}
                    />
                  </div>
                  <div className="input-field">
                    <label>Subdeck (Pai)</label>
                    <input 
                      placeholder="Ex: Principal"
                      value={importMeta.deckPai}
                      onChange={e => setImportMeta({ ...importMeta, deckPai: e.target.value })}
                    />
                  </div>
                </div>

                <div className="text-import-area">
                  <label>Cole aqui (Pergunta ; Resposta)</label>
                  <textarea 
                    placeholder="Pergunta 1 ; Resposta 1&#10;Pergunta 2 ; Resposta 2 ; Referência ; Explicação"
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                  />
                </div>

                {previewCards.length > 0 && (
                  <div className="import-preview-section">
                    <label>Pré-visualização ({previewCards.length} cartões)</label>
                    <div className="preview-table-wrapper">
                      <table className="preview-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Pergunta</th>
                            <th>Resposta</th>
                            <th>Info</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewCards.map((card, idx) => (
                            <tr key={idx}>
                              <td>{idx + 1}</td>
                              <td>{card.pergunta}</td>
                              <td>{card.resposta}</td>
                              <td>
                                {card.referencia && <span title={card.referencia}>🔗</span>}
                                {card.explicacao && <span title={card.explicacao}>💡</span>}
                                {!card.referencia && !card.explicacao && <span className="dimmed">-</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button className="cancel-btn" onClick={() => setShowImportModal(false)}>Cancelar</button>
                <button 
                  className="confirm-import-btn" 
                  onClick={handleConfirmImport}
                  disabled={!importText.trim()}
                >
                  Confirmar Importação
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <section className="stats-overview">
        <div className="stat-card glass-panel">
          <span className="stat-label">Total</span>
          <span className="stat-value">{totalCards}</span>
        </div>
        <div className="stat-card glass-panel highlight">
          <span className="stat-label">Prontos</span>
          <span className="stat-value">{cardsReadyToday}</span>
        </div>
        <div className="stat-card glass-panel">
          <span className="stat-label">Dominados</span>
          <span className="stat-value">{cardsByLevel['mastered'] || 0}</span>
        </div>
      </section>

      <DueCardsFeed 
        dueCards={flashcards.filter(c => isReadyForToday(c.proximaRevisao))} 
        onStartStudy={onStartStudy}
      />

      <main className="dashboard-content">
        <div className="materia-grid">
          {Object.entries(materiaMap).map(([materia, topics]) => (
            <MateriaCard 
              key={materia}
              materia={materia}
              topics={topics}
              flashcards={flashcards}
              onStartStudy={(cards) => onStartStudy(cards)}
              onDragOverTopico={(e) => setDragOverMateria(materia)}
              onDropTopico={handleDropTopic}
            />
          ))}
        </div>

        <aside className="levels-sidebar glass-panel">
          <h3>Progresso por Nível</h3>
          <div className="level-stats-list">
            {MOCK_LEVELS.map(level => (
              <div className="level-stat-row" key={level.id}>
                <div className="level-info">
                  <span className="level-dot" style={{ backgroundColor: level.color }}></span>
                  <span className="level-name">{level.name}</span>
                </div>
                <span className="level-value">{cardsByLevel[level.id] || 0}</span>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}
