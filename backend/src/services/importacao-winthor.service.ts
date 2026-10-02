// Importacao do arquivo exportado do Winthor (rotina D860) + reconciliacao com o estoque
// fisico. Regra central do sistema: o saldo do Winthor e a verdade. Pra todo produto do
// arquivo, posicionado + nao_posicionado = saldo do arquivo:
//   - saldo >= posicionado -> diferenca fica como nao posicionado (derivado, nao gravado:
//     nao_posicionado = saldo - SUM(estoque_posicoes), ver /produtos/pendencias-posicionamento)
//   - saldo <  posicionado -> nao posicionado zera e a diferenca vira SOBRA: algo posicionado
//     ja saiu no Winthor e nao foi retirado da posicao. So alerta; usuario da a baixa na
//     posicao certa. Nunca mexe em estoque_posicoes daqui.
// Area de Espera conta como posicionado (e endereco normal em estoque_posicoes).
// Arquivo pode ser PARCIAL (filtrado por produto/fornecedor): produto fora do arquivo nao
// e tocado. Fluxo em 2 passos: previa (nao grava) -> confirmar (grava tudo numa transacao).
// Usado pela rota de upload (routes/importacao.routes.ts) e pelo CLI (scripts/import-winthor.ts).
import { InStatement } from '@libsql/client';
import { db } from '../db/client';
import { arredondarQtd } from '../utils/quantidade';

// sem cabecalho, separador ';': codigo;nome;codigo_barras;qt_por_cx;filial;codigo;saldo
// (query do Winthor faz LEFT JOIN produto+saldo: filial/codigo/saldo vazios = sem saldo
// na filial, tratado como saldo 0 -- o produto veio no arquivo, entao o Winthor diz 0).
const COLUNAS = 7;
const FILIAL_PADRAO = '1';
// Winthor (Oracle) exporta decimal com ponto, sem separador de milhar e SEM o zero antes
// do ponto quando < 1 (ex: 1684.089, .5, -.24). Virgula ou qualquer outra coisa bloqueia
// a linha: nunca adivinhar numero de estoque.
const REGEX_DECIMAL = /^-?(\d+(\.\d+)?|\.\d+)$/;

export type StatusReconciliacao = 'novo' | 'sem_mudanca' | 'entrou' | 'saiu' | 'sobra';

export interface LinhaBloqueada {
  linha: number;
  conteudo: string;
  motivo: string;
}

export interface PosicaoProduto {
  endereco_codigo: string;
  quantidade: number;
  validade: string;
  lote: string | null;
}

export interface ItemReconciliacao {
  produto_id: number | null; // null = produto novo, ainda nao cadastrado
  codigo: string;
  nome: string;
  qt_por_cx: number | null;
  produto_novo: boolean;
  cadastro_alterado: boolean; // nome/codigo de barras/qt_por_cx diferente do cadastrado
  saldo_anterior: number | null; // null = produto nunca teve saldo importado
  saldo_novo: number;
  delta: number; // saldo_novo - (saldo_anterior ?? 0)
  posicionado: number;
  nao_posicionado_antes: number | null;
  nao_posicionado: number;
  sobra: number;
  status: StatusReconciliacao;
  // so pra status 'sobra': posicoes do produto, validade mais antiga primeiro (FEFO) --
  // a mais provavel de ja ter saido
  posicoes: PosicaoProduto[];
}

export interface TotaisReconciliacao {
  linhas_lidas: number;
  linhas_bloqueadas: number;
  produtos_arquivo: number;
  produtos_novos: number;
  produtos_fora_arquivo: number; // cadastrados no sistema e nao vieram (nao alterados)
  sem_mudanca: number;
  entrou: number;
  saiu: number;
  sobra: number;
  novo: number;
}

export interface PreviaImportacao {
  itens: ItemReconciliacao[];
  bloqueadas: LinhaBloqueada[];
  avisos: string[];
  totais: TotaisReconciliacao;
}

interface ProdutoArquivo {
  linha: number;
  conteudo: string;
  codigo: string;
  nome: string;
  codigo_barras: string;
  qt_por_cx: number | null;
  filial: string | null; // null = sem saldo no Winthor (colunas vazias)
  saldo: number;
}

interface ArquivoParseado {
  produtos: ProdutoArquivo[];
  bloqueadas: LinhaBloqueada[];
  avisos: string[];
  linhasLidas: number;
}

export function parsearArquivoWinthor(conteudo: string): ArquivoParseado {
  const bloqueadas: LinhaBloqueada[] = [];
  const avisos: string[] = [];
  const porCodigo = new Map<string, ProdutoArquivo>();
  // codigo repetido com saldo/filial diferente: nao da pra saber qual linha vale, entao
  // o produto inteiro fica de fora (bloqueado) em vez de somar ou escolher uma
  const codigosConflitantes = new Set<string>();
  let linhasLidas = 0;

  const linhas = conteudo.replace(/^﻿/, '').split(/\r?\n/);
  linhas.forEach((crua, i) => {
    if (!crua.trim()) return;
    linhasLidas++;
    const numero = i + 1;
    const bloquear = (motivo: string) => {
      bloqueadas.push({ linha: numero, conteudo: crua, motivo });
    };

    const campos = crua.split(';').map((c) => c.trim());
    while (campos.length > COLUNAS && campos[campos.length - 1] === '') campos.pop();
    if (campos.length !== COLUNAS) {
      return bloquear(`esperado ${COLUNAS} campos separados por ";", veio ${campos.length}`);
    }

    const [codigo, nome, codigoBarras, qtPorCxStr, filialStr, codigoRepetido, saldoStr] = campos;
    if (!codigo) return bloquear('codigo vazio');
    if (!nome) return bloquear('nome vazio');
    if (codigoRepetido && codigoRepetido !== codigo) {
      return bloquear(`coluna 6 (${codigoRepetido}) diferente do codigo da coluna 1 (${codigo})`);
    }

    let qtPorCx: number | null = null;
    if (qtPorCxStr) {
      // fracionado vale (ex: queijo KG em peca de .5 / 2.5)
      if (!REGEX_DECIMAL.test(qtPorCxStr) || Number(qtPorCxStr) <= 0) {
        return bloquear(`qt_por_cx invalido: "${qtPorCxStr}"`);
      }
      qtPorCx = arredondarQtd(Number(qtPorCxStr));
    }

    let filial: string | null = null;
    let saldo = 0;
    if (saldoStr) {
      if (!REGEX_DECIMAL.test(saldoStr)) {
        return bloquear(`saldo invalido: "${saldoStr}" (esperado numero com ponto decimal, sem separador de milhar)`);
      }
      if (!filialStr) return bloquear('saldo preenchido sem filial');
      filial = filialStr;
      saldo = arredondarQtd(Number(saldoStr));
    } else if (filialStr) {
      return bloquear('filial preenchida sem saldo');
    }

    if (codigosConflitantes.has(codigo)) {
      return bloquear(`produto ${codigo} repetido no arquivo com saldo/filial diferente`);
    }

    const existente = porCodigo.get(codigo);
    if (existente) {
      if (existente.saldo === saldo && existente.filial === filial) {
        avisos.push(`Linha ${numero}: produto ${codigo} repetido com o mesmo saldo, considerado 1 vez`);
        return;
      }
      porCodigo.delete(codigo);
      codigosConflitantes.add(codigo);
      bloqueadas.push({
        linha: existente.linha,
        conteudo: existente.conteudo,
        motivo: `produto ${codigo} repetido no arquivo com saldo/filial diferente`,
      });
      return bloquear(`produto ${codigo} repetido no arquivo com saldo/filial diferente`);
    }

    if (saldo < 0) avisos.push(`Linha ${numero}: produto ${codigo} com saldo negativo no Winthor (${saldo})`);

    porCodigo.set(codigo, {
      linha: numero,
      conteudo: crua,
      codigo,
      nome,
      codigo_barras: codigoBarras,
      qt_por_cx: qtPorCx,
      filial,
      saldo,
    });
  });

  bloqueadas.sort((a, b) => a.linha - b.linha);
  return { produtos: [...porCodigo.values()], bloqueadas, avisos, linhasLidas };
}

const ORDEM_STATUS: Record<StatusReconciliacao, number> = { sobra: 0, entrou: 1, saiu: 2, novo: 3, sem_mudanca: 4 };

interface Reconciliacao {
  previa: PreviaImportacao;
  produtos: ProdutoArquivo[];
}

async function reconciliar(conteudo: string): Promise<Reconciliacao> {
  const parse = parsearArquivoWinthor(conteudo);

  // Carrega tudo de uma vez (3 queries) em vez de 3 por produto: arquivo tem milhares de
  // linhas e o banco pode ser o Turso remoto.
  const [produtosRs, saldoRs, posicionadoRs] = await Promise.all([
    db.execute(`SELECT id, codigo, nome, codigo_barras, qt_por_cx FROM produtos`),
    db.execute(`SELECT produto_id, ROUND(SUM(saldo), 6) as total FROM estoque_erp_saldo GROUP BY produto_id`),
    db.execute(`SELECT produto_id, ROUND(SUM(quantidade), 6) as total FROM estoque_posicoes GROUP BY produto_id`),
  ]);

  const cadastrados = new Map<string, any>();
  for (const r of produtosRs.rows as any[]) cadastrados.set(String(r.codigo), r);
  const saldoPorProduto = new Map<number, number>();
  for (const r of saldoRs.rows as any[]) saldoPorProduto.set(Number(r.produto_id), arredondarQtd(Number(r.total)));
  const posicionadoPorProduto = new Map<number, number>();
  for (const r of posicionadoRs.rows as any[]) posicionadoPorProduto.set(Number(r.produto_id), arredondarQtd(Number(r.total)));

  const itens: ItemReconciliacao[] = parse.produtos.map((p) => {
    const cadastro = cadastrados.get(p.codigo);
    const produtoId = cadastro ? Number(cadastro.id) : null;
    const saldoAnterior = produtoId != null ? saldoPorProduto.get(produtoId) ?? null : null;
    const posicionado = produtoId != null ? posicionadoPorProduto.get(produtoId) ?? 0 : 0;
    const saldoNovo = p.saldo;

    const naoPosicionado = arredondarQtd(Math.max(0, saldoNovo - posicionado));
    const sobra = arredondarQtd(Math.max(0, posicionado - saldoNovo));
    const delta = arredondarQtd(saldoNovo - (saldoAnterior ?? 0));
    // trava de sanidade da regra central: se isso falhar e bug, nao dado ruim
    if (arredondarQtd(posicionado + naoPosicionado - sobra) !== saldoNovo) {
      throw new Error(`Reconciliacao inconsistente no produto ${p.codigo}`);
    }

    let status: StatusReconciliacao;
    if (sobra > 0) status = 'sobra';
    else if (saldoAnterior == null) status = 'novo';
    else if (delta > 0) status = 'entrou';
    else if (delta < 0) status = 'saiu';
    else status = 'sem_mudanca';

    const cadastroAlterado =
      !!cadastro &&
      (cadastro.nome !== p.nome ||
        cadastro.codigo_barras !== p.codigo_barras ||
        (p.qt_por_cx != null && Number(cadastro.qt_por_cx) !== p.qt_por_cx));

    return {
      produto_id: produtoId,
      codigo: p.codigo,
      nome: p.nome,
      qt_por_cx: p.qt_por_cx ?? (cadastro?.qt_por_cx != null ? Number(cadastro.qt_por_cx) : null),
      produto_novo: !cadastro,
      cadastro_alterado: cadastroAlterado,
      saldo_anterior: saldoAnterior,
      saldo_novo: saldoNovo,
      delta,
      posicionado,
      nao_posicionado_antes: saldoAnterior != null ? arredondarQtd(Math.max(0, saldoAnterior - posicionado)) : null,
      nao_posicionado: naoPosicionado,
      sobra,
      status,
      posicoes: [],
    };
  });

  await preencherPosicoesSobra(itens.filter((i) => i.status === 'sobra'));

  itens.sort((a, b) => ORDEM_STATUS[a.status] - ORDEM_STATUS[b.status] || a.nome.localeCompare(b.nome));

  const contar = (s: StatusReconciliacao) => itens.filter((i) => i.status === s).length;
  const cadastradosNoArquivo = itens.filter((i) => !i.produto_novo).length;
  const totais: TotaisReconciliacao = {
    linhas_lidas: parse.linhasLidas,
    linhas_bloqueadas: parse.bloqueadas.length,
    produtos_arquivo: itens.length,
    produtos_novos: itens.length - cadastradosNoArquivo,
    produtos_fora_arquivo: cadastrados.size - cadastradosNoArquivo,
    sem_mudanca: contar('sem_mudanca'),
    entrou: contar('entrou'),
    saiu: contar('saiu'),
    sobra: contar('sobra'),
    novo: contar('novo'),
  };

  return { previa: { itens, bloqueadas: parse.bloqueadas, avisos: parse.avisos, totais }, produtos: parse.produtos };
}

async function preencherPosicoesSobra(itensSobra: ItemReconciliacao[]): Promise<void> {
  if (itensSobra.length === 0) return;
  const porProduto = new Map<number, ItemReconciliacao>();
  for (const item of itensSobra) porProduto.set(item.produto_id!, item);

  const ids = [...porProduto.keys()];
  const rs = await db.execute({
    sql: `
      SELECT ep.produto_id, e.codigo as endereco_codigo, ep.quantidade, ep.validade, ep.lote
      FROM estoque_posicoes ep
      JOIN enderecos e ON e.id = ep.endereco_id
      WHERE ep.produto_id IN (${ids.map(() => '?').join(',')})
      ORDER BY ep.validade, e.codigo
    `,
    args: ids,
  });
  for (const r of rs.rows as any[]) {
    porProduto.get(Number(r.produto_id))!.posicoes.push({
      endereco_codigo: r.endereco_codigo,
      quantidade: arredondarQtd(Number(r.quantidade)),
      validade: r.validade,
      lote: r.lote ?? null,
    });
  }
}

// Passo 1: so calcula, nao grava nada.
export async function previaImportacao(conteudo: string): Promise<PreviaImportacao> {
  return (await reconciliar(conteudo)).previa;
}

// Passo 2: recalcula no servidor (nao confia na previa que a tela guardou -- estoque pode ter
// mudado entre os dois cliques) e grava cadastro + saldo + historico num unico db.batch:
// ou entra o arquivo inteiro, ou nada. Linhas bloqueadas ficam de fora (aparecem na previa).
export async function confirmarImportacao(
  conteudo: string,
  nomeArquivo: string | null
): Promise<{ importacao_id: number; previa: PreviaImportacao }> {
  const { previa, produtos } = await reconciliar(conteudo);
  if (produtos.length === 0) {
    throw new ErroImportacao('Nenhuma linha valida no arquivo, nada foi gravado.');
  }

  const agora = new Date().toISOString();
  const filialPadrao = produtos.find((p) => p.filial)?.filial ?? FILIAL_PADRAO;
  const idPorCodigo = `(SELECT id FROM produtos WHERE codigo = ?)`;
  const stmts: InStatement[] = [];

  for (const p of produtos) {
    stmts.push({
      sql: `
        INSERT INTO produtos (codigo, nome, codigo_barras, qt_por_cx) VALUES (?, ?, ?, ?)
        ON CONFLICT(codigo) DO UPDATE SET
          nome = excluded.nome,
          codigo_barras = excluded.codigo_barras,
          qt_por_cx = COALESCE(excluded.qt_por_cx, produtos.qt_por_cx)
      `,
      args: [p.codigo, p.nome, p.codigo_barras, p.qt_por_cx],
    });
    // Saldo do produto e substituido inteiro pelo do arquivo (1 linha por produto). Sem
    // saldo no Winthor tambem grava linha com 0: sem linha, o produto sumiria da
    // reconciliacao e uma sobra fisica nao seria alertada.
    stmts.push({ sql: `DELETE FROM estoque_erp_saldo WHERE produto_id = ${idPorCodigo}`, args: [p.codigo] });
    stmts.push({
      sql: `INSERT INTO estoque_erp_saldo (produto_id, filial, saldo, atualizado_em) VALUES (${idPorCodigo}, ?, ?, ?)`,
      args: [p.codigo, p.filial ?? filialPadrao, p.saldo, agora],
    });
  }

  const t = previa.totais;
  const indiceInsertImportacao = stmts.length;
  stmts.push({
    sql: `
      INSERT INTO importacoes_saldo (criado_em, nome_arquivo, linhas_lidas, linhas_bloqueadas, produtos_arquivo,
        produtos_novos, novo, sem_mudanca, entrou, saiu, sobra)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [agora, nomeArquivo, t.linhas_lidas, t.linhas_bloqueadas, t.produtos_arquivo, t.produtos_novos, t.novo, t.sem_mudanca, t.entrou, t.saiu, t.sobra],
  });
  for (const item of previa.itens) {
    stmts.push({
      sql: `
        INSERT INTO importacoes_saldo_itens (importacao_id, produto_id, codigo, nome, saldo_anterior, saldo_novo,
          posicionado, nao_posicionado, sobra, status)
        VALUES ((SELECT MAX(id) FROM importacoes_saldo), ${idPorCodigo}, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [item.codigo, item.codigo, item.nome, item.saldo_anterior, item.saldo_novo, item.posicionado, item.nao_posicionado, item.sobra, item.status],
    });
  }

  const resultados = await db.batch(stmts, 'write');
  return { importacao_id: Number(resultados[indiceInsertImportacao].lastInsertRowid), previa };
}

// Data/hora do ultimo saldo gravado (import mais recente). A pendencia de posicionamento e
// saldo desse momento - alocado de agora: quanto mais velho, mais baixa feita depois do
// import aparece como "nao posicionado" que nao existe. A tela mostra isso pro usuario.
// Fallback em estoque_erp_saldo cobre saldo gravado antes do historico de imports existir.
export async function ultimaAtualizacaoSaldo(): Promise<string | null> {
  const rs = await db.execute(`
    SELECT MAX(quando) as quando FROM (
      SELECT MAX(criado_em) as quando FROM importacoes_saldo
      UNION ALL
      SELECT MAX(atualizado_em) FROM estoque_erp_saldo
    )
  `);
  return ((rs.rows[0] as any)?.quando as string | null) ?? null;
}

export class ErroImportacao extends Error {}

export interface ImportacaoResumo {
  id: number;
  criado_em: string;
  nome_arquivo: string | null;
  linhas_lidas: number;
  linhas_bloqueadas: number;
  produtos_arquivo: number;
  produtos_novos: number;
  novo: number;
  sem_mudanca: number;
  entrou: number;
  saiu: number;
  sobra: number;
}

export interface ItemHistoricoImportacao {
  produto_id: number | null;
  codigo: string;
  nome: string;
  saldo_anterior: number | null;
  saldo_novo: number;
  posicionado: number;
  nao_posicionado: number;
  sobra: number;
  status: StatusReconciliacao;
}

export async function listarImportacoes(limite = 50): Promise<ImportacaoResumo[]> {
  const rs = await db.execute({ sql: `SELECT * FROM importacoes_saldo ORDER BY id DESC LIMIT ?`, args: [limite] });
  return (rs.rows as any[]).map((r) => ({
    id: Number(r.id),
    criado_em: r.criado_em,
    nome_arquivo: r.nome_arquivo ?? null,
    linhas_lidas: Number(r.linhas_lidas),
    linhas_bloqueadas: Number(r.linhas_bloqueadas),
    produtos_arquivo: Number(r.produtos_arquivo),
    produtos_novos: Number(r.produtos_novos),
    novo: Number(r.novo),
    sem_mudanca: Number(r.sem_mudanca),
    entrou: Number(r.entrou),
    saiu: Number(r.saiu),
    sobra: Number(r.sobra),
  }));
}

export async function itensImportacao(importacaoId: number): Promise<ItemHistoricoImportacao[]> {
  const rs = await db.execute({
    sql: `SELECT * FROM importacoes_saldo_itens WHERE importacao_id = ?`,
    args: [importacaoId],
  });
  return (rs.rows as any[])
    .map((r) => ({
      produto_id: r.produto_id != null ? Number(r.produto_id) : null,
      codigo: r.codigo,
      nome: r.nome,
      saldo_anterior: r.saldo_anterior != null ? Number(r.saldo_anterior) : null,
      saldo_novo: Number(r.saldo_novo),
      posicionado: Number(r.posicionado),
      nao_posicionado: Number(r.nao_posicionado),
      sobra: Number(r.sobra),
      status: r.status as StatusReconciliacao,
    }))
    .sort((a, b) => ORDEM_STATUS[a.status] - ORDEM_STATUS[b.status] || a.nome.localeCompare(b.nome));
}
