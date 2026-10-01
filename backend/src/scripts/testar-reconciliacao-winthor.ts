// Teste da reconciliacao saldo Winthor x estoque fisico. Roda SEMPRE num banco SQLite
// temporario proprio (sobrescreve TURSO_DATABASE_URL antes de carregar o client), entao
// nunca toca data.sqlite nem o Turso de producao.
// Uso: npm run test:reconciliacao
import fs from 'fs';
import os from 'os';
import path from 'path';

const arquivoDb = path.join(os.tmpdir(), `teste-reconciliacao-${Date.now()}.sqlite`);
process.env.TURSO_DATABASE_URL = `file:${arquivoDb}`;
delete process.env.TURSO_AUTH_TOKEN;

let falhas = 0;
function verificar(condicao: boolean, descricao: string) {
  if (condicao) console.log(`  ok   ${descricao}`);
  else {
    falhas++;
    console.error(`  FALHA ${descricao}`);
  }
}

async function main() {
  const { db, initSchema } = await import('../db/client');
  const svc = await import('../services/importacao-winthor.service');
  const { arredondarQtd } = await import('../utils/quantidade');
  await initSchema();

  const saldoDe = async (codigo: string) => {
    const rs = await db.execute({
      sql: `SELECT ROUND(SUM(s.saldo), 6) as total, COUNT(*) as n FROM estoque_erp_saldo s JOIN produtos p ON p.id = s.produto_id WHERE p.codigo = ?`,
      args: [codigo],
    });
    const r = rs.rows[0] as any;
    return Number(r.n) === 0 ? null : Number(r.total);
  };
  const ocupar = async (codigo: string, endereco: string, quantidade: number, validade: string) => {
    await db.execute({
      sql: `INSERT INTO estoque_posicoes (produto_id, endereco_id, quantidade, validade, criado_em)
            VALUES ((SELECT id FROM produtos WHERE codigo = ?), (SELECT id FROM enderecos WHERE codigo = ?), ?, ?, ?)`,
      args: [codigo, endereco, quantidade, validade, new Date().toISOString()],
    });
  };
  const item = (previa: any, codigo: string) => previa.itens.find((i: any) => i.codigo === codigo);
  const regraCentral = (previa: any) =>
    previa.itens.every((i: any) => arredondarQtd(i.posicionado + i.nao_posicionado - i.sobra) === i.saldo_novo);

  console.log('arredondamento');
  verificar(arredondarQtd(10.3 - 0.1) === 10.2, '10.3 - 0.1 = 10.2');
  verificar(arredondarQtd(0.3 - 0.1 - 0.2) === 0, '0.3 - 0.1 - 0.2 = 0');
  verificar(Object.is(arredondarQtd(-0.0000001), 0), '-0.0000001 vira 0 (sem -0)');
  verificar(arredondarQtd(0.10009) === 0.10009, 'mantem 5 casas do Winthor (.10009)');

  console.log('formato Oracle: decimal sem zero antes do ponto (linhas reais do D860)');
  const oracle = svc.parsearArquivoWinthor(
    [
      '1974;QUEIJO PARMESÃO EM CUNHAS KG;1974;.5;1;1974;1',
      '1975;QUEIJO PRATO (LANCHE) PÇ 2,5KG;;2.5;1;1975;0',
      '2005;QUEIJO MUSS. FATIADO LATSUL 2 KG;2005;2;1;2005;.10009',
      '2072;FILE PEITO FRANGO SEARA KG;7894904986446;16;1;2072;-.24',
      '895;COXA C/ SOBRE DE FRANGO CANCAO KG;895;18;1;895;-.07991',
      'X1;QT CX NEGATIVA;1;-.5;1;X1;1',
      'X2;SALDO SO PONTO;1;1;1;X2;.',
    ].join('\n')
  );
  const porCodigo = new Map(oracle.produtos.map((p) => [p.codigo, p]));
  verificar(oracle.produtos.length === 5, '5 linhas reais aceitas');
  verificar(porCodigo.get('1974')?.qt_por_cx === 0.5 && porCodigo.get('1975')?.qt_por_cx === 2.5, 'qt_por_cx fracionado .5 e 2.5');
  verificar(porCodigo.get('2005')?.saldo === 0.10009, 'saldo .10009');
  verificar(porCodigo.get('2072')?.saldo === -0.24 && porCodigo.get('895')?.saldo === -0.07991, 'saldo negativo -.24 e -.07991');
  verificar(oracle.avisos.filter((a) => a.includes('negativo')).length === 2, 'aviso pros 2 saldos negativos');
  verificar(oracle.bloqueadas.length === 2, 'qt_por_cx negativo e saldo "." sozinho continuam bloqueados');

  console.log('import 1: carga inicial (arquivo no formato real do D860)');
  const arquivo1 = [
    'A;PRODUTO A;7890000000011;10;1;A;100',
    'B;SOBRECOXA KG;17896295389230;18;1;B;1684.089',
    'C;PRODUTO C SEM SALDO;333;;;;',
    'D;PRODUTO D;444;6;1;D;50',
    'K;PRODUTO K;555;1;1;K;20',
  ].join('\r\n');
  const previa1 = await svc.previaImportacao(arquivo1);
  verificar(previa1.totais.novo === 5 && previa1.totais.produtos_novos === 5, '5 produtos novos');
  verificar((await saldoDe('A')) === null, 'previa nao grava nada');
  await svc.confirmarImportacao(arquivo1, 'arquivo1.csv');
  verificar((await saldoDe('A')) === 100, 'A saldo 100');
  verificar((await saldoDe('B')) === 1684.089, 'B saldo fracionado 1684.089 exato');
  verificar((await saldoDe('C')) === 0, 'C sem saldo no Winthor grava 0 (nao some da reconciliacao)');

  // posiciona: A parcial, B inteiro em 2 pallets fracionados, D inteiro, C posicionado sem saldo, K parcial
  await ocupar('A', 'ESP-01', 60, '2027-01-01');
  await ocupar('B', 'ESP-02', 1000.5, '2027-01-01');
  await ocupar('B', 'ESP-03', 683.589, '2027-02-01');
  await ocupar('D', 'ESP-04', 30, '2026-10-01');
  await ocupar('D', 'ESP-05', 20, '2027-03-01');
  await ocupar('C', 'ESP-06', 5, '2027-01-01');
  await ocupar('K', 'ESP-07', 10, '2027-01-01');

  console.log('import 2: arquivo parcial com todos os casos');
  const arquivo2 = [
    'A;PRODUTO A;7890000000011;10;1;A;130', // entrou +30
    'B;SOBRECOXA KG;17896295389230;18;1;B;1684.089', // sem mudanca, soma fracionada tem que bater
    'D;PRODUTO D;444;6;1;D;40', // Winthor caiu 10, nao posicionado 0 -> sobra 10
    'E;PRODUTO E NOVO;666;;1;E;7', // novo
    'F;PRODUTO F;777;;1;F;5',
    'F;PRODUTO F;777;;1;F;5', // repetido igual -> 1 vez + aviso
    'G;PRODUTO G;888;;1;G;5',
    'G;PRODUTO G;888;;1;G;6', // repetido diferente -> bloqueia as 2
    'H;PRODUTO H;999;;1;H;1,5', // virgula -> bloqueia
    'I;PRODUTO I;111;;1;I', // 6 campos -> bloqueia
    'J;PRODUTO J;222;;1;X;3', // coluna 6 diferente -> bloqueia
    'K;PRODUTO K;555;1;1;K;15', // saiu 5, absorvido pelo nao posicionado (10 -> 5)
    '', // linha vazia ignorada
    // C fora do arquivo: nao pode ser tocado
  ].join('\n');
  const previa2 = await svc.previaImportacao(arquivo2);
  verificar(regraCentral(previa2), 'posicionado + nao_posicionado - sobra = arquivo, pra todo item');
  const a = item(previa2, 'A');
  verificar(a.status === 'entrou' && a.delta === 30 && a.nao_posicionado_antes === 40 && a.nao_posicionado === 70, 'A entrou +30, nao posicionado 40 -> 70');
  const b = item(previa2, 'B');
  verificar(b.status === 'sem_mudanca' && b.posicionado === 1684.089 && b.nao_posicionado === 0 && b.sobra === 0, 'B fracionado bate exato, sem sobra falsa');
  const d = item(previa2, 'D');
  verificar(d.status === 'sobra' && d.sobra === 10 && d.nao_posicionado === 0, 'D sobra 10 (saiu no Winthor, posicao nao retirada)');
  verificar(d.posicoes.length === 2 && d.posicoes[0].endereco_codigo === 'ESP-04', 'D lista posicoes com validade mais antiga primeiro');
  const k = item(previa2, 'K');
  verificar(k.status === 'saiu' && k.delta === -5 && k.nao_posicionado_antes === 10 && k.nao_posicionado === 5 && k.sobra === 0, 'K saiu 5, reduz nao posicionado 10 -> 5');
  verificar(item(previa2, 'E').status === 'novo' && item(previa2, 'E').produto_novo, 'E produto novo');
  verificar(previa2.itens.filter((i: any) => i.codigo === 'F').length === 1 && previa2.avisos.some((x) => x.includes('F')), 'F repetido igual conta 1 vez com aviso');
  verificar(!item(previa2, 'G') && previa2.bloqueadas.filter((x) => x.conteudo.startsWith('G;')).length === 2, 'G repetido com saldo diferente: as 2 linhas bloqueadas');
  verificar(previa2.bloqueadas.some((x) => x.conteudo.startsWith('H;') && x.motivo.includes('saldo invalido')), 'H saldo com virgula bloqueado');
  verificar(previa2.bloqueadas.some((x) => x.conteudo.startsWith('I;')), 'I com 6 campos bloqueado');
  verificar(previa2.bloqueadas.some((x) => x.conteudo.startsWith('J;')), 'J coluna 6 diferente bloqueado');
  verificar(!item(previa2, 'C'), 'C fora do arquivo nao aparece');
  verificar(previa2.totais.produtos_fora_arquivo === 1, '1 produto cadastrado fora do arquivo (C)');
  verificar(previa2.totais.linhas_lidas === 12, '12 linhas lidas (vazia nao conta)');

  console.log('atomicidade: falha no meio nao grava nada');
  await db.execute(`ALTER TABLE importacoes_saldo_itens RENAME TO itens_tmp`);
  let falhou = false;
  try {
    await svc.confirmarImportacao(arquivo2, 'arquivo2.csv');
  } catch {
    falhou = true;
  }
  await db.execute(`ALTER TABLE itens_tmp RENAME TO importacoes_saldo_itens`);
  verificar(falhou, 'confirmacao falhou');
  verificar((await saldoDe('A')) === 100 && (await saldoDe('E')) === null, 'nenhum saldo/produto gravado pela confirmacao que falhou');

  console.log('import 2 confirmado');
  const { importacao_id } = await svc.confirmarImportacao(arquivo2, 'arquivo2.csv');
  verificar((await saldoDe('A')) === 130, 'A saldo 130');
  verificar((await saldoDe('D')) === 40, 'D saldo 40');
  verificar((await saldoDe('K')) === 15, 'K saldo 15');
  verificar((await saldoDe('E')) === 7, 'E cadastrado com saldo 7');
  verificar((await saldoDe('C')) === 0, 'C intocado (continua 0)');
  verificar((await saldoDe('G')) === null && (await saldoDe('H')) === null, 'bloqueados nao gravados');
  const posD = await db.execute(`SELECT COUNT(*) as n FROM estoque_posicoes ep JOIN produtos p ON p.id = ep.produto_id WHERE p.codigo = 'D'`);
  verificar(Number((posD.rows[0] as any).n) === 2, 'sobra nao mexe nas posicoes (so alerta)');

  const historico = await svc.listarImportacoes();
  verificar(historico.length === 2 && historico[0].id === importacao_id, '2 imports no historico (o que falhou nao entrou)');
  verificar(historico[0].sobra === 1 && historico[0].entrou === 1 && historico[0].saiu === 1 && historico[0].novo === 2, 'totais do historico');
  const itensHist = await svc.itensImportacao(importacao_id);
  verificar(itensHist.length === previa2.itens.length && itensHist[0].status === 'sobra', 'itens do historico, sobra primeiro');

  console.log('import 3: mesmo arquivo de novo = nada muda');
  const previa3 = await svc.previaImportacao(arquivo2);
  verificar(item(previa3, 'A').status === 'sem_mudanca' && item(previa3, 'K').status === 'sem_mudanca', 'reimportar e idempotente');
  verificar(item(previa3, 'D').status === 'sobra', 'sobra continua ate alguem baixar a posicao');

  db.close();
  try {
    fs.rmSync(arquivoDb, { force: true });
  } catch {
    // Windows pode manter o arquivo travado logo apos o close; fica na pasta temp do SO
  }
  console.log(falhas === 0 ? '\nTUDO OK' : `\n${falhas} FALHA(S)`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
