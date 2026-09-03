import { useEffect, useState } from 'react';
import { Movimentacao, buscarMovimentacoes, desfazerMovimentacao } from '../api/client';

export default function HistoricoPage() {
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [desfazendoId, setDesfazendoId] = useState<number | null>(null);
  const [erro, setErro] = useState('');

  function carregar() {
    setCarregando(true);
    buscarMovimentacoes()
      .then(setMovimentacoes)
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
  }, []);

  async function handleDesfazer(id: number) {
    setDesfazendoId(id);
    setErro('');
    try {
      await desfazerMovimentacao(id);
      carregar();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao desfazer.');
    } finally {
      setDesfazendoId(null);
    }
  }

  return (
    <div className="max-w-6xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">Histórico de movimentação</h1>
        <p className="mt-1 text-sm text-slate-500">Saída recente fica em standby e pode ser desfeita.</p>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {carregando && <p className="text-sm text-slate-400">Carregando...</p>}

      {!carregando && movimentacoes.length === 0 && (
        <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-500">Nenhuma movimentação registrada ainda.</p>
      )}

      {movimentacoes.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Quando</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Produto</th>
                <th className="px-4 py-2">Posição</th>
                <th className="px-4 py-2">Lote</th>
                <th className="px-4 py-2 text-right">Quantidade</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movimentacoes.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-500">
                    {new Date(m.criado_em).toLocaleString('pt-BR')}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <span className={m.tipo === 'entrada' ? 'text-green-700' : 'text-slate-700'}>
                      {m.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <span className="font-medium text-slate-800">{m.produto_nome}</span>{' '}
                    <span className="text-slate-400">— {m.produto_codigo}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-600">{m.endereco_codigo}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-600">{m.lote ?? '—'}</td>
                  <td className="px-4 py-2 text-right">{m.quantidade}</td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    {m.tipo === 'saida' && m.status === 'standby' && (
                      <button
                        type="button"
                        onClick={() => handleDesfazer(m.id)}
                        disabled={desfazendoId === m.id}
                        className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {desfazendoId === m.id ? 'Desfazendo...' : 'Desfazer'}
                      </button>
                    )}
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

function StatusBadge({ status }: { status: Movimentacao['status'] }) {
  const estilos: Record<Movimentacao['status'], string> = {
    confirmada: 'bg-slate-100 text-slate-600',
    standby: 'bg-amber-100 text-amber-700',
    revertida: 'bg-red-100 text-red-600',
  };
  const rotulos: Record<Movimentacao['status'], string> = {
    confirmada: 'Confirmada',
    standby: 'Standby',
    revertida: 'Revertida',
  };
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${estilos[status]}`}>
      {rotulos[status]}
    </span>
  );
}
