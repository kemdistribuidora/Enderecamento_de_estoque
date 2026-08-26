import { useState } from 'react';
import { EnderecoComStatus, MapaSetor, PrateleiraComPosicoes } from '../types';

interface Props {
  mapa: MapaSetor;
  onSelect: (endereco: EnderecoComStatus) => void;
  termoBusca?: string;
  enderecoDestacadoId?: number | null;
}

function CelulaPosicao({
  posicao,
  onClick,
  grande,
  destacado,
}: {
  posicao: EnderecoComStatus;
  onClick: (e: EnderecoComStatus) => void;
  grande?: boolean;
  destacado?: boolean;
}) {
  const ocupado = posicao.status === 'ocupado';
  return (
    <button
      onClick={() => onClick(posicao)}
      title={
        ocupado
          ? `${posicao.codigo} — ${posicao.produto?.nome} (vence ${posicao.produto?.validade})`
          : `${posicao.codigo} — livre`
      }
      className={`flex aspect-square min-w-0 items-center justify-center rounded-md border font-medium transition-transform hover:z-10 hover:scale-110 ${
        grande ? 'text-base' : 'text-xs'
      } ${
        destacado
          ? 'border-green-400 bg-green-200 text-green-800 ring-2 ring-green-500 hover:bg-green-300'
          : ocupado
            ? 'border-blue-300 bg-blue-100 text-blue-800 hover:bg-blue-200'
            : 'border-slate-200 bg-slate-100 text-slate-400 hover:bg-slate-200'
      }`}
    >
      {posicao.posicao}
    </button>
  );
}

function BlocoPrateleira({
  posicoes,
  letraDono,
  ladoDono,
  onSelect,
  onExpandir,
  grande,
  idsDestacados,
}: {
  posicoes: EnderecoComStatus[];
  letraDono: string;
  ladoDono: string;
  onSelect: (e: EnderecoComStatus) => void;
  onExpandir?: () => void;
  grande?: boolean;
  idsDestacados?: Set<number>;
}) {
  const andares = Array.from(new Set(posicoes.map((p) => p.andar))).sort((a, b) => b - a);
  const colunas = Math.max(...andares.map((andar) => posicoes.filter((p) => p.andar === andar).length));

  return (
    <div className="relative rounded-lg border border-slate-300 bg-white p-3">
      {onExpandir && (
        <button
          onClick={onExpandir}
          title="Ampliar prateleira"
          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-sm border border-slate-200 bg-slate-50 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          ⤢
        </button>
      )}
      <div className="mb-2 text-center text-xs font-semibold text-slate-600">
        {letraDono}
        {ladoDono}
      </div>
      <div className={grande ? 'space-y-3' : 'space-y-1.5'}>
        {andares.map((andar) => (
          <div key={andar} className="flex items-center gap-2">
            <span className={`shrink-0 text-center text-slate-400 ${grande ? 'w-5 text-sm' : 'w-4 text-[10px]'}`}>
              {andar}
            </span>
            <div
              className={`grid flex-1 ${grande ? 'gap-2' : 'gap-1'}`}
              style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }}
            >
              {posicoes
                .filter((p) => p.andar === andar)
                .sort((a, b) => a.posicao - b.posicao)
                .map((p) => (
                  <CelulaPosicao
                    key={p.id}
                    posicao={p}
                    onClick={onSelect}
                    grande={grande}
                    destacado={idsDestacados?.has(p.id)}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModalPrateleiraExpandida({
  prateleira,
  onClose,
  onSelect,
  idsDestacados,
}: {
  prateleira: PrateleiraComPosicoes;
  onClose: () => void;
  onSelect: (e: EnderecoComStatus) => void;
  idsDestacados?: Set<number>;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex h-[92vh] w-[95vw] flex-col rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-700">
            Prateleira {prateleira.dono.letra}
            {prateleira.dono.lado}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
        <div className="flex flex-1 items-center overflow-hidden">
          <div className="w-full">
            <BlocoPrateleira
              posicoes={prateleira.posicoes}
              letraDono={prateleira.dono.letra}
              ladoDono={prateleira.dono.lado}
              onSelect={onSelect}
              grande
              idsDestacados={idsDestacados}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FaixaCorredor({ letra }: { letra: string }) {
  return (
    <div className="flex h-8 items-center justify-center rounded-md border border-dashed border-amber-300 bg-amber-50">
      <span className="text-[10px] font-semibold tracking-wide text-amber-700">Corredor {letra}</span>
    </div>
  );
}

export default function MapaSetorView({ mapa, onSelect, termoBusca, enderecoDestacadoId }: Props) {
  const todasPosicoes = mapa.prateleiras.flatMap((p) => p.posicoes);
  const ocupados = todasPosicoes.filter((p) => p.status === 'ocupado').length;
  const [prateleiraExpandida, setPrateleiraExpandida] = useState<PrateleiraComPosicoes | null>(null);

  const termo = termoBusca?.trim().toLowerCase();
  const idsDestacados = new Set(
    termo
      ? todasPosicoes
          .filter((p) => p.produto && (p.produto.nome.toLowerCase().includes(termo) || p.produto.codigo.toLowerCase().includes(termo)))
          .map((p) => p.id)
      : []
  );
  if (enderecoDestacadoId != null) idsDestacados.add(enderecoDestacadoId);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{mapa.setor.nome}</h3>
        <span className="text-xs text-slate-500">
          {ocupados}/{todasPosicoes.length} posições ocupadas
        </span>
      </div>
      <div className="flex flex-col gap-4">
        {mapa.prateleiras.map((prateleira, idx) => (
          <div key={prateleira.id} className="flex flex-col gap-4">
            <BlocoPrateleira
              posicoes={prateleira.posicoes}
              letraDono={prateleira.dono.letra}
              ladoDono={prateleira.dono.lado}
              onSelect={onSelect}
              onExpandir={() => setPrateleiraExpandida(prateleira)}
              idsDestacados={idsDestacados}
            />
            {idx < mapa.corredores.length && <FaixaCorredor letra={mapa.corredores[idx]} />}
          </div>
        ))}
      </div>
      {prateleiraExpandida && (
        <ModalPrateleiraExpandida
          prateleira={prateleiraExpandida}
          onClose={() => setPrateleiraExpandida(null)}
          onSelect={onSelect}
          idsDestacados={idsDestacados}
        />
      )}
    </div>
  );
}
