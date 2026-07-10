import Foundation

enum Tier: String, Codable, CaseIterable {
    case banned, allergen, concern, review, secret, safe
}

struct IngredientEntry: Codable {
    let id: String
    let keys: [String]
    let name: String
    let tier: Tier
    let badge: String
    let warning: String
}

struct MatchedIngredient {
    let entry: IngredientEntry
    let input: String
    let isPersonalAllergen: Bool
}

struct AnalysisResult {
    let foodName: String
    let matches: [MatchedIngredient]
    let riskScore: Int
    let riskLevel: String
    let worst: IngredientEntry?
    var isClean: Bool { matches.isEmpty }
}

/// Matches the allergen picker in the container app's settings screen.
enum AllergenProfileValue: String, Codable, CaseIterable {
    case peanuts, milk, eggs, wheat, soy, shellfish, fish
    case treeNuts = "tree_nuts"
    case sesame

    /// The ingredient-entry id each allergen maps to in ingredients.json.
    var ingredientId: String {
        switch self {
        case .peanuts: return "peanuts"
        case .milk: return "milk"
        case .eggs: return "eggs"
        case .wheat: return "wheat"
        case .soy: return "soy"
        case .shellfish: return "shellfish"
        case .fish: return "fish"
        case .treeNuts: return "tree_nuts"
        case .sesame: return "sesame"
        }
    }
}
