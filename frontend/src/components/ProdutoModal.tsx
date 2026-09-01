import { useState } from 'react';
import { EnderecoComStatus } from '../types';
import { baixarParcialEndereco } from '../api/client';
import { BADGE_STATUS_VALIDADE, ROTULO_STATUS_VALIDADE } from '../utils/statusValidade';
import EtiquetaModal from './EtiquetaModal';

interface Props {
  endereco: EnderecoComStatus | null;
  onClose: () => void;
  onLiberado?: () => void;
}

export default function ProdutoModal({ endereco, onClose, onLiberado }: Props) {
  const [retirando, setRetirando] = useState(false);
  const [qtdRetirar, setQtdRetirar] = useState('');
  const [erro, setErro] = useState('');
  const [etiquetaAberta, setEtiquetaAberta] = useState(false);

  if (!endereco) return null;

  async function handleRetirarParcial() {
    if (!endereco || !endereco.produto) return;
    const qtd = Number(qtdRetirar);
    if (!qtd || qtd <= 0) {
      setErro('Informe uma quantidade válida.');
      return;
    }
    if (qtd > endereco.produto.quantidade) {
      setErro(`Quantidade maior que a disponível na posição (${endereco.produto.quantidade}).`);
      return;
    }
    if (qtd === endereco.produto.quantidade && !confirm(`Isso vai liberar a posição ${endereco.codigo} inteira. Confirma?`)) {
      return;
    }
    setRetirando(true);
    setErro('');
    try {
      await baixarParcialEndereco(endereco.id, qtd);
      onLiberado?.();
      onClose();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao retirar quantidade.');
    } finally {
      setRetirando(false);
    }
  }

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
          <>
            <dl className="space-y-2 text-sm">
              <Row label="Produto" value={endereco.produto.nome} />
              <Row label="Código" value={endereco.produto.codigo} />
              <Row label="Quantidade" value={String(endereco.produto.quantidade)} />
              <Row label="Validade do lote" value={endereco.produto.validade} />
              <Row label="Lote" value={endereco.produto.lote ?? '—'} />
            </dl>

            {endereco.produto.status_validade !== 'normal' && (
              <p
                className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                  BADGE_STATUS_VALIDADE[endereco.produto.status_validade]
                }`}
              >
                {ROTULO_STATUS_VALIDADE[endereco.produto.status_validade]}
              </p>
            )}

            {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}

            <button
              type="button"
              onClick={() => setEtiquetaAberta(true)}
              className="mt-4 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Imprimir etiqueta
            </button>

            <div className="mt-3 rounded-md border border-slate-200 p-3">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Retirar quantidade (máx. {endereco.produto.quantidade}, digite tudo pra liberar a posição)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={endereco.produto.quantidade}
                  value={qtdRetirar}
                  onChange={(e) => setQtdRetirar(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  placeholder="Qtd"
                />
                <button
                  type="button"
                  onClick={handleRetirarParcial}
                  disabled={retirando || !qtdRetirar}
                  className="shrink-0 rounded-md border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                >
                  {retirando ? 'Retirando...' : 'Retirar'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {etiquetaAberta && endereco.produto && (
        <EtiquetaModal
          dados={{
            enderecoCodigo: endereco.codigo,
            produtoNome: endereco.produto.nome,
            produtoCodigo: endereco.produto.codigo,
            codigoBarras: endereco.produto.codigo_barras,
            pesoCaixa: endereco.produto.peso_caixa,
            quantidade: endereco.produto.quantidade,
            validade: endereco.produto.validade,
            lote: endereco.produto.lote,
            criadoEm: endereco.produto.criado_em,
          }}
          onClose={() => setEtiquetaAberta(false)}
        />
      )}
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
