import AVFoundation
import ExpoModulesCore
import Foundation

/// L'exclusion de la sauvegarde iCloud (règle 2.23 de l'App Store) : les
/// titres gardés hors ligne se re-transfèrent depuis le serveur, ils ne
/// doivent pas gonfler la sauvegarde de l'appareil. Certaines opérations
/// système remettent l'attribut à zéro : l'application le repose à chaque
/// fin de transfert.
public class OfflineStorageModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OfflineStorage")

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
        remuxFragmented(source: source, promise: promise)
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
private func remuxFragmented(source: URL, promise: Promise) {
  let target = URL(fileURLWithPath: source.path + ".finalizing")
  try? FileManager.default.removeItem(at: target)
  let asset = AVURLAsset(url: source)
  guard let session = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetPassthrough) else {
    promise.resolve("failed")
    return
  }
  session.outputURL = target
  session.outputFileType = .mp4
  session.shouldOptimizeForNetworkUse = true
  session.exportAsynchronously {
    guard session.status == .completed else {
      try? FileManager.default.removeItem(at: target)
      promise.resolve("failed")
      return
    }
    _ = Mp4Boxes.promoteHevcTag(at: target)
    do {
      _ = try FileManager.default.replaceItemAt(source, withItemAt: target)
      promise.resolve("ok")
    } catch {
      try? FileManager.default.removeItem(at: target)
      promise.resolve("failed")
    }
  }
}
