// Backup do banco: dump de todas as tabelas em 1 JSON datado.
//   npm run backup                      -> usa o banco do .env (local se TURSO_* comentado)
//   npm run backup -- --env .env.backup -> usa outro arquivo de env (agendamento diario
//                                          aponta pro Turso remoto sem mexer no .env de dev)
// Pasta: BACKUP_DIR do env ou, padrao, ../../backups-enderecamento (fora do repo). Guarda
// os ultimos BACKUP_MANTER arquivos (padrao 30) e apaga os mais antigos.
// Restaurar = reinserir as linhas do JSON (sem script de restore ainda).
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const iEnv = process.argv.indexOf('--env');
if (iEnv >= 0 && process.argv[iEnv + 1]) {
  // carrega antes do db/client (que chama dotenv.config() sem override, entao este vence)
  dotenv.config({ path: path.resolve(process.argv[iEnv + 1]) });
}

async function main() {
  const { db } = await import('../db/client');
  const remoto = Boolean(process.env.TURSO_DATABASE_URL);
  const pasta = path.resolve(process.env.BACKUP_DIR ?? path.join(__dirname, '..', '..', '..', '..', 'backups-enderecamento'));
  const manter = Number(process.env.BACKUP_MANTER) || 30;

  const tabelasRs = await db.execute(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_%' ESCAPE '\\' ORDER BY name`
  );
  const dump: Record<string, unknown[]> = {};
  let totalLinhas = 0;
  for (const row of tabelasRs.rows as any[]) {
    const tabela = String(row.name);
    const rs = await db.execute(`SELECT * FROM "${tabela}"`);
    dump[tabela] = rs.rows.map((r) => Object.fromEntries(rs.columns.map((c) => [c, (r as any)[c]])));
    totalLinhas += rs.rows.length;
  }

  fs.mkdirSync(pasta, { recursive: true });
  const carimbo = new Date().toISOString().replace(/[:.]/g, '-');
  const arquivo = path.join(pasta, `backup-${remoto ? 'turso' : 'local'}-${carimbo}.json`);
  fs.writeFileSync(arquivo, JSON.stringify({ gerado_em: new Date().toISOString(), origem: remoto ? 'turso' : 'local', tabelas: dump }, null, 1));

  const antigos = fs
    .readdirSync(pasta)
    .filter((f) => f.startsWith(`backup-${remoto ? 'turso' : 'local'}-`) && f.endsWith('.json'))
    .sort()
    .reverse()
    .slice(manter);
  for (const f of antigos) fs.unlinkSync(path.join(pasta, f));

  console.log(`Backup ${remoto ? 'TURSO REMOTO' : 'LOCAL (data.sqlite)'}: ${Object.keys(dump).length} tabelas, ${totalLinhas} linhas -> ${arquivo}`);
  if (antigos.length > 0) console.log(`Removidos ${antigos.length} backups antigos (mantendo ${manter}).`);
}

main().catch((e) => {
  console.error('Backup FALHOU:', e);
  process.exit(1);
});
