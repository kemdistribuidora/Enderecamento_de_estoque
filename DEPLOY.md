# Deploy — sistema acessível em todas as máquinas da operação

Objetivo: 1 URL única, acessada por qualquer PC/tablet da operação via navegador. Nada de ligar máquina por máquina.

## Visão geral

```
[Turso]  <-- banco remoto, ja compartilhado -->  [Backend no Render]  <-- /api -->  [Frontend no Vercel/Netlify]
                                                                                              ^
                                                                                  todas as maquinas acessam aqui
```

## 1. Banco (Turso) — já feito

`backend/.env` já tem `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` reais. Banco remoto, compartilhado entre todo mundo que usar essas mesmas credenciais. Nada a fazer aqui, só reaproveitar esses dois valores no passo 2.

## 2. Backend (Render)

1. render.com → **New Web Service** → conectar o repositório Git.
2. Configurar:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
3. Em **Environment**, adicionar:
   - `TURSO_DATABASE_URL` = (copiar de `backend/.env`)
   - `TURSO_AUTH_TOKEN` = (copiar de `backend/.env`)
4. Deploy. Anotar a URL gerada, ex: `https://enderecamento-backend.onrender.com`.
5. Se o banco remoto ainda não tem schema/dados, popular uma vez: no Shell do Render (ou local, com `backend/.env` apontando pro Turso remoto) rodar `npm run seed`.
6. Checar: abrir `https://enderecamento-backend.onrender.com/api/health` → deve responder `{"ok":true}`.

Obs: plano free do Render "dorme" backend sem uso — primeira requisição depois de um tempo parado demora alguns segundos pra acordar. Se isso incomodar na operação, subir pra plano pago ou trocar de provedor depois.

## 3. Frontend (Vercel ou Netlify)

1. Importar o mesmo repositório.
2. Configurar:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Env var:
   - `VITE_API_URL` = `https://enderecamento-backend.onrender.com/api` (URL do passo 2 + `/api`)
4. Deploy. URL final, ex: `https://estoque.vercel.app`.

## 4. Uso na operação

Qualquer máquina: abrir `https://estoque.vercel.app` no navegador. Sem instalar nada, sem rodar `npm run dev`, sem ligar PC nenhum manualmente — só precisa internet.

## Atualizações futuras

Push na branch conectada → Render e Vercel/Netlify rebuildam sozinhos. Sem passo manual extra.

## Rollback rápido pra dev local

`backend/.env` vazio (sem `TURSO_*`) volta a usar `backend/data.sqlite` local — só pra testar isolado, não usar isso em produção.
