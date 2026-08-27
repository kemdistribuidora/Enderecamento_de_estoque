// Parsing + gravacao dos CSVs exportados do Winthor via rotina D860.
// Usado tanto pelos scripts CLI (src/scripts/import-winthor-*.ts) quanto pela rota
// de upload (src/routes/importacao.routes.ts) -- uma fonte so pra regra de parsing.
import { db } from '../db/client';

export interface ResultadoImportacao {
  ok: number;
  falhas: number;
  avisos: string[];
}

// produtos: sem cabecalho, separador ';', colunas: codigo;nome;codigo_barras
export async function importarProdutosCsv(conteudo: string): Promise<ResultadoImportacao> {
  const linhas = conteudo.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const avisos: string[] = [];
  let ok = 0;

  for (const [i, linha] of linhas.entries()) {
    const campos = linha.split(';');
    if (campos.length !== 3) {
      avisos.push(`Linha ${i + 1} ignorada (esperado 3 campos, veio ${campos.length}): ${linha}`);
      continue;
    }

    const [codigo, nome, codigo_barras] = campos.map((c) => c.trim());
    if (!codigo || !nome) {
      avisos.push(`Linha ${i + 1} ignorada (codigo ou nome vazio): ${linha}`);
      continue;
    }

    await db.execute({
      sql: `
        INSERT INTO produtos (codigo, nome, codigo_barras) VALUES (?, ?, ?)
        ON CONFLICT(codigo) DO UPDATE SET nome = excluded.nome, codigo_barras = excluded.codigo_barras
      `,
      args: [codigo, nome, codigo_barras ?? ''],
    });
    ok++;
  }

  return { ok, falhas: avisos.length, avisos };
}

// saldo: sem cabecalho, separador ';', colunas: filial;codigo;saldo
// Precisa que o produto ja exista (rodar importarProdutosCsv antes); produto nao
// encontrado gera aviso e a linha e ignorada.
export async function importarSaldoCsv(conteudo: string): Promise<ResultadoImportacao> {
  const linhas = conteudo.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const avisos: string[] = [];
  const agora = new Date().toISOString();
  let ok = 0;

  for (const [i, linha] of linhas.entries()) {
    const campos = linha.split(';');
    if (campos.length !== 3) {
      avisos.push(`Linha ${i + 1} ignorada (esperado 3 campos, veio ${campos.length}): ${linha}`);
      continue;
    }

    const [filial, codigo, saldoStr] = campos.map((c) => c.trim());
    const saldo = Number(saldoStr);
    if (!filial || !codigo || Number.isNaN(saldo)) {
      avisos.push(`Linha ${i + 1} ignorada (campo invalido): ${linha}`);
      continue;
    }

    const produtoRs = await db.execute({ sql: `SELECT id FROM produtos WHERE codigo = ?`, args: [codigo] });
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
  }

  return { ok, falhas: avisos.length, avisos };
}
