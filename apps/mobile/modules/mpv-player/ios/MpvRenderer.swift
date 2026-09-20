// Dérivé de Streamyfin — https://github.com/streamyfin/streamyfin
// (modules/mpv-player/ios/MPVLayerRenderer.swift, révision 4faddc5f du
// 2026-09-12), publié sous Mozilla Public License 2.0. Ce fichier reste couvert
// par la MPL-2.0 (https://mozilla.org/MPL/2.0/) ; adaptation Tentacle TV :
// découpage en extensions, contrat d'événements, commentaires en français.
import AVFoundation
import CoreMedia
import CoreVideo
import MPVKit
import UIKit

/// Plage dynamique détectée sur le flux vidéo chargé.
enum HDRMode: String {
  case sdr
  case hdr10
  case hlg
}

/// Ce que le rendu remonte au moteur. Tous les appels arrivent sur le thread principal.
protocol MpvRendererDelegate: AnyObject {
  func renderer(_ renderer: MpvRenderer, didLoad info: [String: Any])
  func renderer(_ renderer: MpvRenderer, didUpdateTracks tracks: [[String: Any]])
  /// Après la première image décodée : dimensions réelles et plage dynamique.
  func renderer(_ renderer: MpvRenderer, didUpdateVideoParams params: [String: Any])
  func renderer(_ renderer: MpvRenderer, didUpdatePosition position: Double, duration: Double, cacheSeconds: Double)
  func renderer(_ renderer: MpvRenderer, didChangePause isPaused: Bool)
  func renderer(_ renderer: MpvRenderer, didChangeBuffering isBuffering: Bool)
  func renderer(_ renderer: MpvRenderer, didSelectAudioOutput name: String)
  func renderer(_ renderer: MpvRenderer, didFailWithError message: String)
  func rendererDidReachEnd(_ renderer: MpvRenderer)
}

/// libmpv piloté par `vo=avfoundation` : mpv pousse ses images dans un
/// `AVSampleBufferDisplayLayer` (VideoToolbox zéro copie, image dans l'image).
///
/// Règle de threading héritée de Streamyfin, et payée par eux : tout appel
/// libmpv bloquant (`mpv_get_property`, `mpv_set_property`, `mpv_command`)
/// passe par la file série `queue`. Pendant `vo_create`, le cœur mpv attend le
/// thread vidéo, dont l'initialisation AVFoundation fait un `dispatch_sync`
/// sur le thread principal : un appel bloquant depuis le principal à cet
/// instant verrouille main ⇄ cœur ⇄ vo jusqu'à ce que le chien de garde tue
/// l'app (0x8BADF00D). Les extensions de cette classe (options, propriétés,
/// événements, transport, pistes, diagnostics) partagent ses membres internes.
final class MpvRenderer {
  enum RendererError: Error {
    case creationFailed
    case initialization(Int32)
  }

  let displayLayer: AVSampleBufferDisplayLayer
  let queue: DispatchQueue
  let stateQueue = DispatchQueue(label: "tentacle.mpv.state", attributes: .concurrent)
  static let queueKey = DispatchSpecificKey<Bool>()
  static let stateQueueKey = DispatchSpecificKey<Bool>()

  var mpv: OpaquePointer?
  weak var delegate: MpvRendererDelegate?

  /// La demande de chargement en cours, lue par le gestionnaire FILE_LOADED (sur `queue`).
  var pendingConfig: MpvLoadConfig?
  /// Vrai entre FILE_LOADED et le chargement suivant : les changements de
  /// `track-list/count` ne sont remontés qu'une fois le fichier chargé.
  var fileLoaded = false
  /// Piste vidéo mise de côté par `setVideoEnabled(false)` (arrière-plan).
  var suspendedVideoTrack: String?
  /// Dernier état de tampon annoncé au délégué (`isLoading || pausedForCache`).
  var lastBufferingReported = false
  /// Le `hwdec` posé dans `start()` : la récupération après une couche en
  /// échec le restaure tel quel, jamais `auto` (un appareil mis en décodage
  /// logiciel n'est pas repromu en silence vers VideoToolbox).
  var configuredHwdec = "videotoolbox"
  static let maxDecoderResets = 3
  var lastProgressUpdateTime: CFAbsoluteTime = 0
  private var statusObservation: NSKeyValueObservation?

  // État partagé entre threads : champs privés, accesseurs sérialisés ci-dessous.
  private var _isRunning = false
  private var _isStopping = false
  private var _decoderResetCount = 0
  private var _cachedDuration: Double = 0
  private var _cachedPosition: Double = 0
  private var _cachedCacheSeconds: Double = 0
  private var _isPaused = true
  private var _playbackSpeed: Double = 1.0
  private var _isLoading = false
  private var _pausedForCache = false
  private var _isSeeking = false

  /// `deinit` peut tourner SUR un worker de `stateQueue` (dernière référence
  /// forte libérée par un bloc barrière) : relire le champ directement plutôt
  /// que `sync` sur la file déjà tenue, que libdispatch traiterait en EXC_BREAKPOINT.
  private var isOnStateQueue: Bool {
    DispatchQueue.getSpecific(key: Self.stateQueueKey) == true
  }

  var isRunning: Bool {
    get { isOnStateQueue ? _isRunning : stateQueue.sync { _isRunning } }
    set { stateQueue.async(flags: .barrier) { [weak self] in self?._isRunning = newValue } }
  }

  /// Écriture synchrone : `stop()` la relit aussitôt.
  var isStopping: Bool {
    get { isOnStateQueue ? _isStopping : stateQueue.sync { _isStopping } }
    set {
      if isOnStateQueue {
        _isStopping = newValue
        return
      }
      stateQueue.sync(flags: .barrier) { _isStopping = newValue }
    }
  }

  var decoderResetCount: Int {
    get { stateQueue.sync { _decoderResetCount } }
    set { stateQueue.sync(flags: .barrier) { _decoderResetCount = newValue } }
  }

  var cachedDuration: Double {
    get { stateQueue.sync { _cachedDuration } }
    set { stateQueue.async(flags: .barrier) { [weak self] in self?._cachedDuration = newValue } }
  }

  var cachedPosition: Double {
    get { stateQueue.sync { _cachedPosition } }
    set { stateQueue.async(flags: .barrier) { [weak self] in self?._cachedPosition = newValue } }
  }

  var cachedCacheSeconds: Double {
    get { stateQueue.sync { _cachedCacheSeconds } }
    set { stateQueue.async(flags: .barrier) { [weak self] in self?._cachedCacheSeconds = newValue } }
  }

  var isPaused: Bool {
    get { stateQueue.sync { _isPaused } }
    set { stateQueue.async(flags: .barrier) { [weak self] in self?._isPaused = newValue } }
  }

  var playbackSpeed: Double {
    get { stateQueue.sync { _playbackSpeed } }
    set { stateQueue.async(flags: .barrier) { [weak self] in self?._playbackSpeed = newValue } }
  }

  var isLoading: Bool {
    get { stateQueue.sync { _isLoading } }
    set { stateQueue.async(flags: .barrier) { [weak self] in self?._isLoading = newValue } }
  }

  var pausedForCache: Bool {
    get { stateQueue.sync { _pausedForCache } }
    set { stateQueue.async(flags: .barrier) { [weak self] in self?._pausedForCache = newValue } }
  }

  var isSeeking: Bool {
    get { stateQueue.sync { _isSeeking } }
    set { stateQueue.async(flags: .barrier) { [weak self] in self?._isSeeking = newValue } }
  }

  init(displayLayer: AVSampleBufferDisplayLayer) {
    self.displayLayer = displayLayer
    self.queue = DispatchQueue(label: "tentacle.mpv.core", qos: .userInitiated)
    queue.setSpecific(key: Self.queueKey, value: true)
    stateQueue.setSpecific(key: Self.stateQueueKey, value: true)
    observeDisplayLayerStatus()
  }

  deinit {
    stop()
  }

  /// iOS tue volontiers les sessions VideoToolbox (arrière-plan, écran
  /// verrouillé, mémoire basse) : la couche passe en `.failed` et l'image
  /// devient noire — surtout en image dans l'image. On relance le décodeur.
  private func observeDisplayLayerStatus() {
    statusObservation = displayLayer.observe(\.status, options: [.new]) { [weak self] layer, _ in
      guard let self, layer.status == .failed else { return }
      MpvLogger.shared.log("couche d'affichage en échec : relance du décodeur", type: "Warn")
      self.queue.async { self.performDecoderReset() }
    }
  }

  /// Borné à dessein : si la couche a échoué PARCE QUE le codec n'a pas de
  /// décodeur matériel ici, relancer VideoToolbox reproduit l'échec à l'infini,
  /// ce qui ressemble à un gel. Après `maxDecoderResets`, on reste en logiciel :
  /// lecture dégradée plutôt qu'absente. Le budget repart à chaque fichier.
  func performDecoderReset() {
    guard let handle = mpv else { return }
    let attempt = decoderResetCount + 1
    guard attempt <= Self.maxDecoderResets else {
      MpvLogger.shared.log(
        "couche encore en échec après \(Self.maxDecoderResets) relances : décodage logiciel conservé",
        type: "Warn"
      )
      return
    }
    decoderResetCount = attempt
    commandSync(handle, ["set", "hwdec", "no"])
    if attempt < Self.maxDecoderResets {
      commandSync(handle, ["set", "hwdec", configuredHwdec])
    }
  }

  func start() throws {
    guard !isRunning else { return }
    guard let handle = mpv_create() else { throw RendererError.creationFailed }
    mpv = handle

    // Journal mpv : « info » suffit en production (résumés AO/VO, erreurs) et
    // reste peu bavard ; verbeux en développement seulement.
    #if DEBUG
    checkError(mpv_request_log_messages(handle, "v"))
    #else
    checkError(mpv_request_log_messages(handle, "info"))
    #endif

    logAudioRoute("démarrage du lecteur")
    applyInitOptions(handle)

    let status = mpv_initialize(handle)
    guard status >= 0 else {
      mpv = nil
      mpv_terminate_destroy(handle)
      throw RendererError.initialization(status)
    }

    observeProperties(handle)
    mpv_set_wakeup_callback(handle, { context in
      guard let context else { return }
      Unmanaged<MpvRenderer>.fromOpaque(context).takeUnretainedValue().processEvents()
    }, Unmanaged.passUnretained(self).toOpaque())
    isRunning = true
  }

  func stop() {
    if isStopping { return }
    if !isRunning, mpv == nil { return }
    isRunning = false
    isStopping = true

    statusObservation?.invalidate()
    statusObservation = nil

    if let handle = mpv {
      mpv_set_wakeup_callback(handle, nil, nil)
      mpv = nil  // plus rien ne doit s'en servir

      // `quit` + vidange + destruction sur la file mpv SANS bloquer l'appelant :
      // `stop()` tourne sur le principal (démontage, deinit) et un `sync` ici
      // se coincerait derrière un appel client qui attend lui-même `vo_create`.
      // Le bloc ne capture que le pointeur brut, jamais `self` (deinit).
      queue.async {
        Self.quitAndDrain(handle)
        // `mpv_terminate_destroy` peut réclamer le thread principal pour le
        // nettoyage AVFoundation : hors de cette file aussi.
        DispatchQueue.global(qos: .userInitiated).async {
          mpv_terminate_destroy(handle)
        }
      }
    }

    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      if #available(iOS 18.0, *) {
        self.displayLayer.sampleBufferRenderer.flush(removingDisplayedImage: true, completionHandler: nil)
      } else {
        self.displayLayer.flushAndRemoveImage()
      }
    }

    isStopping = false
  }
}
