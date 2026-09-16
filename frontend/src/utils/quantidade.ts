// Estoque sempre guardado em UN (bate com o saldo do Winthor, sem perda de precisao
// em fracionado/avulso). qt_por_cx so serve pra converter em CX na hora de exibir --
// sem ele (produto sem embalagem em caixa fechada cadastrada), mostra so UN.
export function formatarQtdCx(unidades: number, qtPorCx: number | null): string {
  if (!qtPorCx || qtPorCx <= 0) return `${unidades} UN`;

  const caixas = Math.floor(unidades / qtPorCx);
  const avulso = Math.round((unidades % qtPorCx) * 1000) / 1000;

  if (avulso === 0) return `${caixas} CX`;
  return `${caixas} CX (${avulso} UN)`;
}

// quantidade e' sempre UN; peso_caixa e' peso de 1 caixa fechada -- so da pra converter
// pra peso total sabendo quantas UN cabem numa caixa (qtPorCx). Sem os dois cadastrados, null.
export function calcularPesoTotal(unidades: number, qtPorCx: number | null, pesoCaixa: number | null): number | null {
  if (pesoCaixa == null || !qtPorCx) return null;
  return (unidades / qtPorCx) * pesoCaixa;
}
