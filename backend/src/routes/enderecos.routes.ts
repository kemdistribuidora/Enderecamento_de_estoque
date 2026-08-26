import { Router } from 'express';
import { db } from '../db/client';
import { EnderecoComStatus } from '../types';

export const enderecosRouter = Router();

// GET /api/enderecos -> lista flat de todos os enderecos com status (livre/ocupado) e
// produto ocupante. Usado pelo Cadastro pra montar o <select> de posicao livre; o mapa
// visual usa /api/mapa/:setorId (agrupado por prateleira, sem essa lista plana).
enderecosRouter.get('/', async (_req, res) => {
  const rs = await db.execute(`
    SELECT
      e.id, e.prateleira_id, e.corredor, e.lado, e.andar, e.posicao, e.codigo,
      ep.quantidade as quantidade,
      p.id as produto_id, p.codigo as produto_codigo, p.nome as produto_nome
    FROM enderecos e
    LEFT JOIN estoque_posicoes ep ON ep.endereco_id = e.id
    LEFT JOIN produtos p ON p.id = ep.produto_id
    ORDER BY e.corredor, e.lado, e.andar, e.posicao
  `);

  const resultado: EnderecoComStatus[] = (rs.rows as any[]).map((r) => ({
    id: Number(r.id),
    prateleira_id: Number(r.prateleira_id),
    corredor: r.corredor,
    lado: r.lado,
    andar: Number(r.andar),
    posicao: Number(r.posicao),
    codigo: r.codigo,
    status: r.produto_id ? 'ocupado' : 'livre',
    produto: r.produto_id
      ? { id: Number(r.produto_id), codigo: r.produto_codigo, nome: r.produto_nome, quantidade: Number(r.quantidade) }
      : null,
  }));

  res.json(resultado);
});

// POST /api/enderecos/:id/ocupar { produto_id, quantidade }
enderecosRouter.post('/:id/ocupar', async (req, res) => {
  const enderecoId = Number(req.params.id);
  const { produto_id, quantidade } = req.body ?? {};

  if (!produto_id || !quantidade || quantidade <= 0) {
    return res.status(400).json({ erro: 'produto_id e quantidade (> 0) sao obrigatorios' });
  }

  const endereco = await db.execute({ sql: `SELECT id FROM enderecos WHERE id = ?`, args: [enderecoId] });
  if (endereco.rows.length === 0) {
    return res.status(404).json({ erro: 'Endereco nao encontrado' });
  }

  const produto = await db.execute({ sql: `SELECT id FROM produtos WHERE id = ?`, args: [produto_id] });
  if (produto.rows.length === 0) {
    return res.status(404).json({ erro: 'Produto nao encontrado' });
  }

  const jaOcupado = await db.execute({ sql: `SELECT id FROM estoque_posicoes WHERE endereco_id = ?`, args: [enderecoId] });
  if (jaOcupado.rows.length > 0) {
    return res.status(409).json({ erro: 'Endereco ja esta ocupado. Libere antes de ocupar novamente.' });
  }

  await db.execute({
    sql: `INSERT INTO estoque_posicoes (produto_id, endereco_id, quantidade) VALUES (?, ?, ?)`,
    args: [produto_id, enderecoId, quantidade],
  });

  res.status(201).json({ ok: true });
});

// POST /api/enderecos/:id/liberar -> remove ocupacao do endereco
enderecosRouter.post('/:id/liberar', async (req, res) => {
  const enderecoId = Number(req.params.id);
  const info = await db.execute({ sql: `DELETE FROM estoque_posicoes WHERE endereco_id = ?`, args: [enderecoId] });

  if (info.rowsAffected === 0) {
    return res.status(404).json({ erro: 'Endereco ja estava livre' });
  }

  res.json({ ok: true });
});
