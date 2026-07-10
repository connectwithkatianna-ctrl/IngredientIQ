import Foundation

/// Settings shared between the container app and the keyboard extension via
/// an App Group (must match the group checked in both targets' Signing &
/// Capabilities tab).
enum SharedSettings {
    static let appGroupId = "group.com.katianna.ingredientiq"

    private static var defaults: UserDefaults {
        UserDefaults(suiteName: appGroupId) ?? .standard
    }

    private enum Keys {
        static let apiKey = "iiq_api_key"
        static let allergenProfile = "iiq_allergen_profile"
        static let sensitivity = "iiq_sensitivity" // "concern" | "review" | "all"
    }

    static var apiKey: String {
        get { defaults.string(forKey: Keys.apiKey) ?? "" }
        set { defaults.set(newValue, forKey: Keys.apiKey) }
    }

    static var allergenProfile: [AllergenProfileValue] {
        get {
            let raw = defaults.stringArray(forKey: Keys.allergenProfile) ?? []
            return raw.compactMap { AllergenProfileValue(rawValue: $0) }
        }
        set { defaults.set(newValue.map { $0.rawValue }, forKey: Keys.allergenProfile) }
    }

    static var sensitivity: String {
        get { defaults.string(forKey: Keys.sensitivity) ?? "concern" }
        set { defaults.set(newValue, forKey: Keys.sensitivity) }
    }
}
