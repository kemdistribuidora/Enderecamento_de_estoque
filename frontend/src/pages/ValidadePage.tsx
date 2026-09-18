import { useEffect, useState } from 'react';
import { PosicaoAVencer, buscarPosicoesAVencer } from '../api/client';
import { ROTULO_STATUS_VALIDADE } from '../utils/statusValidade';
import { formatarQtdCx } from '../utils/quantidade';
import PainelSeparacao from '../components/PainelSeparacao';

const TAG_STATUS_VALIDADE: Record<PosicaoAVencer['status_validade'], string> = {
  emergencia: 'tag-red',
  proximo: 'tag-amber',
  normal: 'tag-neutral',
};

export default function ValidadePage() {
  const [posicoes, setPosicoes] = useState<PosicaoAVencer[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [separando, setSeparando] = useState<PosicaoAVencer | null>(null);

  function carregar() {
    return buscarPosicoesAVencer()
      .then(setPosicoes)
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
  }, []);

  return (
    <div className="space-y-4">
      <div className="border-b-2 border-steel-600/25 pb-4">
        <h1 className="page-title">Controle de validade</h1>
        <p className="mt-1 text-sm text-ink-600">Posições vencidas ou próximas do vencimento, mais urgente primeiro.</p>
      </div>

      {separando && (
        <PainelSeparacao
          produtoId={separando.produto_id}
          produtoNome={separando.produto_nome}
          produtoCodigo={separando.produto_codigo}
          enderecoId={separando.endereco_id}
          codigoEndereco={separando.endereco_codigo}
          setorId={separando.setor_id}
          quantidade={separando.quantidade}
          qtPorCx={separando.produto_qt_por_cx}
          validade={separando.validade}
          lote={separando.lote}
          onFechar={() => setSeparando(null)}
          onConcluido={() => {
            setSeparando(null);
            carregar();
          }}
        />
      )}

      {carregando && <p className="text-sm text-steel-400">Carregando...</p>}

      {!carregando && posicoes.length === 0 && (
        <p className="panel p-4 text-sm text-ink-600">
          Nenhuma posição vencida ou próxima do vencimento.
        </p>
      )}

      {posicoes.length > 0 && (
        <div className="panel max-w-6xl overflow-x-auto">
          <table className="table-plate">
            <colgroup>
              <col className="w-32" />
              <col />
              <col className="w-24" />
              <col className="w-28" />
              <col className="w-32" />
              <col className="w-32" />
              <col className="w-32" />
            </colgroup>
            <thead>
              <tr>
                <th>Status</th>
                <th>Produto</th>
                <th>Posição</th>
                <th>Lote</th>
                <th className="text-right">Quantidade</th>
                <th>Validade</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {posicoes.map((p) => (
                <tr key={p.endereco_id}>
                  <td>
                    <span className={TAG_STATUS_VALIDADE[p.status_validade]}>
                      {ROTULO_STATUS_VALIDADE[p.status_validade]}
                    </span>
                  </td>
                  <td title={`${p.produto_nome} — ${p.produto_codigo}`}>
                    <span className="font-medium text-ink-900">{p.produto_nome}</span>{' '}
                    <span className="data-code text-steel-400">— {p.produto_codigo}</span>
                  </td>
                  <td className="data-code whitespace-nowrap text-ink-600">{p.endereco_codigo}</td>
                  <td className="data-code whitespace-nowrap text-ink-600">{p.lote ?? '—'}</td>
                  <td className="data-code whitespace-nowrap text-right">{formatarQtdCx(p.quantidade, p.produto_qt_por_cx)}</td>
                  <td className="data-code whitespace-nowrap text-ink-600">{p.validade}</td>
                  <td className="text-right">
                    <button type="button" onClick={() => setSeparando(p)} className="btn-secondary">
                      Separar
                    </button>
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
