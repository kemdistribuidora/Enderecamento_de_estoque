import { useEffect, useState } from 'react';
import { EnderecoComStatus, StatusValidade } from '../types';
import {
  adicionarNaPosicao,
  atualizarCorMarcador,
  atualizarPesoCaixa,
  baixarParcialEndereco,
  bloquearEndereco,
  buscarPendenciasPosicionamento,
  corrigirValidade,
  desbloquearEndereco,
  moverPallet,
} from '../api/client';
import { ROTULO_STATUS_VALIDADE } from '../utils/statusValidade';
import { calcularPesoTotal, formatarQtdCx } from '../utils/quantidade';
import EtiquetaModal from './EtiquetaModal';
import ModalEscolherNoMapa from './ModalEscolherNoMapa';
import ModalConfirmacao from './ModalConfirmacao';
import { DATA_MAX, DATA_MIN, formatarData, isDataIsoValida } from '../utils/data';
import { CORES_MARCADOR } from '../utils/corMarcador';

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
  const [adicionando, setAdicionando] = useState(false);
  const [qtdAdicionar, setQtdAdicionar] = useState('');
  // saldo a posicionar do produto (Winthor - ja alocado); null = carregando
  const [pendente, setPendente] = useState<number | null>(null);
  const [erro, setErro] = useState('');
  const [etiquetaAberta, setEtiquetaAberta] = useState(false);
  const [formBloqueioAberto, setFormBloqueioAberto] = useState(false);
  const [motivoBloqueio, setMotivoBloqueio] = useState('');
  const [bloqueando, setBloqueando] = useState(false);
  const [pesoInput, setPesoInput] = useState('');
  const [salvandoPeso, setSalvandoPeso] = useState(false);
  // "endereco" e' snapshot do clique no mapa -- nao atualiza com o reload, entao guarda o peso salvo aqui
  const [pesoSalvo, setPesoSalvo] = useState<{ produtoId: number; peso: number } | null>(null);
  // mesmo motivo do pesoSalvo: guarda o marcador escolhido pra refletir na hora
  const [corSalva, setCorSalva] = useState<{ produtoId: number; cor: string | null } | null>(null);
  const [salvandoCor, setSalvandoCor] = useState(false);
  // correcao de validade digitada errada: clicar na data abre o input (discreto, sem botao fixo)
  const [editandoValidade, setEditandoValidade] = useState(false);
  const [validadeInput, setValidadeInput] = useState('');
  const [confirmandoValidade, setConfirmandoValidade] = useState(false);
  const [salvandoValidade, setSalvandoValidade] = useState(false);
  // mesmo motivo do pesoSalvo: "endereco" e' snapshot, guarda a validade corrigida aqui
  const [validadeSalva, setValidadeSalva] = useState<{
    enderecoId: number;
    validade: string;
    status: StatusValidade;
  } | null>(null);

  // modal fica montado entre aberturas: nao deixa a edicao aberta vazar pro proximo pallet
  useEffect(() => {
    setEditandoValidade(false);
    setConfirmandoValidade(false);
    setQtdAdicionar('');
  }, [endereco?.id]);

  // "Adicionar" so pode somar ate o saldo a posicionar (mesma lista da tela Posicionar estoque)
  const produtoIdAtual = endereco?.produto?.id ?? null;
  useEffect(() => {
    if (produtoIdAtual == null) return;
    let ativo = true;
    setPendente(null);
    buscarPendenciasPosicionamento()
      .then((lista) => {
        if (ativo) setPendente(lista.find((p) => p.produto_id === produtoIdAtual)?.pendente ?? 0);
      })
      .catch(() => {
        if (ativo) setPendente(0);
      });
    return () => {
      ativo = false;
    };
  }, [endereco?.id, produtoIdAtual]);

  if (!endereco) return null;

  const pesoCaixa =
    endereco.produto && pesoSalvo?.produtoId === endereco.produto.id ? pesoSalvo.peso : endereco.produto?.peso_caixa ?? null;
  const corMarcadorAtual =
    endereco.produto && corSalva?.produtoId === endereco.produto.id ? corSalva.cor : endereco.produto?.cor_marcador ?? null;
  const correcaoValida = validadeSalva?.enderecoId === endereco.id ? validadeSalva : null;
  const validadeAtual = correcaoValida?.validade ?? endereco.produto?.validade ?? '';
  const statusValidadeAtual = correcaoValida?.status ?? endereco.produto?.status_validade ?? 'normal';

  function abrirEdicaoValidade() {
    setValidadeInput(validadeAtual);
    setErro('');
    setEditandoValidade(true);
  }

  function fecharEdicaoValidade() {
    setEditandoValidade(false);
    setConfirmandoValidade(false);
  }

  function handleRevisarValidade() {
    if (!isDataIsoValida(validadeInput)) {
      setErro('Validade inválida. Confira dia, mês e ano (4 dígitos).');
      return;
    }
    setErro('');
    if (validadeInput === validadeAtual) {
      fecharEdicaoValidade();
      return;
    }
    setConfirmandoValidade(true);
  }

  async function executarCorrecaoValidade() {
    if (!endereco) return;
    setSalvandoValidade(true);
    setErro('');
    try {
      const r = await corrigirValidade(endereco.id, validadeInput);
      setValidadeSalva({ enderecoId: endereco.id, validade: r.validade, status: r.status_validade });
      fecharEdicaoValidade();
      onAtualizado?.();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao corrigir validade.');
      setConfirmandoValidade(false);
    } finally {
      setSalvandoValidade(false);
    }
  }

  // clicar na cor ja marcada tira o marcador
  async function handleEscolherCor(chave: string) {
    if (!endereco || !endereco.produto) return;
    const nova = corMarcadorAtual === chave ? null : chave;
    setSalvandoCor(true);
    setErro('');
    try {
      await atualizarCorMarcador(endereco.produto.id, nova);
      setCorSalva({ produtoId: endereco.produto.id, cor: nova });
      onAtualizado?.();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao salvar marcador.');
    } finally {
      setSalvandoCor(false);
    }
  }

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

  async function handleAdicionar() {
    if (!endereco || !endereco.produto) return;
    const qtd = Number(qtdAdicionar.replace(',', '.'));
    if (!qtd || qtd <= 0) {
      setErro('Informe uma quantidade válida.');
      return;
    }
    if (pendente != null && qtd > pendente) {
      setErro(
        pendente === 0
          ? 'Produto sem estoque a posicionar.'
          : `Quantidade maior que o estoque a posicionar (${pendente}).`
      );
      return;
    }
    setAdicionando(true);
    setErro('');
    try {
      await adicionarNaPosicao(endereco.id, qtd);
      onAtualizado?.();
      onClose();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao adicionar quantidade.');
    } finally {
      setAdicionando(false);
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
        className="max-h-[calc(100vh-2rem)] w-full max-w-sm overflow-y-auto rounded-soft border border-steel-600 bg-white p-5 shadow-lg shadow-steel-900/20"
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
          <p className="text-sm text-ink-600">Posição livre</p>
        ) : (
          <>
            <dl className="text-sm">
              <Row label="Produto" value={endereco.produto.nome} />
              <Row label="Código" value={endereco.produto.codigo} code />
              <Row label="Quantidade" value={formatarQtdCx(endereco.produto.quantidade, endereco.produto.qt_por_cx, endereco.produto.unidade)} code />
              {!endereco.produto.qt_por_cx ? (
                <Row label="Peso do pallet" value="sem qtd/caixa (vem do Winthor)" code />
              ) : pesoCaixa == null ? (
                <div className={LINHA}>
                  <dt className="shrink-0 text-ink-600">Peso da caixa (KG)</dt>
                  <dd className="flex gap-1">
                    <input
                      type="number"
                      step="any"
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
              <div className={LINHA}>
                <dt className="shrink-0 text-ink-600">Validade da posição</dt>
                {editandoValidade ? (
                  <dd className="flex gap-1">
                    <input
                      type="date"
                      autoFocus
                      min={DATA_MIN}
                      max={DATA_MAX}
                      value={validadeInput}
                      onChange={(e) => setValidadeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRevisarValidade();
                        if (e.key === 'Escape') {
                          e.stopPropagation();
                          fecharEdicaoValidade();
                        }
                      }}
                      className="input w-36"
                    />
                    <button type="button" onClick={handleRevisarValidade} className="btn-secondary">
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={fecharEdicaoValidade}
                      title="Cancelar"
                      className="px-1 text-steel-400 hover:text-ink-900"
                    >
                      ✕
                    </button>
                  </dd>
                ) : (
                  <dd>
                    <button
                      type="button"
                      onClick={abrirEdicaoValidade}
                      title="Clique para corrigir a validade"
                      className="group font-medium text-ink-900 decoration-dotted underline-offset-4 hover:underline"
                    >
                      <span aria-hidden="true" className="mr-1 text-steel-400 opacity-0 group-hover:opacity-100">✎</span>
                      {formatarData(validadeAtual)}
                    </button>
                  </dd>
                )}
              </div>
              <Row label="Lote" value={endereco.produto.lote ?? '—'} code />
              <div className={LINHA}>
                <dt className="shrink-0 text-ink-600">Marcador</dt>
                <dd className="flex gap-1.5">
                  {CORES_MARCADOR.map((c) => {
                    const ativa = corMarcadorAtual === c.chave;
                    return (
                      <button
                        key={c.chave}
                        type="button"
                        onClick={() => handleEscolherCor(c.chave)}
                        disabled={salvandoCor}
                        title={ativa ? `${c.rotulo} (clique para tirar)` : c.rotulo}
                        aria-label={c.rotulo}
                        aria-pressed={ativa}
                        className={`h-5 w-5 rounded-full transition-transform hover:scale-110 disabled:opacity-50 ${
                          ativa ? 'ring-2 ring-steel-900 ring-offset-2' : ''
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    );
                  })}
                </dd>
              </div>
            </dl>

            {statusValidadeAtual !== 'normal' && (
              <p className={`mt-3 ${statusValidadeAtual === 'emergencia' ? 'tag-red' : 'tag-amber'}`}>
                {ROTULO_STATUS_VALIDADE[statusValidadeAtual]}
              </p>
            )}

            <div className="mt-4 flex flex-col gap-2">
              <button type="button" onClick={() => setEtiquetaAberta(true)} className="btn-secondary w-full">
                Imprimir etiqueta
              </button>
              <button type="button" onClick={() => setEscolhendoDestino(true)} className="btn-secondary w-full">
                Mover pallet para outra posição
              </button>
            </div>

            <div className="panel mt-4 divide-y divide-steel-100">
              <div className="p-3">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-900">
                    Retirar <span className="font-normal normal-case text-ink-600">({endereco.produto.unidade || 'UN'})</span>
                  </span>
                  <span className="data-code text-right text-xs text-ink-600">
                    máx. {endereco.produto.quantidade} ·{' '}
                    {formatarQtdCx(endereco.produto.quantidade, endereco.produto.qt_por_cx, endereco.produto.unidade)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="any"
                    min={0}
                    max={endereco.produto.quantidade}
                    value={qtdRetirar}
                    onChange={(e) => setQtdRetirar(e.target.value)}
                    className="input min-w-0 flex-1"
                    placeholder="Qtd"
                  />
                  <button
                    type="button"
                    onClick={handleRetirarParcial}
                    disabled={retirando || !qtdRetirar}
                    className="w-32 shrink-0 rounded-tag border-2 border-signal-amber600 bg-white px-3 py-1.5 text-sm font-semibold uppercase tracking-wide text-signal-amber600 transition-colors hover:bg-signal-amber100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {retirando ? 'Retirando...' : 'Retirar'}
                  </button>
                </div>
              </div>

              <div className="p-3">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-900">
                    Adicionar <span className="font-normal normal-case text-ink-600">({endereco.produto.unidade || 'UN'})</span>
                  </span>
                  <span className="data-code text-right text-xs text-ink-600">
                    {pendente == null
                      ? 'carregando...'
                      : pendente > 0
                        ? `a posicionar: ${pendente} · ${formatarQtdCx(pendente, endereco.produto.qt_por_cx, endereco.produto.unidade)}`
                        : 'sem estoque a posicionar'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="any"
                    min={0}
                    max={pendente ?? undefined}
                    value={qtdAdicionar}
                    onChange={(e) => setQtdAdicionar(e.target.value)}
                    className="input min-w-0 flex-1 disabled:cursor-not-allowed disabled:bg-steel-100/50"
                    placeholder="Qtd"
                    disabled={!pendente}
                  />
                  <button
                    type="button"
                    onClick={handleAdicionar}
                    disabled={adicionando || !qtdAdicionar || !pendente}
                    className="w-32 shrink-0 rounded-tag border-2 border-signal-green600 bg-white px-3 py-1.5 text-sm font-semibold uppercase tracking-wide text-signal-green600 transition-colors hover:bg-signal-green100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {adicionando ? 'Adicionando...' : 'Adicionar'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {erro && <p className="mt-3 text-sm text-signal-red600">{erro}</p>}

        <div className="mt-4 border-t-2 border-steel-600/25 pt-4">
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

      {confirmandoValidade && endereco.produto && (
        <ModalConfirmacao
          titulo="Corrigir validade"
          textoConfirmar="Confirmar nova validade"
          textoCarregando="Salvando..."
          carregando={salvandoValidade}
          onConfirmar={executarCorrecaoValidade}
          onCancelar={() => setConfirmandoValidade(false)}
        >
          <p className="mb-3 text-ink-600">
            {endereco.produto.nome} <span className="data-code text-steel-400">({endereco.produto.codigo})</span> ·
            posição <span className="data-code">{endereco.codigo}</span>
          </p>
          <div className="flex items-center justify-center gap-3 border-y border-steel-100 py-3">
            <div className="text-center">
              <p className="text-xs uppercase tracking-wide text-ink-600">De</p>
              <p className="data-code text-lg font-bold text-steel-400 line-through">{formatarData(validadeAtual)}</p>
            </div>
            <span className="text-xl text-steel-400">→</span>
            <div className="text-center">
              <p className="text-xs uppercase tracking-wide text-ink-600">Para</p>
              <p className="data-code text-lg font-bold text-steel-900">{formatarData(validadeInput)}</p>
            </div>
          </div>
          <p className="mt-3 text-ink-600">Se a etiqueta já foi colada no pallet, imprima de novo depois.</p>
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
            unidade: endereco.produto.unidade,
            quantidade: endereco.produto.quantidade,
            validade: validadeAtual,
            lote: endereco.produto.lote,
            criadoEm: endereco.produto.criado_em,
          }}
          onClose={() => setEtiquetaAberta(false)}
        />
      )}
    </div>
  );
}

// toda linha da ficha com a mesma altura (as de input/marcador nao ficam mais altas que as de texto)
const LINHA = 'flex min-h-10 items-center justify-between gap-4 border-b border-steel-100 py-1.5';

function Row({ label, value, code }: { label: string; value: string; code?: boolean }) {
  return (
    <div className={LINHA}>
      <dt className="shrink-0 text-ink-600">{label}</dt>
      <dd className={`text-right font-medium text-ink-900 ${code ? 'data-code' : ''}`}>{value}</dd>
    </div>
  );
}
