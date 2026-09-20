// Dérivé de Streamyfin — https://github.com/streamyfin/streamyfin
// (modules/mpv-player/ios/MpvPlayerView.swift, révision 4faddc5f du 2026-09-12),
// publié sous Mozilla Public License 2.0. Ce fichier reste couvert par la
// MPL-2.0 (https://mozilla.org/MPL/2.0/) ; adaptation Tentacle TV.
import Foundation

/// Rappels du moteur → événements JS, même contrat qu'`EngineSurfaceProps`
/// côté TypeScript (voir `src/MpvPlayer.types.ts`).
extension MpvPlayerView: MpvEngineDelegate {
  func engine(_ engine: MpvEngine, didLoad info: [String: Any]) {
    onLoad(info)
  }

  func engine(_ engine: MpvEngine, didUpdateTracks tracks: [[String: Any]]) {
    onTracksChanged(["tracks": tracks])
  }

  func engine(_ engine: MpvEngine, didUpdateVideoParams params: [String: Any]) {
    onVideoParams(params)
  }

  func engine(_ engine: MpvEngine, didUpdateProgress position: Double, duration: Double, cacheSeconds: Double) {
    onProgress(["position": position, "duration": duration, "cacheSeconds": cacheSeconds])
  }

  func engine(_ engine: MpvEngine, didChangePause isPaused: Bool) {
    onPlaybackStateChange(["paused": isPaused])
  }

  func engine(_ engine: MpvEngine, didChangeBuffering isBuffering: Bool) {
    onBuffering(["buffering": isBuffering])
  }

  func engine(_ engine: MpvEngine, didChangePictureInPicture isActive: Bool) {
    onPipChanged(["active": isActive])
  }

  func engine(_ engine: MpvEngine, didChangeAirPlayRoute active: Bool) {
    onAirPlayRoute(["active": active])
  }

  func engine(_ engine: MpvEngine, didFailWithError message: String) {
    onError(["message": message])
  }

  func engineDidReachEnd(_ engine: MpvEngine) {
    onEnd([:])
  }
}
