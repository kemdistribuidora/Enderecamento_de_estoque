// Formatacao de data padrao Brasil (DD/MM/AAAA), sempre no fuso de Brasilia.
//
// Validade vem do banco como YYYY-MM-DD (dia puro, sem hora). NUNCA passar isso por
// new Date(): o JS le "2026-10-15" como meia-noite UTC e, no Brasil (UTC-3), mostra
// 14/10/2026 -- um dia a menos. Por isso data pura e' formatada so por texto.
// Timestamps (criado_em, ISO com hora em UTC) sao convertidos pro fuso de Brasilia.
const FUSO_BRASIL = 'America/Sao_Paulo';
const REGEX_DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

// '2026-10-15' -> '15/10/2026'. Aceita tambem timestamp completo (usa o dia no Brasil).
export function formatarData(valor: string | null | undefined): string {
  if (!valor) return '—';
  const m = REGEX_DATA_ISO.exec(valor);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(valor);
  if (isNaN(d.getTime())) return valor;
  return d.toLocaleDateString('pt-BR', { timeZone: FUSO_BRASIL });
}

// Timestamp ISO -> '15/10/2026 14:32'.
export function formatarDataHora(valor: string | null | undefined): string {
  if (!valor) return '—';
  const d = new Date(valor);
  if (isNaN(d.getTime())) return valor;
  return d.toLocaleString('pt-BR', {
    timeZone: FUSO_BRASIL,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Mesma regra do backend (isDataIsoValida): data real, ano 2000-2099.
// Pega ano com 5 digitos digitado no input e datas tipo 31/02.
export const DATA_MIN = '2000-01-01';
export const DATA_MAX = '2099-12-31';

export function isDataIsoValida(valor: string): boolean {
  const m = REGEX_DATA_ISO.exec(valor);
  if (!m) return false;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (ano < 2000 || ano > 2099) return false;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

// Dias de hoje (Brasilia) ate a validade YYYY-MM-DD. Negativo = ja venceu. null se data invalida.
export function diasParaVencer(validade: string | null | undefined): number | null {
  const m = REGEX_DATA_ISO.exec(validade ?? '');
  if (!m) return null;
  const hoje = REGEX_DATA_ISO.exec(new Date().toLocaleDateString('en-CA', { timeZone: FUSO_BRASIL }));
  if (!hoje) return null;
  const alvo = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const base = Date.UTC(Number(hoje[1]), Number(hoje[2]) - 1, Number(hoje[3]));
  return Math.round((alvo - base) / 86_400_000);
}
