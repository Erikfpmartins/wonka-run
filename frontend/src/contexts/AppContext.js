import React, { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const AppContext = createContext();

const API = process.env.REACT_APP_API_URL ||
  (window.location.port === '3000'
    ? `${window.location.protocol}//${window.location.hostname}:3001`
    : window.location.origin);

export function formatarNotificacao(tipo, dados) {
  const { equipe, checkpoint } = dados;
  switch (tipo) {
    case 'erro':       return `${equipe} errou a pergunta e vai ter que esperar 1 minuto para continuar`;
    case 'acerto':     return `${equipe} acertou a pergunta e avança para o checkpoint ${checkpoint}`;
    case 'checkpoint': return `${equipe} chegou ao checkpoint ${checkpoint}`;
    case 'lideranca':  return `${equipe} assumiu a liderança LetzBora!`;
    case 'fim':        return `${equipe} finalizou a corrida!`;
    default:           return dados.msg || '';
  }
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const [jogoIniciado, setJogoIniciado] = useState(false);
  const [notificacoes, setNotificacoes] = useState([]);
  const [historico, setHistorico] = useState([]);

  useEffect(() => {
    const s = io(API);
    setSocket(s);
    s.on('jogo_iniciado', () => setJogoIniciado(true));
    s.on('jogo_resetado', () => setJogoIniciado(false));
    return () => s.disconnect();
  }, []);

  useEffect(() => {
    if (socket && user) {
      if (user.tipo === 'organizador') socket.emit('join_org');
      else socket.emit('join_equipe', user.codigo);
    }
  }, [socket, user]);

  useEffect(() => {
    if (!socket) return;
    socket.on('notif_erro',       (d) => addNotificacao(formatarNotificacao('erro', d)));
    socket.on('notif_acerto',     (d) => addNotificacao(formatarNotificacao('acerto', d)));
    socket.on('notif_checkpoint', (d) => addNotificacao(formatarNotificacao('checkpoint', d)));
    socket.on('notif_lideranca',  (d) => addNotificacao(formatarNotificacao('lideranca', d)));
    socket.on('equipe_chegou',    (d) => addNotificacao(formatarNotificacao('fim', { equipe: d.nome })));
    return () => {
      ['notif_erro','notif_acerto','notif_checkpoint','notif_lideranca','equipe_chegou'].forEach(e => socket.off(e));
    };
  }, [socket]);

  const addNotificacao = (msg) => {
    const id = Date.now() + Math.random();
    const notif = { id, msg };
    setHistorico(h => [notif, ...h]);
    setNotificacoes(n => [...n, notif]);
    setTimeout(() => setNotificacoes(n => n.filter(x => x.id !== id)), 6000);
  };

  const dispensarNotificacao = (id) => {
    setNotificacoes(n => n.filter(x => x.id !== id));
  };

  const login = async (codigo, senha) => {
    const res = await fetch(`${API}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo, senha })
    });
    if (!res.ok) throw new Error('Codigo ou senha incorretos');
    const data = await res.json();
    setUser({ tipo: data.tipo, codigo: data.equipe?.codigo, nome: data.equipe?.nome });
    return data.tipo;
  };

  const logout = () => setUser(null);

  return (
    <AppContext.Provider value={{ user, login, logout, socket, jogoIniciado, setJogoIniciado, notificacoes, historico, dispensarNotificacao, addNotificacao, API }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
