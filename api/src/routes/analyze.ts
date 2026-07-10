import { Router } from 'express';
import { analyzeIngredients } from '../lib/analyze';
import { lookupBarcode } from '../lib/barcode';
import { lookupIngredientsByName } from '../lib/anthropic';
import { ApiError, newRequestId } from '../middleware/errorHandler';
import { getDbMeta } from '../lib/ingredientDb';

export const analyzeRouter = Router();

analyzeRouter.post('/', (req, res, next) => {
  try {
    const { ingredients, options, metadata } = req.body || {};
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      throw new ApiError(400, 'INGREDIENTS_EMPTY', "Required field 'ingredients' is missing or empty", 'ingredients');
    }
    if (ingredients.length > 200) {
      throw new ApiError(400, 'INGREDIENTS_TOO_MANY', `Request contains ${ingredients.length} ingredients; maximum is 200`, 'ingredients');
    }
    if (!ingredients.every((i: unknown) => typeof i === 'string' && i.length > 0)) {
      throw new ApiError(400, 'INVALID_REQUEST', 'Every item in ingredients must be a non-empty string', 'ingredients');
    }

    const result = analyzeIngredients(ingredients, options || {});
    const meta = getDbMeta();

    res.json({
      request_id: newRequestId(),
      analyzed_at: new Date().toISOString(),
      db_version: meta.version,
      summary: result.summary,
      ingredients: result.ingredients,
      unmatched_ingredients: result.unmatched,
      ...(metadata ? { metadata: { ...metadata, echo: true } } : {}),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Not in the original OpenAPI spec — added to support the extension/PWA use
 * case where a page shows a food name but no ingredient list (e.g. searching
 * a food in MyFitnessPal/MacrosFirst before it's added to the diary). Mirrors
 * /analyze/barcode's shape but keyed on a typed name instead of a scanned
 * barcode, and has no OFF/USDA step since there's no barcode to look up —
 * it's web-search-only, so it requires either a caller-supplied
 * options.anthropic_api_key or a server-configured ANTHROPIC_API_KEY.
 */
analyzeRouter.post('/name', async (req, res, next) => {
  try {
    const { food_name: foodName, options } = req.body || {};
    if (typeof foodName !== 'string' || foodName.trim().length < 2) {
      throw new ApiError(400, 'INVALID_REQUEST', "Required field 'food_name' must be a non-empty string", 'food_name');
    }

    const anthropicKey = options?.anthropic_api_key || process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      throw new ApiError(
        400,
        'INVALID_REQUEST',
        'Name-based lookup requires an Anthropic API key — pass options.anthropic_api_key or configure ANTHROPIC_API_KEY on the server',
        'options.anthropic_api_key'
      );
    }

    const lookup = await lookupIngredientsByName(foodName, anthropicKey);
    if (!lookup) {
      throw new ApiError(422, 'NAME_NOT_FOUND', `Could not find ingredients for "${foodName}" via web search.`, 'food_name');
    }

    const result = analyzeIngredients(lookup.ingredients, options || {});
    const meta = getDbMeta();

    res.json({
      request_id: newRequestId(),
      analyzed_at: new Date().toISOString(),
      db_version: meta.version,
      summary: result.summary,
      ingredients: result.ingredients,
      unmatched_ingredients: result.unmatched,
      metadata: { product_name: lookup.productName, echo: false },
    });
  } catch (err) {
    next(err);
  }
});

analyzeRouter.post('/barcode', async (req, res, next) => {
  try {
    const { barcode, options } = req.body || {};
    if (typeof barcode !== 'string' || !/^\d{8,14}$/.test(barcode)) {
      throw new ApiError(400, 'INVALID_REQUEST', "Required field 'barcode' must be an 8-14 digit UPC/EAN", 'barcode');
    }

    const product = await lookupBarcode(barcode, options || {});
    if (!product) {
      throw new ApiError(
        422,
        'BARCODE_NOT_FOUND',
        `Barcode ${barcode} was not found in Open Food Facts, USDA FoodData Central, or web search.`,
        'barcode'
      );
    }

    const result = analyzeIngredients(product.ingredientList, options || {});
    const meta = getDbMeta();

    res.json({
      request_id: newRequestId(),
      analyzed_at: new Date().toISOString(),
      db_version: meta.version,
      summary: result.summary,
      ingredients: result.ingredients,
      unmatched_ingredients: result.unmatched,
      product: product.info,
    });
  } catch (err) {
    next(err);
  }
});
