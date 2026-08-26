import { Router } from 'express';
import { db } from '../db/client';
import { donoPrateleira } from '../services/endereco.service';
import { EnderecoComStatus, MapaSetor, Setor } from '../types';

export const mapaRouter = Router();

// GET /api/mapa/setores -> lista de setores (pras abas de departamento)
mapaRouter.get('/setores', async (_req, res) => {
  const rs = await db.execute(`SELECT id, nome, ordem FROM setores ORDER BY ordem`);
  const setores: Setor[] = (rs.rows as any[]).map((r) => ({ id: Number(r.id), nome: r.nome, ordem: Number(r.ordem) }));
  res.json(setores);
});

// GET /api/mapa/:setorId -> mapa integral do setor: corredores + prateleiras em sequencia,
// pronto pra desenhar prateleira/corredor/prateleira/corredor/... empilhado.
mapaRouter.get('/:setorId', async (req, res) => {
  const setorId = Number(req.params.setorId);

  const setorRs = await db.execute({ sql: `SELECT id, nome, ordem FROM setores WHERE id = ?`, args: [setorId] });
  const setorRow = setorRs.rows[0] as any;
  if (!setorRow) {
    return res.status(404).json({ erro: 'Setor nao encontrado' });
  }
  const setor: Setor = { id: Number(setorRow.id), nome: setorRow.nome, ordem: Number(setorRow.ordem) };

  const corredoresRs = await db.execute({
    sql: `SELECT letra FROM corredores WHERE setor_id = ? ORDER BY ordem`,
    args: [setorId],
  });
  const corredores = (corredoresRs.rows as any[]).map((r) => ({ letra: r.letra as string }));

  const prateleirasRs = await db.execute({
    sql: `SELECT id, ordem FROM prateleiras WHERE setor_id = ? ORDER BY ordem`,
    args: [setorId],
  });
  const prateleirasRows = prateleirasRs.rows as any[];
  const prateleiraIds = prateleirasRows.map((r) => Number(r.id));

  const enderecosPorPrateleira: Record<number, EnderecoComStatus[]> = {};
  if (prateleiraIds.length > 0) {
    const placeholders = prateleiraIds.map(() => '?').join(',');
    const enderecosRs = await db.execute({
      sql: `
        SELECT
          e.id, e.prateleira_id, e.corredor, e.lado, e.andar, e.posicao, e.codigo,
          ep.quantidade as quantidade, ep.validade as validade,
          p.id as produto_id, p.codigo as produto_codigo, p.nome as produto_nome
        FROM enderecos e
        LEFT JOIN estoque_posicoes ep ON ep.endereco_id = e.id
        LEFT JOIN produtos p ON p.id = ep.produto_id
        WHERE e.prateleira_id IN (${placeholders})
        ORDER BY e.andar DESC, e.posicao
      `,
      args: prateleiraIds,
    });

    for (const r of enderecosRs.rows as any[]) {
      const prateleiraId = Number(r.prateleira_id);
      if (!enderecosPorPrateleira[prateleiraId]) enderecosPorPrateleira[prateleiraId] = [];
      enderecosPorPrateleira[prateleiraId].push({
        id: Number(r.id),
        prateleira_id: prateleiraId,
        corredor: r.corredor,
        lado: r.lado,
        andar: Number(r.andar),
        posicao: Number(r.posicao),
        codigo: r.codigo,
        status: r.produto_id ? 'ocupado' : 'livre',
        produto: r.produto_id
          ? { id: Number(r.produto_id), codigo: r.produto_codigo, nome: r.produto_nome, quantidade: Number(r.quantidade), validade: r.validade }
          : null,
      });
    }
  }

  const mapa: MapaSetor = {
    setor,
    corredores: corredores.map((c) => c.letra),
    prateleiras: prateleirasRows.map((r) => {
      const ordem = Number(r.ordem);
      return {
        id: Number(r.id),
        ordem,
        dono: donoPrateleira(corredores, ordem),
        posicoes: enderecosPorPrateleira[Number(r.id)] ?? [],
      };
    }),
  };

  res.json(mapa);
});
