import { Router } from 'express';
import { db } from '../db/client';
import { Produto, ProdutoComPosicoes } from '../types';

export const produtosRouter = Router();

// POST /api/produtos -> cadastra produto novo (dados mestre, sem posicao/estoque ainda)
produtosRouter.post('/', async (req, res) => {
  const { codigo, nome, descricao, codigo_barras } = req.body ?? {};

  if (!codigo || !nome || !codigo_barras) {
    return res.status(400).json({ erro: 'codigo, nome e codigo_barras sao obrigatorios' });
  }

  try {
    const info = await db.execute({
      sql: `INSERT INTO produtos (codigo, nome, descricao, codigo_barras) VALUES (?, ?, ?, ?)`,
      args: [codigo, nome, descricao ?? '', codigo_barras],
    });

    const produto: Produto = {
      id: Number(info.lastInsertRowid),
      codigo,
      nome,
      descricao: descricao ?? '',
      codigo_barras,
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
    sql: `SELECT ep.produto_id as produtoId, ep.endereco_id as enderecoId, ep.quantidade as quantidade, ep.validade as validade, e.codigo as codigoEndereco, pr.setor_id as setorId
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
    });
  }
  // validade mais proxima primeiro (FEFO) -> indica de qual posicao tirar estoque antes
  for (const produtoId of Object.keys(agrupado)) {
    agrupado[Number(produtoId)].sort((a, b) => a.validade.localeCompare(b.validade));
  }
  return agrupado;
}
