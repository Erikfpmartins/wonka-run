import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { T, LogoSVG } from '../theme';
import { Sino } from '../components/Notificacoes';

export default function TelaEquipe() {
  const { user, socket, jogoIniciado, addNotificacao, API } = useApp();
  const [estado, setEstado] = useState(null);
  const [tempo, setTempo] = useState(0);
  const [aguardando, setAguardando] = useState(false);
  const [contagemPenalidade, setContagemPenalidade] = useState(0);
  const [codigoLocal, setCodigoLocal] = useState('');
  const [erroCheckpoint, setErroCheckpoint] = useState('');
  const [terminado, setTerminado] = useState(false);
  const [ranking, setRanking] = useState([]);
  // helper seguro para evitar undefined.map
  const safeRanking = Array.isArray(ranking) ? ranking : [];
  const [respostaSelecionada, setRespostaSelecionada] = useState(null);
  const [explicacaoErro, setExplicacaoErro] = useState("");
  const [resultadoResposta, setResultadoResposta] = useState(null);
  const timerRef = useRef(null);
  const syncRef = useRef(null);

  const fmt = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  const fetchEstado = useCallback(async () => {
    const res = await fetch(`${API}/api/equipe/${user.codigo}/estado`);
    const data = await res.json();
    setEstado(data);
    if (data.terminado) { setTerminado(true); clearInterval(timerRef.current); }
  }, [API, user.codigo]);

  useEffect(() => {
    if (!jogoIniciado || terminado) return;
    syncRef.current = setInterval(async () => {
      await fetch(`${API}/api/equipe/${user.codigo}/tempo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tempo }) });
    }, 5000);
    return () => clearInterval(syncRef.current);
  }, [jogoIniciado, tempo, terminado, API, user.codigo]);

  useEffect(() => {
    if (!jogoIniciado || terminado) return;
    timerRef.current = setInterval(() => setTempo(t => t + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [jogoIniciado, terminado]);

  useEffect(() => { fetchEstado(); }, [fetchEstado, jogoIniciado]);

  // Quando jogo iniciar, busca estado imediatamente
  useEffect(() => {
    if (!socket) return;
    const onInicio = () => fetchEstado();
    socket.on("jogo_iniciado", onInicio);
    return () => socket.off("jogo_iniciado", onInicio);
  }, [socket, fetchEstado]);

  useEffect(() => {
    if (!socket) return;
    socket.on('equipe_checkpoint', ({ nome, numero }) => addNotificacao(`${nome} chegou ao checkpoint ${numero}`));
    socket.on('equipe_chegou', ({ nome, posicao }) => addNotificacao(`${nome} finalizou! Posicao ${posicao}o`));
    socket.on('ranking_update', (r) => setRanking(Array.isArray(r) ? r : []));
    return () => { socket.off('equipe_checkpoint'); socket.off('equipe_chegou'); socket.off('ranking_update'); };
  }, [socket, addNotificacao]);

  const responder = async (idx) => {
    if (respostaSelecionada !== null) return;
    setRespostaSelecionada(idx);
    const res = await fetch(`${API}/api/equipe/${user.codigo}/responder`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resposta: idx }) });
    const data = await res.json();
    if (data.correta) {
      setResultadoResposta('correta');
      setTempo(t => Math.max(0, t - data.bonus));
      setTimeout(async () => { setRespostaSelecionada(null); setResultadoResposta(null); await fetchEstado(); }, 1500);
    } else {
      setResultadoResposta('errada');
      setAguardando(true);
      setContagemPenalidade(60);
      // Busca explicação da alternativa errada escolhida
      const explicacoes = estado?.perguntaAtual?.explicacoes;
      setExplicacaoErro(explicacoes && explicacoes[idx] ? explicacoes[idx] : '');
      const iv = setInterval(() => {
        setContagemPenalidade(c => {
          if (c <= 1) { clearInterval(iv); setAguardando(false); setRespostaSelecionada(null); setResultadoResposta(null); setExplicacaoErro(''); fetchEstado(); return 0; }
          return c - 1;
        });
      }, 1000);
    }
  };

  const enviarCodigo = async () => {
    setErroCheckpoint('');
    const res = await fetch(`${API}/api/equipe/${user.codigo}/checkpoint`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigoDigitado: codigoLocal, tempoAtual: tempo }) });
    const data = await res.json();
    if (!data.ok) { setErroCheckpoint(data.erro || 'Codigo incorreto'); return; }
    setCodigoLocal('');
    if (data.terminado) { setTerminado(true); clearInterval(timerRef.current); }
    await fetchEstado();
  };

  // Tela de espera
  if (!jogoIniciado && !terminado) {
    return (
      <div style={s.container}>
        <div style={s.glow} />
        <div style={{ textAlign: 'center', zIndex: 1 }}>
          <LogoSVG width={200} />
          <div style={s.esperaCard}>
            <div style={s.pulseRing} />
            <p style={s.esperaTitle}>Aguardando inicio</p>
            <p style={s.esperaSub}>Equipe <span style={{ color: T.amber }}>{user.nome}</span></p>
            <p style={{ ...s.esperaSub, marginTop: 8 }}>O organizador vai liberar em breve.</p>
          </div>
        </div>
      </div>
    );
  }

  // Tela de conclusão
  if (terminado) {
    return (
      <div style={{ ...s.container, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ ...s.glow, background: 'radial-gradient(circle, rgba(240,189,43,0.12) 0%, transparent 70%)' }} />
        <div style={{ width: '100%', maxWidth: 420, padding: 24, zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={s.trofeu}>🏁</div>
            <p style={s.conclusaoTitle}>Chegamos!</p>
            <p style={s.conclusaoTempo}>Tempo final: <span style={{ color: T.amber }}>{fmt(estado?.tempoFinal || tempo)}</span></p>
          </div>
          {safeRanking.length > 0 && (
            <div>
              <p style={s.rankLabel}>Ranking</p>
              {safeRanking.map((e, i) => (
                <div key={i} style={{ ...s.rankItem, background: e.nome === user.nome ? 'rgba(130,73,178,0.15)' : T.surface, borderColor: e.nome === user.nome ? T.roxo : T.border }}>
                  <span style={{ ...s.rankPos, color: i === 0 ? T.amber : i === 1 ? '#aaa' : i === 2 ? '#cd7f32' : T.textMuted }}>{e.posicao}o</span>
                  <div style={{ flex: 1 }}>
                    <p style={s.rankNome}>{e.nome}</p>
                    <p style={s.rankInfo}>{e.terminado ? `Tempo: ${fmt(e.tempoFinal)}` : `Checkpoint ${e.checkpointAtual}/${e.totalCheckpoints}`}</p>
                  </div>
                  {e.terminado && <span style={{ fontSize: 16 }}>🏁</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <p style={s.headerLabel}>Equipe</p>
          <p style={s.headerNome}>{user.nome}</p>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div>
            <p style={s.headerLabel}>Tempo</p>
            <p style={s.headerTempo}>{fmt(tempo)}</p>
          </div>
          <Sino />
        </div>
      </div>

      {/* Barra gradiente */}
      <div style={{ height: 2, background: T.gradFull }} />

      {/* Progress dots */}
      {estado && (
        <div style={s.progressBar}>
          {Array.from({ length: estado.totalCheckpoints }).map((_, i) => (
            <div key={i} style={{ ...s.dot, background: i < estado.checkpointAtual ? T.verde : i === estado.checkpointAtual ? T.amber : T.border, boxShadow: i === estado.checkpointAtual ? `0 0 8px ${T.amber}` : 'none' }} />
          ))}
        </div>
      )}

      <div style={s.content}>
        {/* Pergunta */}
        {estado?.aguardandoPergunta && estado.perguntaAtual && (
          <div>
            <p style={s.sectionLabel}>Pergunta</p>
            <p style={s.perguntaTexto}>{estado.perguntaAtual.enunciado}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {estado.perguntaAtual.alternativas.map((alt, i) => {
                let bg = T.surface2;
                let border = T.border;
                let textColor = T.textPrim;
                if (respostaSelecionada === i) {
                  bg = resultadoResposta === 'correta' ? 'rgba(184,228,54,0.1)' : 'rgba(130,73,178,0.15)';
                  border = resultadoResposta === 'correta' ? T.verde : T.roxo;
                }
                return (
                  <button key={i} onClick={() => responder(i)} disabled={respostaSelecionada !== null}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 14, border: `1.5px solid ${border}`, background: bg, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}>
                    <span style={{ color: T.amber, fontWeight: 700, fontSize: 13, minWidth: 20 }}>{'ABCD'[i]}</span>
                    <span style={{ color: textColor, fontSize: 15 }}>{alt}</span>
                  </button>
                );
              })}
            </div>

            {aguardando && (
              <div style={s.penalidadeBox}>
                <p style={{ color: T.roxo, fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>Resposta errada!</p>
                {explicacaoErro ? (
                  <p style={{ color: T.textPrim, fontSize: 14, margin: '0 0 12px', lineHeight: 1.5, background: 'rgba(130,73,178,0.1)', borderRadius: 10, padding: '10px 14px' }}>
                    {explicacaoErro}
                  </p>
                ) : null}
                <p style={{ color: T.textSec, margin: 0, fontSize: 14 }}>
                  Aguarde <span style={{ color: T.textPrim, fontWeight: 700 }}>{contagemPenalidade}s</span> para continuar
                </p>
                <div style={{ height: 4, background: T.border, borderRadius: 2, marginTop: 16, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: T.gradLogo, width: `${(contagemPenalidade / 60) * 100}%`, transition: 'width 1s linear', borderRadius: 2 }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Checkpoint */}
        {estado?.aguardandoCheckpoint && estado.checkpoint && !aguardando && (
          <div>
            <p style={s.sectionLabel}>Proximo checkpoint</p>
            <p style={{ color: T.textPrim, fontSize: 20, fontWeight: 700, margin: '0 0 16px' }}>{estado.checkpoint.nome}</p>

            {/* Imagem do mapa */}
            {estado.checkpoint.imagemUrl && (
              <img
                src={estado.checkpoint.imagemUrl}
                alt="mapa do checkpoint"
                style={{ width: '100%', borderRadius: 14, marginBottom: 16, maxHeight: 240, objectFit: 'cover' }}
              />
            )}

            {/* Dica */}
            {estado.checkpoint.dica && (
              <div style={{ background: 'rgba(240,189,43,0.08)', border: `1px solid rgba(240,189,43,0.3)`, borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
                <p style={{ color: T.amber, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, margin: '0 0 4px', textTransform: 'uppercase' }}>Dica</p>
                <p style={{ color: T.textPrim, fontSize: 14, margin: 0, lineHeight: 1.5 }}>{estado.checkpoint.dica}</p>
              </div>
            )}

            <div style={s.codigoBox}>
              <p style={{ color: T.textSec, fontSize: 13, margin: '0 0 10px' }}>Chegou? Digite o codigo do local:</p>
              <input style={s.codigoInput} value={codigoLocal} onChange={e => setCodigoLocal(e.target.value.toUpperCase())} placeholder="Ex: WONKA01" maxLength={10} />
              {erroCheckpoint && <p style={{ color: T.amber, fontSize: 13, margin: '8px 0' }}>{erroCheckpoint}</p>}
              <button style={s.btnConfirmar} onClick={enviarCodigo}>Confirmar chegada</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  container: { minHeight: '100vh', background: T.bg, color: T.textPrim, position: 'relative', overflow: 'hidden' },
  glow: { position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(130,73,178,0.1) 0%, transparent 70%)', top: '-10%', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' },
  esperaCard: { background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 20, padding: '32px 28px', marginTop: 28, position: 'relative' },
  pulseRing: { width: 12, height: 12, borderRadius: '50%', background: T.verde, margin: '0 auto 20px', boxShadow: `0 0 0 0 ${T.verde}`, animation: 'pulse 1.5s infinite' },
  esperaTitle: { color: T.textPrim, fontSize: 20, fontWeight: 700, margin: '0 0 8px' },
  esperaSub: { color: T.textSec, margin: 0, fontSize: 14 },
  trofeu: { fontSize: 56, marginBottom: 12 },
  conclusaoTitle: { color: T.amber, fontSize: 28, fontWeight: 900, margin: '0 0 8px', letterSpacing: 1 },
  conclusaoTempo: { color: T.textSec, fontSize: 16, margin: '0 0 0' },
  rankLabel: { color: T.textMuted, fontSize: 10, letterSpacing: 3, marginBottom: 12, textTransform: 'uppercase' },
  rankItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, border: '1px solid', marginBottom: 8, transition: 'all 0.3s' },
  rankPos: { fontWeight: 900, fontSize: 18, minWidth: 28 },
  rankNome: { color: T.textPrim, fontWeight: 600, margin: 0, fontSize: 14 },
  rankInfo: { color: T.textMuted, margin: 0, fontSize: 12 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: T.surface },
  headerLabel: { color: T.textMuted, fontSize: 10, letterSpacing: 2, margin: 0, textTransform: 'uppercase' },
  headerNome: { color: T.textPrim, fontWeight: 700, fontSize: 15, margin: 0 },
  headerTempo: { color: T.amber, fontWeight: 900, fontSize: 28, margin: 0, fontVariantNumeric: 'tabular-nums' },
  progressBar: { display: 'flex', gap: 6, padding: '14px 20px', justifyContent: 'center', background: T.surface, borderBottom: `0.5px solid ${T.border}` },
  dot: { width: 8, height: 8, borderRadius: '50%', transition: 'all 0.3s' },
  content: { padding: 20 },
  sectionLabel: { color: T.textMuted, fontSize: 10, letterSpacing: 3, marginBottom: 12, textTransform: 'uppercase' },
  perguntaTexto: { color: T.textPrim, fontSize: 18, fontWeight: 600, lineHeight: 1.55, marginBottom: 24 },
  penalidadeBox: { marginTop: 24, background: 'rgba(130,73,178,0.08)', border: `1px solid rgba(130,73,178,0.3)`, borderRadius: 16, padding: 20 },
  btnMaps: { display: 'block', background: T.gradVerde, color: T.bg, textDecoration: 'none', padding: '14px 20px', borderRadius: 14, fontWeight: 700, fontSize: 15, textAlign: 'center', marginBottom: 20 },
  codigoBox: { background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 16, padding: 20 },
  codigoInput: { width: '100%', background: T.surface2, border: `1.5px solid ${T.border}`, borderRadius: 12, color: T.textPrim, fontSize: 22, padding: '14px', outline: 'none', textAlign: 'center', letterSpacing: 6, fontWeight: 700, boxSizing: 'border-box', marginBottom: 10 },
  btnConfirmar: { width: '100%', background: T.gradLogo, color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
};
