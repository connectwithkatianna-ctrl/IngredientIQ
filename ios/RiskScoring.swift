import Foundation

enum RiskEngine {
    static let tierWeights: [Tier: Int] = [
        .banned: 100, .allergen: 80, .concern: 60, .review: 40, .secret: 35, .safe: 0,
    ]

    static func analyze(
        foodName: String,
        rawIngredients: [String],
        allergenProfile: [AllergenProfileValue] = [],
        db: IngredientDatabase
    ) -> AnalysisResult {
        let personalIds = Set(allergenProfile.map { $0.ingredientId })
        var seen = Set<String>()
        var matches: [MatchedIngredient] = []

        for raw in rawIngredients {
            guard let entry = db.matchIngredient(raw), !seen.contains(entry.id) else { continue }
            seen.insert(entry.id)
            matches.append(MatchedIngredient(entry: entry, input: raw, isPersonalAllergen: personalIds.contains(entry.id)))
        }

        let hasBanned = matches.contains { $0.entry.tier == .banned }
        let hasPersonalAllergen = matches.contains { $0.isPersonalAllergen }

        let rawAvg: Double = matches.isEmpty
            ? 0
            : Double(matches.reduce(0) { $0 + (tierWeights[$1.entry.tier] ?? 0) }) / Double(matches.count)

        let score = min(100, Int(rawAvg.rounded()) + (hasBanned ? 20 : 0) + (hasPersonalAllergen ? 15 : 0))

        let worst = matches.max { (tierWeights[$0.entry.tier] ?? 0) < (tierWeights[$1.entry.tier] ?? 0) }?.entry

        return AnalysisResult(
            foodName: foodName,
            matches: matches,
            riskScore: score,
            riskLevel: riskLabel(score),
            worst: worst
        )
    }

    static func riskLabel(_ score: Int) -> String {
        switch score {
        case 81...: return "Critical"
        case 61...80: return "High"
        case 36...60: return "Moderate"
        case 16...35: return "Low"
        default: return "Minimal"
        }
    }

    /// End-to-end: resolve typed text (as it's entered into another app's
    /// search field) to ingredients via the product map, falling back to
    /// treating the raw text itself as ingredient tokens so a user can type
    /// an ingredient name directly (e.g. "aspartame").
    static func analyzeTypedText(
        _ text: String,
        allergenProfile: [AllergenProfileValue] = [],
        db: IngredientDatabase
    ) -> AnalysisResult {
        if let productIngredients = db.matchProduct(text) {
            return analyze(foodName: text, rawIngredients: productIngredients, allergenProfile: allergenProfile, db: db)
        }
        let tokens = [text] + text.split(whereSeparator: { $0 == " " || $0 == "," }).map(String.init)
        return analyze(foodName: text, rawIngredients: tokens, allergenProfile: allergenProfile, db: db)
    }
}
