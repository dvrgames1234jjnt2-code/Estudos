import React, { useState, useEffect } from 'react';
import { supabase } from './services/supabaseService';
import Dashboard from './components/Dashboard';
import Auth from './components/Auth';
import StudyInterface from './components/StudyInterface';

function App() {
  const [session, setSession] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedDeck, setSelectedDeck] = useState(null);

  useEffect(() => {
    // Pegar sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Ouvir mudanças na autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleStartStudy = (deck) => {
    setSelectedDeck(deck);
    setCurrentView('study');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setSelectedDeck(null);
  };

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="app-container">
      {currentView === 'dashboard' ? (
        <Dashboard onStartStudy={handleStartStudy} />
      ) : (
        <StudyInterface 
          flashcards={selectedDeck} 
          onExit={handleBackToDashboard} 
        />
      )}
    </div>
  );
}

export default App;
