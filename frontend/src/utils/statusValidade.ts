import { StatusValidade } from '../types';

export const ROTULO_STATUS_VALIDADE: Record<StatusValidade, string> = {
  emergencia: 'Emergência',
  proximo: 'Vence em breve',
  normal: 'Validade normal',
};

export const BADGE_STATUS_VALIDADE: Record<StatusValidade, string> = {
  emergencia: 'tag-red',
  proximo: 'tag-amber',
  normal: 'tag-neutral',
};
