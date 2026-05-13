import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { MOCK_LEVELS } from '../data/mockData';
import { downloadFlashcardsAsTSV } from '../utils/exportUtils';
import { handleRawTextImport, parsePastedTextToCards } from '../utils/importUtils';
import { LayoutGrid, ListOrdered, GripVertical, X, Play, Search, CheckSquare, Square, RotateCcw, Shuffle, Filter } from 'lucide-react';
import './Dashboard.css';

// --- Helper Functions ---
const isReadyForToday = (nextReviewStr) => {
  if (!nextReviewStr) return true; // If no date, consider it ready (new)
  const next = new Date(nextReviewStr);
  const now = new Date();
  return next <= now;
};


const MateriaCard = ({ materia, topics, flashcards, onStartStudy, onDragOverTopico, onDropTopico, levelsToUse }) => {

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
            <span className="due-count">{dueCards.length} prontos</span>
          </div>
        )}
      </div>

      <div className="materia-topics-list">
        {topics.map(topic => {
          const topicCards = materiaCards.filter(c => (c.topico?.trim() || 'Sem Tópico') === topic);
          const topicDue = topicCards.filter(c => isReadyForToday(c.proximaRevisao));
          const isExpanded = expandedTopic === topic;

          // Feedback breakdown for this topic using real config
          const levelCounts = levelsToUse.map(level => {
            const count = topicCards.filter(c => {
              const status = (c.feedback || 'desconhecido').toLowerCase();
              return status === level.name?.toLowerCase() || status === level.id?.toLowerCase();
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
                            {topicDue.map(card => (
                              <div key={card.id} className="due-question-item">
                                <span className="due-bullet">•</span>
                                <span className="due-text">{card.frente || card.pergunta}</span>
                              </div>
                            ))}
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

// SRS level labels — the values from Notion are already in Portuguese (Esqueci, Errei, etc.)
// This map is used as a fallback for any old English or unmapped values in the modal.
const SRS_LEVELS_PT = {
  all: 'Todos os Níveis',
  // Nomes reais do Notion:
  'Esqueci': 'Esqueci',
  'Errei': 'Errei',
  'Pensei': 'Pensei',
  'Rápido': 'Rápido',
  'Automático': 'Automático',
  // Fallbacks antigos em inglês:
  New: 'Novo',
  Learning: 'Aprendendo',
  Review: 'Revisando',
  Mastered: 'Dominado',
};

// --- Custom Review Modal Component ---
const CustomReviewModal = ({ isOpen, onClose, flashcards, onStartStudy }) => {
  const [activeTab, setActiveTab] = useState('revisao'); // 'revisao' | 'deck'

  // ─── Aba Revisão ──────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDeck, setFilterDeck] = useState('all');
  const [filterDeckPai, setFilterDeckPai] = useState('all');
  const [filterMateria, setFilterMateria] = useState('all');
  const [filterTopico, setFilterTopico] = useState('all');
  const [filterAssunto, setFilterAssunto] = useState('all');
  const [filterNivel, setFilterNivel] = useState('all');
  const [selectedCardIds, setSelectedCardIds] = useState(new Set());
  const [limit, setLimit] = useState(20);
  const [shouldShuffle, setShouldShuffle] = useState(true);

  // ─── Aba Ver Deck ─────────────────────────────────────────────
  const [deckViewSelected, setDeckViewSelected] = useState('');
  const [deckViewSearch, setDeckViewSearch] = useState('');
  const [deckViewFlipped, setDeckViewFlipped] = useState(null);

  if (!isOpen) return null;

  // ─── Derived option lists ─────────────────────────────────────
  const uniqueVals = (key) => ['all', ...new Set(flashcards.map(c => c[key]).filter(Boolean)).values()];

  const deckOptions = uniqueVals('deck');
  const deckPaiOptions = uniqueVals('deckPai');
  const materiaOptions = uniqueVals('materia');

  // Tópico depende da Matéria selecionada
  const topicoOptions = ['all', ...new Set(
    flashcards
      .filter(c => filterMateria === 'all' || c.materia === filterMateria)
      .map(c => c.topico).filter(Boolean)
  )];

  // Assunto depende do Tópico selecionado
  const assuntoOptions = ['all', ...new Set(
    flashcards
      .filter(c => filterMateria === 'all' || c.materia === filterMateria)
      .filter(c => filterTopico === 'all' || c.topico === filterTopico)
      .map(c => c.assunto).filter(Boolean)
  )];

  const nivelOptions = Object.keys(SRS_LEVELS_PT);

  // Reset cascading filters when parent changes
  const handleMateriaChange = (v) => { setFilterMateria(v); setFilterTopico('all'); setFilterAssunto('all'); };
  const handleTopicoChange = (v) => { setFilterTopico(v); setFilterAssunto('all'); };

  // ─── Filtered cards (aba Revisão) ─────────────────────────────
  const filteredCards = flashcards.filter(card => {
    const q = searchTerm.toLowerCase();
    if (q && !(card.frente + ' ' + card.verso + ' ' + (card.assunto || '') + ' ' + (card.topico || '')).toLowerCase().includes(q)) return false;
    if (filterDeck !== 'all' && card.deck !== filterDeck) return false;
    if (filterDeckPai !== 'all' && card.deckPai !== filterDeckPai) return false;
    if (filterMateria !== 'all' && card.materia !== filterMateria) return false;
    if (filterTopico !== 'all' && card.topico !== filterTopico) return false;
    if (filterAssunto !== 'all' && card.assunto !== filterAssunto) return false;
    if (filterNivel !== 'all' && card.feedback !== filterNivel && card.srsLevel !== filterNivel) return false;
    return true;
  });

  // ─── Selection helpers ────────────────────────────────────────
  const toggleCard = (id) => { const n = new Set(selectedCardIds); n.has(id) ? n.delete(id) : n.add(id); setSelectedCardIds(n); };
  const selectAll = () => setSelectedCardIds(new Set(filteredCards.map(c => c.id)));
  const deselectAll = () => setSelectedCardIds(new Set());
  const invertSelection = () => {
    const n = new Set();
    filteredCards.forEach(c => { if (!selectedCardIds.has(c.id)) n.add(c.id); });
    setSelectedCardIds(n);
  };

  const handleStart = () => {
    let sel = flashcards.filter(c => selectedCardIds.has(c.id));
    if (shouldShuffle) sel = [...sel].sort(() => Math.random() - 0.5);
    if (limit > 0) sel = sel.slice(0, limit);
    onStartStudy(sel, { isCasual: true });
    onClose();
  };

  // ─── Aba Ver Deck ─────────────────────────────────────────────
  const allDecks = [...new Set(flashcards.map(c => c.deck).filter(Boolean))].sort();
  const deckCards = flashcards.filter(c =>
    c.deck === deckViewSelected &&
    (deckViewSearch === '' || (c.frente + ' ' + c.verso).toLowerCase().includes(deckViewSearch.toLowerCase()))
  );

  const startDeckStudy = () => {
    let sel = flashcards.filter(c => c.deck === deckViewSelected);
    onStartStudy(sel, { isCasual: true });
    onClose();
  };

  // ─── Render helpers ───────────────────────────────────────────
  const FilterSelect = ({ label, value, onChange, options, labelMap = {} }) => (
    <div className="filter-group">
      <span className="filter-label">{label}</span>
      <select className="filter-select" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => (
          <option key={o} value={o} style={{ background: '#0f111a' }}>
            {labelMap[o] || (o === 'all' ? `Todos` : o)}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="custom-modal-overlay" onClick={onClose}>
      <motion.div
        className="custom-modal custom-modal-wide"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 24 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* ── Header ── */}
        <div className="custom-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <h2>🎯 Revisão Sem Compromisso</h2>
            <div className="modal-tabs">
              <button
                className={`modal-tab ${activeTab === 'revisao' ? 'active' : ''}`}
                onClick={() => setActiveTab('revisao')}
              >
                Seleção Personalizada
              </button>
              <button
                className={`modal-tab ${activeTab === 'deck' ? 'active' : ''}`}
                onClick={() => setActiveTab('deck')}
              >
                Ver por Deck
              </button>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        {/* ══════════════════════════════════════
            ABA: REVISÃO PERSONALIZADA
        ══════════════════════════════════════ */}
        {activeTab === 'revisao' && (
          <>
            <div className="custom-modal-body">

              {/* Busca */}
              <div className="search-box" style={{ width: '100%' }}>
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Buscar por texto da pergunta, resposta ou assunto..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Filtros em grade */}
              <div className="filters-grid">
                <FilterSelect label="Deck Pai" value={filterDeckPai} onChange={setFilterDeckPai} options={deckPaiOptions} />
                <FilterSelect label="Deck" value={filterDeck} onChange={setFilterDeck} options={deckOptions} />
                <FilterSelect label="Matéria" value={filterMateria} onChange={handleMateriaChange} options={materiaOptions} />
                <FilterSelect label="Tópico" value={filterTopico} onChange={handleTopicoChange} options={topicoOptions} />
                <FilterSelect label="Assunto" value={filterAssunto} onChange={setFilterAssunto} options={assuntoOptions} />
                <FilterSelect
                  label="Nível SRS"
                  value={filterNivel}
                  onChange={setFilterNivel}
                  options={nivelOptions}
                  labelMap={SRS_LEVELS_PT}
                />
              </div>

              {/* Ações em lote */}
              <div className="selection-actions">
                <div className="batch-btns">
                  <button className="batch-btn" onClick={selectAll}>
                    <CheckSquare size={14} /> Selecionar Todos ({filteredCards.length})
                  </button>
                  <button className="batch-btn" onClick={deselectAll}>
                    <Square size={14} /> Limpar Seleção
                  </button>
                  <button className="batch-btn" onClick={invertSelection}>
                    <RotateCcw size={14} /> Inverter
                  </button>
                </div>
                <div className="selection-summary">
                  Exibindo <strong>{filteredCards.length}</strong> cartões · <strong>{selectedCardIds.size}</strong> selecionados
                </div>
              </div>

              {/* Lista de cartões */}
              <div className="card-selection-list">
                {filteredCards.length === 0
                  ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
                      Nenhum cartão encontrado com os filtros aplicados.
                    </div>
                  )
                  : filteredCards.map(card => (
                    <div
                      key={card.id}
                      className={`card-selection-item ${selectedCardIds.has(card.id) ? 'selected' : ''}`}
                      onClick={() => toggleCard(card.id)}
                    >
                      <div className="checkbox-wrap">
                        {selectedCardIds.has(card.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                      </div>
                      <div className="card-text-wrap">{card.frente || card.pergunta}</div>
                      <div className="card-meta-wrap">
                        {card.materia && <div className="meta-chip chip-materia">{card.materia}</div>}
                        {card.assunto && <div className="meta-chip chip-assunto">{card.assunto}</div>}
                        {card.deck && <div className="meta-chip chip-deck">{card.deck}</div>}
                        <div className="meta-chip chip-nivel">
                          {SRS_LEVELS_PT[card.feedback] || SRS_LEVELS_PT[card.srsLevel] || 'Novo'}
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>

              {/* Configuração da sessão */}
              <div className="session-config-row">
                <div className="config-item">
                  <label>Limite de cartões:</label>
                  <input
                    type="number"
                    value={limit}
                    onChange={e => setLimit(parseInt(e.target.value, 10) || 0)}
                    min="0" max="999"
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>(0 = sem limite)</span>
                </div>
                <div className="config-item" style={{ cursor: 'pointer' }} onClick={() => setShouldShuffle(v => !v)}>
                  <div className="checkbox-wrap" style={{ color: shouldShuffle ? 'var(--accent-primary)' : 'var(--text-dim)' }}>
                    {shouldShuffle ? <CheckSquare size={18} /> : <Square size={18} />}
                  </div>
                  <label style={{ cursor: 'pointer', color: 'var(--text-dim)' }}>Embaralhar ordem</label>
                </div>
              </div>
            </div>

            <div className="custom-modal-footer">
              <button className="cancel-link-btn" onClick={onClose}>Cancelar</button>
              <motion.button
                className="start-casual-btn"
                disabled={selectedCardIds.size === 0}
                onClick={handleStart}
                whileHover={selectedCardIds.size > 0 ? { scale: 1.03 } : {}}
                whileTap={selectedCardIds.size > 0 ? { scale: 0.97 } : {}}
              >
                <Shuffle size={18} />
                Iniciar Revisão ({Math.min(selectedCardIds.size, limit > 0 ? limit : Infinity) === Infinity ? selectedCardIds.size : Math.min(selectedCardIds.size, limit)} cartões)
              </motion.button>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════
            ABA: VER POR DECK
        ══════════════════════════════════════ */}
        {activeTab === 'deck' && (
          <>
            <div className="custom-modal-body">

              {/* Seletor de deck */}
              <div className="deck-picker-row">
                <label className="filter-label" style={{ fontSize: '1rem', fontWeight: 700, color: 'white' }}>
                  Escolha o Deck:
                </label>
                <select
                  className="filter-select deck-picker-select"
                  value={deckViewSelected}
                  onChange={e => { setDeckViewSelected(e.target.value); setDeckViewFlipped(null); setDeckViewSearch(''); }}
                >
                  <option value="" style={{ background: '#0f111a' }}>— Selecione um deck —</option>
                  {allDecks.map(d => (
                    <option key={d} value={d} style={{ background: '#0f111a' }}>{d}</option>
                  ))}
                </select>
                {deckViewSelected && (
                  <span className="deck-count-chip">{flashcards.filter(c => c.deck === deckViewSelected).length} cartões</span>
                )}
              </div>

              {/* Busca dentro do deck */}
              {deckViewSelected && (
                <div className="search-box" style={{ width: '100%' }}>
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder={`Buscar dentro de "${deckViewSelected}"...`}
                    value={deckViewSearch}
                    onChange={e => setDeckViewSearch(e.target.value)}
                  />
                </div>
              )}

              {/* Lista de cartões do deck */}
              {deckViewSelected ? (
                <div className="card-selection-list deck-view-list">
                  {deckCards.length === 0
                    ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>Nenhum cartão encontrado.</div>
                    : deckCards.map(card => (
                      <div
                        key={card.id}
                        className={`deck-view-item ${deckViewFlipped === card.id ? 'flipped' : ''}`}
                        onClick={() => setDeckViewFlipped(v => v === card.id ? null : card.id)}
                      >
                        <div className="deck-view-front">
                          <span className="deck-view-icon">📋</span>
                          <span className="deck-view-text">{card.frente || card.pergunta}</span>
                          <span className="deck-view-hint">clique para ver resposta</span>
                        </div>
                        {deckViewFlipped === card.id && (
                          <div className="deck-view-back">
                            <span className="deck-view-icon">💡</span>
                            <span className="deck-view-text">{card.verso || card.resposta}</span>
                            {card.assunto && <span className="meta-chip chip-assunto" style={{ marginTop: 8 }}>{card.assunto}</span>}
                          </div>
                        )}
                        <div className="deck-view-chips">
                          {card.materia && <span className="meta-chip chip-materia">{card.materia}</span>}
                          {card.topico && <span className="meta-chip chip-topico">{card.topico}</span>}
                          <span className="meta-chip chip-nivel">
                            {SRS_LEVELS_PT[card.feedback] || SRS_LEVELS_PT[card.srsLevel] || 'Novo'}
                          </span>
                        </div>
                      </div>
                    ))
                  }
                </div>
              ) : (
                <div className="deck-empty-state">
                  <div style={{ fontSize: '3rem', marginBottom: 16 }}>📚</div>
                  <p>Selecione um deck acima para visualizar todos os seus cartões.</p>
                </div>
              )}
            </div>

            <div className="custom-modal-footer">
              <button className="cancel-link-btn" onClick={onClose}>Fechar</button>
              {deckViewSelected && (
                <motion.button
                  className="start-casual-btn"
                  onClick={startDeckStudy}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Shuffle size={18} />
                  Estudar Deck Completo ({flashcards.filter(c => c.deck === deckViewSelected).length} cartões)
                </motion.button>
              )}
            </div>
          </>
        )}
      </motion.div>
    </div>
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
  const [selectedDeckToView, setSelectedDeckToView] = useState(null);

  const todayFormat = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const todayCapitalized = todayFormat.charAt(0).toUpperCase() + todayFormat.slice(1);

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
          <p className="feed-subtitle">{todayCapitalized} • {dueCards.length} cartões aguardando revisão</p>
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
                onClick={() => setSelectedDeckToView({ materia, cards })}
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

      <AnimatePresence>
        {selectedDeckToView && (
          <motion.div
            className="deck-preview-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              if (e.target.classList.contains('deck-preview-modal-overlay')) {
                setSelectedDeckToView(null);
              }
            }}
          >
            <motion.div
              className="deck-preview-modal"
              initial={{ y: 50, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <div className="deck-preview-header">
                <div className="deck-preview-title">
                  <span className="deck-preview-icon">{SUBJECT_ICONS[selectedDeckToView.materia] || SUBJECT_ICONS.default}</span>
                  <h3>{selectedDeckToView.materia}</h3>
                  <span className="deck-preview-count">{selectedDeckToView.cards.length} cards</span>
                </div>
                <button className="deck-preview-close" onClick={() => setSelectedDeckToView(null)}>
                  <X size={20} />
                </button>
              </div>

              <div className="deck-preview-list">
                {selectedDeckToView.cards.map((card, idx) => (
                  <div key={card.id || idx} className="deck-preview-item">
                    <span className="deck-preview-idx">{idx + 1}</span>
                    <div className="deck-preview-content">
                      <p className="deck-preview-question">{card.frente || card.pergunta}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="deck-preview-footer">
                <button
                  className="deck-preview-start-btn"
                  onClick={() => {
                    onStartStudy(selectedDeckToView.cards);
                    setSelectedDeckToView(null);
                  }}
                >
                  <Play size={16} fill="currentColor" /> Estudar Deck
                </button>
              </div>
            </motion.div>
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
        <div className="deck-cover-content">
          <div className="deck-main-icon">{icon}</div>
          <div className="deck-count-overlay">{total}</div>
          <p className="deck-title-text">{materia}</p>
        </div>
      </div>
    </motion.div>
  );
};

// --- Main Dashboard ---
export default function Dashboard({ onStartStudy, onRefresh, flashcards, isLoading, fetchError, configLevels }) {
  const levelsToUse = (configLevels && configLevels.length > 0) ? configLevels : MOCK_LEVELS;

  const [dragOverMateria, setDragOverMateria] = useState(null);
  const [importStatus, setImportStatus] = useState(null); // { current, total }
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBulkConfigModal, setShowBulkConfigModal] = useState(false);
  const [showCustomReviewModal, setShowCustomReviewModal] = useState(false);
  const [bulkConfigState, setBulkConfigState] = useState({ proximaRevisao: '', feedback: '' });

  const [bulkUpdateStatus, setBulkUpdateStatus] = useState(null); // { current, total }
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

  const handleBulkUpdate = async () => {
    if (!bulkConfigState.proximaRevisao && !bulkConfigState.feedback) {
      return alert("Preencha ao menos um campo para atualizar.");
    }

    setShowBulkConfigModal(false);
    setBulkUpdateStatus({ current: 0, total: flashcards.length });

    const updates = {};
    if (bulkConfigState.proximaRevisao) updates.proximaRevisao = bulkConfigState.proximaRevisao;
    if (bulkConfigState.feedback) updates.feedback = bulkConfigState.feedback;

    let count = 0;
    for (const card of flashcards) {
      // updateCardInNotion from notionService handles the API call
      // Implemented an artificial delay of 350ms to respect Notion's 3 requests/sec rate limit
      await import('../services/notionService').then(m => m.updateCardInNotion(card.id, updates));
      await new Promise(r => setTimeout(r, 350));
      count++;
      setBulkUpdateStatus({ current: count, total: flashcards.length });
    }

    setBulkUpdateStatus(null);
    alert(`Sucesso! ${count} cartões atualizados.`);
    window.location.reload();
  };

  const totalCards = flashcards?.length || 0;
  const cardsReadyToday = useMemo(() => flashcards?.filter(c => isReadyForToday(c.proximaRevisao)).length || 0, [flashcards]);

  const cardsByLevel = useMemo(() => {
    const counts = {};
    levelsToUse.forEach(l => { counts[l.id] = 0; });
    counts['unmapped'] = 0;

    (flashcards || []).forEach(c => {
      const feedbackRaw = c.feedback || '';
      const feedbackLow = feedbackRaw.toLowerCase();

      // Match by name (case-insensitive) — covers real Notion names like "Esqueci"
      const matchLevel = levelsToUse.find(l =>
        String(l.name).toLowerCase() === feedbackLow ||
        String(l.id).toLowerCase() === feedbackLow
      );

      if (matchLevel) {
        counts[matchLevel.id]++;
      } else {
        counts['unmapped']++;
      }
    });
    return counts;
  }, [flashcards, levelsToUse]);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <h1 className="dashboard-title">Flashcards</h1>
            <div className="game-stats-widget">
              <div className="level-badge">
                <span className="level-num">12</span>
                <span className="level-tag">Lvl</span>
              </div>
              <div className="xp-container">
                <div className="xp-info">
                  <span>2.450 / 3.000 XP</span>
                </div>
                <div className="xp-bar-outer">
                  <motion.div
                    className="xp-bar-inner"
                    initial={{ width: 0 }}
                    animate={{ width: '75%' }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>
            <motion.button
              className="sync-btn"
              onClick={onRefresh}
              title="Sincronizar"
              whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.1)' }}
              whileTap={{ scale: 0.9 }}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-glass)',
                padding: '8px',
                borderRadius: '10px',
                cursor: 'pointer'
              }}
            >
              🔄
            </motion.button>
          </div>
        </div>

        <div className="header-actions">
          <div className="data-management-bar">
            <button className="mgmt-btn" onClick={() => setShowBulkConfigModal(true)} title="Ajuste Rápido de Todos os Cartões">
              <span className="btn-icon">⚙️</span> Ajuste em Massa
            </button>
            <button className="mgmt-btn" onClick={() => setShowImportModal(true)} title="Importar via Texto">
              <span className="btn-icon">📥</span> Importar
            </button>
            <button className="mgmt-btn" onClick={handleExport} title="Exportar TSV">
              <span className="btn-icon">📤</span> Exportar
            </button>
          </div>

          <motion.button
            className="secondary-study-btn"
            onClick={() => setShowCustomReviewModal(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{ marginRight: '12px' }}
          >
            Revisão Personalizada
          </motion.button>

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
            <p className="progress-subtext">Isso pode levar alguns minutos.</p>
          </div>
        </div>
      )}

      {bulkUpdateStatus && (
        <div className="import-overlay">
          <div className="import-progress-card glass-panel">
            <h3>Atualizando Cartões em Massa...</h3>
            <div className="progress-track">
              <motion.div
                className="progress-fill"
                initial={{ width: 0 }}
                animate={{ width: `${(bulkUpdateStatus.current / bulkUpdateStatus.total) * 100}%` }}
                transition={{ type: "spring", bounce: 0, duration: 0.5 }}
              />
            </div>
            <p className="progress-text">{bulkUpdateStatus.current} de {bulkUpdateStatus.total} cartões atualizados</p>
            <span className="loader-sm"></span>
            <p className="progress-subtext">Aguarde, respeitando o limite de requisições do Notion.</p>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showBulkConfigModal && (
          <div className="import-modal-overlay">
            <motion.div
              className="import-modal glass-panel"
              style={{ maxWidth: '500px' }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="modal-header">
                <h2>Configuração em Massa</h2>
                <button className="close-modal" onClick={() => setShowBulkConfigModal(false)}>✕</button>
              </div>

              <div className="modal-body" style={{ padding: '0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '10px' }}>
                  Altere a Próxima Revisão e o Nível (Feedback) de <strong>TODOS ({totalCards})</strong> os seus cartões de uma vez. Mantenha em branco para não alterar.
                </p>

                <div className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>Data da Próxima Revisão</label>
                  <input
                    type="date"
                    style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', colorScheme: 'dark' }}
                    value={bulkConfigState.proximaRevisao}
                    onChange={e => setBulkConfigState({ ...bulkConfigState, proximaRevisao: e.target.value })}
                  />
                  <div style={{ display: 'flex', gap: '10px', marginTop: '5px', flexWrap: 'wrap' }}>
                    <button
                      style={{ flex: '1 1 auto', fontSize: '0.75rem', padding: '10px 12px', borderRadius: '6px', cursor: 'pointer', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.5)', color: '#a5b4fc' }}
                      onClick={() => setBulkConfigState({ ...bulkConfigState, proximaRevisao: new Date().toISOString().split('T')[0] })}
                    >Para Hoje</button>
                    <button
                      style={{ flex: '1 1 auto', fontSize: '0.75rem', padding: '10px 12px', borderRadius: '6px', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                      onClick={() => setBulkConfigState({ ...bulkConfigState, proximaRevisao: '' })}
                    >Limpar</button>
                  </div>
                </div>

                <div className="input-field premium-field">
                  <label>Nível do Cartão (Feedback)</label>
                  <div className="premium-select-wrapper">
                    <select
                      className="premium-select"
                      value={bulkConfigState.feedback || ''}
                      onChange={e => setBulkConfigState({ ...bulkConfigState, feedback: e.target.value })}
                    >
                      <option value="">-- Não Alterar --</option>
                      <option value="Novo">Novo</option>
                      <option value="Esqueci">Recomeçar (Esqueci)</option>
                      <option value="Aprendendo">Aprendendo</option>
                      <option value="Parcial">Sei, mas não tudo (Parcial)</option>
                      <option value="Esforço">Demorei, mas acertei (Esforço)</option>
                      <option value="Dominado">Excelente (Dominado)</option>
                    </select>
                    <span className="select-arrow">▾</span>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '10px' }}>
                <button className="cancel-btn" onClick={() => setShowBulkConfigModal(false)}>Cancelar</button>
                <button
                  className="primary-study-btn"
                  style={{ padding: '12px 24px', fontSize: '0.95rem' }}
                  onClick={handleBulkUpdate}
                >
                  Aplicar aos {totalCards} Cartões
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
          <span className="stat-value">{cardsByLevel['Automático'] || cardsByLevel['mastered'] || 0}</span>
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
              levelsToUse={levelsToUse}
              onStartStudy={(cards) => onStartStudy(cards)}
              onDragOverTopico={(e) => setDragOverMateria(materia)}
              onDropTopico={handleDropTopic}
            />

          ))}
        </div>

        <aside className="levels-sidebar glass-panel">
          <h3>Progresso por Nível</h3>
          <div className="level-stats-list">
            {levelsToUse.map(level => (
              <div className="level-stat-row" key={level.id}>
                <div className="level-info">
                  <span className="level-dot" style={{ backgroundColor: level.color }}></span>
                  <span className="level-name">{level.name}</span>
                </div>
                <span className="level-value">{cardsByLevel[level.id] || 0}</span>
              </div>
            ))}
            {(cardsByLevel['unmapped'] > 0 || cardsByLevel['desconhecido'] > 0) && (
              <div className="level-stat-row unknown">
                <div className="level-info">
                  <span className="level-dot" style={{ backgroundColor: '#4b5563' }}></span>
                  <span className="level-name">Não Mapeado</span>
                </div>
                <span className="level-value">{(cardsByLevel['unmapped'] || 0) + (cardsByLevel['desconhecido'] || 0)}</span>
              </div>
            )}
          </div>
        </aside>
      </main>

      <CustomReviewModal
        isOpen={showCustomReviewModal}
        onClose={() => setShowCustomReviewModal(false)}
        flashcards={flashcards || []}
        onStartStudy={onStartStudy}
      />
    </div>
  );
}
