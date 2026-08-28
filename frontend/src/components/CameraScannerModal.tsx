import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';

export default function CameraScannerModal({ onDecode, onClose }: { onDecode: (codigo: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let controls: IScannerControls | undefined;
    let cancelado = false;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result, _err, ctrls) => {
        controls = ctrls;
        if (result && !cancelado) {
          cancelado = true;
          onDecode(result.getText());
        }
      })
      .catch(() => setErro('Não foi possível acessar a câmera. Verifique a permissão do navegador.'));

    return () => controls?.stop(); // fecha a stream da camera ao desmontar -- senao a luz da camera fica acesa
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Escanear com a câmera</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <video ref={videoRef} className="w-full rounded-md bg-black" muted playsInline />
      </div>
    </div>
  );
}
