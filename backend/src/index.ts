import express from 'express';
import cors from 'cors';
import { initSchema } from './db/client';
import { produtosRouter } from './routes/produtos.routes';
import { enderecosRouter } from './routes/enderecos.routes';
import { mapaRouter } from './routes/mapa.routes';

async function main() {
  await initSchema();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/produtos', produtosRouter);
  app.use('/api/enderecos', enderecosRouter);
  app.use('/api/mapa', mapaRouter);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
  app.listen(PORT, () => {
    console.log(`Backend rodando em http://localhost:${PORT}`);
  });
}

main();
