// Dérivé de Streamyfin — https://github.com/streamyfin/streamyfin
// (modules/mpv-player/ios/PlayerEngine.swift, révision 4faddc5f du 2026-09-12),
// publié sous Mozilla Public License 2.0. Ce fichier reste couvert par la
// MPL-2.0 (https://mozilla.org/MPL/2.0/) ; adaptation Tentacle TV : iOS seul,
// arrière-plan audio, route AirPlay, commentaires en français.
import AVFoundation
import CoreMedia
import MediaPlayer
import UIKit

/// Ce que le moteur remonte à la vue hôte. Thread principal.
protocol MpvEngineDelegate: AnyObject {
  func engine(_ engine: MpvEngine, didLoad info: [String: Any])
  func engine(_ engine: MpvEngine, didUpdateTracks tracks: [[String: Any]])
  func engine(_ engine: MpvEngine, didUpdateVideoParams params: [String: Any])
  func engine(_ engine: MpvEngine, didUpdateProgress position: Double, duration: Double, cacheSeconds: Double)
  func engine(_ engine: MpvEngine, didChangePause isPaused: Bool)
  func engine(_ engine: MpvEngine, didChangeBuffering isBuffering: Bool)
  func engine(_ engine: MpvEngine, didChangePictureInPicture isActive: Bool)
  func engine(_ engine: MpvEngine, didChangeAirPlayRoute active: Bool)
  func engine(_ engine: MpvEngine, didFailWithError message: String)
  func engineDidReachEnd(_ engine: MpvEngine)
}

/// Le moteur sans interface : il possède la couche d'affichage, le rendu
/// libmpv, l'image dans l'image, Now Playing et la session audio. La vue hôte
/// ne fait que poser `displayLayer` dans sa hiérarchie et suivre sa taille.
final class MpvEngine: NSObject {
  weak var delegate: MpvEngineDelegate?

  let displayLayer = AVSampleBufferDisplayLayer()
  let renderer: MpvRenderer
  let pipController: PiPController
  let nowPlaying = MpvNowPlayingManager.shared

  var currentConfig: MpvLoadConfig?
  var cachedPosition: Double = 0
  var cachedDuration: Double = 0
  private(set) var intendedPlayState = false
  var isShutDown = false
  var airPlayActive = false
  /// Mis en pause par une interruption système (appel) : on reprend si le
  /// système le suggère, puisque la lecture était voulue.
  var pausedByInterruption = false
  /// Image dans l'image en cours d'ouverture ou active : la vidéo reste
  /// décodée quand l'app passe à l'arrière-plan.
  var pipEngaged = false

  /// Ouverture automatique de l'image dans l'image en quittant l'app.
  var pipAutoStart = true {
    didSet { if !isShutDown { pipController.setAutoStartEnabled(pipAutoStart) } }
  }

  /// Les moteurs qui tiennent la session audio (thread principal) — voir
  /// `releaseAudioSession`.
  static var audioSessionHolders = Set<ObjectIdentifier>()
  static let deactivationRetries = 3

  override init() {
    displayLayer.videoGravity = .resizeAspect
    if #available(iOS 17.0, *) {
      // Le HDR passe par la couche : sans ce drapeau, iOS tone-mappe en SDR.
      displayLayer.wantsExtendedDynamicRangeContent = true
    }
    displayLayer.backgroundColor = UIColor.black.cgColor
    renderer = MpvRenderer(displayLayer: displayLayer)
    pipController = PiPController(sampleBufferDisplayLayer: displayLayer)
    super.init()
    renderer.delegate = self
    pipController.delegate = self
    observeSystemNotifications()
  }

  func start() throws {
    try renderer.start()
  }

  /// Charge une source ; la même URL sous le même jeton n'est pas rechargée
  /// (les écrans re-rendent souvent avec une prop identique).
  func load(_ config: MpvLoadConfig) {
    guard !isShutDown else { return }
    if let current = currentConfig, current.isSameMedia(as: config) { return }
    currentConfig = config
    cachedPosition = config.startPosition ?? 0
    cachedDuration = 0
    pipController.setAutoStartEnabled(pipAutoStart)
    renderer.load(config)
  }

  // MARK: - Transport

  func setPaused(_ paused: Bool) {
    if paused { pause() } else { play() }
  }

  func play() {
    // Démonté : une prop `paused` qui arrive après `release` ne doit rien
    // rallumer — ni session audio, ni commandes de l'écran verrouillé.
    guard !isShutDown else { return }
    intendedPlayState = true
    pausedByInterruption = false
    configureAudioSession()
    setupRemoteCommands()
    renderer.play()
    pipController.setPlaybackRate(1.0)
    pipController.updatePlaybackState()
  }

  func pause() {
    intendedPlayState = false
    renderer.pause()
    pipController.setPlaybackRate(0.0)
    pipController.updatePlaybackState()
  }

  func seek(to position: Double) {
    cachedPosition = max(0, position)
    syncNowPlaying(isPlaying: intendedPlayState)
    renderer.seek(to: cachedPosition)
  }

  func seek(by offset: Double) {
    let ceiling = cachedDuration > 0 ? cachedDuration : Double.greatestFiniteMagnitude
    seek(to: min(cachedPosition + offset, ceiling))
  }

  func setSpeed(_ speed: Double) {
    renderer.setSpeed(speed)
  }

  /// Arrête et détruit l'instance mpv (décodeur, cache) puis en recrée une
  /// vide : une vue réutilisée par le routeur d'écrans doit pouvoir recharger.
  func stop() {
    pipController.setAutoStartEnabled(false)
    renderer.stop()
    currentConfig = nil
    intendedPlayState = false
    cachedPosition = 0
    cachedDuration = 0
    do {
      try renderer.start()
    } catch {
      delegate?.engine(self, didFailWithError: "relance du rendu impossible : \(error.localizedDescription)")
    }
  }

  /// Démontage complet, idempotent : image dans l'image (désarmée PUIS
  /// fermée) → couche → écran verrouillé → rendu → session audio.
  ///
  /// Appelé par JS au moment de quitter le lecteur (`release`), et en filet
  /// quand la vue quitte l'arbre ou meurt. Tant qu'il n'avait lieu qu'au
  /// `deinit`, un moteur qui survivait à son écran gardait tout : le PiP
  /// automatique armé (il s'ouvrait en passant sur une notification), les
  /// commandes de l'écran verrouillé, la session audio active — iOS croyait
  /// l'app encore en lecture. La session n'est rendue qu'une fois mpv détruit :
  /// avant, sa sortie audio tournait encore et iOS refusait la désactivation
  /// (échec que le `try?` d'alors avalait).
  func shutdown() {
    guard !isShutDown else { return }
    isShutDown = true
    intendedPlayState = false
    MpvLogger.shared.log("moteur démonté", type: "Info")
    pipController.setAutoStartEnabled(false)
    pipController.stopPictureInPicture()
    displayLayer.removeFromSuperlayer()
    nowPlaying.cleanupRemoteCommands(for: self)
    nowPlaying.clear(for: self)
    NotificationCenter.default.removeObserver(self)
    // La complétion ne capture pas `self` : `shutdown` tourne aussi depuis `deinit`.
    let holder = ObjectIdentifier(self)
    renderer.stop { MpvEngine.releaseAudioSession(holder: holder) }
  }

  deinit {
    shutdown()
  }

  /// L'image dans l'image automatique ne vaut que pour une vue À L'ÉCRAN : une
  /// vue sortie de la fenêtre (écran quitté, en cours de démontage) la désarme.
  func setOnScreen(_ onScreen: Bool) {
    guard !isShutDown, !pipEngaged else { return }
    pipController.setAutoStartEnabled(onScreen && pipAutoStart && currentConfig != nil)
  }

  // MARK: - Now Playing

  func syncNowPlaying(isPlaying: Bool) {
    guard !isShutDown else { return }
    nowPlaying.updatePlayback(for: self, position: cachedPosition, duration: cachedDuration, isPlaying: isPlaying)
  }

  func setNowPlayingMetadata(_ metadata: [String: Any]?) {
    guard let metadata, !isShutDown else { return }
    nowPlaying.setMetadata(
      for: self,
      title: metadata["title"] as? String,
      artist: metadata["artist"] as? String,
      artworkUrl: metadata["artworkUrl"] as? String,
      artworkHeaders: metadata["artworkHeaders"] as? [String: String]
    )
  }

  func syncSubtitleLayerFrame() {
    renderer.syncSubtitleLayerFrame()
  }
}
