import {
  AnalyzeOptions, AnalyzedIngredient, AnalyzeSummary, RiskLevel, Tier, IngredientSeed,
} from '../types';
import { SEED, toPublicRecord, findMatch } from './ingredientDb';
import { extractCandidates } from './normalize';
import { computeFlags, computeAllergenAlerts } from './flags';
import { TIER_WEIGHTS, TIER_LABELS } from './tiers';

function riskLevel(score: number): RiskLevel {
  if (score >= 81) return 'critical';
  if (score >= 61) return 'high';
  if (score >= 36) return 'moderate';
  if (score >= 16) return 'low';
  return 'safe';
}

export interface AnalyzeCoreResult {
  ingredients: AnalyzedIngredient[];
  unmatched: string[];
  summary: AnalyzeSummary;
}

export function analyzeIngredients(rawIngredients: string[], options: AnalyzeOptions = {}): AnalyzeCoreResult {
  const threshold: Tier = options.flag_threshold || 'concern';
  const allergenProfile = options.allergen_profile || [];
  const includeSources = options.include_sources !== false;
  const includeAlternatives = !!options.include_alternatives;

  const matchedSeeds: IngredientSeed[] = [];
  const ingredients: AnalyzedIngredient[] = [];
  const unmatched: string[] = [];

  for (const raw of rawIngredients) {
    const candidates = extractCandidates(raw);
    const hit = findMatch(candidates);
    if (!hit) {
      unmatched.push(raw);
      continue;
    }
    matchedSeeds.push(hit);
    const record = toPublicRecord(hit);
    const entry: AnalyzedIngredient = {
      input: raw,
      matched: true,
      id: record.id,
      name: record.name,
      aka: record.aka,
      tier: record.tier,
      tier_label: TIER_LABELS[record.tier],
      badge: record.badge,
      category: record.category,
      cfr: record.cfr,
      health_effects: record.health_effects,
      warning_label: record.warning_label,
    };
    if (includeSources) {
      entry.sources = record.sources;
      entry.regulatory_actions = record.regulatory_actions;
    }
    if (includeAlternatives && ['concern', 'review', 'secret_gras', 'banned'].includes(record.tier) && hit.alternatives) {
      entry.alternatives = hit.alternatives;
    }
    ingredients.push(entry);
  }

  const allergenAlerts = computeAllergenAlerts(matchedSeeds, allergenProfile);
  let flags = computeFlags(matchedSeeds, threshold);
  if (allergenAlerts.length && !flags.includes('personal_allergen_detected')) {
    flags = [...flags, 'personal_allergen_detected'];
  }

  const tierCounts = { banned: 0, allergen: 0, concern: 0, review: 0, secret_gras: 0, safe: 0 };
  for (const m of matchedSeeds) tierCounts[m.tier] += 1;

  const matchedCount = matchedSeeds.length;
  const weightSum = matchedSeeds.reduce((s, m) => s + (TIER_WEIGHTS[m.tier] ?? 0), 0);
  const base = matchedCount ? weightSum / matchedCount : 0;
  const bannedBonus = matchedSeeds.some(m => m.tier === 'banned') ? 20 : 0;
  const allergenBonus = allergenAlerts.length ? 15 : 0;
  const riskScore = Math.max(0, Math.min(100, Math.round(base + bannedBonus + allergenBonus)));

  const summary: AnalyzeSummary = {
    total: rawIngredients.length,
    matched: matchedCount,
    unmatched: unmatched.length,
    risk_score: riskScore,
    risk_level: riskLevel(riskScore),
    tier_counts: tierCounts,
    flags,
    allergen_alerts: allergenAlerts,
  };

  return { ingredients, unmatched, summary };
}
