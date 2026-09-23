import AVFoundation
import Foundation
import PrismCore
import UIKit

/// Ce que le pont refuse de lui-même, avant PrismCore.
enum PrismBridgeError: Error {
    /// La génération demandée n'existe plus (déjà stoppée ou remplacée).
    case superseded
}

/// Le côté AFFICHAGE, sur le MainActor : `DisplayCriteriaController` écrit
/// `preferredDisplayCriteria` sur la fenêtre clé et lit l'écran, deux choses
/// qu'UIKit n'accepte que du thread principal.
@MainActor
final class PrismDisplayHost {
    static let shared = PrismDisplayHost()
    private var controller: DisplayCriteriaController?

    struct Outcome: Sendable {
        let applied: String
        let settle: String?
        let panelIsHDR: Bool
    }

    private func ensureController() -> DisplayCriteriaController? {
        if let controller { return controller }
        let windows = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
        guard let window = windows.first(where: \.isKeyWindow) ?? windows.first else { return nil }
        let made = DisplayCriteriaController(window: window)
        controller = made
        return made
    }

    /// Programme le panneau pour `choice` et attend la bascule quand il y en a
    /// une. tvOS valide la plage d'un master HDR contre le mode COURANT du
    /// panneau, de façon synchrone : charger avant le settle, c'est un -11868
    /// assuré. Le rapport de settle est rendu tel quel pour le journal.
    func apply(_ choice: DisplayCriteriaChoice) async -> Outcome {
        guard let controller = ensureController() else {
            return Outcome(applied: "noWindow", settle: nil, panelIsHDR: false)
        }
        let result = controller.apply(choice)
        var settle: String? = nil
        if result == .willSwitch {
            settle = await controller.waitForSwitch().summary
        }
        return Outcome(applied: Self.name(result), settle: settle, panelIsHDR: controller.currentPanelIsHDR())
    }

    /// Retour au mode par défaut du panneau — seulement si c'est nous qui
    /// l'avons écrit (le contrôleur le sait).
    func reset() { controller?.reset() }

    private static func name(_ result: DisplayCriteriaController.ApplyResult) -> String {
        switch result {
        case .willSwitch: return "willSwitch"
        case .wrote: return "wrote"
        case .alreadyActive: return "alreadyActive"
        case .matchingDisabled: return "matchingDisabled"
        }
    }
}

/// Les sessions PrismCore vivantes, par génération. Un `navigation.replace`
/// vers l'épisode suivant lance le `start()` du nouvel écran AVANT le démontage
/// de l'ancien, qui lit encore : on garde donc la session courante ET la
/// précédente, et le `stop(gen)` de l'ancien écran n'arrête que la sienne. Tout
/// ce qui est plus vieux est stoppé d'office (garde-fou contre les fuites).
actor PrismSessionRegistry {
    static let shared = PrismSessionRegistry()

    typealias CheckpointSink = @Sendable (Int, StartupCheckpoint) -> Void

    private var nextGen = 0
    private var sessions: [Int: PrismCoreSession] = [:]
    /// La génération qui a écrit les critères d'affichage : seule elle les
    /// remet à zéro, sinon le démontage d'un écran périmé repasserait le
    /// panneau en SDR sous la lecture suivante.
    private var criteriaOwnerGen: Int?

    func start(_ config: PrismSessionConfig, onCheckpoint: @escaping CheckpointSink) async throws -> PrismStartResult {
        // Le numéro AVANT tout await : deux start() concurrents ne partagent jamais un gen.
        nextGen += 1
        let gen = nextGen
        let cacheDirectory = Self.keyframeCacheDirectory()
        // `readingCurrentDisplay` est MainActor : il lit `AVPlayer.availableHDRModes`
        // et l'écran — c'est ce qui autorise un master HDR / Dolby Vision.
        // `preferredSubtitleLanguage` n'est JAMAIS passé : les sous-titres texte
        // restent l'overlay JS, une rendition `DEFAULT=YES` ferait dessiner AVKit
        // par-dessus.
        let session = try await MainActor.run {
            try PrismCoreSession.readingCurrentDisplay(
                url: config.url,
                httpHeaders: config.headers,
                segmentCacheBytes: config.segmentCacheBytes ?? PrismSessionConfig.defaultSegmentCacheBytes,
                keyframeIndexCacheDirectory: cacheDirectory,
                preferredAudioLanguage: config.preferredAudioLanguage
            )
        }
        return try await bringUp(session, gen: gen, onCheckpoint: onCheckpoint)
    }

    func stop(gen: Int) async {
        guard let session = sessions.removeValue(forKey: gen) else { return }
        await session.stop()
        if criteriaOwnerGen == gen {
            criteriaOwnerGen = nil
            await PrismDisplayHost.shared.reset()
        }
    }

    /// AVPlayer a refusé le master (-11868 / -11848 / -1002) : PrismCore rejoue
    /// le titre en forme muxée (une piste audio dans la variante, sans
    /// renditions). Une session ne mint qu'UN successeur — un second appel
    /// pour le même gen lève, et le JS retombe alors sur PlaybackInfo.
    func makeMuxedFallback(gen: Int, onCheckpoint: @escaping CheckpointSink) async throws -> PrismStartResult {
        guard let previous = sessions[gen] else { throw PrismBridgeError.superseded }
        nextGen += 1
        let successorGen = nextGen
        let successor = try await previous.makeMuxedFallbackSession()
        let result = try await bringUp(successor, gen: successorGen, onCheckpoint: onCheckpoint)
        // Le prédécesseur s'arrête APRÈS que le successeur sert : contrat PrismCore.
        sessions[gen] = nil
        await previous.stop()
        if criteriaOwnerGen == gen { criteriaOwnerGen = successorGen }
        return result
    }

    private func bringUp(_ session: PrismCoreSession, gen: Int, onCheckpoint: @escaping CheckpointSink) async throws -> PrismStartResult {
        // Le flux de jalons se prend AVANT start() — après, PrismCore refuse. Il se
        // termine toujours (succès, échec, stop), la pompe ne fuit donc jamais.
        let checkpoints = try await session.startupCheckpoints()
        let pump = Task.detached { () -> (duration: Double?, origin: String) in
            var duration: Double? = nil
            var origin = "unknown"
            for await mark in checkpoints {
                switch mark.phase {
                case .streamInfoResolved(let info): duration = info.duration
                case .segmentPlanReady(let planOrigin, _): origin = planOrigin.rawValue
                default: break
                }
                onCheckpoint(gen, mark)
            }
            return (duration, origin)
        }
        let url: URL
        do {
            url = try await session.start(startupTimeout: .seconds(30))
        } catch {
            pump.cancel()
            await session.stop()
            throw error
        }
        let observed = await pump.value
        // Les critères d'affichage AVANT que le JS charge la playlist (cf. PrismDisplayHost).
        var display: PrismDisplayHost.Outcome? = nil
        if let choice = await session.displayCriteria {
            display = await PrismDisplayHost.shared.apply(choice)
            criteriaOwnerGen = gen
        }
        sessions[gen] = session
        await reap(olderThan: gen - 1)
        let audio = session.audioTrackDeliveries.map {
            PrismAudioTrack(streamIndex: $0.streamIndex, delivery: $0.delivery.rawValue)
        }
        let subtitles = await session.subtitleRenditions.map {
            PrismSubtitleRendition(name: $0.name, language: $0.language, uri: $0.uri, isForced: $0.isForced)
        }
        return PrismStartResult(
            url: url, gen: gen, planOrigin: observed.origin,
            audioTracks: audio, subtitleRenditions: subtitles, durationSec: observed.duration,
            displaySwitch: display?.applied, displaySettle: display?.settle, panelIsHDR: display?.panelIsHDR
        )
    }

    private func reap(olderThan keepFrom: Int) async {
        for gen in sessions.keys.filter({ $0 < keepFrom }).sorted() {
            if let session = sessions.removeValue(forKey: gen) { await session.stop() }
            if criteriaOwnerGen == gen { criteriaOwnerGen = nil }
        }
    }

    /// Le cache d'index de keyframes, dans `Caches/` : sans lui, un MKV sans
    /// Cues ou un MPEG-TS rejoue en mode séquentiel (playlist EVENT) à CHAQUE
    /// première lecture ; avec, PrismCore récolte l'index en passant et le
    /// rejoue à la lecture suivante. Perdre une entrée ne coûte qu'un
    /// visionnage séquentiel — `Caches/` est le bon endroit.
    private nonisolated static func keyframeCacheDirectory() -> URL? {
        guard let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else { return nil }
        let directory = base.appendingPathComponent("PrismCoreKeyframes", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }
}
