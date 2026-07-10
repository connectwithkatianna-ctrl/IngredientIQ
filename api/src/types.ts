export type Tier = 'banned' | 'allergen' | 'concern' | 'review' | 'secret_gras' | 'safe';

export type IngredientCategory =
  | 'allergen' | 'additive' | 'color' | 'contaminant' | 'emulsifier' | 'extract'
  | 'fat' | 'flavoring' | 'preservative' | 'protein' | 'supplement' | 'sweetener';

export type RiskLevel = 'safe' | 'low' | 'moderate' | 'high' | 'critical';

export type AllergenProfileValue =
  | 'peanuts' | 'tree_nuts' | 'milk' | 'eggs' | 'fish' | 'shellfish' | 'wheat' | 'soy' | 'sesame';

export type FlagValue =
  | 'contains_banned_substance'
  | 'contains_big9_allergen'
  | 'personal_allergen_detected'
  | 'probable_carcinogen_present'
  | 'endocrine_disruptor_present'
  | 'synthetic_dye_under_review'
  | 'secret_gras_ingredient'
  | 'high_fructose_corn_syrup'
  | 'aspartame_pku_warning'
  | 'nitrate_nitrite_present'
  | 'sulfite_present';

export interface RegulatoryAction {
  body: string;
  status: string;
  year?: number;
  note?: string;
}

export interface Alternative {
  name: string;
  reason: string;
  tier?: Tier;
}

export interface IngredientRecord {
  id: string;
  name: string;
  aka?: string;
  tier: Tier;
  badge?: string;
  category: IngredientCategory;
  cfr?: string;
  health_effects?: string;
  warning_label?: string;
  sources?: string[];
  regulatory_actions?: RegulatoryAction[];
  match_keys?: string[];
}

/** Internal seed record — includes fields never returned directly to callers. */
export interface IngredientSeed extends IngredientRecord {
  match_keys: string[];
  triggers: FlagValue[];
  alternatives?: Alternative[];
}

export interface AnalyzedIngredient {
  input: string;
  matched: boolean;
  id?: string;
  name?: string;
  aka?: string;
  tier?: Tier;
  tier_label?: string;
  badge?: string;
  category?: IngredientCategory;
  cfr?: string;
  health_effects?: string;
  warning_label?: string;
  sources?: string[];
  regulatory_actions?: RegulatoryAction[];
  alternatives?: Alternative[];
}

export interface AnalyzeOptions {
  allergen_profile?: AllergenProfileValue[];
  flag_threshold?: Tier;
  include_alternatives?: boolean;
  include_sources?: boolean;
  fdc_api_key?: string;
  /** BYOK Anthropic key for the web-search fallback (barcode and name lookups). */
  anthropic_api_key?: string;
}

export interface NameLookupRequest {
  food_name: string;
  options?: AnalyzeOptions;
}

export interface ProductMetadata {
  product_name?: string;
  barcode?: string;
}

export interface AnalyzeRequest {
  ingredients: string[];
  options?: AnalyzeOptions;
  metadata?: ProductMetadata;
}

export interface BarcodeRequest {
  barcode: string;
  options?: AnalyzeOptions;
}

export interface TierCounts {
  banned: number;
  allergen: number;
  concern: number;
  review: number;
  secret_gras: number;
  safe: number;
}

export interface AllergenAlert {
  allergen: AllergenProfileValue;
  ingredient_name: string;
  severity: 'critical' | 'warning';
}

export interface AnalyzeSummary {
  total: number;
  matched: number;
  unmatched: number;
  risk_score: number;
  risk_level: RiskLevel;
  tier_counts: TierCounts;
  flags: FlagValue[];
  allergen_alerts: AllergenAlert[];
}

export interface AnalyzeResponse {
  request_id: string;
  analyzed_at: string;
  db_version: string;
  summary: AnalyzeSummary;
  ingredients: AnalyzedIngredient[];
  unmatched_ingredients: string[];
  metadata?: ProductMetadata & { echo?: boolean };
}

export interface ProductInfo {
  barcode: string;
  product_name: string;
  brand?: string;
  image_url?: string | null;
  serving_size?: string;
  nutriscore_grade?: 'a' | 'b' | 'c' | 'd' | 'e' | null;
  ingredients_raw: string;
  lookup_source: 'open_food_facts' | 'usda_fdc' | 'web_search';
}

export interface BarcodeResponse extends AnalyzeResponse {
  product: ProductInfo;
}

export interface TierDefinition {
  value: Tier;
  label: string;
  description?: string;
  risk_weight: number;
  color_hex: string;
  sources?: string[];
}

export interface DatabaseVersion {
  version: string;
  released_at: string;
  total_ingredients: number;
  tier_counts: TierCounts;
  sources?: { name: string; url: string; last_synced: string }[];
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    field?: string;
  };
  request_id: string;
}
