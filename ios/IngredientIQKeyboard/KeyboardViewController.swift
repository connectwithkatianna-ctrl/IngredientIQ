import UIKit

/// Full custom keyboard (iOS gives no way to just "add a banner" on top of
/// the system keyboard — a keyboard extension replaces it entirely while
/// active, so this has to render actual keys). Warning banner sits above the
/// key grid and updates live as the user types, using the same
/// RiskEngine/IngredientDatabase logic verified in scratch-tests/.
final class KeyboardViewController: UIInputViewController {
    private let banner = WarningBannerView()
    private let keysContainer = UIStackView()
    private var page: KeyboardPage = .letters
    private var shiftActive = false

    private lazy var db = IngredientDatabase.shared

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        buildLayout()
        renderKeys()
        banner.showIdle()
    }

    // MARK: - Layout

    private func buildLayout() {
        banner.translatesAutoresizingMaskIntoConstraints = false
        keysContainer.axis = .vertical
        keysContainer.distribution = .fillEqually
        keysContainer.spacing = 6
        keysContainer.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(banner)
        view.addSubview(keysContainer)

        NSLayoutConstraint.activate([
            banner.topAnchor.constraint(equalTo: view.topAnchor),
            banner.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            banner.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            banner.heightAnchor.constraint(equalToConstant: 40),

            keysContainer.topAnchor.constraint(equalTo: banner.bottomAnchor, constant: 6),
            keysContainer.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 4),
            keysContainer.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -4),
            keysContainer.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -4),
            keysContainer.heightAnchor.constraint(equalToConstant: 200),
        ])
    }

    private func renderKeys() {
        keysContainer.arrangedSubviews.forEach {
            keysContainer.removeArrangedSubview($0)
            $0.removeFromSuperview()
        }

        let rows = page == .letters ? KeyboardLayout.letterRows : KeyboardLayout.numberRows
        for row in rows {
            keysContainer.addArrangedSubview(makeRow(keys: row))
        }
        keysContainer.addArrangedSubview(makeBottomRow())
    }

    private func makeRow(keys: [String]) -> UIStackView {
        let row = UIStackView()
        row.axis = .horizontal
        row.distribution = .fillEqually
        row.spacing = 4
        for key in keys {
            row.addArrangedSubview(makeKeyButton(title: displayTitle(for: key), action: key))
        }
        return row
    }

    private func makeBottomRow() -> UIStackView {
        let row = UIStackView()
        row.axis = .horizontal
        row.distribution = .fill
        row.spacing = 4

        let pageToggle = makeKeyButton(title: page == .letters ? "123" : "ABC", action: "#page")
        pageToggle.widthAnchor.constraint(equalToConstant: 46).isActive = true

        let globe = makeKeyButton(title: "🌐", action: "#globe")
        globe.widthAnchor.constraint(equalToConstant: 40).isActive = true
        globe.isHidden = !needsInputModeSwitchKey

        let space = makeKeyButton(title: "space", action: "#space")
        let ret = makeKeyButton(title: "return", action: "#return")
        ret.widthAnchor.constraint(equalToConstant: 80).isActive = true

        row.addArrangedSubview(pageToggle)
        row.addArrangedSubview(globe)
        row.addArrangedSubview(space)
        row.addArrangedSubview(ret)
        return row
    }

    private func displayTitle(for key: String) -> String {
        guard page == .letters, key.count == 1 else { return key }
        return shiftActive ? key.uppercased() : key
    }

    private func makeKeyButton(title: String, action: String) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(title, for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 16)
        button.backgroundColor = .secondarySystemBackground
        button.setTitleColor(.label, for: .normal)
        button.layer.cornerRadius = 5
        button.accessibilityIdentifier = action
        button.addTarget(self, action: #selector(keyTapped(_:)), for: .touchUpInside)
        return button
    }

    // MARK: - Key handling

    @objc private func keyTapped(_ sender: UIButton) {
        guard let action = sender.accessibilityIdentifier else { return }
        switch action {
        case "⇧":
            shiftActive.toggle()
            renderKeys()
        case "⌫":
            textDocumentProxy.deleteBackward()
        case "#page":
            page = page == .letters ? .numbers : .letters
            renderKeys()
        case "#globe":
            advanceToNextInputMode()
        case "#space":
            textDocumentProxy.insertText(" ")
        case "#return":
            textDocumentProxy.insertText("\n")
        default:
            textDocumentProxy.insertText(shiftActive && page == .letters ? action.uppercased() : action)
            if shiftActive {
                shiftActive = false
                renderKeys()
            }
        }
        updateAnalysis()
    }

    // MARK: - Live analysis

    override func textDidChange(_ textInput: UITextInput?) {
        updateAnalysis()
    }

    private func updateAnalysis() {
        let before = textDocumentProxy.documentContextBeforeInput ?? ""
        // Only look at the current line/word run — a search field rarely
        // has newlines, but be defensive if the host app's field does.
        let currentQuery = before.components(separatedBy: "\n").last?.trimmingCharacters(in: .whitespaces) ?? ""

        guard currentQuery.count >= 3 else {
            banner.showIdle()
            return
        }

        let result = RiskEngine.analyzeTypedText(
            currentQuery,
            allergenProfile: SharedSettings.allergenProfile,
            db: db
        )

        if result.isClean {
            banner.showClean(foodName: currentQuery)
        } else {
            banner.showWarning(result: result)
        }
    }
}
