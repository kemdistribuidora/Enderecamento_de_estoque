import { createClient, Client } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Sem TURSO_DATABASE_URL -> usa arquivo local (bom pra dev sem depender de conta Turso).
// Com TURSO_DATABASE_URL (libsql://...) + TURSO_AUTH_TOKEN -> conecta no banco remoto,
// compartilhado entre todas as maquinas que rodam o app.
const url = process.env.TURSO_DATABASE_URL ?? `file:${path.join(__dirname, '..', '..', 'data.sqlite')}`;
const authToken = process.env.TURSO_AUTH_TOKEN;

export const db: Client = createClient({ url, authToken });

export async function initSchema(): Promise<void> {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  await db.executeMultiple(schema);
  await adicionarColunaSeNaoExiste('estoque_posicoes', 'lote', 'TEXT');
  await adicionarColunaSeNaoExiste('movimentacoes', 'lote', 'TEXT');
  await adicionarColunaSeNaoExiste('produtos', 'peso_caixa', 'REAL');
  await adicionarColunaSeNaoExiste('estoque_posicoes', 'criado_em', 'TEXT');
  const prateleirasNovas = await adicionarColunaSeNaoExiste('prateleiras', 'letra', `TEXT NOT NULL DEFAULT ''`);
  await adicionarColunaSeNaoExiste('prateleiras', 'lado', `TEXT NOT NULL DEFAULT 'D'`);
  const corredoresNovo = await adicionarColunaSeNaoExiste('corredores', 'apos_prateleira_ordem', 'INTEGER NOT NULL DEFAULT 0');
  if (prateleirasNovas) await preencherDonoPrateleirasExistentes();
  if (corredoresNovo) await db.execute(`UPDATE corredores SET apos_prateleira_ordem = ordem`);
  await garantirPrateleiraBeCamaraResfriados();
}

// schema.sql so cria tabela nova (CREATE TABLE IF NOT EXISTS); pra coluna em tabela que ja
// existe (o Turso remoto ja tem estoque_posicoes/movimentacoes com dados), precisa de ALTER
// TABLE manual, condicionado a coluna ainda nao existir. Roda em todo boot, sem custo real
// depois da primeira vez (PRAGMA e rapido). Retorna true so na vez que de fato criou a coluna
// (pra quem chamou decidir se precisa rodar backfill).
async function adicionarColunaSeNaoExiste(tabela: string, coluna: string, tipo: string): Promise<boolean> {
  const info = await db.execute(`PRAGMA table_info(${tabela})`);
  const existe = (info.rows as any[]).some((r) => r.name === coluna);
  if (existe) return false;
  try {
    await db.execute(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${tipo}`);
    return true;
  } catch (e: any) {
    // duas instancias do backend subindo ao mesmo tempo contra o mesmo Turso remoto podem
    // correr aqui -- se a outra ja adicionou a coluna entre nosso PRAGMA e nosso ALTER, ignora.
    if (!String(e?.message).includes('duplicate column')) throw e;
    return false;
  }
}

// Prateleiras criadas antes da coluna letra/lado existir nasceram com letra='' (default).
// Todas elas, na epoca, seguiam a regra antiga (N corredores -> N+1 prateleiras alternadas,
// dona = corredor a esquerda lado D, excecao ordem=0 = corredor[0] lado E) -- entao da pra
// recalcular com seguranca, setor por setor.
async function preencherDonoPrateleirasExistentes(): Promise<void> {
  const { donoPrateleira } = await import('../services/endereco.service');
  const setoresRs = await db.execute(`SELECT id FROM setores`);
  for (const setorRow of setoresRs.rows as any[]) {
    const setorId = Number(setorRow.id);
    const corredoresRs = await db.execute({
      sql: `SELECT letra FROM corredores WHERE setor_id = ? ORDER BY ordem`,
      args: [setorId],
    });
    const corredores = (corredoresRs.rows as any[]).map((r) => ({ letra: r.letra as string }));
    if (corredores.length === 0) continue;

    const prateleirasRs = await db.execute({
      sql: `SELECT id, ordem FROM prateleiras WHERE setor_id = ? AND letra = ''`,
      args: [setorId],
    });
    for (const p of prateleirasRs.rows as any[]) {
      const dono = donoPrateleira(corredores, Number(p.ordem));
      await db.execute({
        sql: `UPDATE prateleiras SET letra = ?, lado = ? WHERE id = ?`,
        args: [dono.letra, dono.lado, Number(p.id)],
      });
    }
  }
}

// Migracao pontual, aditiva (nao mexe em estoque_posicoes/movimentacoes existentes):
// insere a prateleira BE encostada na AD no setor 'Câmara Resfriados 1', pra quem ja tem
// banco (Turso remoto com estoque real) e nao pode simplesmente rodar o seed de novo
// (apagaria tudo). Idempotente -- se a BE ja existe, nao faz nada. Enderecos gerados
// espelhando o mesmo andares/posicoes-por-andar que a AD ja tem, pra nao depender de
// constante hardcoded que pode ter mudado desde o seed original.
async function garantirPrateleiraBeCamaraResfriados(): Promise<void> {
  const { formatarEndereco } = await import('../services/endereco.service');

  const setorRs = await db.execute({
    sql: `SELECT id FROM setores WHERE nome = ?`,
    args: ['Câmara Resfriados 1'],
  });
  const setorRow = setorRs.rows[0] as any;
  if (!setorRow) return;
  const setorId = Number(setorRow.id);

  const jaExisteRs = await db.execute({
    sql: `SELECT id FROM prateleiras WHERE setor_id = ? AND letra = 'B' AND lado = 'E'`,
    args: [setorId],
  });
  if (jaExisteRs.rows.length > 0) return;

  const adRs = await db.execute({
    sql: `SELECT id, ordem FROM prateleiras WHERE setor_id = ? AND letra = 'A' AND lado = 'D'`,
    args: [setorId],
  });
  const adRow = adRs.rows[0] as any;
  if (!adRow) return; // setor ainda sem prateleiras (banco novo, seed vai cuidar disso)
  const adPrateleiraId = Number(adRow.id);
  const adOrdem = Number(adRow.ordem);
  const novaOrdem = adOrdem + 1;

  // abre espaco pra BE deslocando +1 tudo que vem depois da AD, da mais alta ordem pra
  // mais baixa (individualmente) pra nunca colidir com o UNIQUE(setor_id, ordem) no meio do caminho.
  const aDeslocarRs = await db.execute({
    sql: `SELECT id, ordem FROM prateleiras WHERE setor_id = ? AND ordem > ? ORDER BY ordem DESC`,
    args: [setorId, adOrdem],
  });
  for (const r of aDeslocarRs.rows as any[]) {
    await db.execute({ sql: `UPDATE prateleiras SET ordem = ordem + 1 WHERE id = ?`, args: [Number(r.id)] });
  }

  // corredor que antes passava logo apos a AD agora passa logo apos a BE (ela que vira
  // o novo "fim do bloco" AD+BE); corredores mais adiante deslocam junto. Ordem importa:
  // desloca ">" primeiro, senao o UPDATE seguinte (== adOrdem) pega de novo quem acabou
  // de virar novaOrdem e desloca duas vezes.
  await db.execute({
    sql: `UPDATE corredores SET apos_prateleira_ordem = apos_prateleira_ordem + 1 WHERE setor_id = ? AND apos_prateleira_ordem > ?`,
    args: [setorId, adOrdem],
  });
  await db.execute({
    sql: `UPDATE corredores SET apos_prateleira_ordem = ? WHERE setor_id = ? AND apos_prateleira_ordem = ?`,
    args: [novaOrdem, setorId, adOrdem],
  });

  const beInfo = await db.execute({
    sql: `INSERT INTO prateleiras (setor_id, ordem, letra, lado) VALUES (?, ?, 'B', 'E')`,
    args: [setorId, novaOrdem],
  });
  const bePrateleiraId = Number(beInfo.lastInsertRowid);

  const adEnderecosRs = await db.execute({
    sql: `SELECT andar, posicao FROM enderecos WHERE prateleira_id = ?`,
    args: [adPrateleiraId],
  });
  const porAndar = new Map<number, number>(); // andar -> maior posicao
  for (const r of adEnderecosRs.rows as any[]) {
    const andar = Number(r.andar);
    const posicao = Number(r.posicao);
    porAndar.set(andar, Math.max(porAndar.get(andar) ?? 0, posicao));
  }

  for (const [andar, maxPosicao] of [...porAndar.entries()].sort((a, b) => b[0] - a[0])) {
    for (let posicao = 1; posicao <= maxPosicao; posicao++) {
      const codigo = formatarEndereco('B', 'E', andar, posicao);
      await db.execute({
        sql: `INSERT INTO enderecos (prateleira_id, corredor, lado, andar, posicao, codigo) VALUES (?, 'B', 'E', ?, ?, ?)`,
        args: [bePrateleiraId, andar, posicao, codigo],
      });
    }
  }
}
