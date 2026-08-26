import { EnderecoComStatus } from '../types';

interface Props {
  endereco: EnderecoComStatus | null;
  onClose: () => void;
}

export default function ProdutoModal({ endereco, onClose }: Props) {
  if (!endereco) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Posição {endereco.codigo}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        {endereco.status === 'livre' || !endereco.produto ? (
          <p className="text-sm text-slate-500">Posição livre — sem produto armazenado.</p>
        ) : (
          <dl className="space-y-2 text-sm">
            <Row label="Produto" value={endereco.produto.nome} />
            <Row label="Código" value={endereco.produto.codigo} />
            <Row label="Quantidade" value={String(endereco.produto.quantidade)} />
          </dl>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-slate-100 pb-1">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}
