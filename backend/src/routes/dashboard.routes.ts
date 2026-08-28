import { Router } from 'express';
import { db } from '../db/client';
import { calcularStatusValidade } from '../services/validade.service';
import { KpisDashboard } from '../types';

export const dashboardRouter = Router();

// GET /api/dashboard/kpis -> indicadores consolidados. Cada bloco replica (nao reaproveita)
// a query equivalente ja existente em produtos.routes.ts/enderecos.routes.ts -- ver nota
// de trade-off no calcularGiroMedio abaixo.
dashboardRouter.get('/kpis', async (_req, res) => {
  const resultado: KpisDashboard = {
    acuracia_estoque: await calcularAcuraciaEstoque(),
    ocupacao_por_setor: await calcularOcupacaoPorSetor(),
    giro_medio: await calcularGiroMedio(),
    vencimento: await calcularVencimento(),
  };
  res.json(resultado);
});

// Acuracia = % de produtos SEM divergencia (saldo Winthor == alocado fisico). As duas
// condicoes de pendencias-posicionamento (saldo > alocado) e divergencias-sobra
// (alocado > saldo) sao mutuamente exclusivas por construcao, entao "saldo != alocado"
// e' exatamente a uniao das duas -- equivalente a somar as duas contagens, mas em 1 query.
async function calcularAcuraciaEstoque(): Promise<KpisDashboard['acuracia_estoque']> {
  const denRs = await db.execute(`SELECT COUNT(DISTINCT produto_id) as total FROM estoque_erp_saldo`);
  const denominador = Number((denRs.rows[0] as any).total);
  if (denominador === 0) {
    return { status: 'sem_dados', percentual: null, total_produtos: 0, produtos_com_divergencia: 0 };
  }

  const divRs = await db.execute(`
    SELECT COUNT(*) as total FROM (
      SELECT p.id
      FROM produtos p
      JOIN (SELECT produto_id, SUM(saldo) as total FROM estoque_erp_saldo GROUP BY produto_id) saldo ON saldo.produto_id = p.id
      LEFT JOIN (SELECT produto_id, SUM(quantidade) as total FROM estoque_posicoes GROUP BY produto_id) alocado ON alocado.produto_id = p.id
      WHERE COALESCE(saldo.total, 0) != COALESCE(alocado.total, 0)
    )
  `);
  const divergentes = Number((divRs.rows[0] as any).total);
  return {
    status: 'ok',
    percentual: ((denominador - divergentes) / denominador) * 100,
    total_produtos: denominador,
    produtos_com_divergencia: divergentes,
  };
}

// LEFT JOIN em toda a cadeia -- um setor sem prateleiras/enderecos ainda cadastrados
// continua aparecendo na lista, com 0/0, em vez de sumir (INNER JOIN o excluiria).
async function calcularOcupacaoPorSetor(): Promise<KpisDashboard['ocupacao_por_setor']> {
  const rs = await db.execute(`
    SELECT s.id as setor_id, s.nome as setor_nome, s.ordem,
      COUNT(e.id) as total_enderecos, COUNT(ep.id) as ocupados
    FROM setores s
    LEFT JOIN prateleiras pr ON pr.setor_id = s.id
    LEFT JOIN enderecos e ON e.prateleira_id = pr.id
    LEFT JOIN estoque_posicoes ep ON ep.endereco_id = e.id
    GROUP BY s.id
    ORDER BY s.ordem
  `);
  return (rs.rows as any[]).map((r) => {
    const total = Number(r.total_enderecos);
    const ocupados = Number(r.ocupados);
    return {
      setor_id: Number(r.setor_id),
      setor_nome: r.setor_nome,
      total_enderecos: total,
      ocupados,
      percentual: total > 0 ? (ocupados / total) * 100 : null,
    };
  });
}

// Giro medio = media de saida confirmada entre produtos com giro > 0. Replica (nao
// reaproveita) a agregacao de GET /produtos/curva-abc de proposito: aqui so precisamos
// da media, curva-abc precisa de percentual/classe por item -- factorizar um helper
// compartilhado agora seria abstrair 5 linhas de SQL por uma unica reutilizacao, contra
// o estilo do projeto (ver validade.service.ts, que ja e' duplicado front/back de proposito).
async function calcularGiroMedio(): Promise<KpisDashboard['giro_medio']> {
  const rs = await db.execute(`
    SELECT AVG(total_saida) as giro_medio, COUNT(*) as produtos_com_giro
    FROM (
      SELECT p.id, SUM(m.quantidade) as total_saida
      FROM produtos p
      JOIN movimentacoes m ON m.produto_id = p.id AND m.tipo = 'saida' AND m.status != 'revertida'
      GROUP BY p.id
      HAVING SUM(m.quantidade) > 0
    )
  `);
  const row = rs.rows[0] as any;
  const produtosComGiro = Number(row.produtos_com_giro);
  return {
    status: produtosComGiro > 0 ? 'ok' : 'sem_dados',
    valor: produtosComGiro > 0 ? Number(row.giro_medio) : null,
    produtos_com_giro: produtosComGiro,
  };
}

// Mesma classificacao de GET /enderecos/a-vencer, so contando em vez de listar.
async function calcularVencimento(): Promise<KpisDashboard['vencimento']> {
  const rs = await db.execute(`SELECT validade FROM estoque_posicoes`);
  let vencidos = 0;
  let proximos = 0;
  for (const r of rs.rows as any[]) {
    const status = calcularStatusValidade(r.validade);
    if (status === 'vencido') vencidos++;
    else if (status === 'proximo') proximos++;
  }
  return { vencidos, proximos };
}
