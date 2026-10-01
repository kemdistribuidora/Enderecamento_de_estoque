import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  buscarHistoricoImportacoes,
  buscarItensImportacao,
  confirmarImportacaoWinthor,
  ImportacaoResumo,
  PosicaoProduto,
  PreviaImportacao,
  previaImportacaoWinthor,
  StatusReconciliacao,
} from '../api/client';
import { formatarData, formatarDataHora } from '../utils/data';
import { formatarQtdCx } from '../utils/quantidade';

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

// Linha comum da tabela: serve tanto pra previa/resultado (tem delta, antes/depois e
// posicoes) quanto pra foto de um import antigo do historico (so o estado gravado).
interface LinhaTabela {
  codigo: string;
  nome: string;
  qt_por_cx: number | null;
  status: StatusReconciliacao;
  produto_novo?: boolean;
  cadastro_alterado?: boolean;
  saldo_anterior: number | null;
  saldo_novo: number;
  posicionado: number;
  nao_posicionado_antes?: number | null;
  nao_posicionado: number;
  sobra: number;
  posicoes?: PosicaoProduto[];
}

type Filtro = 'todos' | StatusReconciliacao;

const ROTULO_STATUS: Record<StatusReconciliacao, string> = {
  sobra: 'Sobra',
  entrou: 'Entrou',
  saiu: 'Saiu',
  novo: 'Primeiro saldo',
  sem_mudanca: 'Sem mudança',
};

const TAG_STATUS: Record<StatusReconciliacao, string> = {
  sobra: 'tag-red',
  entrou: 'tag-green',
  saiu: 'tag-amber',
  novo: 'tag-neutral',
  sem_mudanca: 'tag-neutral',
};

const MAX_LINHAS_TELA = 500;

export default function ImportacaoPage() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [conteudo, setConteudo] = useState('');
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');
  const [previa, setPrevia] = useState<PreviaImportacao | null>(null);
  // preenchido depois de confirmar: a tabela passa a mostrar o que foi gravado
  const [importacaoGravadaId, setImportacaoGravadaId] = useState<number | null>(null);
  const [historico, setHistorico] = useState<ImportacaoResumo[]>([]);
  // muda a key do input file pra limpar o arquivo escolhido no Cancelar
  const [versaoInput, setVersaoInput] = useState(0);

  function carregarHistorico() {
    buscarHistoricoImportacoes()
      .then(setHistorico)
      .catch(() => setHistorico([]));
  }

  useEffect(carregarHistorico, []);

  function selecionarArquivo(novo: File | null) {
    setArquivo(novo);
    setPrevia(null);
    setConteudo('');
    setImportacaoGravadaId(null);
    setErro('');
  }

  async function handleAnalisar() {
    if (!arquivo) return;
    setProcessando(true);
    setErro('');
    setPrevia(null);
    setImportacaoGravadaId(null);
    try {
      const texto = await lerArquivoTexto(arquivo);
      setPrevia(await previaImportacaoWinthor(texto));
      setConteudo(texto);
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao analisar arquivo.');
    } finally {
      setProcessando(false);
    }
  }

  async function handleConfirmar() {
    if (!arquivo || !conteudo) return;
    setProcessando(true);
    setErro('');
    try {
      // servidor recalcula tudo na hora de gravar (estoque pode ter mudado desde a previa)
      const resultado = await confirmarImportacaoWinthor(conteudo, arquivo.name);
      setPrevia(resultado.previa);
      setImportacaoGravadaId(resultado.importacao_id);
      carregarHistorico();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao gravar importação.');
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-steel-600/25 pb-4">
        <h1 className="page-title">Importar dados do Winthor</h1>
        <p className="mt-1 text-sm text-ink-600">
          O saldo do Winthor é a verdade: para cada produto do arquivo, posicionado + não posicionado = saldo do arquivo.
        </p>
      </div>

      <div className="panel max-w-2xl p-5">
        <h2 className="font-display text-lg font-bold text-steel-900">Produtos + saldo</h2>
        <p className="mt-1 text-sm text-ink-600">
          Arquivo do D860: <code className="data-code">codigo;nome;codigo_barras;qt_por_cx;filial;codigo;saldo</code>. Pode ser
          parcial (filtrado por produto ou fornecedor): produto fora do arquivo não é alterado.
        </p>

        <div className="mt-3 space-y-3">
          <CampoArquivo key={versaoInput} label="Arquivo Winthor" onSelecionar={selecionarArquivo} arquivo={arquivo} />
        </div>

        <button type="button" onClick={handleAnalisar} disabled={!arquivo || processando} className="mt-3 btn-primary">
          {processando && !previa ? 'Analisando...' : 'Analisar arquivo'}
        </button>
        <p className="mt-2 text-xs text-steel-400">Analisar não grava nada. Você confere a prévia e depois confirma.</p>

        {erro && <p className="mt-3 text-sm text-signal-red600">{erro}</p>}
      </div>

      {previa && (
        <ResultadoReconciliacao
          previa={previa}
          gravadaId={importacaoGravadaId}
          processando={processando}
          onConfirmar={handleConfirmar}
          onCancelar={() => {
            selecionarArquivo(null);
            setVersaoInput((v) => v + 1);
          }}
        />
      )}

      <HistoricoImportacoes historico={historico} />
    </div>
  );
}

function ResultadoReconciliacao({
  previa,
  gravadaId,
  processando,
  onConfirmar,
  onCancelar,
}: {
  previa: PreviaImportacao;
  gravadaId: number | null;
  processando: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const t = previa.totais;

  return (
    <div className="space-y-4">
      {gravadaId != null ? (
        <div className="rounded-tag border border-signal-green600/30 bg-signal-green100 p-4 text-sm text-signal-green600">
          <p className="font-semibold">Importação #{gravadaId} gravada.</p>
          <p className="mt-1">
            {t.entrou + t.novo > 0 && (
              <>
                Saldo a posicionar atualizado.{' '}
                <Link to="/posicionamento" className="font-medium underline">
                  Ir para posicionamento
                </Link>
                .{' '}
              </>
            )}
            {t.sobra > 0 && <>Há {t.sobra} produto(s) com sobra para dar baixa na posição.</>}
          </p>
        </div>
      ) : (
        <div className="rounded-tag border border-signal-amber600/30 bg-signal-amber100 p-4 text-sm text-signal-amber600">
          <p className="font-semibold">Prévia: nada foi gravado ainda.</p>
        </div>
      )}

      <div className="panel max-w-7xl p-5">
        <p className="text-sm text-ink-600">
          {t.linhas_lidas} linha(s) lida(s) · <strong className="text-ink-900">{t.produtos_arquivo}</strong> produto(s) no arquivo
          {t.produtos_novos > 0 && <> ({t.produtos_novos} novo(s) no cadastro)</>}
          {' · '}
          {t.produtos_fora_arquivo} produto(s) do sistema não estavam no arquivo (não alterados)
        </p>

        {t.sobra > 0 && (
          <div className="mt-3 rounded-tag border border-signal-red600/30 bg-signal-red100 p-3 text-sm text-signal-red600">
            <p className="font-semibold">
              {t.sobra} produto(s) com SOBRA: o posicionado é maior que o saldo do Winthor.
            </p>
            <p className="mt-1">
              Algo posicionado já saiu e não foi retirado. O sistema não mexe nas posições: confira a posição e dê a baixa (total
              ou parcial) na quantidade da sobra. As posições aparecem da validade mais antiga para a mais nova.
            </p>
          </div>
        )}

        {previa.bloqueadas.length > 0 && (
          <details className="mt-3 rounded-tag border border-signal-red600/30 bg-white p-3 text-sm" open={previa.itens.length === 0}>
            <summary className="cursor-pointer font-semibold text-signal-red600">
              {previa.bloqueadas.length} linha(s) bloqueada(s): não serão gravadas
            </summary>
            <ul className="mt-2 max-h-60 space-y-1 overflow-auto text-xs text-ink-600">
              {previa.bloqueadas.map((b, i) => (
                <li key={i}>
                  <span className="font-semibold">Linha {b.linha}:</span> {b.motivo}{' '}
                  <code className="data-code text-steel-400">{b.conteudo}</code>
                </li>
              ))}
            </ul>
          </details>
        )}

        {previa.avisos.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-signal-amber600">{previa.avisos.length} aviso(s)</summary>
            <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-ink-600">
              {previa.avisos.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </details>
        )}

        {gravadaId == null && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={onConfirmar} disabled={processando || previa.itens.length === 0} className="btn-primary">
              {processando ? 'Gravando...' : `Confirmar importação (${previa.itens.length} produtos)`}
            </button>
            <button type="button" onClick={onCancelar} disabled={processando} className="btn-secondary">
              Cancelar
            </button>
            {previa.bloqueadas.length > 0 && (
              <span className="text-xs text-signal-red600">Linhas bloqueadas ficam de fora. Corrija no Winthor e suba de novo.</span>
            )}
          </div>
        )}
      </div>

      <TabelaReconciliacao linhas={previa.itens} totais={t} mostrarAntesDepois />
    </div>
  );
}

function TabelaReconciliacao({
  linhas,
  totais,
  mostrarAntesDepois,
}: {
  linhas: LinhaTabela[];
  totais: Record<StatusReconciliacao, number>;
  mostrarAntesDepois: boolean;
}) {
  const [filtro, setFiltro] = useState<Filtro>(totais.sobra > 0 ? 'sobra' : 'todos');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    setFiltro(totais.sobra > 0 ? 'sobra' : 'todos');
  }, [linhas]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return linhas.filter(
      (l) =>
        (filtro === 'todos' || l.status === filtro) &&
        (!termo || l.nome.toLowerCase().includes(termo) || l.codigo.toLowerCase().includes(termo))
    );
  }, [linhas, filtro, busca]);

  const opcoes: { valor: Filtro; rotulo: string; qtd: number }[] = [
    { valor: 'todos', rotulo: 'Todos', qtd: linhas.length },
    { valor: 'sobra', rotulo: ROTULO_STATUS.sobra, qtd: totais.sobra },
    { valor: 'entrou', rotulo: ROTULO_STATUS.entrou, qtd: totais.entrou },
    { valor: 'saiu', rotulo: ROTULO_STATUS.saiu, qtd: totais.saiu },
    { valor: 'novo', rotulo: ROTULO_STATUS.novo, qtd: totais.novo },
    { valor: 'sem_mudanca', rotulo: ROTULO_STATUS.sem_mudanca, qtd: totais.sem_mudanca },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {opcoes.map((o) => (
          <button
            key={o.valor}
            type="button"
            onClick={() => setFiltro(o.valor)}
            className={filtro === o.valor ? 'btn-primary' : 'btn-secondary'}
          >
            {o.rotulo} ({o.qtd})
          </button>
        ))}
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou código..."
          className="input max-w-xs"
        />
      </div>

      {filtradas.length === 0 ? (
        <p className="rounded-tag bg-concrete-100 p-4 text-sm text-ink-600">Nenhum produto neste filtro.</p>
      ) : (
        <div className="panel max-w-7xl overflow-x-auto">
          <table className="table-plate">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Status</th>
                <th>Saldo Winthor</th>
                <th>Posicionado</th>
                <th>Não posicionado</th>
                <th>Sobra</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.slice(0, MAX_LINHAS_TELA).map((l) => (
                <LinhaReconciliacao key={l.codigo} linha={l} mostrarAntesDepois={mostrarAntesDepois} />
              ))}
            </tbody>
          </table>
          {filtradas.length > MAX_LINHAS_TELA && (
            <p className="p-3 text-xs text-steel-400">
              Mostrando {MAX_LINHAS_TELA} de {filtradas.length}. Use a busca ou os filtros para achar um produto.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function LinhaReconciliacao({ linha: l, mostrarAntesDepois }: { linha: LinhaTabela; mostrarAntesDepois: boolean }) {
  const qtd = (v: number) => formatarQtdCx(v, l.qt_por_cx);
  const mudouSaldo = l.saldo_anterior != null && l.saldo_anterior !== l.saldo_novo;
  const mudouNaoPos = l.nao_posicionado_antes != null && l.nao_posicionado_antes !== l.nao_posicionado;

  return (
    <>
      <tr>
        <td className="!whitespace-normal">
          <span className="font-medium text-ink-900">{l.nome}</span> <span className="text-steel-400">({l.codigo})</span>
          {l.produto_novo && <span className="tag-neutral ml-2">novo no cadastro</span>}
          {l.cadastro_alterado && <span className="tag-neutral ml-2">cadastro atualizado</span>}
        </td>
        <td>
          <span className={TAG_STATUS[l.status]}>{ROTULO_STATUS[l.status]}</span>
        </td>
        <td className="data-code">
          {mudouSaldo && (
            <span className="text-steel-400">
              {qtd(l.saldo_anterior!)} {'→'}{' '}
            </span>
          )}
          <span className="font-medium">{qtd(l.saldo_novo)}</span>
        </td>
        <td className="data-code">{qtd(l.posicionado)}</td>
        <td className="data-code">
          {mostrarAntesDepois && mudouNaoPos && (
            <span className="text-steel-400">
              {qtd(l.nao_posicionado_antes!)} {'→'}{' '}
            </span>
          )}
          <span className={l.nao_posicionado > 0 ? 'font-medium text-signal-amber600' : ''}>{qtd(l.nao_posicionado)}</span>
        </td>
        <td className="data-code">
          {l.sobra > 0 ? <span className="font-semibold text-signal-red600">{qtd(l.sobra)}</span> : <span className="text-steel-400">0</span>}
        </td>
      </tr>
      {l.status === 'sobra' && l.posicoes && l.posicoes.length > 0 && (
        <tr>
          <td colSpan={6} className="!whitespace-normal bg-signal-red100/40 text-xs text-ink-600">
            <span className="font-semibold text-signal-red600">Retirar {qtd(l.sobra)} de:</span>{' '}
            {l.posicoes.map((p, i) => (
              <span key={p.endereco_codigo}>
                {i > 0 && ' · '}
                <span className="data-code font-semibold text-ink-900">{p.endereco_codigo}</span> {qtd(p.quantidade)} (val.{' '}
                {formatarData(p.validade)}
                {p.lote ? `, lote ${p.lote}` : ''})
              </span>
            ))}
          </td>
        </tr>
      )}
    </>
  );
}

function HistoricoImportacoes({ historico }: { historico: ImportacaoResumo[] }) {
  const [aberta, setAberta] = useState<ImportacaoResumo | null>(null);
  const [linhas, setLinhas] = useState<LinhaTabela[]>([]);
  const [carregando, setCarregando] = useState(false);

  async function abrir(imp: ImportacaoResumo) {
    if (aberta?.id === imp.id) {
      setAberta(null);
      return;
    }
    setAberta(imp);
    setCarregando(true);
    try {
      const itens = await buscarItensImportacao(imp.id);
      setLinhas(itens.map((i) => ({ ...i, qt_por_cx: null })));
    } finally {
      setCarregando(false);
    }
  }

  if (historico.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="font-display text-lg font-bold text-steel-900">Importações anteriores</h2>
      <div className="panel max-w-7xl overflow-x-auto">
        <table className="table-plate">
          <thead>
            <tr>
              <th>#</th>
              <th>Data</th>
              <th>Arquivo</th>
              <th>Produtos</th>
              <th>Entrou</th>
              <th>Saiu</th>
              <th>Sobra</th>
              <th>Bloqueadas</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {historico.map((h) => (
              <tr key={h.id}>
                <td className="data-code">{h.id}</td>
                <td>{formatarDataHora(h.criado_em)}</td>
                <td className="max-w-xs truncate" title={h.nome_arquivo ?? ''}>
                  {h.nome_arquivo ?? '—'}
                </td>
                <td className="data-code">{h.produtos_arquivo}</td>
                <td className="data-code">{h.entrou}</td>
                <td className="data-code">{h.saiu}</td>
                <td className="data-code">{h.sobra > 0 ? <span className="font-semibold text-signal-red600">{h.sobra}</span> : 0}</td>
                <td className="data-code">{h.linhas_bloqueadas}</td>
                <td>
                  <button type="button" onClick={() => abrir(h)} className="btn-secondary">
                    {aberta?.id === h.id ? 'Fechar' : 'Ver'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {aberta && (
        <div className="space-y-2">
          <p className="text-sm text-ink-600">
            Foto da importação #{aberta.id} no momento em que foi gravada (quantidades em UN).
          </p>
          {carregando ? (
            <p className="text-sm text-steel-400">Carregando...</p>
          ) : (
            <TabelaReconciliacao linhas={linhas} totais={aberta} mostrarAntesDepois={false} />
          )}
        </div>
      )}
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
      <span className="mb-1 block font-medium text-ink-600">{label}</span>
      <div className="flex items-center gap-2 border-2 border-dashed border-steel-400 bg-white p-3 hover:border-rust-600 hover:bg-rust-100/30">
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={(e) => onSelecionar(e.target.files?.[0] ?? null)}
          className="text-sm text-ink-600 file:mr-3 file:rounded-tag file:border-0 file:bg-steel-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-steel-700 hover:file:bg-concrete-200"
        />
        {arquivo && <span className="text-xs text-steel-400">{arquivo.name}</span>}
      </div>
    </label>
  );
}
