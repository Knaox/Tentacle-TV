import AVFoundation
import MediaPlayer
import UIKit

/// Ce que le SYSTÈME voit et commande : la session audio (lecture en arrière-plan, `UIBackgroundModes: audio`),
/// les interruptions (appel, alarme, autre app), la sortie débranchée, l'écran verrouillé et le Centre de
/// contrôle. Les commandes qui touchent à la file vont à la page (`remote`) ; lecture et pause sont appliquées
/// ici AUSSI, tout de suite.
extension OctaveAudioEngine {
  private static var commandTargets: [(MPRemoteCommand, Any)] = []
  private static var observers: [NSObjectProtocol] = []
  private static var artworkTask: URLSessionDataTask?
  private static var artwork: (url: String, image: MPMediaItemArtwork)?
  private static var interruptedWhilePlaying = false

  // MARK: - Fin de l'application

  /// L'application fermée pour de bon (balayée pendant l'écoute : iOS prévient une app qui joue en fond, avant de
  /// la tuer) : le son s'arrête et l'écran verrouillé est vidé TOUT DE SUITE — gardé, il montrerait encore le
  /// titre, et son « Lecture » relancerait l'app. Sur le fil principal (`willTerminateNotification`) ; rien
  /// d'asynchrone : le processus meurt juste après.
  func terminate() {
    queue.sync {
      if current != nil { stopAll() }
      started = false
    }
    for (command, target) in Self.commandTargets {
      command.removeTarget(target)
      command.isEnabled = false
    }
    Self.commandTargets = []
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    UIApplication.shared.endReceivingRemoteControlEvents()
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }

  // MARK: - Session et commandes

  /// Le démarrage du moteur n'ACTIVE pas la session : ouvrir Octave (une session reprise en pause) ne coupe
  /// jamais la musique d'une autre app. Elle s'active quand le son part (`ensureSession`).
  func activateSystem() {
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.observeSession()
      self.registerCommands()
      UIApplication.shared.beginReceivingRemoteControlEvents()
    }
  }

  /// La session de la MUSIQUE (le lecteur vidéo pose la sienne, « film ») : reposée chaque fois que le son
  /// part. Jamais « mixable » : iOS ne donne « À l'écoute » (écran verrouillé, Centre de contrôle) et les
  /// commandes du système qu'à une app qui ne se mélange pas aux autres — et mpv pose `MixWithOthers` à
  /// chaque ouverture de sa sortie si on ne l'en empêche pas (`audio-exclusive`, `AudioDeck.swift`).
  static func activateSession() {
    let session = AVAudioSession.sharedInstance()
    do {
      if session.category != .playback || session.mode != .default || !session.categoryOptions.isEmpty
        || session.routeSharingPolicy != .longFormAudio {
        try session.setCategory(.playback, mode: .default, policy: .longFormAudio, options: [])
      }
      try session.setActive(true)
    } catch {
      NSLog("[octave-audio] session audio : \(error.localizedDescription)")
    }
  }

  /// AVANT de lancer ou de reprendre le son, sur la file du moteur (AVAudioSession est sûre d'un fil à
  /// l'autre) : la sortie de mpv ne démarre pas sur une session inactive. Elle l'est après une
  /// interruption (appel, autre app), ou quand une platine se tait : mpv rend la session en fermant sa
  /// sortie (`ao_audiounit`, `setActive:NO`) — ce que iOS accepte dès que plus rien ne joue (pause).
  func ensureSession() {
    Self.activateSession()
  }

  func deactivateSystem() {
    DispatchQueue.main.async {
      Self.observers.forEach { NotificationCenter.default.removeObserver($0) }
      Self.observers = []
      for (command, target) in Self.commandTargets {
        command.removeTarget(target)
        command.isEnabled = false
      }
      Self.commandTargets = []
      MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
      UIApplication.shared.endReceivingRemoteControlEvents()
      try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
  }

  private func registerCommands() {
    guard Self.commandTargets.isEmpty else { return }
    let center = MPRemoteCommandCenter.shared()
    let on = { (command: MPRemoteCommand, action: @escaping (MPRemoteCommandEvent) -> Void) in
      command.isEnabled = true
      let target = command.addTarget { event in
        action(event)
        return .success
      }
      Self.commandTargets.append((command, target))
    }
    on(center.playCommand) { [weak self] _ in self?.systemPlay(true) }
    on(center.pauseCommand) { [weak self] _ in self?.systemPlay(false) }
    on(center.togglePlayPauseCommand) { [weak self] _ in
      guard let self else { return }
      self.queue.async { self.systemPlayOnQueue(!self.wantsPlay) }
    }
    on(center.nextTrackCommand) { [weak self] _ in self?.queue.async { self?.sendRemote("next") } }
    on(center.previousTrackCommand) { [weak self] _ in self?.queue.async { self?.sendRemote("previous") } }
    on(center.changePlaybackPositionCommand) { [weak self] event in
      guard let change = event as? MPChangePlaybackPositionCommandEvent else { return }
      self?.queue.async { self?.seek(change.positionTime * 1000) }
    }
    // Pas de ±15 s : de la musique, pas un livre audio — l'écran verrouillé montre précédent / suivant.
    center.skipForwardCommand.isEnabled = false
    center.skipBackwardCommand.isEnabled = false
  }

  private func systemPlay(_ play: Bool) {
    queue.async { [weak self] in self?.systemPlayOnQueue(play) }
  }

  /// Une commande du système : appliquée tout de suite, puis dite à la page (qui tient l'intention).
  func systemPlayOnQueue(_ play: Bool) {
    if current != nil { setWantsPlay(play) }
    sendRemote(play ? "play" : "pause")
  }

  func sendRemote(_ command: String) {
    send(["type": "remote", "command": command])
  }

  private func observeSession() {
    guard Self.observers.isEmpty else { return }
    let center = NotificationCenter.default
    Self.observers.append(center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: nil) { [weak self] note in
      self?.queue.async { self?.handleInterruption(note) }
    })
    Self.observers.append(center.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: nil) { [weak self] note in
      self?.queue.async { self?.handleRouteChange(note) }
    })
  }

  /// Appel, alarme, Siri, autre app : pause ; à la fin, reprise si le système le propose et qu'on jouait.
  private func handleInterruption(_ note: Notification) {
    guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
          let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
    if type == .began {
      Self.interruptedWhilePlaying = wantsPlay
      if wantsPlay { systemPlayOnQueue(false) }
      return
    }
    let options = (note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt).map(AVAudioSession.InterruptionOptions.init) ?? []
    if Self.interruptedWhilePlaying && options.contains(.shouldResume) {
      try? AVAudioSession.sharedInstance().setActive(true)
      systemPlayOnQueue(true)
    }
    Self.interruptedWhilePlaying = false
  }

  /// Casque débranché, Bluetooth perdu : la musique ne passe jamais d'elle-même au haut-parleur.
  private func handleRouteChange(_ note: Notification) {
    guard let raw = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
          AVAudioSession.RouteChangeReason(rawValue: raw) == .oldDeviceUnavailable, wantsPlay else { return }
    systemPlayOnQueue(false)
  }

  // MARK: - Écran verrouillé

  /// Le titre qui passe devant : titre, artiste, album, et la pochette (chargée à part).
  func publishMeta() {
    guard let meta = current?.track.meta else { return }
    let artworkUrl = meta.artworkUrl
    DispatchQueue.main.async {
      var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
      info[MPMediaItemPropertyTitle] = meta.title
      info[MPMediaItemPropertyArtist] = meta.artist
      info[MPMediaItemPropertyAlbumTitle] = meta.album
      info[MPNowPlayingInfoPropertyMediaType] = MPNowPlayingInfoMediaType.audio.rawValue
      if let artwork = Self.artwork, artwork.url == artworkUrl {
        info[MPMediaItemPropertyArtwork] = artwork.image
      } else {
        info[MPMediaItemPropertyArtwork] = nil
      }
      MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }
    if let artworkUrl, Self.artwork?.url != artworkUrl { loadArtwork(artworkUrl) }
  }

  private func loadArtwork(_ address: String) {
    Self.artworkTask?.cancel()
    guard let url = URL(string: address) else { return }
    var request = URLRequest(url: url)
    // Le jeton ne part que vers le serveur (l'adresse de la pochette le porte déjà s'il le faut).
    if address.lowercased().hasPrefix(serverOrigin) { headers.forEach { request.setValue($0.value, forHTTPHeaderField: $0.key) } }
    Self.artworkTask = URLSession.shared.dataTask(with: request) { [weak self] data, _, _ in
      guard let data, let image = UIImage(data: data) else { return }
      let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
      DispatchQueue.main.async {
        Self.artwork = (address, artwork)
        self?.queue.async { self?.publishMeta() }
      }
    }
    Self.artworkTask?.resume()
  }

  /// Position, durée, vitesse : le système EXTRAPOLE entre deux publications. On republie quand l'état change
  /// ou quand la position réelle s'écarte de ce qu'il croit (saut, titre suivant, fondu) — pas quatre fois par seconde.
  func publishPlayback(status: String, positionMs: Double, durationMs: Double?) {
    guard current != nil else { return }
    let now = Date()
    let rate = status == "playing" ? 1.0 : 0.0
    let expected = Self.published.position + (Self.published.rate * now.timeIntervalSince(Self.published.at) * 1000)
    let key = current?.track.key ?? ""
    let drifted = abs(expected - positionMs) > 1_000
    guard status != lastPublishedStatus || key != Self.published.key || drifted else { return }
    lastPublishedStatus = status
    Self.published = (key, positionMs, rate, now)
    DispatchQueue.main.async {
      var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
      info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = positionMs / 1000
      info[MPNowPlayingInfoPropertyPlaybackRate] = rate
      if let durationMs { info[MPMediaItemPropertyPlaybackDuration] = durationMs / 1000 }
      MPNowPlayingInfoCenter.default().nowPlayingInfo = info
      MPNowPlayingInfoCenter.default().playbackState = rate > 0 ? .playing : .paused
    }
  }

  /// La dernière publication : le titre, la position, la vitesse et l'instant (pour l'extrapolation).
  private static var published: (key: String, position: Double, rate: Double, at: Date) = ("", 0, 0, .distantPast)

  func clearNowPlaying() {
    lastPublishedStatus = ""
    Self.published = ("", 0, 0, .distantPast)
    DispatchQueue.main.async { MPNowPlayingInfoCenter.default().nowPlayingInfo = nil }
  }

  #if DEBUG
  /// Bancs : l'écran verrouillé tel que publié, et les commandes du système allumées.
  func debugSnapshot() -> [String: Any] {
    var out: [String: Any] = [:]
    DispatchQueue.main.sync {
      let info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
      out["title"] = info[MPMediaItemPropertyTitle] ?? NSNull()
      out["artist"] = info[MPMediaItemPropertyArtist] ?? NSNull()
      out["album"] = info[MPMediaItemPropertyAlbumTitle] ?? NSNull()
      out["duration"] = info[MPMediaItemPropertyPlaybackDuration] ?? NSNull()
      out["elapsed"] = info[MPNowPlayingInfoPropertyElapsedPlaybackTime] ?? NSNull()
      out["rate"] = info[MPNowPlayingInfoPropertyPlaybackRate] ?? NSNull()
      out["artwork"] = info[MPMediaItemPropertyArtwork] != nil
      let center = MPRemoteCommandCenter.shared()
      out["commands"] = [
        "play": center.playCommand.isEnabled, "pause": center.pauseCommand.isEnabled,
        "next": center.nextTrackCommand.isEnabled, "previous": center.previousTrackCommand.isEnabled,
        "seek": center.changePlaybackPositionCommand.isEnabled,
      ]
      let session = AVAudioSession.sharedInstance()
      out["category"] = session.category.rawValue
      out["mode"] = session.mode.rawValue
      out["mixable"] = session.categoryOptions.contains(.mixWithOthers)
      out["longFormAudio"] = session.routeSharingPolicy == .longFormAudio
    }
    out["decks"] = decks.map {
      ["active": $0.isActive, "paused": $0.isPaused, "positionMs": $0.positionMs,
       "path": String(($0.debugPath ?? "").prefix(80)), "output": $0.debugOutput ?? NSNull(), "bareHeaders": $0.debugBareHeaders] as [String: Any]
    }
    out["front"] = front
    out["fading"] = fade != nil
    return out
  }
  #endif
}

// MARK: - Niveau de sortie

extension OctaveAudioEngine {
  /// Le niveau entendu (dBFS) ou `NSNull` : la mesure à la sortie des platines, il y a la latence de la route.
  func outputLevel() -> Any {
    let db = octave_output_level_db(AVAudioSession.sharedInstance().outputLatency)
    return db.isNaN ? NSNull() : NSNumber(value: (db * 100).rounded() / 100)
  }
}
