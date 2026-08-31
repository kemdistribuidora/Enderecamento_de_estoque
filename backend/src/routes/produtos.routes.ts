import { Router } from 'express';
import { db } from '../db/client';
import { Produto, ProdutoComPosicoes, PendenciaPosicionamento, SugestaoEndereco, DivergenciaSobra, ItemCurvaAbc } from '../types';
import { sugerirEnderecoLivre, EnderecoParaSugestao } from '../services/endereco.service';
import { calcularStatusValidade } from '../services/validade.service';

export const produtosRouter = Router();

// POST /api/produtos -> cadastra produto novo (dados mestre, sem posicao/estoque ainda)
produtosRouter.post('/', async (req, res) => {
  const { codigo, nome, codigo_barras, peso_caixa } = req.body ?? {};

  if (!codigo || !nome || !codigo_barras) {
    return res.status(400).json({ erro: 'codigo, nome e codigo_barras sao obrigatorios' });
  }

  const pesoCaixa = peso_caixa != null && peso_caixa !== '' ? Number(peso_caixa) : null;

  try {
    const info = await db.execute({
      sql: `INSERT INTO produtos (codigo, nome, codigo_barras, peso_caixa) VALUES (?, ?, ?, ?)`,
      args: [codigo, nome, codigo_barras, pesoCaixa],
    });

    const produto: Produto = {
      id: Number(info.lastInsertRowid),
      codigo,
      nome,
      codigo_barras,
      peso_caixa: pesoCaixa,
    };
    res.status(201).json(produto);
  } catch (e: any) {
    if (String(e?.message).includes('UNIQUE')) {
      return res.status(409).json({ erro: `Codigo "${codigo}" ja cadastrado` });
    }
    throw e;
  }
});

// GET /api/produtos?search=termo -> busca parcial por codigo OU nome, case-insensitive
produtosRouter.get('/', async (req, res) => {
  const search = String(req.query.search ?? '').trim();

  const rs = search
    ? await db.execute({
        sql: `SELECT * FROM produtos WHERE LOWER(codigo) LIKE ? OR LOWER(nome) LIKE ? ORDER BY nome`,
        args: [`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`],
      })
    : await db.execute(`SELECT * FROM produtos ORDER BY nome`);

  const rows = rs.rows as any[];
  const produtoIds = rows.map((r) => Number(r.id));
  const posicoesPorProduto = await carregarPosicoes(produtoIds);

  const resultado: ProdutoComPosicoes[] = rows.map((p) => ({
    ...p,
    id: Number(p.id),
    posicoes: posicoesPorProduto[Number(p.id)] ?? [],
  }));

  res.json(resultado);
});

// GET /api/produtos/pendencias-posicionamento -> produtos com saldo importado do Winthor
// maior que o ja alocado fisicamente. Precisa vir antes de GET /:id (senao Express casa
// "pendencias-posicionamento" como :id).
produtosRouter.get('/pendencias-posicionamento', async (_req, res) => {
  const rs = await db.execute(`
    SELECT
      p.id as produto_id, p.codigo, p.nome,
      COALESCE(saldo.total, 0) as saldo_total,
      COALESCE(alocado.total, 0) as alocado_total
    FROM produtos p
    JOIN (SELECT produto_id, SUM(saldo) as total FROM estoque_erp_saldo GROUP BY produto_id) saldo ON saldo.produto_id = p.id
    LEFT JOIN (SELECT produto_id, SUM(quantidade) as total FROM estoque_posicoes GROUP BY produto_id) alocado ON alocado.produto_id = p.id
    WHERE COALESCE(saldo.total, 0) > COALESCE(alocado.total, 0)
    ORDER BY p.nome
  `);

  const pendencias: PendenciaPosicionamento[] = (rs.rows as any[]).map((r) => ({
    produto_id: Number(r.produto_id),
    codigo: r.codigo,
    nome: r.nome,
    saldo_total: Number(r.saldo_total),
    alocado_total: Number(r.alocado_total),
    pendente: Number(r.saldo_total) - Number(r.alocado_total),
  }));

  res.json(pendencias);
});

// GET /api/produtos/divergencias-sobra -> produtos com estoque fisico MAIOR que o saldo
// Winthor. O Winthor manda (reflete nota fiscal/saida oficial); sobra fisica normalmente
// significa saida que ninguem registrou no sistema ainda. So alerta, nao mexe em nada.
produtosRouter.get('/divergencias-sobra', async (_req, res) => {
  const rs = await db.execute(`
    SELECT
      p.id as produto_id, p.codigo, p.nome,
      COALESCE(saldo.total, 0) as saldo_total,
      COALESCE(alocado.total, 0) as alocado_total
    FROM produtos p
    JOIN (SELECT produto_id, SUM(saldo) as total FROM estoque_erp_saldo GROUP BY produto_id) saldo ON saldo.produto_id = p.id
    LEFT JOIN (SELECT produto_id, SUM(quantidade) as total FROM estoque_posicoes GROUP BY produto_id) alocado ON alocado.produto_id = p.id
    WHERE COALESCE(alocado.total, 0) > COALESCE(saldo.total, 0)
    ORDER BY p.nome
  `);

  const divergencias: DivergenciaSobra[] = (rs.rows as any[]).map((r) => ({
    produto_id: Number(r.produto_id),
    codigo: r.codigo,
    nome: r.nome,
    saldo_total: Number(r.saldo_total),
    alocado_total: Number(r.alocado_total),
    excesso: Number(r.alocado_total) - Number(r.saldo_total),
  }));

  res.json(divergencias);
});

// GET /api/produtos/curva-abc -> classificacao ABC por giro (soma de saida confirmada,
// ou seja, nao revertida). Ordena por saida desc, acumula % do total geral, corta em
// 80% (A) e 95% (B); resto vira C. Depende de movimentacoes ter dado registrado.
produtosRouter.get('/curva-abc', async (_req, res) => {
  const rs = await db.execute(`
    SELECT p.id as produto_id, p.codigo, p.nome, COALESCE(SUM(m.quantidade), 0) as total_saida
    FROM produtos p
    LEFT JOIN movimentacoes m ON m.produto_id = p.id AND m.tipo = 'saida' AND m.status != 'revertida'
    GROUP BY p.id
    ORDER BY total_saida DESC, p.nome
  `);

  const linhas = (rs.rows as any[]).map((r) => ({
    produto_id: Number(r.produto_id),
    codigo: r.codigo,
    nome: r.nome,
    total_saida: Number(r.total_saida),
  }));

  const totalGeral = linhas.reduce((soma, l) => soma + l.total_saida, 0);

  // Classe usa o acumulado ANTES de somar este item (onde ele "comeca" na curva), nao
  // depois -- senao um item sozinho que ja fecha 80%+ do volume (comum com poucos SKUs
  // com dado ainda) cai errado fora de A, mesmo sendo literalmente o maior consumo.
  let acumulado = 0;
  const curva: ItemCurvaAbc[] = linhas.map((l) => {
    const percentual = totalGeral > 0 ? (l.total_saida / totalGeral) * 100 : 0;
    const classe: ItemCurvaAbc['classe'] = acumulado < 80 ? 'A' : acumulado < 95 ? 'B' : 'C';
    acumulado += percentual;
    return {
      produto_id: l.produto_id,
      codigo: l.codigo,
      nome: l.nome,
      total_saida: l.total_saida,
      percentual,
      percentual_acumulado: acumulado,
      classe,
    };
  });

  res.json(curva);
});

// GET /api/produtos/codigo-barras/:codigo -> match exato por codigo_barras, usado pelo
// scanner/coletor pra resolver o produto direto do codigo lido, sem digitar/buscar.
produtosRouter.get('/codigo-barras/:codigo', async (req, res) => {
  const codigo = String(req.params.codigo).trim();
  const rs = await db.execute({ sql: `SELECT * FROM produtos WHERE codigo_barras = ?`, args: [codigo] });
  const produto = rs.rows[0] as any;
  if (!produto) {
    return res.status(404).json({ erro: 'Produto nao encontrado para esse codigo de barras' });
  }
  const resultado: Produto = {
    id: Number(produto.id),
    codigo: produto.codigo,
    nome: produto.nome,
    codigo_barras: produto.codigo_barras,
    peso_caixa: produto.peso_caixa != null ? Number(produto.peso_caixa) : null,
  };
  res.json(resultado);
});

// GET /api/produtos/:id/sugestao-endereco -> endereco livre mais perto de onde o produto
// ja tem estoque fisico hoje. Sem estoque atual, sem sugestao (null).
produtosRouter.get('/:id/sugestao-endereco', async (req, res) => {
  const produtoId = Number(req.params.id);

  const rs = await db.execute(`
    SELECT e.id, e.andar, e.posicao, pr.setor_id, pr.id as prateleira_id, pr.ordem as prateleira_ordem, ep.produto_id
    FROM enderecos e
    JOIN prateleiras pr ON pr.id = e.prateleira_id
    LEFT JOIN estoque_posicoes ep ON ep.endereco_id = e.id
  `);

  const rows = rs.rows as any[];
  const paraSugestao = (r: any): EnderecoParaSugestao => ({
    id: Number(r.id),
    setor_id: Number(r.setor_id),
    prateleira_id: Number(r.prateleira_id),
    prateleira_ordem: Number(r.prateleira_ordem),
    andar: Number(r.andar),
    posicao: Number(r.posicao),
  });

  const ocupados = rows.filter((r) => Number(r.produto_id) === produtoId).map(paraSugestao);
  const livres = rows.filter((r) => r.produto_id == null).map(paraSugestao);

  const sugestao = sugerirEnderecoLivre(ocupados, livres);
  if (!sugestao) {
    return res.json(null);
  }

  const enderecoRs = await db.execute({ sql: `SELECT codigo FROM enderecos WHERE id = ?`, args: [sugestao.id] });
  const codigo = (enderecoRs.rows[0] as any)?.codigo ?? '';

  const resultado: SugestaoEndereco = { endereco_id: sugestao.id, codigo, setor_id: sugestao.setor_id };
  res.json(resultado);
});

// GET /api/produtos/:id -> detalhe + todas as posicoes onde o produto esta armazenado
produtosRouter.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const rs = await db.execute({ sql: `SELECT * FROM produtos WHERE id = ?`, args: [id] });
  const produto = rs.rows[0] as any;

  if (!produto) {
    return res.status(404).json({ erro: 'Produto nao encontrado' });
  }

  const posicoes = (await carregarPosicoes([id]))[id] ?? [];
  const resultado: ProdutoComPosicoes = { ...produto, id: Number(produto.id), posicoes };
  res.json(resultado);
});

async function carregarPosicoes(produtoIds: number[]): Promise<Record<number, ProdutoComPosicoes['posicoes']>> {
  if (produtoIds.length === 0) return {};

  const placeholders = produtoIds.map(() => '?').join(',');
  const rs = await db.execute({
    sql: `SELECT ep.produto_id as produtoId, ep.endereco_id as enderecoId, ep.quantidade as quantidade, ep.validade as validade, ep.lote as lote, e.codigo as codigoEndereco, pr.setor_id as setorId
          FROM estoque_posicoes ep
          JOIN enderecos e ON e.id = ep.endereco_id
          JOIN prateleiras pr ON pr.id = e.prateleira_id
          WHERE ep.produto_id IN (${placeholders})`,
    args: produtoIds,
  });

  const agrupado: Record<number, ProdutoComPosicoes['posicoes']> = {};
  for (const row of rs.rows as any[]) {
    const produtoId = Number(row.produtoId);
    if (!agrupado[produtoId]) agrupado[produtoId] = [];
    agrupado[produtoId].push({
      endereco_id: Number(row.enderecoId),
      codigo_endereco: row.codigoEndereco,
      quantidade: Number(row.quantidade),
      setor_id: Number(row.setorId),
      validade: row.validade,
      lote: row.lote ?? null,
      status_validade: calcularStatusValidade(row.validade),
    });
  }
  // validade mais proxima primeiro (FEFO) -> indica de qual posicao tirar estoque antes
  for (const produtoId of Object.keys(agrupado)) {
    agrupado[Number(produtoId)].sort((a, b) => a.validade.localeCompare(b.validade));
  }
  return agrupado;
}
