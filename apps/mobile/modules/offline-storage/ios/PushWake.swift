import ExpoModulesCore
import Foundation
import UIKit

/// Le réveil de l'application par le serveur : une push SILENCIEUSE
/// (`content-available`, type `offline:prepared`) quand une préparation tenue
/// par le serveur s'achève sans que le téléphone la lise — son transfert a été
/// coupé pendant qu'il dormait. iOS rend la main au JavaScript une trentaine de
/// secondes : le moteur relance aussitôt ce qui attendait (`offlinePushWake.ts`),
/// et la tâche remise à la session d'arrière-plan va au bout sans lui.
///
/// Une push qui n'est pas la nôtre ne nous concerne pas : `.noData`, et
/// expo-notifications, abonné lui aussi, fait son travail.
public class OfflinePushWakeSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    guard let itemId = PushWake.preparedItem(in: userInfo) else {
      completionHandler(.noData)
      return
    }
    OfflineLog.write("hors-ligne-fond", "réveil par le serveur : préparation prête (\(itemId))")
    PushWake.deliver(itemId)
    // Le temps de relancer les transferts ; la tâche remise au système, elle,
    // n'a pas besoin que l'application reste éveillée.
    DispatchQueue.main.asyncAfter(deadline: .now() + PushWake.windowSeconds) {
      completionHandler(.newData)
    }
  }
}

enum PushWake {
  /// Le type posé par le serveur (`PREPARED_PUSH_TYPE`). Ne se renomme pas.
  static let type = "offline:prepared"
  static let notification = Notification.Name("TentacleOfflinePrepared")
  /// Sous les trente secondes qu'iOS accorde à une push de fond.
  static let windowSeconds = 25.0

  /// Réveils arrivés avant que le JavaScript n'écoute (lancement à froid).
  /// Le module écoute depuis son fil, la push arrive sur le fil principal : un verrou.
  private static let lock = NSLock()
  private static var pending: [String] = []
  private static var listening = false

  /// Expo range les données de la push sous `body` ; on lit aussi la racine et `data`.
  static func preparedItem(in userInfo: [AnyHashable: Any]) -> String? {
    var candidates: [[String: Any]] = []
    if let root = userInfo as? [String: Any] { candidates.append(root) }
    for key in ["body", "data"] {
      if let nested = userInfo[key] as? [String: Any] {
        candidates.append(nested)
      } else if let text = userInfo[key] as? String,
                let data = text.data(using: .utf8),
                let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
        candidates.append(parsed)
      }
    }
    for candidate in candidates where candidate["type"] as? String == type {
      return candidate["itemId"] as? String ?? ""
    }
    return nil
  }

  static func deliver(_ itemId: String) {
    lock.lock()
    let live = listening
    if !live { pending.append(itemId) }
    lock.unlock()
    if live {
      NotificationCenter.default.post(name: notification, object: nil, userInfo: ["itemId": itemId])
    }
  }

  /// Le JavaScript écoute : rend ce qui attendait, et les suivants passeront directement.
  static func startListening() -> [String] {
    lock.lock()
    defer { lock.unlock() }
    listening = true
    let waiting = pending
    pending.removeAll()
    return waiting
  }

  static func stopListening() {
    lock.lock()
    listening = false
    lock.unlock()
  }
}
