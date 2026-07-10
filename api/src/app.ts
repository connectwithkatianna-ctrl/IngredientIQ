import express from 'express';
import cors from 'cors';
import { analyzeRouter } from './routes/analyze';
import { ingredientsRouter } from './routes/ingredients';
import { tiersRouter, dbVersionRouter } from './routes/reference';
import { errorHandler } from './middleware/errorHandler';
import { rateLimit } from './middleware/rateLimit';
import { requireAuth } from './middleware/auth';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/healthz', (_req, res) => res.json({ ok: true }));

  // Public, no-auth reference endpoints (security: [] in the OpenAPI spec).
  app.use('/v1/tiers', tiersRouter);
  app.use('/v1/db/version', dbVersionRouter);

  // Everything else under /v1 requires a Bearer token and is rate-limited.
  app.use('/v1', requireAuth, rateLimit);
  app.use('/v1/analyze', analyzeRouter);
  app.use('/v1/ingredients', ingredientsRouter);

  app.use(errorHandler);
  return app;
}
