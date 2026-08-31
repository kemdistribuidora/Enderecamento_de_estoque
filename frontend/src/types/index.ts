export type StatusValidade = 'emergencia' | 'proximo' | 'normal';

export interface Produto {
  id: number;
  codigo: string;
  nome: string;
  codigo_barras: string;
  peso_caixa: number | null;
}

export interface ProdutoComPosicoes extends Produto {
  posicoes: Array<{
    endereco_id: number;
    codigo_endereco: string;
    quantidade: number;
    setor_id: number;
    validade: string;
    lote: string | null;
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
    codigo_barras: string;
    peso_caixa: number | null;
    quantidade: number;
    validade: string;
    lote: string | null;
    criado_em: string | null;
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
  corredores: Array<{ letra: string; aposPrateleiraOrdem: number }>;
  prateleiras: PrateleiraComPosicoes[];
}

export interface KpisDashboard {
  acuracia_estoque: { status: 'ok' | 'sem_dados'; percentual: number | null; total_produtos: number; produtos_com_divergencia: number };
  ocupacao_por_setor: Array<{ setor_id: number; setor_nome: string; total_enderecos: number; ocupados: number; percentual: number | null }>;
  giro_medio: { status: 'ok' | 'sem_dados'; valor: number | null; produtos_com_giro: number };
  vencimento: { emergencias: number; proximos: number };
}
