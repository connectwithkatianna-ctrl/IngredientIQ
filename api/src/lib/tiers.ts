import { TierDefinition } from '../types';

export const TIERS: TierDefinition[] = [
  {
    value: 'banned',
    label: 'Banned / Revoked',
    description: 'FDA authorization revoked or explicitly prohibited under 21 CFR Part 189.',
    risk_weight: 100,
    color_hex: '#E24B4A',
    sources: ['FDA'],
  },
  {
    value: 'allergen',
    label: 'Big 9 Allergen',
    description: 'One of the Big 9 major food allergens per FSIS Directive 7230.1.',
    risk_weight: 80,
    color_hex: '#EF9F27',
    sources: ['FDA', 'FSIS'],
  },
  {
    value: 'concern',
    label: 'High Concern',
    description: 'Currently GRAS/approved but linked to harm by NTP, IARC, or state regulatory action.',
    risk_weight: 60,
    color_hex: '#BA7517',
    sources: ['FDA', 'FSIS'],
  },
  {
    value: 'review',
    label: 'Under FDA Review',
    description: "On FDA's active post-market reassessment list (2025).",
    risk_weight: 40,
    color_hex: '#378ADD',
    sources: ['FDA'],
  },
  {
    value: 'secret_gras',
    label: 'Secret GRAS',
    description: 'Self-affirmed safe by the manufacturer without FDA notification.',
    risk_weight: 35,
    color_hex: '#7F77DD',
    sources: ['EWG'],
  },
  {
    value: 'safe',
    label: 'GRAS / Approved',
    description: 'FDA-reviewed GRAS or formally approved additive with a strong safety record.',
    risk_weight: 0,
    color_hex: '#639922',
    sources: ['FDA'],
  },
];

export const TIER_WEIGHTS: Record<string, number> = Object.fromEntries(
  TIERS.map(t => [t.value, t.risk_weight])
);

export const TIER_LABELS: Record<string, string> = Object.fromEntries(TIERS.map(t => [t.value, t.label]));
