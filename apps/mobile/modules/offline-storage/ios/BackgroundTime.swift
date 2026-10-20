import Foundation
import UIKit

/// Un délai d'exécution en arrière-plan pour le suivi en direct.
///
/// iOS suspend le JavaScript quelques secondes après le départ de
/// l'application ; le transfert, lui, continue dans la session d'arrière-plan
/// du système, mais la Live Activity ne peut plus être mise à jour. Quand
/// l'utilisateur part juste après « Garder hors ligne », le débit n'est pas
/// encore mesuré : l'activité restait figée sur « Calcul du temps restant… »
/// pendant tout le transfert. Ce délai (une trentaine de secondes, accordé ou
/// non par le système) laisse au JavaScript le temps de publier un temps
/// restant mesuré — ensuite, compte à rebours et barre avancent seuls.
///
/// Rendu par le JavaScript dès que le suivi n'en a plus besoin, et toujours
/// avant que le système ne le reprenne (gestionnaire d'expiration).
/// Appelé depuis le fil du JavaScript : tout se passe sur le fil principal
/// (UIApplication), dans l'ordre des appels.
enum BackgroundTime {
  @MainActor private static var task: UIBackgroundTaskIdentifier = .invalid

  static func hold() {
    Task { @MainActor in
      guard task == .invalid else { return }
      task = UIApplication.shared.beginBackgroundTask(withName: "tentacle-live-transfer") {
        BackgroundTime.endOnMain()
      }
    }
  }

  static func release() {
    Task { @MainActor in endOnMain() }
  }

  @MainActor private static func endOnMain() {
    let identifier = task
    task = .invalid
    if identifier != .invalid { UIApplication.shared.endBackgroundTask(identifier) }
  }
}
