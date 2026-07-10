import { AnalyzeOptions, ProductInfo } from '../types';
import { lookupBarcodeByWebSearch } from './anthropic';

export interface BarcodeLookupResult {
  info: ProductInfo;
  ingredientList: string[];
}

async function lookupOpenFoodFacts(barcode: string): Promise<BarcodeLookupResult | null> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, {
      headers: { 'User-Agent': 'IngredientIQ/1.0 (contact: dev@ingredientiq.io)' },
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    if (data.status !== 1 || !data.product) return null;
    const p = data.product;
    const ingredientsRaw: string = p.ingredients_text_en || p.ingredients_text || '';
    if (!ingredientsRaw) return null;
    return {
      info: {
        barcode,
        product_name: p.product_name || p.generic_name || 'Unknown product',
        brand: p.brands,
        image_url: p.image_front_url || p.image_url || null,
        serving_size: p.serving_size,
        nutriscore_grade: p.nutriscore_grade || null,
        ingredients_raw: ingredientsRaw,
        lookup_source: 'open_food_facts',
      },
      ingredientList: ingredientsRaw.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean),
    };
  } catch {
    return null;
  }
}

async function lookupUsdaFdc(barcode: string, fdcApiKey: string): Promise<BarcodeLookupResult | null> {
  try {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(barcode)}&dataType=Branded&api_key=${encodeURIComponent(fdcApiKey)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: any = await res.json();
    const food = (data.foods || []).find((f: any) => f.gtinUpc === barcode) || data.foods?.[0];
    if (!food || !food.ingredients) return null;
    return {
      info: {
        barcode,
        product_name: food.description || 'Unknown product',
        brand: food.brandOwner,
        image_url: null,
        serving_size: food.servingSize ? `${food.servingSize}${food.servingSizeUnit || ''}` : undefined,
        nutriscore_grade: null,
        ingredients_raw: food.ingredients,
        lookup_source: 'usda_fdc',
      },
      ingredientList: String(food.ingredients).split(/[,;]/).map((s: string) => s.trim()).filter(Boolean),
    };
  } catch {
    return null;
  }
}

/**
 * Last-resort fallback: server-to-server web search via Anthropic. Accepts a
 * caller-supplied key (BYOK, matching the extension/PWA's existing "paste
 * your own key" UX) and falls back to a server-configured default key if the
 * deployment operator has set one.
 */
async function lookupViaWebSearch(barcode: string, apiKey: string): Promise<BarcodeLookupResult | null> {
  const result = await lookupBarcodeByWebSearch(barcode, apiKey);
  if (!result) return null;
  return {
    info: {
      barcode,
      product_name: result.productName,
      brand: result.brand,
      image_url: null,
      ingredients_raw: result.ingredients.join(', '),
      nutriscore_grade: null,
      lookup_source: 'web_search',
    },
    ingredientList: result.ingredients,
  };
}

export async function lookupBarcode(barcode: string, options: AnalyzeOptions): Promise<BarcodeLookupResult | null> {
  const off = await lookupOpenFoodFacts(barcode);
  if (off) return off;

  if (options.fdc_api_key) {
    const fdc = await lookupUsdaFdc(barcode, options.fdc_api_key);
    if (fdc) return fdc;
  }

  const anthropicKey = options.anthropic_api_key || process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return null;
  return lookupViaWebSearch(barcode, anthropicKey);
}
