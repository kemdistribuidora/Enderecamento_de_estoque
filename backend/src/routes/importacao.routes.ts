import { Router } from 'express';
import { importarProdutosCsv, importarSaldoCsv } from '../services/importacao-winthor.service';

export const importacaoRouter = Router();

// POST /api/importacao/produtos { csv: string } -> conteudo cru do arquivo exportado do D860
importacaoRouter.post('/produtos', async (req, res) => {
  const csv = req.body?.csv;
  if (typeof csv !== 'string' || csv.trim().length === 0) {
    return res.status(400).json({ erro: 'csv (conteudo do arquivo) e obrigatorio' });
  }
  const resultado = await importarProdutosCsv(csv);
  res.json(resultado);
});

// POST /api/importacao/saldo { csv: string } -> precisa produtos ja importados antes
importacaoRouter.post('/saldo', async (req, res) => {
  const csv = req.body?.csv;
  if (typeof csv !== 'string' || csv.trim().length === 0) {
    return res.status(400).json({ erro: 'csv (conteudo do arquivo) e obrigatorio' });
  }
  const resultado = await importarSaldoCsv(csv);
  res.json(resultado);
});
