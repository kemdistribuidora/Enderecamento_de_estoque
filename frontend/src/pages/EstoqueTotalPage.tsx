import { useEffect, useState, type ReactNode } from 'react';
import { ItemEstoqueTotal, buscarEstoqueTotal } from '../api/client';
import AvisoIdadeSaldo from '../components/AvisoIdadeSaldo';
import { exportarCsv } from '../utils/exportCsv';
import { converteEmCaixa, formatarQtdCx } from '../utils/quantidade';

type Status = ItemEstoqueTotal['status'];

const ROTULO_STATUS: Record<Status, string> = {
  ok: 'Bate',
  falta_posicionar: 'Falta posicionar',
  sobra: 'Sobra no WMS',
  sem_saldo: 'Sem saldo Winthor',
};

const ESTILO_STATUS: Record<Status, string> = {
  ok: 'tag-green',
  falta_posicionar: 'tag-amber',
  sobra: 'tag-red',
  sem_saldo: 'tag-neutral',
};

const ORDEM_STATUS: Status[] = ['ok', 'falta_posicionar', 'sobra', 'sem_saldo'];

export default function EstoqueTotalPage() {
  const [itens, setItens] = useState<ItemEstoqueTotal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<Status | null>(null);

  useEffect(() => {
    buscarEstoqueTotal()
      .then(setItens)
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, []);

  const contagemPorStatus = Object.fromEntries(
    ORDEM_STATUS.map((s) => [s, itens.filter((i) => i.status === s).length]),
  ) as Record<Status, number>;

  const buscaNormalizada = busca.trim().toLowerCase();
  const itensFiltrados = itens.filter(
    (item) =>
      (!statusFiltro || item.status === statusFiltro) &&
      (!buscaNormalizada ||
        item.nome.toLowerCase().includes(buscaNormalizada) ||
        item.codigo.toLowerCase().includes(buscaNormalizada)),
  );

  function handleExportar() {
    exportarCsv('estoque-total.csv', [
      ['Código', 'Produto', 'Unidade', 'Saldo Winthor', 'Posicionado WMS', 'Diferença', 'Posições', 'Status'],
      ...itensFiltrados.map((item) => [
        item.codigo,
        item.nome,
        item.unidade || 'UN',
        item.saldo_winthor ?? '',
        item.posicionado,
        item.diferenca,
        item.posicoes,
        ROTULO_STATUS[item.status],
      ]),
    ]);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 border-b-2 border-steel-600/25 pb-4">
        <div>
          <h1 className="page-title">Estoque Total</h1>
          <p className="mt-1 text-sm text-ink-600">
            Saldo do Winthor lado a lado com o total posicionado no WMS, por produto.
          </p>
        </div>
        {!carregando && itens.length > 0 && (
          <button type="button" onClick={handleExportar} className="btn-secondary shrink-0">
            Exportar CSV
          </button>
        )}
      </div>

      <AvisoIdadeSaldo />

      {carregando && <p className="text-sm text-steel-400">Carregando...</p>}
      {erro && <p className="text-sm text-signal-red600">{erro}</p>}

      {!carregando && !erro && itens.length === 0 && (
        <p className="text-sm text-ink-600">Nenhum produto com saldo importado ou posicionado ainda.</p>
      )}

      {!carregando && itens.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar produto por nome ou código..."
              className="input w-full max-w-md"
            />
            <div className="flex flex-wrap gap-2">
              <FiltroChip ativo={statusFiltro === null} onClick={() => setStatusFiltro(null)}>
                Todos ({itens.length})
              </FiltroChip>
              {ORDEM_STATUS.filter((s) => contagemPorStatus[s] > 0).map((s) => (
                <FiltroChip key={s} ativo={statusFiltro === s} onClick={() => setStatusFiltro(s)}>
                  {ROTULO_STATUS[s]} ({contagemPorStatus[s]})
                </FiltroChip>
              ))}
            </div>
          </div>

          <div className="panel max-w-6xl overflow-x-auto">
            <table className="table-plate">
              <colgroup>
                <col />
                <col className="w-44" />
                <col className="w-44" />
                <col className="w-36" />
                <col className="w-24" />
                <col className="w-40" />
              </colgroup>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Saldo Winthor</th>
                  <th>Posicionado WMS</th>
                  <th>Diferença</th>
                  <th>Posições</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {itensFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-ink-600">
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                )}
                {itensFiltrados.map((item) => (
                  <tr key={item.produto_id}>
                    <td title={`${item.nome} ${item.codigo}`}>
                      <span className="font-medium text-ink-900">{item.nome}</span>{' '}
                      <span className="data-code text-steel-400">{item.codigo}</span>
                    </td>
                    <td>
                      {item.saldo_winthor == null ? (
                        <span className="text-steel-400">-</span>
                      ) : (
                        <Quantidade unidades={item.saldo_winthor} qtPorCx={item.qt_por_cx} unidade={item.unidade} />
                      )}
                    </td>
                    <td>
                      <Quantidade unidades={item.posicionado} qtPorCx={item.qt_por_cx} unidade={item.unidade} />
                    </td>
                    <td className="data-code whitespace-nowrap">
                      {item.diferenca === 0 ? (
                        <span className="text-steel-400">0</span>
                      ) : (
                        <span className={item.diferenca < 0 ? 'text-signal-amber600' : 'text-signal-red600'}>
                          {item.diferenca > 0 ? '+' : ''}
                          {item.diferenca} {item.unidade || 'UN'}
                        </span>
                      )}
                    </td>
                    <td className="data-code">{item.posicoes}</td>
                    <td>
                      <span className={ESTILO_STATUS[item.status]}>{ROTULO_STATUS[item.status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Quantidade({
  unidades,
  qtPorCx,
  unidade,
}: {
  unidades: number;
  qtPorCx: number | null;
  unidade: string | null;
}) {
  return (
    <div className="data-code whitespace-nowrap">
      <div className="text-ink-900">
        {unidades} {unidade || 'UN'}
      </div>
      {converteEmCaixa(qtPorCx, unidade) ? (
        <div className="text-xs text-steel-400">{formatarQtdCx(unidades, qtPorCx, unidade)}</div>
      ) : null}
    </div>
  );
}

function FiltroChip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-tag border px-2.5 py-1 text-xs font-semibold transition-colors ${
        ativo
          ? 'border-steel-900 bg-steel-900 text-white'
          : 'border-steel-600/30 bg-white text-ink-600 hover:border-steel-500'
      }`}
    >
      {children}
    </button>
  );
}
