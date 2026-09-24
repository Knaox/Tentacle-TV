// Dérivé de Streamyfin — https://github.com/streamyfin/streamyfin
// (modules/mpv-player/ios/MPVNowPlayingManager.swift, révision 4faddc5f du
// 2026-09-12), publié sous Mozilla Public License 2.0. Ce fichier reste couvert
// par la MPL-2.0 (https://mozilla.org/MPL/2.0/) ; adaptation Tentacle TV :
// un propriétaire, et des commandes éteintes au départ du lecteur.
import AVFoundation
import Foundation
import MediaPlayer
import UIKit

/// Écran verrouillé et centre de contrôle : métadonnées, position, commandes.
///
/// Un singleton, parce que le système n'en a qu'un — mais deux lecteurs s'y
/// croisent : au passage d'un épisode au suivant, ou d'un moteur à l'autre, le
/// nouveau publie avant que l'ancien soit démonté. Le moteur qui publie en
/// dernier devient PROPRIÉTAIRE ; les autres ne peuvent plus rien effacer. Sans
/// cela, le sortant effaçait l'écran verrouillé de l'entrant et retirait ses
/// commandes — l'épisode suivant n'avait plus de contrôles.
final class MpvNowPlayingManager {
  static let shared = MpvNowPlayingManager()

  private var owner: ObjectIdentifier?
  private var title: String?
  private var artist: String?
  private var cachedArtwork: MPMediaItemArtwork?
  private var duration: TimeInterval = 0
  private var position: TimeInterval = 0
  private var isPlaying = false
  private var isCommandsSetup = false
  private var artworkTask: URLSessionDataTask?

  private init() {}

  private func owns(_ engine: AnyObject) -> Bool {
    owner == ObjectIdentifier(engine)
  }

  // MARK: - Commandes

  func setupRemoteCommands(
    for engine: AnyObject,
    playHandler: @escaping () -> Void,
    pauseHandler: @escaping () -> Void,
    toggleHandler: @escaping () -> Void,
    seekHandler: @escaping (TimeInterval) -> Void,
    skipForward: @escaping (TimeInterval) -> Void,
    skipBackward: @escaping (TimeInterval) -> Void
  ) {
    if isCommandsSetup && owns(engine) { return }
    // Un autre lecteur les tenait : ses cibles partent, les nôtres les remplacent.
    if isCommandsSetup { removeTargets() }
    owner = ObjectIdentifier(engine)
    isCommandsSetup = true
    DispatchQueue.main.async { UIApplication.shared.beginReceivingRemoteControlEvents() }

    let center = MPRemoteCommandCenter.shared()
    center.playCommand.isEnabled = true
    center.playCommand.addTarget { _ in playHandler(); return .success }
    center.pauseCommand.isEnabled = true
    center.pauseCommand.addTarget { _ in pauseHandler(); return .success }
    center.togglePlayPauseCommand.isEnabled = true
    center.togglePlayPauseCommand.addTarget { _ in toggleHandler(); return .success }
    center.skipForwardCommand.isEnabled = true
    center.skipForwardCommand.preferredIntervals = [15]
    center.skipForwardCommand.addTarget { event in
      if let skip = event as? MPSkipIntervalCommandEvent { skipForward(skip.interval) }
      return .success
    }
    center.skipBackwardCommand.isEnabled = true
    center.skipBackwardCommand.preferredIntervals = [15]
    center.skipBackwardCommand.addTarget { event in
      if let skip = event as? MPSkipIntervalCommandEvent { skipBackward(skip.interval) }
      return .success
    }
    center.changePlaybackPositionCommand.isEnabled = true
    center.changePlaybackPositionCommand.addTarget { event in
      if let change = event as? MPChangePlaybackPositionCommandEvent { seekHandler(change.positionTime) }
      return .success
    }
  }

  /// Le lecteur s'en va : ses cibles partent, et les commandes s'ÉTEIGNENT.
  /// Une commande laissée active sans cible gardait le lecteur de l'écran
  /// verrouillé (±15 s, lecture) après la fermeture — iOS croyait l'app encore
  /// en lecture en arrière-plan.
  func cleanupRemoteCommands(for engine: AnyObject) {
    guard isCommandsSetup, owns(engine) else { return }
    removeTargets()
    let center = MPRemoteCommandCenter.shared()
    center.playCommand.isEnabled = false
    center.pauseCommand.isEnabled = false
    center.togglePlayPauseCommand.isEnabled = false
    center.skipForwardCommand.isEnabled = false
    center.skipBackwardCommand.isEnabled = false
    center.changePlaybackPositionCommand.isEnabled = false
    DispatchQueue.main.async { UIApplication.shared.endReceivingRemoteControlEvents() }
    isCommandsSetup = false
  }

  private func removeTargets() {
    let center = MPRemoteCommandCenter.shared()
    center.playCommand.removeTarget(nil)
    center.pauseCommand.removeTarget(nil)
    center.togglePlayPauseCommand.removeTarget(nil)
    center.skipForwardCommand.removeTarget(nil)
    center.skipBackwardCommand.removeTarget(nil)
    center.changePlaybackPositionCommand.removeTarget(nil)
  }

  // MARK: - État

  /// Publier des métadonnées, c'est prendre l'écran verrouillé : le lecteur
  /// qui arrive les pose avant même sa première image.
  func setMetadata(for engine: AnyObject, title: String?, artist: String?, artworkUrl: String?, artworkHeaders: [String: String]?) {
    owner = ObjectIdentifier(engine)
    self.title = title
    self.artist = artist
    artworkTask?.cancel()
    cachedArtwork = nil
    if let artworkUrl, let url = URL(string: artworkUrl) {
      var request = URLRequest(url: url)
      artworkHeaders?.forEach { key, value in request.setValue(value, forHTTPHeaderField: key) }
      artworkTask = URLSession.shared.dataTask(with: request) { [weak self] data, _, _ in
        guard let data, let image = UIImage(data: data) else { return }
        self?.cachedArtwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
        DispatchQueue.main.async { self?.refresh() }
      }
      artworkTask?.resume()
    }
    refresh()
  }

  func updatePlayback(for engine: AnyObject, position: TimeInterval, duration: TimeInterval, isPlaying: Bool) {
    // Un lecteur supplanté se tait : sa progression ne recouvre pas l'autre.
    guard owner == nil || owns(engine) else { return }
    owner = ObjectIdentifier(engine)
    self.position = position
    self.duration = duration
    self.isPlaying = isPlaying
    refresh()
  }

  func clear(for engine: AnyObject) {
    guard owns(engine) else { return }
    owner = nil
    artworkTask?.cancel()
    title = nil
    artist = nil
    cachedArtwork = nil
    duration = 0
    position = 0
    isPlaying = false
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
  }

  /// Ne publie qu'avec une durée connue : sans elle, le système ignore tout.
  private func refresh() {
    guard duration > 0 else { return }
    var info: [String: Any] = [
      MPMediaItemPropertyPlaybackDuration: duration,
      MPNowPlayingInfoPropertyElapsedPlaybackTime: position,
      MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? 1.0 : 0.0,
    ]
    if let title { info[MPMediaItemPropertyTitle] = title }
    if let artist { info[MPMediaItemPropertyArtist] = artist }
    if let cachedArtwork { info[MPMediaItemPropertyArtwork] = cachedArtwork }
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
  }
}
