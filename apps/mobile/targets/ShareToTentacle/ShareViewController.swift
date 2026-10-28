import UIKit

/// Partage système vers Tentacle TV (feuille de partage d'iOS) : rien à l'écran. Le lien et le texte reçus
/// sont rendus TELS QUELS dans le lien profond `tentacle://octave/import?shared=<texte>`, puis l'app s'ouvre ;
/// c'est le JavaScript qui y trouve le lien de playlist (`sharedImportLink`, shared). Aucun App Group : rien
/// n'est gardé ici. Source : `apps/mobile/targets/ShareToTentacle/`, recopiée par `withShareToTentacle`.
final class ShareViewController: UIViewController {
  // Le paramètre et la borne de `@tentacle-tv/shared/octave/mode` (sharedImport.ts) : jamais renommés.
  private static let param = "shared"
  private static let maxLength = 4096
  private var handled = false

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .clear
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    guard !handled else { return }
    handled = true
    collectSharedText { [weak self] text in
      DispatchQueue.main.async { self?.finish(with: text) }
    }
  }

  /// Le lien (`public.url`) et le texte (`public.plain-text`, le message de l'extension compris), une ligne chacun.
  private func collectSharedText(_ done: @escaping (String) -> Void) {
    let items = (extensionContext?.inputItems as? [NSExtensionItem]) ?? []
    var parts: [String] = items.compactMap { $0.attributedContentText?.string }
    let lock = NSLock()
    let group = DispatchGroup()
    for provider in items.flatMap({ $0.attachments ?? [] }) {
      for type in ["public.url", "public.plain-text"] where provider.hasItemConformingToTypeIdentifier(type) {
        group.enter()
        provider.loadItem(forTypeIdentifier: type, options: nil) { item, _ in
          let value = (item as? URL)?.absoluteString ?? (item as? String) ?? (item as? NSAttributedString)?.string
          if let value, !value.isEmpty {
            lock.lock()
            parts.append(value)
            lock.unlock()
          }
          group.leave()
        }
      }
    }
    group.notify(queue: .global()) { done(parts.joined(separator: "\n")) }
  }

  private func finish(with text: String) {
    let shared = String(text.prefix(Self.maxLength))
    if !shared.isEmpty, let url = Self.deepLink(shared) { openHostApp(url) }
    extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
  }

  /// `tentacle://octave/import?shared=<texte>`, le texte encodé caractère par caractère (ni `&`, ni `+`, ni `=` nus).
  private static func deepLink(_ text: String) -> URL? {
    var allowed = CharacterSet.alphanumerics
    allowed.insert(charactersIn: "-._~")
    guard let encoded = text.addingPercentEncoding(withAllowedCharacters: allowed) else { return nil }
    return URL(string: "tentacle://octave/import?\(param)=\(encoded)")
  }

  /// Une extension n'a pas `UIApplication.shared` : l'application se trouve en remontant la chaîne des
  /// répondeurs, et `openURL:options:completionHandler:` s'appelle par le runtime (l'ancien `openURL:` ne
  /// fait plus rien depuis iOS 18).
  private func openHostApp(_ url: URL) {
    let selector = NSSelectorFromString("openURL:options:completionHandler:")
    var responder: UIResponder? = self
    while let current = responder {
      if current.isKind(of: UIApplication.self), current.responds(to: selector), let method = current.method(for: selector) {
        typealias OpenURL = @convention(c) (NSObject, Selector, NSURL, NSDictionary, (@convention(block) (Bool) -> Void)?) -> Void
        let open = unsafeBitCast(method, to: OpenURL.self)
        open(current, selector, url as NSURL, NSDictionary(), nil)
        return
      }
      responder = current.next
    }
  }
}
