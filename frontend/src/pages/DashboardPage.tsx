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
      <div className="flex items-start justify-between gap-4 border-b-2 border-steel-600/25 pb-4">
        <h1 className="page-title">Dashboard</h1>
        {kpis && (
          <button type="button" onClick={handleExportar} className="btn-secondary shrink-0">
            Exportar CSV
          </button>
        )}
      </div>

      {carregando && <p className="text-sm text-steel-400">Carregando...</p>}

      {kpis && (
        <>
          <div className="grid grid-cols-12 gap-4">
            <HeroTile
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
            />
            <div className="col-span-12 grid grid-cols-3 gap-4 md:col-span-7">
              <Tile
                titulo="Giro médio"
                valor={kpis.giro_medio.status === 'ok' ? kpis.giro_medio.valor!.toFixed(1) : 'Sem dados'}
                legenda={
                  kpis.giro_medio.status === 'ok'
                    ? `${kpis.giro_medio.produtos_com_giro} produtos com saída`
                    : 'Nenhuma saída registrada'
                }
                cor="neutral"
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
          </div>

          <div>
            <h2 className="mb-2 font-display text-lg font-bold text-steel-900">
              Ocupação por setor
            </h2>
            <div className="panel space-y-3 p-4">
              {kpis.ocupacao_por_setor.length === 0 && (
                <p className="text-sm text-ink-600">Nenhum setor cadastrado.</p>
              )}
              {kpis.ocupacao_por_setor.map((s) => (
                <div key={s.setor_id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-ink-900">{s.setor_nome}</span>
                    <span className="data-code text-ink-600">
                      {s.percentual === null ? 'Sem posições cadastradas' : `${s.ocupados}/${s.total_enderecos} (${s.percentual.toFixed(0)}%)`}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-tag bg-concrete-200">
                    <div className="h-2 rounded-tag bg-rust-600" style={{ width: `${s.percentual ?? 0}%` }} />
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

function HeroTile({ titulo, valor, legenda }: { titulo: string; valor: string; legenda: string }) {
  return (
    <div className="col-span-12 flex flex-col justify-center bg-steel-900 p-6 text-white md:col-span-5">
      <p className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-steel-300">{titulo}</p>
      <p className="mt-1 font-display text-6xl font-bold text-white">{valor}</p>
      <p className="mt-2 text-sm text-steel-300" title={legenda}>
        {legenda}
      </p>
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
  cor: 'neutral' | 'red' | 'amber';
}) {
  const cores: Record<typeof cor, string> = {
    neutral: 'text-steel-700',
    red: 'text-signal-red600',
    amber: 'text-signal-amber600',
  };
  return (
    <div className="panel flex flex-col p-4">
      <p className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-ink-600">{titulo}</p>
      <p className={`mt-1 font-display text-3xl font-bold ${cores[cor]}`}>{valor}</p>
      <p className="mt-1 truncate text-xs text-steel-400" title={legenda}>
        {legenda}
      </p>
    </div>
  );
}
