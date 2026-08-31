import { useState } from 'react';
import { EnderecoComStatus } from '../types';
import { liberarEndereco } from '../api/client';
import { BADGE_STATUS_VALIDADE, ROTULO_STATUS_VALIDADE } from '../utils/statusValidade';
import EtiquetaModal from './EtiquetaModal';

interface Props {
  endereco: EnderecoComStatus | null;
  onClose: () => void;
  onLiberado?: () => void;
}

export default function ProdutoModal({ endereco, onClose, onLiberado }: Props) {
  const [liberando, setLiberando] = useState(false);
  const [erro, setErro] = useState('');
  const [etiquetaAberta, setEtiquetaAberta] = useState(false);

  if (!endereco) return null;

  async function handleLiberar() {
    if (!endereco) return;
    if (!confirm(`Liberar posição ${endereco.codigo}? Dá pra desfazer depois na tela Histórico, enquanto ninguém ocupar essa posição de novo.`)) {
      return;
    }
    setLiberando(true);
    setErro('');
    try {
      await liberarEndereco(endereco.id);
      onLiberado?.();
      onClose();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao liberar posição.');
    } finally {
      setLiberando(false);
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

            <button
              type="button"
              onClick={handleLiberar}
              disabled={liberando}
              className="mt-2 w-full rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {liberando ? 'Liberando...' : 'Liberar posição'}
            </button>
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
