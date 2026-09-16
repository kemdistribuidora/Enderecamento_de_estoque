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
          <div className="panel absolute z-20 mt-1 w-full max-h-80 overflow-y-auto">
            {buscandoProdutos && <p className="p-3 text-sm text-steel-400">Buscando...</p>}
            {!buscandoProdutos && resultados.length === 0 && (
              <p className="p-3 text-sm text-steel-400">Nenhum produto encontrado para "{termoBusca}".</p>
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
                  className="flex w-full items-center justify-between gap-3 border-b border-steel-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-concrete-100"
                >
                  <span className="font-medium text-ink-900">{p.nome}</span>
                  <span className="tag-neutral shrink-0">{p.codigo}</span>
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
          qtPorCx={separando.produto.qt_por_cx}
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

      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-steel-600/25 pb-3">
        <div className="flex flex-wrap gap-1.5">
          {setores.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setSetorAtivoId(s.id);
                setSearchParams({});
              }}
              className={`whitespace-nowrap rounded-tag px-3 py-1.5 text-sm font-medium transition-colors ${
                setorAtivoId === s.id
                  ? 'bg-steel-900 text-white'
                  : 'border border-steel-300 bg-white text-ink-600 hover:bg-concrete-200'
              }`}
            >
              {s.nome}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-600">
          <Legenda cor="border-steel-300 bg-white" texto="Livre" />
          <Legenda cor="border-steel-600 bg-concrete-200" texto="Ocupado" />
          <Legenda cor="border-signal-amber600 bg-signal-amber100" texto="Vence em breve" />
          <Legenda cor="border-signal-red600 bg-signal-red100" texto="Emergência" />
          <Legenda cor="border-dashed border-signal-amber600 bg-signal-amber100" texto="Corredor" />
          <Legenda cor="border-dashed border-signal-green600 bg-signal-green100" texto="Produto buscado" />
          <Legenda cor="border-signal-green600 bg-signal-green100" texto="Selecionado" />
        </div>
      </div>

      {carregando || !mapa ? (
        <p className="text-sm text-steel-400">Carregando mapa...</p>
      ) : (
        <MapaSetorView mapa={mapa} onSelect={setSelecionado} enderecoDestacadoId={enderecoDestacadoId} idsCandidatos={idsCandidatos} />
      )}

      <ProdutoModal endereco={selecionado} onClose={() => setSelecionado(null)} onAtualizado={recarregarMapa} />
    </div>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span className="flex items-center gap-1 whitespace-nowrap">
      <span className={`h-3 w-3 shrink-0 rounded-tag border ${cor}`} /> {texto}
    </span>
  );
}
