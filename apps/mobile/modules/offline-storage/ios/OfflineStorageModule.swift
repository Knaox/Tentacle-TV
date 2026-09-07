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

    // Remux SANS ré-encodage d'un MP4 fragmenté (mode Allégé : transcodage
    // progressif Jellyfin, sans index ni durée) en MP4 classique, sur place.
    // Passthrough AVFoundation ; `false` si l'export échoue — le fichier
    // d'origine reste alors intact.
    AsyncFunction("finalizeMp4") { (path: String, promise: Promise) in
      let cleaned = path.hasPrefix("file://") ? String(path.dropFirst(7)) : path
      let source = URL(fileURLWithPath: cleaned)
      let target = URL(fileURLWithPath: cleaned + ".finalizing")
      try? FileManager.default.removeItem(at: target)
      let asset = AVURLAsset(url: source)
      guard let session = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetPassthrough) else {
        promise.resolve(false)
        return
      }
      session.outputURL = target
      session.outputFileType = .mp4
      session.shouldOptimizeForNetworkUse = true
      session.exportAsynchronously {
        guard session.status == .completed else {
          try? FileManager.default.removeItem(at: target)
          promise.resolve(false)
          return
        }
        do {
          _ = try FileManager.default.replaceItemAt(source, withItemAt: target)
          promise.resolve(true)
        } catch {
          try? FileManager.default.removeItem(at: target)
          promise.resolve(false)
        }
      }
    }
  }
}
