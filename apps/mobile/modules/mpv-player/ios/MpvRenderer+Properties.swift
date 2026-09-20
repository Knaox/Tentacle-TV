// Dérivé de Streamyfin — https://github.com/streamyfin/streamyfin
// (modules/mpv-player/ios/MPVLayerRenderer.swift, révision 4faddc5f du
// 2026-09-12), publié sous Mozilla Public License 2.0. Ce fichier reste couvert
// par la MPL-2.0 (https://mozilla.org/MPL/2.0/) ; adaptation Tentacle TV.
import Foundation
import MPVKit

/// Accès aux propriétés et commandes libmpv. Tout ce qui bloque passe par
/// `queue` (voir l'en-tête de `MpvRenderer`).
extension MpvRenderer {
  var isOnQueue: Bool {
    DispatchQueue.getSpecific(key: Self.queueKey) == true
  }

  /// Exécute `work` sur la file mpv sans jamais bloquer l'appelant ; un appel
  /// déjà sur la file (gestionnaires d'événements, bloc de chargement) tourne
  /// en ligne pour garder son ordre.
  func onQueue(_ work: @escaping () -> Void) {
    if isOnQueue { work() } else { queue.async(execute: work) }
  }

  /// Remonte au délégué, sur le thread principal.
  func notify(_ block: @escaping (MpvRenderer, MpvRendererDelegate) -> Void) {
    DispatchQueue.main.async { [weak self] in
      guard let self, let delegate = self.delegate else { return }
      block(self, delegate)
    }
  }

  func setProperty(_ name: String, _ value: String) {
    onQueue { [weak self] in
      guard let self, let handle = self.mpv else { return }
      self.setPropertyNow(handle, name, value)
    }
  }

  /// Écriture immédiate : l'appelant est DÉJÀ sur `queue`.
  func setPropertyNow(_ handle: OpaquePointer, _ name: String, _ value: String) {
    let status = mpv_set_property_string(handle, name, value)
    if status < 0 {
      MpvLogger.shared.log("propriété refusée \(name)=\(value) (\(String(cString: mpv_error_string(status))))", type: "Warn")
    }
  }

  func getStringProperty(_ handle: OpaquePointer, _ name: String) -> String? {
    guard let cString = mpv_get_property_string(handle, name) else { return nil }
    defer { mpv_free(cString) }
    return String(cString: cString)
  }

  @discardableResult
  func getProperty<T>(_ handle: OpaquePointer, _ name: String, _ format: mpv_format, _ value: inout T) -> Int32 {
    withUnsafeMutablePointer(to: &value) { pointer in
      mpv_get_property(handle, name, format, pointer)
    }
  }

  func getInt64(_ handle: OpaquePointer, _ name: String) -> Int64? {
    var value: Int64 = 0
    return getProperty(handle, name, MPV_FORMAT_INT64, &value) >= 0 ? value : nil
  }

  func getDouble(_ handle: OpaquePointer, _ name: String) -> Double? {
    var value: Double = 0
    return getProperty(handle, name, MPV_FORMAT_DOUBLE, &value) >= 0 ? value : nil
  }

  func getFlag(_ handle: OpaquePointer, _ name: String) -> Bool? {
    var value: Int32 = 0
    return getProperty(handle, name, MPV_FORMAT_FLAG, &value) >= 0 ? value != 0 : nil
  }

  /// Commande asynchrone (mpv la traite dans l'ordre d'arrivée).
  func command(_ handle: OpaquePointer, _ args: [String]) {
    guard !args.isEmpty else { return }
    _ = withCStringArray(args) { pointer in mpv_command_async(handle, 0, pointer) }
  }

  @discardableResult
  func commandSync(_ handle: OpaquePointer, _ args: [String]) -> Int32 {
    guard !args.isEmpty else { return -1 }
    return withCStringArray(args) { pointer in mpv_command(handle, pointer) }
  }

  /// Aide au démontage : `quit` puis vidange des événements. Statique pour ne
  /// jamais capturer `self` (`stop()` peut tourner depuis `deinit`).
  static func quitAndDrain(_ handle: OpaquePointer) {
    "quit".withCString { quit in
      var args: [UnsafePointer<CChar>?] = [quit, nil]
      args.withUnsafeMutableBufferPointer { buffer in
        _ = mpv_command(handle, buffer.baseAddress)
      }
    }
    var drained = 0
    while drained < 100, let event = mpv_wait_event(handle, 0.1)?.pointee {
      if event.event_id == MPV_EVENT_NONE || event.event_id == MPV_EVENT_SHUTDOWN { break }
      drained += 1
    }
  }

  func checkError(_ status: CInt) {
    if status < 0 {
      MpvLogger.shared.log("erreur API mpv : \(String(cString: mpv_error_string(status)))", type: "Error")
    }
  }

  /// `http-header-fields` est une LISTE mpv : par l'interface des propriétés,
  /// seule la forme « a: b,c: d » passe ; vider la liste, c'est écrire "".
  /// Une valeur qui contient une virgule ne peut pas s'exprimer ici.
  func updateHTTPHeaders(_ handle: OpaquePointer, _ headers: [String: String]?) {
    setPropertyNow(handle, "http-header-fields", "")
    guard let headers, !headers.isEmpty else { return }
    let joined = headers.map { key, value in "\(key): \(value)" }.joined(separator: ",")
    setPropertyNow(handle, "http-header-fields", joined)
  }

  func observeProperties(_ handle: OpaquePointer) {
    let properties: [(String, mpv_format)] = [
      ("duration", MPV_FORMAT_DOUBLE),
      ("time-pos", MPV_FORMAT_DOUBLE),
      ("pause", MPV_FORMAT_FLAG),
      ("track-list/count", MPV_FORMAT_INT64),
      ("paused-for-cache", MPV_FORMAT_FLAG),
      ("demuxer-cache-duration", MPV_FORMAT_DOUBLE),
      ("current-ao", MPV_FORMAT_STRING),
      ("video-params/gamma", MPV_FORMAT_STRING),
    ]
    for (name, format) in properties {
      mpv_observe_property(handle, 0, name, format)
    }
  }

  @inline(__always)
  func withCStringArray<R>(_ args: [String], body: (UnsafeMutablePointer<UnsafePointer<CChar>?>?) -> R) -> R {
    var cStrings = [UnsafeMutablePointer<CChar>?]()
    cStrings.reserveCapacity(args.count + 1)
    for arg in args {
      cStrings.append(strdup(arg))
    }
    cStrings.append(nil)
    defer {
      for pointer in cStrings where pointer != nil {
        free(pointer)
      }
    }
    return cStrings.withUnsafeMutableBufferPointer { buffer in
      buffer.baseAddress!.withMemoryRebound(to: UnsafePointer<CChar>?.self, capacity: buffer.count) { rebound in
        body(UnsafeMutablePointer(mutating: rebound))
      }
    }
  }
}
