import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../contexts/AppContext';
import { T, LogoSVG } from '../theme';

const TABS = ['Controle', 'Equipes', 'Checkpoints', 'Perguntas'];

export default function PainelOrganizador() {
  const { API, socket, logout } = useApp();
  const [tab, setTab] = useState('Controle');
  const [equipes, setEquipes] = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
  const [perguntas, setPerguntas] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [jogoStatus, setJogoStatus] = useState({ iniciado: false });
  const [novaEquipe, setNovaEquipe] = useState({ nome: '', senha: '' });
  const [novoCp, setNovoCp] = useState({ nome: '', imagemMapa: null, imagemPreview: null, dica: '', codigoLocal: '', ultimo: false });
  const [novaPerg, setNovaPerg] = useState({
    enunciado: '',
    alternativas: ['', '', '', ''],
    explicacoes: ['', '', '', ''],
    correta: 0
  });

  const fmt = (s) => { if (!s && s !== 0) return '--:--'; return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`; };

  const fetchAll = useCallback(async () => {
    const [eq, cp, pe, st] = await Promise.all([
      fetch(`${API}/api/org/equipes`).then(r => r.json()),
      fetch(`${API}/api/org/checkpoints`).then(r => r.json()),
      fetch(`${API}/api/org/perguntas`).then(r => r.json()),
      fetch(`${API}/api/status`).then(r => r.json()),
    ]);
    setEquipes(eq); setCheckpoints(cp); setPerguntas(pe); setJogoStatus(st);
  }, [API]);

  const fetchRanking = useCallback(async () => {
    const r = await fetch(`${API}/api/org/ranking`).then(res => res.json());
    setRanking(r);
  }, [API]);

  useEffect(() => { fetchAll(); fetchRanking(); }, [fetchAll, fetchRanking]);

  useEffect(() => {
    if (!socket) return;
    socket.on('ranking_update', r => setRanking(r));
    socket.on('equipe_checkpoint', ({ nome, checkpoint, numero }) => addNotif(`${nome} chegou ao checkpoint ${numero} (${checkpoint})`));
    socket.on('equipe_chegou', ({ nome, posicao, tempoFinal }) => addNotif(`${nome} finalizou! Posicao ${posicao}o - ${fmt(tempoFinal)}`));
    return () => { socket.off('ranking_update'); socket.off('equipe_checkpoint'); socket.off('equipe_chegou'); };
  }, [socket]);

  const addNotif = (msg) => {
    const id = Date.now();
    setNotifs(n => [{ id, msg, ts: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }, ...n].slice(0, 50));
  };

  const criarEquipe = async () => {
    if (!novaEquipe.nome || !novaEquipe.senha) return;
    await fetch(`${API}/api/org/equipes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(novaEquipe) });
    setNovaEquipe({ nome: '', senha: '' }); fetchAll();
  };
  const deletarEquipe = async (codigo) => { await fetch(`${API}/api/org/equipes/${codigo}`, { method: 'DELETE' }); fetchAll(); };

  const criarCp = async () => {
    if (!novoCp.nome || !novoCp.codigoLocal) return;
    let imagemUrl = null;
    if (novoCp.imagemMapa) {
      const reader = new FileReader();
      const base64 = await new Promise(resolve => {
        reader.onload = e => resolve(e.target.result.split(',')[1]);
        reader.readAsDataURL(novoCp.imagemMapa);
      });
      const uploadRes = await fetch(`${API}/api/org/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novoCp.imagemMapa.name, base64, tipo: novoCp.imagemMapa.type })
      });
      const uploadData = await uploadRes.json();
      imagemUrl = uploadData.url || null;
    }
    const payload = { nome: novoCp.nome, imagemUrl, dica: novoCp.dica, codigoLocal: novoCp.codigoLocal, ultimo: novoCp.ultimo };
    await fetch(`${API}/api/org/checkpoints`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setNovoCp({ nome: '', imagemMapa: null, imagemPreview: null, dica: '', codigoLocal: '', ultimo: false }); fetchAll();
  };
  const deletarCp = async (id) => { await fetch(`${API}/api/org/checkpoints/${id}`, { method: 'DELETE' }); fetchAll(); };

  const criarPerg = async () => {
    if (!novaPerg.enunciado || novaPerg.alternativas.some(a => !a)) return;
    await fetch(`${API}/api/org/perguntas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(novaPerg) });
    setNovaPerg({ enunciado: '', alternativas: ['', '', '', ''], explicacoes: ['', '', '', ''], correta: 0 }); fetchAll();
  };
  const deletarPerg = async (id) => { await fetch(`${API}/api/org/perguntas/${id}`, { method: 'DELETE' }); fetchAll(); };

  const iniciarJogo = async () => {
    const res = await fetch(`${API}/api/org/iniciar`, { method: 'POST' });
    const data = await res.json();
    if (data.erro) { alert(data.erro); return; }
    fetchAll();
  };

  const resetarJogo = async () => {
    if (!window.confirm('Resetar o jogo? Todos os progressos serao perdidos.')) return;
    await fetch(`${API}/api/org/reset`, { method: 'POST' });
    fetchAll(); fetchRanking();
  };

  return (
    <div style={s.container}>
      <div style={s.topbar}>
        <LogoSVG width={120} />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ ...s.badge, background: jogoStatus.iniciado ? 'rgba(184,228,54,0.15)' : 'rgba(255,255,255,0.05)', color: jogoStatus.iniciado ? T.verde : T.textMuted, border: `0.5px solid ${jogoStatus.iniciado ? T.verde : T.border}` }}>
            {jogoStatus.iniciado ? 'AO VIVO' : 'AGUARDANDO'}
          </div>
          <button style={s.logoutBtn} onClick={logout}>Sair</button>
        </div>
      </div>

      <div style={{ height: 2, background: T.gradFull }} />

      <div style={s.tabs}>
        {TABS.map(t => (
          <button key={t} style={{ ...s.tab, color: tab === t ? T.amber : T.textMuted, borderBottom: `2px solid ${tab === t ? T.amber : 'transparent'}` }} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      <div style={s.content}>

        {tab === 'Controle' && (
          <div>
            {!jogoStatus.iniciado ? (
              <button style={s.btnIniciar} onClick={iniciarJogo}>Iniciar Corrida</button>
            ) : (
              <button style={{ ...s.btnIniciar, background: 'rgba(130,73,178,0.2)', color: T.roxo, border: `1px solid ${T.roxo}` }} onClick={resetarJogo}>
                Resetar Jogo
              </button>
            )}
            <p style={s.secLabel}>Ranking ao vivo</p>
            {ranking.length === 0 ? (
              <p style={s.empty}>Aguardando inicio do jogo...</p>
            ) : ranking.map((e, i) => (
              <div key={i} style={s.rankItem}>
                <span style={{ ...s.rankPos, color: i === 0 ? T.amber : i === 1 ? '#aaa' : i === 2 ? '#cd7f32' : T.textMuted }}>{e.posicao}o</span>
                <div style={{ flex: 1 }}>
                  <p style={s.rankNome}>{e.nome}</p>
                  <p style={s.rankInfo}>{e.terminado ? `Finalizado - ${fmt(e.tempoFinal)}` : `Checkpoint ${e.checkpointAtual}/${e.totalCheckpoints} - ${fmt(e.tempoAtual)}`}</p>
                </div>
                {e.terminado && <span style={{ color: T.verde, fontSize: 13, fontWeight: 700 }}>FIM</span>}
              </div>
            ))}
            <p style={{ ...s.secLabel, marginTop: 28 }}>Notificacoes</p>
            {notifs.length === 0 ? <p style={s.empty}>Nenhuma ainda.</p> : notifs.map(n => (
              <div key={n.id} style={s.notifItem}>
                <span style={{ color: T.textMuted, fontSize: 11, minWidth: 38 }}>{n.ts}</span>
                <span style={{ color: T.textSec, fontSize: 13 }}>{n.msg}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'Equipes' && (
          <div>
            <div style={s.formBox}>
              <p style={s.secLabel}>Nova equipe</p>
              <input style={s.input} placeholder="Nome da equipe" value={novaEquipe.nome} onChange={e => setNovaEquipe(p => ({ ...p, nome: e.target.value }))} />
              <input style={s.input} placeholder="Senha (use o mesmo codigo)" value={novaEquipe.senha} onChange={e => setNovaEquipe(p => ({ ...p, senha: e.target.value }))} />
              <button style={s.btnAdd} onClick={criarEquipe}>+ Adicionar equipe</button>
            </div>
            <p style={s.secLabel}>Equipes cadastradas ({equipes.length})</p>
            {equipes.map(e => (
              <div key={e.codigo} style={s.listItem}>
                <div>
                  <p style={s.listTitle}>{e.nome}</p>
                  <p style={s.listSub}>Codigo: <span style={{ color: T.amber }}>{e.codigo}</span> &nbsp; Senha: {e.senha}</p>
                </div>
                <button style={s.btnDel} onClick={() => deletarEquipe(e.codigo)}>x</button>
              </div>
            ))}
          </div>
        )}

        {tab === 'Checkpoints' && (
          <div>
            <div style={s.formBox}>
              <p style={s.secLabel}>Novo checkpoint</p>
              <input style={s.input} placeholder="Nome do local" value={novoCp.nome} onChange={e => setNovoCp(p => ({ ...p, nome: e.target.value }))} />

              {/* Upload imagem do mapa */}
              <div>
                <p style={{ color: T.textSec, fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 6px' }}>Imagem do mapa</p>
                <label style={s.uploadArea}>
                  {novoCp.imagemPreview ? (
                    <img src={novoCp.imagemPreview} alt="mapa" style={{ width: '100%', borderRadius: 8, objectFit: 'cover', maxHeight: 180 }} />
                  ) : (
                    <div style={{ textAlign: 'center', color: T.textMuted }}>
                      <div style={{ fontSize: 28, marginBottom: 6 }}>🗺️</div>
                      <p style={{ margin: 0, fontSize: 13 }}>Clique para adicionar foto do mapa</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = ev => setNovoCp(p => ({ ...p, imagemMapa: file, imagemPreview: ev.target.result }));
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
                {novoCp.imagemPreview && (
                  <button
                    style={{ ...s.btnDel, marginTop: 6, fontSize: 11 }}
                    onClick={() => setNovoCp(p => ({ ...p, imagemMapa: null, imagemPreview: null }))}
                  >
                    Remover imagem
                  </button>
                )}
              </div>

              {/* Dica */}
              <div>
                <p style={{ color: T.textSec, fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 6px' }}>Dica para encontrar o codigo</p>
                <textarea
                  style={{ ...s.input, height: 70, resize: 'vertical' }}
                  placeholder="Ex: O codigo esta embaixo do banco de pedra perto da fonte"
                  value={novoCp.dica}
                  onChange={e => setNovoCp(p => ({ ...p, dica: e.target.value }))}
                />
              </div>

              <input style={s.input} placeholder="Codigo secreto (ex: WONKA01)" value={novoCp.codigoLocal} onChange={e => setNovoCp(p => ({ ...p, codigoLocal: e.target.value.toUpperCase() }))} />

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.textSec, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={novoCp.ultimo} onChange={e => setNovoCp(p => ({ ...p, ultimo: e.target.checked }))} style={{ accentColor: T.amber }} />
                <span>Este e o checkpoint <span style={{ color: T.amber }}>FINAL</span> (igual para todos)</span>
              </label>
              <button style={s.btnAdd} onClick={criarCp}>+ Adicionar checkpoint</button>
            </div>

            <p style={s.secLabel}>Checkpoints cadastrados ({checkpoints.length})</p>
            {checkpoints.map(cp => (
              <div key={cp.id} style={s.listItem}>
                <div style={{ flex: 1 }}>
                  {cp.imagemUrl && (
                    <img src={cp.imagemUrl} alt="mapa" style={{ width: '100%', borderRadius: 8, marginBottom: 8, maxHeight: 120, objectFit: 'cover' }} />
                  )}
                  <p style={s.listTitle}>{cp.nome} {cp.ultimo && <span style={{ background: T.amber, color: T.bg, fontSize: 10, padding: '2px 8px', borderRadius: 20, marginLeft: 8, fontWeight: 700 }}>FINAL</span>}</p>
                  {cp.dica && <p style={{ ...s.listSub, color: T.amber }}>Dica: {cp.dica}</p>}
                  <p style={s.listSub}>Codigo: <span style={{ color: T.verde }}>{cp.codigoLocal}</span></p>
                </div>
                <button style={s.btnDel} onClick={() => deletarCp(cp.id)}>x</button>
              </div>
            ))}
          </div>
        )}

        {tab === 'Perguntas' && (
          <div>
            <div style={s.formBox}>
              <p style={s.secLabel}>Nova pergunta</p>
              <textarea
                style={{ ...s.input, height: 80, resize: 'vertical' }}
                placeholder="Enunciado da pergunta"
                value={novaPerg.enunciado}
                onChange={e => setNovaPerg(p => ({ ...p, enunciado: e.target.value }))}
              />

              {novaPerg.alternativas.map((alt, i) => (
                <div key={i} style={s.altRow}>
                  {/* Radio de correta */}
                  <input
                    type="radio"
                    name="correta"
                    checked={novaPerg.correta === i}
                    onChange={() => setNovaPerg(p => ({ ...p, correta: i }))}
                    style={{ accentColor: T.verde, flexShrink: 0, marginTop: 4 }}
                  />
                  <div style={s.altFields}>
                    {/* Texto da alternativa */}
                    <input
                      style={s.input}
                      placeholder={`Alternativa ${'ABCD'[i]}`}
                      value={alt}
                      onChange={e => {
                        const a = [...novaPerg.alternativas];
                        a[i] = e.target.value;
                        setNovaPerg(p => ({ ...p, alternativas: a }));
                      }}
                    />
                    {/* Explicação — só para alternativas erradas */}
                    {novaPerg.correta !== i && (
                      <input
                        style={{ ...s.input, fontSize: 12, padding: '8px 12px', color: T.textSec }}
                        placeholder={`Explicação se errar a ${'ABCD'[i]} (opcional)`}
                        value={novaPerg.explicacoes[i]}
                        onChange={e => {
                          const ex = [...novaPerg.explicacoes];
                          ex[i] = e.target.value;
                          setNovaPerg(p => ({ ...p, explicacoes: ex }));
                        }}
                      />
                    )}
                  </div>
                </div>
              ))}

              <p style={{ color: T.textMuted, fontSize: 12, margin: 0 }}>
                Selecione o radio da alternativa correta. Preencha a explicação das erradas.
              </p>
              <button style={s.btnAdd} onClick={criarPerg}>+ Adicionar pergunta</button>
            </div>

            <p style={s.secLabel}>Banco de perguntas ({perguntas.length})</p>
            {perguntas.map((p, idx) => (
              <div key={p.id} style={s.listItem}>
                <div style={{ flex: 1 }}>
                  <p style={s.listTitle}>P{idx + 1}: {p.enunciado}</p>
                  {p.alternativas.map((alt, i) => (
                    <div key={i}>
                      <p style={{ ...s.listSub, color: i === p.correta ? T.verde : T.textMuted }}>
                        {'ABCD'[i]}. {alt} {i === p.correta ? '✓' : ''}
                      </p>
                      {i !== p.correta && p.explicacoes?.[i] && (
                        <p style={{ ...s.listSub, color: T.roxo, paddingLeft: 14, fontSize: 11 }}>
                          → {p.explicacoes[i]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <button style={s.btnDel} onClick={() => deletarPerg(p.id)}>x</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  container: { minHeight: '100vh', background: T.bg, color: T.textPrim },
  topbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: T.surface },
  badge: { padding: '4px 12px', borderRadius: 20, fontSize: 10, fontWeight: 700, letterSpacing: 1.5 },
  logoutBtn: { background: 'transparent', border: `0.5px solid ${T.border}`, color: T.textMuted, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12 },
  tabs: { display: 'flex', background: T.surface, borderBottom: `0.5px solid ${T.border}` },
  tab: { flex: 1, padding: '14px 8px', background: 'transparent', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: 0.5, transition: 'all 0.2s' },
  content: { padding: 20, maxWidth: 560, margin: '0 auto' },
  secLabel: { color: T.textMuted, fontSize: 10, letterSpacing: 3, marginBottom: 12, textTransform: 'uppercase', marginTop: 0 },
  empty: { color: T.border, fontSize: 13, textAlign: 'center', padding: 24 },
  formBox: { background: T.surface, borderRadius: 16, padding: 20, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 10, border: `0.5px solid ${T.border}` },
  input: { background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, color: T.textPrim, fontSize: 14, padding: '12px 14px', outline: 'none', width: '100%', boxSizing: 'border-box' },
  btnAdd: { background: T.gradLogo, color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  listItem: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 0', borderBottom: `0.5px solid ${T.border}` },
  listTitle: { color: T.textPrim, fontWeight: 600, margin: '0 0 4px', fontSize: 14 },
  listSub: { color: T.textMuted, fontSize: 12, margin: '2px 0' },
  btnDel: { background: 'transparent', border: `0.5px solid ${T.border}`, color: T.textMuted, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12, flexShrink: 0 },
  rankItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `0.5px solid ${T.border}` },
  rankPos: { fontWeight: 900, fontSize: 20, minWidth: 28 },
  rankNome: { color: T.textPrim, fontWeight: 600, margin: 0, fontSize: 14 },
  rankInfo: { color: T.textMuted, fontSize: 12, margin: 0 },
  notifItem: { display: 'flex', gap: 12, padding: '8px 0', borderBottom: `0.5px solid ${T.surface2}`, alignItems: 'flex-start' },
  btnIniciar: { width: '100%', background: T.gradFull, color: '#fff', border: 'none', borderRadius: 16, padding: '18px', fontSize: 17, fontWeight: 900, cursor: 'pointer', letterSpacing: 1, marginBottom: 28 },
  uploadArea: { display: 'block', background: T.surface2, border: `1px dashed ${T.border}`, borderRadius: 12, padding: 16, cursor: 'pointer', minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  altRow: { display: 'flex', gap: 8, alignItems: 'flex-start' },
  altFields: { display: 'flex', flexDirection: 'column', gap: 6, flex: 1 },
};
