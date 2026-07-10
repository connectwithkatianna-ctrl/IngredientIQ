import Foundation

/// Row layout for the two keyboard pages this extension supports. A full
/// system keyboard has more pages (symbols, emoji, etc.) — this covers
/// letters + numbers/punctuation, which is enough for typing a food name
/// into a search field. Extend with more pages if you need them.
enum KeyboardPage {
    case letters
    case numbers
}

enum KeyboardLayout {
    static let letterRows: [[String]] = [
        ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
        ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
        ["⇧", "z", "x", "c", "v", "b", "n", "m", "⌫"],
    ]

    static let numberRows: [[String]] = [
        ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
        ["-", "/", ":", ";", "(", ")", "$", "&", "@"],
        [".", ",", "?", "!", "'", "⌫"],
    ]
}
