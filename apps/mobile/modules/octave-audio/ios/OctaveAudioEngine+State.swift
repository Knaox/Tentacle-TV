import Foundation

/// Ce que les platines disent, l'horloge du moteur (250 ms, 30 ms pendant un fondu) et l'état poussé à la page.
extension OctaveAudioEngine: AudioDeckDelegate {
  // MARK: - Évènements des platines

  func deckDidRestart(_ deck: AudioDeck) {
    guard deck === frontDeck else { return }
    pendingPositionMs = nil
    emitState()
  }

  func deck(_ deck: AudioDeck, didChangeCache paused: Bool) {
    guard deck === frontDeck else { return }
    stalled = paused
    emitState()
  }

  func deck(_ deck: AudioDeck, didReachEnd eof: Bool) {
    guard eof, deck === frontDeck, current != nil, fade == nil else { return }
    // Arrêté avant sa fin (flux rompu, fichier tronqué) : repris, au lieu de passer au suivant.
    if recoverFront() { return }
    // Un fondu prévu qui n'a pas pu commencer (durée inconnue, titre trop court) : on passe net au suivant.
    if nextPreloaded { return beginFade(lengthMs: 0) }
    if nextAppended { return }
    ended = true
    emitState()
  }

  func deck(_ deck: AudioDeck, didMoveTo playlistIndex: Int64) {
    guard deck === frontDeck, playlistIndex >= 1, nextAppended, let arriving = next else { return }
    // mpv enchaîne aussi sur une fin PRÉMATURÉE : le titre interrompu est repris, le suivant reste derrière.
    if recoverFront() { return }
    let fromKey = current?.track.key
    current = arriving
    next = nil
    nextAppended = false
    playedDurationMs = nil
    frontDeck.dropBefore(playlistIndex)
    applyGains()
    publishMeta()
    send(["type": "advanced", "fromKey": fromKey ?? NSNull(), "toKey": arriving.track.key])
    emitState()
  }

  func deck(_ deck: AudioDeck, didFail message: String) {
    if deck === frontDeck, current != nil, fade == nil {
      // Une trame illisible en plein titre : reprise plus loin plutôt qu'une erreur.
      if recoverFront() { return }
      fail(message)
    } else if deck === backDeck, nextPreloaded {
      // Le suivant ne s'ouvre pas : la page le relancera à la fin du titre (« ended » → titre suivant).
      nextPreloaded = false
      next = nil
    }
  }

  /// Le titre devant s'est arrêté AVANT sa fin : relu sur la même platine, à la position ou plus loin
  /// (`MidTrackRecovery`). Faux : vraie fin, rien joué encore, ou reprises épuisées.
  func recoverFront() -> Bool {
    guard fade == nil, let playing = current,
          let at = recovery.take(playing.track.key, durationMs: playedDurationMs ?? playing.durationMs) else { return false }
    NSLog("[octave-audio] titre interrompu à %.1f s : repris à %.1f s", (frontDeck.positionMs) / 1000, at / 1000)
    ended = false
    error = nil
    stalled = false
    pendingPositionMs = at
    if wantsPlay { ensureSession() }
    frontDeck.load(playing.source.url, startMs: at, paused: !wantsPlay)
    // Le suivant sans blanc vivait dans la liste de cette platine, que `load` vient de remplacer.
    if nextAppended, let pending = next {
      nextAppended = false
      setNext(pending, crossfadeMs: pending.crossfadeMs)
    }
    applyGains()
    emitState()
    return true
  }

  // MARK: - Horloge et état

  func ensureTicker() {
    let interval = fade != nil ? 0.03 : 0.25
    if ticker != nil && interval == tickInterval { return }
    stopTicker()
    tickInterval = interval
    let timer = DispatchSource.makeTimerSource(queue: queue)
    timer.schedule(deadline: .now() + interval, repeating: interval, leeway: .milliseconds(5))
    timer.setEventHandler { [weak self] in self?.tick() }
    timer.resume()
    ticker = timer
  }

  func stopTicker() {
    ticker?.cancel()
    ticker = nil
  }

  private func tick() {
    guard let playing = current else { return stopTicker() }
    if fade == nil, wantsPlay, !stalled, pendingPositionMs == nil, frontDeck.restarted {
      recovery.played(playing.track.key, frontDeck.positionMs)
      if let duration = frontDeck.durationMs { playedDurationMs = duration }
    }
    if fade != nil {
      stepFade(byMs: tickInterval * 1000)
    } else if let next, nextPreloaded, wantsPlay, !stalled {
      let duration = frontDeck.durationMs ?? current?.durationMs
      if let duration, duration > 0, frontDeck.positionMs >= duration - next.crossfadeMs {
        beginFade(lengthMs: next.crossfadeMs)
      }
    }
    if Date().timeIntervalSince(lastStateAt) >= 0.25 { emitState() }
  }

  func status() -> String {
    guard current != nil else { return "idle" }
    if error != nil { return "error" }
    if ended { return "ended" }
    if pendingPositionMs != nil && !frontDeck.restarted { return wantsPlay ? "loading" : "paused" }
    if stalled && wantsPlay { return "buffering" }
    return wantsPlay ? "playing" : "paused"
  }

  func positionMs() -> Double {
    pendingPositionMs ?? frontDeck.positionMs
  }

  func emitState() {
    lastStateAt = Date()
    let duration = frontDeck.durationMs ?? current?.durationMs
    let status = status()
    send([
      "type": "state",
      "at": Int64(Date().timeIntervalSince1970 * 1000),
      "state": [
        "status": status,
        "trackKey": current?.track.key ?? NSNull(),
        "positionMs": positionMs(),
        "durationMs": duration ?? NSNull(),
        "volume": volume,
        "muted": muted,
        "format": NSNull(),
        "output": ["deviceId": NSNull(), "exclusive": false],
        "error": error ?? NSNull(),
      ] as [String: Any],
    ])
    publishPlayback(status: status, positionMs: positionMs(), durationMs: duration)
  }

  func send(_ event: [String: Any]) {
    emit?(BridgeJson.string(event))
  }
}
