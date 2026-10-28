import Foundation

/// Un titre interrompu AU MILIEU (flux rompu, trame illisible, fichier tronqué) ne s'arrête pas et ne passe pas
/// au suivant : il se reprend là où il en était, puis, si l'arrêt revient au même endroit (un défaut DANS le
/// fichier), de plus en plus loin, au-delà de la zone abîmée. Miroir de la règle partagée du web
/// (`packages/shared/src/octave/engine/midTrackRecovery.ts`) : mêmes constantes.
struct MidTrackRecovery {
  static let marginMs = 2000.0
  static let maxRecoveries = 3
  static let skipsMs: [Double] = [0, 1000, 6000]
  static let progressMs = 10_000.0

  private var key: String?
  private var attempts = 0
  private var lastMs: Double?
  private var resumedAt: Double?

  /// Une position JOUÉE du titre `trackKey` (ms).
  mutating func played(_ trackKey: String, _ positionMs: Double) {
    follow(trackKey)
    guard positionMs > 0 else { return }
    lastMs = positionMs
    if let resumedAt, positionMs - resumedAt >= Self.progressMs {
      attempts = 0
      self.resumedAt = nil
    }
  }

  /// Le titre s'est interrompu : où le reprendre (la reprise est comptée), ou `nil` (vraie fin, reprises épuisées).
  mutating func take(_ trackKey: String, durationMs: Double?) -> Double? {
    follow(trackKey)
    guard let position = lastMs, position > 0, let duration = durationMs, duration > 0,
          attempts < Self.maxRecoveries, position < duration - Self.marginMs else { return nil }
    let at = min(position + Self.skipsMs[attempts], duration - Self.marginMs)
    attempts += 1
    lastMs = at
    resumedAt = at
    return at
  }

  /// Un titre lancé ou repositionné : tout repart de zéro.
  mutating func reset() {
    key = nil
    attempts = 0
    lastMs = nil
    resumedAt = nil
  }

  private mutating func follow(_ trackKey: String) {
    guard trackKey != key else { return }
    reset()
    key = trackKey
  }
}
