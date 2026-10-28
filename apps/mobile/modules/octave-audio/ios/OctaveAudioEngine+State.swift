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
    // Un fondu prévu qui n'a pas pu commencer (durée inconnue, titre trop court) : on passe net au suivant.
    if nextPreloaded { return beginFade(lengthMs: 0) }
    if nextAppended { return }
    ended = true
    emitState()
  }

  func deck(_ deck: AudioDeck, didMoveTo playlistIndex: Int64) {
    guard deck === frontDeck, playlistIndex >= 1, nextAppended, let arriving = next else { return }
    let fromKey = current?.track.key
    current = arriving
    next = nil
    nextAppended = false
    frontDeck.dropBefore(playlistIndex)
    applyGains()
    publishMeta()
    send(["type": "advanced", "fromKey": fromKey ?? NSNull(), "toKey": arriving.track.key])
    emitState()
  }

  func deck(_ deck: AudioDeck, didFail message: String) {
    if deck === frontDeck, current != nil, fade == nil {
      fail(message)
    } else if deck === backDeck, nextPreloaded {
      // Le suivant ne s'ouvre pas : la page le relancera à la fin du titre (« ended » → titre suivant).
      nextPreloaded = false
      next = nil
    }
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
    guard current != nil else { return stopTicker() }
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
