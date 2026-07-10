import Foundation

final class IngredientDatabase {
    let entries: [IngredientEntry]
    let products: [String: [String]]
    let dbVersion: String

    /// Loads ingredients.json from the app/extension bundle. Use this in the
    /// keyboard extension and container app targets.
    static let shared = IngredientDatabase(url: Bundle.main.url(forResource: "ingredients", withExtension: "json"))

    private struct RawDB: Codable {
        let db_version: String
        let ingredients: [IngredientEntry]
        let products: [String: [String]]
    }

    convenience init(url: URL?) {
        let data = url.flatMap { try? Data(contentsOf: $0) } ?? Data()
        self.init(data: data)
    }

    init(data: Data) {
        let decoded = try? JSONDecoder().decode(RawDB.self, from: data)
        self.entries = decoded?.ingredients ?? []
        self.products = decoded?.products ?? [:]
        self.dbVersion = decoded?.db_version ?? "unknown"
    }

    /// Matches a single raw ingredient string (e.g. "Red 40" or "enriched
    /// flour") against the flagged-ingredient database. Substring matching in
    /// both directions mirrors the existing extension/PWA behavior.
    func matchIngredient(_ raw: String) -> IngredientEntry? {
        let lq = raw.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        guard !lq.isEmpty else { return nil }
        for entry in entries {
            for key in entry.keys where lq.contains(key) || key.contains(lq) {
                return entry
            }
        }
        return nil
    }

    /// Fuzzy-matches a typed food name (e.g. "doritos nacho cheese") against
    /// the bundled product map. Ports findProductMatch() from the mobile PWA.
    /// Connector words that shouldn't count as a meaningful match signal in
    /// the word-overlap fallback below (e.g. "m and ms" reduces to just
    /// "and" once "m"/"ms" are filtered by length, which would otherwise
    /// false-match any phrase containing the word "and").
    private static let stopWords: Set<String> = [
        "and", "the", "with", "for", "of", "in", "on", "a", "an", "to", "or", "n",
    ]

    func matchProduct(_ foodName: String) -> [String]? {
        let lq = foodName.lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "®", with: "")
            .replacingOccurrences(of: "™", with: "")
        guard !lq.isEmpty else { return nil }

        var best: [String]?
        var bestScore = 0.0

        for (key, ings) in products {
            var score = 0.0
            if lq == key {
                score = 100
            } else if lq.contains(key) {
                score = 70 + Double(key.split(separator: " ").count) * 5
            } else if key.contains(lq) {
                score = 60
            } else {
                let keyWords = key.split(separator: " ").map(String.init)
                    .filter { $0.count > 2 && !Self.stopWords.contains($0) }
                let matchCount = keyWords.filter { lq.contains($0) }.count
                if matchCount > 0 && !keyWords.isEmpty {
                    score = (Double(matchCount) / Double(keyWords.count)) * 55
                }
            }
            if score > bestScore {
                bestScore = score
                best = ings
            }
        }
        return bestScore >= 45 ? best : nil
    }
}
