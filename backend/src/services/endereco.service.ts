// Codigo de endereco = corredor (letra) + lado (E/D) + andar + posicao.
// Padrao inicial: 1+2 digitos (ex: AD302 = corredor A, lado D, andar 3, posicao 02).
// Trocar padrao de digitos == mudar so estas duas constantes.
const ANDAR_DIGITS = 1;
const POSICAO_DIGITS = 2;

export type Lado = 'E' | 'D';

export function formatarEndereco(corredor: string, lado: Lado, andar: number, posicao: number): string {
  const letra = corredor.trim().toUpperCase();
  const andarStr = String(andar).padStart(ANDAR_DIGITS, '0');
  const posicaoStr = String(posicao).padStart(POSICAO_DIGITS, '0');
  return `${letra}${lado}${andarStr}${posicaoStr}`;
}

// Inverte formatarEndereco.
export function parsearEndereco(codigo: string): { corredor: string; lado: Lado; andar: number; posicao: number } {
  const c = codigo.trim().toUpperCase();
  const match = c.match(/^([A-Z]+)([ED])(\d+)$/);
  if (!match) {
    throw new Error(`Codigo de endereco invalido: ${codigo}`);
  }
  const [, corredor, lado, digitos] = match;
  if (digitos.length !== ANDAR_DIGITS + POSICAO_DIGITS) {
    throw new Error(`Codigo de endereco com numero de digitos inesperado: ${codigo}`);
  }
  const andar = parseInt(digitos.slice(0, ANDAR_DIGITS), 10);
  const posicao = parseInt(digitos.slice(ANDAR_DIGITS), 10);
  return { corredor, lado: lado as Lado, andar, posicao };
}

export interface EnderecoParaSugestao {
  id: number;
  setor_id: number;
  prateleira_id: number;
  prateleira_ordem: number;
  andar: number;
  posicao: number;
}

// Menor custo = mais perto fisicamente. Mesma prateleira+andar: distancia = diferenca de
// posicao. Mesma prateleira, andar diferente: pula patamar (prateleiras tem prioridade
// sobre andar). Prateleira diferente: pula patamar maior ainda, usando a ordem global das
// prateleiras no setor (prateleira 0, corredor 0, prateleira 1, corredor 1, ...).
function custoDistancia(a: EnderecoParaSugestao, b: EnderecoParaSugestao): number {
  if (a.prateleira_id === b.prateleira_id) {
    if (a.andar === b.andar) return Math.abs(a.posicao - b.posicao);
    return 1000 + Math.abs(a.andar - b.andar) * 50;
  }
  return 100000 + Math.abs(a.prateleira_ordem - b.prateleira_ordem) * 1000 + Math.abs(a.andar - b.andar) * 50 + Math.abs(a.posicao - b.posicao);
}

// Dado onde um produto ja esta fisicamente (ocupados) e as posicoes livres do mesmo(s)
// setor(es), acha a posicao livre mais perto de qualquer uma das ocupadas. Sem ocupados
// (produto novo, nunca alocado) -> sem sugestao.
export function sugerirEnderecoLivre(
  ocupados: EnderecoParaSugestao[],
  livres: EnderecoParaSugestao[]
): EnderecoParaSugestao | null {
  let melhor: EnderecoParaSugestao | null = null;
  let melhorCusto = Infinity;

  for (const o of ocupados) {
    for (const l of livres) {
      if (o.setor_id !== l.setor_id) continue;
      const custo = custoDistancia(o, l);
      if (custo < melhorCusto) {
        melhorCusto = custo;
        melhor = l;
      }
    }
  }

  return melhor;
}

// Prateleira[ordem] fica entre corredor[ordem-1] (esquerda) e corredor[ordem] (direita).
// Dona = corredor a esquerda, lado D. Excecao: prateleira ordem=0 nao tem corredor a
// esquerda -> dona = corredor[0], lado E (primeiro corredor tambem "abre" o setor).
export function donoPrateleira(corredoresOrdenados: { letra: string }[], prateleiraOrdem: number): { letra: string; lado: Lado } {
  if (corredoresOrdenados.length === 0) {
    throw new Error('Setor sem corredores nao pode ter prateleiras');
  }
  if (prateleiraOrdem === 0) {
    return { letra: corredoresOrdenados[0].letra, lado: 'E' };
  }
  return { letra: corredoresOrdenados[prateleiraOrdem - 1].letra, lado: 'D' };
}
