import SwiftUI

struct ContentView: View {
    var body: some View {
        NavigationView {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("IngredientIQ Keyboard")
                            .font(.title2.bold())
                        Text("Get live ingredient-safety warnings while typing a food name into any app — including MacrosFirst.")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 6)
                }

                Section("Setup") {
                    setupStep(number: 1, title: "Open Settings", detail: "Settings → General → Keyboard → Keyboards → Add New Keyboard…")
                    setupStep(number: 2, title: "Select IngredientIQ", detail: "It appears under \"Third-Party Keyboards\"")
                    setupStep(number: 3, title: "Allow Full Access (optional)", detail: "Only needed if you add an API key below for foods outside the built-in 127-product database")
                    setupStep(number: 4, title: "Switch keyboards while typing", detail: "In MacrosFirst's search field, tap the 🌐 globe key and choose IngredientIQ to see warnings live")
                }

                Section("Settings") {
                    NavigationLink("Allergens, sensitivity & API key") {
                        SettingsView()
                    }
                }

                Section("About") {
                    HStack {
                        Text("Database")
                        Spacer()
                        Text("\(IngredientDatabase.shared.entries.count) ingredients · \(IngredientDatabase.shared.products.count) products")
                            .foregroundColor(.secondary)
                    }
                    HStack {
                        Text("Version")
                        Spacer()
                        Text(IngredientDatabase.shared.dbVersion)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .navigationTitle("IngredientIQ")
        }
    }

    private func setupStep(number: Int, title: String, detail: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text("\(number)")
                .font(.caption.bold())
                .frame(width: 22, height: 22)
                .background(Circle().fill(Color.primary.opacity(0.1)))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.medium))
                Text(detail).font(.caption).foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 2)
    }
}

#Preview {
    ContentView()
}
