// Dérivé de Streamyfin — https://github.com/streamyfin/streamyfin
// (modules/mpv-player/ios/MPVLayerRenderer.swift, révision 4faddc5f du
// 2026-09-12), publié sous Mozilla Public License 2.0. Ce fichier reste couvert
// par la MPL-2.0 (https://mozilla.org/MPL/2.0/) ; adaptation Tentacle TV :
// une seule énumération pour toutes les pistes, résolution par ff-index.
import Foundation
import MPVKit

/// Les pistes, avec l'identité qui compte pour Jellyfin : `ffIndex` pour une
/// piste du fichier (`MediaStream.Index`), `externalFilename` pour un
/// sous-titre ajouté par `sub-add`. La correspondance se fait côté JS.
extension MpvRenderer {
  /// Toutes les pistes (vidéo, audio, sous-titres) telles que mpv les voit.
  func trackList(_ handle: OpaquePointer) -> [[String: Any]] {
    var tracks: [[String: Any]] = []
    let count = getInt64(handle, "track-list/count") ?? 0
    for index in 0..<count {
      let prefix = "track-list/\(index)/"
      guard let type = getStringProperty(handle, prefix + "type"),
            let id = getInt64(handle, prefix + "id") else { continue }
      var track: [String: Any] = ["id": Int(id), "type": type]
      if let ffIndex = getInt64(handle, prefix + "ff-index") { track["ffIndex"] = Int(ffIndex) }
      let external = getFlag(handle, prefix + "external") ?? false
      track["external"] = external
      if external, let filename = getStringProperty(handle, prefix + "external-filename") {
        track["externalFilename"] = filename
      }
      if let title = getStringProperty(handle, prefix + "title") { track["title"] = title }
      if let lang = getStringProperty(handle, prefix + "lang") { track["lang"] = lang }
      if let codec = getStringProperty(handle, prefix + "codec") { track["codec"] = codec }
      if type == "audio", let channels = getInt64(handle, prefix + "audio-channels"), channels > 0 {
        track["channels"] = Int(channels)
      }
      if type == "video" {
        if let width = getInt64(handle, prefix + "demux-w") { track["width"] = Int(width) }
        if let height = getInt64(handle, prefix + "demux-h") { track["height"] = Int(height) }
      }
      track["selected"] = getFlag(handle, prefix + "selected") ?? false
      track["default"] = getFlag(handle, prefix + "default") ?? false
      track["forced"] = getFlag(handle, prefix + "forced") ?? false
      tracks.append(track)
    }
    return tracks
  }

  /// L'identifiant mpv de la piste intégrée dont le `ff-index` vaut `ffIndex`.
  /// Les pistes externes sont ignorées : leur `ff-index` compte dans LEUR fichier.
  func trackId(_ handle: OpaquePointer, forFfIndex ffIndex: Int, type: String) -> Int? {
    let count = getInt64(handle, "track-list/count") ?? 0
    for index in 0..<count {
      let prefix = "track-list/\(index)/"
      guard getStringProperty(handle, prefix + "type") == type,
            getFlag(handle, prefix + "external") != true,
            let candidate = getInt64(handle, prefix + "ff-index"), Int(candidate) == ffIndex,
            let id = getInt64(handle, prefix + "id") else { continue }
      return Int(id)
    }
    return nil
  }

  /// Énumération non bloquante ; la complétion arrive sur la file mpv.
  func getTracks(completion: @escaping ([[String: Any]]) -> Void) {
    onQueue { [weak self] in
      guard let self, let handle = self.mpv else { return completion([]) }
      completion(self.trackList(handle))
    }
  }

  /// `id` mpv ; négatif = aucune piste audio.
  func setAudioTrack(_ id: Int) {
    setProperty("aid", id < 0 ? "no" : String(id))
  }

  /// `id` mpv ; négatif = sous-titres coupés.
  func setSubtitleTrack(_ id: Int) {
    onQueue { [weak self] in
      guard let self, let handle = self.mpv else { return }
      self.setPropertyNow(handle, "sid", id < 0 ? "no" : String(id))
      self.applyBidiModeNow(handle, forTrack: id)
    }
  }

  /// Ajoute un sous-titre externe ; la liste des pistes se remonte d'elle-même
  /// (`track-list/count` observé).
  func addSubtitle(url: String, select: Bool) {
    onQueue { [weak self] in
      guard let self, let handle = self.mpv else { return }
      self.commandSync(handle, ["sub-add", url, select ? "select" : "auto"])
      guard select else { return }
      self.applyBidiModeNow(handle, forTrack: Int(self.getInt64(handle, "sid") ?? -1))
    }
  }

  /// Un ASS aux scripts droite-à-gauche a besoin d'`Encoding=-1` (détection
  /// automatique du sens) ; on ne touche à rien d'autre de son style.
  func applyBidiModeNow(_ handle: OpaquePointer, forTrack id: Int) {
    let codec = id >= 0 ? subtitleCodec(handle, trackId: id) : nil
    let isAss = codec == "ass" || codec == "ssa"
    setPropertyNow(handle, "sub-ass-style-overrides", isAss ? "Encoding=-1" : "")
  }

  private func subtitleCodec(_ handle: OpaquePointer, trackId: Int) -> String? {
    let count = getInt64(handle, "track-list/count") ?? 0
    for index in 0..<count {
      let prefix = "track-list/\(index)/"
      guard getStringProperty(handle, prefix + "type") == "sub",
            let id = getInt64(handle, prefix + "id"), Int(id) == trackId else { continue }
      return getStringProperty(handle, prefix + "codec")
    }
    return nil
  }
}
