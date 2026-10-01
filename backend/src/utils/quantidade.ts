// Quantidade/saldo pode ser fracionado (produto KG vem do Winthor com ate 5 casas, ex:
// .10009, -.07991). Conta em ponto flutuante gera lixo (10.3 - 0.1 = 10.200000000000001),
// e esse lixo vira divergencia falsa na reconciliacao com o Winthor -- entao toda
// quantidade que e gravada ou comparada passa por aqui. Nas queries SQL o equivalente
// e ROUND(..., 6). 6 casas: cobre o Winthor sem cortar nada e ainda sobra precisao de
// double pra estoque ate bilhoes.
export const CASAS_QUANTIDADE = 6;

export function arredondarQtd(valor: number): number {
  const fator = 10 ** CASAS_QUANTIDADE;
  // + 0 normaliza -0 (ex: arredondar -0.0000001) pra 0
  return Math.round(valor * fator) / fator + 0;
}
