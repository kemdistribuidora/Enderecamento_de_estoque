import { ErroHttp, routerAsync } from '../utils/http';
import { db, emTransacao } from '../db/client';
import { Movimentacao } from '../types';
import { isDataIsoValida, somarDias } from '../services/validade.service';

export const movimentacoesRouter = routerAsync();

// GET /api/movimentacoes?limit=100&offset=0&de=YYYY-MM-DD&ate=YYYY-MM-DD&busca=texto
// -> historico, mais novo primeiro. de/ate sao dias no horario de Brasilia (inclusivos);
// busca casa codigo/nome do produto ou codigo da posicao. offset pagina ("carregar mais").
movimentacoesRouter.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const de = String(req.query.de ?? '');
  const ate = String(req.query.ate ?? '');
  const busca = String(req.query.busca ?? '').trim().toLowerCase();

  const filtros: string[] = [];
  const args: (string | number)[] = [];
  // criado_em e ISO em UTC; Brasil sem horario de verao desde 2019 = UTC-3 fixo
  if (de) {
    if (!isDataIsoValida(de)) throw new ErroHttp(400, 'Data inicial invalida');
    filtros.push('m.criado_em >= ?');
    args.push(new Date(`${de}T00:00:00-03:00`).toISOString());
  }
  if (ate) {
    if (!isDataIsoValida(ate)) throw new ErroHttp(400, 'Data final invalida');
    filtros.push('m.criado_em < ?');
    args.push(new Date(`${somarDias(ate, 1)}T00:00:00-03:00`).toISOString());
  }
  if (busca) {
    filtros.push('(LOWER(p.codigo) LIKE ? OR LOWER(p.nome) LIKE ? OR LOWER(e.codigo) LIKE ? OR LOWER(et.codigo) LIKE ?)');
    args.push(`%${busca}%`, `%${busca}%`, `%${busca}%`, `%${busca}%`);
  }
  const where = filtros.length > 0 ? `WHERE ${filtros.join(' AND ')}` : '';

  const rs = await db.execute({
    sql: `
      SELECT
        m.id, m.tipo, m.produto_id, m.endereco_id, m.quantidade, m.validade, m.lote, m.status, m.criado_em,
        p.codigo as produto_codigo, p.nome as produto_nome,
        e.codigo as endereco_codigo,
        et.codigo as transferencia_endereco_codigo
      FROM movimentacoes m
      JOIN produtos p ON p.id = m.produto_id
      JOIN enderecos e ON e.id = m.endereco_id
      LEFT JOIN enderecos et ON et.id = m.transferencia_endereco_id
      ${where}
      ORDER BY m.criado_em DESC, m.id DESC
      LIMIT ? OFFSET ?
    `,
    args: [...args, limit, offset],
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
    transferencia_endereco_codigo: r.transferencia_endereco_codigo ?? null,
  }));

  res.json(resultado);
});

// POST /api/movimentacoes/:id/desfazer -> so pra saida em standby, e so se ninguem
// reocupou o endereco desde entao (senao voltaria por cima de outro produto).
movimentacoesRouter.post('/:id/desfazer', async (req, res) => {
  const id = Number(req.params.id);

  // transacao: clique duplo no desfazer nao recoloca o pallet duas vezes
  await emTransacao(async (tx) => {
    const movRs = await tx.execute({
      sql: `SELECT tipo, produto_id, endereco_id, quantidade, validade, lote, status, posicao_criado_em FROM movimentacoes WHERE id = ?`,
      args: [id],
    });
    const mov = movRs.rows[0] as any;

    if (!mov) throw new ErroHttp(404, 'Movimentacao nao encontrada');
    if (mov.tipo !== 'saida' || mov.status !== 'standby') {
      throw new ErroHttp(409, 'So da pra desfazer saida que ainda esta em standby');
    }

    const ocupadoRs = await tx.execute({
      sql: `SELECT id FROM estoque_posicoes WHERE endereco_id = ?`,
      args: [Number(mov.endereco_id)],
    });
    if (ocupadoRs.rows.length > 0) {
      throw new ErroHttp(409, 'Endereco ja foi reocupado por outro produto, nao da pra desfazer');
    }

    // posicao_criado_em = data de entrada original do pallet (null em saida antiga, de antes
    // dessa coluna existir)
    await tx.execute({
      sql: `INSERT INTO estoque_posicoes (produto_id, endereco_id, quantidade, validade, lote, criado_em) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [Number(mov.produto_id), Number(mov.endereco_id), Number(mov.quantidade), mov.validade, mov.lote ?? null, mov.posicao_criado_em ?? null],
    });
    await tx.execute({ sql: `UPDATE movimentacoes SET status = 'revertida' WHERE id = ?`, args: [id] });
  });

  res.json({ ok: true });
});
