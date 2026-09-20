// Dérivé de Streamyfin — https://github.com/streamyfin/streamyfin
// (modules/mpv-player/ios/PlayerEngine.swift, révision 4faddc5f du 2026-09-12),
// publié sous Mozilla Public License 2.0. Ce fichier reste couvert par la
// MPL-2.0 (https://mozilla.org/MPL/2.0/) ; adaptation Tentacle TV.
import AVFoundation
import UIKit

/// Session audio, interruptions, route de sortie (AirPlay), arrière-plan et
/// commandes du système.
extension MpvEngine {
  func observeSystemNotifications() {
    let center = NotificationCenter.default
    center.addObserver(
      self, selector: #selector(handleAudioSessionInterruption(_:)),
      name: AVAudioSession.interruptionNotification, object: nil)
    center.addObserver(
      self, selector: #selector(handleRouteChange(_:)),
      name: AVAudioSession.routeChangeNotification, object: nil)
    center.addObserver(
      self, selector: #selector(handleDidEnterBackground),
      name: UIApplication.didEnterBackgroundNotification, object: nil)
    center.addObserver(
      self, selector: #selector(handleWillEnterForeground),
      name: UIApplication.willEnterForegroundNotification, object: nil)
    airPlayActive = Self.isAirPlayRouteActive()
  }

  /// La sortie courante est-elle un récepteur AirPlay ?
  static func isAirPlayRouteActive() -> Bool {
    AVAudioSession.sharedInstance().currentRoute.outputs.contains { $0.portType == .airPlay }
  }

  /// Lecture vidéo longue : la politique de route suit `AVInitialRouteSharingPolicy`
  /// (LongFormVideo) déclarée dans l'Info.plist de l'app.
  func configureAudioSession() {
    let session = AVAudioSession.sharedInstance()
    do {
      try session.setCategory(.playback, mode: .moviePlayback, policy: .longFormVideo, options: [])
      try session.setActive(true)
    } catch {
      MpvLogger.shared.log("session audio : \(error.localizedDescription)", type: "Warn")
    }
  }

  /// Rend la session sans changer de catégorie : le lecteur système qui peut
  /// nous succéder pose la sienne, et `.playback` reste le bon défaut d'une
  /// application vidéo.
  func tearDownAudioSession() {
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }

  @objc func handleAudioSessionInterruption(_ notification: Notification) {
    guard let info = notification.userInfo,
          let typeValue = info[AVAudioSessionInterruptionTypeKey] as? UInt,
          let type = AVAudioSession.InterruptionType(rawValue: typeValue) else { return }
    switch type {
    case .began:
      guard intendedPlayState else { return }
      pause()
      pausedByInterruption = true
    case .ended:
      let rawOptions = info[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
      let options = AVAudioSession.InterruptionOptions(rawValue: rawOptions)
      if pausedByInterruption && options.contains(.shouldResume) {
        play()
      }
      pausedByInterruption = false
    @unknown default:
      break
    }
  }

  /// Un changement de route vers ou depuis AirPlay remonte à JS, qui bascule
  /// sur le lecteur système (mpv ne diffuse pas en AirPlay).
  @objc func handleRouteChange(_ notification: Notification) {
    renderer.logAudioRoute("changement de route")
    let active = Self.isAirPlayRouteActive()
    guard active != airPlayActive else { return }
    airPlayActive = active
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.delegate?.engine(self, didChangeAirPlayRoute: active)
    }
  }

  /// Le GPU est interdit à l'arrière-plan : la vidéo se coupe, l'audio
  /// continue — sauf en image dans l'image, qui reste à l'écran.
  @objc func handleDidEnterBackground() {
    guard !pipEngaged, !pipController.isPictureInPictureActive else { return }
    renderer.setVideoEnabled(false)
  }

  @objc func handleWillEnterForeground() {
    renderer.setVideoEnabled(true)
  }

  func setupRemoteCommands() {
    nowPlaying.setupRemoteCommands(
      playHandler: { [weak self] in self?.play() },
      pauseHandler: { [weak self] in self?.pause() },
      toggleHandler: { [weak self] in
        guard let self else { return }
        if self.intendedPlayState { self.pause() } else { self.play() }
      },
      seekHandler: { [weak self] time in self?.seek(to: time) },
      skipForward: { [weak self] interval in self?.seek(by: interval) },
      skipBackward: { [weak self] interval in self?.seek(by: -interval) }
    )
  }
}
