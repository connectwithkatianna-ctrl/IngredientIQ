import SwiftUI

struct SettingsView: View {
    @State private var apiKey: String = SharedSettings.apiKey
    @State private var sensitivity: String = SharedSettings.sensitivity
    @State private var allergens: Set<AllergenProfileValue> = Set(SharedSettings.allergenProfile)

    var body: some View {
        Form {
            Section("Warning sensitivity") {
                Picker("Warn for", selection: $sensitivity) {
                    Text("High concern & above").tag("concern")
                    Text("Under review & above").tag("review")
                    Text("All flagged ingredients").tag("all")
                }
                .pickerStyle(.inline)
                .onChange(of: sensitivity) { SharedSettings.sensitivity = $0 }
            }

            Section("My allergens") {
                ForEach(AllergenProfileValue.allCases, id: \.self) { allergen in
                    Button {
                        toggle(allergen)
                    } label: {
                        HStack {
                            Text(allergen.rawValue.replacingOccurrences(of: "_", with: " ").capitalized)
                                .foregroundColor(.primary)
                            Spacer()
                            if allergens.contains(allergen) {
                                Image(systemName: "checkmark").foregroundColor(.accentColor)
                            }
                        }
                    }
                }
            }

            Section {
                SecureField("sk-ant-...", text: $apiKey)
                    .onChange(of: apiKey) { SharedSettings.apiKey = $0 }
                    .autocorrectionDisabled()
            } header: {
                Text("Anthropic API key (optional)")
            } footer: {
                Text("Only used when \"Allow Full Access\" is enabled for the keyboard. Without it, the bundled 127-product/40-ingredient database is used, entirely offline.")
            }
        }
        .navigationTitle("Settings")
    }

    private func toggle(_ allergen: AllergenProfileValue) {
        if allergens.contains(allergen) {
            allergens.remove(allergen)
        } else {
            allergens.insert(allergen)
        }
        SharedSettings.allergenProfile = Array(allergens)
    }
}

#Preview {
    NavigationView { SettingsView() }
}
