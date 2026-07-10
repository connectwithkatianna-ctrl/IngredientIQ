# IngredientIQ

Real-time ingredient safety warnings, built into how food already gets logged — starting with [MacrosFirst](https://www.macrosfirst.com/).

FDA-revoked substances, undeclared allergens, ingredients under active regulatory review, and "secret GRAS" additives don't show up on a calorie tracker's nutrition summary. IngredientIQ surfaces that risk inline, at the moment food gets typed or scanned, instead of requiring a separate research step.

## The problem

Macro trackers count calories. They don't tell you what's actually in your food.

- **Banned & flagged substances hide behind brand names** — FDA-revoked additives, ingredients under active regulatory review, and "secret GRAS" extracts don't show up on a nutrition-facts summary.
- **Allergens surface after the food's already logged** — by the time you've searched and tapped "Add," you've already committed.
- **No fast way to check safety without leaving the app** — researching an ingredient list means switching apps, searching the web, and reading fine print, every time.

## The goal

Surface ingredient risk exactly where food gets logged — not as a separate research step:

- **Inline, real-time** — warnings appear the instant you type or scan, no extra step.
- **Full risk spectrum** — banned substances, Big 9 allergens, ingredients under FDA review, secret GRAS additives.
- **Built for MacrosFirst** — designed around the app already in daily use, not a generic tool.

## What's shipped

| Piece | Status | Description |
|---|---|---|
| **iOS Keyboard Extension** ([`ios/`](ios)) | ✅ Verified on a real device | Native Swift/UIKit custom keyboard. Replaces the system keyboard while active inside MacrosFirst (or any app), showing a live risk banner as you type — fully offline against the bundled database. |
| **Backend API** ([`api/`](api)) | ✅ Verified against live data | Node/TypeScript service implementing [`openapi.yaml`](openapi.yaml). Ingredient analysis engine + a barcode-lookup cascade (Open Food Facts → USDA FoodData Central → AI web-search fallback), tested end-to-end against a real UPC. |
| **Ingredient Database** ([`ios/ingredients.json`](ios/ingredients.json), [`api/src/data/ingredients.json`](api/src/data/ingredients.json)) | ✅ | 44 flagged ingredients across 186 specific products and flavors, mapped to real ingredient lists (see below). |
| **Chrome Extension** ([`chrome-extension/`](chrome-extension)) | 🧪 Built, not verified this round | MV3 extension targeting MyFitnessPal, MacrosFirst's web app, Cronometer, and Lose It — intercepts food search/log actions and shows the same warnings in-browser. |
| **Mobile PWA + camera barcode scanning** ([`mobile-pwa/`](mobile-pwa)) | ⚠️ Built, not launched — see below | Standalone iOS home-screen app with search and native camera barcode scanning. The code works; it isn't usable in real-world conditions yet. |

### The keyboard extension, in practice

Typing a food name into MacrosFirst's search field brings up a banner above the keyboard, sourced entirely from the bundled offline database:

```
quest bar
┌──────────────────────────────┐
│ ● 3 flags · 67/100 High       │
│   Milk, Soybeans, Sucralose   │
└──────────────────────────────┘
```

Verified end-to-end on a real iPhone: typed "milk," "Doritos," and "Diet Coke" and confirmed correct flags.

## Barcode scanning: built, but blocked

The Mobile PWA has a fully implemented camera-based barcode scanner (native iOS `BarcodeDetector` API, zero external dependencies, with a manual-entry fallback), and the backend's barcode-lookup cascade genuinely works — verified by scanning a real Diet Coke UPC and getting back the correct flagged ingredients (caramel color, aspartame, sodium benzoate).

**It doesn't work end-to-end on a real phone today, for two reasons:**

1. **Camera access is blocked.** Safari only grants camera permission in a secure context (HTTPS or `localhost`). Opening the raw HTML file on an iPhone (`file://`) never even asks for camera access.
2. **The backend is unreachable from a phone.** The API only ever ran on a local dev server. Without deploying it somewhere persistent, there's no address an iPhone can actually call day-to-day.

This is on the roadmap — see [Next up](#next-up).

## The database, by the numbers

- **44** flagged ingredients tracked (banned, allergen, concern, under review, secret GRAS)
- **186** specific products & flavors mapped to real ingredient lists — not just brand-level
- **6** risk tiers, matching FDA / FSIS / EWG classifications: 🔴 Banned · 🟠 Allergen · 🟤 Concern · 🔵 Review · 🟣 Secret GRAS · 🟢 Safe

Coverage goes down to the flavor level where it matters — **Gatorade Fruit Punch ≠ Gatorade Zero**: dye and sweetener are mapped per flavor, not just per brand. Same treatment for protein bars (Quest, Clif Builder's, KIND, Premier Protein, ONE Bar, and others), where allergen-adding flavors like Peanut Butter are tracked separately from the base product.

## Roadblocks solved along the way

- **Silent zero-database bug.** The bundled `ingredients.json` had a schema mismatch — the app was quietly running with zero ingredients loaded and no error shown anywhere. Root-caused by compiling the matching logic standalone and testing it directly against the actual bundled file, rather than trusting the Xcode build.
- **Multi-target iOS setup.** App Groups, per-target file membership, and Info.plist entitlements all had to be wired by hand across two build targets (container app + keyboard extension).
- **Real-device provisioning.** Scheme vs. destination mixups, trust dialogs, and first-run code-signing friction before the extension could run on a physical iPhone.

## Alternatives explored

What we tried before landing on the keyboard extension as the primary integration:

| Approach | Outcome |
|---|---|
| Chrome extension | Works only for MacrosFirst's web app — not the native iOS app most people use. |
| Camera interception inside MacrosFirst | **Not possible.** iOS sandboxes apps from each other; there's no supported API for one app to intercept another's camera session. Would require jailbreaking and hooking a third-party binary — ruled out. |
| Siri Shortcuts "Barcode Scan" action | Built and tested live. MacrosFirst does expose this action, but it's a one-way launch into MacrosFirst's own "Add Food" screen — no data is handed back to intercept before logging. |
| MacrosFirst partner API | Real and exists (nutrition history, food log data) — requires direct approval from MacrosFirst. Open path for a future "warn after logging" flow. |

## Repo structure

```
IngredientIQ/
├── ios/                  iOS app + custom keyboard extension (Xcode project)
├── chrome-extension/     MV3 browser extension (MyFitnessPal, MacrosFirst web, Cronometer, Lose It)
├── mobile-pwa/           iOS home-screen web app with search + barcode scanning
├── api/                  Node/TypeScript backend (ingredient analysis + barcode lookup cascade)
├── openapi.yaml          API contract
└── docs/                 Demo deck
```

### Running the API locally

```bash
cd api
npm install
cp .env.example .env   # fill in API_KEYS; FDC_API_KEY / ANTHROPIC_API_KEY are optional
npm run dev             # http://localhost:8787
```

### Building the iOS app

Open `ios/IngredientIQ.xcodeproj` in Xcode. Requires:
- Adding your own App Group and updating `appGroupId` in `ios/Settings.swift`
- Your own Apple Developer Team for code signing
- A real device to test the keyboard extension (the simulator has no App Store, so you can't install a host app like MacrosFirst to test against)

## Next up

- Launch the Mobile PWA with real camera barcode scanning on-device
- Deploy the backend beyond localhost so a phone can reach it
- Pursue MacrosFirst partner API access for after-the-fact log alerts
- Keep expanding flavor-level product coverage
- Verify the Chrome extension against MacrosFirst's current web app
