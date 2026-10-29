import ExpoModulesCore
import Foundation
import UIKit

/// Le réveil de l'application par la session d'arrière-plan : des transferts
/// remis au système viennent de finir pendant qu'elle dormait.
///
/// expo-file-system rend la main au système DÈS que la session a livré ses
/// évènements (`URLSessionDidFinishEventsForBackgroundURLSession`) — avant que
/// le JavaScript ait vu la fin du transfert, et donc avant qu'il remette les
/// SUIVANTS à la session. Une playlist gardée hors ligne, application quittée,
/// n'allait qu'au bout des trois titres déjà en vol (29/10).
///
/// Le gestionnaire d'Expo attend la réponse de TOUS les abonnés avant de rendre
/// la main (`ExpoAppDelegateSubscriberManager`) : on retient donc la nôtre le
/// temps que le moteur voie ses fins et lance la suite (`offlinePushWake.ts`,
/// le même chemin que la push « préparation prête »). Les tâches qu'il remet
/// pendant ce temps vont au bout sans lui, et leur fin le réveille à nouveau.
public class OfflineSessionWakeSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    handleEventsForBackgroundURLSession identifier: String,
    completionHandler: @escaping () -> Void
  ) {
    OfflineLog.write("hors-ligne-fond", "réveil par la session d'arrière-plan : relance de la file")
    PushWake.deliver(SessionWake.itemPrefix + identifier)
    // Sous les trente secondes qu'iOS accorde à ce réveil.
    DispatchQueue.main.asyncAfter(deadline: .now() + PushWake.windowSeconds) {
      completionHandler()
    }
  }
}

enum SessionWake {
  /// Ce que le JavaScript reçoit à la place d'un identifiant de titre : un réveil de session.
  static let itemPrefix = "session:"
}
