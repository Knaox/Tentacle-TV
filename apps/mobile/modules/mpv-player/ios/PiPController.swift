// Dérivé de Streamyfin — https://github.com/streamyfin/streamyfin
// (modules/mpv-player/ios/PiPController.swift, révision 4faddc5f du 2026-09-12),
// publié sous Mozilla Public License 2.0. Ce fichier reste couvert par la
// MPL-2.0 (https://mozilla.org/MPL/2.0/) ; adaptation Tentacle TV : iOS seul,
// journal du module, commentaires en français.
import AVFoundation
import AVKit

protocol PiPControllerDelegate: AnyObject {
  func pipController(_ controller: PiPController, willStartPictureInPicture: Bool)
  func pipController(_ controller: PiPController, didStartPictureInPicture: Bool)
  func pipController(_ controller: PiPController, willStopPictureInPicture: Bool)
  func pipController(_ controller: PiPController, didStopPictureInPicture: Bool)
  func pipController(_ controller: PiPController, restoreUserInterfaceForPictureInPictureStop completionHandler: @escaping (Bool) -> Void)
  func pipControllerPlay(_ controller: PiPController)
  func pipControllerPause(_ controller: PiPController)
  func pipController(_ controller: PiPController, skipByInterval interval: CMTime)
  func pipControllerIsPlaying(_ controller: PiPController) -> Bool
  func pipControllerDuration(_ controller: PiPController) -> Double
  func pipControllerCurrentPosition(_ controller: PiPController) -> Double
}

/// L'image dans l'image sur un `AVSampleBufferDisplayLayer` (iOS 15+) : AVKit
/// ne connaît pas la position de mpv, on lui tient une base de temps à jour.
final class PiPController: NSObject {
  /// Le système n'accorde qu'UN seul emplacement d'ouverture automatique : le
  /// contrôleur sortant doit le céder au suivant.
  private static weak var automaticStartOwner: PiPController?

  private var pipController: AVPictureInPictureController?
  private weak var sampleBufferDisplayLayer: AVSampleBufferDisplayLayer?
  weak var delegate: PiPControllerDelegate?

  private var timebase: CMTimebase?
  private var currentTime: CMTime = .zero
  private var currentDuration: Double = 0

  var isPictureInPictureSupported: Bool {
    AVPictureInPictureController.isPictureInPictureSupported()
  }

  var isPictureInPictureActive: Bool {
    pipController?.isPictureInPictureActive ?? false
  }

  var isPictureInPicturePossible: Bool {
    pipController?.isPictureInPicturePossible ?? false
  }

  init(sampleBufferDisplayLayer: AVSampleBufferDisplayLayer) {
    self.sampleBufferDisplayLayer = sampleBufferDisplayLayer
    super.init()
    setupTimebase()
    setupPictureInPicture()
  }

  private func setupTimebase() {
    var newTimebase: CMTimebase?
    let status = CMTimebaseCreateWithSourceClock(
      allocator: kCFAllocatorDefault, sourceClock: CMClockGetHostTimeClock(), timebaseOut: &newTimebase)
    if status == noErr, let timebase = newTimebase {
      self.timebase = timebase
      CMTimebaseSetTime(timebase, time: .zero)
      CMTimebaseSetRate(timebase, rate: 0)
      sampleBufferDisplayLayer?.controlTimebase = timebase
    }
  }

  private func setupPictureInPicture() {
    guard isPictureInPictureSupported else {
      MpvLogger.shared.log("PiP : non pris en charge par cet appareil", type: "Warn")
      return
    }
    guard let displayLayer = sampleBufferDisplayLayer else { return }
    let contentSource = AVPictureInPictureController.ContentSource(
      sampleBufferDisplayLayer: displayLayer, playbackDelegate: self)
    pipController = AVPictureInPictureController(contentSource: contentSource)
    pipController?.delegate = self
    pipController?.requiresLinearPlayback = false
  }

  /// Ouverture automatique en quittant l'app (« glisser vers le haut en lecture »).
  func setAutoStartEnabled(_ enabled: Bool) {
    guard let pipController else { return }
    if enabled {
      Self.automaticStartOwner?.pipController?.canStartPictureInPictureAutomaticallyFromInline = false
      Self.automaticStartOwner = self
    } else if Self.automaticStartOwner === self {
      Self.automaticStartOwner = nil
    }
    pipController.canStartPictureInPictureAutomaticallyFromInline = enabled
  }

  func startPictureInPicture() {
    guard let pipController else {
      MpvLogger.shared.log("PiP : contrôleur jamais créé", type: "Error")
      return
    }
    // AVKit n'appelle personne quand la source n'est « jamais devenue possible » :
    // journaliser le refus plutôt que de rendre la main en silence.
    guard pipController.isPictureInPicturePossible else {
      MpvLogger.shared.log("PiP : refusé, isPictureInPicturePossible == false", type: "Error")
      return
    }
    pipController.startPictureInPicture()
  }

  func stopPictureInPicture() {
    pipController?.stopPictureInPicture()
  }

  /// N'invalide qu'en PiP actif (sinon AVKit se plaint d'un menu absent).
  func updatePlaybackState() {
    guard isPictureInPictureActive else { return }
    if Thread.isMainThread {
      pipController?.invalidatePlaybackState()
    } else {
      DispatchQueue.main.async { [weak self] in self?.pipController?.invalidatePlaybackState() }
    }
  }

  func setCurrentTimeFromSeconds(_ seconds: Double, duration: Double) {
    guard seconds >= 0 else { return }
    currentDuration = duration
    currentTime = CMTime(seconds: seconds, preferredTimescale: 1000)
    if let timebase { CMTimebaseSetTime(timebase, time: currentTime) }
    updatePlaybackState()
  }

  /// 1 = lecture, 0 = pause, sur la base de temps.
  func setPlaybackRate(_ rate: Float) {
    if let timebase { CMTimebaseSetRate(timebase, rate: Float64(rate)) }
  }

  deinit {
    if let timebase { CMTimebaseSetRate(timebase, rate: 0) }
    sampleBufferDisplayLayer?.controlTimebase = nil
    timebase = nil
    pipController?.delegate = nil
    pipController = nil
  }
}

// MARK: - AVPictureInPictureControllerDelegate

extension PiPController: AVPictureInPictureControllerDelegate {
  func pictureInPictureControllerWillStartPictureInPicture(_ controller: AVPictureInPictureController) {
    delegate?.pipController(self, willStartPictureInPicture: true)
  }

  func pictureInPictureControllerDidStartPictureInPicture(_ controller: AVPictureInPictureController) {
    delegate?.pipController(self, didStartPictureInPicture: true)
  }

  func pictureInPictureController(_ controller: AVPictureInPictureController, failedToStartPictureInPictureWithError error: Error) {
    MpvLogger.shared.log("PiP : échec au démarrage — \(error.localizedDescription)", type: "Error")
    delegate?.pipController(self, didStartPictureInPicture: false)
  }

  func pictureInPictureControllerWillStopPictureInPicture(_ controller: AVPictureInPictureController) {
    delegate?.pipController(self, willStopPictureInPicture: true)
  }

  func pictureInPictureControllerDidStopPictureInPicture(_ controller: AVPictureInPictureController) {
    delegate?.pipController(self, didStopPictureInPicture: true)
  }

  func pictureInPictureController(_ controller: AVPictureInPictureController, restoreUserInterfaceForPictureInPictureStopWithCompletionHandler completionHandler: @escaping (Bool) -> Void) {
    delegate?.pipController(self, restoreUserInterfaceForPictureInPictureStop: completionHandler)
  }
}

// MARK: - AVPictureInPictureSampleBufferPlaybackDelegate

extension PiPController: AVPictureInPictureSampleBufferPlaybackDelegate {
  func pictureInPictureController(_ controller: AVPictureInPictureController, setPlaying playing: Bool) {
    if playing { delegate?.pipControllerPlay(self) } else { delegate?.pipControllerPause(self) }
  }

  func pictureInPictureController(_ controller: AVPictureInPictureController, didTransitionToRenderSize newRenderSize: CMVideoDimensions) {}

  func pictureInPictureController(_ controller: AVPictureInPictureController, skipByInterval skipInterval: CMTime, completion completionHandler: @escaping () -> Void) {
    delegate?.pipController(self, skipByInterval: skipInterval)
    completionHandler()
  }

  func pictureInPictureControllerTimeRangeForPlayback(_ controller: AVPictureInPictureController) -> CMTimeRange {
    let duration = delegate?.pipControllerDuration(self) ?? 0
    guard duration > 0 else { return CMTimeRange(start: .zero, duration: .positiveInfinity) }
    return CMTimeRange(start: .zero, duration: CMTime(seconds: duration, preferredTimescale: 1000))
  }

  func pictureInPictureControllerIsPlaybackPaused(_ controller: AVPictureInPictureController) -> Bool {
    !(delegate?.pipControllerIsPlaying(self) ?? false)
  }
}
