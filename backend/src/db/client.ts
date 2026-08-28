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
}

// schema.sql so cria tabela nova (CREATE TABLE IF NOT EXISTS); pra coluna em tabela que ja
// existe (o Turso remoto ja tem estoque_posicoes/movimentacoes com dados), precisa de ALTER
// TABLE manual, condicionado a coluna ainda nao existir. Roda em todo boot, sem custo real
// depois da primeira vez (PRAGMA e rapido).
async function adicionarColunaSeNaoExiste(tabela: string, coluna: string, tipo: string): Promise<void> {
  const info = await db.execute(`PRAGMA table_info(${tabela})`);
  const existe = (info.rows as any[]).some((r) => r.name === coluna);
  if (existe) return;
  try {
    await db.execute(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${tipo}`);
  } catch (e: any) {
    // duas instancias do backend subindo ao mesmo tempo contra o mesmo Turso remoto podem
    // correr aqui -- se a outra ja adicionou a coluna entre nosso PRAGMA e nosso ALTER, ignora.
    if (!String(e?.message).includes('duplicate column')) throw e;
  }
}
