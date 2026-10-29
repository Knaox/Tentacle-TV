import Foundation

/// Le moteur audio d'Octave sur iOS : la coquille native du pont (`../README.md`). Il EXÉCUTE ce que la page
/// décide — le titre courant, le suivant, la durée du fondu — sur deux platines mpv, et publie ce que le système
/// affiche. Tout se passe sur `queue` ; le module Expo n'y fait qu'entrer.
final class OctaveAudioEngine {
  static let shared = OctaveAudioEngine()
  /// Le lancement : ce processus (iOS tue l'app balayée). La page ne reprend que la session de SON lancement.
  static let launchId = UUID().uuidString

  let queue = DispatchQueue(label: "tentacle.octave.audio", qos: .userInitiated)
  /// Un évènement du pont, déjà sérialisé (posé par le module).
  var emit: ((String) -> Void)?

  private(set) var decks: [AudioDeck] = []
  var front = 0
  var frontDeck: AudioDeck { decks[front] }
  var backDeck: AudioDeck { decks[1 - front] }

  var started = false
  var serverOrigin = ""
  var headers: [String: String] = [:]
  var volume = 1.0
  var muted = false
  var replayGainMode = "auto"

  var current: LoadedTrack?
  var next: LoadedTrack?
  /// Enchaînement sans blanc : le suivant est dans la liste de la platine devant.
  var nextAppended = false
  /// Fondu : le suivant est ouvert, en pause, sur la platine arrière.
  var nextPreloaded = false
  var fade: FadeState?
  var wantsPlay = false
  var stalled = false
  var ended = false
  var error: String?
  /// La position demandée tant que le son n'a pas redémarré (ouverture, saut).
  var pendingPositionMs: Double?
  /// Un titre interrompu en plein milieu se reprend plus loin (`MidTrackRecovery.swift`).
  var recovery = MidTrackRecovery()
  /// La durée réelle du titre devant, relevée pendant qu'il joue (après un enchaînement, la platine dit déjà celle du suivant).
  var playedDurationMs: Double?
  var ticker: DispatchSourceTimer?
  var tickInterval = 0.25
  var lastStateAt = Date.distantPast
  var lastPublishedStatus = ""

  private init() {
    decks = [AudioDeck(queue: queue), AudioDeck(queue: queue)]
    decks.forEach { $0.delegate = self }
  }

  // MARK: - Commandes du pont

  func handle(_ command: String, _ args: [String: Any]) -> Any? {
    switch command {
    case "audio_engine_start": return start(args)
    case "audio_engine_stop": shutdown()
    case "audio_play": play(args)
    case "audio_set_next": setNext(LoadedTrack.from(args), crossfadeMs: (args["crossfadeMs"] as? NSNumber)?.doubleValue ?? 0)
    case "audio_swap_source": swapSource(args)
    case "audio_control": control(args)
    case "audio_list_outputs": return [["id": "default", "name": "", "exclusiveCapable": false]]
    case "audio_set_output": break
    case "audio_level": return NSNull()
    #if DEBUG
    // Bancs de développement : ce que le système affiche (écran verrouillé), relu tel quel.
    case "audio_debug": return debugSnapshot()
    // Bancs : rejoue une commande de l'écran verrouillé par le MÊME chemin que ses boutons.
    case "audio_debug_remote":
      let command = args["command"] as? String ?? ""
      if command == "play" || command == "pause" { systemPlayOnQueue(command == "play") } else { sendRemote(command) }
    #endif
    default: break
    }
    return nil
  }

  private func start(_ args: [String: Any]) -> [String: Any] {
    serverOrigin = (args["serverOrigin"] as? String ?? "").lowercased()
    headers = args["headers"] as? [String: String] ?? [:]
    volume = (args["volume"] as? NSNumber)?.doubleValue ?? 1
    muted = args["muted"] as? Bool ?? false
    replayGainMode = args["replayGain"] as? String ?? "auto"
    // Les instances survivent à l'arrêt du moteur (sortie d'Octave) : y revenir ne recrée rien. Un nouveau
    // départ (autre jeton : changement de profil) n'en change que les en-têtes.
    decks.forEach { $0.start(headers: headers) }
    decks.forEach { $0.setHeaders(headers) }
    if !started {
      started = true
      activateSystem()
    }
    return [
      "engine": "mpv", "gapless": true, "exclusiveOutput": false, "replayGain": true,
      "codecs": ["flac", "alac", "opus", "vorbis", "aac", "mp3", "wav", "aiff", "wma", "ape", "wavpack", "dsd"],
      "hotSwap": false,
    ]
  }

  /// Sortie d'Octave : tout s'arrête (les sorties se ferment, la session est rendue), mais les deux instances
  /// mpv restent chaudes pour le retour.
  private func shutdown() {
    stopAll()
    front = 0
    started = false
    deactivateSystem()
  }

  private func play(_ args: [String: Any]) {
    guard let loaded = LoadedTrack.from(args) else { return }
    guard isAllowed(loaded.source) else { return fail("source hors du serveur") }
    let startMs = (args["startMs"] as? NSNumber)?.doubleValue ?? 0
    cancelFade()
    // La platine arrière est GARÉE (sortie gardée ouverte), jamais arrêtée sous le titre qui part.
    backDeck.park()
    next = nil
    nextAppended = false
    nextPreloaded = false
    current = loaded
    ended = false
    error = nil
    stalled = false
    wantsPlay = true
    recovery.reset()
    playedDurationMs = nil
    pendingPositionMs = startMs
    ensureSession()
    frontDeck.load(loaded.source.url, startMs: startMs, paused: false, bare: loaded.source.direct)
    applyGains()
    publishMeta()
    emitState()
    ensureTicker()
  }

  func setNext(_ loaded: LoadedTrack?, crossfadeMs: Double) {
    if nextAppended { frontDeck.clearAfterCurrent() }
    if nextPreloaded { backDeck.park() }
    nextAppended = false
    nextPreloaded = false
    guard var loaded, isAllowed(loaded.source) else {
      next = nil
      return
    }
    loaded.crossfadeMs = max(0, crossfadeMs)
    next = loaded
    // Un flux DIRECT ne s'ajoute jamais à la liste (son préchargement partirait avec le jeton du serveur) :
    // il s'ouvre sur la platine arrière et passe devant, net, à la fin du courant (`beginFade(lengthMs: 0)`).
    if loaded.opensOnBackDeck {
      // Pendant un fondu, la platine arrière est celle qui s'éteint : le suivant s'ouvrira à sa fin.
      if fade == nil { preloadNext() }
    } else {
      frontDeck.append(loaded.source.url)
      nextAppended = true
    }
  }

  func preloadNext() {
    guard let next, next.opensOnBackDeck else { return }
    backDeck.load(next.source.url, startMs: 0, paused: true, bare: next.source.direct)
    backDeck.setGain(0)
    nextPreloaded = true
  }

  private func swapSource(_ args: [String: Any]) {
    guard let key = args["trackKey"] as? String, let source = BridgeSource(args["source"]), isAllowed(source) else { return }
    if var playing = current, playing.track.key == key {
      let position = frontDeck.positionMs
      playing = LoadedTrack(track: playing.track, source: source, crossfadeMs: playing.crossfadeMs)
      current = playing
      pendingPositionMs = position
      error = nil
      if nextAppended { nextAppended = false }
      frontDeck.load(source.url, startMs: position, paused: !wantsPlay, bare: source.direct)
      if let next, !next.opensOnBackDeck { setNext(next, crossfadeMs: 0) }
      applyGains()
    } else if let pending = next, pending.track.key == key {
      setNext(LoadedTrack(track: pending.track, source: source), crossfadeMs: pending.crossfadeMs)
    } else {
      return
    }
    send(["type": "swapped", "trackKey": key, "origin": source.origin])
  }

  private func control(_ args: [String: Any]) {
    let value = args["value"]
    switch args["action"] as? String {
    case "pause": setWantsPlay(false)
    case "resume": setWantsPlay(true)
    case "stop": stopAll(); emitState()
    case "seek": seek((value as? NSNumber)?.doubleValue ?? 0)
    case "volume": volume = min(1, max(0, (value as? NSNumber)?.doubleValue ?? 1)); applyGains(); emitState()
    case "muted": muted = value as? Bool ?? false; applyGains(); emitState()
    case "replayGain": replayGainMode = args["mode"] as? String ?? "auto"; applyGains()
    default: break
    }
  }

  func setWantsPlay(_ play: Bool) {
    guard current != nil else { return }
    if play { ensureSession() }
    wantsPlay = play
    frontDeck.setPaused(!play)
    if fade != nil { backDeck.setPaused(!play) }
    emitState()
    ensureTicker()
  }

  func seek(_ ms: Double) {
    guard current != nil else { return }
    finishFadeNow()
    ended = false
    recovery.reset()
    pendingPositionMs = max(0, ms)
    frontDeck.seek(ms)
    emitState()
  }

  func stopAll() {
    cancelFade()
    decks.forEach { $0.stop() }
    current = nil
    next = nil
    nextAppended = false
    nextPreloaded = false
    wantsPlay = false
    ended = false
    error = nil
    stalled = false
    pendingPositionMs = nil
    stopTicker()
    clearNowPlaying()
  }

  func fail(_ message: String) {
    error = message
    emitState()
  }

  /// Une source que le moteur peut ouvrir : du serveur, un fichier local, ou un flux DIRECT en https dont le
  /// repli est du serveur (aucun en-tête ne part chez son hôte : `AudioDeck.load(bare:)`).
  func isAllowed(_ source: BridgeSource) -> Bool {
    guard source.direct else { return isAllowed(source.url) }
    guard let fallback = source.fallbackUrl else { return false }
    return source.url.lowercased().hasPrefix("https://") && isAllowed(fallback)
  }

  private func isAllowed(_ url: String) -> Bool {
    let lower = url.lowercased()
    return lower.hasPrefix("file://") || (!serverOrigin.isEmpty && (lower == serverOrigin || lower.hasPrefix(serverOrigin + "/")))
  }

  // MARK: - Gains

  func baseGain(_ loaded: LoadedTrack?) -> Double {
    guard let loaded, !muted else { return 0 }
    return volume * (loaded.source.replayGain?.linear(mode: replayGainMode) ?? 1)
  }

  func applyGains() {
    if let fade { return applyFade(fade) }
    frontDeck.setGain(baseGain(current))
    if nextPreloaded { backDeck.setGain(0) }
  }
}

extension LoadedTrack {
  static func from(_ args: [String: Any]) -> LoadedTrack? {
    guard let track = BridgeTrack(args["track"]), let source = BridgeSource(args["source"]) else { return nil }
    return LoadedTrack(track: track, source: source)
  }
}
