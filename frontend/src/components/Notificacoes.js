import React from 'react';
import { useApp } from '../contexts/AppContext';
import { T } from '../theme';

// Tipos de notificação com cor e ícone
const TIPOS = {
  erro:      { cor: T.roxo,    icone: '✗', label: 'ERRO'      },
  acerto:    { cor: T.verde,   icone: '✓', label: 'ACERTO'    },
  checkpoint:{ cor: T.amber,   icone: '📍', label: 'CHECKPOINT' },
  lideranca: { cor: '#F0BD2B', icone: '🏆', label: 'LIDERANÇA' },
  fim:       { cor: T.verde,   icone: '🏁', label: 'FIM'       },
};

function detectarTipo(msg) {
  if (msg.includes('errou'))      return 'erro';
  if (msg.includes('finalizou'))  return 'fim';
  if (msg.includes('liderança') || msg.includes('lideranca')) return 'lideranca';
  if (msg.includes('acertou'))    return 'acerto';
  if (msg.includes('checkpoint') || msg.includes('chegou')) return 'checkpoint';
  return 'checkpoint';
}

export default function Notificacoes() {
  const { notificacoes } = useApp();
  return (
    <div style={s.container}>
      {notificacoes.map(n => {
        const tipo = TIPOS[detectarTipo(n.msg)];
        return (
          <div key={n.id} style={{ ...s.toast, borderLeft: `3px solid ${tipo.cor}` }}>
            <div style={{ ...s.icone, color: tipo.cor }}>{tipo.icone}</div>
            <div style={{ flex: 1 }}>
              <p style={{ ...s.tipoLabel, color: tipo.cor }}>{tipo.label}</p>
              <p style={s.msg}>{n.msg}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const s = {
  container: {
    position: 'fixed', top: 16, right: 16, zIndex: 9999,
    display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320,
  },
  toast: {
    background: T.surface,
    border: `0.5px solid ${T.border}`,
    color: T.textPrim,
    padding: '12px 14px',
    borderRadius: 14,
    fontSize: 13,
    lineHeight: 1.4,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
  },
  icone: { fontSize: 16, flexShrink: 0, marginTop: 1 },
  tipoLabel: { fontSize: 9, fontWeight: 700, letterSpacing: 1.5, margin: '0 0 2px', textTransform: 'uppercase' },
  msg: { margin: 0, color: T.textPrim, fontSize: 13, lineHeight: 1.45 },
};
