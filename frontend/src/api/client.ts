import { EnderecoComStatus, MapaSetor, Produto, ProdutoComPosicoes, Setor, StatusValidade } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

// PIN unico de acesso (backend exige header x-app-pin quando APP_PIN esta definido).
// Fica salvo no navegador; 401 apaga e avisa o PinGate pra pedir de novo.
const CHAVE_PIN = 'app-pin';
export const EVENTO_PIN_INVALIDO = 'pin-invalido';

export function lerPin(): string {
  try {
    return localStorage.getItem(CHAVE_PIN) ?? '';
  } catch {
    return '';
  }
}

export function salvarPin(pin: string | null): void {
  try {
    if (pin) localStorage.setItem(CHAVE_PIN, pin);
    else localStorage.removeItem(CHAVE_PIN);
  } catch {
    // navegador sem storage: PIN vale so ate recarregar a pagina
  }
  pinMemoria = pin ?? '';
}

let pinMemoria = lerPin();

async function requisicao(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (pinMemoria) headers.set('x-app-pin', pinMemoria);
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    salvarPin(null);
    window.dispatchEvent(new Event(EVENTO_PIN_INVALIDO));
  }
  return res;
}

// Confere o PIN digitado na tela de acesso. true = aceito (ou backend sem PIN).
export async function verificarPin(pin: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/acesso`, { headers: pin ? { 'x-app-pin': pin } : {} });
  if (res.ok) return true;
  if (res.status === 401) return false;
  const body = await res.json().catch(() => ({}));
  throw new Error(body.erro ?? `Servidor respondeu erro ${res.status}`);
}

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.erro ?? `Erro HTTP ${res.status}`);
  }
  return res.json();
}

export function buscarProdutos(search: string): Promise<ProdutoComPosicoes[]> {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  return requisicao(`${BASE_URL}/produtos${params}`).then((r) => handleJson(r));
}

export function buscarMapaEnderecos(): Promise<EnderecoComStatus[]> {
  return requisicao(`${BASE_URL}/enderecos`).then((r) => handleJson(r));
}

export function buscarSetores(): Promise<Setor[]> {
  return requisicao(`${BASE_URL}/mapa/setores`).then((r) => handleJson(r));
}

export function buscarMapaSetor(setorId: number): Promise<MapaSetor> {
  return requisicao(`${BASE_URL}/mapa/${setorId}`).then((r) => handleJson(r));
}

export interface DadosNovoProduto {
  codigo: string;
  nome: string;
  codigo_barras: string;
  peso_caixa?: number | null;
  qt_por_cx?: number | null;
}

export function criarProduto(dados: DadosNovoProduto): Promise<Produto> {
  return requisicao(`${BASE_URL}/produtos`, {
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
  lote: string | null
): Promise<{ ok: true; criado_em: string }> {
  return requisicao(`${BASE_URL}/enderecos/${enderecoId}/ocupar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ produto_id: produtoId, quantidade, validade, lote }),
  }).then((r) => handleJson(r));
}

export function buscarProdutoPorCodigoBarras(codigo: string): Promise<Produto> {
  return requisicao(`${BASE_URL}/produtos/codigo-barras/${encodeURIComponent(codigo)}`).then((r) => handleJson(r));
}

export function buscarProdutoDetalhe(produtoId: number): Promise<ProdutoComPosicoes> {
  return requisicao(`${BASE_URL}/produtos/${produtoId}`).then((r) => handleJson(r));
}

export function buscarEnderecoPorCodigo(codigo: string): Promise<EnderecoComStatus> {
  return requisicao(`${BASE_URL}/enderecos/codigo/${encodeURIComponent(codigo)}`).then((r) => handleJson(r));
}

export function liberarEndereco(enderecoId: number): Promise<{ ok: true; movimentacao_id: number }> {
  return requisicao(`${BASE_URL}/enderecos/${enderecoId}/liberar`, { method: 'POST' }).then((r) => handleJson(r));
}

export function baixarParcialEndereco(
  enderecoId: number,
  quantidade: number
): Promise<{ ok: true; movimentacao_id: number; quantidade_restante: number }> {
  return requisicao(`${BASE_URL}/enderecos/${enderecoId}/baixar-parcial`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantidade }),
  }).then((r) => handleJson(r));
}

export function contarEndereco(
  enderecoId: number,
  quantidadeContada: number
): Promise<{ ok: true; quantidade_sistema: number; divergencia: number }> {
  return requisicao(`${BASE_URL}/enderecos/${enderecoId}/contar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantidade_contada: quantidadeContada }),
  }).then((r) => handleJson(r));
}

export function moverPallet(enderecoId: number, destinoId: number): Promise<{ ok: true }> {
  return requisicao(`${BASE_URL}/enderecos/${enderecoId}/mover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ destino_id: destinoId }),
  }).then((r) => handleJson(r));
}

export function bloquearEndereco(enderecoId: number, motivo: string): Promise<{ ok: true }> {
  return requisicao(`${BASE_URL}/enderecos/${enderecoId}/bloquear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ motivo }),
  }).then((r) => handleJson(r));
}

export function desbloquearEndereco(enderecoId: number): Promise<{ ok: true }> {
  return requisicao(`${BASE_URL}/enderecos/${enderecoId}/desbloquear`, { method: 'POST' }).then((r) => handleJson(r));
}

// Reconciliacao do arquivo Winthor x estoque fisico (espelha backend/src/services/importacao-winthor.service.ts)
export type StatusReconciliacao = 'novo' | 'sem_mudanca' | 'entrou' | 'saiu' | 'sobra';

export interface LinhaBloqueada {
  linha: number;
  conteudo: string;
  motivo: string;
}

export interface PosicaoProduto {
  endereco_codigo: string;
  quantidade: number;
  validade: string;
  lote: string | null;
}

export interface ItemReconciliacao {
  produto_id: number | null;
  codigo: string;
  nome: string;
  qt_por_cx: number | null;
  produto_novo: boolean;
  cadastro_alterado: boolean;
  saldo_anterior: number | null;
  saldo_novo: number;
  delta: number;
  posicionado: number;
  nao_posicionado_antes: number | null;
  nao_posicionado: number;
  sobra: number;
  status: StatusReconciliacao;
  posicoes: PosicaoProduto[];
}

export interface TotaisReconciliacao {
  linhas_lidas: number;
  linhas_bloqueadas: number;
  produtos_arquivo: number;
  produtos_novos: number;
  produtos_fora_arquivo: number;
  sem_mudanca: number;
  entrou: number;
  saiu: number;
  sobra: number;
  novo: number;
}

export interface PreviaImportacao {
  itens: ItemReconciliacao[];
  bloqueadas: LinhaBloqueada[];
  avisos: string[];
  totais: TotaisReconciliacao;
}

export interface ImportacaoResumo {
  id: number;
  criado_em: string;
  nome_arquivo: string | null;
  linhas_lidas: number;
  linhas_bloqueadas: number;
  produtos_arquivo: number;
  produtos_novos: number;
  novo: number;
  sem_mudanca: number;
  entrou: number;
  saiu: number;
  sobra: number;
}

export interface ItemHistoricoImportacao {
  produto_id: number | null;
  codigo: string;
  nome: string;
  saldo_anterior: number | null;
  saldo_novo: number;
  posicionado: number;
  nao_posicionado: number;
  sobra: number;
  status: StatusReconciliacao;
}

export function previaImportacaoWinthor(csv: string): Promise<PreviaImportacao> {
  return requisicao(`${BASE_URL}/importacao/winthor/previa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csv }),
  }).then((r) => handleJson(r));
}

export function confirmarImportacaoWinthor(
  csv: string,
  nomeArquivo: string
): Promise<{ importacao_id: number; previa: PreviaImportacao }> {
  return requisicao(`${BASE_URL}/importacao/winthor/confirmar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csv, nome_arquivo: nomeArquivo }),
  }).then((r) => handleJson(r));
}

// quando o saldo Winthor foi atualizado pela ultima vez (null = nunca importado)
export function buscarUltimaAtualizacaoSaldo(): Promise<{ atualizado_em: string | null }> {
  return requisicao(`${BASE_URL}/importacao/winthor/ultima`).then((r) => handleJson(r));
}

export function buscarHistoricoImportacoes(): Promise<ImportacaoResumo[]> {
  return requisicao(`${BASE_URL}/importacao/winthor/historico`).then((r) => handleJson(r));
}

export function buscarItensImportacao(importacaoId: number): Promise<ItemHistoricoImportacao[]> {
  return requisicao(`${BASE_URL}/importacao/winthor/historico/${importacaoId}`).then((r) => handleJson(r));
}

export interface PendenciaPosicionamento {
  produto_id: number;
  codigo: string;
  nome: string;
  codigo_barras: string;
  peso_caixa: number | null;
  qt_por_cx: number | null;
  saldo_total: number;
  alocado_total: number;
  pendente: number;
}

export function buscarPendenciasPosicionamento(): Promise<PendenciaPosicionamento[]> {
  return requisicao(`${BASE_URL}/produtos/pendencias-posicionamento`).then((r) => handleJson(r));
}

export function corrigirValidade(
  enderecoId: number,
  validade: string
): Promise<{ ok: true; validade: string; status_validade: StatusValidade }> {
  return requisicao(`${BASE_URL}/enderecos/${enderecoId}/validade`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ validade }),
  }).then((r) => handleJson(r));
}

export function atualizarPesoCaixa(produtoId: number, pesoCaixa: number | null): Promise<{ ok: true; peso_caixa: number | null }> {
  return requisicao(`${BASE_URL}/produtos/${produtoId}/peso-caixa`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ peso_caixa: pesoCaixa }),
  }).then((r) => handleJson(r));
}

export function atualizarCorMarcador(
  produtoId: number,
  cor: string | null
): Promise<{ ok: true; cor_marcador: string | null }> {
  return requisicao(`${BASE_URL}/produtos/${produtoId}/cor-marcador`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cor_marcador: cor }),
  }).then((r) => handleJson(r));
}

export interface SugestaoEndereco {
  endereco_id: number;
  codigo: string;
  setor_id: number;
}

export function buscarSugestaoEndereco(produtoId: number): Promise<SugestaoEndereco | null> {
  return requisicao(`${BASE_URL}/produtos/${produtoId}/sugestao-endereco`).then((r) => handleJson(r));
}

export interface DivergenciaSobra {
  produto_id: number;
  codigo: string;
  nome: string;
  qt_por_cx: number | null;
  saldo_total: number;
  alocado_total: number;
  excesso: number;
}

export function buscarDivergenciasSobra(): Promise<DivergenciaSobra[]> {
  return requisicao(`${BASE_URL}/produtos/divergencias-sobra`).then((r) => handleJson(r));
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
  return requisicao(`${BASE_URL}/produtos/curva-abc`).then((r) => handleJson(r));
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
  transferencia_endereco_codigo: string | null;
}

export interface FiltroMovimentacoes {
  de?: string; // YYYY-MM-DD, horario de Brasilia, inclusivo
  ate?: string;
  busca?: string; // codigo/nome do produto ou codigo da posicao
  limit?: number;
  offset?: number;
}

export function buscarMovimentacoes(filtro: FiltroMovimentacoes = {}): Promise<Movimentacao[]> {
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(filtro)) {
    if (valor !== undefined && valor !== '') params.set(chave, String(valor));
  }
  const query = params.toString();
  return requisicao(`${BASE_URL}/movimentacoes${query ? `?${query}` : ''}`).then((r) => handleJson(r));
}

export function desfazerMovimentacao(id: number): Promise<void> {
  return requisicao(`${BASE_URL}/movimentacoes/${id}/desfazer`, { method: 'POST' }).then((r) => handleJson(r));
}

export interface PosicaoAVencer {
  endereco_id: number;
  endereco_codigo: string;
  setor_id: number;
  produto_id: number;
  produto_codigo: string;
  produto_nome: string;
  produto_qt_por_cx: number | null;
  quantidade: number;
  validade: string;
  lote: string | null;
  status_validade: StatusValidade;
}

export function buscarPosicoesAVencer(): Promise<PosicaoAVencer[]> {
  return requisicao(`${BASE_URL}/enderecos/a-vencer`).then((r) => handleJson(r));
}

export interface KpisDashboard {
  acuracia_estoque: { status: 'ok' | 'sem_dados'; percentual: number | null; total_produtos: number; produtos_com_divergencia: number };
  ocupacao_por_setor: Array<{ setor_id: number; setor_nome: string; total_enderecos: number; ocupados: number; percentual: number | null }>;
  giro_medio: { status: 'ok' | 'sem_dados'; valor: number | null; produtos_com_giro: number };
  vencimento: { emergencias: number; proximos: number };
  bloqueios: { total: number };
}

export function buscarDashboardKpis(): Promise<KpisDashboard> {
  return requisicao(`${BASE_URL}/dashboard/kpis`).then((r) => handleJson(r));
}
