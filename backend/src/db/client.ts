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
}
