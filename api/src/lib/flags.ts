import { IngredientSeed, FlagValue, AllergenProfileValue, AllergenAlert, Tier } from '../types';
import { TIER_WEIGHTS } from './tiers';

const ALLERGEN_ID_MAP: Record<AllergenProfileValue, string> = {
  peanuts: 'peanuts',
  tree_nuts: 'tree_nuts',
  milk: 'milk',
  eggs: 'eggs',
  fish: 'fish',
  shellfish: 'crustacean_shellfish',
  wheat: 'wheat',
  soy: 'soy',
  sesame: 'sesame',
};

/** Flags from matched ingredients whose tier meets or exceeds flag_threshold. */
export function computeFlags(matched: IngredientSeed[], threshold: Tier): FlagValue[] {
  const thresholdWeight = TIER_WEIGHTS[threshold] ?? TIER_WEIGHTS.concern;
  const flags = new Set<FlagValue>();
  for (const m of matched) {
    if ((TIER_WEIGHTS[m.tier] ?? 0) < thresholdWeight) continue;
    for (const t of m.triggers) flags.add(t);
  }
  return Array.from(flags);
}

export function computeAllergenAlerts(matched: IngredientSeed[], profile: AllergenProfileValue[]): AllergenAlert[] {
  const alerts: AllergenAlert[] = [];
  for (const allergen of profile) {
    const targetId = ALLERGEN_ID_MAP[allergen];
    const hit = matched.find(m => m.id === targetId);
    if (hit) alerts.push({ allergen, ingredient_name: hit.name, severity: 'critical' });
  }
  return alerts;
}
