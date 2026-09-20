// Dérivé de Streamyfin — https://github.com/streamyfin/streamyfin
// (modules/mpv-player/ios/MPVLayerRenderer.swift, révision 4faddc5f du
// 2026-09-12), publié sous Mozilla Public License 2.0. Ce fichier reste couvert
// par la MPL-2.0 (https://mozilla.org/MPL/2.0/) ; adaptation Tentacle TV.
import AVFoundation
import Foundation
import MPVKit

/// Ce que le fichier chargé dit de lui-même : plage dynamique, dimensions,
/// codecs, décodeur réellement à l'œuvre, état du cache.
extension MpvRenderer {
  /// bt.2020 + PQ = HDR10 (ou Dolby Vision lu par sa couche de base),
  /// bt.2020 + HLG = HLG, le reste = SDR. Nécessite une image décodée.
  func detectHDRMode(_ handle: OpaquePointer) -> HDRMode? {
    guard let primaries = getStringProperty(handle, "video-params/primaries") else { return nil }
    let gamma = getStringProperty(handle, "video-params/gamma")
    guard primaries == "bt.2020" || primaries == "bt.2020-ncl" else { return .sdr }
    return gamma == "hlg" ? .hlg : .hdr10
  }

  /// La charge utile d'`onLoad` : durée, dimensions annoncées par le
  /// conteneur (les paramètres vidéo décodés viennent plus tard), pistes.
  func loadInfo(_ handle: OpaquePointer) -> [String: Any] {
    var info: [String: Any] = [:]
    info["duration"] = getDouble(handle, "duration") ?? 0
    let tracks = trackList(handle)
    info["tracks"] = tracks
    if let video = tracks.first(where: { ($0["type"] as? String) == "video" && ($0["selected"] as? Bool) == true })
        ?? tracks.first(where: { ($0["type"] as? String) == "video" }) {
      info["width"] = video["width"] ?? 0
      info["height"] = video["height"] ?? 0
    }
    if let fps = getDouble(handle, "container-fps"), fps > 0 { info["fps"] = fps }
    info["hdr"] = detectHDRMode(handle)?.rawValue ?? "unknown"
    if let hwdec = getStringProperty(handle, "hwdec-current") { info["hwdec"] = hwdec }
    return info
  }

  /// Après la première image : dimensions réelles et plage dynamique.
  func videoParams(_ handle: OpaquePointer) -> [String: Any] {
    var params: [String: Any] = [:]
    params["width"] = Int(getInt64(handle, "video-params/w") ?? 0)
    params["height"] = Int(getInt64(handle, "video-params/h") ?? 0)
    params["hdr"] = detectHDRMode(handle)?.rawValue ?? "unknown"
    if let hwdec = getStringProperty(handle, "hwdec-current") { params["hwdec"] = hwdec }
    return params
  }

  /// Instantané non bloquant pour le panneau « Détails » ; complétion sur la file mpv.
  func getTechnicalInfo(completion: @escaping ([String: Any]) -> Void) {
    onQueue { [weak self] in
      guard let self, let handle = self.mpv else { return completion([:]) }
      completion(self.technicalInfo(handle))
    }
  }

  private func technicalInfo(_ handle: OpaquePointer) -> [String: Any] {
    var info: [String: Any] = [:]
    if let width = getInt64(handle, "video-params/w") { info["videoWidth"] = Int(width) }
    if let height = getInt64(handle, "video-params/h") { info["videoHeight"] = Int(height) }
    if let videoCodec = getStringProperty(handle, "video-format") { info["videoCodec"] = videoCodec }
    if let audioCodec = getStringProperty(handle, "audio-codec-name") { info["audioCodec"] = audioCodec }
    if let fps = getDouble(handle, "container-fps"), fps > 0 { info["fps"] = fps }
    if let videoBitrate = getInt64(handle, "video-bitrate"), videoBitrate > 0 { info["videoBitrate"] = Int(videoBitrate) }
    if let audioBitrate = getInt64(handle, "audio-bitrate"), audioBitrate > 0 { info["audioBitrate"] = Int(audioBitrate) }
    if let cacheSeconds = getDouble(handle, "demuxer-cache-duration") { info["cacheSeconds"] = cacheSeconds }
    if let dropped = getInt64(handle, "frame-drop-count") { info["droppedFrames"] = Int(dropped) }
    if let hwdec = getStringProperty(handle, "hwdec-current") { info["hwdec"] = hwdec }
    if let audioOutput = getStringProperty(handle, "current-ao") { info["audioOutput"] = audioOutput }
    if let channels = getStringProperty(handle, "audio-params/channels") { info["audioChannels"] = channels }
    info["hdr"] = detectHDRMode(handle)?.rawValue ?? "unknown"
    info["log"] = MpvLogger.shared.recent()
    return info
  }

  /// Les lignes « info » qui valent d'être gardées : les résumés négociés
  /// (« AO: [audiounit] 48000Hz stereo », « VO: ... ») et tout ce que dit la
  /// sortie audio. Le reste, à ce niveau, n'est que du bavardage par piste.
  static func isDiagnosticInfoLine(component: String, text: String) -> Bool {
    if component == "ao" || component.hasPrefix("ao/") { return true }
    return text.hasPrefix("AO: ") || text.hasPrefix("VO: ")
  }

  /// Une ligne sur la route de sortie audio (AirPlay, casque, haut-parleur).
  func logAudioRoute(_ reason: String) {
    let session = AVAudioSession.sharedInstance()
    let outputs = session.currentRoute.outputs.map { port in
      "\(port.portType.rawValue)(\(port.channels?.count ?? 0)ch)"
    }
    MpvLogger.shared.log(
      "route audio (\(reason)) : \(outputs.joined(separator: " + ")) "
        + "canaux=\(session.outputNumberOfChannels) "
        + "latence=\(Int(session.outputLatency * 1000))ms",
      type: "Info"
    )
  }
}
