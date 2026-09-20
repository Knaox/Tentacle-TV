// Dérivé de Streamyfin — https://github.com/streamyfin/streamyfin
// (modules/mpv-player/ios/PlayerEngine.swift, révision 4faddc5f du 2026-09-12),
// publié sous Mozilla Public License 2.0. Ce fichier reste couvert par la
// MPL-2.0 (https://mozilla.org/MPL/2.0/) ; adaptation Tentacle TV.
import CoreMedia
import Foundation

/// L'image dans l'image : commandes et rappels d'AVKit.
extension MpvEngine {
  func startPictureInPicture() {
    pipController.startPictureInPicture()
  }

  func stopPictureInPicture() {
    pipController.stopPictureInPicture()
  }

  var isPictureInPictureSupported: Bool {
    pipController.isPictureInPictureSupported
  }

  var isPictureInPictureActive: Bool {
    pipController.isPictureInPictureActive
  }
}

extension MpvEngine: PiPControllerDelegate {
  func pipController(_ controller: PiPController, willStartPictureInPicture: Bool) {
    pipEngaged = true
    pipController.setCurrentTimeFromSeconds(cachedPosition, duration: cachedDuration)
  }

  func pipController(_ controller: PiPController, didStartPictureInPicture: Bool) {
    // `false` quand AVKit n'a pas pu démarrer : l'état réel est remonté tel quel.
    pipEngaged = didStartPictureInPicture
    pipController.setCurrentTimeFromSeconds(cachedPosition, duration: cachedDuration)
    delegate?.engine(self, didChangePictureInPicture: didStartPictureInPicture)
  }

  func pipController(_ controller: PiPController, willStopPictureInPicture: Bool) {}

  func pipController(_ controller: PiPController, didStopPictureInPicture: Bool) {
    pipEngaged = false
    pipController.updatePlaybackState()
    delegate?.engine(self, didChangePictureInPicture: false)
  }

  func pipController(_ controller: PiPController, restoreUserInterfaceForPictureInPictureStop completionHandler: @escaping (Bool) -> Void) {
    completionHandler(true)
  }

  func pipControllerPlay(_ controller: PiPController) {
    play()
  }

  func pipControllerPause(_ controller: PiPController) {
    pause()
  }

  func pipController(_ controller: PiPController, skipByInterval interval: CMTime) {
    seek(by: CMTimeGetSeconds(interval))
  }

  /// L'intention, pas l'état : les pauses transitoires d'un saut ne comptent pas.
  func pipControllerIsPlaying(_ controller: PiPController) -> Bool {
    intendedPlayState
  }

  func pipControllerDuration(_ controller: PiPController) -> Double {
    cachedDuration
  }

  func pipControllerCurrentPosition(_ controller: PiPController) -> Double {
    cachedPosition
  }
}
