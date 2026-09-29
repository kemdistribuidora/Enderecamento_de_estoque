// Controle de shelf life: classifica uma validade (ISO YYYY-MM-DD) em 3 estados.
// Data ja vencida cai em emergencia (mais urgente possivel), sem status proprio.
// Comparacao de string funciona direto pra data ISO (ordem lexicografica == ordem
// cronologica), sem precisar parsear Date pra tudo.
//
// Fuso: servidor (Render) roda em UTC. "Hoje" precisa ser o dia no Brasil, senao
// entre 21h e 00h (horario de Brasilia) o sistema ja acha que e' o dia seguinte e
// os limites de alerta pulam 1 dia. Toda conta de dia e' feita em UTC puro sobre
// YYYY-MM-DD (sem hora), entao nao existe arredondamento nem horario de verao.
export const DIAS_ALERTA_VENCIMENTO = 35;
export const DIAS_ALERTA_EMERGENCIA = 15;
export const FUSO_BRASIL = 'America/Sao_Paulo';

export type StatusValidade = 'emergencia' | 'proximo' | 'normal';

// Dia atual no Brasil, formato YYYY-MM-DD. en-CA formata como ISO.
export function hojeBrasil(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_BRASIL,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

// Soma dias numa data YYYY-MM-DD sem passar por fuso local.
export function somarDias(dataIso: string, dias: number): string {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

// Valida YYYY-MM-DD de verdade: rejeita 2026-02-30, 2026-13-01, ano com 5 digitos etc.
export function isDataIsoValida(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [ano, mes, dia] = valor.split('-').map(Number);
  if (ano < 2000 || ano > 2099) return false;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

export function calcularStatusValidade(validade: string, hoje: string = hojeBrasil()): StatusValidade {
  if (validade <= somarDias(hoje, DIAS_ALERTA_EMERGENCIA)) return 'emergencia';
  if (validade <= somarDias(hoje, DIAS_ALERTA_VENCIMENTO)) return 'proximo';
  return 'normal';
}
