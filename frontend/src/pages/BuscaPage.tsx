import { useEffect, useState } from 'react';
import { buscarProdutos } from '../api/client';
import { ProdutoComPosicoes } from '../types';
import SearchBar from '../components/SearchBar';
import ResultCard from '../components/ResultCard';
import PainelSeparacao from '../components/PainelSeparacao';

const DEBOUNCE_MS = 350;

type Posicao = ProdutoComPosicoes['posicoes'][number];

export default function BuscaPage() {
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState<ProdutoComPosicoes[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [separando, setSeparando] = useState<{ produto: ProdutoComPosicoes; posicao: Posicao } | null>(null);

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

  function recarregar() {
    if (!termo.trim()) return;
    buscarProdutos(termo).then(setResultados);
  }

  return (
    <div>
      <div className="mb-6 max-w-lg">
        <SearchBar onChange={setTermo} />
      </div>

      {separando && (
        <div className="mb-6">
          <PainelSeparacao
            produtoId={separando.produto.id}
            produtoNome={separando.produto.nome}
            produtoCodigo={separando.produto.codigo}
            enderecoId={separando.posicao.endereco_id}
            codigoEndereco={separando.posicao.codigo_endereco}
            setorId={separando.posicao.setor_id}
            quantidade={separando.posicao.quantidade}
            validade={separando.posicao.validade}
            lote={separando.posicao.lote}
            onFechar={() => setSeparando(null)}
            onConcluido={() => {
              setSeparando(null);
              recarregar();
            }}
          />
        </div>
      )}

      {carregando && <p className="text-sm text-slate-400">Buscando...</p>}

      {!carregando && buscou && resultados.length === 0 && (
        <p className="text-sm text-slate-400">Nenhum produto encontrado para "{termo}".</p>
      )}

      {!carregando && !buscou && (
        <p className="text-sm text-slate-400">Digite o código ou nome de um produto para buscar.</p>
      )}

      <div className="grid gap-3">
        {!carregando &&
          resultados.map((p) => (
            <ResultCard key={p.id} produto={p} onSeparar={(produto, posicao) => setSeparando({ produto, posicao })} />
          ))}
      </div>
    </div>
  );
}
