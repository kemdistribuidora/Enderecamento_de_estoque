import { useEffect, useState } from 'react';
import { buscarMapaSetor, buscarProdutoPorCodigoBarras, liberarEndereco } from '../api/client';
import { MapaSetor } from '../types';
import MapaSetorView from './MapaSetorView';
import ScannerInput from './ScannerInput';

interface Props {
  produtoId: number;
  produtoNome: string;
  produtoCodigo: string;
  enderecoId: number;
  codigoEndereco: string;
  setorId: number;
  quantidade: number;
  validade: string;
  lote: string | null;
  onFechar: () => void;
  onConcluido: () => void;
}

export default function PainelSeparacao({
  produtoId,
  produtoNome,
  produtoCodigo,
  enderecoId,
  codigoEndereco,
  setorId,
  quantidade,
  validade,
  lote,
  onFechar,
  onConcluido,
}: Props) {
  const [mapa, setMapa] = useState<MapaSetor | null>(null);
  const [bipado, setBipado] = useState(false);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    buscarMapaSetor(setorId).then(setMapa);
  }, [setorId]);

  async function handleBipar(codigo: string) {
    setErro('');
    try {
      const p = await buscarProdutoPorCodigoBarras(codigo);
      if (p.id !== produtoId) {
        setErro(`Código bipado é de "${p.nome}", não de "${produtoNome}". Confira a pallet.`);
        return;
      }
      setBipado(true);
    } catch (err: any) {
      setErro(err.message ?? 'Código não encontrado.');
    }
  }

  async function handleConfirmar() {
    setSalvando(true);
    setErro('');
    try {
      await liberarEndereco(enderecoId);
      onConcluido();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao liberar posição.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-xl border-2 border-slate-800 bg-white p-4 shadow-lg">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800">
            Separando {produtoNome} <span className="font-normal text-slate-400">— {produtoCodigo}</span>
          </h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Posição <strong>{codigoEndereco}</strong> · {quantidade}un · lote {lote ?? '—'} · vence {validade}
          </p>
        </div>
        <button type="button" onClick={onFechar} className="text-slate-400 hover:text-slate-600">
          ✕
        </button>
      </div>

      {mapa ? (
        <MapaSetorView mapa={mapa} onSelect={() => {}} enderecoDestacadoId={enderecoId} />
      ) : (
        <p className="text-sm text-slate-400">Carregando mapa...</p>
      )}

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        {!bipado ? (
          <>
            <p className="mb-2 text-sm font-medium text-slate-600">Bipe o código de barras da pallet pra confirmar</p>
            <ScannerInput onScan={handleBipar} placeholder="Código de barras do produto..." />
          </>
        ) : (
          <>
            <p className="mb-2 text-sm font-medium text-green-700">✓ Pallet confirmada, pronto pra liberar a posição</p>
            <button
              type="button"
              onClick={handleConfirmar}
              disabled={salvando}
              className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {salvando ? 'Liberando...' : 'Confirmar liberação'}
            </button>
          </>
        )}
        {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
      </div>
    </div>
  );
}
