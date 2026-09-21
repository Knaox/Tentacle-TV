// Dérivé de Streamyfin — https://github.com/streamyfin/streamyfin
// (modules/mpv-player/ios/Logger.swift, révision 4faddc5f du 2026-09-12),
// publié sous Mozilla Public License 2.0. Ce fichier reste couvert par la
// MPL-2.0 (https://mozilla.org/MPL/2.0/) ; adaptation Tentacle TV : anneau en
// mémoire sans fichier, notification pour le pont JS, commentaires en français.
import Foundation

/// Journal du lecteur avancé : impression en DEBUG, anneau des dernières lignes
/// pour le panneau « Détails », et notification relayée à JS (`onNativeLog`)
/// seulement quand un écouteur est abonné.
final class MpvLogger: @unchecked Sendable {
  static let shared = MpvLogger()
  static let notificationName = Notification.Name("TentacleMpvLog")

  struct Entry {
    let message: String
    let type: String
    let timestamp: Date
  }

  private let queue = DispatchQueue(label: "tentacle.mpv.logger")
  private var entries: [Entry] = []
  private let maxEntries = 200

  private init() {}

  func log(_ message: String, type: String = "Info") {
    let entry = Entry(message: message, type: type, timestamp: Date())
    queue.async {
      self.entries.append(entry)
      if self.entries.count > self.maxEntries {
        self.entries.removeFirst(self.entries.count - self.maxEntries)
      }
      #if DEBUG
      print("[mpv][\(type)] \(message)")
      #endif
      DispatchQueue.main.async {
        NotificationCenter.default.post(
          name: Self.notificationName, object: nil,
          userInfo: ["message": message, "type": type]
        )
      }
    }
  }

  /// Les dernières lignes, les plus récentes en dernier.
  func recent() -> [String] {
    queue.sync { entries.map { "[\($0.type)] \($0.message)" } }
  }
}
