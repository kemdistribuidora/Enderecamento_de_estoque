import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PosicaoAVencer, buscarPosicoesAVencer } from '../api/client';
import { BADGE_STATUS_VALIDADE, ROTULO_STATUS_VALIDADE } from '../utils/statusValidade';

export default function ValidadePage() {
  const [posicoes, setPosicoes] = useState<PosicaoAVencer[]>([]);
  const [carregando, setCarregando] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    buscarPosicoesAVencer()
      .then(setPosicoes)
      .finally(() => setCarregando(false));
  }, []);

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">Controle de validade</h1>
        <p className="mt-1 text-sm text-slate-500">
          Posições ocupadas com validade vencida ou próxima do vencimento, mais urgente primeiro.
        </p>
      </div>

      {carregando && <p className="text-sm text-slate-400">Carregando...</p>}

      {!carregando && posicoes.length === 0 && (
        <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-500">
          Nenhuma posição vencida ou próxima do vencimento.
        </p>
      )}

      {posicoes.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Produto</th>
                <th className="px-4 py-2">Posição</th>
                <th className="px-4 py-2">Lote</th>
                <th className="px-4 py-2 text-right">Quantidade</th>
                <th className="px-4 py-2">Validade</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {posicoes.map((p) => (
                <tr key={p.endereco_id}>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_STATUS_VALIDADE[p.status_validade]}`}>
                      {ROTULO_STATUS_VALIDADE[p.status_validade]}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="font-medium text-slate-800">{p.produto_nome}</span>{' '}
                    <span className="text-slate-400">— {p.produto_codigo}</span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{p.endereco_codigo}</td>
                  <td className="px-4 py-2 text-slate-600">{p.lote ?? '—'}</td>
                  <td className="px-4 py-2 text-right">{p.quantidade}</td>
                  <td className="px-4 py-2 text-slate-600">{p.validade}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => navigate(`/?setor=${p.setor_id}&endereco=${p.endereco_id}`)}
                      className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Ver no mapa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
