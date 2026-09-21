// Dérivé de Streamyfin — https://github.com/streamyfin/streamyfin
// (modules/mpv-player/ios/PlayerEngine.swift, révision 4faddc5f du 2026-09-12),
// publié sous Mozilla Public License 2.0. Ce fichier reste couvert par la
// MPL-2.0 (https://mozilla.org/MPL/2.0/) ; adaptation Tentacle TV.
import Foundation

/// Les rappels du rendu (déjà sur le thread principal), relayés à la vue et
/// reflétés sur l'image dans l'image et Now Playing.
extension MpvEngine: MpvRendererDelegate {
  func renderer(_ renderer: MpvRenderer, didLoad info: [String: Any]) {
    if let duration = info["duration"] as? Double { cachedDuration = duration }
    delegate?.engine(self, didLoad: info)
  }

  func renderer(_ renderer: MpvRenderer, didUpdateTracks tracks: [[String: Any]]) {
    delegate?.engine(self, didUpdateTracks: tracks)
  }

  func renderer(_ renderer: MpvRenderer, didUpdateVideoParams params: [String: Any]) {
    delegate?.engine(self, didUpdateVideoParams: params)
  }

  func renderer(_ renderer: MpvRenderer, didUpdatePosition position: Double, duration: Double, cacheSeconds: Double) {
    cachedPosition = position
    cachedDuration = duration
    if pipController.isPictureInPictureActive {
      pipController.setCurrentTimeFromSeconds(position, duration: duration)
    }
    delegate?.engine(self, didUpdateProgress: position, duration: duration, cacheSeconds: cacheSeconds)
  }

  func renderer(_ renderer: MpvRenderer, didChangePause isPaused: Bool) {
    pipController.setPlaybackRate(isPaused ? 0.0 : 1.0)
    syncNowPlaying(isPlaying: !isPaused)
    delegate?.engine(self, didChangePause: isPaused)
  }

  func renderer(_ renderer: MpvRenderer, didChangeBuffering isBuffering: Bool) {
    delegate?.engine(self, didChangeBuffering: isBuffering)
  }

  /// L'unité audio de mpv reconfigure la session partagée en démarrant et
  /// écrase ce que `play()` avait posé ; tant que la nôtre n'est pas remise,
  /// le système ne nous tient pas pour l'app en lecture et ignore Now Playing.
  func renderer(_ renderer: MpvRenderer, didSelectAudioOutput name: String) {
    configureAudioSession()
    syncNowPlaying(isPlaying: intendedPlayState)
  }

  func renderer(_ renderer: MpvRenderer, didFailWithError message: String) {
    delegate?.engine(self, didFailWithError: message)
  }

  func rendererDidReachEnd(_ renderer: MpvRenderer) {
    delegate?.engineDidReachEnd(self)
  }
}
