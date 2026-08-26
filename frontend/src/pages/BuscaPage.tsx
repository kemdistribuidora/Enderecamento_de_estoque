import { useEffect, useState } from 'react';
import { buscarProdutos } from '../api/client';
import { ProdutoComPosicoes } from '../types';
import SearchBar from '../components/SearchBar';
import ResultCard from '../components/ResultCard';

const DEBOUNCE_MS = 350;

export default function BuscaPage() {
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState<ProdutoComPosicoes[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [buscou, setBuscou] = useState(false);

  useEffect(() => {
    if (!termo.trim()) {
      setResultados([]);
      setBuscou(false);
      return;
    }

    setCarregando(true);
    const timer = setTimeout(() => {
      buscarProdutos(termo)
        .then((r) => {
          setResultados(r);
          setBuscou(true);
        })
        .finally(() => setCarregando(false));
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [termo]);

  return (
    <div>
      <div className="mb-6 max-w-lg">
        <SearchBar onChange={setTermo} />
      </div>

      {carregando && <p className="text-sm text-slate-400">Buscando...</p>}

      {!carregando && buscou && resultados.length === 0 && (
        <p className="text-sm text-slate-400">Nenhum produto encontrado para "{termo}".</p>
      )}

      {!carregando && !buscou && (
        <p className="text-sm text-slate-400">Digite o código ou nome de um produto para buscar.</p>
      )}

      <div className="grid gap-3">
        {!carregando && resultados.map((p) => <ResultCard key={p.id} produto={p} />)}
      </div>
    </div>
  );
}
