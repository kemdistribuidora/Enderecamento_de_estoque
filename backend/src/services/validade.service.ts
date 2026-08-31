// Controle de shelf life: classifica uma validade (ISO YYYY-MM-DD) em 3 estados.
// Data ja vencida cai em emergencia (mais urgente possivel), sem status proprio.
// Comparacao de string funciona direto pra data ISO (ordem lexicografica == ordem
// cronologica), sem precisar parsear Date pra tudo.
export const DIAS_ALERTA_VENCIMENTO = 35;
export const DIAS_ALERTA_EMERGENCIA = 15;

export type StatusValidade = 'emergencia' | 'proximo' | 'normal';

export function calcularStatusValidade(validade: string, hoje: Date = new Date()): StatusValidade {
  const limiteEmergencia = new Date(hoje);
  limiteEmergencia.setDate(limiteEmergencia.getDate() + DIAS_ALERTA_EMERGENCIA);
  if (validade <= limiteEmergencia.toISOString().slice(0, 10)) return 'emergencia';

  const limiteProximo = new Date(hoje);
  limiteProximo.setDate(limiteProximo.getDate() + DIAS_ALERTA_VENCIMENTO);
  if (validade <= limiteProximo.toISOString().slice(0, 10)) return 'proximo';

  return 'normal';
}
