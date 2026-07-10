/**
 * Shared helper for server-to-server Anthropic calls (web-search-backed
 * lookups). Because this runs on the server rather than in a browser, no
 * `anthropic-dangerous-direct-browser-access` header is needed — that header
 * is only required for direct browser-origin fetches, which is exactly the
 * bug this backend exists to get the extension/PWA out of.
 */
async function callAnthropic(apiKey: string, system: string, userMessage: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 600,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const text = (data.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim();
    return text.replace(/```json|```/g, '').trim();
  } catch {
    return null;
  }
}

export interface NameLookupResult {
  productName: string;
  brand?: string;
  ingredients: string[];
}

/** Resolves a typed food name (e.g. "Doritos Nacho Cheese") to an ingredient list via web search. */
export async function lookupIngredientsByName(foodName: string, apiKey: string): Promise<NameLookupResult | null> {
  const clean = await callAnthropic(
    apiKey,
    'You are a food ingredient lookup tool. Given a food product name, find its full ingredient list. Return ONLY JSON: {"product_name": string, "brand": string|null, "ingredients": string[]}. If you cannot find the product, return {"product_name": null, "brand": null, "ingredients": []}.',
    `Find ingredients for: ${foodName}`
  );
  if (!clean) return null;
  try {
    const parsed = JSON.parse(clean);
    if (!parsed.ingredients?.length) return null;
    return {
      productName: parsed.product_name || foodName,
      brand: parsed.brand || undefined,
      ingredients: parsed.ingredients,
    };
  } catch {
    return null;
  }
}

export interface BarcodeWebSearchResult {
  productName: string;
  brand?: string;
  ingredients: string[];
}

/** Resolves a UPC/EAN barcode to a product + ingredient list via web search (last-resort fallback). */
export async function lookupBarcodeByWebSearch(barcode: string, apiKey: string): Promise<BarcodeWebSearchResult | null> {
  const clean = await callAnthropic(
    apiKey,
    'You are a barcode-to-product lookup tool. Given a UPC/EAN barcode, find the product name and its full ingredient list. Return ONLY JSON: {"product_name": string, "brand": string|null, "ingredients": string[]}. If not found, return {"product_name": null, "brand": null, "ingredients": []}.',
    `Barcode: ${barcode}`
  );
  if (!clean) return null;
  try {
    const parsed = JSON.parse(clean);
    if (!parsed.product_name || !parsed.ingredients?.length) return null;
    return { productName: parsed.product_name, brand: parsed.brand || undefined, ingredients: parsed.ingredients };
  } catch {
    return null;
  }
}
