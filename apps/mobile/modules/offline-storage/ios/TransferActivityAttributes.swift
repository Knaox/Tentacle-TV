// ⚠️ Recopié OCTET POUR OCTET dans targets/TransferLiveActivity/ (l'extension
// de widget) : ActivityKit relit l'état par son nom de type et ses champs.
// Le test `liveActivityMirror.test.ts` y veille.
#if canImport(ActivityKit) && os(iOS)
import ActivityKit
import Foundation

/// Le suivi en direct d'un lot de titres gardés hors ligne.
@available(iOS 16.1, *)
public struct TransferActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    /// Le titre, la série et son compte, ou le compte seul.
    public var headline: String
    /// L'état en toutes lettres (« En attente du Wi-Fi », « Prêt dans 12 min »).
    public var status: String
    /// Posé devant le compte à rebours (« Prêt dans »).
    public var readyInLabel: String
    /// `transferring`, `estimating`, `finalizing`, `waitingWifi`, `waitingNetwork`, `paused`, `retrying`.
    public var phase: String
    /// Avancement 0…1, négatif sans taille connue.
    public var fraction: Double
    /// Fin estimée : un compte à rebours SEULEMENT si elle est là.
    public var endsAt: Date?
    /// Le départ VIRTUEL de la barre (avancement nul au débit mesuré) : avec
    /// `endsAt`, la barre avance seule, application suspendue comprise.
    public var barStart: Date?
    /// Où mène un toucher.
    public var deepLink: String
  }

  public init() {}
}
#endif
