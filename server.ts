import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes.js';
import { assertAuthConfiguration } from './server/auth.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  assertAuthConfiguration();
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Basic Middleware
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Mount API Router
  app.use('/api', apiRouter);
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(err);
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
    if (err instanceof SyntaxError && 'body' in err) return res.status(400).json({ error: 'Invalid JSON request body.' });
    res.status(500).json({ error: 'An internal server error occurred.' });
  });

  // Vite integration
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[Ease Career] Vite dev middleware attached.');
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Ease Career Server is running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Ease Career] Fatal server startup error:', err);
});
