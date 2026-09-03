import { useState } from 'react';
import { Link } from 'react-router-dom';
import { importarProdutosCsv, importarSaldoCsv, ResultadoImportacao } from '../api/client';

// D860 (Delphi/Winthor) costuma exportar em Windows-1252, nao UTF-8 -- se ler fixo
// como UTF-8 (File.text()), acento vira lixo (ex: "AÇUCAR" -> "A�UCAR"). Tenta UTF-8
// estrito primeiro; byte invalido nessa leitura indica que e Windows-1252.
async function lerArquivoTexto(arquivo: File): Promise<string> {
  const buffer = await arquivo.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

function juntarResultados(a: ResultadoImportacao, b: ResultadoImportacao): ResultadoImportacao {
  return {
    ok: a.ok + b.ok,
    falhas: a.falhas + b.falhas,
    avisos: [...a.avisos, ...b.avisos],
    produtosComSaldo: [...a.produtosComSaldo, ...b.produtosComSaldo],
  };
}

export default function ImportacaoPage() {
  const [arquivoProdutos, setArquivoProdutos] = useState<File | null>(null);
  const [arquivoSaldo, setArquivoSaldo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);

  async function handleImportar() {
    if (!arquivoProdutos) return;
    setEnviando(true);
    setErro('');
    setResultado(null);
    try {
      const conteudoProdutos = await lerArquivoTexto(arquivoProdutos);
      let combinado = await importarProdutosCsv(conteudoProdutos);

      if (arquivoSaldo) {
        const conteudoSaldo = await lerArquivoTexto(arquivoSaldo);
        const resultadoSaldo = await importarSaldoCsv(conteudoSaldo);
        combinado = juntarResultados(combinado, resultadoSaldo);
      }

      setResultado(combinado);
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao importar arquivo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">Importar dados do Winthor</h1>
        <p className="mt-1 text-sm text-slate-500">Arquivos exportados pela rotina D860, sem precisar abrir no Excel.</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-medium text-slate-800">Produtos + saldo</h2>
        <p className="mt-1 text-sm text-slate-500">
          Produtos: <code>codigo;nome;codigo_barras</code>. Saldo (opcional): <code>filial;codigo;saldo</code>.
        </p>

        <div className="mt-3 space-y-3">
          <CampoArquivo label="Arquivo de produtos (obrigatório)" onSelecionar={setArquivoProdutos} arquivo={arquivoProdutos} />
          <CampoArquivo label="Arquivo de saldo (opcional)" onSelecionar={setArquivoSaldo} arquivo={arquivoSaldo} />
        </div>

        <button
          type="button"
          onClick={handleImportar}
          disabled={!arquivoProdutos || enviando}
          className="mt-3 rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {enviando ? 'Importando...' : 'Importar'}
        </button>

        {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}

        {resultado && (
          <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm">
            <p className="text-green-700">{resultado.ok} registro(s) gravado(s).</p>
            {resultado.falhas > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-amber-700">{resultado.falhas} linha(s) ignorada(s) — ver detalhes</summary>
                <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-slate-500">
                  {resultado.avisos.map((aviso, i) => (
                    <li key={i}>{aviso}</li>
                  ))}
                </ul>
              </details>
            )}
            {resultado.produtosComSaldo.length > 0 && (
              <p className="mt-2 text-blue-700">
                {resultado.produtosComSaldo.length} produto(s) vieram com saldo {'>'} 0.{' '}
                <Link to="/posicionamento" className="font-medium underline">
                  Ir para posicionamento
                </Link>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CampoArquivo({
  label,
  arquivo,
  onSelecionar,
}: {
  label: string;
  arquivo: File | null;
  onSelecionar: (arquivo: File | null) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-600">{label}</span>
      <input
        type="file"
        accept=".csv,text/csv,text/plain"
        onChange={(e) => onSelecionar(e.target.files?.[0] ?? null)}
        className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
      />
      {arquivo && <span className="ml-2 text-xs text-slate-400">{arquivo.name}</span>}
    </label>
  );
}
