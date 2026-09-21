import { useEffect, useState } from 'react';
import { Movimentacao, buscarMovimentacoes, desfazerMovimentacao } from '../api/client';
import { exportarCsv } from '../utils/exportCsv';

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

  const rotulosStatus: Record<Movimentacao['status'], string> = {
    confirmada: 'Confirmada',
    standby: 'Standby',
    revertida: 'Revertida',
  };

  function rotuloTipo(m: Movimentacao): string {
    if (m.transferencia_endereco_codigo) return m.tipo === 'entrada' ? 'Transferência (entrada)' : 'Transferência (saída)';
    return m.tipo === 'entrada' ? 'Entrada' : 'Saída';
  }

  // "A01-1-2 → B02-1-1" nas duas pontas da transferencia, pra ler de relance de onde pra onde
  function rotuloPosicao(m: Movimentacao): string {
    if (!m.transferencia_endereco_codigo) return m.endereco_codigo;
    return m.tipo === 'saida'
      ? `${m.endereco_codigo} → ${m.transferencia_endereco_codigo}`
      : `${m.transferencia_endereco_codigo} → ${m.endereco_codigo}`;
  }

  function handleExportar() {
    exportarCsv('historico-movimentacao.csv', [
      ['Quando', 'Tipo', 'Produto', 'Código', 'Posição', 'Lote', 'Quantidade', 'Status'],
      ...movimentacoes.map((m) => [
        new Date(m.criado_em).toLocaleString('pt-BR'),
        rotuloTipo(m),
        m.produto_nome,
        m.produto_codigo,
        rotuloPosicao(m),
        m.lote ?? '',
        m.quantidade,
        rotulosStatus[m.status],
      ]),
    ]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 border-b-2 border-steel-600/25 pb-4">
        <div>
          <h1 className="page-title">Histórico de movimentação</h1>
          <p className="mt-1 text-sm text-ink-600">Saída recente fica em standby e pode ser desfeita.</p>
        </div>
        {movimentacoes.length > 0 && (
          <button type="button" onClick={handleExportar} className="btn-secondary shrink-0">
            Exportar CSV
          </button>
        )}
      </div>

      {erro && <p className="text-sm text-signal-red600">{erro}</p>}
      {carregando && <p className="text-sm text-steel-400">Carregando...</p>}

      {!carregando && movimentacoes.length === 0 && (
        <p className="panel p-4 text-sm text-ink-600">Nenhuma movimentação registrada ainda.</p>
      )}

      {movimentacoes.length > 0 && (
        <div className="panel max-w-6xl overflow-x-auto">
          <table className="table-plate">
            <colgroup>
              <col className="w-52" />
              <col className="w-44" />
              <col />
              <col className="w-52" />
              <col className="w-28" />
              <col className="w-32" />
              <col className="w-32" />
              <col className="w-32" />
            </colgroup>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Tipo</th>
                <th>Produto</th>
                <th>Posição</th>
                <th>Lote</th>
                <th className="text-right">Quantidade</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {movimentacoes.map((m) => (
                <tr key={m.id}>
                  <td className="data-code whitespace-nowrap text-ink-600">
                    {new Date(m.criado_em).toLocaleString('pt-BR')}
                  </td>
                  <td>
                    <span
                      className={
                        m.transferencia_endereco_codigo
                          ? 'text-steel-700'
                          : m.tipo === 'entrada'
                            ? 'text-signal-green600'
                            : 'text-ink-900'
                      }
                    >
                      {rotuloTipo(m)}
                    </span>
                  </td>
                  <td title={`${m.produto_nome} — ${m.produto_codigo}`}>
                    <span className="font-medium text-ink-900">{m.produto_nome}</span>{' '}
                    <span className="data-code text-steel-400">— {m.produto_codigo}</span>
                  </td>
                  <td className="data-code whitespace-nowrap text-ink-600">{rotuloPosicao(m)}</td>
                  <td className="data-code whitespace-nowrap text-ink-600">{m.lote ?? '—'}</td>
                  <td className="data-code whitespace-nowrap text-right">{m.quantidade}</td>
                  <td>
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="text-right">
                    {m.tipo === 'saida' && m.status === 'standby' && (
                      <button
                        type="button"
                        onClick={() => handleDesfazer(m.id)}
                        disabled={desfazendoId === m.id}
                        className="btn-secondary"
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
    confirmada: 'tag-neutral',
    standby: 'tag-amber',
    revertida: 'tag-red',
  };
  const rotulos: Record<Movimentacao['status'], string> = {
    confirmada: 'Confirmada',
    standby: 'Standby',
    revertida: 'Revertida',
  };
  return <span className={estilos[status]}>{rotulos[status]}</span>;
}
