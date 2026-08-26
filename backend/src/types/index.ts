export interface Produto {
  id: number;
  codigo: string;
  nome: string;
  descricao: string;
  codigo_barras: string;
  validade: string; // ISO date (YYYY-MM-DD)
}

export interface Setor {
  id: number;
  nome: string;
  ordem: number;
}

export interface Corredor {
  id: number;
  setor_id: number;
  letra: string;
  ordem: number;
}

export interface Prateleira {
  id: number;
  setor_id: number;
  ordem: number;
}

export interface Endereco {
  id: number;
  prateleira_id: number;
  corredor: string; // letra do corredor "dono" (ver donoPrateleira)
  lado: 'E' | 'D';
  andar: number;
  posicao: number;
  codigo: string; // formatted, ex: AD302
}

export interface EstoquePosicao {
  id: number;
  produto_id: number;
  endereco_id: number;
  quantidade: number;
}

// Endereco com status calculado (join) + produto ocupante, se houver
export interface EnderecoComStatus extends Endereco {
  status: 'livre' | 'ocupado';
  produto?: {
    id: number;
    codigo: string;
    nome: string;
    quantidade: number;
  } | null;
}

// Produto com todas as posicoes onde esta armazenado
export interface ProdutoComPosicoes extends Produto {
  posicoes: Array<{
    endereco_id: number;
    codigo_endereco: string;
    quantidade: number;
  }>;
}

// Prateleira com suas posicoes, pronta pra desenhar o mapa (mesma ordem visual do
// mockup validado: prateleira / corredor / prateleira / corredor / ...)
export interface PrateleiraComPosicoes {
  id: number;
  ordem: number;
  dono: { letra: string; lado: 'E' | 'D' };
  posicoes: EnderecoComStatus[];
}

export interface MapaSetor {
  setor: Setor;
  corredores: string[]; // letras, na ordem
  prateleiras: PrateleiraComPosicoes[];
}
