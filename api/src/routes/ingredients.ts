import { Router } from 'express';
import { searchIngredients, getIngredientById } from '../lib/ingredientDb';
import { ApiError, newRequestId } from '../middleware/errorHandler';

export const ingredientsRouter = Router();

ingredientsRouter.get('/search', (req, res, next) => {
  try {
    const q = String(req.query.q ?? '');
    if (q.length < 2 || q.length > 100) {
      throw new ApiError(400, 'INVALID_REQUEST', 'Query parameter q must be 2-100 characters', 'q');
    }
    const tier = req.query.tier ? String(req.query.tier) : undefined;
    const category = req.query.category ? String(req.query.category) : undefined;
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const { results, total } = searchIngredients({ q, tier, category, limit, offset });
    res.json({ results, total, limit, offset, query: q });
  } catch (err) {
    next(err);
  }
});

ingredientsRouter.get('/:id', (req, res) => {
  const record = getIngredientById(req.params.id);
  if (!record) {
    return res.status(404).json({
      error: { code: 'INVALID_REQUEST', message: `Ingredient '${req.params.id}' not found` },
      request_id: newRequestId(),
    });
  }
  res.json(record);
});
