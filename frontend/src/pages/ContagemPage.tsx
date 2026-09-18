import { useEffect, useState } from 'react';
import { buscarMapaSetor, buscarSetores, contarEndereco } from '../api/client';
import { EnderecoComStatus, MapaSetor, Setor } from '../types';
import { formatarQtdCx } from '../utils/quantidade';

type Resultado = { divergencia: number; quantidadeSistema: number };

export default function ContagemPage() {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [setorAtivoId, setSetorAtivoId] = useState<number | null>(null);
  const [mapa, setMapa] = useState<MapaSetor | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [quantidades, setQuantidades] = useState<Record<number, string>>({});
  const [contando, setContando] = useState<number | null>(null);
  const [resultados, setResultados] = useState<Record<number, Resultado>>({});
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    buscarSetores().then((lista) => {
      setSetores(lista);
      setSetorAtivoId(lista[0]?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (setorAtivoId === null) return;
    setCarregando(true);
    setResultados({});
    setQuantidades({});
    buscarMapaSetor(setorAtivoId)
      .then(setMapa)
      .finally(() => setCarregando(false));
  }, [setorAtivoId]);

  const termo = busca.trim().toLowerCase();

  const posicoesOcupadas: EnderecoComStatus[] = (mapa?.prateleiras ?? [])
    .flatMap((p) => p.posicoes)
    .filter((p) => p.status === 'ocupado')
    .filter((p) => {
      if (!termo) return true;
      return (
        p.codigo.toLowerCase().includes(termo) ||
        p.produto?.nome?.toLowerCase().includes(termo) ||
        p.produto?.codigo?.toLowerCase().includes(termo) ||
        p.produto?.codigo_barras?.toLowerCase().includes(termo)
      );
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo));

  async function handleContar(posicao: EnderecoComStatus) {
    const valor = quantidades[posicao.id];
    if (valor === undefined || valor === '') {
      setErro('Informe a quantidade contada.');
      return;
    }
    const quantidadeContada = Number(valor);
    if (!Number.isFinite(quantidadeContada) || quantidadeContada < 0) {
      setErro('Quantidade contada inválida.');
      return;
    }
    setContando(posicao.id);
    setErro('');
    try {
      const resp = await contarEndereco(posicao.id, quantidadeContada);
      setResultados((prev) => ({ ...prev, [posicao.id]: { divergencia: resp.divergencia, quantidadeSistema: resp.quantidade_sistema } }));
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao registrar contagem.');
    } finally {
      setContando(null);
    }
  }

  const totalContadas = Object.keys(resultados).length;

  return (
    <div className="space-y-4">
      <div className="border-b-2 border-steel-600/25 pb-4">
        <h1 className="page-title">Contagem cíclica</h1>
        <p className="mt-1 text-sm text-ink-600">
          Escolha um setor, conte cada posição ocupada. Diferença ajusta o estoque na hora e fica registrada no histórico.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b-2 border-steel-600/25 pb-3">
        {setores.map((s) => (
          <button
            key={s.id}
            onClick={() => setSetorAtivoId(s.id)}
            className={`whitespace-nowrap rounded-tag px-3 py-1.5 text-sm font-medium transition-colors ${
              setorAtivoId === s.id
                ? 'bg-steel-900 text-white'
                : 'border border-steel-600/25 bg-white text-ink-600 hover:bg-concrete-200'
            }`}
          >
            {s.nome}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="input w-full max-w-xs"
        placeholder="Buscar por item, código ou posição..."
      />

      {erro && <p className="text-sm text-signal-red600">{erro}</p>}

      {carregando && <p className="text-sm text-steel-400">Carregando...</p>}

      {!carregando && posicoesOcupadas.length === 0 && (
        <p className="panel p-4 text-sm text-ink-600">
          {termo ? 'Nenhuma posição encontrada para essa busca.' : 'Nenhuma posição ocupada nesse setor.'}
        </p>
      )}

      {!carregando && posicoesOcupadas.length > 0 && (
        <>
          <p className="text-sm text-ink-600">
            <span className="data-code">
              {totalContadas}/{posicoesOcupadas.length}
            </span>{' '}
            posições contadas nessa sessão.
          </p>

          <div className="panel max-w-6xl overflow-x-auto">
            <table className="table-plate">
              <colgroup>
                <col className="w-[9%]" />
                <col className="w-[27%]" />
                <col className="w-[11%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
                <col className="w-[27%]" />
              </colgroup>
              <thead>
                <tr>
                  <th>Posição</th>
                  <th>Produto</th>
                  <th>Sistema</th>
                  <th>Contado (UN)</th>
                  <th></th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {posicoesOcupadas.map((posicao) => {
                  const resultado = resultados[posicao.id];
                  return (
                    <tr key={posicao.id}>
                      <td className="data-code whitespace-nowrap text-ink-600">
                        {posicao.codigo}
                        {posicao.bloqueado && <span className="ml-1 text-signal-red600" title={posicao.bloqueio_motivo ?? ''}>⚠</span>}
                      </td>
                      <td title={`${posicao.produto?.nome} — ${posicao.produto?.codigo}`}>
                        <span className="font-medium text-ink-900">{posicao.produto?.nome}</span>{' '}
                        <span className="data-code text-steel-400">— {posicao.produto?.codigo}</span>
                      </td>
                      <td className="data-code whitespace-nowrap text-ink-600">
                        {formatarQtdCx(posicao.produto?.quantidade ?? 0, posicao.produto?.qt_por_cx ?? null)}
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          value={quantidades[posicao.id] ?? ''}
                          onChange={(e) => setQuantidades((prev) => ({ ...prev, [posicao.id]: e.target.value }))}
                          disabled={!!resultado}
                          className="input w-full disabled:bg-concrete-100 disabled:text-steel-400"
                          placeholder="Qtd"
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleContar(posicao)}
                          disabled={contando === posicao.id || !!resultado}
                          className="btn-secondary w-full"
                        >
                          {contando === posicao.id ? 'Confirmando...' : resultado ? 'Confirmado' : 'Confirmar'}
                        </button>
                      </td>
                      <td>
                        {resultado && (
                          resultado.divergencia === 0 ? (
                            <span className="text-xs font-medium text-signal-green600">Bateu</span>
                          ) : (
                            <span
                              className="text-xs font-medium text-signal-amber600"
                              title={`Ajustado: sistema tinha ${resultado.quantidadeSistema}, diferença ${resultado.divergencia > 0 ? '+' : ''}${resultado.divergencia}`}
                            >
                              Ajustado: sistema {resultado.quantidadeSistema}, dif. {resultado.divergencia > 0 ? '+' : ''}
                              {resultado.divergencia}
                            </span>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
