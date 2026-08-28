import { useEffect, useState } from 'react';
import { ItemCurvaAbc, buscarCurvaAbc } from '../api/client';

export default function CurvaAbcPage() {
  const [curva, setCurva] = useState<ItemCurvaAbc[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    buscarCurvaAbc()
      .then(setCurva)
      .finally(() => setCarregando(false));
  }, []);

  const semGiro = curva.every((i) => i.total_saida === 0);

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">Curva ABC (giro de estoque)</h1>
        <p className="mt-1 text-sm text-slate-500">
          Produtos ordenados por saída total. Classe A = até 80% do volume acumulado, B = até 95%, C = resto. Baseado
          no histórico de saída registrado no sistema — quanto mais movimentação passar por aqui, mais precisa fica.
        </p>
      </div>

      {carregando && <p className="text-sm text-slate-400">Carregando...</p>}

      {!carregando && semGiro && (
        <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-500">
          Ainda sem nenhuma saída registrada — a curva fica disponível conforme o histórico de movimentação for
          crescendo.
        </p>
      )}

      {!carregando && curva.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Produto</th>
                <th className="px-4 py-2 text-right">Total saída</th>
                <th className="px-4 py-2 text-right">% acumulado</th>
                <th className="px-4 py-2">Classe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {curva.map((item, i) => (
                <tr key={item.produto_id}>
                  <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                  <td className="px-4 py-2">
                    <span className="font-medium text-slate-800">{item.nome}</span>{' '}
                    <span className="text-slate-400">— {item.codigo}</span>
                  </td>
                  <td className="px-4 py-2 text-right">{item.total_saida}</td>
                  <td className="px-4 py-2 text-right">{item.percentual_acumulado.toFixed(1)}%</td>
                  <td className="px-4 py-2">
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

function ClasseBadge({ classe }: { classe: ItemCurvaAbc['classe'] }) {
  const estilos: Record<ItemCurvaAbc['classe'], string> = {
    A: 'bg-green-100 text-green-700',
    B: 'bg-amber-100 text-amber-700',
    C: 'bg-slate-100 text-slate-600',
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estilos[classe]}`}>{classe}</span>;
}
