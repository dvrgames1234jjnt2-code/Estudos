import React, { useState, useEffect } from 'react'
import StudyInterface from './components/StudyInterface'
import Dashboard from './components/Dashboard'
import { fetchCardsFromNotion, updateCardInNotion } from './services/notionService'
import './index.css'

function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [flashcards, setFlashcards] = useState([]);
  const [studySubset, setStudySubset] = useState(null); // Local subset for active session
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setFetchError(null);
      try {
        const data = await fetchCardsFromNotion();
        setFlashcards(data || []);
      } catch (err) {
        setFetchError(err.message || 'Erro desconhecido ao carregar Notion');
        setFlashcards([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleStartStudy = (subset = null) => {
    setStudySubset(subset);
    setCurrentTab('study');
  };

  const handleUpdateCard = async (cardId, updates) => {
    // Optimistic update locally
    setFlashcards(prev => prev.map(c => c.id === cardId ? { ...c, ...updates } : c));
    if (studySubset) {
      setStudySubset(prev => prev.map(c => c.id === cardId ? { ...c, ...updates } : c));
    }
    // Persist to Notion
    await updateCardInNotion(cardId, updates);
  };

  return (
    <>
      {currentTab === 'dashboard' ? (
        <Dashboard 
          onStartStudy={handleStartStudy} 
          flashcards={flashcards} 
          isLoading={isLoading} 
          fetchError={fetchError}
        />
      ) : (
        <StudyInterface 
          onExit={() => setCurrentTab('dashboard')} 
          flashcards={studySubset || flashcards}
          onUpdateCard={handleUpdateCard}
        />
      )}
    </>
  )
}

export default App
