import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { T, LogoSVG, GradLine } from '../theme';

const ORG_CODE = 'org2025';

export default function Login({ onLogin }) {
  const { login } = useApp();
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const isOrg = codigo.trim().toLowerCase() === ORG_CODE;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      // Tanto org quanto equipe usam a mesma função login do contexto
      // Para equipe, senha = codigo (backend aceita qualquer equipe válida)
      const senhaFinal = isOrg ? senha.trim() : codigo.trim();
      const tipo = await login(codigo.trim(), senhaFinal);
      onLogin(tipo);
    } catch (err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.container}>
      <div style={s.glow} />
      <div style={s.card}>
        <div style={s.logoWrap}>
          <LogoSVG width={260} />
          <p style={s.tagline}>Letz x Um Doce Sol</p>
        </div>
        <GradLine />
        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Código</label>
            <input
              style={s.input}
              value={codigo}
              onChange={e => { setCodigo(e.target.value); setErro(''); }}
              placeholder="Digite seu código"
              autoCapitalize="none"
              autoCorrect="off"
              required
            />
          </div>

          {isOrg && (
            <div style={s.field}>
              <label style={s.label}>Senha</label>
              <input
                style={s.input}
                type="password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="Digite a senha"
                autoFocus
                required
              />
            </div>
          )}

          {erro && <p style={s.erro}>{erro}</p>}

          <button
            style={{ ...s.btn, opacity: loading ? 0.7 : 1 }}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

const s = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, padding: 20, position: 'relative', overflow: 'hidden' },
  glow: { position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(130,73,178,0.12) 0%, transparent 70%)', top: '0%', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' },
  card: { background: T.surface, borderRadius: 24, padding: '40px 32px', width: '100%', maxWidth: 380, border: `0.5px solid ${T.border}`, position: 'relative', zIndex: 1 },
  logoWrap: { textAlign: 'center', marginBottom: 20 },
  tagline: { color: T.textMuted, fontSize: 11, margin: '6px 0 0', letterSpacing: 3, textTransform: 'uppercase' },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { color: T.textSec, fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase' },
  input: { background: T.surface2, border: `1.5px solid ${T.border}`, borderRadius: 12, color: T.textPrim, fontSize: 16, padding: '14px 16px', outline: 'none', width: '100%', boxSizing: 'border-box' },
  erro: { color: T.amber, fontSize: 13, margin: 0, textAlign: 'center' },
  btn: { background: T.gradLogo, color: '#fff', border: 'none', borderRadius: 14, padding: '16px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 8, letterSpacing: 1 },
};
