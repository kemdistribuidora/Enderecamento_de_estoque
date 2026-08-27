import { useState } from 'react';
import { importarProdutosCsv, importarSaldoCsv, ResultadoImportacao } from '../api/client';

type Etapa = {
  titulo: string;
  descricao: string;
  placeholder: string;
  importar: (csv: string) => Promise<ResultadoImportacao>;
};

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

const ETAPAS: Etapa[] = [
  {
    titulo: '1. Produtos',
    descricao: 'Arquivo do D860 com colunas codigo;nome;codigo_barras, sem cabeçalho. Importe este primeiro.',
    placeholder: 'produtos.csv',
    importar: importarProdutosCsv,
  },
  {
    titulo: '2. Saldo (filial 1)',
    descricao:
      'Arquivo do D860 com colunas filial;codigo;saldo, sem cabeçalho. Precisa dos produtos já importados — código não cadastrado é ignorado.',
    placeholder: 'saldo.csv',
    importar: importarSaldoCsv,
  },
];

export default function ImportacaoPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">Importar dados do Winthor</h1>
        <p className="mt-1 text-sm text-slate-500">
          Anexe os arquivos exportados pela rotina D860. Não precisa abrir os arquivos no Excel — só selecionar e importar.
        </p>
      </div>

      {ETAPAS.map((etapa) => (
        <CardImportacao key={etapa.titulo} etapa={etapa} />
      ))}
    </div>
  );
}

function CardImportacao({ etapa }: { etapa: Etapa }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [erro, setErro] = useState('');

  async function handleImportar() {
    if (!arquivo) return;
    setEnviando(true);
    setErro('');
    setResultado(null);
    try {
      const conteudo = await lerArquivoTexto(arquivo);
      setResultado(await etapa.importar(conteudo));
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao importar arquivo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="font-medium text-slate-800">{etapa.titulo}</h2>
      <p className="mt-1 text-sm text-slate-500">{etapa.descricao}</p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={(e) => {
            setArquivo(e.target.files?.[0] ?? null);
            setResultado(null);
            setErro('');
          }}
          className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
        />
        <button
          type="button"
          onClick={handleImportar}
          disabled={!arquivo || enviando}
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {enviando ? 'Importando...' : 'Importar'}
        </button>
      </div>

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
        </div>
      )}
    </div>
  );
}
