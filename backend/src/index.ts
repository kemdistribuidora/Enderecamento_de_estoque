import express from 'express';
import cors from 'cors';
import { initSchema } from './db/client';
import { produtosRouter } from './routes/produtos.routes';
import { enderecosRouter } from './routes/enderecos.routes';
import { mapaRouter } from './routes/mapa.routes';
import { importacaoRouter } from './routes/importacao.routes';
import { movimentacoesRouter } from './routes/movimentacoes.routes';
import { dashboardRouter } from './routes/dashboard.routes';
import { exigirPin, tratarErro } from './utils/http';

// Rede de seguranca: erro async fora de rota (ex: timer) so loga, nao derruba o processo.
process.on('unhandledRejection', (motivo) => {
  console.error('[erro] promise rejeitada sem tratamento', motivo);
});

async function main() {
  await initSchema();

  const app = express();
  // Render fica atras de proxy: sem isso req.ip seria sempre o do proxy e o limite de
  // tentativas de PIN bloquearia todo mundo junto.
  app.set('trust proxy', 1);
  // CORS_ORIGIN (opcional) = URL do frontend no Vercel; sem ela aceita qualquer origem.
  app.use(cors(process.env.CORS_ORIGIN ? { origin: process.env.CORS_ORIGIN.split(',') } : undefined));
  app.use(express.json({ limit: '20mb' })); // CSV de produtos do Winthor pode ser grande

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.use('/api', exigirPin(process.env.APP_PIN));
  // so chega aqui com PIN valido: a tela usa pra conferir o PIN digitado
  app.get('/api/acesso', (_req, res) => res.json({ ok: true }));

  app.use('/api/produtos', produtosRouter);
  app.use('/api/enderecos', enderecosRouter);
  app.use('/api/mapa', mapaRouter);
  app.use('/api/importacao', importacaoRouter);
  app.use('/api/movimentacoes', movimentacoesRouter);
  app.use('/api/dashboard', dashboardRouter);

  app.use(tratarErro);

  const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
  app.listen(PORT, () => {
    console.log(`Backend rodando em http://localhost:${PORT}`);
  });
}

main();
