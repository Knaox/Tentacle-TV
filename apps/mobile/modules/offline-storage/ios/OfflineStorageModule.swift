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
  }
}
