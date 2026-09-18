import { useEffect, useState } from 'react';
import {
  DivergenciaSobra,
  PendenciaPosicionamento,
  SugestaoEndereco,
  atualizarPesoCaixa,
  buscarDivergenciasSobra,
  buscarPendenciasPosicionamento,
  buscarSugestaoEndereco,
  ocuparEndereco,
} from '../api/client';
import { EnderecoComStatus } from '../types';
import { formatarQtdCx } from '../utils/quantidade';
import ModalEscolherNoMapa from '../components/ModalEscolherNoMapa';
import EtiquetaModal, { DadosEtiqueta } from '../components/EtiquetaModal';

export default function PosicionamentoPage() {
  const [pendencias, setPendencias] = useState<PendenciaPosicionamento[]>([]);
  const [sobras, setSobras] = useState<DivergenciaSobra[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [emEdicao, setEmEdicao] = useState<PendenciaPosicionamento | null>(null);
  const [busca, setBusca] = useState('');

  const buscaNormalizada = busca.trim().toLowerCase();
  const pendenciasFiltradas = buscaNormalizada
    ? pendencias.filter(
        (p) =>
          p.nome.toLowerCase().includes(buscaNormalizada) ||
          p.codigo.toLowerCase().includes(buscaNormalizada) ||
          (p.codigo_barras ?? '').toLowerCase().includes(buscaNormalizada)
      )
    : pendencias;

  function carregar() {
    setCarregando(true);
    Promise.all([buscarPendenciasPosicionamento(), buscarDivergenciasSobra()])
      .then(([listaPendencias, listaSobras]) => {
        setPendencias(listaPendencias);
        setSobras(listaSobras);
      })
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
  }, []);

  return (
    <div className="space-y-4">
      <div className="border-b-2 border-steel-600/25 pb-4">
        <h1 className="page-title">Posicionar estoque</h1>
        <p className="mt-1 text-sm text-ink-600">Saldo importado do Winthor ainda pendente de posição física.</p>
      </div>

      {carregando && <p className="text-sm text-steel-400">Carregando...</p>}

      {!carregando && pendencias.length === 0 && (
        <p className="rounded-tag bg-concrete-100 p-4 text-sm text-ink-600">Nenhuma pendência de posicionamento.</p>
      )}

      {pendencias.length > 0 && (
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar produto por nome, código ou código de barras..."
          className="input w-full max-w-md"
        />
      )}

      {pendencias.length > 0 && pendenciasFiltradas.length === 0 && (
        <p className="rounded-tag bg-concrete-100 p-4 text-sm text-ink-600">Nenhum produto encontrado para "{busca}".</p>
      )}

      {pendenciasFiltradas.length > 0 && (
        <div className="panel max-w-6xl overflow-hidden">
          <table className="table-plate">
            <colgroup>
              <col />
              <col className="w-40" />
              <col className="w-32" />
              <col className="w-32" />
              <col className="w-28" />
              <col className="w-36" />
            </colgroup>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Saldo</th>
                <th>Alocado</th>
                <th>Pendente</th>
                <th>Peso (kg)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pendenciasFiltradas.map((p) => (
                <tr key={p.produto_id}>
                  <td className="truncate" title={`${p.nome} ${p.codigo}`}>
                    <span className="font-medium text-ink-900">{p.nome}</span>{' '}
                    <span className="text-steel-400"> ({p.codigo})</span>
                  </td>
                  <td className="data-code truncate">{formatarQtdCx(p.saldo_total, p.qt_por_cx)}</td>
                  <td className="data-code truncate">{formatarQtdCx(p.alocado_total, p.qt_por_cx)}</td>
                  <td className="data-code truncate font-medium text-signal-amber600">
                    {formatarQtdCx(p.pendente, p.qt_por_cx)}
                  </td>
                  <td>
                    <PesoCaixaInput
                      pendencia={p}
                      onSalvo={(pesoCaixa) =>
                        setPendencias((atual) =>
                          atual.map((item) => (item.produto_id === p.produto_id ? { ...item, peso_caixa: pesoCaixa } : item))
                        )
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => setEmEdicao(p)}
                      className="btn-primary w-full"
                    >
                      Posicionar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t-2 border-steel-600/25 pt-4">
        <h2 className="font-display text-lg font-bold text-steel-900">Possível saída não registrada</h2>
        <p className="mt-1 text-sm text-ink-600">Estoque físico maior que o saldo do Winthor. Apenas alerta.</p>

        {!carregando && sobras.length === 0 && (
          <p className="mt-3 rounded-tag bg-concrete-100 p-4 text-sm text-ink-600">Nenhuma divergência desse tipo.</p>
        )}

        {sobras.length > 0 && (
          <div className="mt-3 panel max-w-6xl overflow-hidden border-signal-red600/30">
            <table className="table-plate">
              <colgroup>
                <col />
                <col className="w-40" />
                <col className="w-32" />
                <col className="w-32" />
              </colgroup>
              <thead className="bg-signal-red100 text-signal-red600">
                <tr>
                  <th>Produto</th>
                  <th>Saldo Winthor</th>
                  <th>Alocado aqui</th>
                  <th>Excesso</th>
                </tr>
              </thead>
              <tbody>
                {sobras.map((s) => (
                  <tr key={s.produto_id}>
                    <td className="truncate" title={`${s.nome} (${s.codigo})`}>
                      <span className="font-medium text-ink-900">{s.nome}</span>{' '}
                      <span className="text-steel-400"> ({s.codigo})</span>
                    </td>
                    <td className="data-code truncate">{formatarQtdCx(s.saldo_total, s.qt_por_cx)}</td>
                    <td className="data-code truncate">{formatarQtdCx(s.alocado_total, s.qt_por_cx)}</td>
                    <td className="data-code truncate font-medium text-signal-red600">
                      {formatarQtdCx(s.excesso, s.qt_por_cx)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {emEdicao && (
        <PosicionarModal
          pendencia={emEdicao}
          onFechar={() => setEmEdicao(null)}
          onPosicionado={() => {
            setEmEdicao(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}

function PesoCaixaInput({
  pendencia,
  onSalvo,
}: {
  pendencia: PendenciaPosicionamento;
  onSalvo: (pesoCaixa: number | null) => void;
}) {
  const [valor, setValor] = useState(pendencia.peso_caixa != null ? String(pendencia.peso_caixa) : '');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setValor(pendencia.peso_caixa != null ? String(pendencia.peso_caixa) : '');
  }, [pendencia.peso_caixa]);

  async function handleBlur() {
    const texto = valor.trim();
    const novoPeso = texto ? Number(texto) : null;
    if (texto && Number.isNaN(novoPeso)) return;
    if (novoPeso === pendencia.peso_caixa) return;

    setSalvando(true);
    try {
      await atualizarPesoCaixa(pendencia.produto_id, novoPeso);
      onSalvo(novoPeso);
    } catch {
      setValor(pendencia.peso_caixa != null ? String(pendencia.peso_caixa) : '');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <input
      type="number"
      step="0.001"
      min={0}
      value={valor}
      onChange={(e) => setValor(e.target.value)}
      onBlur={handleBlur}
      disabled={salvando}
      placeholder=""
      className="input w-20 disabled:opacity-50"
    />
  );
}

function PosicionarModal({
  pendencia,
  onFechar,
  onPosicionado,
}: {
  pendencia: PendenciaPosicionamento;
  onFechar: () => void;
  onPosicionado: () => void;
}) {
  const [sugestao, setSugestao] = useState<SugestaoEndereco | null>(null);
  const [carregandoSugestao, setCarregandoSugestao] = useState(true);
  const [enderecoEscolhido, setEnderecoEscolhido] = useState<EnderecoComStatus | null>(null);
  const [quantidade, setQuantidade] = useState(String(pendencia.pendente));
  const [validade, setValidade] = useState('');
  const [lote, setLote] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [dadosEtiqueta, setDadosEtiqueta] = useState<DadosEtiqueta | null>(null);

  useEffect(() => {
    buscarSugestaoEndereco(pendencia.produto_id)
      .then(setSugestao)
      .finally(() => setCarregandoSugestao(false));
  }, [pendencia.produto_id]);

  async function handleConfirmar() {
    const qtd = Number(quantidade);
    if (!enderecoEscolhido || !qtd || qtd <= 0 || !validade || !lote.trim()) {
      setErro('Escolha um endereço no mapa, quantidade válida, validade e lote.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const resultado = await ocuparEndereco(enderecoEscolhido.id, pendencia.produto_id, qtd, validade, lote.trim());
      setDadosEtiqueta({
        enderecoCodigo: enderecoEscolhido.codigo,
        produtoNome: pendencia.nome,
        produtoCodigo: pendencia.codigo,
        codigoBarras: pendencia.codigo_barras,
        pesoCaixa: pendencia.peso_caixa,
        qtPorCx: pendencia.qt_por_cx,
        quantidade: qtd,
        validade,
        lote: lote.trim(),
        criadoEm: resultado.criado_em,
      });
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao posicionar.');
    } finally {
      setSalvando(false);
    }
  }

  if (dadosEtiqueta) {
    return <EtiquetaModal dados={dadosEtiqueta} onClose={onPosicionado} />;
  }

  if (carregandoSugestao) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <p className="panel bg-white px-4 py-3 text-sm text-ink-600">Carregando sugestão de posição...</p>
      </div>
    );
  }

  if (!enderecoEscolhido) {
    return (
      <ModalEscolherNoMapa
        onFechar={onFechar}
        enderecoSugeridoId={sugestao?.endereco_id}
        setorSugeridoId={sugestao?.setor_id}
        onEscolher={setEnderecoEscolhido}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onFechar}>
      <div className="w-full max-w-2xl panel p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-ink-900">
          {pendencia.nome} <span className="font-normal text-steel-400"> {pendencia.codigo}</span>
        </h3>
        <p className="mt-1 text-sm text-ink-600">
          Posição escolhida: <strong>{enderecoEscolhido.codigo}</strong>
        </p>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <label className="col-span-3 block text-sm sm:col-span-1">
            <span className="mb-1 block font-medium text-ink-600">
              Quantidade em UN (pendente: {pendencia.pendente} = {formatarQtdCx(pendencia.pendente, pendencia.qt_por_cx)})
            </span>
            <input
              type="number"
              min={1}
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              className="input"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink-600">Validade do lote</span>
            <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} className="input" />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink-600">Lote</span>
            <input value={lote} onChange={(e) => setLote(e.target.value)} className="input" placeholder="LOTE-0001" />
          </label>
        </div>

        {erro && <p className="mt-2 text-sm text-signal-red600">{erro}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setEnderecoEscolhido(null)}
            className="btn-secondary"
          >
            Trocar posição
          </button>
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={salvando}
            className="btn-primary"
          >
            {salvando ? 'Salvando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
