// Dérivé de Streamyfin — https://github.com/streamyfin/streamyfin
// (modules/mpv-player/ios/MpvPlayerView.swift, révision 4faddc5f du 2026-09-12),
// publié sous Mozilla Public License 2.0. Ce fichier reste couvert par la
// MPL-2.0 (https://mozilla.org/MPL/2.0/) ; adaptation Tentacle TV.
import AVFoundation
import ExpoModulesCore
import UIKit

/// La vue native exposée à React Native : hôte de la couche d'affichage du
/// moteur, et traduction 1:1 des rappels du moteur en événements JS. Toute la
/// logique de lecture vit dans `MpvEngine`.
final class MpvPlayerView: ExpoView {
  let engine = MpvEngine()

  let onLoad = EventDispatcher()
  let onProgress = EventDispatcher()
  let onBuffering = EventDispatcher()
  let onEnd = EventDispatcher()
  let onError = EventDispatcher()
  let onTracksChanged = EventDispatcher()
  let onVideoParams = EventDispatcher()
  let onPipChanged = EventDispatcher()
  let onPlaybackStateChange = EventDispatcher()
  let onAirPlayRoute = EventDispatcher()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    backgroundColor = .black
    engine.delegate = self
    engine.displayLayer.frame = bounds
    engine.displayLayer.contentsScale = contentScaleFactor
    layer.addSublayer(engine.displayLayer)
    do {
      try engine.start()
    } catch {
      onError(["message": "démarrage du rendu impossible : \(error.localizedDescription)"])
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    engine.displayLayer.frame = bounds
    engine.displayLayer.contentsScale = contentScaleFactor
    CATransaction.commit()
    engine.syncSubtitleLayerFrame()
  }

  deinit {
    engine.shutdown()
  }

  // MARK: - Source et transport

  func load(_ config: MpvLoadConfig) {
    engine.load(config)
  }

  func setPaused(_ paused: Bool) {
    engine.setPaused(paused)
  }

  func setSpeed(_ speed: Double) {
    engine.setSpeed(speed)
  }

  func seek(to seconds: Double) {
    engine.seek(to: seconds)
  }

  /// Arrête et détruit l'instance mpv ; la vue reste utilisable.
  func stop() {
    engine.stop()
  }

  func getPosition() -> Double {
    engine.cachedPosition
  }

  // MARK: - Pistes

  func setAudioTrack(_ id: Int) {
    engine.renderer.setAudioTrack(id)
  }

  func setSubtitleTrack(_ id: Int) {
    engine.renderer.setSubtitleTrack(id)
  }

  func addSubtitle(url: String, select: Bool) {
    engine.renderer.addSubtitle(url: url, select: select)
  }

  /// La complétion arrive sur la file mpv.
  func getTracks(completion: @escaping ([[String: Any]]) -> Void) {
    engine.renderer.getTracks(completion: completion)
  }

  func getTechnicalInfo(completion: @escaping ([String: Any]) -> Void) {
    engine.renderer.getTechnicalInfo(completion: completion)
  }

  // MARK: - Réglages

  func setSubtitleScale(_ scale: Double) {
    engine.renderer.setSubtitleScale(scale)
  }

  func setSubtitlePosition(_ position: Int) {
    engine.renderer.setSubtitlePosition(position)
  }

  func setSubtitleDelay(_ seconds: Double) {
    engine.renderer.setSubtitleDelay(seconds)
  }

  func setAudioDelay(_ seconds: Double) {
    engine.renderer.setAudioDelay(seconds)
  }

  func setNowPlaying(_ metadata: [String: Any]?) {
    engine.setNowPlayingMetadata(metadata)
  }

  func setPipAutoStart(_ enabled: Bool) {
    engine.pipAutoStart = enabled
  }

  // MARK: - Image dans l'image

  func startPictureInPicture() {
    engine.startPictureInPicture()
  }

  func stopPictureInPicture() {
    engine.stopPictureInPicture()
  }

  func isPictureInPictureSupported() -> Bool {
    engine.isPictureInPictureSupported
  }

  func isPictureInPictureActive() -> Bool {
    engine.isPictureInPictureActive
  }
}
