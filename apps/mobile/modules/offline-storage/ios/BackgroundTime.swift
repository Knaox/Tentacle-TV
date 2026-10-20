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
///
/// Plusieurs détenteurs, chacun son nom : le suivi en direct
/// (`liveTransfer`) et la finalisation d'un fichier Allégé réveillée en
/// arrière-plan (`OfflineStorageModule.finalizeMp4`) ne se rendent pas le
/// délai l'un de l'autre.
enum BackgroundTime {
  static let liveTransfer = "tentacle-live-transfer"
  @MainActor private static var tasks: [String: UIBackgroundTaskIdentifier] = [:]

  static func hold(_ name: String = liveTransfer) {
    Task { @MainActor in
      guard tasks[name] == nil else { return }
      tasks[name] = UIApplication.shared.beginBackgroundTask(withName: name) {
        BackgroundTime.endOnMain(name)
      }
    }
  }

  static func release(_ name: String = liveTransfer) {
    Task { @MainActor in endOnMain(name) }
  }

  @MainActor private static func endOnMain(_ name: String) {
    guard let identifier = tasks.removeValue(forKey: name) else { return }
    if identifier != .invalid { UIApplication.shared.endBackgroundTask(identifier) }
  }
}
