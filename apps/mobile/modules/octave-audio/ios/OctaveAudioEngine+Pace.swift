import Foundation
import UIKit

/// Le RYTHME de ce que le moteur dit à la page (lot « bat », 08/11) : chaque état poussé réveille le JS, et en
/// pause le moteur en envoyait encore quatre par seconde pour une position figée.
/// - Hors lecture (pause, fin, erreur, rien de chargé) : aucune horloge ; l'état part à chaque évènement.
/// - En lecture, application au premier plan : la position toutes les 250 ms, seulement si elle a bougé.
/// - Application en arrière-plan : l'horloge garde sa précision (départ du fondu, `MidTrackRecovery`, écran
///   verrouillé) mais la page ne reçoit la position qu'au plus toutes les 5 s — un changement d'état (statut,
///   titre, durée, volume, erreur) part aussitôt. Le retour au premier plan envoie l'état tout de suite.
extension OctaveAudioEngine {
  /// Au premier plan : un état par battement de l'horloge (250 ms, marge pour sa gigue).
  static let foregroundStateEvery = 0.24
  /// En arrière-plan : la position au plus toutes les 5 s (rien ne la montre ; les rapports d'écoute s'en contentent).
  static let backgroundStateEvery = 5.0

  /// Tout ce que la page lit d'un état, sauf la position : s'il change, l'état part aussitôt.
  struct StateMark: Equatable {
    let status: String
    let trackKey: String?
    let durationMs: Double?
    let volume: Double
    let muted: Bool
    let error: String?
  }

  /// L'horloge ne bat que si le son doit avancer : jamais en pause, ni après la fin ou une erreur.
  var needsTicker: Bool {
    current != nil && wantsPlay && !ended && error == nil
  }

  func markOf(status: String, durationMs: Double?) -> StateMark {
    StateMark(status: status, trackKey: current?.track.key, durationMs: durationMs, volume: volume, muted: muted, error: error)
  }

  /// Un battement de l'horloge : l'état part s'il a changé, ou si la position a bougé depuis assez longtemps ;
  /// sinon seul l'écran verrouillé est tenu à jour (il extrapole, et se republie s'il dérive).
  func paceState() {
    let status = status()
    let position = positionMs()
    let duration = frontDeck.durationMs ?? current?.durationMs
    let every = inBackground ? Self.backgroundStateEvery : Self.foregroundStateEvery
    let moved = position != sentPositionMs && Date().timeIntervalSince(lastStateAt) >= every
    if moved || markOf(status: status, durationMs: duration) != sentMark {
      emitState()
    } else {
      publishPlayback(status: status, positionMs: position, durationMs: duration)
    }
  }

  /// Premier plan / arrière-plan, suivis pour toute la vie du processus (le moteur est unique).
  func observeAppState() {
    let center = NotificationCenter.default
    _ = center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: nil) { [weak self] _ in
      self?.queue.async { self?.inBackground = true }
    }
    _ = center.addObserver(forName: UIApplication.willEnterForegroundNotification, object: nil, queue: nil) { [weak self] _ in
      self?.queue.async { self?.enterForeground() }
    }
    DispatchQueue.main.async { [weak self] in
      let background = UIApplication.shared.applicationState == .background
      self?.queue.async { self?.inBackground = background }
    }
  }

  /// De retour devant : la page reçoit l'état réel tout de suite (la position a avancé derrière).
  private func enterForeground() {
    inBackground = false
    if current != nil { emitState() }
  }
}
