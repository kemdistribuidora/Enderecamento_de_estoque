import { useEffect, useState } from 'react';
import {
  DivergenciaSobra,
  PendenciaPosicionamento,
  SugestaoEndereco,
  buscarDivergenciasSobra,
  buscarPendenciasPosicionamento,
  buscarSugestaoEndereco,
  ocuparEndereco,
} from '../api/client';
import { EnderecoComStatus } from '../types';
import ModalEscolherNoMapa from '../components/ModalEscolherNoMapa';

export default function PosicionamentoPage() {
  const [pendencias, setPendencias] = useState<PendenciaPosicionamento[]>([]);
  const [sobras, setSobras] = useState<DivergenciaSobra[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [emEdicao, setEmEdicao] = useState<PendenciaPosicionamento | null>(null);

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
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">Posicionar estoque</h1>
        <p className="mt-1 text-sm text-slate-500">
          Produtos com saldo importado do Winthor ainda maior que o alocado fisicamente. Posicione todos agora ou só
          alguns — o que ficar de fora continua aqui pra depois.
        </p>
      </div>

      {carregando && <p className="text-sm text-slate-400">Carregando...</p>}

      {!carregando && pendencias.length === 0 && (
        <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-500">Nenhuma pendência de posicionamento.</p>
      )}

      {pendencias.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Produto</th>
                <th className="px-4 py-2 text-right">Saldo Winthor</th>
                <th className="px-4 py-2 text-right">Já alocado</th>
                <th className="px-4 py-2 text-right">Pendente</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendencias.map((p) => (
                <tr key={p.produto_id}>
                  <td className="px-4 py-2">
                    <span className="font-medium text-slate-800">{p.nome}</span>{' '}
                    <span className="text-slate-400">— {p.codigo}</span>
                  </td>
                  <td className="px-4 py-2 text-right">{p.saldo_total}</td>
                  <td className="px-4 py-2 text-right">{p.alocado_total}</td>
                  <td className="px-4 py-2 text-right font-medium text-amber-700">{p.pendente}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setEmEdicao(p)}
                      className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
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

      <div className="border-t border-slate-200 pt-4">
        <h2 className="text-base font-semibold text-slate-800">Possível saída não registrada</h2>
        <p className="mt-1 text-sm text-slate-500">
          Estoque físico maior que o saldo do Winthor. O Winthor manda — provavelmente uma saída aconteceu e ninguém
          liberou a posição aqui no sistema ainda. Só alerta, não mexe em nada sozinho.
        </p>

        {!carregando && sobras.length === 0 && (
          <p className="mt-3 rounded-md bg-slate-50 p-4 text-sm text-slate-500">Nenhuma divergência desse tipo.</p>
        )}

        {sobras.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-lg border border-red-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-red-50 text-left text-xs font-medium uppercase text-red-700">
                <tr>
                  <th className="px-4 py-2">Produto</th>
                  <th className="px-4 py-2 text-right">Saldo Winthor</th>
                  <th className="px-4 py-2 text-right">Alocado aqui</th>
                  <th className="px-4 py-2 text-right">Excesso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sobras.map((s) => (
                  <tr key={s.produto_id}>
                    <td className="px-4 py-2">
                      <span className="font-medium text-slate-800">{s.nome}</span>{' '}
                      <span className="text-slate-400">— {s.codigo}</span>
                    </td>
                    <td className="px-4 py-2 text-right">{s.saldo_total}</td>
                    <td className="px-4 py-2 text-right">{s.alocado_total}</td>
                    <td className="px-4 py-2 text-right font-medium text-red-700">{s.excesso}</td>
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
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    buscarSugestaoEndereco(pendencia.produto_id)
      .then(setSugestao)
      .finally(() => setCarregandoSugestao(false));
  }, [pendencia.produto_id]);

  async function handleConfirmar() {
    const qtd = Number(quantidade);
    if (!enderecoEscolhido || !qtd || qtd <= 0 || !validade) {
      setErro('Escolha um endereço no mapa, quantidade válida e validade.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await ocuparEndereco(enderecoEscolhido.id, pendencia.produto_id, qtd, validade);
      onPosicionado();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao posicionar.');
    } finally {
      setSalvando(false);
    }
  }

  if (carregandoSugestao) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <p className="rounded-lg bg-white px-4 py-3 text-sm text-slate-500">Carregando sugestão de posição...</p>
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
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-slate-800">
          {pendencia.nome} <span className="font-normal text-slate-400">— {pendencia.codigo}</span>
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Posição escolhida: <strong>{enderecoEscolhido.codigo}</strong>
        </p>

        <div className="mt-3 space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">Quantidade (pendente: {pendencia.pendente})</span>
            <input
              type="number"
              min={1}
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              className="input"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">Validade do lote</span>
            <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} className="input" />
          </label>
        </div>

        {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setEnderecoEscolhido(null)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Trocar posição
          </button>
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={salvando}
            className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
