import Foundation
import MPVKit

/// Ce qu'une platine dit au moteur, sur la file du moteur.
protocol AudioDeckDelegate: AnyObject {
  func deckDidRestart(_ deck: AudioDeck)
  func deck(_ deck: AudioDeck, didChangeCache paused: Bool)
  func deck(_ deck: AudioDeck, didReachEnd eof: Bool)
  func deck(_ deck: AudioDeck, didMoveTo playlistIndex: Int64)
  func deck(_ deck: AudioDeck, didFail message: String)
}

/// Une PLATINE : une instance mpv en audio seul (les options de la coquille du
/// bureau, `audioOptions.ts`), sortie audiounit. Deux platines font le fondu
/// enchaîné ; une seule suffit pour l'enchaînement sans blanc (le suivant est
/// AJOUTÉ à sa liste, mpv le précharge et l'enchaîne).
///
/// Tout appel se fait sur `queue` (la file du moteur) ; les évènements de mpv y
/// sont relus et remis au délégué.
final class AudioDeck {
  let queue: DispatchQueue
  weak var delegate: AudioDeckDelegate?
  private var handle: OpaquePointer?
  /// Faux entre `loadfile` et la première image de son (`PLAYBACK_RESTART`).
  private(set) var restarted = false
  private(set) var loaded = false

  init(queue: DispatchQueue) {
    self.queue = queue
  }

  deinit {
    destroy()
  }

  // MARK: - Cycle de vie

  /// Crée l'instance au premier usage. `headers` : posés sur chaque requête (le serveur seul est permis).
  func start(headers: [String: String]) {
    guard handle == nil, let mpv = mpv_create() else { return }
    handle = mpv
    #if DEBUG
    mpv_request_log_messages(mpv, "warn")
    #endif
    for (name, value) in Self.initOptions { mpv_set_option_string(mpv, name, value) }
    if let ca = Bundle.main.url(forResource: "cacert", withExtension: "pem") {
      mpv_set_option_string(mpv, "tls-ca-file", ca.path)
    }
    guard mpv_initialize(mpv) >= 0 else {
      mpv_terminate_destroy(mpv)
      handle = nil
      return
    }
    setHeaders(headers)
    mpv_observe_property(mpv, 1, "paused-for-cache", MPV_FORMAT_FLAG)
    mpv_observe_property(mpv, 2, "eof-reached", MPV_FORMAT_FLAG)
    mpv_observe_property(mpv, 3, "playlist-pos", MPV_FORMAT_INT64)
    mpv_set_wakeup_callback(mpv, { context in
      guard let context else { return }
      let deck = Unmanaged<AudioDeck>.fromOpaque(context).takeUnretainedValue()
      deck.queue.async { deck.drain() }
    }, Unmanaged.passUnretained(self).toOpaque())
  }

  /// `http-header-fields` est une LISTE : « a: b,c: d » ; un jeton n'a jamais de virgule.
  func setHeaders(_ headers: [String: String]) {
    guard let mpv = handle else { return }
    let joined = headers.map { "\($0.key): \($0.value)" }.joined(separator: ",")
    mpv_set_property_string(mpv, "http-header-fields", joined)
  }

  func destroy() {
    guard let mpv = handle else { return }
    handle = nil
    mpv_set_wakeup_callback(mpv, nil, nil)
    // La destruction attend la fin de la sortie audio : jamais sur la file de l'appelant.
    DispatchQueue.global(qos: .utility).async { mpv_terminate_destroy(mpv) }
  }

  /// Les options d'une instance AUDIO SEUL (celles du bureau, sortie audiounit d'iOS).
  /// `audio-exclusive` : sans lui, `ao_audiounit` (mpv 0.41) repose la catégorie `.playback` AVEC
  /// `MixWithOthers` à chaque ouverture de sa sortie — et une app « mixable » n'est jamais « À l'écoute »
  /// pour iOS (ni écran verrouillé, ni Centre de contrôle, ni commandes du système). Il ne fait rien d'autre
  /// sur iOS.
  private static let initOptions: [(String, String)] = [
    ("vo", "null"), ("vid", "no"), ("video", "no"), ("audio-display", "no"),
    ("ao", "audiounit"), ("audio-exclusive", "yes"), ("idle", "yes"), ("keep-open", "yes"),
    ("gapless-audio", "weak"), ("prefetch-playlist", "yes"),
    ("sid", "no"), ("audio-file-auto", "no"), ("cover-art-auto", "no"),
    ("cache", "yes"), ("demuxer-max-bytes", "48MiB"), ("demuxer-max-back-bytes", "8MiB"),
    ("demuxer-readahead-secs", "30"), ("network-timeout", "20"),
    ("tls-verify", "yes"), ("volume-max", "150"), ("input-default-bindings", "no"),
    ("load-scripts", "no"), ("ytdl", "no"), ("config", "no"), ("terminal", "no"),
  ]

  // MARK: - Commandes

  /// Remplace tout par `url`, à `startMs`, en pause ou non.
  func load(_ url: String, startMs: Double, paused: Bool) {
    guard let mpv = handle else { return }
    restarted = false
    loaded = true
    setFlag("pause", paused)
    var args = ["loadfile", url, "replace", "-1"]
    if startMs > 0 { args.append("start=\(String(format: "%.3f", startMs / 1000))") }
    command(mpv, args)
  }

  /// Le suivant, ajouté à la liste : mpv le précharge et l'enchaîne sans blanc.
  func append(_ url: String) {
    guard let mpv = handle else { return }
    command(mpv, ["loadfile", url, "append"])
  }

  /// Retire tout ce qui suit l'entrée courante (un suivant ajouté puis retiré).
  func clearAfterCurrent() {
    guard let mpv = handle else { return }
    let count = getInt64("playlist-count") ?? 0
    let position = getInt64("playlist-pos") ?? 0
    var index = count - 1
    while index > position {
      command(mpv, ["playlist-remove", String(index)])
      index -= 1
    }
  }

  /// Oublie les entrées passées (après un enchaînement).
  func dropBefore(_ playlistIndex: Int64) {
    guard let mpv = handle, playlistIndex > 0 else { return }
    for _ in 0..<playlistIndex { command(mpv, ["playlist-remove", "0"]) }
  }

  func setPaused(_ paused: Bool) {
    setFlag("pause", paused)
  }

  func seek(_ ms: Double) {
    guard let mpv = handle else { return }
    restarted = false
    command(mpv, ["seek", String(format: "%.3f", max(0, ms) / 1000), "absolute+exact"])
  }

  func stop() {
    guard let mpv = handle else { return }
    loaded = false
    restarted = false
    command(mpv, ["stop"])
  }

  /// Un gain LINÉAIRE (0…~3) : le `volume` de mpv est cubique (gain = (v/100)³).
  func setGain(_ gain: Double) {
    guard let mpv = handle else { return }
    var volume = min(150, max(0, cbrt(max(0, gain)) * 100))
    mpv_set_property(mpv, "volume", MPV_FORMAT_DOUBLE, &volume)
  }

  var positionMs: Double { (getDouble("time-pos") ?? 0) * 1000 }
  var durationMs: Double? { getDouble("duration").map { $0 * 1000 } }
  var isActive: Bool { handle != nil && loaded }

  // MARK: - Évènements

  private func drain() {
    while let mpv = handle, let pointer = mpv_wait_event(mpv, 0) {
      let event = pointer.pointee
      if event.event_id == MPV_EVENT_NONE { return }
      dispatch(event)
      if event.event_id == MPV_EVENT_SHUTDOWN { return }
    }
  }

  private func dispatch(_ event: mpv_event) {
    switch event.event_id {
    case MPV_EVENT_PLAYBACK_RESTART:
      restarted = true
      delegate?.deckDidRestart(self)
    case MPV_EVENT_END_FILE:
      guard let data = event.data?.assumingMemoryBound(to: mpv_event_end_file.self).pointee else { return }
      if data.reason == MPV_END_FILE_REASON_ERROR {
        delegate?.deck(self, didFail: String(cString: mpv_error_string(data.error)))
      }
    case MPV_EVENT_PROPERTY_CHANGE:
      guard let property = event.data?.assumingMemoryBound(to: mpv_event_property.self).pointee,
            let data = property.data else { return }
      switch String(cString: property.name) {
      case "paused-for-cache":
        delegate?.deck(self, didChangeCache: data.assumingMemoryBound(to: Int32.self).pointee != 0)
      case "eof-reached":
        delegate?.deck(self, didReachEnd: data.assumingMemoryBound(to: Int32.self).pointee != 0)
      case "playlist-pos":
        delegate?.deck(self, didMoveTo: data.assumingMemoryBound(to: Int64.self).pointee)
      default:
        break
      }
    default:
      break
    }
  }

  // MARK: - Aides de l'API C

  private func command(_ mpv: OpaquePointer, _ args: [String]) {
    let cStrings = args.map { strdup($0) }
    defer { cStrings.forEach { free($0) } }
    var pointers: [UnsafePointer<CChar>?] = cStrings.map { $0.map { UnsafePointer($0) } }
    pointers.append(nil)
    pointers.withUnsafeMutableBufferPointer { buffer in
      _ = mpv_command(mpv, buffer.baseAddress)
    }
  }

  private func setFlag(_ name: String, _ value: Bool) {
    guard let mpv = handle else { return }
    var flag: Int32 = value ? 1 : 0
    mpv_set_property(mpv, name, MPV_FORMAT_FLAG, &flag)
  }

  private func getDouble(_ name: String) -> Double? {
    guard let mpv = handle else { return nil }
    var value: Double = 0
    return mpv_get_property(mpv, name, MPV_FORMAT_DOUBLE, &value) >= 0 ? value : nil
  }

  private func getInt64(_ name: String) -> Int64? {
    guard let mpv = handle else { return nil }
    var value: Int64 = 0
    return mpv_get_property(mpv, name, MPV_FORMAT_INT64, &value) >= 0 ? value : nil
  }
}
