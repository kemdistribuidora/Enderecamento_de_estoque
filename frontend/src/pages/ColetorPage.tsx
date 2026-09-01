import { useState } from 'react';
import {
  buscarEnderecoPorCodigo,
  buscarProdutoDetalhe,
  buscarProdutoPorCodigoBarras,
  liberarEndereco,
  ocuparEndereco,
} from '../api/client';
import { EnderecoComStatus, Produto, ProdutoComPosicoes } from '../types';
import ScannerInput from '../components/ScannerInput';

type Modo = 'entrada' | 'saida';

export default function ColetorPage() {
  const [modo, setModo] = useState<Modo>('entrada');

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">Coletor</h1>
        <p className="mt-1 text-sm text-slate-500">
          Entrada e saída via leitor de código de barras (coletor USB/RF) ou câmera do celular.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setModo('entrada')}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            modo === 'entrada' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          Entrada
        </button>
        <button
          type="button"
          onClick={() => setModo('saida')}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            modo === 'saida' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          Saída
        </button>
      </div>

      {modo === 'entrada' ? <ColetorEntrada /> : <ColetorSaida />}
    </div>
  );
}

function ColetorEntrada() {
  const [produto, setProduto] = useState<Produto | null>(null);
  const [endereco, setEndereco] = useState<EnderecoComStatus | null>(null);
  const [quantidade, setQuantidade] = useState('');
  const [validade, setValidade] = useState('');
  const [lote, setLote] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  function reiniciar() {
    setProduto(null);
    setEndereco(null);
    setQuantidade('');
    setValidade('');
    setLote('');
    setErro('');
  }

  async function handleScanProduto(codigo: string) {
    setErro('');
    try {
      const p = await buscarProdutoPorCodigoBarras(codigo);
      setProduto(p);
    } catch (err: any) {
      setErro(err.message ?? 'Produto não encontrado para esse código.');
    }
  }

  async function handleScanEndereco(codigo: string) {
    setErro('');
    try {
      const e = await buscarEnderecoPorCodigo(codigo);
      if (e.status === 'ocupado') {
        setErro(`Endereço ${e.codigo} já está ocupado. Libere antes de ocupar novamente.`);
        return;
      }
      setEndereco(e);
    } catch (err: any) {
      setErro(err.message ?? 'Endereço não encontrado para esse código.');
    }
  }

  async function handleConfirmar() {
    const qtd = Number(quantidade);
    if (!produto || !endereco || !qtd || qtd <= 0 || !validade || !lote.trim()) {
      setErro('Quantidade válida, validade e lote são obrigatórios.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await ocuparEndereco(endereco.id, produto.id, qtd, validade, lote.trim());
      reiniciar();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao confirmar entrada.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      {!produto && (
        <Campo label="1. Escaneie o produto">
          <ScannerInput onScan={handleScanProduto} placeholder="Código de barras do produto..." />
        </Campo>
      )}

      {produto && (
        <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
          <span className="font-medium">{produto.nome}</span> — {produto.codigo}
          <button type="button" onClick={reiniciar} className="ml-2 underline">
            trocar
          </button>
        </div>
      )}

      {produto && !endereco && (
        <Campo label="2. Escaneie o endereço">
          <ScannerInput onScan={handleScanEndereco} placeholder="Código do endereço..." />
        </Campo>
      )}

      {produto && endereco && (
        <>
          <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Posição escolhida: <span className="font-medium">{endereco.codigo}</span>
            <button type="button" onClick={() => setEndereco(null)} className="ml-2 underline text-slate-500">
              trocar
            </button>
          </div>

          <Campo label="Quantidade">
            <input
              type="number"
              min={1}
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              className="input"
            />
          </Campo>

          <Campo label="Validade do lote">
            <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} className="input" />
          </Campo>

          <Campo label="Lote">
            <input value={lote} onChange={(e) => setLote(e.target.value)} className="input" placeholder="LOTE-0001" />
          </Campo>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <button
            type="button"
            onClick={handleConfirmar}
            disabled={salvando}
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {salvando ? 'Confirmando...' : 'Confirmar entrada'}
          </button>
        </>
      )}

      {erro && !endereco && <p className="text-sm text-red-600">{erro}</p>}
    </div>
  );
}

function ColetorSaida() {
  const [posicoes, setPosicoes] = useState<ProdutoComPosicoes['posicoes'] | null>(null);
  const [endereco, setEndereco] = useState<EnderecoComStatus | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  function reiniciar() {
    setPosicoes(null);
    setEndereco(null);
    setErro('');
  }

  async function selecionarPosicao(codigoEndereco: string) {
    setErro('');
    try {
      const e = await buscarEnderecoPorCodigo(codigoEndereco);
      if (e.status === 'livre') {
        setErro(`Endereço ${e.codigo} já está livre.`);
        return;
      }
      setEndereco(e);
    } catch (err: any) {
      setErro(err.message ?? 'Endereço não encontrado para esse código.');
    }
  }

  async function handleScanProduto(codigo: string) {
    setErro('');
    try {
      const produto = await buscarProdutoPorCodigoBarras(codigo);
      const detalhe = await buscarProdutoDetalhe(produto.id);
      if (detalhe.posicoes.length === 0) {
        setErro(`${produto.nome} não está ocupando nenhuma posição.`);
        return;
      }
      if (detalhe.posicoes.length === 1) {
        await selecionarPosicao(detalhe.posicoes[0].codigo_endereco);
        return;
      }
      setPosicoes(detalhe.posicoes);
    } catch (err: any) {
      setErro(err.message ?? 'Produto não encontrado para esse código.');
    }
  }

  async function handleConfirmar() {
    if (!endereco) return;
    setSalvando(true);
    setErro('');
    try {
      await liberarEndereco(endereco.id);
      reiniciar();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao liberar posição.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      {!posicoes && !endereco && (
        <Campo label="Escaneie o código de barras do produto">
          <ScannerInput onScan={handleScanProduto} placeholder="Código de barras..." />
        </Campo>
      )}

      {posicoes && !endereco && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-600">
            Produto encontrado em {posicoes.length} posições — escolha qual dar saída:
          </p>
          {posicoes.map((p) => (
            <button
              key={p.endereco_id}
              type="button"
              onClick={() => selecionarPosicao(p.codigo_endereco)}
              className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <span className="font-medium text-slate-800">{p.codigo_endereco}</span>
              <span className="text-slate-500">
                qtd {p.quantidade} · lote {p.lote ?? '—'} · val. {p.validade}
              </span>
            </button>
          ))}
          <button type="button" onClick={reiniciar} className="text-sm text-slate-500 underline">
            cancelar
          </button>
        </div>
      )}

      {endereco && endereco.produto && (
        <>
          <dl className="space-y-2 text-sm">
            <Row label="Posição" value={endereco.codigo} />
            <Row label="Produto" value={endereco.produto.nome} />
            <Row label="Código" value={endereco.produto.codigo} />
            <Row label="Quantidade" value={String(endereco.produto.quantidade)} />
            <Row label="Validade do lote" value={endereco.produto.validade} />
            <Row label="Lote" value={endereco.produto.lote ?? '—'} />
          </dl>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={reiniciar}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmar}
              disabled={salvando}
              className="flex-1 rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {salvando ? 'Liberando...' : 'Confirmar liberação'}
            </button>
          </div>
        </>
      )}

      {erro && !endereco && !posicoes && <p className="text-sm text-red-600">{erro}</p>}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-slate-100 pb-1">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}
