// Controle de shelf life: classifica uma validade (ISO YYYY-MM-DD) em 3 estados.
// Comparacao de string funciona direto pra data ISO (ordem lexicografica == ordem
// cronologica), sem precisar parsear Date pra tudo.
export const DIAS_ALERTA_VENCIMENTO = 35;

export type StatusValidade = 'vencido' | 'proximo' | 'normal';

export function calcularStatusValidade(validade: string, hoje: Date = new Date()): StatusValidade {
  const hojeStr = hoje.toISOString().slice(0, 10);
  if (validade < hojeStr) return 'vencido';

  const limite = new Date(hoje);
  limite.setDate(limite.getDate() + DIAS_ALERTA_VENCIMENTO);
  const limiteStr = limite.toISOString().slice(0, 10);
  if (validade <= limiteStr) return 'proximo';

  return 'normal';
}
