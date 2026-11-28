import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SlidingWindowRateLimiter, validateSecretCodeOnServer } from './src/server/secretCodeRegistry.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));

  // Baseline security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  const codeRateLimiter = new SlidingWindowRateLimiter(20, 60_000);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  /**
   * Server-side secret code validation endpoint.
   * Keeps secret code strings out of the public client bundle and enforces rate limiting.
   */
  app.post('/api/codes/redeem', (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const limit = codeRateLimiter.check(clientIp);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSec));
      return res.status(429).json({
        ok: false,
        status: 'rate_limited',
        message: `Muitas tentativas seguidas. Aguarde ${limit.retryAfterSec}s antes de tentar novamente.`,
      });
    }

    const rawCode = typeof req.body?.code === 'string' ? req.body.code : '';
    const trimmed = rawCode.trim();
    if (!trimmed) {
      return res.status(400).json({
        ok: false,
        status: 'empty',
        message: 'Digite um código secreto para resgatar.',
      });
    }
    if (trimmed.length > 48) {
      return res.status(400).json({
        ok: false,
        status: 'invalid',
        message: 'Código inválido. Verifique a grafia e tente novamente.',
      });
    }

    const entry = validateSecretCodeOnServer(trimmed);
    if (!entry) {
      return res.status(404).json({
        ok: false,
        status: 'invalid',
        message: 'Código inválido. Verifique a grafia e tente novamente.',
      });
    }

    return res.json({
      ok: true,
      status: 'valid',
      codeId: entry.id,
      rewardDef: {
        id: entry.id,
        title: entry.title,
        subtitle: entry.subtitle,
        description: entry.description,
        theme: entry.theme,
        reward: entry.reward,
      },
    });
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir, { index: false }));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Dungeon Ascension server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
