import { useEffect, useState } from 'react';
import { KpisDashboard, buscarDashboardKpis } from '../api/client';
import { exportarCsv } from '../utils/exportCsv';

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KpisDashboard | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    buscarDashboardKpis()
      .then(setKpis)
      .finally(() => setCarregando(false));
  }, []);

  function handleExportar() {
    if (!kpis) return;
    exportarCsv('dashboard-kpis.csv', [
      ['Indicador', 'Valor', 'Detalhe'],
      [
        'Acurácia de estoque',
        kpis.acuracia_estoque.status === 'ok' ? `${kpis.acuracia_estoque.percentual!.toFixed(1)}%` : 'Sem dados',
        kpis.acuracia_estoque.status === 'ok'
          ? `${kpis.acuracia_estoque.total_produtos - kpis.acuracia_estoque.produtos_com_divergencia}/${kpis.acuracia_estoque.total_produtos} produtos sem divergência`
          : 'Importe o saldo do Winthor',
      ],
      [
        'Giro médio',
        kpis.giro_medio.status === 'ok' ? kpis.giro_medio.valor!.toFixed(1) : 'Sem dados',
        kpis.giro_medio.status === 'ok' ? `${kpis.giro_medio.produtos_com_giro} produtos com saída` : 'Nenhuma saída registrada',
      ],
      ['Emergência (vence em até 15 dias)', kpis.vencimento.emergencias, ''],
      ['Vencendo em breve (vence em até 35 dias)', kpis.vencimento.proximos, ''],
      [],
      ['Setor', 'Ocupados', 'Total endereços', '% Ocupação'],
      ...kpis.ocupacao_por_setor.map((s) => [
        s.setor_nome,
        s.ocupados,
        s.total_enderecos,
        s.percentual === null ? 'Sem posições cadastradas' : `${s.percentual.toFixed(0)}%`,
      ]),
    ]);
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-lg font-semibold text-slate-800">Dashboard</h1>
        {kpis && (
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

      {kpis && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-4">
            <Tile
              titulo="Acurácia de estoque"
              valor={
                kpis.acuracia_estoque.status === 'ok'
                  ? `${kpis.acuracia_estoque.percentual!.toFixed(1)}%`
                  : 'Sem dados'
              }
              legenda={
                kpis.acuracia_estoque.status === 'ok'
                  ? `${kpis.acuracia_estoque.total_produtos - kpis.acuracia_estoque.produtos_com_divergencia}/${kpis.acuracia_estoque.total_produtos} produtos sem divergência`
                  : 'Importe o saldo do Winthor'
              }
              cor="blue"
            />
            <Tile
              titulo="Giro médio"
              valor={kpis.giro_medio.status === 'ok' ? kpis.giro_medio.valor!.toFixed(1) : 'Sem dados'}
              legenda={
                kpis.giro_medio.status === 'ok'
                  ? `${kpis.giro_medio.produtos_com_giro} produtos com saída`
                  : 'Nenhuma saída registrada'
              }
              cor="slate"
            />
            <Tile
              titulo="Emergência"
              valor={String(kpis.vencimento.emergencias)}
              legenda="vence em até 15 dias"
              cor="red"
            />
            <Tile
              titulo="Vencendo em breve"
              valor={String(kpis.vencimento.proximos)}
              legenda="vence em até 35 dias"
              cor="amber"
            />
          </div>

          <div>
            <h2 className="mb-2 text-base font-semibold text-slate-800">Ocupação por setor</h2>
            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
              {kpis.ocupacao_por_setor.length === 0 && (
                <p className="text-sm text-slate-500">Nenhum setor cadastrado.</p>
              )}
              {kpis.ocupacao_por_setor.map((s) => (
                <div key={s.setor_id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{s.setor_nome}</span>
                    <span className="text-slate-500">
                      {s.percentual === null ? 'Sem posições cadastradas' : `${s.ocupados}/${s.total_enderecos} (${s.percentual.toFixed(0)}%)`}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-blue-500"
                      style={{ width: `${s.percentual ?? 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Tile({
  titulo,
  valor,
  legenda,
  cor,
}: {
  titulo: string;
  valor: string;
  legenda: string;
  cor: 'blue' | 'slate' | 'red' | 'amber';
}) {
  const cores: Record<typeof cor, string> = {
    blue: 'text-blue-700',
    slate: 'text-slate-700',
    red: 'text-red-700',
    amber: 'text-amber-700',
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="whitespace-nowrap text-xs font-medium uppercase text-slate-500">{titulo}</p>
      <p className={`mt-1 text-2xl font-semibold ${cores[cor]}`}>{valor}</p>
      <p className="mt-1 truncate text-xs text-slate-400" title={legenda}>
        {legenda}
      </p>
    </div>
  );
}
