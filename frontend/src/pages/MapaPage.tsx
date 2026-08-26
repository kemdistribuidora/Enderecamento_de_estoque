import { useEffect, useState } from 'react';
import { buscarMapaSetor, buscarSetores } from '../api/client';
import { EnderecoComStatus, MapaSetor, Setor } from '../types';
import MapaSetorView from '../components/MapaSetorView';
import ProdutoModal from '../components/ProdutoModal';

export default function MapaPage() {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [setorAtivoId, setSetorAtivoId] = useState<number | null>(null);
  const [mapa, setMapa] = useState<MapaSetor | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [selecionado, setSelecionado] = useState<EnderecoComStatus | null>(null);

  useEffect(() => {
    buscarSetores().then((lista) => {
      setSetores(lista);
      setSetorAtivoId(lista[0]?.id ?? null);
    });
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
      <div className="flex flex-wrap gap-2">
        {setores.map((s) => (
          <button
            key={s.id}
            onClick={() => setSetorAtivoId(s.id)}
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
      </div>

      {carregando || !mapa ? (
        <p className="text-sm text-slate-400">Carregando mapa...</p>
      ) : (
        <MapaSetorView mapa={mapa} onSelect={setSelecionado} />
      )}

      <ProdutoModal endereco={selecionado} onClose={() => setSelecionado(null)} />
    </div>
  );
}
