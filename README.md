# Endereçamento de Estoque

Sistema de endereçamento de estoque para armazém: mapa visual de posições ("cinema") + busca de produtos.

## Stack

- Backend: Node.js + TypeScript + Express + [Turso](https://turso.tech) (libSQL — SQLite distribuído, free tier)
- Frontend: React + TypeScript + Vite + Tailwind CSS

## Requisitos

- Node.js 18+

## Banco de dados

O backend usa `@libsql/client`, que funciona de dois jeitos:

- **Sem configurar nada**: usa um arquivo local (`backend/data.sqlite`) — ótimo pra desenvolver sozinho, não precisa de conta em lugar nenhum.
- **Com `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`** (arquivo `backend/.env`): conecta num banco Turso remoto, compartilhado entre **todas as máquinas** que rodarem o app — é o modo pra usar em produção/múltiplos PCs, com você administrando um banco só.

### Criar o banco Turso (grátis, sem cartão)

```bash
# instalar CLI (uma vez só)
curl -sSfL https://get.tur.so/install.sh | bash    # Linux/Mac/WSL
# Windows: ver https://docs.turso.tech/cli/installation (via WSL ou scoop)

turso auth signup          # ou: turso auth login
turso db create estoque-db
turso db show estoque-db --url          # copiar -> TURSO_DATABASE_URL
turso db tokens create estoque-db       # copiar -> TURSO_AUTH_TOKEN
```

Cole os dois valores em `backend/.env` (copie de [backend/.env.example](backend/.env.example)):

```
TURSO_DATABASE_URL=libsql://estoque-db-xxxxx.turso.io
TURSO_AUTH_TOKEN=eyJ...
```

Depois rode `npm run seed` normalmente — ele cria o schema e popula esse banco remoto. Qualquer máquina que rodar o backend com o mesmo `.env` enxerga os mesmos dados.

## Rodando localmente

### 1. Backend

```bash
cd backend
npm install
npm run seed   # cria/popula o banco (local ou Turso, dependendo do .env)
npm run dev    # http://localhost:3001
```

### 2. Frontend

Em outro terminal:

```bash
cd frontend
npm install
npm run dev    # http://localhost:5173
```

O Vite já tem proxy de `/api` para `http://localhost:3001` ([vite.config.ts](frontend/vite.config.ts)) — não precisa configurar CORS extra pra rodar local.

Abra `http://localhost:5173`.

## Deploy (produção / múltiplas máquinas)

Ver [DEPLOY.md](DEPLOY.md) — passo a passo pra deixar sistema acessível em todas as máquinas da operação via 1 URL só.

## Estrutura

```
/backend
  .env.example   TURSO_DATABASE_URL / TURSO_AUTH_TOKEN
  src/
    db/          schema.sql, client.ts (conexao libsql), seed.ts (dados ficticios)
    services/    endereco.service.ts -> parse/format do codigo de endereco
    routes/      produtos.routes.ts, enderecos.routes.ts
    types/
    index.ts
/frontend
  src/
    pages/       MapaPage.tsx, BuscaPage.tsx
    components/  GridCorredor, PosicaoCell, ProdutoModal, SearchBar, ResultCard
    api/         client.ts (chamadas fetch)
    types/
```

## Modelo de dados

- **produtos**: id, codigo, nome, descricao, codigo_barras, validade
- **enderecos**: id, corredor, andar, posicao, codigo (formatado, ex. `A204`)
- **estoque_posicoes**: id, produto_id, endereco_id (UNIQUE), quantidade — relaciona produto <-> endereco. Um endereco so tem uma linha aqui por vez (ocupado por 1 produto); um produto pode ter varias linhas (varios enderecos).

Status do endereco (livre/ocupado) **não é uma coluna** — é calculado via JOIN com `estoque_posicoes`, pra não correr risco de ficar dessincronizado.

### Formato do código de endereço

`[Letra do corredor][andar][posição]`, ex. `A204` = corredor A, andar 2, posição 04.

Lógica de parse/formatação isolada em [backend/src/services/endereco.service.ts](backend/src/services/endereco.service.ts) — o número de dígitos de andar/posição é configurável em duas constantes (`ANDAR_DIGITS`, `POSICAO_DIGITS`) no topo do arquivo. Padrão atual: 1 dígito andar + 2 dígitos posição (bate com o exemplo `A204`). Pra usar `A0204` (2+2 dígitos), só mudar `ANDAR_DIGITS` pra `2`.

## API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/produtos?search=termo` | Lista produtos, busca parcial por código OU nome (case-insensitive) |
| GET | `/api/produtos/:id` | Detalhe do produto + todas as posições onde está armazenado |
| GET | `/api/enderecos?corredor=A` | Mapa de endereços com status (livre/ocupado) e produto ocupante; `corredor` opcional |
| GET | `/api/enderecos/corredores` | Lista de corredores existentes |
| POST | `/api/enderecos/:id/ocupar` | Body `{ produto_id, quantidade }` — ocupa um endereço livre |
| POST | `/api/enderecos/:id/liberar` | Libera um endereço ocupado |

## Seed

`npm run seed` (dentro de `backend/`) recria o banco com 4 corredores (A-D) x 3 andares x 6 posições (72 endereços) e 30 produtos fictícios, ~40% dos endereços ocupados.
