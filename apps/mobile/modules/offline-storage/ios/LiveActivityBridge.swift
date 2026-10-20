#if canImport(ActivityKit) && os(iOS)
import ActivityKit
import Foundation

/// Démarre, met à jour et termine LA Live Activity des transferts hors ligne.
/// Une seule à la fois : un lot de plusieurs titres se dit dans une seule
/// activité (« 3 titres · Prêt dans 12 min »). Le JavaScript décide de tout
/// (`livePublish.ts` d'offline-core) ; ici, on ne fait qu'appliquer.
@available(iOS 16.2, *)
enum LiveActivityBridge {
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
  static func present(_ raw: [String: Any]) async -> Bool {
    guard isEnabled() else { return false }
    let state = state(from: raw)
    let content = ActivityContent(state: state, staleDate: staleDate(state))
    let running = Activity<TransferActivityAttributes>.activities
    if let current = running.first {
      for extra in running.dropFirst() { await extra.end(nil, dismissalPolicy: .immediate) }
      await current.update(content)
      return true
    }
    do {
      _ = try Activity.request(attributes: TransferActivityAttributes(), content: content, pushType: nil)
      return true
    } catch {
      return false
    }
  }

  /// Le lot est fini (ou abandonné) : l'activité s'efface tout de suite — la
  /// notification « Prêt à regarder hors ligne » prend le relais.
  static func end() async {
    for activity in Activity<TransferActivityAttributes>.activities {
      await activity.end(nil, dismissalPolicy: .immediate)
    }
  }
}
#endif
