import { Router } from 'express';
import { db } from '../db/client';
import { Movimentacao } from '../types';

export const movimentacoesRouter = Router();

// GET /api/movimentacoes?limit=100 -> historico recente, mais novo primeiro
movimentacoesRouter.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);

  const rs = await db.execute({
    sql: `
      SELECT
        m.id, m.tipo, m.produto_id, m.endereco_id, m.quantidade, m.validade, m.lote, m.status, m.criado_em,
        p.codigo as produto_codigo, p.nome as produto_nome,
        e.codigo as endereco_codigo
      FROM movimentacoes m
      JOIN produtos p ON p.id = m.produto_id
      JOIN enderecos e ON e.id = m.endereco_id
      ORDER BY m.criado_em DESC, m.id DESC
      LIMIT ?
    `,
    args: [limit],
  });

  const resultado: Movimentacao[] = (rs.rows as any[]).map((r) => ({
    id: Number(r.id),
    tipo: r.tipo,
    produto_id: Number(r.produto_id),
    produto_codigo: r.produto_codigo,
    produto_nome: r.produto_nome,
    endereco_id: Number(r.endereco_id),
    endereco_codigo: r.endereco_codigo,
    quantidade: Number(r.quantidade),
    validade: r.validade,
    lote: r.lote ?? null,
    status: r.status,
    criado_em: r.criado_em,
  }));

  res.json(resultado);
});

// POST /api/movimentacoes/:id/desfazer -> so pra saida em standby, e so se ninguem
// reocupou o endereco desde entao (senao voltaria por cima de outro produto).
movimentacoesRouter.post('/:id/desfazer', async (req, res) => {
  const id = Number(req.params.id);

  const movRs = await db.execute({
    sql: `SELECT tipo, produto_id, endereco_id, quantidade, validade, lote, status FROM movimentacoes WHERE id = ?`,
    args: [id],
  });
  const mov = movRs.rows[0] as any;

  if (!mov) {
    return res.status(404).json({ erro: 'Movimentacao nao encontrada' });
  }
  if (mov.tipo !== 'saida' || mov.status !== 'standby') {
    return res.status(409).json({ erro: 'So da pra desfazer saida que ainda esta em standby' });
  }

  const ocupadoRs = await db.execute({
    sql: `SELECT id FROM estoque_posicoes WHERE endereco_id = ?`,
    args: [Number(mov.endereco_id)],
  });
  if (ocupadoRs.rows.length > 0) {
    return res.status(409).json({ erro: 'Endereco ja foi reocupado por outro produto, nao da pra desfazer' });
  }

  await db.execute({
    sql: `INSERT INTO estoque_posicoes (produto_id, endereco_id, quantidade, validade, lote) VALUES (?, ?, ?, ?, ?)`,
    args: [Number(mov.produto_id), Number(mov.endereco_id), Number(mov.quantidade), mov.validade, mov.lote ?? null],
  });

  await db.execute({ sql: `UPDATE movimentacoes SET status = 'revertida' WHERE id = ?`, args: [id] });

  res.json({ ok: true });
});
