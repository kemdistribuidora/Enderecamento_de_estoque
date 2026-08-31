import { useEffect, useMemo, useState } from 'react';
import { buscarMapaEnderecos, buscarProdutos, criarProduto, ocuparEndereco } from '../api/client';
import { EnderecoComStatus, ProdutoComPosicoes } from '../types';
import ModalEscolherNoMapa from '../components/ModalEscolherNoMapa';
import EtiquetaModal, { DadosEtiqueta } from '../components/EtiquetaModal';

const FORM_INICIAL = {
  codigo: '',
  nome: '',
  codigo_barras: '',
  peso_caixa: '',
  validade: '',
  lote: '',
  enderecoId: '',
  quantidade: '',
};

type Status = { tipo: 'sucesso' | 'erro' | 'info'; texto: string } | null;

export default function CadastroPage() {
  const [form, setForm] = useState(FORM_INICIAL);
  const [enderecosLivres, setEnderecosLivres] = useState<EnderecoComStatus[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [mapaAberto, setMapaAberto] = useState(false);

  const [buscaProduto, setBuscaProduto] = useState('');
  const [sugestoes, setSugestoes] = useState<ProdutoComPosicoes[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoComPosicoes | null>(null);
  const [dadosEtiqueta, setDadosEtiqueta] = useState<DadosEtiqueta | null>(null);
  const [etiquetaAberta, setEtiquetaAberta] = useState(false);

  useEffect(() => {
    carregarEnderecosLivres();
  }, []);

  useEffect(() => {
    if (produtoSelecionado || buscaProduto.trim().length < 2) {
      setSugestoes([]);
      return;
    }
    const termo = buscaProduto.trim();
    const timer = setTimeout(() => {
      buscarProdutos(termo).then(setSugestoes);
    }, 250);
    return () => clearTimeout(timer);
  }, [buscaProduto, produtoSelecionado]);

  function selecionarProduto(p: ProdutoComPosicoes) {
    setProdutoSelecionado(p);
    setForm((f) => ({
      ...f,
      codigo: p.codigo,
      nome: p.nome,
      codigo_barras: p.codigo_barras,
      peso_caixa: p.peso_caixa != null ? String(p.peso_caixa) : '',
    }));
    setBuscaProduto('');
    setSugestoes([]);
  }

  function limparSelecao() {
    setProdutoSelecionado(null);
    setForm((f) => ({ ...f, codigo: '', nome: '', codigo_barras: '', peso_caixa: '' }));
  }

  function carregarEnderecosLivres() {
    buscarMapaEnderecos().then((lista) => {
      setEnderecosLivres(lista.filter((e) => e.status === 'livre'));
    });
  }

  const enderecosPorCorredor = useMemo(() => {
    const grupos: Record<string, EnderecoComStatus[]> = {};
    for (const e of enderecosLivres) {
      const chave = `${e.corredor} ${e.lado}`;
      if (!grupos[chave]) grupos[chave] = [];
      grupos[chave].push(e);
    }
    return grupos;
  }, [enderecosLivres]);

  function atualizarCampo(campo: keyof typeof form, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    const quantidade = Number(form.quantidade);
    const enderecoId = Number(form.enderecoId);

    if (!form.enderecoId || !quantidade || quantidade <= 0 || !form.validade || !form.lote.trim()) {
      setStatus({ tipo: 'erro', texto: 'Selecione um endereço, quantidade válida, validade e lote.' });
      return;
    }

    setSalvando(true);
    try {
      let produtoId: number;

      const pesoCaixa = form.peso_caixa.trim() ? Number(form.peso_caixa) : null;

      if (produtoSelecionado) {
        produtoId = produtoSelecionado.id;
      } else {
        try {
          const produtoCriado = await criarProduto({
            codigo: form.codigo,
            nome: form.nome,
            codigo_barras: form.codigo_barras,
            peso_caixa: pesoCaixa,
          });
          produtoId = produtoCriado.id;
        } catch (err: any) {
          if (String(err.message).includes('ja cadastrado')) {
            const existentes = await buscarProdutos(form.codigo);
            const existente = existentes.find((p) => p.codigo.toLowerCase() === form.codigo.toLowerCase());
            if (!existente) throw new Error('Código já cadastrado, mas não foi possível localizar o produto existente.');
            produtoId = existente.id;
            setStatus({ tipo: 'info', texto: `Código já cadastrado — adicionando estoque em "${existente.nome}".` });
          } else {
            throw err;
          }
        }
      }

      const enderecoOcupado = enderecosLivres.find((e) => e.id === enderecoId);
      const resultado = await ocuparEndereco(enderecoId, produtoId, quantidade, form.validade, form.lote.trim());

      setStatus({ tipo: 'sucesso', texto: `Produto adicionado na posição ${enderecoOcupado?.codigo}.` });
      setDadosEtiqueta({
        enderecoCodigo: enderecoOcupado?.codigo ?? '',
        produtoNome: form.nome,
        produtoCodigo: form.codigo,
        codigoBarras: form.codigo_barras,
        pesoCaixa: produtoSelecionado?.peso_caixa ?? pesoCaixa,
        quantidade,
        validade: form.validade,
        lote: form.lote.trim(),
        criadoEm: resultado.criado_em,
      });
      setEtiquetaAberta(true);
      setForm(FORM_INICIAL);
      setProdutoSelecionado(null);
      carregarEnderecosLivres();
    } catch (err: any) {
      setStatus({ tipo: 'erro', texto: err.message ?? 'Erro ao salvar.' });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="mb-4 text-lg font-semibold text-slate-800">Cadastro de Produto / Entrada em Estoque</h1>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <fieldset className="space-y-3">
          <legend className="mb-1 text-sm font-medium text-slate-600">Dados do produto</legend>

          {!produtoSelecionado && (
            <Campo label="Buscar produto existente (código ou nome)">
              <div className="relative">
                <input
                  value={buscaProduto}
                  onChange={(e) => setBuscaProduto(e.target.value)}
                  className="input"
                  placeholder="Digite código ou nome para localizar produto já cadastrado..."
                />
                {sugestoes.length > 0 && (
                  <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
                    {sugestoes.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => selecionarProduto(p)}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                        >
                          <span className="font-medium text-slate-800">{p.nome}</span>{' '}
                          <span className="text-slate-400">— {p.codigo}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Campo>
          )}

          {produtoSelecionado && (
            <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
              Produto existente selecionado — código de barras herdado automaticamente.{' '}
              <button type="button" onClick={limparSelecao} className="font-medium underline">
                Cadastrar produto novo
              </button>
            </p>
          )}

          <Campo label="Código">
            <input
              required
              readOnly={!!produtoSelecionado}
              value={form.codigo}
              onChange={(e) => atualizarCampo('codigo', e.target.value)}
              className={`input ${produtoSelecionado ? 'bg-slate-50 text-slate-500' : ''}`}
              placeholder="PRD0031"
            />
          </Campo>

          <Campo label="Nome">
            <input
              required
              readOnly={!!produtoSelecionado}
              value={form.nome}
              onChange={(e) => atualizarCampo('nome', e.target.value)}
              className={`input ${produtoSelecionado ? 'bg-slate-50 text-slate-500' : ''}`}
              placeholder="Arroz Branco 5kg"
            />
          </Campo>

          <Campo label="Código de barras">
            <input
              required
              readOnly={!!produtoSelecionado}
              value={form.codigo_barras}
              onChange={(e) => atualizarCampo('codigo_barras', e.target.value)}
              className={`input ${produtoSelecionado ? 'bg-slate-50 text-slate-500' : ''}`}
              placeholder="7890000000001"
            />
          </Campo>

          <Campo label="Peso por caixa (kg) — usado na etiqueta de pallet">
            <input
              type="number"
              step="0.01"
              min={0}
              readOnly={!!produtoSelecionado}
              value={form.peso_caixa}
              onChange={(e) => atualizarCampo('peso_caixa', e.target.value)}
              className={`input ${produtoSelecionado ? 'bg-slate-50 text-slate-500' : ''}`}
              placeholder="12.5"
            />
          </Campo>
        </fieldset>

        <fieldset className="space-y-3 border-t border-slate-100 pt-4">
          <legend className="mb-1 text-sm font-medium text-slate-600">Entrada em estoque</legend>

          <Campo label="Validade do lote">
            <input
              required
              type="date"
              value={form.validade}
              onChange={(e) => atualizarCampo('validade', e.target.value)}
              className="input"
            />
          </Campo>

          <Campo label="Lote">
            <input
              required
              value={form.lote}
              onChange={(e) => atualizarCampo('lote', e.target.value)}
              className="input"
              placeholder="LOTE-0001"
            />
          </Campo>

          <Campo label="Endereço (posição livre)">
            <div className="flex gap-2">
              <select
                required
                value={form.enderecoId}
                onChange={(e) => atualizarCampo('enderecoId', e.target.value)}
                className="input"
              >
                <option value="" disabled>
                  Selecione uma posição livre...
                </option>
                {Object.entries(enderecosPorCorredor).map(([chave, enderecos]) => (
                  <optgroup key={chave} label={`Corredor ${chave}`}>
                    {enderecos.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.codigo}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setMapaAberto(true)}
                className="shrink-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Escolher no mapa
              </button>
            </div>
          </Campo>

          <Campo label="Quantidade">
            <input
              required
              type="number"
              min={1}
              value={form.quantidade}
              onChange={(e) => atualizarCampo('quantidade', e.target.value)}
              className="input"
            />
          </Campo>
        </fieldset>

        {status && (
          <p
            className={`text-sm ${
              status.tipo === 'sucesso' ? 'text-green-700' : status.tipo === 'info' ? 'text-blue-700' : 'text-red-600'
            }`}
          >
            {status.texto}
          </p>
        )}

        {status?.tipo === 'sucesso' && dadosEtiqueta && !etiquetaAberta && (
          <button
            type="button"
            onClick={() => setEtiquetaAberta(true)}
            className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Imprimir etiqueta desse pallet
          </button>
        )}

        <button
          type="submit"
          disabled={salvando}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </form>

      {mapaAberto && (
        <ModalEscolherNoMapa
          onFechar={() => setMapaAberto(false)}
          onEscolher={(endereco) => {
            atualizarCampo('enderecoId', String(endereco.id));
            setMapaAberto(false);
          }}
        />
      )}

      {etiquetaAberta && dadosEtiqueta && (
        <EtiquetaModal dados={dadosEtiqueta} onClose={() => setEtiquetaAberta(false)} />
      )}
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
