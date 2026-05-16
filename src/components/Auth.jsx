import React, { useState } from 'react';
import { supabase } from '../services/supabaseService';
import { LogIn, UserPlus, Mail, Lock } from 'lucide-react';
import './Auth.css';

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login'); // 'login' or 'signup'

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Confirme seu email para ativar a conta!');
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-bg-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>

      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <LogIn className="text-white" size={32} />
          </div>
          <h1 className="auth-title">Cards AI</h1>
          <p className="auth-subtitle">
            {mode === 'login' ? 'Bem-vindo de volta ao seu centro de estudos' : 'Crie sua conta para começar a estudar'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="auth-form">
          <div className="input-group">
            <label className="input-label">Email</label>
            <div className="input-wrapper">
              <Mail className="input-icon" size={18} />
              <input 
                type="email" 
                required
                placeholder="seu@email.com"
                className="auth-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Senha</label>
            <div className="input-wrapper">
              <Lock className="input-icon" size={18} />
              <input 
                type="password" 
                required
                placeholder="••••••••"
                className="auth-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="auth-submit-btn"
          >
            {loading ? 'Processando...' : (mode === 'login' ? 'Entrar' : 'Cadastrar')}
          </button>
        </form>

        <div className="auth-footer">
          <button 
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="switch-mode-btn"
          >
            {mode === 'login' ? (
              <span>Ainda não tem conta? <span>Cadastre-se</span></span>
            ) : (
              <span>Já tem uma conta? <span>Fazer login</span></span>
            )}
          </button>
        </div>
        
        <p className="auth-disclaimer">
          Protegido por Supabase Auth & Criptografia de Ponta a Ponta
        </p>
      </div>
    </div>
  );
};

export default Auth;
