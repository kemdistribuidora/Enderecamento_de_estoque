import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { EVENTO_PIN_INVALIDO, lerPin, salvarPin, verificarPin } from '../api/client';

// Tela de PIN unico antes do sistema. Confere o PIN salvo ao abrir (backend sem APP_PIN
// aceita qualquer coisa, entao em dev local a tela nem aparece). Qualquer 401 depois
// (PIN trocado no servidor) volta pra esta tela.
export default function PinGate({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<'verificando' | 'liberado' | 'pedir'>('verificando');
  const [pin, setPin] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    verificarPin(lerPin())
      .then((ok) => setEstado(ok ? 'liberado' : 'pedir'))
      .catch((err: any) => {
        // fetch sem resposta (servidor fora/acordando) cai aqui como TypeError
        setErro(err instanceof TypeError ? 'Servidor não respondeu. Confira a internet e tente entrar.' : err.message);
        setEstado('pedir');
      });

    const pedirDeNovo = () => {
      setErro('PIN expirou ou foi trocado. Digite de novo.');
      setEstado('pedir');
    };
    window.addEventListener(EVENTO_PIN_INVALIDO, pedirDeNovo);
    return () => window.removeEventListener(EVENTO_PIN_INVALIDO, pedirDeNovo);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro('');
    try {
      if (await verificarPin(pin.trim())) {
        salvarPin(pin.trim());
        setPin('');
        setEstado('liberado');
      } else {
        setErro('PIN incorreto.');
      }
    } catch (err: any) {
      setErro(err instanceof TypeError ? 'Servidor não respondeu. Tente de novo.' : err.message ?? 'Erro ao conferir PIN.');
    } finally {
      setEnviando(false);
    }
  }

  if (estado === 'liberado') return <>{children}</>;

  if (estado === 'verificando') {
    return (
      <div className="flex h-screen items-center justify-center bg-concrete-100 text-sm text-steel-400">
        Conectando ao servidor...
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-concrete-100 px-4">
      <form onSubmit={handleSubmit} className="panel w-full max-w-xs space-y-4 p-6">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="h-9 w-9" />
          <h1 className="font-display text-lg font-bold text-steel-900">Endereçamento de Estoque</h1>
        </div>
        <label className="block text-sm text-ink-600">
          <span className="mb-1 block">PIN de acesso</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            autoFocus
            required
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="input w-full"
          />
        </label>
        {erro && <p className="text-sm text-signal-red600">{erro}</p>}
        <button type="submit" disabled={enviando || !pin.trim()} className="btn-primary w-full">
          {enviando ? 'Conferindo...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
