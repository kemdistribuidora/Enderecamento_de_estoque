import { useState } from 'react';
import { EnderecoComStatus, MapaSetor, PrateleiraComPosicoes } from '../types';
import { formatarQtdCx } from '../utils/quantidade';

interface Props {
  mapa: MapaSetor;
  onSelect: (endereco: EnderecoComStatus) => void;
  enderecoDestacadoId?: number | null;
  idsCandidatos?: Set<number>;
}

function CelulaPosicao({
  posicao,
  onClick,
  grande,
  destacado,
  candidato,
  candidatoPontilhado,
}: {
  posicao: EnderecoComStatus;
  onClick: (e: EnderecoComStatus) => void;
  grande?: boolean;
  destacado?: boolean;
  candidato?: boolean;
  candidatoPontilhado?: boolean;
}) {
  const ocupado = posicao.status === 'ocupado';
  const statusValidade = posicao.produto?.status_validade;

  const corOcupado =
    statusValidade === 'emergencia'
      ? 'border-signal-red600 bg-signal-red100 text-signal-red600'
      : statusValidade === 'proximo'
        ? 'border-signal-amber600 bg-signal-amber100 text-signal-amber600'
        : 'border-steel-600 bg-concrete-200 text-ink-900';

  const corCandidato = destacado
    ? 'border-signal-green600 bg-signal-green100 text-signal-green600 ring-2 ring-signal-green600'
    : candidato
      ? `border-signal-green600 bg-signal-green100 text-signal-green600 ${candidatoPontilhado ? 'border-dashed' : ''}`
      : ocupado
        ? corOcupado
        : 'border-steel-300 bg-white text-steel-400';

  const tituloBase = ocupado
    ? `${posicao.codigo} — ${posicao.produto?.nome} · ${formatarQtdCx(
        posicao.produto?.quantidade ?? 0,
        posicao.produto?.qt_por_cx ?? null
      )} (vence ${posicao.produto?.validade}${
        statusValidade === 'emergencia'
          ? ' — EMERGÊNCIA'
          : statusValidade === 'proximo'
            ? ' — vence em breve'
            : ''
      })`
    : `${posicao.codigo} — livre`;

  return (
    <button
      onClick={() => onClick(posicao)}
      title={posicao.bloqueado ? `${tituloBase} — ⚠ ${posicao.bloqueio_motivo}` : tituloBase}
      className={`relative flex aspect-square min-w-0 items-center justify-center rounded-tag border-2 font-medium transition-transform hover:z-10 hover:scale-110 hover:opacity-90 ${
        grande ? 'text-base' : 'text-xs'
      } ${corCandidato}`}
    >
      {posicao.posicao}
      {posicao.bloqueado && (
        <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-signal-red600 text-[9px] leading-none text-white">
          !
        </span>
      )}
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
  idsCandidatos,
  candidatoPontilhado,
}: {
  posicoes: EnderecoComStatus[];
  letraDono: string;
  ladoDono: string;
  onSelect: (e: EnderecoComStatus) => void;
  onExpandir?: () => void;
  grande?: boolean;
  idsDestacados?: Set<number>;
  idsCandidatos?: Set<number>;
  candidatoPontilhado?: boolean;
}) {
  const andares = Array.from(new Set(posicoes.map((p) => p.andar))).sort((a, b) => b - a);
  const colunas = Math.max(...andares.map((andar) => posicoes.filter((p) => p.andar === andar).length));

  return (
    <div className="relative panel p-3">
      {onExpandir && (
        <button
          onClick={onExpandir}
          title="Ampliar prateleira"
          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-tag border-2 border-steel-300 bg-concrete-100 text-xs text-ink-600 hover:bg-concrete-200 hover:text-ink-900"
        >
          ⤢
        </button>
      )}
      <div className="data-code mb-2 text-center text-xs font-semibold text-ink-600">
        {letraDono}
        {ladoDono}
      </div>
      <div className={grande ? 'space-y-3' : 'space-y-1.5'}>
        {andares.map((andar) => (
          <div key={andar} className="flex items-center gap-2">
            <span className={`data-code shrink-0 text-center text-steel-400 ${grande ? 'w-5 text-sm' : 'w-4 text-[10px]'}`}>
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
                    candidato={idsCandidatos?.has(p.id)}
                    candidatoPontilhado={candidatoPontilhado}
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
  idsCandidatos,
  candidatoPontilhado,
}: {
  prateleira: PrateleiraComPosicoes;
  onClose: () => void;
  onSelect: (e: EnderecoComStatus) => void;
  idsDestacados?: Set<number>;
  idsCandidatos?: Set<number>;
  candidatoPontilhado?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="panel flex h-[92vh] w-[95vw] flex-col p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <h3 className="font-display text-lg font-bold text-steel-900">
            Prateleira {prateleira.dono.letra}
            {prateleira.dono.lado}
          </h3>
          <button onClick={onClose} className="text-steel-400 hover:text-ink-900">
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
              idsCandidatos={idsCandidatos}
              candidatoPontilhado={candidatoPontilhado}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FaixaCorredor({ letra }: { letra: string }) {
  return (
    <div className="flex h-8 items-center justify-center rounded-tag border-2 border-dashed border-signal-amber600 bg-signal-amber100">
      <span className="text-[10px] font-semibold tracking-wide text-signal-amber600">Corredor {letra}</span>
    </div>
  );
}

export default function MapaSetorView({ mapa, onSelect, enderecoDestacadoId, idsCandidatos }: Props) {
  const todasPosicoes = mapa.prateleiras.flatMap((p) => p.posicoes);
  const ocupados = todasPosicoes.filter((p) => p.status === 'ocupado').length;
  const [prateleiraExpandida, setPrateleiraExpandida] = useState<PrateleiraComPosicoes | null>(null);

  const idsDestacados = new Set<number>(enderecoDestacadoId != null ? [enderecoDestacadoId] : []);
  const candidatoPontilhado = enderecoDestacadoId != null;

  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-sm font-bold text-steel-900">{mapa.setor.nome}</h3>
        <span className="data-code text-xs text-ink-600">
          {ocupados}/{todasPosicoes.length} posições ocupadas
        </span>
      </div>
      <div className="flex flex-col gap-4">
        {mapa.prateleiras.map((prateleira) => (
          <div key={prateleira.id} className="flex flex-col gap-4">
            <BlocoPrateleira
              posicoes={prateleira.posicoes}
              letraDono={prateleira.dono.letra}
              ladoDono={prateleira.dono.lado}
              onSelect={onSelect}
              onExpandir={() => setPrateleiraExpandida(prateleira)}
              idsDestacados={idsDestacados}
              idsCandidatos={idsCandidatos}
              candidatoPontilhado={candidatoPontilhado}
            />
            {mapa.corredores
              .filter((c) => c.aposPrateleiraOrdem === prateleira.ordem)
              .map((c) => (
                <FaixaCorredor key={c.letra} letra={c.letra} />
              ))}
          </div>
        ))}
      </div>
      {prateleiraExpandida && (
        <ModalPrateleiraExpandida
          prateleira={prateleiraExpandida}
          onClose={() => setPrateleiraExpandida(null)}
          onSelect={onSelect}
          idsDestacados={idsDestacados}
          idsCandidatos={idsCandidatos}
          candidatoPontilhado={candidatoPontilhado}
        />
      )}
    </div>
  );
}
