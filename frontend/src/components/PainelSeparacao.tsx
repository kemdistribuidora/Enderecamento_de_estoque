import { useEffect, useState } from 'react';
import { buscarMapaSetor, buscarProdutoPorCodigoBarras, liberarEndereco } from '../api/client';
import { MapaSetor } from '../types';
import { formatarQtdCx } from '../utils/quantidade';
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
  qtPorCx?: number | null;
  validade: string;
  lote: string | null;
  onFechar: () => void;
  onConcluido: () => void;
  exibirMapa?: boolean;
}

export default function PainelSeparacao({
  produtoId,
  produtoNome,
  produtoCodigo,
  enderecoId,
  codigoEndereco,
  setorId,
  quantidade,
  qtPorCx = null,
  validade,
  lote,
  onFechar,
  onConcluido,
  exibirMapa = true,
}: Props) {
  const [mapa, setMapa] = useState<MapaSetor | null>(null);
  const [bipado, setBipado] = useState(false);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!exibirMapa) return;
    buscarMapaSetor(setorId).then(setMapa);
  }, [setorId, exibirMapa]);

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
    <div className="rounded-soft border-2 border-steel-900 bg-white p-4 shadow-sm shadow-steel-900/10">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-ink-900">
            Separando {produtoNome} <span className="data-code font-normal text-steel-400">— {produtoCodigo}</span>
          </h3>
          <p className="mt-0.5 text-sm text-ink-600">
            Posição <strong>{codigoEndereco}</strong> · {formatarQtdCx(quantidade, qtPorCx)} · lote {lote ?? '—'} · vence{' '}
            {validade}
          </p>
        </div>
        <button type="button" onClick={onFechar} className="text-steel-400 hover:text-ink-900">
          ✕
        </button>
      </div>

      {exibirMapa &&
        (mapa ? (
          <MapaSetorView mapa={mapa} onSelect={() => {}} enderecoDestacadoId={enderecoId} />
        ) : (
          <p className="text-sm text-steel-400">Carregando mapa...</p>
        ))}

      <div className="mt-4 rounded-soft border border-steel-600/25 bg-concrete-100 p-3">
        {!bipado ? (
          <>
            <p className="mb-2 text-sm font-medium text-ink-600">Bipe o código de barras da pallet pra confirmar</p>
            <ScannerInput onScan={handleBipar} placeholder="Código de barras do produto..." />
          </>
        ) : (
          <>
            <p className="mb-2 text-sm font-medium text-signal-green600">✓ Pallet confirmada, pronto pra liberar a posição</p>
            <button
              type="button"
              onClick={handleConfirmar}
              disabled={salvando}
              className="btn-primary w-full"
            >
              {salvando ? 'Liberando...' : 'Confirmar liberação'}
            </button>
          </>
        )}
        {erro && <p className="mt-2 text-sm text-signal-red600">{erro}</p>}
      </div>
    </div>
  );
}
