import fs from 'fs';
import path from 'path';
import { IngredientSeed, IngredientRecord, Tier, IngredientCategory, DatabaseVersion } from '../types';

interface RawDB {
  version: string;
  released_at: string;
  sources: { name: string; url: string; last_synced: string }[];
  ingredients: IngredientSeed[];
}

const dataPath = path.join(__dirname, '..', 'data', 'ingredients.json');
const raw: RawDB = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

export const DB_VERSION = raw.version;
export const DB_RELEASED_AT = raw.released_at;
export const DB_SOURCES = raw.sources;
export const SEED: IngredientSeed[] = raw.ingredients;

const byId = new Map<string, IngredientSeed>();
for (const entry of SEED) byId.set(entry.id, entry);

export function toPublicRecord(entry: IngredientSeed): IngredientRecord {
  const { triggers, alternatives, ...rest } = entry;
  return rest;
}

export function getIngredientById(id: string): IngredientRecord | undefined {
  const entry = byId.get(id.toLowerCase());
  return entry ? toPublicRecord(entry) : undefined;
}

/** First DB entry whose match_keys overlaps (either direction) any candidate string. */
export function findMatch(candidates: string[]): IngredientSeed | undefined {
  for (const candidate of candidates) {
    if (!candidate) continue;
    for (const entry of SEED) {
      if (entry.match_keys.some(k => candidate.includes(k) || k.includes(candidate))) {
        return entry;
      }
    }
  }
  return undefined;
}

export function searchIngredients(opts: {
  q: string;
  tier?: string;
  category?: string;
  limit: number;
  offset: number;
}): { results: IngredientRecord[]; total: number } {
  const q = opts.q.toLowerCase();
  let matches = SEED.filter(
    e =>
      e.name.toLowerCase().includes(q) ||
      (e.aka || '').toLowerCase().includes(q) ||
      e.match_keys.some(k => k.includes(q))
  );
  if (opts.tier) matches = matches.filter(e => e.tier === (opts.tier as Tier));
  if (opts.category) matches = matches.filter(e => e.category === (opts.category as IngredientCategory));

  const total = matches.length;
  const page = matches.slice(opts.offset, opts.offset + opts.limit).map(toPublicRecord);
  return { results: page, total };
}

export function getDbMeta(): DatabaseVersion {
  const tier_counts = { banned: 0, allergen: 0, concern: 0, review: 0, secret_gras: 0, safe: 0 };
  for (const e of SEED) tier_counts[e.tier] += 1;
  return {
    version: DB_VERSION,
    released_at: DB_RELEASED_AT,
    total_ingredients: SEED.length,
    tier_counts,
    sources: DB_SOURCES,
  };
}
