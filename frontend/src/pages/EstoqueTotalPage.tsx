import { useEffect, useState } from 'react';
import { ItemEstoqueTotal, buscarEstoqueTotal } from '../api/client';
import { exportarCsv } from '../utils/exportCsv';
import { converteEmCaixa, formatarQtdCx } from '../utils/quantidade';

// So dado do WMS (soma das posicoes ocupadas). Conferencia manual: olha esta tela e o
// Winthor lado a lado, produto por produto.
export default function EstoqueTotalPage() {
  const [itens, setItens] = useState<ItemEstoqueTotal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    buscarEstoqueTotal()
      .then(setItens)
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, []);

  const buscaNormalizada = busca.trim().toLowerCase();
  const itensFiltrados = itens.filter(
    (item) =>
      !buscaNormalizada ||
      item.nome.toLowerCase().includes(buscaNormalizada) ||
      item.codigo.toLowerCase().includes(buscaNormalizada),
  );

  function emCaixas(item: ItemEstoqueTotal): string {
    return converteEmCaixa(item.qt_por_cx, item.unidade) ? formatarQtdCx(item.total, item.qt_por_cx, item.unidade) : '';
  }

  function handleExportar() {
    exportarCsv('estoque-total-wms.csv', [
      ['Código', 'Produto', 'Unidade', 'Total WMS', 'Em caixas', 'Posições'],
      ...itensFiltrados.map((item) => [
        item.codigo,
        item.nome,
        item.unidade || 'UN',
        item.total,
        emCaixas(item),
        item.posicoes,
      ]),
    ]);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 border-b-2 border-steel-600/25 pb-4">
        <div>
          <h1 className="page-title">Estoque Total</h1>
          <p className="mt-1 text-sm text-ink-600">
            Total de cada produto no WMS (soma de todas as posições), para conferir com o Winthor.
          </p>
        </div>
        {!carregando && itens.length > 0 && (
          <button type="button" onClick={handleExportar} className="btn-secondary shrink-0">
            Exportar CSV
          </button>
        )}
      </div>

      {carregando && <p className="text-sm text-steel-400">Carregando...</p>}
      {erro && <p className="text-sm text-signal-red600">{erro}</p>}

      {!carregando && !erro && itens.length === 0 && (
        <p className="text-sm text-ink-600">Nenhum produto posicionado no WMS ainda.</p>
      )}

      {!carregando && itens.length > 0 && (
        <>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto por nome ou código..."
            className="input w-full max-w-md"
          />

          <div className="panel max-w-5xl overflow-x-auto">
            <table className="table-plate">
              <colgroup>
                <col />
                <col className="w-40" />
                <col className="w-44" />
                <col className="w-24" />
              </colgroup>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Total WMS</th>
                  <th>Em caixas</th>
                  <th>Posições</th>
                </tr>
              </thead>
              <tbody>
                {itensFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-ink-600">
                      Nenhum produto encontrado para "{busca}".
                    </td>
                  </tr>
                )}
                {itensFiltrados.map((item) => {
                  const caixas = emCaixas(item);
                  return (
                    <tr key={item.produto_id}>
                      <td title={`${item.nome} ${item.codigo}`}>
                        <span className="font-medium text-ink-900">{item.nome}</span>{' '}
                        <span className="data-code text-steel-400">{item.codigo}</span>
                      </td>
                      <td className="data-code whitespace-nowrap text-ink-900">
                        {item.total} {item.unidade || 'UN'}
                      </td>
                      <td className="data-code whitespace-nowrap">
                        {caixas || <span className="text-steel-400">-</span>}
                      </td>
                      <td className="data-code">{item.posicoes}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
