export type StatusValidade = 'vencido' | 'proximo' | 'normal';

export interface Produto {
  id: number;
  codigo: string;
  nome: string;
  codigo_barras: string;
}

export interface ProdutoComPosicoes extends Produto {
  posicoes: Array<{
    endereco_id: number;
    codigo_endereco: string;
    quantidade: number;
    setor_id: number;
    validade: string;
    status_validade: StatusValidade;
  }>;
}

export interface EnderecoComStatus {
  id: number;
  prateleira_id: number;
  corredor: string;
  lado: 'E' | 'D';
  andar: number;
  posicao: number;
  codigo: string;
  status: 'livre' | 'ocupado';
  produto: {
    id: number;
    codigo: string;
    nome: string;
    quantidade: number;
    validade: string;
    status_validade: StatusValidade;
  } | null;
}

export interface Setor {
  id: number;
  nome: string;
  ordem: number;
}

export interface PrateleiraComPosicoes {
  id: number;
  ordem: number;
  dono: { letra: string; lado: 'E' | 'D' };
  posicoes: EnderecoComStatus[];
}

export interface MapaSetor {
  setor: Setor;
  corredores: string[];
  prateleiras: PrateleiraComPosicoes[];
}
