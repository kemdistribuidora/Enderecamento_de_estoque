import { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response, Router } from 'express';
import crypto from 'crypto';

// Erro "esperado" (validacao, 404, 409...) lancado de dentro da rota/transacao: o
// middleware tratarErro responde com o status dele. Lancar (em vez de res.status().json())
// dentro de emTransacao faz o rollback acontecer sozinho.
export class ErroHttp extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

// Express 4 nao captura promise rejeitada de handler async: o erro vira unhandled
// rejection e o Node 22 derruba o processo inteiro (todo mundo fica sem sistema ate o
// Render reiniciar). Router igual ao do Express, mas cada handler de get/post/put/delete
// passa o erro pro next() -> cai no tratarErro e so aquela requisicao falha.
export function routerAsync(): Router {
  const router = Router();
  for (const metodo of ['get', 'post', 'put', 'delete'] as const) {
    const original = router[metodo].bind(router) as (...args: any[]) => Router;
    (router as any)[metodo] = (caminho: string, ...handlers: RequestHandler[]) =>
      original(caminho, ...handlers.map(capturarErro));
  }
  return router;
}

function capturarErro(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export const tratarErro: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ErroHttp) {
    return res.status(err.status).json({ erro: err.message });
  }
  // corpo JSON malformado (express.json) chega aqui com status 400
  if (typeof err?.status === 'number' && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ erro: err.message ?? 'Requisicao invalida' });
  }
  console.error(`[erro] ${req.method} ${req.originalUrl}`, err);
  if (res.headersSent) return;
  res.status(500).json({ erro: 'Erro interno no servidor. Tente de novo; se repetir, avise o suporte.' });
};

// PIN unico de acesso (sem usuario/login, decisao do projeto). Com APP_PIN definido, toda
// rota /api exige o header x-app-pin igual; sem APP_PIN (dev local) fica aberto.
// Limite de tentativas erradas por IP contra chute de PIN pela internet.
const MAX_TENTATIVAS = 10;
const JANELA_MS = 15 * 60 * 1000;
const tentativasPorIp = new Map<string, { erros: number; desde: number }>();

export function exigirPin(pin: string | undefined): RequestHandler {
  if (!pin) {
    console.warn('[aviso] APP_PIN nao definido: API aberta sem PIN (ok so em dev local).');
    return (_req, _res, next) => next();
  }
  const pinEsperado = Buffer.from(pin);

  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS' || req.path === '/health') return next();

    const ip = req.ip ?? 'desconhecido';
    const agora = Date.now();
    const registro = tentativasPorIp.get(ip);
    if (registro && agora - registro.desde > JANELA_MS) tentativasPorIp.delete(ip);
    const atual = tentativasPorIp.get(ip);
    if (atual && atual.erros >= MAX_TENTATIVAS) {
      return res.status(429).json({ erro: 'Muitas tentativas de PIN erradas. Aguarde 15 minutos.' });
    }

    const recebido = Buffer.from(String(req.header('x-app-pin') ?? ''));
    // sem header nenhum = tela ainda sem PIN salvo, nao conta como tentativa errada
    if (recebido.length === 0) {
      return res.status(401).json({ erro: 'PIN de acesso obrigatorio' });
    }
    const ok = recebido.length === pinEsperado.length && crypto.timingSafeEqual(recebido, pinEsperado);
    if (!ok) {
      tentativasPorIp.set(ip, { erros: (atual?.erros ?? 0) + 1, desde: atual?.desde ?? agora });
      return res.status(401).json({ erro: 'PIN de acesso invalido' });
    }
    tentativasPorIp.delete(ip);
    next();
  };
}
