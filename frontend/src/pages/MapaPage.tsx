import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { buscarMapaSetor, buscarProdutos, buscarSetores } from '../api/client';
import { EnderecoComStatus, MapaSetor, ProdutoComPosicoes, Setor } from '../types';
import MapaSetorView from '../components/MapaSetorView';
import ProdutoModal from '../components/ProdutoModal';
import SearchBar from '../components/SearchBar';
import ResultCard from '../components/ResultCard';
import PainelSeparacao from '../components/PainelSeparacao';

const DEBOUNCE_MS = 350;

type Posicao = ProdutoComPosicoes['posicoes'][number];

export default function MapaPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const setorParam = searchParams.get('setor');
  const enderecoParam = searchParams.get('endereco');

  const [setores, setSetores] = useState<Setor[]>([]);
  const [setorAtivoId, setSetorAtivoId] = useState<number | null>(null);
  const [mapa, setMapa] = useState<MapaSetor | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [selecionado, setSelecionado] = useState<EnderecoComStatus | null>(null);

  const [termoBusca, setTermoBusca] = useState('');
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const [resultados, setResultados] = useState<ProdutoComPosicoes[]>([]);
  const [buscandoProdutos, setBuscandoProdutos] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoComPosicoes | null>(null);
  const [separando, setSeparando] = useState<{ produto: ProdutoComPosicoes; posicao: Posicao } | null>(null);

  useEffect(() => {
    const termo = termoBusca.trim();
    if (!termo) {
      setResultados([]);
      return;
    }
    setBuscandoProdutos(true);
    const timer = setTimeout(() => {
      buscarProdutos(termo)
        .then(setResultados)
        .finally(() => setBuscandoProdutos(false));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [termoBusca]);

  function handleDigitar(valor: string) {
    setTermoBusca(valor);
    setGavetaAberta(valor.trim().length > 0);
    setProdutoSelecionado(null);
    setSeparando(null);
  }

  function handleSelecionarProduto(produto: ProdutoComPosicoes) {
    setProdutoSelecionado(produto);
    setGavetaAberta(false);
    setSeparando(null);
    if (produto.posicoes.length > 0) {
      setSearchParams({});
      setSetorAtivoId(produto.posicoes[0].setor_id);
    }
  }

  function handleSeparar(produto: ProdutoComPosicoes, posicao: Posicao) {
    setSeparando({ produto, posicao });
    setSearchParams({});
    setSetorAtivoId(posicao.setor_id);
  }

  const idsCandidatos = new Set(produtoSelecionado?.posicoes.map((p) => p.endereco_id) ?? []);
  const enderecoDestacadoId = separando ? separando.posicao.endereco_id : enderecoParam ? Number(enderecoParam) : null;

  useEffect(() => {
    buscarSetores().then((lista) => {
      setSetores(lista);
      const inicial = setorParam ? Number(setorParam) : (lista[0]?.id ?? null);
      setSetorAtivoId(inicial);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (setorAtivoId === null) return;
    setCarregando(true);
    buscarMapaSetor(setorAtivoId)
      .then(setMapa)
      .finally(() => setCarregando(false));
  }, [setorAtivoId]);

  function recarregarMapa() {
    if (setorAtivoId === null) return;
    buscarMapaSetor(setorAtivoId).then(setMapa);
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <SearchBar
          onChange={handleDigitar}
          onFocus={() => setGavetaAberta(termoBusca.trim().length > 0)}
          onBlur={() => setTimeout(() => setGavetaAberta(false), 150)}
        />

        {gavetaAberta && (
          <div className="absolute z-20 mt-1 w-full max-h-80 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
            {buscandoProdutos && <p className="p-3 text-sm text-slate-400">Buscando...</p>}
            {!buscandoProdutos && resultados.length === 0 && (
              <p className="p-3 text-sm text-slate-400">Nenhum produto encontrado para "{termoBusca}".</p>
            )}
            {!buscandoProdutos &&
              resultados.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelecionarProduto(p);
                  }}
                  className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-800">{p.nome}</span>
                  <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{p.codigo}</span>
                </button>
              ))}
          </div>
        )}
      </div>

      {produtoSelecionado && !separando && (
        <ResultCard produto={produtoSelecionado} onSeparar={handleSeparar} />
      )}

      {separando && (
        <PainelSeparacao
          produtoId={separando.produto.id}
          produtoNome={separando.produto.nome}
          produtoCodigo={separando.produto.codigo}
          enderecoId={separando.posicao.endereco_id}
          codigoEndereco={separando.posicao.codigo_endereco}
          setorId={separando.posicao.setor_id}
          quantidade={separando.posicao.quantidade}
          validade={separando.posicao.validade}
          lote={separando.posicao.lote}
          onFechar={() => setSeparando(null)}
          onConcluido={() => {
            setSeparando(null);
            setProdutoSelecionado(null);
            recarregarMapa();
          }}
          exibirMapa={false}
        />
      )}

      <div className="flex flex-wrap gap-2">
        {setores.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              setSetorAtivoId(s.id);
              setSearchParams({});
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              setorAtivoId === s.id
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            {s.nome}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border border-slate-200 bg-slate-100" /> livre
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border border-blue-300 bg-blue-100" /> ocupado
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border border-amber-300 bg-amber-100" /> vence em breve
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border border-red-300 bg-red-100" /> emergência
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border border-dashed border-amber-300 bg-amber-50" /> corredor (passagem)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border border-dashed border-green-400 bg-green-200" /> posição do produto buscado
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border border-green-400 bg-green-200" /> selecionado
        </span>
      </div>

      {carregando || !mapa ? (
        <p className="text-sm text-slate-400">Carregando mapa...</p>
      ) : (
        <MapaSetorView mapa={mapa} onSelect={setSelecionado} enderecoDestacadoId={enderecoDestacadoId} idsCandidatos={idsCandidatos} />
      )}

      <ProdutoModal endereco={selecionado} onClose={() => setSelecionado(null)} onLiberado={recarregarMapa} />
    </div>
  );
}
