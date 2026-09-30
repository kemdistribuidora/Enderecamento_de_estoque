// Paleta fixa do marcador colorido do produto (sem nome, so a cor). A chave e' o que vai
// pro banco (produtos.cor_marcador) -- manter em sincronia com CORES_MARCADOR no backend.
export const CORES_MARCADOR: Array<{ chave: string; hex: string; rotulo: string }> = [
  { chave: 'vermelho', hex: '#dc2626', rotulo: 'Vermelho' },
  { chave: 'laranja', hex: '#ea580c', rotulo: 'Laranja' },
  { chave: 'amarelo', hex: '#eab308', rotulo: 'Amarelo' },
  { chave: 'verde', hex: '#16a34a', rotulo: 'Verde' },
  { chave: 'azul', hex: '#2563eb', rotulo: 'Azul' },
  { chave: 'roxo', hex: '#9333ea', rotulo: 'Roxo' },
  { chave: 'rosa', hex: '#ec4899', rotulo: 'Rosa' },
  { chave: 'marrom', hex: '#92400e', rotulo: 'Marrom' },
];

export function hexCorMarcador(chave: string | null | undefined): string | null {
  return CORES_MARCADOR.find((c) => c.chave === chave)?.hex ?? null;
}
