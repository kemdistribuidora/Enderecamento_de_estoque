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
        className="flex h-[92vh] w-[95vw] max-w-5xl flex-col rounded-soft border border-steel-600 bg-white p-6 shadow-lg shadow-steel-900/20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <h3 className="font-display text-xl font-bold text-steel-900">Escolher posição no mapa</h3>
          <button onClick={onFechar} className="text-steel-400 hover:text-steel-900">
            ✕
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {setores.map((s) => (
            <button
              key={s.id}
              onClick={() => setSetorAtivoId(s.id)}
              className={`rounded-tag px-3 py-1.5 text-sm font-semibold uppercase tracking-wide transition-colors ${
                setorAtivoId === s.id
                  ? 'bg-steel-900 text-white'
                  : 'border border-steel-600 bg-white text-steel-700 hover:bg-concrete-200'
              }`}
            >
              {s.nome}
            </button>
          ))}
        </div>

        {aviso && <p className="mb-2 text-sm text-signal-red600">{aviso}</p>}

        <div className="flex-1 overflow-auto">
          {carregando || !mapa ? (
            <p className="text-sm text-steel-400">Carregando mapa...</p>
          ) : (
            <MapaSetorView mapa={mapa} onSelect={handleSelect} enderecoDestacadoId={enderecoSugeridoId} />
          )}
        </div>
      </div>
    </div>
  );
}
