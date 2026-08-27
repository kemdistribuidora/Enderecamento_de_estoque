import { useEffect, useState } from 'react';
import { buscarMapaSetor, buscarSetores } from '../api/client';
import { EnderecoComStatus, MapaSetor, Setor } from '../types';
import MapaSetorView from './MapaSetorView';

export default function ModalEscolherNoMapa({
  onFechar,
  onEscolher,
  enderecoSugeridoId,
  setorSugeridoId,
}: {
  onFechar: () => void;
  onEscolher: (endereco: EnderecoComStatus) => void;
  enderecoSugeridoId?: number | null;
  setorSugeridoId?: number | null;
}) {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [setorAtivoId, setSetorAtivoId] = useState<number | null>(setorSugeridoId ?? null);
  const [mapa, setMapa] = useState<MapaSetor | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    buscarSetores().then((lista) => {
      setSetores(lista);
      // abre no setor da sugestao (se tiver); senao o primeiro da lista
      setSetorAtivoId((atual) => atual ?? lista[0]?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (setorAtivoId === null) return;
    setCarregando(true);
    buscarMapaSetor(setorAtivoId)
      .then(setMapa)
      .finally(() => setCarregando(false));
  }, [setorAtivoId]);

  function handleSelect(endereco: EnderecoComStatus) {
    if (endereco.status !== 'livre') {
      setAviso(`Posição ${endereco.codigo} já está ocupada.`);
      return;
    }
    onEscolher(endereco);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onFechar}>
      <div
        className="flex h-[92vh] w-[95vw] max-w-5xl flex-col rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-700">Escolher posição no mapa</h3>
          <button onClick={onFechar} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
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

        {aviso && <p className="mb-2 text-sm text-red-600">{aviso}</p>}

        <div className="flex-1 overflow-auto">
          {carregando || !mapa ? (
            <p className="text-sm text-slate-400">Carregando mapa...</p>
          ) : (
            <MapaSetorView mapa={mapa} onSelect={handleSelect} enderecoDestacadoId={enderecoSugeridoId} />
          )}
        </div>
      </div>
    </div>
  );
}
