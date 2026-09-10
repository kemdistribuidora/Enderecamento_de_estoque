// Parsing + gravacao dos CSVs exportados do Winthor via rotina D860.
// Usado tanto pelos scripts CLI (src/scripts/import-winthor-*.ts) quanto pela rota
// de upload (src/routes/importacao.routes.ts) -- uma fonte so pra regra de parsing.
import { db } from '../db/client';

export interface ProdutoComSaldoImportado {
  produto_id: number;
  codigo: string;
  nome: string;
  filial: string;
  saldo: number;
}

export interface ResultadoImportacao {
  ok: number;
  falhas: number;
  avisos: string[];
  // preenchido so por importarSaldoCsv: produtos que vieram com saldo > 0,
  // pra tela de importacao oferecer alocar endereco na hora
  produtosComSaldo: ProdutoComSaldoImportado[];
}

// produtos: sem cabecalho, separador ';', colunas: codigo;nome;codigo_barras[;qt_por_cx]
// qt_por_cx e opcional (4o campo) -- se vier vazio ou a linha so tiver 3 campos,
// mantem o valor ja gravado (nao apaga um qt_por_cx existente por causa de um
// arquivo antigo sem essa coluna).
export async function importarProdutosCsv(conteudo: string): Promise<ResultadoImportacao> {
  const linhas = conteudo.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const avisos: string[] = [];
  let ok = 0;

  for (const [i, linha] of linhas.entries()) {
    const campos = linha.split(';').map((c) => c.trim());
    if (campos.length !== 3 && campos.length !== 4) {
      avisos.push(`Linha ${i + 1} ignorada (esperado 3 ou 4 campos, veio ${campos.length}): ${linha}`);
      continue;
    }

    const [codigo, nome, codigo_barras, qtPorCxStr] = campos;
    if (!codigo || !nome) {
      avisos.push(`Linha ${i + 1} ignorada (codigo ou nome vazio): ${linha}`);
      continue;
    }

    let qtPorCx: number | null = null;
    if (qtPorCxStr) {
      qtPorCx = Number(qtPorCxStr);
      if (Number.isNaN(qtPorCx)) {
        avisos.push(`Linha ${i + 1} ignorada (qt_por_cx invalido): ${linha}`);
        continue;
      }
    }

    await db.execute({
      sql: `
        INSERT INTO produtos (codigo, nome, codigo_barras, qt_por_cx) VALUES (?, ?, ?, ?)
        ON CONFLICT(codigo) DO UPDATE SET
          nome = excluded.nome,
          codigo_barras = excluded.codigo_barras,
          qt_por_cx = COALESCE(excluded.qt_por_cx, produtos.qt_por_cx)
      `,
      args: [codigo, nome, codigo_barras ?? '', qtPorCx],
    });
    ok++;
  }

  return { ok, falhas: avisos.length, avisos, produtosComSaldo: [] };
}

// saldo: sem cabecalho, separador ';', colunas: filial;codigo;saldo
// Precisa que o produto ja exista (rodar importarProdutosCsv antes); produto nao
// encontrado gera aviso e a linha e ignorada.
export async function importarSaldoCsv(conteudo: string): Promise<ResultadoImportacao> {
  const linhas = conteudo.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const avisos: string[] = [];
  const produtosComSaldo: ProdutoComSaldoImportado[] = [];
  const agora = new Date().toISOString();
  let ok = 0;

  for (const [i, linha] of linhas.entries()) {
    const campos = linha.split(';').map((c) => c.trim());
    while (campos.length > 3 && campos[campos.length - 1] === '') campos.pop();
    if (campos.length !== 3) {
      avisos.push(`Linha ${i + 1} ignorada (esperado 3 campos, veio ${campos.length}): ${linha}`);
      continue;
    }

    const [filial, codigo, saldoStr] = campos;
    const saldo = Number(saldoStr);
    if (!filial || !codigo || Number.isNaN(saldo)) {
      avisos.push(`Linha ${i + 1} ignorada (campo invalido): ${linha}`);
      continue;
    }

    const produtoRs = await db.execute({ sql: `SELECT id, nome FROM produtos WHERE codigo = ?`, args: [codigo] });
    const produto = produtoRs.rows[0] as any;
    if (!produto) {
      avisos.push(`Linha ${i + 1} ignorada (produto codigo=${codigo} nao cadastrado): ${linha}`);
      continue;
    }

    await db.execute({
      sql: `
        INSERT INTO estoque_erp_saldo (produto_id, filial, saldo, atualizado_em) VALUES (?, ?, ?, ?)
        ON CONFLICT(produto_id, filial) DO UPDATE SET saldo = excluded.saldo, atualizado_em = excluded.atualizado_em
      `,
      args: [Number(produto.id), filial, saldo, agora],
    });
    ok++;

    if (saldo > 0) {
      produtosComSaldo.push({ produto_id: Number(produto.id), codigo, nome: produto.nome, filial, saldo });
    }
  }

  return { ok, falhas: avisos.length, avisos, produtosComSaldo };
}
