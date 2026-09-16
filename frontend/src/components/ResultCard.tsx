import { ProdutoComPosicoes } from '../types';
import { ROTULO_STATUS_VALIDADE } from '../utils/statusValidade';
import { formatarQtdCx } from '../utils/quantidade';

type Posicao = ProdutoComPosicoes['posicoes'][number];

interface Props {
  produto: ProdutoComPosicoes;
  onSeparar: (produto: ProdutoComPosicoes, posicao: Posicao) => void;
}

export default function ResultCard({ produto, onSeparar }: Props) {
  return (
    <div className="panel p-4">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-ink-900">{produto.nome}</h3>
        </div>
        <span className="tag-neutral">{produto.codigo}</span>
      </div>

      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-600">
        <span>
          <strong className="font-medium text-ink-900">Cód. barras:</strong>{' '}
          <span className="data-code">{produto.codigo_barras}</span>
        </span>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-ink-600">
          Posições ({produto.posicoes.length}) · ordenado por validade, mais próxima primeiro
        </p>
        {produto.posicoes.length === 0 ? (
          <p className="text-xs text-steel-400">Sem estoque em nenhuma posição.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {produto.posicoes.map((p, idx) => (
              <button
                key={p.endereco_id}
                type="button"
                onClick={() => onSeparar(produto, p)}
                title={
                  p.status_validade !== 'normal'
                    ? ROTULO_STATUS_VALIDADE[p.status_validade]
                    : 'Ver no mapa e separar'
                }
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-tag border px-2 py-1 text-xs font-semibold hover:opacity-80 ${
                  idx === 0
                    ? 'border-signal-amber600/30 bg-signal-amber100 text-signal-amber600'
                    : 'border-steel-600/25 bg-concrete-200 text-steel-700'
                }`}
              >
                <span className="data-code">
                  {p.codigo_endereco} · {formatarQtdCx(p.quantidade, produto.qt_por_cx)} · vence {p.validade}
                </span>
                {p.status_validade !== 'normal' && (
                  <span className={p.status_validade === 'emergencia' ? 'tag-red' : 'tag-amber'}>
                    {p.status_validade === 'emergencia' ? 'emergência' : 'em breve'}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
