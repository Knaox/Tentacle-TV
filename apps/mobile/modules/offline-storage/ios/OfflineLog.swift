import Foundation
import os

/// Le journal du hors ligne, LISIBLE sur un téléphone de production.
///
/// `NSLog` et la console de React Native sortent en `<private>` sur un iPhone
/// qui n'est pas en développement : les relevés du vrai téléphone de Damien
/// (20/10) ne montraient que les journaux du système, jamais les nôtres. Ici,
/// le message est marqué public : Console.app, appareil branché, filtre sur la
/// catégorie (`suivi-direct`, `hors-ligne-fond`, `transferts`).
///
/// Rien de personnel n'y passe : identifiants de titre, états, causes — jamais
/// un jeton ni une adresse.
enum OfflineLog {
  private static let subsystem = Bundle.main.bundleIdentifier ?? "com.tentacle.mobile"
  private static var loggers: [String: Logger] = [:]
  private static let lock = NSLock()

  static func write(_ category: String, _ message: String) {
    lock.lock()
    let logger = loggers[category] ?? Logger(subsystem: subsystem, category: category)
    loggers[category] = logger
    lock.unlock()
    logger.notice("\(message, privacy: .public)")
  }
}
