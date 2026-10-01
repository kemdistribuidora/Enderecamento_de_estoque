// CLI do import do arquivo Winthor (rotina D860), mesma regra da aba Importar Winthor.
// Uso:
//   npm run import:winthor -- caminho/arquivo.csv              -> so mostra a previa
//   npm run import:winthor -- caminho/arquivo.csv --confirmar  -> grava
import fs from 'fs';
import { initSchema } from '../db/client';
import { confirmarImportacao, PreviaImportacao, previaImportacao } from '../services/importacao-winthor.service';

// D860 costuma sair em Windows-1252: UTF-8 estrito primeiro, se falhar e Windows-1252
function lerArquivo(caminho: string): string {
  const buffer = fs.readFileSync(caminho);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

function imprimir(previa: PreviaImportacao) {
  const t = previa.totais;
  console.log(
    `Linhas: ${t.linhas_lidas} lidas, ${t.linhas_bloqueadas} bloqueadas | Produtos no arquivo: ${t.produtos_arquivo} ` +
      `(${t.produtos_novos} novos no cadastro) | Fora do arquivo (nao alterados): ${t.produtos_fora_arquivo}`
  );
  console.log(`Entrou: ${t.entrou} | Saiu: ${t.saiu} | Primeiro saldo: ${t.novo} | Sem mudanca: ${t.sem_mudanca} | SOBRA: ${t.sobra}`);
  for (const b of previa.bloqueadas) console.warn(`BLOQUEADA linha ${b.linha}: ${b.motivo} -> ${b.conteudo}`);
  for (const a of previa.avisos) console.warn(`AVISO ${a}`);
  for (const i of previa.itens.filter((i) => i.status === 'sobra')) {
    const posicoes = i.posicoes.map((p) => `${p.endereco_codigo}=${p.quantidade} (val ${p.validade})`).join(', ');
    console.warn(`SOBRA ${i.codigo} ${i.nome}: Winthor ${i.saldo_novo}, posicionado ${i.posicionado}, retirar ${i.sobra} -> ${posicoes}`);
  }
}

async function main(caminho: string, confirmar: boolean) {
  await initSchema();
  const conteudo = lerArquivo(caminho);
  if (confirmar) {
    const { importacao_id, previa } = await confirmarImportacao(conteudo, caminho);
    imprimir(previa);
    console.log(`Importacao #${importacao_id} gravada.`);
  } else {
    imprimir(await previaImportacao(conteudo));
    console.log('So previa, nada gravado. Rode com --confirmar pra gravar.');
  }
}

const caminho = process.argv[2];
if (!caminho) {
  console.error('Uso: npm run import:winthor -- caminho/arquivo.csv [--confirmar]');
  process.exit(1);
}

main(caminho, process.argv.includes('--confirmar')).catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
