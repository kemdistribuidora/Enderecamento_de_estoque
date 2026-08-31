# Documentação Geral do Sistema — Endereçamento de Estoque

Documento gerado para análise. Reflete estado do código em 2026-08-28 (branch main, commit `eb8b44c`).

## 1. Visão geral

Sistema de endereçamento físico de estoque (WMS simplificado) integrado ao ERP Winthor via importação de CSV (rotina D860). Cobre: mapa visual de depósito, cadastro de produto, entrada/saída de estoque, coletor por código de barras, posicionamento sugerido, controle de validade, curva ABC, histórico de movimentação e dashboard de KPIs.

Sem autenticação/autorização — sistema aberto, sem usuário logado. Sem testes automatizados.

## 2. Estrutura de pastas

```
Enderecamento_de_estoque/
├── README.md, DEPLOY.md
├── backend/
│   ├── package.json, tsconfig.json, .env / .env.example
│   └── src/
│       ├── index.ts                    # bootstrap Express
│       ├── db/
│       │   ├── client.ts               # conexão libSQL + migração de coluna em boot
│       │   ├── schema.sql              # DDL completo (fonte única de schema)
│       │   └── seed.ts                 # dados fictícios (dev)
│       ├── routes/
│       │   ├── produtos.routes.ts
│       │   ├── enderecos.routes.ts
│       │   ├── mapa.routes.ts
│       │   ├── importacao.routes.ts
│       │   ├── movimentacoes.routes.ts
│       │   └── dashboard.routes.ts
│       ├── services/
│       │   ├── endereco.service.ts     # parse/format código endereço + sugestão
│       │   ├── validade.service.ts     # classificação vencido/próximo/normal
│       │   └── importacao-winthor.service.ts
│       ├── scripts/
│       │   ├── import-winthor-produtos.ts
│       │   └── import-winthor-saldo.ts
│       └── types/index.ts
└── frontend/
    ├── package.json, vite.config.ts, tailwind.config.js
    └── src/
        ├── main.tsx, App.tsx, index.css
        ├── api/client.ts               # única camada fetch ao backend
        ├── types/index.ts
        ├── utils/statusValidade.ts
        ├── pages/ (10 páginas — ver seção 6)
        └── components/ (7 componentes — ver seção 6)
```

Sem Prisma/TypeORM/Knex. ORM = SQL puro via `@libsql/client`, schema em `schema.sql`.

## 3. Stack tecnológica

**Backend**: Node.js + TypeScript 5.5, Express 4.19, `@libsql/client` 0.17 (SQLite local `backend/data.sqlite` ou Turso remoto), `cors`, `dotenv`. Dev com `tsx` watch.

**Frontend**: React 18.3 + TypeScript, Vite 5.3, `react-router-dom` 6.26, `@zxing/browser` 0.2 (leitura de código de barras via câmera), Tailwind CSS 3.4. Sem estado global (Redux/Zustand), sem lib de formulário — tudo `useState`/`useEffect` local.

Sem testes (nenhum Jest/Vitest, nenhum arquivo `*.test.ts`).

## 4. Modelo de dados

Fonte: `backend/src/db/schema.sql`. Migrações de coluna condicionais em `client.ts::adicionarColunaSeNaoExiste` (ex.: coluna `lote` foi adicionada depois, via ALTER TABLE em boot).

| Tabela | Campos principais | Relacionamento |
|---|---|---|
| `produtos` | id, codigo (UNIQUE), nome, codigo_barras | dado mestre |
| `setores` | id, nome, ordem (UNIQUE) | 1—N corredores, 1—N prateleiras |
| `corredores` | id, setor_id FK, letra, ordem | UNIQUE(setor_id,letra), UNIQUE(setor_id,ordem) |
| `prateleiras` | id, setor_id FK, ordem | UNIQUE(setor_id,ordem) |
| `enderecos` | id, prateleira_id FK, corredor, lado (E/D), andar, posicao, codigo (UNIQUE) | UNIQUE(prateleira_id,andar,posicao) |
| `estoque_posicoes` | id, produto_id FK, endereco_id FK (UNIQUE), quantidade, validade, lote | 1 produto por posição |
| `estoque_erp_saldo` | id, produto_id FK, filial, saldo, atualizado_em | UNIQUE(produto_id,filial) — saldo Winthor, só conferência |
| `movimentacoes` | id, tipo (entrada/saida), produto_id FK, endereco_id FK, quantidade, validade, lote, status (confirmada/standby/revertida), criado_em | histórico append-only, sem coluna de usuário |

Código de endereço: `[Letra corredor][Lado E/D][andar][posição]`, ex. `AD302`. Formatação/parse em `endereco.service.ts`.

Status de endereço (livre/ocupado) não é coluna — sempre derivado via JOIN com `estoque_posicoes`, evita dessincronia.

## 5. Backend — módulos

**services/**
- `endereco.service.ts` — `formatarEndereco`/`parsearEndereco`, `donoPrateleira` (regra de qual corredor/lado é dono da prateleira), `sugerirEnderecoLivre` (heurística de distância física para sugestão).
- `validade.service.ts` — `calcularStatusValidade`, janela `DIAS_ALERTA_VENCIMENTO = 35`.
- `importacao-winthor.service.ts` — `importarProdutosCsv`, `importarSaldoCsv` (upsert, usado por rota HTTP e por CLI).

**routes/**
- `produtos.routes.ts` — CRUD produto, pendências de posicionamento, divergências de sobra, curva ABC, busca por código de barras, sugestão de endereço, detalhe.
- `enderecos.routes.ts` — listagem com status, busca por código (scanner), posições a vencer, ocupar/liberar.
- `mapa.routes.ts` — setores, mapa completo de um setor.
- `importacao.routes.ts` — upload CSV produtos/saldo.
- `movimentacoes.routes.ts` — histórico, desfazer saída em standby.
- `dashboard.routes.ts` — 4 KPIs (queries próprias, deliberadamente não reaproveita queries de outras rotas).

**scripts/** — `import-winthor-produtos.ts` / `import-winthor-saldo.ts`: mesmos serviços via CLI (`npm run import:winthor:produtos -- caminho.csv`).

## 6. Endpoints de API

**Produtos** (`/api/produtos`)
- `POST /` — cria (409 se código duplicado)
- `GET /?search=` — lista/busca, posições ordenadas por validade (FEFO)
- `GET /pendencias-posicionamento` — saldo Winthor > alocado
- `GET /divergencias-sobra` — alocado > saldo Winthor
- `GET /curva-abc` — classe A/B/C por giro de saída
- `GET /codigo-barras/:codigo` — busca exata (coletor)
- `GET /:id/sugestao-endereco` — endereço livre mais próximo
- `GET /:id` — detalhe + posições

**Endereços** (`/api/enderecos`)
- `GET /` — lista com status calculado
- `GET /codigo/:codigo` — busca exata (coletor)
- `GET /a-vencer` — vencidos/próximos
- `POST /:id/ocupar` — body `{produto_id, quantidade, validade, lote}`
- `POST /:id/liberar` — cria movimentação saida/standby

**Mapa** (`/api/mapa`)
- `GET /setores`
- `GET /:setorId`

**Importação** (`/api/importacao`)
- `POST /produtos` — body `{csv}`
- `POST /saldo` — body `{csv}`

**Movimentações** (`/api/movimentacoes`)
- `GET /?limit=100` (máx 500)
- `POST /:id/desfazer`

**Dashboard**
- `GET /api/dashboard/kpis`

**Health**
- `GET /api/health`

## 7. Frontend — páginas

Rotas em `App.tsx`, sem layout aninhado.

| Rota | Página | Função |
|---|---|---|
| `/dashboard` | DashboardPage | 4 KPI tiles + ocupação por setor |
| `/` | MapaPage | mapa visual do depósito, abas por setor, busca destaca posição |
| `/busca` | BuscaPage | busca produto com debounce, posições por validade |
| `/cadastro` | CadastroPage | cadastro produto + entrada em estoque |
| `/importacao` | ImportacaoPage | upload CSV Winthor (UTF-8/Windows-1252) |
| `/posicionamento` | PosicionamentoPage | pendências + sugestão de endereço, divergências de sobra |
| `/coletor` | ColetorPage | entrada/saída via leitor código de barras |
| `/historico` | HistoricoPage | movimentações, desfazer standby |
| `/curva-abc` | CurvaAbcPage | classificação ABC |
| `/validade` | ValidadePage | vencidos/próximos, atalho para mapa |

Componentes: `MapaSetorView`, `ModalEscolherNoMapa`, `ProdutoModal`, `ResultCard`, `SearchBar`, `ScannerInput` (captura Enter de leitor USB/RF), `CameraScannerModal` (`@zxing/browser`).

## 8. Integração Winthor (D860)

CSVs sem cabeçalho, separados por `;`, encoding tipicamente Windows-1252 (tratado em `ImportacaoPage.tsx::lerArquivoTexto`: tenta UTF-8 estrito, cai para Windows-1252).

- **Produtos**: colunas `codigo;nome;codigo_barras`, upsert por `codigo`.
- **Saldo**: colunas `filial;codigo;saldo`, exige produto já existir, upsert por `(produto_id, filial)`.

Saldo Winthor nunca é fonte de posição física — só conferência: pendências de posicionamento, divergência de sobra, acurácia no dashboard.

Dois pontos de entrada por fluxo: UI (`POST /api/importacao/*`) e CLI (`npm run import:winthor:*`).

## 9. Funcionalidades x commits

| Commit | Funcionalidade |
|---|---|
| `af3aab7` Initial | mapa, busca, cadastro |
| `b8caa4e` | reaproveitamento de produto existente no cadastro |
| `29a587b` | importação Winthor D860 (produtos + saldo) |
| `2dfa9b5` | posicionamento com sugestão de endereço |
| `308657a` | histórico de movimentação, curva ABC, controle de validade, alerta de sobra |
| `eb8b44c` | coletor código de barras, lote no estoque, dashboard KPIs |

Detalhes:
- **Curva ABC**: classe atribuída pelo acumulado percentual ANTES de somar item atual (evita deslocar erroneamente o primeiro item de maior volume para fora da classe A).
- **Movimentação standby**: saída libera endereço de fato mas fica reversível até reocupação ou confirmação.
- **Sugestão de endereço**: heurística de menor distância física (`custoDistancia`) entre onde produto já está e posições livres do mesmo setor.

## 10. Scripts e variáveis de ambiente

**Backend** (`package.json`): `dev` (tsx watch, porta 3001), `build`, `start`, `seed`, `import:winthor:produtos`, `import:winthor:saldo`.

**Frontend**: `dev` (vite, porta 5173, proxy `/api`→localhost:3001), `build`, `preview`.

**Env backend** (`.env.example`): `TURSO_DATABASE_URL` (vazio = usa SQLite local), `TURSO_AUTH_TOKEN`.
**Env frontend**: `VITE_API_URL` (default `/api`).

**Deploy** (`DEPLOY.md`): Turso (banco) + Render (backend) + Vercel/Netlify (frontend).

## 11. Observações para análise

- Sem autenticação/autorização em nenhuma rota.
- Sem testes automatizados.
- Duplicação intencional de queries (ex.: dashboard replica lógica de curva-abc/pendências) — trade-off de simplicidade documentado no próprio código.
- Domínio, nomes de tabela, variáveis e comentários em português.
- `backend/.env` real existe no working tree, não versionado, contém credenciais Turso — não expor.
