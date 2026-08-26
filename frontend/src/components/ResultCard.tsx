import { ProdutoComPosicoes } from '../types';

export default function ResultCard({ produto }: { produto: ProdutoComPosicoes }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-slate-800">{produto.nome}</h3>
          <p className="text-xs text-slate-500">{produto.descricao}</p>
        </div>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{produto.codigo}</span>
      </div>

      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
        <span>
          <strong className="font-medium text-slate-700">Cód. barras:</strong> {produto.codigo_barras}
        </span>
        <span>
          <strong className="font-medium text-slate-700">Validade:</strong> {produto.validade}
        </span>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">Posições ({produto.posicoes.length})</p>
        {produto.posicoes.length === 0 ? (
          <p className="text-xs text-slate-400">Sem estoque em nenhuma posição.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {produto.posicoes.map((p) => (
              <span
                key={p.endereco_id}
                className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800"
              >
                {p.codigo_endereco} · {p.quantidade}un
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
