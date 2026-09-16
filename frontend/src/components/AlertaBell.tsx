import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buscarDashboardKpis, buscarDivergenciasSobra } from '../api/client';

interface Contagens {
  emergencias: number;
  divergencias: number;
  bloqueios: number;
}

export default function AlertaBell() {
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [contagens, setContagens] = useState<Contagens | null>(null);

  function carregar() {
    Promise.all([buscarDashboardKpis(), buscarDivergenciasSobra()]).then(([kpis, divergencias]) => {
      setContagens({
        emergencias: kpis.vencimento.emergencias,
        divergencias: divergencias.length,
        bloqueios: kpis.bloqueios.total,
      });
    });
  }

  useEffect(() => {
    carregar();
    const timer = setInterval(carregar, 60000);
    return () => clearInterval(timer);
  }, []);

  const total = contagens ? contagens.emergencias + contagens.divergencias + contagens.bloqueios : 0;

  function irPara(rota: string) {
    setAberto(false);
    navigate(rota);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setAberto((v) => !v);
          carregar();
        }}
        className="relative rounded-md p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
        title="Alertas"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {total > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium leading-none text-white">
            {total}
          </span>
        )}
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAberto(false)} />
          <div className="absolute right-0 z-20 mt-2 w-72 rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
            {!contagens && <p className="px-3 py-2 text-slate-400">Carregando...</p>}
            {contagens && total === 0 && <p className="px-3 py-2 text-slate-500">Sem alertas no momento.</p>}
            {contagens && contagens.emergencias > 0 && (
              <ItemAlerta
                texto={`${contagens.emergencias} produto(s) em emergência de vencimento`}
                onClick={() => irPara('/validade')}
              />
            )}
            {contagens && contagens.divergencias > 0 && (
              <ItemAlerta
                texto={`${contagens.divergencias} produto(s) com divergência de estoque`}
                onClick={() => irPara('/posicionamento')}
              />
            )}
            {contagens && contagens.bloqueios > 0 && (
              <ItemAlerta texto={`${contagens.bloqueios} posição(ões) bloqueada(s)`} onClick={() => irPara('/')} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ItemAlerta({ texto, onClick }: { texto: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
    >
      {texto}
    </button>
  );
}
