import { useState } from 'react';
import { EnderecoComStatus } from '../types';
import { baixarParcialEndereco, bloquearEndereco, desbloquearEndereco } from '../api/client';
import { BADGE_STATUS_VALIDADE, ROTULO_STATUS_VALIDADE } from '../utils/statusValidade';
import { calcularPesoTotal, formatarQtdCx } from '../utils/quantidade';
import EtiquetaModal from './EtiquetaModal';

interface Props {
  endereco: EnderecoComStatus | null;
  onClose: () => void;
  onAtualizado?: () => void;
}

export default function ProdutoModal({ endereco, onClose, onAtualizado }: Props) {
  const [retirando, setRetirando] = useState(false);
  const [qtdRetirar, setQtdRetirar] = useState('');
  const [erro, setErro] = useState('');
  const [etiquetaAberta, setEtiquetaAberta] = useState(false);
  const [formBloqueioAberto, setFormBloqueioAberto] = useState(false);
  const [motivoBloqueio, setMotivoBloqueio] = useState('');
  const [bloqueando, setBloqueando] = useState(false);

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
      onAtualizado?.();
      onClose();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao retirar quantidade.');
    } finally {
      setRetirando(false);
    }
  }

  async function handleBloquear() {
    if (!endereco || !motivoBloqueio.trim()) return;
    setBloqueando(true);
    setErro('');
    try {
      await bloquearEndereco(endereco.id, motivoBloqueio.trim());
      onAtualizado?.();
      onClose();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao bloquear posição.');
    } finally {
      setBloqueando(false);
    }
  }

  async function handleDesbloquear() {
    if (!endereco) return;
    setBloqueando(true);
    setErro('');
    try {
      await desbloquearEndereco(endereco.id);
      onAtualizado?.();
      onClose();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao desbloquear posição.');
    } finally {
      setBloqueando(false);
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

        {endereco.bloqueado && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
            <span className="font-medium">⚠ Posição com problema:</span> {endereco.bloqueio_motivo}
          </div>
        )}

        {endereco.status === 'livre' || !endereco.produto ? (
          <p className="text-sm text-slate-500">Posição livre — sem produto armazenado.</p>
        ) : (
          <>
            <dl className="space-y-2 text-sm">
              <Row label="Produto" value={endereco.produto.nome} />
              <Row label="Código" value={endereco.produto.codigo} />
              <Row label="Quantidade" value={formatarQtdCx(endereco.produto.quantidade, endereco.produto.qt_por_cx)} />
              <Row
                label="Peso do pallet"
                value={(() => {
                  const peso = calcularPesoTotal(endereco.produto.quantidade, endereco.produto.qt_por_cx, endereco.produto.peso_caixa);
                  return peso != null ? `${peso.toFixed(2)} KG` : 'cadastrar peso e qtd/caixa';
                })()}
              />
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

            <button
              type="button"
              onClick={() => setEtiquetaAberta(true)}
              className="mt-4 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Imprimir etiqueta
            </button>

            <div className="mt-3 rounded-md border border-slate-200 p-3">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Retirar quantidade em UN (máx. {endereco.produto.quantidade} ={' '}
                {formatarQtdCx(endereco.produto.quantidade, endereco.produto.qt_por_cx)}, digite tudo pra liberar a posição)
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

        {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}

        <div className="mt-3 border-t border-slate-100 pt-3">
          {endereco.bloqueado ? (
            <button
              type="button"
              onClick={handleDesbloquear}
              disabled={bloqueando}
              className="w-full rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {bloqueando ? 'Desbloqueando...' : 'Desbloquear posição'}
            </button>
          ) : formBloqueioAberto ? (
            <div className="space-y-2">
              <input
                type="text"
                value={motivoBloqueio}
                onChange={(e) => setMotivoBloqueio(e.target.value)}
                placeholder="Motivo (ex: avaria, aguardando qualidade...)"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleBloquear}
                  disabled={bloqueando || !motivoBloqueio.trim()}
                  className="flex-1 rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  {bloqueando ? 'Bloqueando...' : 'Confirmar bloqueio'}
                </button>
                <button
                  type="button"
                  onClick={() => setFormBloqueioAberto(false)}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setFormBloqueioAberto(true)}
              className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Marcar posição com problema
            </button>
          )}
        </div>
      </div>

      {etiquetaAberta && endereco.produto && (
        <EtiquetaModal
          dados={{
            enderecoCodigo: endereco.codigo,
            produtoNome: endereco.produto.nome,
            produtoCodigo: endereco.produto.codigo,
            codigoBarras: endereco.produto.codigo_barras,
            pesoCaixa: endereco.produto.peso_caixa,
            qtPorCx: endereco.produto.qt_por_cx,
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
