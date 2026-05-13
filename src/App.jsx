import React, { useState, useEffect } from 'react'
import StudyInterface from './components/StudyInterface'
import Dashboard from './components/Dashboard'
import { fetchCardsFromNotion, updateCardInNotion, fetchConfigFromNotion } from './services/notionService'
import './index.css'

function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [flashcards, setFlashcards] = useState([]);
  const [sessionConfig, setSessionConfig] = useState([]);
  const [studySubset, setStudySubset] = useState(null); // Local subset for active session
  const [isCasualMode, setIsCasualMode] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  async function loadData() {
    setIsLoading(true);
    setFetchError(null);
    try {
      const [data, configData] = await Promise.all([
        fetchCardsFromNotion(),
        fetchConfigFromNotion()
      ]);
      setFlashcards(data || []);
      setSessionConfig(configData || []);
    } catch (err) {
      setFetchError(err.message || 'Erro desconhecido ao carregar dados');
      setFlashcards([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    loadData();
  };

  const handleStartStudy = (subset = null, options = {}) => {
    setStudySubset(subset);
    setIsCasualMode(!!options.isCasual);
    setCurrentTab('study');
  };


  const handleUpdateCard = async (cardId, updates) => {
    // Optimistic update locally
    setFlashcards(prev => prev.map(c => String(c.id) === String(cardId) ? { ...c, ...updates } : c));
    if (studySubset) {
      setStudySubset(prev => prev.map(c => String(c.id) === String(cardId) ? { ...c, ...updates } : c));
    }
    
    // Persist to Notion ONLY if not in casual mode
    if (!isCasualMode) {
      await updateCardInNotion(cardId, updates);
    } else {
      console.log('Casual mode active: Skipping Notion update for card', cardId);
    }
  };


  return (
    <>
      {currentTab === 'dashboard' ? (
        <Dashboard 
          onStartStudy={handleStartStudy} 
          onRefresh={handleRefresh}
          flashcards={flashcards} 
          isLoading={isLoading} 
          fetchError={fetchError}
          configLevels={sessionConfig}
        />
      ) : (
        <StudyInterface 
          onExit={() => {
            setCurrentTab('dashboard');
            setIsCasualMode(false);
          }} 
          flashcards={studySubset || flashcards}
          onUpdateCard={handleUpdateCard}
          configLevels={sessionConfig}
          isCasual={isCasualMode}
        />
      )}
    </>
  )
}

export default App
