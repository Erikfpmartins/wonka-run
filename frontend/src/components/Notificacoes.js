import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { T } from '../theme';

const TIPOS = {
  erro:      { cor: T.roxo,    icone: '✗', label: 'ERRO'       },
  acerto:    { cor: T.verde,   icone: '✓', label: 'ACERTO'     },
  checkpoint:{ cor: T.amber,   icone: '📍', label: 'CHECKPOINT' },
  lideranca: { cor: '#F0BD2B', icone: '🏆', label: 'LIDERANÇA'  },
  fim:       { cor: T.verde,   icone: '🏁', label: 'FIM'        },
};

function detectarTipo(msg) {
  if (msg.includes('errou'))                                   return 'erro';
  if (msg.includes('finalizou'))                               return 'fim';
  if (msg.includes('liderança') || msg.includes('lideranca')) return 'lideranca';
  if (msg.includes('acertou'))                                 return 'acerto';
  return 'checkpoint';
}

function ToastItem({ n, onClose }) {
  const tipo = TIPOS[detectarTipo(n.msg)];
  return (
    <div style={{ ...s.toast, borderLeft: `3px solid ${tipo.cor}` }}>
      <div style={{ ...s.icone, color: tipo.cor }}>{tipo.icone}</div>
      <div style={{ flex: 1 }}>
        <p style={{ ...s.tipoLabel, color: tipo.cor }}>{tipo.label}</p>
        <p style={s.msg}>{n.msg}</p>
      </div>
      {onClose && (
        <button style={s.closeBtn} onClick={() => onClose(n.id)}>✕</button>
      )}
    </div>
  );
}

export function Sino() {
  const { historico } = useApp();
  const [aberto, setAberto] = useState(false);
  const total = historico.length;

  return (
    <>
      <button style={s.sinoBtn} onClick={() => setAberto(o => !o)}>
        🔔
        {total > 0 && <span style={s.badge}>{total > 99 ? '99+' : total}</span>}
      </button>

      {aberto && (
        <div style={s.painel}>
          <div style={s.painelHeader}>
            <p style={s.painelTitulo}>Notificações</p>
            <button style={s.fecharBtn} onClick={() => setAberto(false)}>✕</button>
          </div>
          <div style={s.painelLista}>
            {total === 0 && <p style={s.vazio}>Nenhuma notificação ainda</p>}
            {historico.map(n => <ToastItem key={n.id} n={n} />)}
          </div>
        </div>
      )}
      {aberto && <div style={s.overlay} onClick={() => setAberto(false)} />}
    </>
  );
}

export default function Notificacoes() {
  const { notificacoes, dispensarNotificacao } = useApp();
  const visiveis = notificacoes.slice(-2);
  return (
    <div style={s.container}>
      {visiveis.map(n => (
        <ToastItem key={n.id} n={n} onClose={dispensarNotificacao} />
      ))}
    </div>
  );
}

const s = {
  container: {
    position: 'fixed', top: 16, right: 16, zIndex: 9998,
    display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 300,
  },
  toast: {
    background: T.surface, border: `0.5px solid ${T.border}`,
    padding: '12px 14px', borderRadius: 14, fontSize: 13, lineHeight: 1.4,
    display: 'flex', alignItems: 'flex-start', gap: 10,
    boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
  },
  icone: { fontSize: 16, flexShrink: 0, marginTop: 1 },
  tipoLabel: { fontSize: 9, fontWeight: 700, letterSpacing: 1.5, margin: '0 0 2px', textTransform: 'uppercase' },
  msg: { margin: 0, color: T.textPrim, fontSize: 13, lineHeight: 1.45 },
  closeBtn: { background: 'transparent', border: 'none', color: T.textMuted, fontSize: 13, cursor: 'pointer', padding: '0 0 0 6px', flexShrink: 0 },
  sinoBtn: {
    position: 'relative', background: T.surface, border: `0.5px solid ${T.border}`,
    borderRadius: 12, width: 44, height: 44, fontSize: 20, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: -6, right: -6, background: T.roxo,
    color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: 10,
    padding: '2px 5px', minWidth: 16, textAlign: 'center',
  },
  painel: {
    position: 'fixed', top: 0, right: 0, width: 320, height: '100vh',
    background: T.surface, borderLeft: `0.5px solid ${T.border}`,
    zIndex: 10000, display: 'flex', flexDirection: 'column',
    boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
  },
  painelHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 20px', borderBottom: `0.5px solid ${T.border}`,
  },
  painelTitulo: { color: T.textPrim, fontWeight: 700, fontSize: 15, margin: 0 },
  fecharBtn: { background: 'transparent', border: 'none', color: T.textMuted, fontSize: 18, cursor: 'pointer' },
  painelLista: { flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 },
  vazio: { color: T.textMuted, fontSize: 13, textAlign: 'center', marginTop: 40 },
  overlay: { position: 'fixed', inset: 0, zIndex: 9999 },
};
