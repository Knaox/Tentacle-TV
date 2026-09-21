// Dérivé de Streamyfin — https://github.com/streamyfin/streamyfin
// (modules/mpv-player/ios/MPVLayerRenderer.swift, révision 4faddc5f du
// 2026-09-12), publié sous Mozilla Public License 2.0. Ce fichier reste couvert
// par la MPL-2.0 (https://mozilla.org/MPL/2.0/) ; adaptation Tentacle TV.
import Foundation
import MPVKit

/// Chargement, lecture, sauts, vitesse, réglages de synchronisation.
extension MpvRenderer {
  func load(_ config: MpvLoadConfig) {
    queue.async { [weak self] in
      guard let self else { return }
      // Posé sur la file, pas sur le thread appelant : le gestionnaire
      // FILE_LOADED lit ces valeurs sur cette même file.
      self.pendingConfig = config
      self.fileLoaded = false
      self.suspendedVideoTrack = nil
      self.decoderResetCount = 0
      self.isSeeking = false
      self.setLoading(true)
      guard let handle = self.mpv else { return }

      self.command(handle, ["stop"])
      self.updateHTTPHeaders(handle, config.headers)
      if let start = config.startPosition, start > 0 {
        self.setPropertyNow(handle, "start", String(format: "%.3f", start))
      } else {
        self.setPropertyNow(handle, "start", "0")
      }
      // Aucun sous-titre avant la sélection explicite de FILE_LOADED : sinon
      // mpv en choisit un lui-même et il clignote une seconde.
      self.setPropertyNow(handle, "sid", "no")
      self.setPropertyNow(handle, "aid", "auto")
      let target = config.url.isFileURL ? config.url.path : config.url.absoluteString
      self.command(handle, ["loadfile", target, "replace"])
    }
  }

  func play() {
    setProperty("pause", "no")
  }

  func pause() {
    setProperty("pause", "yes")
  }

  /// Saut absolu, exact (`hr-seek` par défaut de mpv pour les sauts absolus).
  func seek(to seconds: Double) {
    guard mpv != nil else { return }
    let clamped = max(0, seconds)
    cachedPosition = clamped
    onQueue { [weak self] in
      guard let self, let handle = self.mpv else { return }
      self.commandSync(handle, ["seek", String(clamped), "absolute"])
    }
  }

  func setSpeed(_ speed: Double) {
    playbackSpeed = speed
    setProperty("speed", String(speed))
  }

  func setAudioDelay(_ seconds: Double) {
    setProperty("audio-delay", String(seconds))
  }

  func setSubtitleDelay(_ seconds: Double) {
    setProperty("sub-delay", String(seconds))
  }

  func setSubtitleScale(_ scale: Double) {
    setProperty("sub-scale", String(scale))
  }

  /// Position verticale en pourcentage de la hauteur (100 = bas de l'image).
  func setSubtitlePosition(_ position: Int) {
    setProperty("sub-pos", String(position))
  }

  /// Arrière-plan : le GPU est interdit, on coupe le décodage vidéo et l'audio
  /// continue ; au retour, la piste mise de côté est rétablie et mpv recale
  /// l'image sur le son (les sessions VideoToolbox sont recréées au passage).
  func setVideoEnabled(_ enabled: Bool) {
    onQueue { [weak self] in
      guard let self, let handle = self.mpv else { return }
      if enabled {
        guard let suspended = self.suspendedVideoTrack else { return }
        self.suspendedVideoTrack = nil
        self.setPropertyNow(handle, "vid", suspended)
      } else {
        guard let current = self.getStringProperty(handle, "vid"), current != "no", current != "auto" else { return }
        self.suspendedVideoTrack = current
        self.setPropertyNow(handle, "vid", "no")
      }
    }
  }

  /// Arrête la lecture courante sans détruire l'instance (réutilisée aussitôt).
  func stopPlayback() {
    onQueue { [weak self] in
      guard let self, let handle = self.mpv else { return }
      self.fileLoaded = false
      self.commandSync(handle, ["stop"])
    }
  }

  /// La couche de sous-titres non composités (simulateur) suit la couche vidéo.
  func syncSubtitleLayerFrame() {
    guard let subtitleLayer = displayLayer.sublayers?.last else { return }
    subtitleLayer.contentsGravity = .resizeAspect
    #if targetEnvironment(simulator)
    subtitleLayer.frame = displayLayer.bounds
    #endif
  }
}
