import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MOCK_LEVELS } from '../data/mockData';
import { parsePastedTextToCards } from '../utils/importUtils';
import { processAnkiFile } from '../utils/ankiImportUtils';
import { supabase, insertCardsToSupabase, fetchCardsFromSupabase, deleteAllCards } from '../services/supabaseService';
import { LayoutGrid, Play, Search, CheckSquare, ListOrdered, X, RotateCcw, FileUp, Database, Sparkles, BookOpen, Clock, Languages, Plus, LogOut, Home, ChevronRight } from 'lucide-react';
import './Dashboard.css';

// --- Helper Functions ---
const isReadyForToday = (nextReviewStr) => {
  if (!nextReviewStr) return true;
  const next = new Date(nextReviewStr);
  const now = new Date();
  return next <= now;
};

// --- Sub-components for Refined Layout ---

const Sidebar = ({ onClear }) => {
  const handleClearAll = async () => {
    if (window.confirm("ATENÇÃO: Isso apagará TODOS os seus cartões permanentemente. Deseja continuar?")) {
      const { error } = await deleteAllCards();
      if (error) {
        alert("Erro ao apagar: " + error);
      } else {
        alert("Todos os cartões foram apagados com sucesso.");
        if (onClear) onClear();
      }
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand-icon">
          <Database size={18} />
        </div>
        <span className="brand-name">Supabase Sync</span>
      </div>
      
      <div className="sidebar-search-container">
        <div className="sidebar-search">
          <Search size={14} className="text-dark" />
          <input type="text" placeholder="Pesquisar conteúdo..." />
        </div>
      </div>

      <nav className="nav-section">
        <span className="nav-label">Navegação</span>
        <div className="nav-list">
          <div className="nav-item">
            <LayoutGrid className="nav-icon" />
            <span>Início</span>
          </div>
          <div className="nav-item active">
            <Sparkles className="nav-icon" />
            <span>Flashcards (IA)</span>
          </div>
          <div className="nav-item">
            <CheckSquare className="nav-icon" />
            <span>Questão Gerada (IA)</span>
          </div>
          <div className="nav-item">
            <ListOrdered className="nav-icon" />
            <span>Cards de Questões</span>
          </div>
          <div className="nav-item">
            <BookOpen className="nav-icon" />
            <span>Tabela de Questões</span>
          </div>
          <div className="nav-item">
            <Search className="nav-icon" />
            <span>Analisar Questão</span>
          </div>
          <div className="nav-item">
            <Clock className="nav-icon" />
            <span>Revisões</span>
          </div>
          <div className="nav-item">
            <Languages className="nav-icon" />
            <span>Treinar Inglês</span>
          </div>
        </div>
      </nav>

      <div className="sidebar-footer">
        <button 
          onClick={handleClearAll}
          className="clear-data-btn"
          style={{ 
            width: '100%', 
            padding: '10px', 
            marginBottom: '8px', 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.2)', 
            borderRadius: '8px',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: '600'
          }}
        >
          <RotateCcw size={14} />
          Limpar Todos os Dados
        </button>
        <button 
          onClick={() => supabase.auth.signOut()}
          className="logout-btn"
        >
          <LogOut size={16} />
          <span>Sair da Conta</span>
        </button>
      </div>
    </aside>
  );
};

const HierarchyItem = ({ item, onSelect, index }) => {
  const hasChildren = Object.keys(item.children || {}).length > 0;
  const colors = ['blue', 'purple', 'red', 'teal', 'orange'];
  const colorClass = colors[index % colors.length];
  
  const dueCount = (item.cards || []).filter(c => isReadyForToday(c.proximaRevisao)).length;
  
  return (
    <motion.div 
      className={`deck-item list-style ${hasChildren ? 'collection' : ''}`}
      onClick={() => onSelect(item)}
      whileHover={{ x: 4 }}
      layout
    >
      <div className="deck-main-info">
        <div className={`deck-icon-box ${colorClass}`} style={{ width: '40px', height: '40px', flexShrink: 0 }}>
          {hasChildren ? <BookOpen size={20} /> : <Sparkles size={20} />}
        </div>
        <div className="deck-meta">
          <h4 className="deck-title" style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>{item.name}</h4>
          <span className="deck-subtitle" style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
            {hasChildren ? `${Object.keys(item.children).length} sub-itens • ` : ''}
            {item.cards.length} cartões
            {dueCount > 0 && <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}> • {dueCount} pendentes</span>}
          </span>
        </div>
      </div>
      <ChevronRight size={16} style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
    </motion.div>
  );
};

const Dashboard = ({ onStartStudy }) => {
  const [flashcards, setFlashcards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('padrão');

  // Modals state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState('text');
  const [importData, setImportData] = useState({
    rawText: '',
    materia: '',
    topico: '',
    deck: '',
    subdeck: ''
  });
  
  const [selectedMateria, setSelectedMateria] = useState(null);
  const [activeCollection, setActiveCollection] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ankiCards, setAnkiCards] = useState([]);
  const [user, setUser] = useState(null);
  const [importStats, setImportStats] = useState({ current: 0, total: 0, currentDeck: '' });

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    fetchUser();
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const allCards = await fetchCardsFromSupabase();
      console.log(`[Dashboard] ${allCards.length} cartões carregados com sucesso.`);
      setFlashcards(allCards);
    } catch (err) {
      console.error('Error loading cards:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const { tree, flatMap } = useMemo(() => {
    const rootTree = { name: 'Raiz', children: {}, cards: [] };
    const flat = {};

    flashcards.forEach(card => {
      // Build full path from materia and topico if distinct
      const materiaPart = card.materia || 'Sem Matéria';
      const topicoPart = card.topico || '';
      
      // If topico is already in materia (Anki style), don't duplicate
      const fullPath = (topicoPart && !materiaPart.endsWith(topicoPart)) 
        ? `${materiaPart}::${topicoPart}` 
        : materiaPart;
        
      const parts = fullPath.split('::');
      
      let current = rootTree;
      parts.forEach((part, index) => {
        const currentPath = parts.slice(0, index + 1).join('::');
        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            fullPath: currentPath,
            children: {},
            cards: []
          };
        }
        current = current.children[part];
        current.cards.push(card);
        flat[currentPath] = current;
      });
    });
    return { tree: rootTree, flatMap: flat };
  }, [flashcards]);

  const handleStartDeck = (materia) => {
    const deckData = flatMap[materia] || tree;
    if (!deckData) return;

    const cardsToStudy = (deckData.cards || []).filter(c => 
      isReadyForToday(c.proximaRevisao)
    );
    
    if (cardsToStudy.length > 0) {
      onStartStudy(cardsToStudy);
    } else {
      // Se não houver nada para hoje, talvez estudar novos ou tudo?
      // Por enquanto vamos apenas avisar ou estudar tudo
      onStartStudy(deckData.cards);
    }
  };

  const handleConfirmImport = async () => {
    if (importType === 'text') {
      if (!importData.rawText.trim()) return;
      setIsProcessing(true);
      try {
        const parsedCards = parsePastedTextToCards(importData.rawText, {
          materia: importData.materia,
          topico: importData.topico
        });
        setImportStats({ current: 0, total: parsedCards.length, currentDeck: importData.materia });
        await processAndSaveCards(parsedCards, importData.materia || 'Default Deck');
        setShowImportModal(false);
        loadData();
      } catch (err) {
        alert('Erro na importação: ' + err.message);
      } finally {
        setIsProcessing(false);
      }
    } else if (importType === 'anki') {
      if (ankiCards.length === 0) {
        alert('Nenhum cartão Anki carregado. Selecione um arquivo .apkg primeiro.');
        return;
      }
      setIsProcessing(true);
      setImportStats({ current: 0, total: ankiCards.length, currentDeck: 'Iniciando...' });
      
      try {
        await processAndSaveCards(ankiCards, "Importação Anki");
        setShowImportModal(false);
        setAnkiCards([]);
        loadData();
        alert(`Sucesso! Todos os decks e cartões foram importados.`);
      } catch (err) {
        alert('Erro na importação: ' + err.message);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const processAndSaveCards = async (cards, defaultDeckTitle) => {
    if (!user) throw new Error('Usuário não autenticado. Por favor, faça login.');

    const cardsByDeck = cards.reduce((acc, card) => {
      const deckName = card.deck_name || defaultDeckTitle;
      if (!acc[deckName]) acc[deckName] = [];
      acc[deckName].push(card);
      return acc;
    }, {});

    let processedCount = 0;

    for (const [deckName, deckCards] of Object.entries(cardsByDeck)) {
      setImportStats(prev => ({ ...prev, currentDeck: deckName }));
      
      const BATCH_SIZE = 100;
      for (let i = 0; i < deckCards.length; i += BATCH_SIZE) {
        const batch = deckCards.slice(i, i + BATCH_SIZE);
        const { error } = await insertCardsToSupabase(batch, deckName, user.id);
        
        if (error) throw new Error(`Erro no baralho "${deckName}": ${error}`);
        
        processedCount += batch.length;
        setImportStats(prev => ({ ...prev, current: processedCount }));
      }
    }
  };

  if (loading) return (
    <div className="loading-state">
      <div className="loader"></div>
      <p>Sincronizando com Supabase...</p>
    </div>
  );

  if (error) return (
    <div className="error-state">
      <X size={48} color="#ff4d4d" />
      <h3>Erro na Conexão</h3>
      <p>{error}</p>
      <button onClick={loadData}>Tentar Novamente</button>
    </div>
  );

  return (
    <div className="dashboard-layout">
      <Sidebar onClear={loadData} />

      <main className="main-content">
        <header className="content-header">
          <h1 className="page-title">Meus Decks</h1>
          <div className="header-actions">
            <button className="btn-expandir">Expandir Tudo</button>
            <button className="icon-action-btn" onClick={loadData}><RotateCcw size={18} /></button>
            <button className="icon-action-btn"><X size={18} /></button>
          </div>
        </header>

        <div className="content-tabs">
          <button 
            className={`tab-btn ${viewMode === 'padrão' ? 'active' : ''}`}
            onClick={() => setViewMode('padrão')}
          >
            Padrão
          </button>
          <button 
            className={`tab-btn ${viewMode === 'criados' ? 'active' : ''}`}
            onClick={() => setViewMode('criados')}
          >
            Criados
          </button>
          <button 
            className={`tab-btn ${viewMode === 'salvos' ? 'active' : ''}`}
            onClick={() => setViewMode('salvos')}
          >
            Salvos
          </button>
          <button 
            className={`tab-btn ${viewMode === 'estudados' ? 'active' : ''}`}
            onClick={() => setViewMode('estudados')}
          >
            Estudados
          </button>
        </div>

        {/* Barra de Navegação (Breadcrumbs) */}
        <div className="breadcrumbs-container" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          marginBottom: '24px',
          flexWrap: 'wrap',
          padding: '12px 20px',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          <button 
            className="breadcrumb-item"
            onClick={() => setActiveCollection(null)}
            style={{ background: 'none', border: 'none', color: activeCollection ? 'var(--text-dim)' : 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: activeCollection ? '500' : '700', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Home size={14} /> Início
          </button>
          {activeCollection && activeCollection.split('::').map((part, idx, arr) => (
            <React.Fragment key={idx}>
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.8rem' }}>/</span>
              <button 
                className="breadcrumb-item"
                onClick={() => setActiveCollection(arr.slice(0, idx + 1).join('::'))}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: idx === arr.length - 1 ? 'var(--accent-primary)' : 'var(--text-dim)', 
                  cursor: 'pointer', 
                  fontSize: '0.85rem', 
                  fontWeight: idx === arr.length - 1 ? '700' : '500' 
                }}
              >
                {part}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="deck-list">
            {(() => {
              const currentLevel = activeCollection ? flatMap[activeCollection] : tree;
              
              // Fallback se a coleção ativa não existir no mapeamento atual
              if (activeCollection && !currentLevel) {
                setTimeout(() => setActiveCollection(null), 0);
                return null;
              }

              const hasSubDecks = currentLevel && Object.keys(currentLevel.children).length > 0;
              const hasCardsHere = currentLevel && currentLevel.cards.length > 0;

              if (hasSubDecks) {
                const sortedEntries = Object.entries(currentLevel.children).sort(([nameA], [nameB]) =>
                  nameA.localeCompare(nameB, 'pt-BR', { numeric: true, sensitivity: 'base' })
                );
                return sortedEntries.map(([name, data], idx) => (
                  <HierarchyItem 
                    key={data.fullPath}
                    item={data}
                    index={idx}
                    onSelect={(item) => {
                      if (Object.keys(item.children).length > 0) {
                        setActiveCollection(item.fullPath);
                      } else {
                        setSelectedMateria(item.fullPath);
                      }
                    }}
                  />
                ));
              } else if (hasCardsHere) {
                const dueCount = currentLevel.cards.filter(c => isReadyForToday(c.proximaRevisao)).length;
                return (
                  <motion.div 
                    className="topic-overview-panel"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ 
                      gridColumn: '1 / -1',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: '24px',
                      padding: '40px',
                      border: '1px solid rgba(255,255,255,0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: '24px'
                    }}
                  >
                    <div className="deck-icon-box blue" style={{ width: '80px', height: '80px' }}>
                      <Sparkles size={40} />
                    </div>
                    <div>
                      <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>{currentLevel.name}</h2>
                      <p style={{ color: 'var(--text-dim)', fontSize: '1.1rem' }}>
                        Este tópico contém <strong>{currentLevel.cards.length}</strong> cartões.
                      </p>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '40px', margin: '20px 0' }}>
                      <div className="stat-item">
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{dueCount}</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>PARA HOJE</div>
                      </div>
                      <div className="stat-item">
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{currentLevel.cards.length - dueCount}</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>REVISADOS</div>
                      </div>
                    </div>

                    <button 
                      className="btn-expandir"
                      style={{ padding: '16px 40px', fontSize: '1.1rem', borderRadius: '16px' }}
                      onClick={() => handleStartDeck(currentLevel.fullPath)}
                    >
                      <Play size={22} fill="currentColor" />
                      Começar Estudo
                    </button>
                  </motion.div>
                );
              } else {
                return (
                  <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-dark)', gridColumn: '1 / -1' }}>
                    <Sparkles size={48} style={{ opacity: 0.2, marginBottom: '20px' }} />
                    <h3>Nenhuma Coleção Selecionada</h3>
                    <p>Use a barra acima para navegar ou selecione uma coleção inicial.</p>
                    <button className="btn-expandir" onClick={() => setActiveCollection(null)} style={{ marginTop: '20px', padding: '10px 30px' }}>
                      Voltar ao Início
                    </button>
                  </div>
                );
              }
            })()}
          </div>

        <motion.div 
          className="fab"
          onClick={() => setShowImportModal(true)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <Plus size={32} strokeWidth={3} />
        </motion.div>

        {/* --- Modals --- */}
        <AnimatePresence>
          {showImportModal && (
            <motion.div 
              className="import-modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowImportModal(false)}
            >
              <div 
                className="glass-panel" 
                style={{ width: '100%', maxWidth: '600px', overflow: 'hidden' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <h3>Importar Flashcards</h3>
                  <button className="icon-action-btn" onClick={() => setShowImportModal(false)}><X size={20}/></button>
                </div>
                <div className="modal-body">
                  <div className="import-modal-content">
                    <div className="import-type-selector">
                      <button 
                        className={`type-btn ${importType === 'text' ? 'active' : ''}`}
                        onClick={() => setImportType('text')}
                      >
                        Texto / TSV
                      </button>
                      <button 
                        className={`type-btn ${importType === 'anki' ? 'active' : ''}`}
                        onClick={() => setImportType('anki')}
                      >
                        Anki (.apkg)
                      </button>
                    </div>

                    {importType === 'text' && (
                      <div className="text-import-area">
                        <textarea 
                          placeholder="Cole seu texto aqui (Pergunta TAB Resposta ou Pergunta | Resposta)"
                          value={importData.rawText}
                          onChange={(e) => setImportData({...importData, rawText: e.target.value})}
                        />
                        <div className="import-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                          <div className="input-field">
                            <input 
                              type="text" 
                              placeholder="Matéria" 
                              value={importData.materia}
                              onChange={(e) => setImportData({...importData, materia: e.target.value})}
                            />
                          </div>
                          <div className="input-field">
                            <input 
                              type="text" 
                              placeholder="Tópico" 
                              value={importData.topico}
                              onChange={(e) => setImportData({...importData, topico: e.target.value})}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {importType === 'anki' && (
                      <div className="anki-import-area">
                        <label className="anki-drop-zone">
                          <FileUp size={32} color="#555" />
                          <p>Clique ou arraste o arquivo <strong>.apkg</strong> aqui</p>
                          <input 
                            type="file" 
                            className="hidden" 
                            accept=".apkg"
                            onChange={async (e) => {
                              const file = e.target.files[0];
                              if (file) {
                                try {
                                  const cards = await processAnkiFile(file);
                                  setAnkiCards(cards);
                                } catch (err) {
                                  alert(err.message);
                                }
                              }
                            }}
                          />
                        </label>

                        {ankiCards.length > 0 && (
                          <div className="preview-container">
                            <div className="preview-header">
                              <span className="preview-title">
                                Preview: {ankiCards.length} cartões encontrados
                              </span>
                            </div>
                            <div className="preview-table-wrapper">
                              <table className="preview-table">
                                <thead>
                                  <tr>
                                    <th>Deck</th>
                                    <th>Pergunta</th>
                                    <th>Resposta</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {ankiCards.slice(0, 50).map((card, idx) => (
                                    <tr key={idx}>
                                      <td>
                                        <span className="deck-tag">{card.deck_name}</span>
                                      </td>
                                      <td dangerouslySetInnerHTML={{ __html: card.pergunta }}></td>
                                      <td dangerouslySetInnerHTML={{ __html: card.resposta }}></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="modal-footer" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  {!isProcessing ? (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', width: '100%' }}>
                      <button className="tab-btn" onClick={() => setShowImportModal(false)}>Cancelar</button>
                      <button 
                        className="btn-expandir" 
                        onClick={handleConfirmImport}
                      >
                        Importar Agora
                      </button>
                    </div>
                  ) : (
                    <div style={{ width: '100%', padding: '10px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-dim)', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          Salvando: <strong style={{ color: 'var(--accent-primary)' }}>{importStats.currentDeck}</strong>
                        </span>
                        <span style={{ fontWeight: '800', color: 'var(--accent-primary)' }}>
                          {Math.round((importStats.current / (importStats.total || 1)) * 100)}%
                        </span>
                      </div>
                      
                      <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(importStats.current / (importStats.total || 1)) * 100}%` }}
                          transition={{ type: 'spring', stiffness: 50 }}
                          style={{ 
                            height: '100%', 
                            background: 'linear-gradient(90deg, #3b82f6, #2dd4bf)', 
                            boxShadow: '0 0 15px rgba(59, 130, 246, 0.4)' 
                          }}
                        />
                      </div>
                      
                      <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {importStats.current.toLocaleString()} de {importStats.total.toLocaleString()} cartões processados
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {selectedMateria && (
            <motion.div 
              className="import-modal-overlay"
              onClick={() => setSelectedMateria(null)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div 
                className="glass-panel"
                style={{ width: '90%', maxWidth: '850px', overflow: 'hidden' }}
                onClick={(e) => e.stopPropagation()}
                layoutId={`deck-${selectedMateria}`}
              >
                <div className="modal-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div className="deck-icon-box blue" style={{ width: '50px', height: '50px' }}>✨</div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{selectedMateria.split('::').pop()}</h2>
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                        {selectedMateria.includes('::') && <span style={{ opacity: 0.6 }}>{selectedMateria.split('::').slice(0,-1).join(' › ')} › </span>}
                        {flatMap[selectedMateria]?.cards?.length || 0} cartões totais
                      </span>
                    </div>
                  </div>
                  <button className="icon-action-btn" onClick={() => setSelectedMateria(null)}>
                    <X size={20} />
                  </button>
                </div>

                <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '50px', padding: '40px' }}>
                   <div>
                      <p className="nav-label" style={{ marginBottom: '20px' }}>Progresso da Coleção</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {MOCK_LEVELS.map(level => {
                          const count = (flatMap[selectedMateria]?.cards || []).filter(c => 
                            c.feedback?.toLowerCase() === level.name?.toLowerCase() || 
                            c.feedback?.toLowerCase() === level.id?.toLowerCase()
                          ).length;
                          return (
                            <div key={level.id} style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              padding: '14px 20px', 
                              background: 'rgba(255,255,255,0.02)', 
                              borderRadius: '14px',
                              border: '1px solid rgba(255,255,255,0.03)'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: level.color, boxShadow: `0 0 10px ${level.color}44` }}></div>
                                <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>{level.name}</span>
                              </div>
                              <span style={{ fontWeight: '800', fontFamily: 'monospace' }}>{count}</span>
                            </div>
                          );
                        })}
                      </div>
                   </div>

                   <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      <p className="nav-label">Status da Sessão</p>
                      <div style={{ padding: '20px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '20px', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
                        <div style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '4px' }}>
                          {(flatMap[selectedMateria]?.cards || []).filter(c => isReadyForToday(c.proximaRevisao)).length}
                        </div>
                        <div style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--accent-primary)', letterSpacing: '0.1em' }}>
                          Cartões para hoje
                        </div>
                      </div>
                      
                      <button 
                        className="btn-expandir"
                        style={{ width: '100%', height: '60px', borderRadius: '16px', fontSize: '1rem' }}
                        onClick={() => {
                          handleStartDeck(selectedMateria);
                          setSelectedMateria(null);
                        }}
                      >
                        <Play size={20} fill="currentColor" />
                        Estudar Agora
                      </button>
                   </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Dashboard;
