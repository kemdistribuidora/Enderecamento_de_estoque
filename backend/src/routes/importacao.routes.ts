import { Router } from 'express';
import {
  confirmarImportacao,
  ErroImportacao,
  itensImportacao,
  listarImportacoes,
  previaImportacao,
} from '../services/importacao-winthor.service';

export const importacaoRouter = Router();

function lerCsv(body: any): string | null {
  const csv = body?.csv;
  return typeof csv === 'string' && csv.trim().length > 0 ? csv : null;
}

// POST /api/importacao/winthor/previa { csv } -> reconciliacao arquivo x estoque, NAO grava
importacaoRouter.post('/winthor/previa', async (req, res) => {
  const csv = lerCsv(req.body);
  if (!csv) return res.status(400).json({ erro: 'csv (conteudo do arquivo) e obrigatorio' });
  try {
    res.json(await previaImportacao(csv));
  } catch (e: any) {
    res.status(500).json({ erro: e?.message ?? 'Erro ao processar arquivo' });
  }
});

// POST /api/importacao/winthor/confirmar { csv, nome_arquivo } -> recalcula e grava tudo
// numa transacao (cadastro + saldo + historico)
importacaoRouter.post('/winthor/confirmar', async (req, res) => {
  const csv = lerCsv(req.body);
  if (!csv) return res.status(400).json({ erro: 'csv (conteudo do arquivo) e obrigatorio' });
  const nomeArquivo = typeof req.body?.nome_arquivo === 'string' ? req.body.nome_arquivo : null;
  try {
    res.json(await confirmarImportacao(csv, nomeArquivo));
  } catch (e: any) {
    const status = e instanceof ErroImportacao ? 400 : 500;
    res.status(status).json({ erro: e?.message ?? 'Erro ao gravar importacao' });
  }
});

// GET /api/importacao/winthor/historico -> ultimos imports confirmados
importacaoRouter.get('/winthor/historico', async (_req, res) => {
  res.json(await listarImportacoes());
});

// GET /api/importacao/winthor/historico/:id -> foto por produto daquele import
importacaoRouter.get('/winthor/historico/:id', async (req, res) => {
  res.json(await itensImportacao(Number(req.params.id)));
});
