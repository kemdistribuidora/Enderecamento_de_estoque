// Estoque sempre guardado em UN (bate com o saldo do Winthor, sem perda de precisao
// em fracionado/avulso). qt_por_cx so serve pra converter em CX na hora de exibir --
// sem ele (produto sem embalagem em caixa fechada cadastrada), mostra so UN.
// unidade = P.UNIDADE do Winthor (UN, KG, CX, FD, BD, DP, SC); sem ela (import antigo), assume UN.
// Saldo vem na unidade do produto. Pra CX/FD/BD/DP/SC o QTUNITCX do Winthor e misturado
// (as vezes e o conteudo da propria embalagem: oleo CX 20, sal FD 10; as vezes caixa master:
// chocolate DP 12), entao so converte em CX quando a unidade e UN ou KG.
export function converteEmCaixa(qtPorCx: number | null, unidade: string | null): boolean {
  return !!qtPorCx && qtPorCx > 0 && (!unidade || unidade === 'UN' || unidade === 'KG');
}

export function formatarQtdCx(unidades: number, qtPorCx: number | null, unidade: string | null = null): string {
  const rotulo = unidade || 'UN';
  if (!qtPorCx || !converteEmCaixa(qtPorCx, unidade)) return `${unidades} ${rotulo}`;

  const caixas = Math.floor(unidades / qtPorCx);
  const avulso = Math.round((unidades % qtPorCx) * 1e6) / 1e6;

  if (avulso === 0) return `${caixas} CX`;
  return `${caixas} CX (${avulso} ${rotulo})`;
}

// quantidade e' sempre UN; peso_caixa e' peso de 1 caixa fechada -- so da pra converter
// pra peso total sabendo quantas UN cabem numa caixa (qtPorCx). Sem os dois cadastrados, null.
export function calcularPesoTotal(unidades: number, qtPorCx: number | null, pesoCaixa: number | null): number | null {
  if (pesoCaixa == null || !qtPorCx) return null;
  return (unidades / qtPorCx) * pesoCaixa;
}
