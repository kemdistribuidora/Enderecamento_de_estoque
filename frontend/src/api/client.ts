import { EnderecoComStatus, MapaSetor, Produto, ProdutoComPosicoes, Setor, StatusValidade } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.erro ?? `Erro HTTP ${res.status}`);
  }
  return res.json();
}

export function buscarProdutos(search: string): Promise<ProdutoComPosicoes[]> {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  return fetch(`${BASE_URL}/produtos${params}`).then((r) => handleJson(r));
}

export function buscarMapaEnderecos(): Promise<EnderecoComStatus[]> {
  return fetch(`${BASE_URL}/enderecos`).then((r) => handleJson(r));
}

export function buscarSetores(): Promise<Setor[]> {
  return fetch(`${BASE_URL}/mapa/setores`).then((r) => handleJson(r));
}

export function buscarMapaSetor(setorId: number): Promise<MapaSetor> {
  return fetch(`${BASE_URL}/mapa/${setorId}`).then((r) => handleJson(r));
}

export interface DadosNovoProduto {
  codigo: string;
  nome: string;
  codigo_barras: string;
  peso_caixa?: number | null;
}

export function criarProduto(dados: DadosNovoProduto): Promise<Produto> {
  return fetch(`${BASE_URL}/produtos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  }).then((r) => handleJson(r));
}

export function ocuparEndereco(
  enderecoId: number,
  produtoId: number,
  quantidade: number,
  validade: string,
  lote: string
): Promise<{ ok: true; criado_em: string }> {
  return fetch(`${BASE_URL}/enderecos/${enderecoId}/ocupar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ produto_id: produtoId, quantidade, validade, lote }),
  }).then((r) => handleJson(r));
}

export function buscarProdutoPorCodigoBarras(codigo: string): Promise<Produto> {
  return fetch(`${BASE_URL}/produtos/codigo-barras/${encodeURIComponent(codigo)}`).then((r) => handleJson(r));
}

export function buscarEnderecoPorCodigo(codigo: string): Promise<EnderecoComStatus> {
  return fetch(`${BASE_URL}/enderecos/codigo/${encodeURIComponent(codigo)}`).then((r) => handleJson(r));
}

export function liberarEndereco(enderecoId: number): Promise<{ ok: true; movimentacao_id: number }> {
  return fetch(`${BASE_URL}/enderecos/${enderecoId}/liberar`, { method: 'POST' }).then((r) => handleJson(r));
}

export interface ProdutoComSaldoImportado {
  produto_id: number;
  codigo: string;
  nome: string;
  filial: string;
  saldo: number;
}

export interface ResultadoImportacao {
  ok: number;
  falhas: number;
  avisos: string[];
  produtosComSaldo: ProdutoComSaldoImportado[];
}

export function importarProdutosCsv(csv: string): Promise<ResultadoImportacao> {
  return fetch(`${BASE_URL}/importacao/produtos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csv }),
  }).then((r) => handleJson(r));
}

export function importarSaldoCsv(csv: string): Promise<ResultadoImportacao> {
  return fetch(`${BASE_URL}/importacao/saldo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csv }),
  }).then((r) => handleJson(r));
}

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

export function buscarPendenciasPosicionamento(): Promise<PendenciaPosicionamento[]> {
  return fetch(`${BASE_URL}/produtos/pendencias-posicionamento`).then((r) => handleJson(r));
}

export interface SugestaoEndereco {
  endereco_id: number;
  codigo: string;
  setor_id: number;
}

export function buscarSugestaoEndereco(produtoId: number): Promise<SugestaoEndereco | null> {
  return fetch(`${BASE_URL}/produtos/${produtoId}/sugestao-endereco`).then((r) => handleJson(r));
}

export interface DivergenciaSobra {
  produto_id: number;
  codigo: string;
  nome: string;
  saldo_total: number;
  alocado_total: number;
  excesso: number;
}

export function buscarDivergenciasSobra(): Promise<DivergenciaSobra[]> {
  return fetch(`${BASE_URL}/produtos/divergencias-sobra`).then((r) => handleJson(r));
}

export interface ItemCurvaAbc {
  produto_id: number;
  codigo: string;
  nome: string;
  total_saida: number;
  percentual: number;
  percentual_acumulado: number;
  classe: 'A' | 'B' | 'C';
}

export function buscarCurvaAbc(): Promise<ItemCurvaAbc[]> {
  return fetch(`${BASE_URL}/produtos/curva-abc`).then((r) => handleJson(r));
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

export function buscarMovimentacoes(): Promise<Movimentacao[]> {
  return fetch(`${BASE_URL}/movimentacoes`).then((r) => handleJson(r));
}

export function desfazerMovimentacao(id: number): Promise<void> {
  return fetch(`${BASE_URL}/movimentacoes/${id}/desfazer`, { method: 'POST' }).then((r) => handleJson(r));
}

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

export function buscarPosicoesAVencer(): Promise<PosicaoAVencer[]> {
  return fetch(`${BASE_URL}/enderecos/a-vencer`).then((r) => handleJson(r));
}

export interface KpisDashboard {
  acuracia_estoque: { status: 'ok' | 'sem_dados'; percentual: number | null; total_produtos: number; produtos_com_divergencia: number };
  ocupacao_por_setor: Array<{ setor_id: number; setor_nome: string; total_enderecos: number; ocupados: number; percentual: number | null }>;
  giro_medio: { status: 'ok' | 'sem_dados'; valor: number | null; produtos_com_giro: number };
  vencimento: { emergencias: number; proximos: number };
}

export function buscarDashboardKpis(): Promise<KpisDashboard> {
  return fetch(`${BASE_URL}/dashboard/kpis`).then((r) => handleJson(r));
}
