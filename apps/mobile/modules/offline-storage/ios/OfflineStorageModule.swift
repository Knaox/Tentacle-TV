import AVFoundation
import ExpoModulesCore
import Foundation

/// L'exclusion de la sauvegarde iCloud (règle 2.23 de l'App Store) : les
/// titres gardés hors ligne se re-transfèrent depuis le serveur, ils ne
/// doivent pas gonfler la sauvegarde de l'appareil. Certaines opérations
/// système remettent l'attribut à zéro : l'application le repose à chaque
/// fin de transfert.
public class OfflineStorageModule: Module {
  /// L'écoute des réveils « préparation prête » (`PushWake.swift`).
  private var preparedObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("OfflineStorage")

    // Le serveur a fini de préparer un titre pendant que l'application dormait.
    Events("onOfflinePrepared")

    OnStartObserving {
      guard self.preparedObserver == nil else { return }
      self.preparedObserver = NotificationCenter.default.addObserver(
        forName: PushWake.notification, object: nil, queue: .main
      ) { [weak self] note in
        self?.sendEvent("onOfflinePrepared", ["itemId": note.userInfo?["itemId"] as? String ?? ""])
      }
      for itemId in PushWake.startListening() {
        self.sendEvent("onOfflinePrepared", ["itemId": itemId])
      }
    }

    OnStopObserving {
      if let observer = self.preparedObserver { NotificationCenter.default.removeObserver(observer) }
      self.preparedObserver = nil
      PushWake.stopListening()
    }

    Function("setExcludedFromBackup") { (uri: String, excluded: Bool) throws -> Bool in
      let candidate = uri.hasPrefix("file://") ? URL(string: uri) : URL(fileURLWithPath: uri)
      guard var url = candidate else {
        throw NSError(domain: "OfflineStorage", code: 1, userInfo: [NSLocalizedDescriptionKey: "invalid path: \(uri)"])
      }
      var values = URLResourceValues()
      values.isExcludedFromBackup = excluded
      try url.setResourceValues(values)
      return true
    }

    // Le service de premier plan n'existe que sur Android : sur iOS, la
    // session d'arrière-plan d'expo-file-system suffit. Même surface, sans effet.
    AsyncFunction("startTransferService") { (_: String, _: String, _: String) -> Bool in
      false
    }

    Function("updateTransferService") { (_: String) -> Bool in
      false
    }

    AsyncFunction("stopTransferService") { () -> Bool in
      false
    }

    // La Live Activity des transferts (écran verrouillé, Dynamic Island) —
    // iOS 16.2 et plus, et seulement si l'utilisateur ne l'a pas coupée dans
    // les réglages du téléphone. Ailleurs : `false`, sans bruit.
    Function("liveActivitiesEnabled") { () -> Bool in
      #if canImport(ActivityKit) && os(iOS)
      if #available(iOS 16.2, *) { return LiveActivityBridge.isEnabled() }
      #endif
      return false
    }

    // Rend `shown`, `dismissed` ou `refused:<cause>` (voir `LiveActivityBridge.present`).
    AsyncFunction("presentLiveActivity") { (state: [String: Any]) async -> String in
      #if canImport(ActivityKit) && os(iOS)
      if #available(iOS 16.2, *) { return await LiveActivityBridge.present(state) }
      #endif
      return "refused:unsupported"
    }

    AsyncFunction("endLiveActivity") { () async -> Bool in
      #if canImport(ActivityKit) && os(iOS)
      if #available(iOS 16.2, *) {
        await LiveActivityBridge.end()
        return true
      }
      #endif
      return false
    }

    // Le journal du hors ligne, lisible sur un téléphone de production (`OfflineLog.swift`).
    Function("logPublic") { (category: String, message: String) -> Bool in
      OfflineLog.write(category, message)
      return true
    }

    // Le délai d'arrière-plan du suivi en direct (`BackgroundTime.swift`).
    Function("holdBackgroundTime") { () -> Bool in
      BackgroundTime.hold()
      return true
    }

    Function("releaseBackgroundTime") { () -> Bool in
      BackgroundTime.release()
      return true
    }

    // La finalisation d'un fichier Allégé, et son verdict :
    //
    //   `unusable` — aucun `moov` : le transfert s'est achevé avant que
    //                Jellyfin serve l'index. Rien ici ne le répare, et s'y
    //                reprendre à trois fois ne fait qu'user la batterie : le
    //                moteur retéléchargera.
    //   `ok`       — le fichier se lit. S'il portait déjà son index, on ne le
    //                réécrit PAS : recopier 500 Mo pour avancer un `moov` n'a
    //                aucun intérêt sur un fichier lu en local, et exigeait le
    //                double d'espace disque le temps de l'export.
    //   `failed`   — l'export d'un fichier fragmenté a échoué ; l'original
    //                reste intact et la finalisation se retentera.
    //   `noaudio`  — l'export a réussi, mais il a laissé tomber LA piste
    //                audio : le titre serait muet. On le jette, et le moteur
    //                le dit au lieu de le présenter comme prêt.
    //
    // Dans tous les cas où le fichier est exploitable, l'entrée d'échantillon
    // HEVC est promue en `hvc1` : voir `Mp4Boxes`.
    AsyncFunction("finalizeMp4") { (path: String, promise: Promise) in
      let cleaned = path.hasPrefix("file://") ? String(path.dropFirst(7)) : path
      let source = URL(fileURLWithPath: cleaned)
      switch Mp4Boxes.index(of: source) {
      case .missing:
        promise.resolve("unusable")
      case .indexed:
        _ = Mp4Boxes.promoteHevcTag(at: source)
        promise.resolve("ok")
      case .fragmented:
        // Réveillée en arrière-plan (fin d'un transfert, push du serveur),
        // l'application n'a que quelques secondes : l'export les dépasse
        // souvent. Un délai à son nom, rendu à la fin dans tous les cas.
        let hold = "tentacle-finalize-\(source.lastPathComponent)"
        BackgroundTime.hold(hold)
        remuxFragmented(source: source) { verdict in
          promise.resolve(verdict)
          BackgroundTime.release(hold)
        }
      }
    }

    // Réparation des titres déjà sur l'appareil, transférés avant que la
    // promotion existe : quelques kilo-octets lus, quatre octets écrits.
    AsyncFunction("promoteHevcTag") { (path: String) -> Bool in
      let cleaned = path.hasPrefix("file://") ? String(path.dropFirst(7)) : path
      return Mp4Boxes.promoteHevcTag(at: URL(fileURLWithPath: cleaned))
    }
  }
}

/// Remux SANS ré-encodage d'un MP4 fragmenté (transcodage progressif de
/// Jellyfin : ni index ni durée) en MP4 classique, sur place. Passthrough
/// AVFoundation ; l'original n'est remplacé qu'une fois le nouveau écrit.
///
/// Le passthrough vers un `.mp4` ABANDONNE EN SILENCE les pistes que le
/// conteneur cible refuse : l'export réussit, et le titre n'a plus de son. On
/// compte donc les pistes audio des deux côtés avant de remplacer quoi que ce
/// soit. Une source qui n'en avait aucune n'a rien perdu.
private func remuxFragmented(source: URL, resolve: @escaping (String) -> Void) {
  let target = URL(fileURLWithPath: source.path + ".finalizing")
  try? FileManager.default.removeItem(at: target)
  let expectedAudio = Mp4Boxes.audioTrackCount(of: source)
  let asset = AVURLAsset(url: source)
  guard let session = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetPassthrough) else {
    resolve("failed")
    return
  }
  session.outputURL = target
  session.outputFileType = .mp4
  session.shouldOptimizeForNetworkUse = true
  session.exportAsynchronously {
    guard session.status == .completed else {
      try? FileManager.default.removeItem(at: target)
      resolve("failed")
      return
    }
    if expectedAudio > 0, Mp4Boxes.audioTrackCount(of: target) == 0 {
      try? FileManager.default.removeItem(at: target)
      resolve("noaudio")
      return
    }
    _ = Mp4Boxes.promoteHevcTag(at: target)
    do {
      _ = try FileManager.default.replaceItemAt(source, withItemAt: target)
      resolve("ok")
    } catch {
      try? FileManager.default.removeItem(at: target)
      resolve("failed")
    }
  }
}
