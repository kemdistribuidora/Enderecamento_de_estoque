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
    <div className="max-w-5xl space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Curva ABC (giro de estoque)</h1>
          <p className="mt-1 text-sm text-slate-500">Ordenado por saída total. A = 80% do volume, B = 95%, C = resto.</p>
        </div>
        {!carregando && curva.length > 0 && (
          <button
            type="button"
            onClick={handleExportar}
            className="shrink-0 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Exportar CSV
          </button>
        )}
      </div>

      {carregando && <p className="text-sm text-slate-400">Carregando...</p>}

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
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Produto</th>
                <th className="px-4 py-2">
                  <CabecalhoOrdenavel
                    label="Total saída"
                    campo="total_saida"
                    ordenacao={ordenacao}
                    onClick={() => alternarOrdenacao('total_saida')}
                  />
                </th>
                <th className="px-4 py-2">
                  <CabecalhoOrdenavel
                    label="% Acumulado"
                    campo="percentual_acumulado"
                    ordenacao={ordenacao}
                    onClick={() => alternarOrdenacao('percentual_acumulado')}
                  />
                </th>
                <th className="px-4 py-2">
                  <FiltroClasse valor={classeFiltro} onMudar={setClasseFiltro} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {curvaFiltrada.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    Nenhum produto encontrado para "{busca}".
                  </td>
                </tr>
              )}
              {curvaOrdenada.map(({ item, posicao }) => (
                <tr key={item.produto_id}>
                  <td className="px-4 py-2 text-slate-400">{posicao}</td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <span className="font-medium text-slate-800">{item.nome}</span>{' '}
                    <span className="text-slate-400">— {item.codigo}</span>
                  </td>
                  <td className="px-4 py-2">{item.total_saida}</td>
                  <td className="px-4 py-2">{item.percentual_acumulado.toFixed(1)}%</td>
                  <td className="whitespace-nowrap px-4 py-2">
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
      className="inline-flex items-center gap-1 hover:text-slate-700"
    >
      {label}
      <svg
        className={`h-3 w-3 text-slate-400 transition-transform ${ativo && ordenacao?.direcao === 'asc' ? 'rotate-180' : ''}`}
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
        className="appearance-none border-none bg-transparent py-0 pl-1 pr-4 text-xs font-medium uppercase text-slate-500 focus:outline-none"
      >
        <option value="">Classe</option>
        <option value="A">A</option>
        <option value="B">B</option>
        <option value="C">C</option>
      </select>
      <svg
        className="pointer-events-none absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400"
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
    A: 'bg-green-100 text-green-700',
    B: 'bg-amber-100 text-amber-700',
    C: 'bg-slate-100 text-slate-600',
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estilos[classe]}`}>{classe}</span>;
}
