import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import JsBarcode from 'jsbarcode';

export interface DadosEtiqueta {
  enderecoCodigo: string;
  produtoNome: string;
  produtoCodigo: string;
  codigoBarras: string;
  pesoCaixa: number | null;
  quantidade: number;
  validade: string;
  lote: string | null;
  criadoEm: string | null;
}

interface Props {
  dados: DadosEtiqueta;
  onClose: () => void;
}

function formatarData(iso: string | null): string {
  if (!iso) return '—';
  const data = new Date(iso);
  if (isNaN(data.getTime())) return iso;
  return data.toLocaleDateString('pt-BR');
}

export default function EtiquetaModal({ dados, onClose }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [observacao, setObservacao] = useState('');

  const pesoTotal = dados.pesoCaixa != null ? dados.quantidade * dados.pesoCaixa : null;

  useEffect(() => {
    if (!svgRef.current) return;
    const valor = dados.codigoBarras?.trim() || dados.produtoCodigo;
    try {
      JsBarcode(svgRef.current, valor, {
        format: 'CODE128',
        width: 2,
        height: 60,
        displayValue: false,
        margin: 0,
      });
    } catch {
      // codigo com caracteres invalidos pro formato -- deixa svg vazio, numero grande ainda aparece embaixo
    }
  }, [dados.codigoBarras, dados.produtoCodigo]);

  return createPortal(
    <div
      id="etiqueta-portal-root"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:static print:bg-transparent print:p-0"
      onClick={onClose}
    >
      <div
        className="etiqueta-fora-impressao flex max-h-[92vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-lg font-semibold text-slate-800">Etiqueta — {dados.enderecoCodigo}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <div className="overflow-auto p-5">
          <label className="mb-3 block text-sm">
            <span className="mb-1 block font-medium text-slate-600">Observação (opcional, entra na etiqueta)</span>
            <input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="input"
              placeholder="Deixe em branco pra anotar à mão depois de imprimir"
            />
          </label>

          <p className="mb-2 text-xs text-slate-400">Pré-visualização (impressão sai em paisagem, ocupando a folha toda)</p>

          <div className="flex justify-center bg-slate-50 p-4">
            <div
              id="etiqueta-print"
              className="flex h-[382px] w-[600px] border-2 border-slate-800 bg-white text-slate-900"
            >
              <div className="etq-col-dados flex w-[230px] flex-col border-r-2 border-slate-800">
                <div className="etq-obs flex-1 border-b-2 border-slate-800 p-2">
                  <div className="etq-obs-label text-xs font-semibold text-slate-500">Observação</div>
                  <div className="etq-obs-texto whitespace-pre-wrap text-sm">{observacao}</div>
                </div>
                <LinhaEtiqueta label="Endereço" valor={dados.enderecoCodigo} />
                <LinhaEtiqueta label="Dt Entrada" valor={formatarData(dados.criadoEm)} />
                <LinhaEtiqueta label="Lote" valor={dados.lote ?? '—'} />
                <LinhaEtiqueta label="Qtd caixas" valor={String(dados.quantidade)} />
                <LinhaEtiqueta label="Peso" valor={pesoTotal != null ? `${pesoTotal.toFixed(2)} KG` : 'cadastrar peso da caixa'} ultima />
              </div>

              <div className="flex flex-1 flex-col items-center justify-between p-3">
                <div className="text-center leading-tight">
                  <div className="etq-data-label text-xs font-semibold text-slate-500">Dt Validade</div>
                  <div className="etq-data-valor text-6xl font-bold">{formatarData(dados.validade)}</div>
                </div>

                <div className="text-center leading-tight">
                  <div className="etq-data-label text-xs font-semibold text-slate-500">Produto</div>
                  <div className="etq-data-valor text-3xl font-bold leading-snug">{`${dados.produtoNome} (${dados.produtoCodigo})`}</div>
                </div>

                <svg ref={svgRef} className="etq-barcode w-full" />
                <div className="etq-num-barras text-center text-xl font-bold tracking-wider">
                  {dados.codigoBarras?.trim() || dados.produtoCodigo}
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="mt-4 w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Imprimir etiqueta
          </button>
        </div>
      </div>

      <style>{`
        @page { size: A4 landscape; margin: 10mm; }
        @media print {
          html, body { margin: 0; }
          #root { display: none !important; }
          #etiqueta-portal-root * { visibility: hidden; }
          #etiqueta-print, #etiqueta-print * { visibility: visible; }
          #etiqueta-print {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(1.7);
            transform-origin: center;
          }
          .etiqueta-fora-impressao { box-shadow: none; }
        }
      `}</style>
    </div>,
    document.body
  );
}

function LinhaEtiqueta({ label, valor, ultima }: { label: string; valor: string; ultima?: boolean }) {
  return (
    <div className={`etq-linha px-2 py-1 text-xs ${ultima ? '' : 'border-b border-slate-300'}`}>
      <span className="font-semibold text-slate-500">{label}:</span> {valor}
    </div>
  );
}
