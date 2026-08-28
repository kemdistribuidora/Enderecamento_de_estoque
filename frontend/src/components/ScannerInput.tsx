import { useEffect, useRef, useState } from 'react';
import CameraScannerModal from './CameraScannerModal';

interface Props {
  onScan: (codigo: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export default function ScannerInput({ onScan, placeholder, autoFocus = true }: Props) {
  const [valor, setValor] = useState('');
  const [camaraAberta, setCamaraAberta] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  function disparar(codigo: string) {
    const limpo = codigo.trim();
    if (!limpo) return;
    onScan(limpo);
    setValor('');
    inputRef.current?.focus(); // fluxo de scan continuo: pronto pro proximo scan na hora
  }

  return (
    <div className="flex gap-2">
      <input
        ref={inputRef}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault(); // coletor USB/RF manda Enter apos o codigo -- nao deixa isso submeter formulario nenhum
            disparar(valor);
          }
        }}
        placeholder={placeholder ?? 'Escaneie ou digite o código...'}
        className="input flex-1"
      />
      <button
        type="button"
        onClick={() => setCamaraAberta(true)}
        title="Escanear com a câmera"
        className="shrink-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
      >
        📷
      </button>
      {camaraAberta && (
        <CameraScannerModal
          onDecode={(codigo) => {
            setCamaraAberta(false);
            disparar(codigo);
          }}
          onClose={() => setCamaraAberta(false)}
        />
      )}
    </div>
  );
}
