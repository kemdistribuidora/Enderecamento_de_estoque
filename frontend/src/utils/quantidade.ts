// Estoque sempre guardado em UN (bate com o saldo do Winthor, sem perda de precisao
// em fracionado/avulso). qt_por_cx so serve pra converter em CX na hora de exibir --
// sem ele (produto sem embalagem em caixa fechada cadastrada), mostra so UN.
export function formatarQtdCx(unidades: number, qtPorCx: number | null): string {
  if (!qtPorCx || qtPorCx <= 0) return `${unidades} UN`;

  const caixas = Math.floor(unidades / qtPorCx);
  const avulso = unidades % qtPorCx;

  if (avulso === 0) return `${caixas} CX`;
  return `${caixas} CX + ${avulso} UN`;
}
