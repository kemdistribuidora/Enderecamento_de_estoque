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

  const posicoesOcupadas: EnderecoComStatus[] = (mapa?.prateleiras ?? [])
    .flatMap((p) => p.posicoes)
    .filter((p) => p.status === 'ocupado')
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
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">Contagem cíclica</h1>
        <p className="mt-1 text-sm text-slate-500">
          Escolha um setor, conte cada posição ocupada. Diferença ajusta o estoque na hora e fica registrada no histórico.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-3">
        {setores.map((s) => (
          <button
            key={s.id}
            onClick={() => setSetorAtivoId(s.id)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              setorAtivoId === s.id
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {s.nome}
          </button>
        ))}
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {carregando && <p className="text-sm text-slate-400">Carregando...</p>}

      {!carregando && posicoesOcupadas.length === 0 && (
        <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-500">Nenhuma posição ocupada nesse setor.</p>
      )}

      {!carregando && posicoesOcupadas.length > 0 && (
        <>
          <p className="text-sm text-slate-500">
            {totalContadas}/{posicoesOcupadas.length} posições contadas nessa sessão.
          </p>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Posição</th>
                  <th className="px-4 py-2">Produto</th>
                  <th className="px-4 py-2">Sistema</th>
                  <th className="px-4 py-2">Contado (UN)</th>
                  <th className="px-4 py-2"></th>
                  <th className="px-4 py-2">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {posicoesOcupadas.map((posicao) => {
                  const resultado = resultados[posicao.id];
                  return (
                    <tr key={posicao.id}>
                      <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                        {posicao.codigo}
                        {posicao.bloqueado && <span className="ml-1 text-red-500" title={posicao.bloqueio_motivo ?? ''}>⚠</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2">
                        <span className="font-medium text-slate-800">{posicao.produto?.nome}</span>{' '}
                        <span className="text-slate-400">— {posicao.produto?.codigo}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                        {formatarQtdCx(posicao.produto?.quantidade ?? 0, posicao.produto?.qt_por_cx ?? null)}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min={0}
                          value={quantidades[posicao.id] ?? ''}
                          onChange={(e) => setQuantidades((prev) => ({ ...prev, [posicao.id]: e.target.value }))}
                          disabled={!!resultado}
                          className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                          placeholder="Qtd"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => handleContar(posicao)}
                          disabled={contando === posicao.id || !!resultado}
                          className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {contando === posicao.id ? 'Confirmando...' : resultado ? 'Confirmado' : 'Confirmar'}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2">
                        {resultado && (
                          resultado.divergencia === 0 ? (
                            <span className="text-xs font-medium text-green-700">Bateu</span>
                          ) : (
                            <span className="text-xs font-medium text-amber-700">
                              Ajustado: sistema tinha {resultado.quantidadeSistema}, diferença {resultado.divergencia > 0 ? '+' : ''}
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
