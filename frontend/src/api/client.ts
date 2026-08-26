import { EnderecoComStatus, MapaSetor, Produto, ProdutoComPosicoes, Setor } from '../types';

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
}

export function criarProduto(dados: DadosNovoProduto): Promise<Produto> {
  return fetch(`${BASE_URL}/produtos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  }).then((r) => handleJson(r));
}

export function ocuparEndereco(enderecoId: number, produtoId: number, quantidade: number, validade: string): Promise<void> {
  return fetch(`${BASE_URL}/enderecos/${enderecoId}/ocupar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ produto_id: produtoId, quantidade, validade }),
  }).then((r) => handleJson(r));
}
