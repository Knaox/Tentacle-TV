#if canImport(ActivityKit) && os(iOS)
import ActivityKit
import Foundation

/// Démarre, met à jour et termine LA Live Activity des transferts hors ligne.
/// Une seule à la fois : un lot de plusieurs titres se dit dans une seule
/// activité (« 3 titres · Prêt dans 12 min »). Le JavaScript décide de tout
/// (`livePublish.ts` d'offline-core) ; ici, on ne fait qu'appliquer.
@available(iOS 16.2, *)
enum LiveActivityBridge {
  /// Les activités terminées par l'application elle-même, pour ne pas les
  /// prendre pour un geste de la personne. Les appels du JavaScript passent
  /// à la file (`liveSurface.ts`) : jamais deux à la fois.
  private static var endedHere = Set<String>()

  static func isEnabled() -> Bool {
    ActivityAuthorizationInfo().areActivitiesEnabled
  }

  static func state(from raw: [String: Any]) -> TransferActivityAttributes.ContentState {
    let endsAtMs = raw["endsAtMs"] as? Double ?? 0
    return TransferActivityAttributes.ContentState(
      headline: raw["headline"] as? String ?? "",
      status: raw["status"] as? String ?? "",
      readyInLabel: raw["readyInLabel"] as? String ?? "",
      phase: raw["phase"] as? String ?? "estimating",
      fraction: raw["fraction"] as? Double ?? -1,
      endsAt: endsAtMs > 0 ? Date(timeIntervalSince1970: endsAtMs / 1000) : nil,
      deepLink: raw["deepLink"] as? String ?? "tentacle://on-device"
    )
  }

  /// La fin estimée passée de cinq minutes sans nouvelles : l'activité se dit « périmée ».
  private static func staleDate(_ state: TransferActivityAttributes.ContentState) -> Date? {
    state.endsAt.map { $0.addingTimeInterval(5 * 60) }
  }

  /// Pose ou met à jour ; une activité laissée par un lancement d'avant est reprise, jamais doublée.
  ///
  /// Rend ce qui s'est passé, pour que le JavaScript sache retenter :
  /// `shown` (posée ou mise à jour), `dismissed` (balayée par la personne :
  /// on ne la repose pas), `refused:<cause>` (iOS a refusé — le plus souvent
  /// une application déjà passée derrière, seule fenêtre où ActivityKit
  /// refuse un démarrage). Chaque refus est écrit au journal du système
  /// (`[suivi-direct]`), lisible dans Console.app sur un vrai téléphone.
  static func present(_ raw: [String: Any]) async -> String {
    guard isEnabled() else {
      NSLog("[suivi-direct] Activités en direct coupées pour Tentacle TV (réglages du téléphone)")
      return "refused:disabled"
    }
    let state = state(from: raw)
    let content = ActivityContent(state: state, staleDate: staleDate(state))
    let all = Activity<TransferActivityAttributes>.activities
    let running = all.filter { $0.activityState == .active || $0.activityState == .stale }
    if let current = running.first {
      for extra in running.dropFirst() { await extra.end(nil, dismissalPolicy: .immediate) }
      await current.update(content)
      return "shown"
    }
    // Balayée de l'écran verrouillé pendant ce lot : la personne n'en veut pas.
    // Celles que NOUS avons terminées (fin d'un lot, `.immediate`) passent
    // aussi « dismissed » : elles ne comptent pas.
    if all.contains(where: { $0.activityState == .dismissed && !endedHere.contains($0.id) }) { return "dismissed" }
    do {
      _ = try Activity.request(attributes: TransferActivityAttributes(), content: content, pushType: nil)
      return "shown"
    } catch {
      NSLog("[suivi-direct] démarrage refusé par ActivityKit : %@", String(describing: error))
      return "refused:\(error)"
    }
  }

  /// Le lot est fini (ou abandonné) : l'activité s'efface tout de suite — la
  /// notification « Prêt à regarder hors ligne » prend le relais.
  static func end() async {
    for activity in Activity<TransferActivityAttributes>.activities {
      endedHere.insert(activity.id)
      await activity.end(nil, dismissalPolicy: .immediate)
    }
  }
}
#endif
