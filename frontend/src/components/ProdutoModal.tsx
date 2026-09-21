import { useState } from 'react';
import { EnderecoComStatus } from '../types';
import { atualizarPesoCaixa, baixarParcialEndereco, bloquearEndereco, desbloquearEndereco, moverPallet } from '../api/client';
import { ROTULO_STATUS_VALIDADE } from '../utils/statusValidade';
import { calcularPesoTotal, formatarQtdCx } from '../utils/quantidade';
import EtiquetaModal from './EtiquetaModal';
import ModalEscolherNoMapa from './ModalEscolherNoMapa';
import ModalConfirmacao from './ModalConfirmacao';

interface Props {
  endereco: EnderecoComStatus | null;
  onClose: () => void;
  onAtualizado?: () => void;
  // setor do mapa aberto: o seletor de destino do "Mover pallet" abre nele
  setorAtualId?: number | null;
}

export default function ProdutoModal({ endereco, onClose, onAtualizado, setorAtualId }: Props) {
  const [escolhendoDestino, setEscolhendoDestino] = useState(false);
  // destino ja clicado no mapa, aguardando o usuario confirmar no modal
  const [destinoPendente, setDestinoPendente] = useState<EnderecoComStatus | null>(null);
  const [movendo, setMovendo] = useState(false);
  const [confirmandoLiberacao, setConfirmandoLiberacao] = useState(false);
  const [retirando, setRetirando] = useState(false);
  const [qtdRetirar, setQtdRetirar] = useState('');
  const [erro, setErro] = useState('');
  const [etiquetaAberta, setEtiquetaAberta] = useState(false);
  const [formBloqueioAberto, setFormBloqueioAberto] = useState(false);
  const [motivoBloqueio, setMotivoBloqueio] = useState('');
  const [bloqueando, setBloqueando] = useState(false);
  const [pesoInput, setPesoInput] = useState('');
  const [salvandoPeso, setSalvandoPeso] = useState(false);
  // "endereco" e' snapshot do clique no mapa -- nao atualiza com o reload, entao guarda o peso salvo aqui
  const [pesoSalvo, setPesoSalvo] = useState<{ produtoId: number; peso: number } | null>(null);

  if (!endereco) return null;

  const pesoCaixa =
    endereco.produto && pesoSalvo?.produtoId === endereco.produto.id ? pesoSalvo.peso : endereco.produto?.peso_caixa ?? null;

  async function handleSalvarPeso() {
    if (!endereco || !endereco.produto) return;
    const peso = Number(pesoInput.replace(',', '.'));
    if (!peso || peso <= 0) {
      setErro('Informe um peso de caixa válido.');
      return;
    }
    setSalvandoPeso(true);
    setErro('');
    try {
      await atualizarPesoCaixa(endereco.produto.id, peso);
      setPesoSalvo({ produtoId: endereco.produto.id, peso });
      setPesoInput('');
      onAtualizado?.();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao salvar peso da caixa.');
    } finally {
      setSalvandoPeso(false);
    }
  }

  function handleRetirarParcial() {
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
    setErro('');
    if (qtd === endereco.produto.quantidade) {
      setConfirmandoLiberacao(true);
      return;
    }
    executarRetirada(qtd);
  }

  async function executarRetirada(qtd: number) {
    if (!endereco) return;
    setRetirando(true);
    setErro('');
    try {
      await baixarParcialEndereco(endereco.id, qtd);
      onAtualizado?.();
      onClose();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao retirar quantidade.');
    } finally {
      setConfirmandoLiberacao(false);
      setRetirando(false);
    }
  }

  async function executarMover() {
    if (!endereco || !destinoPendente) return;
    setMovendo(true);
    setErro('');
    try {
      await moverPallet(endereco.id, destinoPendente.id);
      onAtualizado?.();
      onClose();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao mover pallet.');
    } finally {
      // este componente fica montado entre aberturas (retorna null sem endereco), entao
      // limpa os modais empilhados em qualquer desfecho, senao reabririam no proximo pallet
      setDestinoPendente(null);
      setEscolhendoDestino(false);
      setMovendo(false);
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
        className="w-full max-w-sm rounded-soft border border-steel-600 bg-white p-5 shadow-lg shadow-steel-900/20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-steel-900">
            Posição <span className="data-code">{endereco.codigo}</span>
          </h2>
          <button onClick={onClose} className="text-steel-400 hover:text-steel-900">
            ✕
          </button>
        </div>

        {endereco.bloqueado && (
          <div className="mb-3 border-l-4 border-signal-red600 bg-signal-red100 px-3 py-2 text-sm text-ink-900">
            <span className="font-semibold text-signal-red600">⚠ Posição com problema:</span> {endereco.bloqueio_motivo}
          </div>
        )}

        {endereco.status === 'livre' || !endereco.produto ? (
          <p className="text-sm text-ink-600">Posição livre — sem produto armazenado.</p>
        ) : (
          <>
            <dl className="space-y-2 text-sm">
              <Row label="Produto" value={endereco.produto.nome} />
              <Row label="Código" value={endereco.produto.codigo} code />
              <Row label="Quantidade" value={formatarQtdCx(endereco.produto.quantidade, endereco.produto.qt_por_cx)} code />
              {!endereco.produto.qt_por_cx ? (
                <Row label="Peso do pallet" value="sem qtd/caixa (vem do Winthor)" code />
              ) : pesoCaixa == null ? (
                <div className="flex items-center justify-between gap-2 border-b border-steel-100 pb-1">
                  <dt className="shrink-0 text-ink-600">Peso da caixa (KG)</dt>
                  <dd className="flex gap-1">
                    <input
                      type="number"
                      step="0.001"
                      min={0}
                      value={pesoInput}
                      onChange={(e) => setPesoInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSalvarPeso()}
                      placeholder="ex: 12.5"
                      className="input w-24"
                    />
                    <button
                      type="button"
                      onClick={handleSalvarPeso}
                      disabled={salvandoPeso || !pesoInput}
                      className="btn-secondary disabled:opacity-50"
                    >
                      {salvandoPeso ? '...' : 'Salvar'}
                    </button>
                  </dd>
                </div>
              ) : (
                <Row
                  label="Peso do pallet"
                  value={`${calcularPesoTotal(endereco.produto.quantidade, endereco.produto.qt_por_cx, pesoCaixa)?.toFixed(2)} KG`}
                  code
                />
              )}
              <Row label="Validade do lote" value={endereco.produto.validade} />
              <Row label="Lote" value={endereco.produto.lote ?? '—'} code />
            </dl>

            {endereco.produto.status_validade !== 'normal' && (
              <p
                className={`mt-2 ${endereco.produto.status_validade === 'emergencia' ? 'tag-red' : 'tag-amber'}`}
              >
                {ROTULO_STATUS_VALIDADE[endereco.produto.status_validade]}
              </p>
            )}

            <button
              type="button"
              onClick={() => setEtiquetaAberta(true)}
              className="btn-secondary mt-4 w-full"
            >
              Imprimir etiqueta
            </button>

            <button
              type="button"
              onClick={() => setEscolhendoDestino(true)}
              className="btn-secondary mt-2 w-full"
            >
              Mover pallet para outra posição
            </button>

            <div className="panel mt-3 p-3">
              <label className="mb-1 block text-xs font-medium text-ink-600">
                Retirar quantidade em UN (máx. {endereco.produto.quantidade} ={' '}
                {formatarQtdCx(endereco.produto.quantidade, endereco.produto.qt_por_cx)})
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={endereco.produto.quantidade}
                  value={qtdRetirar}
                  onChange={(e) => setQtdRetirar(e.target.value)}
                  className="input"
                  placeholder="Qtd"
                />
                <button
                  type="button"
                  onClick={handleRetirarParcial}
                  disabled={retirando || !qtdRetirar}
                  className="shrink-0 rounded-tag border-2 border-signal-amber600 bg-white px-3 py-1.5 text-sm font-semibold uppercase tracking-wide text-signal-amber600 transition-colors hover:bg-signal-amber100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {retirando ? 'Retirando...' : 'Retirar'}
                </button>
              </div>
            </div>
          </>
        )}

        {erro && <p className="mt-2 text-sm text-signal-red600">{erro}</p>}

        <div className="mt-3 border-t-2 border-steel-600/25 pt-3">
          {endereco.bloqueado ? (
            <button
              type="button"
              onClick={handleDesbloquear}
              disabled={bloqueando}
              className="w-full rounded-tag border-2 border-signal-red600 bg-white px-3 py-1.5 text-sm font-semibold uppercase tracking-wide text-signal-red600 transition-colors hover:bg-signal-red100 disabled:cursor-not-allowed disabled:opacity-50"
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
                className="input"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleBloquear}
                  disabled={bloqueando || !motivoBloqueio.trim()}
                  className="flex-1 rounded-tag border-2 border-signal-red600 bg-white px-3 py-1.5 text-sm font-semibold uppercase tracking-wide text-signal-red600 transition-colors hover:bg-signal-red100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {bloqueando ? 'Bloqueando...' : 'Confirmar bloqueio'}
                </button>
                <button
                  type="button"
                  onClick={() => setFormBloqueioAberto(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setFormBloqueioAberto(true)}
              className="btn-secondary w-full"
            >
              Marcar posição com problema
            </button>
          )}
        </div>
      </div>

      {escolhendoDestino && (
        // wrapper barra o bubbling do clique no fundo do seletor, que senao fecharia este modal tambem
        <div onClick={(e) => e.stopPropagation()}>
          <ModalEscolherNoMapa
            onFechar={() => setEscolhendoDestino(false)}
            onEscolher={setDestinoPendente}
            setorSugeridoId={setorAtualId}
          />
        </div>
      )}

      {destinoPendente && endereco.produto && (
        <ModalConfirmacao
          titulo="Mover pallet"
          textoConfirmar="Confirmar movimentação"
          textoCarregando="Movendo..."
          carregando={movendo}
          onConfirmar={executarMover}
          onCancelar={() => setDestinoPendente(null)}
        >
          <p className="mb-3 text-ink-600">
            {endereco.produto.nome} <span className="data-code text-steel-400">({endereco.produto.codigo})</span>
          </p>
          <div className="flex items-center justify-center gap-3 border-y border-steel-100 py-3">
            <div className="text-center">
              <p className="text-xs uppercase tracking-wide text-ink-600">De</p>
              <p className="data-code text-lg font-bold text-steel-900">{endereco.codigo}</p>
            </div>
            <span className="text-xl text-steel-400">→</span>
            <div className="text-center">
              <p className="text-xs uppercase tracking-wide text-ink-600">Para</p>
              <p className="data-code text-lg font-bold text-steel-900">{destinoPendente.codigo}</p>
            </div>
          </div>
          <p className="mt-3 text-ink-600">
            Quantidade, validade e lote acompanham o pallet. A posição {endereco.codigo} fica livre.
          </p>
          {destinoPendente.bloqueado && (
            <div className="mt-3 border-l-4 border-signal-red600 bg-signal-red100 px-3 py-2 text-sm text-ink-900">
              <span className="font-semibold text-signal-red600">⚠ Destino com problema:</span> {destinoPendente.bloqueio_motivo}
            </div>
          )}
        </ModalConfirmacao>
      )}

      {confirmandoLiberacao && (
        <ModalConfirmacao
          titulo="Liberar posição"
          textoConfirmar="Retirar tudo e liberar"
          textoCarregando="Retirando..."
          carregando={retirando}
          onConfirmar={() => executarRetirada(Number(qtdRetirar))}
          onCancelar={() => setConfirmandoLiberacao(false)}
        >
          <p>
            Retirar a quantidade total vai liberar a posição <span className="data-code font-bold">{endereco.codigo}</span> inteira.
          </p>
        </ModalConfirmacao>
      )}

      {etiquetaAberta && endereco.produto && (
        <EtiquetaModal
          dados={{
            enderecoCodigo: endereco.codigo,
            produtoNome: endereco.produto.nome,
            produtoCodigo: endereco.produto.codigo,
            codigoBarras: endereco.produto.codigo_barras,
            pesoCaixa,
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

function Row({ label, value, code }: { label: string; value: string; code?: boolean }) {
  return (
    <div className="flex justify-between border-b border-steel-100 pb-1">
      <dt className="text-ink-600">{label}</dt>
      <dd className={`font-medium text-ink-900 ${code ? 'data-code' : ''}`}>{value}</dd>
    </div>
  );
}
