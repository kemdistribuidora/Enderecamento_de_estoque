import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { buscarMapaSetor, buscarSetores } from '../api/client';
import { EnderecoComStatus, MapaSetor, Setor } from '../types';
import MapaSetorView from '../components/MapaSetorView';
import ProdutoModal from '../components/ProdutoModal';
import SearchBar from '../components/SearchBar';

export default function MapaPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const setorParam = searchParams.get('setor');
  const enderecoParam = searchParams.get('endereco');
  const enderecoDestacadoId = enderecoParam ? Number(enderecoParam) : null;

  const [setores, setSetores] = useState<Setor[]>([]);
  const [setorAtivoId, setSetorAtivoId] = useState<number | null>(null);
  const [mapa, setMapa] = useState<MapaSetor | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [selecionado, setSelecionado] = useState<EnderecoComStatus | null>(null);
  const [termoBusca, setTermoBusca] = useState('');

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

  return (
    <div className="space-y-4">
      <SearchBar onChange={setTermoBusca} />

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

      <div className="flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border border-slate-200 bg-slate-100" /> livre
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border border-blue-300 bg-blue-100" /> ocupado
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border border-dashed border-amber-300 bg-amber-50" /> corredor (passagem)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border border-green-400 bg-green-200" /> encontrado
        </span>
      </div>

      {carregando || !mapa ? (
        <p className="text-sm text-slate-400">Carregando mapa...</p>
      ) : (
        <MapaSetorView
          mapa={mapa}
          onSelect={setSelecionado}
          termoBusca={termoBusca}
          enderecoDestacadoId={enderecoDestacadoId}
        />
      )}

      <ProdutoModal endereco={selecionado} onClose={() => setSelecionado(null)} />
    </div>
  );
}
