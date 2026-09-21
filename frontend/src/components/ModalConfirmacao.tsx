import { ReactNode, useEffect } from 'react';

interface Props {
  titulo: string;
  children: ReactNode;
  textoConfirmar: string;
  textoCarregando?: string;
  carregando?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

// Substitui window.confirm() (caixa nativa do navegador) por um modal no padrao do sistema.
// z-[60] pra ficar acima de outros modais (ProdutoModal, ModalEscolherNoMapa usam z-50).
export default function ModalConfirmacao({
  titulo,
  children,
  textoConfirmar,
  textoCarregando = 'Aguarde...',
  carregando = false,
  onConfirmar,
  onCancelar,
}: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !carregando) onCancelar();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [carregando, onCancelar]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      // stopPropagation: modal costuma abrir dentro de outro modal, e o clique no fundo nao pode fechar o pai
      onClick={(e) => {
        e.stopPropagation();
        if (!carregando) onCancelar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-soft border border-steel-600 bg-white p-5 shadow-lg shadow-steel-900/20"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 font-display text-xl font-bold text-steel-900">{titulo}</h3>

        <div className="text-sm text-ink-900">{children}</div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancelar} disabled={carregando} className="btn-secondary">
            Cancelar
          </button>
          <button type="button" onClick={onConfirmar} disabled={carregando} autoFocus className="btn-primary">
            {carregando ? textoCarregando : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
