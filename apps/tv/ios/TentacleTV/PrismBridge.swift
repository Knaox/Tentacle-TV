import Foundation
import PrismCore

/// Module RN `PrismBridge` (ancienne architecture : `RCT_EXTERN_MODULE` dans
/// PrismBridge.m). Trois méthodes — `start`, `stop`, `fallbackMuxed` — et un
/// évènement `prismCheckpoint` qui raconte l'ouverture au fil de l'eau à
/// l'écran de chargement. PrismCore n'est PAS un lecteur : il rend une URL de
/// playlist, AVPlayer (react-native-video) et toute l'UI restent les nôtres.
@objc(PrismBridge)
final class PrismBridge: RCTEventEmitter, @unchecked Sendable {
    static let checkpointEvent = "prismCheckpoint"
    private var hasListeners = false

    /// Rien n'exige le thread principal à l'init : les lectures d'écran se font
    /// plus tard, dans le registre, sur le MainActor.
    override class func requiresMainQueueSetup() -> Bool { false }

    /// Obligatoire : sans cette liste, `sendEvent` lève au premier jalon.
    override func supportedEvents() -> [String]! { [Self.checkpointEvent] }
    override func startObserving() { hasListeners = true }
    override func stopObserving() { hasListeners = false }

    /// Ouvre une session : `{url, headers, preferredAudioLanguage, segmentCacheBytes}`
    /// → `{url, gen, planOrigin, audioTracks, subtitleRenditions, durationSec,
    /// displaySwitch, displaySettle, panelIsHDR}`. Le rejet porte un code lisible
    /// (`PrismErrorCode`) : le JS journalise et retombe sur PlaybackInfo.
    @objc func start(_ config: NSDictionary,
                     resolver resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let parsed = PrismSessionConfig(config) else {
            reject("args", "PrismBridge.start : « url » manquante ou invalide", nil)
            return
        }
        Task.detached { [weak self] in
            do {
                let result = try await PrismSessionRegistry.shared.start(parsed) { gen, mark in
                    self?.emitCheckpoint(gen: gen, mark)
                }
                resolve(result.asDictionary())
            } catch {
                reject(PrismErrorCode.of(error), String(describing: error), error)
            }
        }
    }

    /// Arrête la session `gen` seulement — gen-gardé, comme l'ancien `cancel`.
    @objc func stop(_ gen: NSNumber) {
        let value = gen.intValue
        Task.detached { await PrismSessionRegistry.shared.stop(gen: value) }
    }

    /// Master refusé par AVPlayer : la même session, rejouée en forme muxée.
    @objc func fallbackMuxed(_ gen: NSNumber,
                             resolver resolve: @escaping RCTPromiseResolveBlock,
                             rejecter reject: @escaping RCTPromiseRejectBlock) {
        let value = gen.intValue
        Task.detached { [weak self] in
            do {
                let result = try await PrismSessionRegistry.shared.makeMuxedFallback(gen: value) { gen, mark in
                    self?.emitCheckpoint(gen: gen, mark)
                }
                resolve(result.asDictionary())
            } catch {
                reject(PrismErrorCode.of(error), String(describing: error), error)
            }
        }
    }

    private func emitCheckpoint(gen: Int, _ mark: StartupCheckpoint) {
        guard hasListeners else { return }
        var body: [String: Any] = [
            "gen": gen,
            "phase": Self.phaseName(mark.phase),
            "elapsedMs": Int(mark.elapsed / .milliseconds(1)),
        ]
        if case .segmentPlanReady(let origin, let segments) = mark.phase {
            body["origin"] = origin.rawValue
            body["segments"] = segments
        }
        sendEvent(withName: Self.checkpointEvent, body: body)
    }

    private static func phaseName(_ phase: StartupPhase) -> String {
        switch phase {
        case .sourceOpened: return "sourceOpened"
        case .streamInfoResolved: return "streamInfoResolved"
        case .segmentPlanReady: return "segmentPlanReady"
        case .firstVideoSegmentWritten: return "firstVideoSegmentWritten"
        case .playlistServable: return "playlistServable"
        }
    }
}
