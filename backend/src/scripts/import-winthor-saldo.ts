// CLI pra importar saldo.csv exportado do Winthor via rotina D860 (filial 1).
// Precisa rodar import-winthor-produtos.ts ANTES: saldo casa por codigo ja cadastrado.
// Uso: npm run import:winthor:saldo -- caminho/saldo.csv
// (equivalente a fazer upload na aba Importar Winthor do sistema)
import fs from 'fs';
import { initSchema } from '../db/client';
import { importarSaldoCsv } from '../services/importacao-winthor.service';

async function main(caminho: string) {
  await initSchema();
  const conteudo = fs.readFileSync(caminho, 'utf-8');
  const resultado = await importarSaldoCsv(conteudo);
  for (const aviso of resultado.avisos) console.warn(aviso);
  console.log(`Import saldo OK: ${resultado.ok} gravados, ${resultado.falhas} ignorados.`);
}

const caminho = process.argv[2];
if (!caminho) {
  console.error('Uso: npm run import:winthor:saldo -- caminho/saldo.csv');
  process.exit(1);
}

main(caminho);
