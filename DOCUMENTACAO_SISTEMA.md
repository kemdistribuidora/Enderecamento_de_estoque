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
│       │   ├── import-winthor.ts
│       │   └── testar-reconciliacao-winthor.ts
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
| `importacoes_saldo` | id, criado_em, nome_arquivo, linhas_lidas/bloqueadas, produtos_arquivo/novos, contagem por status | 1 linha por import confirmado |
| `importacoes_saldo_itens` | importacao_id FK, produto_id FK, codigo, nome, saldo_anterior, saldo_novo, posicionado, nao_posicionado, sobra, status | foto por produto no momento do import |
| `movimentacoes` | id, tipo (entrada/saida), produto_id FK, endereco_id FK, quantidade, validade, lote, status (confirmada/standby/revertida), criado_em | histórico append-only, sem coluna de usuário |

Código de endereço: `[Letra corredor][Lado E/D][andar][posição]`, ex. `AD302`. Formatação/parse em `endereco.service.ts`.

Status de endereço (livre/ocupado) não é coluna — sempre derivado via JOIN com `estoque_posicoes`, evita dessincronia.

## 5. Backend — módulos

**services/**
- `endereco.service.ts` — `formatarEndereco`/`parsearEndereco`, `donoPrateleira` (regra de qual corredor/lado é dono da prateleira), `sugerirEnderecoLivre` (heurística de distância física para sugestão).
- `validade.service.ts` — `calcularStatusValidade`, janela `DIAS_ALERTA_VENCIMENTO = 35`.
- `importacao-winthor.service.ts` — `parsearArquivoWinthor`, `previaImportacao` (reconciliação sem gravar), `confirmarImportacao` (grava tudo num `db.batch`), `listarImportacoes`/`itensImportacao` (histórico). Usado por rota HTTP e por CLI.

**routes/**
- `produtos.routes.ts` — CRUD produto, pendências de posicionamento, divergências de sobra, curva ABC, busca por código de barras, sugestão de endereço, detalhe.
- `enderecos.routes.ts` — listagem com status, busca por código (scanner), posições a vencer, ocupar/liberar.
- `mapa.routes.ts` — setores, mapa completo de um setor.
- `importacao.routes.ts` — prévia/confirmação do arquivo Winthor e histórico de imports.
- `movimentacoes.routes.ts` — histórico, desfazer saída em standby.
- `dashboard.routes.ts` — 4 KPIs (queries próprias, deliberadamente não reaproveita queries de outras rotas).

**scripts/** — `import-winthor.ts`: mesmo serviço via CLI (`npm run import:winthor -- caminho.csv` mostra a prévia, `--confirmar` grava). `testar-reconciliacao-winthor.ts`: teste da reconciliação num SQLite temporário (`npm run test:reconciliacao`).

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
- `POST /winthor/previa` — body `{csv}`, reconcilia sem gravar
- `POST /winthor/confirmar` — body `{csv, nome_arquivo}`, recalcula e grava (transação única)
- `GET /winthor/historico` — últimos imports
- `GET /winthor/historico/:id` — itens de um import

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
| `/importacao` | ImportacaoPage | upload arquivo Winthor, prévia da reconciliação, confirmação, histórico |
| `/posicionamento` | PosicionamentoPage | pendências + sugestão de endereço, divergências de sobra |
| `/coletor` | ColetorPage | entrada/saída via leitor código de barras |
| `/historico` | HistoricoPage | movimentações, desfazer standby |
| `/curva-abc` | CurvaAbcPage | classificação ABC |
| `/validade` | ValidadePage | vencidos/próximos, atalho para mapa |

Componentes: `MapaSetorView`, `ModalEscolherNoMapa`, `ProdutoModal`, `ResultCard`, `SearchBar`, `ScannerInput` (captura Enter de leitor USB/RF), `CameraScannerModal` (`@zxing/browser`).

## 8. Integração Winthor (D860)

CSVs sem cabeçalho, separados por `;`, encoding tipicamente Windows-1252 (tratado em `ImportacaoPage.tsx::lerArquivoTexto`: tenta UTF-8 estrito, cai para Windows-1252).

Arquivo único: `codigo;nome;codigo_barras;qt_por_cx;filial;codigo;saldo` (LEFT JOIN produto+saldo no Winthor; filial/codigo/saldo vazios = sem saldo = 0). Saldo e qt_por_cx com ponto decimal, sem separador de milhar, aceitando o formato Oracle sem zero antes do ponto (`.5`, `-.24`); fracionado (KG) guardado com até 6 casas (Winthor usa até 5).

**Regra central: o saldo do Winthor é a verdade.** Para cada produto do arquivo, posicionado + não posicionado = saldo do arquivo:
- saldo >= posicionado: a diferença é o não posicionado (derivado, nunca gravado: `saldo - SUM(estoque_posicoes)`).
- saldo < posicionado: não posicionado = 0 e a diferença vira **sobra** (algo saiu no Winthor e não foi retirado da posição). Só alerta, mostrando as posições do produto (validade mais antiga primeiro); o usuário dá a baixa. O import nunca mexe em `estoque_posicoes`.
- Área de Espera conta como posicionado.
- Produto fora do arquivo não é alterado (arquivo pode ser parcial, filtrado por produto/fornecedor).

Fluxo em 2 passos: prévia (não grava) e confirmação (servidor recalcula e grava cadastro + saldo + histórico num único `db.batch`: entra tudo ou nada). Status por produto: `novo` (primeiro saldo), `sem_mudanca`, `entrou`, `saiu`, `sobra`.

Linhas bloqueadas (não gravadas): número de campos diferente de 7, código/nome vazio, coluna 6 diferente da 1, saldo não numérico (ex. vírgula), qt_por_cx inválido, produto repetido com saldo diferente. Produto repetido com o mesmo saldo conta 1 vez (fan-out de JOIN) com aviso.

Precisão: toda quantidade gravada/comparada passa por `arredondarQtd` (`utils/quantidade.ts`, 6 casas) e as somas SQL usam `ROUND(SUM(...), 6)`. Evita divergência falsa por ponto flutuante (`10.3 - 0.1 = 10.200000000000001`).

Dois pontos de entrada: UI (`POST /api/importacao/winthor/*`) e CLI (`npm run import:winthor`).

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

**Backend** (`package.json`): `dev` (tsx watch, porta 3001), `build`, `start`, `seed`, `import:winthor`, `test:reconciliacao`.

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
