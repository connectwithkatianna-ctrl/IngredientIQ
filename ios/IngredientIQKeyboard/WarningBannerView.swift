import UIKit

extension UIColor {
    convenience init(hex: String) {
        var hexString = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexString = hexString.replacingOccurrences(of: "#", with: "")
        var rgb: UInt64 = 0
        Scanner(string: hexString).scanHexInt64(&rgb)
        self.init(
            red: CGFloat((rgb & 0xFF0000) >> 16) / 255,
            green: CGFloat((rgb & 0x00FF00) >> 8) / 255,
            blue: CGFloat(rgb & 0x0000FF) / 255,
            alpha: 1
        )
    }
}

enum TierColor {
    static func color(for tier: Tier) -> UIColor {
        switch tier {
        case .banned: return UIColor(hex: "#E24B4A")
        case .allergen: return UIColor(hex: "#EF9F27")
        case .concern: return UIColor(hex: "#BA7517")
        case .review: return UIColor(hex: "#378ADD")
        case .secret: return UIColor(hex: "#7F77DD")
        case .safe: return UIColor(hex: "#34C759")
        }
    }
}

/// The bar shown above the keys. Three states: idle (nothing typed yet),
/// clean (typed text produced no match), and warning (flagged ingredients
/// found), each rendered compactly since keyboard extensions have very
/// little vertical space to work with.
final class WarningBannerView: UIView {
    private let dot = UIView()
    private let label = UILabel()
    private let detailLabel = UILabel()
    private let stack = UIStackView()

    override init(frame: CGRect) {
        super.init(frame: frame)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        backgroundColor = UIColor.secondarySystemBackground

        dot.layer.cornerRadius = 4
        dot.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            dot.widthAnchor.constraint(equalToConstant: 8),
            dot.heightAnchor.constraint(equalToConstant: 8),
        ])

        label.font = .systemFont(ofSize: 13, weight: .semibold)
        label.numberOfLines = 1
        label.text = "Type a food name to check it"
        label.textColor = .secondaryLabel

        detailLabel.font = .systemFont(ofSize: 11, weight: .regular)
        detailLabel.numberOfLines = 1
        detailLabel.textColor = .tertiaryLabel

        let textStack = UIStackView(arrangedSubviews: [label, detailLabel])
        textStack.axis = .vertical
        textStack.spacing = 1

        stack.axis = .horizontal
        stack.alignment = .center
        stack.spacing = 8
        stack.isLayoutMarginsRelativeArrangement = true
        stack.layoutMargins = UIEdgeInsets(top: 6, left: 10, bottom: 6, right: 10)
        stack.addArrangedSubview(dot)
        stack.addArrangedSubview(textStack)
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor),
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
    }

    func showIdle() {
        dot.backgroundColor = .systemGray4
        label.text = "Type a food name to check it"
        label.textColor = .secondaryLabel
        detailLabel.text = nil
    }

    func showClean(foodName: String) {
        dot.backgroundColor = UIColor(hex: "#34C759")
        label.text = "No flags for \"\(foodName)\""
        label.textColor = .label
        detailLabel.text = "Local database — add API key in IngredientIQ app for full lookup"
    }

    func showWarning(result: AnalysisResult) {
        guard let worst = result.worst else { return showIdle() }
        dot.backgroundColor = TierColor.color(for: worst.tier)
        label.text = "\(result.matches.count) flag\(result.matches.count == 1 ? "" : "s") · \(result.riskScore)/100 \(result.riskLevel)"
        label.textColor = TierColor.color(for: worst.tier)
        let names = result.matches.prefix(3).map { $0.entry.name }.joined(separator: ", ")
        detailLabel.text = names
    }
}
