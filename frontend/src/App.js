import React, { useState } from 'react';
import { AppProvider } from './contexts/AppContext';
import Login from './pages/Login';
import TelaEquipe from './pages/TelaEquipe';
import PainelOrganizador from './pages/PainelOrganizador';
import Notificacoes from './components/Notificacoes';

function AppInner() {
  const [tela, setTela] = useState('login');

  const handleLogin = (tipo) => {
    setTela(tipo === 'organizador' ? 'organizador' : 'equipe');
  };

  return (
    <>
      <Notificacoes />
      {tela === 'login' && <Login onLogin={handleLogin} />}
      {tela === 'equipe' && <TelaEquipe />}
      {tela === 'organizador' && <PainelOrganizador />}
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
