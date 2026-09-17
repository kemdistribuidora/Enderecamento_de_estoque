import { useEffect, useState } from 'react';
import { ItemCurvaAbc, buscarCurvaAbc } from '../api/client';
import { exportarCsv } from '../utils/exportCsv';

type CampoOrdenavel = 'total_saida' | 'percentual_acumulado';

export default function CurvaAbcPage() {
  const [curva, setCurva] = useState<ItemCurvaAbc[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [classeFiltro, setClasseFiltro] = useState<ItemCurvaAbc['classe'] | null>(null);
  const [ordenacao, setOrdenacao] = useState<{ campo: CampoOrdenavel; direcao: 'asc' | 'desc' } | null>(null);

  function alternarOrdenacao(campo: CampoOrdenavel) {
    setOrdenacao((atual) => {
      if (!atual || atual.campo !== campo) return { campo, direcao: 'desc' };
      if (atual.direcao === 'desc') return { campo, direcao: 'asc' };
      return null;
    });
  }

  useEffect(() => {
    buscarCurvaAbc()
      .then(setCurva)
      .finally(() => setCarregando(false));
  }, []);

  const buscaNormalizada = busca.trim().toLowerCase();
  const curvaFiltrada = curva
    .map((item, i) => ({ item, posicao: i + 1 }))
    .filter(
      ({ item }) =>
        (!classeFiltro || item.classe === classeFiltro) &&
        (!buscaNormalizada ||
          item.nome.toLowerCase().includes(buscaNormalizada) ||
          item.codigo.toLowerCase().includes(buscaNormalizada))
    );

  const curvaOrdenada = ordenacao
    ? [...curvaFiltrada].sort((a, b) => {
        const diff = a.item[ordenacao.campo] - b.item[ordenacao.campo];
        return ordenacao.direcao === 'asc' ? diff : -diff;
      })
    : curvaFiltrada;

  function handleExportar() {
    exportarCsv('curva-abc.csv', [
      ['#', 'Produto', 'Código', 'Total saída', '% Acumulado', 'Classe'],
      ...curvaOrdenada.map(({ item, posicao }) => [
        posicao,
        item.nome,
        item.codigo,
        item.total_saida,
        item.percentual_acumulado.toFixed(1),
        item.classe,
      ]),
    ]);
  }

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-start justify-between gap-4 border-b-2 border-steel-600/25 pb-4">
        <div>
          <h1 className="page-title">Curva ABC</h1>
          <p className="mt-1 text-sm text-ink-600">
            Giro de estoque ordenado por saída total. Classe A = 80% do volume, B = 95%, C = resto.
          </p>
        </div>
        {!carregando && curva.length > 0 && (
          <button type="button" onClick={handleExportar} className="btn-secondary shrink-0">
            Exportar CSV
          </button>
        )}
      </div>

      {carregando && <p className="text-sm text-steel-400">Carregando...</p>}

      {!carregando && curva.length > 0 && (
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar produto por nome ou código..."
          className="input w-full max-w-md"
        />
      )}

      {!carregando && curva.length > 0 && (
        <div className="panel overflow-x-auto">
          <table className="table-plate">
            <thead>
              <tr>
                <th>#</th>
                <th>Produto</th>
                <th>
                  <CabecalhoOrdenavel
                    label="Total saída"
                    campo="total_saida"
                    ordenacao={ordenacao}
                    onClick={() => alternarOrdenacao('total_saida')}
                  />
                </th>
                <th>
                  <CabecalhoOrdenavel
                    label="% Acumulado"
                    campo="percentual_acumulado"
                    ordenacao={ordenacao}
                    onClick={() => alternarOrdenacao('percentual_acumulado')}
                  />
                </th>
                <th>
                  <FiltroClasse valor={classeFiltro} onMudar={setClasseFiltro} />
                </th>
              </tr>
            </thead>
            <tbody>
              {curvaFiltrada.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-ink-600">
                    Nenhum produto encontrado para "{busca}".
                  </td>
                </tr>
              )}
              {curvaOrdenada.map(({ item, posicao }) => (
                <tr key={item.produto_id}>
                  <td className="text-steel-400">{posicao}</td>
                  <td className="whitespace-nowrap">
                    <span className="font-medium text-ink-900">{item.nome}</span>{' '}
                    <span className="data-code text-steel-400">{item.codigo}</span>
                  </td>
                  <td className="data-code">{item.total_saida}</td>
                  <td className="data-code">{item.percentual_acumulado.toFixed(1)}%</td>
                  <td className="whitespace-nowrap">
                    <ClasseBadge classe={item.classe} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CabecalhoOrdenavel({
  label,
  campo,
  ordenacao,
  onClick,
}: {
  label: string;
  campo: CampoOrdenavel;
  ordenacao: { campo: CampoOrdenavel; direcao: 'asc' | 'desc' } | null;
  onClick: () => void;
}) {
  const ativo = ordenacao?.campo === campo;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 hover:text-white"
    >
      {label}
      <svg
        className={`h-3 w-3 text-concrete-300 transition-transform ${ativo && ordenacao?.direcao === 'asc' ? 'rotate-180' : ''}`}
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}

function FiltroClasse({
  valor,
  onMudar,
}: {
  valor: ItemCurvaAbc['classe'] | null;
  onMudar: (classe: ItemCurvaAbc['classe'] | null) => void;
}) {
  return (
    <div className="relative inline-block">
      <select
        value={valor ?? ''}
        onChange={(e) => onMudar(e.target.value ? (e.target.value as ItemCurvaAbc['classe']) : null)}
        className="appearance-none border-none bg-transparent py-0 pl-1 pr-4 text-xs font-semibold uppercase tracking-wide text-concrete-100 focus:outline-none"
      >
        <option value="" className="bg-steel-900 text-white">Classe</option>
        <option value="A" className="bg-steel-900 text-white">A</option>
        <option value="B" className="bg-steel-900 text-white">B</option>
        <option value="C" className="bg-steel-900 text-white">C</option>
      </select>
      <svg
        className="pointer-events-none absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 text-concrete-300"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
}

function ClasseBadge({ classe }: { classe: ItemCurvaAbc['classe'] }) {
  const estilos: Record<ItemCurvaAbc['classe'], string> = {
    A: 'tag-green',
    B: 'tag-amber',
    C: 'tag-neutral',
  };
  return <span className={estilos[classe]}>{classe}</span>;
}
