import { StatusValidade } from '../types';

export const ROTULO_STATUS_VALIDADE: Record<StatusValidade, string> = {
  emergencia: 'Emergência',
  proximo: 'Vence em breve',
  normal: 'Validade normal',
};

export const BADGE_STATUS_VALIDADE: Record<StatusValidade, string> = {
  emergencia: 'bg-red-100 text-red-700',
  proximo: 'bg-amber-100 text-amber-700',
  normal: 'bg-slate-100 text-slate-500',
};
