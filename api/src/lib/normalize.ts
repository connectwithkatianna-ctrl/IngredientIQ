export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s()&%.-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits a raw ingredient string into match candidates, resolving
 * parenthetical sub-ingredients against the same database (per the OpenAPI
 * spec's normalization rules), e.g. "Enriched Flour (Wheat, Niacin)" ->
 * ["enriched flour", "wheat", "niacin"].
 */
export function extractCandidates(raw: string): string[] {
  const norm = normalize(raw);
  const candidates = new Set<string>();
  candidates.add(norm);

  const bracketMatch = norm.match(/^(.*?)\(([^)]+)\)(.*)$/);
  if (bracketMatch) {
    const outer = (bracketMatch[1] + ' ' + bracketMatch[3]).trim();
    if (outer) candidates.add(outer);
    bracketMatch[2].split(/[,;]/).map(t => t.trim()).filter(Boolean).forEach(t => candidates.add(t));
  } else {
    norm.split(/[,;]/).map(t => t.trim()).filter(Boolean).forEach(t => candidates.add(t));
  }
  return Array.from(candidates);
}
