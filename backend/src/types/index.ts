import { StatusValidade } from '../services/validade.service';

export interface Produto {
  id: number;
  codigo: string;
  nome: string;
  codigo_barras: string;
  peso_caixa: number | null;
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
  letra: string;
  lado: 'E' | 'D';
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
  validade: string; // ISO date (YYYY-MM-DD) — validade do lote nessa posicao
  lote: string | null;
  criado_em: string | null; // data/hora que a posicao foi ocupada -- usado na etiqueta (Dt Entrada)
}

// Endereco com status calculado (join) + produto ocupante, se houver
export interface EnderecoComStatus extends Endereco {
  status: 'livre' | 'ocupado';
  produto?: {
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

// Produto com todas as posicoes onde esta armazenado
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
  corredores: Array<{ letra: string; aposPrateleiraOrdem: number }>;
  prateleiras: PrateleiraComPosicoes[];
}

// Produto com saldo importado do Winthor maior que o ja alocado fisicamente -- falta
// posicionar (parcial ou total) a diferenca.
export interface PendenciaPosicionamento {
  produto_id: number;
  codigo: string;
  nome: string;
  codigo_barras: string;
  peso_caixa: number | null;
  saldo_total: number;
  alocado_total: number;
  pendente: number;
}

export interface SugestaoEndereco {
  endereco_id: number;
  codigo: string;
  setor_id: number;
}

// Produto com estoque fisico maior que o saldo Winthor -- provavel saida que ficou
// so no sistema fisico e nao foi registrada no ERP (o Winthor manda: ele que reflete
// nota fiscal/movimentacao fiscal de saida).
export interface DivergenciaSobra {
  produto_id: number;
  codigo: string;
  nome: string;
  saldo_total: number;
  alocado_total: number;
  excesso: number;
}

export type TipoMovimentacao = 'entrada' | 'saida';
export type StatusMovimentacao = 'confirmada' | 'standby' | 'revertida';

export interface Movimentacao {
  id: number;
  tipo: TipoMovimentacao;
  produto_id: number;
  produto_codigo: string;
  produto_nome: string;
  endereco_id: number;
  endereco_codigo: string;
  quantidade: number;
  validade: string;
  lote: string | null;
  status: StatusMovimentacao;
  criado_em: string;
}

// Curva ABC por giro (saida): produto ordenado por total de saida desc, com percentual
// acumulado sobre o total geral. Classe A = ate 80% acumulado, B = ate 95%, C = resto.
export interface ItemCurvaAbc {
  produto_id: number;
  codigo: string;
  nome: string;
  total_saida: number;
  percentual: number;
  percentual_acumulado: number;
  classe: 'A' | 'B' | 'C';
}

// Posicao ocupada com validade vencida ou proxima (ver DIAS_ALERTA_VENCIMENTO).
export interface PosicaoAVencer {
  endereco_id: number;
  endereco_codigo: string;
  setor_id: number;
  produto_id: number;
  produto_codigo: string;
  produto_nome: string;
  quantidade: number;
  validade: string;
  lote: string | null;
  status_validade: StatusValidade;
}

// KPIs consolidados pro dashboard (Bloco 7).
export interface KpisDashboard {
  acuracia_estoque: { status: 'ok' | 'sem_dados'; percentual: number | null; total_produtos: number; produtos_com_divergencia: number };
  ocupacao_por_setor: Array<{ setor_id: number; setor_nome: string; total_enderecos: number; ocupados: number; percentual: number | null }>;
  giro_medio: { status: 'ok' | 'sem_dados'; valor: number | null; produtos_com_giro: number };
  vencimento: { emergencias: number; proximos: number };
}
