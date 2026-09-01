import { Router } from 'express';
import { db } from '../db/client';
import { EnderecoComStatus, PosicaoAVencer } from '../types';
import { calcularStatusValidade } from '../services/validade.service';

export const enderecosRouter = Router();

// GET /api/enderecos -> lista flat de todos os enderecos com status (livre/ocupado) e
// produto ocupante. Usado pelo Cadastro pra montar o <select> de posicao livre; o mapa
// visual usa /api/mapa/:setorId (agrupado por prateleira, sem essa lista plana).
enderecosRouter.get('/', async (_req, res) => {
  const rs = await db.execute(`
    SELECT
      e.id, e.prateleira_id, e.corredor, e.lado, e.andar, e.posicao, e.codigo,
      ep.quantidade as quantidade, ep.validade as validade, ep.lote as lote, ep.criado_em as criado_em,
      p.id as produto_id, p.codigo as produto_codigo, p.nome as produto_nome, p.codigo_barras as produto_codigo_barras, p.peso_caixa as produto_peso_caixa
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
      ? {
          id: Number(r.produto_id),
          codigo: r.produto_codigo,
          nome: r.produto_nome,
          codigo_barras: r.produto_codigo_barras,
          peso_caixa: r.produto_peso_caixa != null ? Number(r.produto_peso_caixa) : null,
          quantidade: Number(r.quantidade),
          validade: r.validade,
          lote: r.lote ?? null,
          criado_em: r.criado_em ?? null,
          status_validade: calcularStatusValidade(r.validade),
        }
      : null,
  }));

  res.json(resultado);
});

// GET /api/enderecos/codigo/:codigo -> match exato pelo codigo do endereco, usado pelo
// scanner/coletor (le a etiqueta da posicao). Endereco livre e' 200 com produto: null;
// so 404 se o codigo nao existir de jeito nenhum. 2 segmentos de path, entao nao colide
// com nenhuma rota :id de 1 segmento independente de ordem de registro.
enderecosRouter.get('/codigo/:codigo', async (req, res) => {
  const codigo = String(req.params.codigo).trim();

  const rs = await db.execute({
    sql: `
      SELECT
        e.id, e.prateleira_id, e.corredor, e.lado, e.andar, e.posicao, e.codigo,
        ep.quantidade as quantidade, ep.validade as validade, ep.lote as lote, ep.criado_em as criado_em,
        p.id as produto_id, p.codigo as produto_codigo, p.nome as produto_nome, p.codigo_barras as produto_codigo_barras, p.peso_caixa as produto_peso_caixa
      FROM enderecos e
      LEFT JOIN estoque_posicoes ep ON ep.endereco_id = e.id
      LEFT JOIN produtos p ON p.id = ep.produto_id
      WHERE e.codigo = ?
    `,
    args: [codigo],
  });

  const r = rs.rows[0] as any;
  if (!r) {
    return res.status(404).json({ erro: 'Endereco nao encontrado' });
  }

  const resultado: EnderecoComStatus = {
    id: Number(r.id),
    prateleira_id: Number(r.prateleira_id),
    corredor: r.corredor,
    lado: r.lado,
    andar: Number(r.andar),
    posicao: Number(r.posicao),
    codigo: r.codigo,
    status: r.produto_id ? 'ocupado' : 'livre',
    produto: r.produto_id
      ? {
          id: Number(r.produto_id),
          codigo: r.produto_codigo,
          nome: r.produto_nome,
          codigo_barras: r.produto_codigo_barras,
          peso_caixa: r.produto_peso_caixa != null ? Number(r.produto_peso_caixa) : null,
          quantidade: Number(r.quantidade),
          validade: r.validade,
          lote: r.lote ?? null,
          criado_em: r.criado_em ?? null,
          status_validade: calcularStatusValidade(r.validade),
        }
      : null,
  };

  res.json(resultado);
});

// GET /api/enderecos/a-vencer -> posicoes ocupadas com validade vencida ou proxima
// (ver DIAS_ALERTA_VENCIMENTO), vencido primeiro.
enderecosRouter.get('/a-vencer', async (_req, res) => {
  const rs = await db.execute(`
    SELECT
      e.id as endereco_id, e.codigo as endereco_codigo, pr.setor_id,
      ep.produto_id, ep.quantidade, ep.validade, ep.lote,
      p.codigo as produto_codigo, p.nome as produto_nome
    FROM estoque_posicoes ep
    JOIN enderecos e ON e.id = ep.endereco_id
    JOIN prateleiras pr ON pr.id = e.prateleira_id
    JOIN produtos p ON p.id = ep.produto_id
    ORDER BY ep.validade ASC
  `);

  const resultado: PosicaoAVencer[] = (rs.rows as any[])
    .map((r) => ({
      endereco_id: Number(r.endereco_id),
      endereco_codigo: r.endereco_codigo,
      setor_id: Number(r.setor_id),
      produto_id: Number(r.produto_id),
      produto_codigo: r.produto_codigo,
      produto_nome: r.produto_nome,
      quantidade: Number(r.quantidade),
      validade: r.validade,
      lote: r.lote ?? null,
      status_validade: calcularStatusValidade(r.validade),
    }))
    .filter((p) => p.status_validade !== 'normal');

  res.json(resultado);
});

// POST /api/enderecos/:id/ocupar { produto_id, quantidade, validade, lote }
enderecosRouter.post('/:id/ocupar', async (req, res) => {
  const enderecoId = Number(req.params.id);
  const { produto_id, quantidade, validade, lote } = req.body ?? {};

  if (!produto_id || !quantidade || quantidade <= 0 || !validade || !String(lote ?? '').trim()) {
    return res.status(400).json({ erro: 'produto_id, quantidade (> 0), validade e lote sao obrigatorios' });
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

  const agora = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO estoque_posicoes (produto_id, endereco_id, quantidade, validade, lote, criado_em) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [produto_id, enderecoId, quantidade, validade, lote, agora],
  });

  await db.execute({
    sql: `INSERT INTO movimentacoes (tipo, produto_id, endereco_id, quantidade, validade, lote, status, criado_em) VALUES ('entrada', ?, ?, ?, ?, ?, 'confirmada', ?)`,
    args: [produto_id, enderecoId, quantidade, validade, lote, agora],
  });

  res.status(201).json({ ok: true, criado_em: agora });
});

// POST /api/enderecos/:id/liberar -> remove ocupacao do endereco. Nao apaga o rastro: fica
// registrado em movimentacoes com status 'standby', dando pra desfazer (POST
// /api/movimentacoes/:id/desfazer) enquanto ninguem reocupar esse endereco.
enderecosRouter.post('/:id/liberar', async (req, res) => {
  const enderecoId = Number(req.params.id);

  const ocupacaoRs = await db.execute({
    sql: `SELECT produto_id, quantidade, validade, lote FROM estoque_posicoes WHERE endereco_id = ?`,
    args: [enderecoId],
  });
  const ocupacao = ocupacaoRs.rows[0] as any;
  if (!ocupacao) {
    return res.status(404).json({ erro: 'Endereco ja estava livre' });
  }

  await db.execute({ sql: `DELETE FROM estoque_posicoes WHERE endereco_id = ?`, args: [enderecoId] });

  const movimentacaoInfo = await db.execute({
    sql: `INSERT INTO movimentacoes (tipo, produto_id, endereco_id, quantidade, validade, lote, status, criado_em) VALUES ('saida', ?, ?, ?, ?, ?, 'standby', ?)`,
    args: [Number(ocupacao.produto_id), enderecoId, Number(ocupacao.quantidade), ocupacao.validade, ocupacao.lote ?? null, new Date().toISOString()],
  });

  res.json({ ok: true, movimentacao_id: Number(movimentacaoInfo.lastInsertRowid) });
});

// POST /api/enderecos/:id/baixar-parcial { quantidade } -> retira uma quantidade especifica
// da posicao (peso e quantidade da posicao ficam menores), sem liberar o endereco. Se a
// quantidade retirada esgotar o saldo, o endereco fica livre igual ao /liberar. Registrada
// como movimentacao 'saida' ja 'confirmada' (nao entra no fluxo de desfazer de /liberar,
// que so reverte liberacao total).
enderecosRouter.post('/:id/baixar-parcial', async (req, res) => {
  const enderecoId = Number(req.params.id);
  const qtdRetirada = Number((req.body ?? {}).quantidade);

  if (!qtdRetirada || qtdRetirada <= 0) {
    return res.status(400).json({ erro: 'quantidade (> 0) e obrigatoria' });
  }

  const ocupacaoRs = await db.execute({
    sql: `SELECT produto_id, quantidade, validade, lote FROM estoque_posicoes WHERE endereco_id = ?`,
    args: [enderecoId],
  });
  const ocupacao = ocupacaoRs.rows[0] as any;
  if (!ocupacao) {
    return res.status(404).json({ erro: 'Endereco esta livre' });
  }

  const qtdAtual = Number(ocupacao.quantidade);
  if (qtdRetirada > qtdAtual) {
    return res.status(400).json({ erro: `Quantidade retirada (${qtdRetirada}) maior que a quantidade na posicao (${qtdAtual})` });
  }

  const qtdRestante = qtdAtual - qtdRetirada;
  const agora = new Date().toISOString();

  if (qtdRestante === 0) {
    await db.execute({ sql: `DELETE FROM estoque_posicoes WHERE endereco_id = ?`, args: [enderecoId] });
  } else {
    await db.execute({
      sql: `UPDATE estoque_posicoes SET quantidade = ? WHERE endereco_id = ?`,
      args: [qtdRestante, enderecoId],
    });
  }

  const movimentacaoInfo = await db.execute({
    sql: `INSERT INTO movimentacoes (tipo, produto_id, endereco_id, quantidade, validade, lote, status, criado_em) VALUES ('saida', ?, ?, ?, ?, ?, 'confirmada', ?)`,
    args: [Number(ocupacao.produto_id), enderecoId, qtdRetirada, ocupacao.validade, ocupacao.lote ?? null, agora],
  });

  res.json({ ok: true, movimentacao_id: Number(movimentacaoInfo.lastInsertRowid), quantidade_restante: qtdRestante });
});
