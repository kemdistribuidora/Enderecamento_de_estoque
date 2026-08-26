import { useEffect, useMemo, useState } from 'react';
import { buscarMapaEnderecos, buscarMapaSetor, buscarProdutos, buscarSetores, criarProduto, ocuparEndereco } from '../api/client';
import { EnderecoComStatus, MapaSetor, Setor } from '../types';
import MapaSetorView from '../components/MapaSetorView';

const FORM_INICIAL = {
  codigo: '',
  nome: '',
  descricao: '',
  codigo_barras: '',
  validade: '',
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

  useEffect(() => {
    carregarEnderecosLivres();
  }, []);

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

    if (!form.enderecoId || !quantidade || quantidade <= 0) {
      setStatus({ tipo: 'erro', texto: 'Selecione um endereço e informe uma quantidade válida.' });
      return;
    }

    setSalvando(true);
    try {
      let produtoId: number;

      try {
        const produtoCriado = await criarProduto({
          codigo: form.codigo,
          nome: form.nome,
          descricao: form.descricao,
          codigo_barras: form.codigo_barras,
          validade: form.validade,
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

      await ocuparEndereco(enderecoId, produtoId, quantidade);

      setStatus({ tipo: 'sucesso', texto: `Produto adicionado na posição ${enderecosLivres.find((e) => e.id === enderecoId)?.codigo}.` });
      setForm(FORM_INICIAL);
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

          <Campo label="Código">
            <input
              required
              value={form.codigo}
              onChange={(e) => atualizarCampo('codigo', e.target.value)}
              className="input"
              placeholder="PRD0031"
            />
          </Campo>

          <Campo label="Nome">
            <input
              required
              value={form.nome}
              onChange={(e) => atualizarCampo('nome', e.target.value)}
              className="input"
              placeholder="Arroz Branco 5kg"
            />
          </Campo>

          <Campo label="Descrição">
            <input
              value={form.descricao}
              onChange={(e) => atualizarCampo('descricao', e.target.value)}
              className="input"
            />
          </Campo>

          <Campo label="Código de barras">
            <input
              required
              value={form.codigo_barras}
              onChange={(e) => atualizarCampo('codigo_barras', e.target.value)}
              className="input"
              placeholder="7890000000001"
            />
          </Campo>

          <Campo label="Validade">
            <input
              required
              type="date"
              value={form.validade}
              onChange={(e) => atualizarCampo('validade', e.target.value)}
              className="input"
            />
          </Campo>
        </fieldset>

        <fieldset className="space-y-3 border-t border-slate-100 pt-4">
          <legend className="mb-1 text-sm font-medium text-slate-600">Entrada em estoque</legend>

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
    </div>
  );
}

function ModalEscolherNoMapa({
  onFechar,
  onEscolher,
}: {
  onFechar: () => void;
  onEscolher: (endereco: EnderecoComStatus) => void;
}) {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [setorAtivoId, setSetorAtivoId] = useState<number | null>(null);
  const [mapa, setMapa] = useState<MapaSetor | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    buscarSetores().then((lista) => {
      setSetores(lista);
      setSetorAtivoId(lista[0]?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (setorAtivoId === null) return;
    setCarregando(true);
    buscarMapaSetor(setorAtivoId)
      .then(setMapa)
      .finally(() => setCarregando(false));
  }, [setorAtivoId]);

  function handleSelect(endereco: EnderecoComStatus) {
    if (endereco.status !== 'livre') {
      setAviso(`Posição ${endereco.codigo} já está ocupada.`);
      return;
    }
    onEscolher(endereco);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onFechar}>
      <div
        className="flex h-[92vh] w-[95vw] max-w-5xl flex-col rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-700">Escolher posição no mapa</h3>
          <button onClick={onFechar} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {setores.map((s) => (
            <button
              key={s.id}
              onClick={() => setSetorAtivoId(s.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                setorAtivoId === s.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {s.nome}
            </button>
          ))}
        </div>

        {aviso && <p className="mb-2 text-sm text-red-600">{aviso}</p>}

        <div className="flex-1 overflow-auto">
          {carregando || !mapa ? (
            <p className="text-sm text-slate-400">Carregando mapa...</p>
          ) : (
            <MapaSetorView mapa={mapa} onSelect={handleSelect} />
          )}
        </div>
      </div>
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
