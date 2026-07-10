import { Router } from 'express';
import { TIERS } from '../lib/tiers';
import { getDbMeta } from '../lib/ingredientDb';

export const tiersRouter = Router();
tiersRouter.get('/', (_req, res) => {
  res.json({ tiers: TIERS });
});

export const dbVersionRouter = Router();
dbVersionRouter.get('/', (_req, res) => {
  res.json(getDbMeta());
});
