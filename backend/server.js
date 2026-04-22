const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend/build')));

// ─── SUPABASE ───
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://bxnbabvqqjgzbumkijwa.supabase.co',
  process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4bmJhYnZxcWpnemJ1bWtpandhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NjI0ODksImV4cCI6MjA5MjQzODQ4OX0.t0VX8VXLund1sIS9vBBl4-3HMzucdZSRLkJPZ6FnJNQ'
);

// ─── HELPERS ───
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getOrdem(checkpoints) {
  const final = checkpoints.find(c => c.ultimo);
  const outros = checkpoints.filter(c => !c.ultimo);
  return [...shuffle(outros), final].filter(Boolean);
}

function getPergunta(perguntas, usadas) {
  const disp = perguntas.filter(p => !usadas.includes(p.id));
  const pool = disp.length > 0 ? disp : perguntas;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function getRanking() {
  const { data: equipes } = await supabase.from('equipes').select('*');
  return [...(equipes || [])].sort((a, b) => {
    if (a.terminado && !b.terminado) return -1;
    if (!a.terminado && b.terminado) return 1;
    if (a.terminado && b.terminado) return a.tempo_final - b.tempo_final;
    if (b.checkpoint_atual !== a.checkpoint_atual) return b.checkpoint_atual - a.checkpoint_atual;
    return a.tempo_atual - b.tempo_atual;
  }).map((e, i) => ({
    posicao: i + 1,
    nome: e.nome,
    codigo: e.codigo,
    checkpointAtual: e.checkpoint_atual,
    totalCheckpoints: (e.ordem_checkpoints || []).length,
    tempoAtual: e.tempo_atual,
    tempoFinal: e.tempo_final,
    terminado: e.terminado
  }));
}

async function broadcastRanking() {
  const ranking = await getRanking();
  io.emit('ranking_update', ranking);
}

async function verificarLideranca(nomeEquipe) {
  const ranking = await getRanking();
  if (ranking.length > 0 && ranking[0].nome === nomeEquipe) {
    io.emit('notif_lideranca', { equipe: nomeEquipe });
  }
}

// ─── AUTH ───
app.post('/api/login', async (req, res) => {
  const { codigo, senha } = req.body;

  // Organizador
  const { data: org } = await supabase.from('organizador').select('*').eq('codigo', codigo).single();
  if (org && org.senha === senha) {
    return res.json({ tipo: 'organizador', token: 'org_' + uuidv4() });
  }

  // Equipe — senha igual ao código
  const { data: equipe } = await supabase.from('equipes').select('*').eq('codigo', codigo).single();
  if (equipe) {
    return res.json({ tipo: 'equipe', equipe: { codigo: equipe.codigo, nome: equipe.nome } });
  }

  return res.status(401).json({ erro: 'Codigo nao encontrado' });
});

// ─── STATUS ───
app.get('/api/status', async (req, res) => {
  const { data } = await supabase.from('jogo').select('*').eq('id', 1).single();
  res.json({ iniciado: data?.iniciado || false, encerrado: data?.encerrado || false });
});

// ─── EQUIPES ───
app.get('/api/org/equipes', async (req, res) => {
  const { data } = await supabase.from('equipes').select('codigo, nome, checkpoint_atual, terminado').order('created_at');
  res.json(data || []);
});

app.post('/api/org/equipes', async (req, res) => {
  const { nome } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatorio' });
  const codigo = 'EQ' + Math.random().toString(36).substr(2, 4).toUpperCase();
  const { data, error } = await supabase.from('equipes').insert({ codigo, nome }).select().single();
  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

app.delete('/api/org/equipes/:codigo', async (req, res) => {
  await supabase.from('equipes').delete().eq('codigo', req.params.codigo);
  res.json({ ok: true });
});

// ─── CHECKPOINTS ───
app.get('/api/org/checkpoints', async (req, res) => {
  const { data } = await supabase.from('checkpoints').select('*').order('created_at');
  res.json((data || []).map(c => ({
    id: c.id, nome: c.nome, dica: c.dica,
    imagemUrl: c.imagem_url, codigoLocal: c.codigo_local, ultimo: c.ultimo
  })));
});

app.post('/api/org/checkpoints', async (req, res) => {
  const { nome, imagemUrl, dica, codigoLocal, ultimo } = req.body;
  if (!nome || !codigoLocal) return res.status(400).json({ erro: 'Campos obrigatorios' });
  if (ultimo) await supabase.from('checkpoints').update({ ultimo: false }).neq('id', '00000000-0000-0000-0000-000000000000');
  const { data, error } = await supabase.from('checkpoints').insert({
    nome, imagem_url: imagemUrl || null, dica: dica || null,
    codigo_local: codigoLocal, ultimo: !!ultimo
  }).select().single();
  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ...data, imagemUrl: data.imagem_url, codigoLocal: data.codigo_local });
});

app.delete('/api/org/checkpoints/:id', async (req, res) => {
  await supabase.from('checkpoints').delete().eq('id', req.params.id);
  res.json({ ok: true });
});

// ─── UPLOAD IMAGEM (Supabase Storage) ───
app.post('/api/org/upload', async (req, res) => {
  const { nome, base64, tipo } = req.body;
  if (!base64 || !nome) return res.status(400).json({ erro: 'Dados invalidos' });
  const buffer = Buffer.from(base64, 'base64');
  const filename = `${Date.now()}_${nome}`;
  const { error } = await supabase.storage.from('mapas').upload(filename, buffer, { contentType: tipo || 'image/jpeg' });
  if (error) return res.status(500).json({ erro: error.message });
  const { data } = supabase.storage.from('mapas').getPublicUrl(filename);
  res.json({ url: data.publicUrl });
});

// ─── PERGUNTAS ───
app.get('/api/org/perguntas', async (req, res) => {
  const { data } = await supabase.from('perguntas').select('*').order('created_at');
  res.json(data || []);
});

app.post('/api/org/perguntas', async (req, res) => {
  const { enunciado, alternativas, explicacoes, correta } = req.body;
  if (!enunciado || !alternativas) return res.status(400).json({ erro: 'Campos obrigatorios' });
  const { data, error } = await supabase.from('perguntas').insert({
    enunciado, alternativas,
    explicacoes: explicacoes || ['', '', '', ''],
    correta
  }).select().single();
  if (error) return res.status(500).json({ erro: error.message });
  res.json(data);
});

app.delete('/api/org/perguntas/:id', async (req, res) => {
  await supabase.from('perguntas').delete().eq('id', req.params.id);
  res.json({ ok: true });
});

// ─── RANKING ───
app.get('/api/org/ranking', async (req, res) => {
  res.json(await getRanking());
});

// ─── INICIAR JOGO ───
app.post('/api/org/iniciar', async (req, res) => {
  const { data: checkpoints } = await supabase.from('checkpoints').select('*');
  const { data: perguntas } = await supabase.from('perguntas').select('*');
  const { data: equipes } = await supabase.from('equipes').select('*');

  if (!checkpoints || checkpoints.length < 2) return res.status(400).json({ erro: 'Precisa de ao menos 2 checkpoints' });
  if (!perguntas || perguntas.length < 1) return res.status(400).json({ erro: 'Precisa de ao menos 1 pergunta' });
  if (!checkpoints.find(c => c.ultimo)) return res.status(400).json({ erro: 'Defina o checkpoint final' });

  for (const equipe of (equipes || [])) {
    const ordem = getOrdem(checkpoints).map(c => c.id);
    const primeira = getPergunta(perguntas, []);
    await supabase.from('equipes').update({
      checkpoint_atual: 0,
      ordem_checkpoints: ordem,
      perguntas_usadas: primeira ? [primeira.id] : [],
      tempo_atual: 0,
      tempo_final: null,
      terminado: false,
      aguardando_checkpoint: false,
      aguardando_pergunta: true,
      pergunta_atual: primeira ? {
        id: primeira.id,
        enunciado: primeira.enunciado,
        alternativas: primeira.alternativas,
        explicacoes: primeira.explicacoes,
        correta: primeira.correta
      } : null
    }).eq('id', equipe.id);
  }

  await supabase.from('jogo').update({ iniciado: true, encerrado: false, iniciado_em: Date.now() }).eq('id', 1);
  io.emit('jogo_iniciado');
  res.json({ ok: true });
});

// ─── RESET ───
app.post('/api/org/reset', async (req, res) => {
  await supabase.from('jogo').update({ iniciado: false, encerrado: false, iniciado_em: null }).eq('id', 1);
  await supabase.from('equipes').update({
    checkpoint_atual: 0, ordem_checkpoints: [], perguntas_usadas: [],
    tempo_atual: 0, tempo_final: null, terminado: false,
    aguardando_checkpoint: false, aguardando_pergunta: true, pergunta_atual: null
  }).neq('codigo', '');
  io.emit('jogo_resetado');
  res.json({ ok: true });
});

// ─── ESTADO DA EQUIPE ───
app.get('/api/equipe/:codigo/estado', async (req, res) => {
  const { data: equipe } = await supabase.from('equipes').select('*').eq('codigo', req.params.codigo).single();
  if (!equipe) return res.status(404).json({ erro: 'Equipe nao encontrada' });
  const { data: jogo } = await supabase.from('jogo').select('*').eq('id', 1).single();
  const { data: checkpoints } = await supabase.from('checkpoints').select('*');
  const cpId = (equipe.ordem_checkpoints || [])[equipe.checkpoint_atual];
  const cp = checkpoints?.find(c => c.id === cpId);
  res.json({
    jogoIniciado: jogo?.iniciado || false,
    terminado: equipe.terminado,
    checkpointAtual: equipe.checkpoint_atual,
    totalCheckpoints: (equipe.ordem_checkpoints || []).length,
    aguardandoPergunta: equipe.aguardando_pergunta,
    aguardandoCheckpoint: equipe.aguardando_checkpoint,
    perguntaAtual: equipe.aguardando_pergunta && equipe.pergunta_atual ? {
      enunciado: equipe.pergunta_atual.enunciado,
      alternativas: equipe.pergunta_atual.alternativas,
      explicacoes: equipe.pergunta_atual.explicacoes
    } : null,
    checkpoint: equipe.aguardando_checkpoint && cp ? {
      nome: cp.nome, imagemUrl: cp.imagem_url, dica: cp.dica
    } : null,
    tempoAtual: equipe.tempo_atual,
    tempoFinal: equipe.tempo_final
  });
});

// ─── RESPONDER PERGUNTA ───
app.post('/api/equipe/:codigo/responder', async (req, res) => {
  const { resposta } = req.body;
  const { data: equipe } = await supabase.from('equipes').select('*').eq('codigo', req.params.codigo).single();
  if (!equipe || equipe.terminado) return res.status(400).json({ erro: 'Invalido' });

  const correta = equipe.pergunta_atual?.correta === resposta;

  if (correta) {
    await supabase.from('equipes').update({
      tempo_atual: Math.max(0, equipe.tempo_atual - 30),
      aguardando_pergunta: false,
      aguardando_checkpoint: true
    }).eq('codigo', req.params.codigo);

    io.emit('notif_acerto', { equipe: equipe.nome, checkpoint: equipe.checkpoint_atual + 1 });
    await verificarLideranca(equipe.nome);
    await broadcastRanking();
    return res.json({ correta: true, bonus: 30 });
  } else {
    io.emit('notif_erro', { equipe: equipe.nome });
    const explicacao = equipe.pergunta_atual?.explicacoes?.[resposta] || '';
    return res.json({ correta: false, aguardar: 30, explicacao });
  }
});

// ─── CONFIRMAR CHECKPOINT ───
app.post('/api/equipe/:codigo/checkpoint', async (req, res) => {
  const { codigoDigitado } = req.body;
  const { data: equipe } = await supabase.from('equipes').select('*').eq('codigo', req.params.codigo).single();
  if (!equipe || equipe.terminado) return res.status(400).json({ erro: 'Invalido' });

  const { data: checkpoints } = await supabase.from('checkpoints').select('*');
  const cpId = (equipe.ordem_checkpoints || [])[equipe.checkpoint_atual];
  const cp = checkpoints?.find(c => c.id === cpId);

  if (!cp || cp.codigo_local.toUpperCase() !== codigoDigitado.toUpperCase()) {
    return res.json({ ok: false, erro: 'Codigo incorreto' });
  }

  io.emit('notif_checkpoint', { equipe: equipe.nome, checkpoint: equipe.checkpoint_atual + 1 });

  if (cp.ultimo) {
    await supabase.from('equipes').update({
      terminado: true, tempo_final: equipe.tempo_atual,
      aguardando_checkpoint: false, aguardando_pergunta: false
    }).eq('codigo', req.params.codigo);

    const ranking = await getRanking();
    const pos = ranking.findIndex(e => e.codigo === req.params.codigo) + 1;
    io.emit('equipe_chegou', { nome: equipe.nome, posicao: pos, tempoFinal: equipe.tempo_atual });
    await broadcastRanking();
    return res.json({ ok: true, terminado: true });
  }

  const { data: perguntas } = await supabase.from('perguntas').select('*');
  const prox = getPergunta(perguntas, equipe.perguntas_usadas || []);
  await supabase.from('equipes').update({
    checkpoint_atual: equipe.checkpoint_atual + 1,
    pergunta_atual: prox ? {
      id: prox.id, enunciado: prox.enunciado,
      alternativas: prox.alternativas, explicacoes: prox.explicacoes, correta: prox.correta
    } : null,
    perguntas_usadas: [...(equipe.perguntas_usadas || []), prox?.id].filter(Boolean),
    aguardando_pergunta: true,
    aguardando_checkpoint: false
  }).eq('codigo', req.params.codigo);

  await verificarLideranca(equipe.nome);
  await broadcastRanking();
  return res.json({ ok: true, terminado: false });
});

// ─── TEMPO ───
app.post('/api/equipe/:codigo/tempo', async (req, res) => {
  const { tempo } = req.body;
  await supabase.from('equipes').update({ tempo_atual: tempo }).eq('codigo', req.params.codigo).eq('terminado', false);
  res.json({ ok: true });
});

// ─── SOCKET ───
io.on('connection', (socket) => {
  socket.on('join_org', () => socket.join('organizador'));
  socket.on('join_equipe', (codigo) => socket.join(`equipe_${codigo}`));
});

// ─── FALLBACK REACT ───
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
