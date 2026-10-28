import Foundation

/// Un fondu en cours entre les deux platines, tenu en temps de LECTURE : une pause le suspend, la reprise
/// repart d'où il en était.
struct FadeState {
  let lengthMs: Double
  var elapsedMs: Double = 0
  var passedMid = false
  /// La platine qui s'éteint (index dans `decks`).
  let outgoing: Int
  /// Les gains de base (volume × ReplayGain) des deux titres, figés au départ.
  let outgoingBase: Double
  var incomingBase: Double
}

/// La transition douce : courbes à PUISSANCE CONSTANTE (cos² + sin² = 1), les règles de
/// `crossfadeRules.ts` — la durée, la page l'a déjà décidée.
extension OctaveAudioEngine {
  /// Démarre le suivant (ouvert en pause sur la platine arrière) et fond. `lengthMs == 0` : passage net.
  func beginFade(lengthMs: Double) {
    guard let next, nextPreloaded, fade == nil else { return }
    let outgoing = front
    fade = FadeState(lengthMs: lengthMs, outgoing: outgoing, outgoingBase: baseGain(current), incomingBase: baseGain(next))
    backDeck.setGain(0)
    backDeck.setPaused(!wantsPlay)
    ensureTicker()
    if lengthMs <= 0 { stepFade(byMs: 1) }
  }

  func stepFade(byMs delta: Double) {
    guard var state = fade else { return }
    if wantsPlay && !stalled { state.elapsedMs += delta }
    let x = state.lengthMs <= 0 ? 1 : min(1, state.elapsedMs / state.lengthMs)
    if x >= 0.5 && !state.passedMid {
      state.passedMid = true
      fade = state
      passMid()
    }
    fade = state
    applyFade(state)
    if x >= 1 { endFade() }
  }

  func applyFade(_ state: FadeState) {
    let x = state.lengthMs <= 0 ? 1 : min(1, state.elapsedMs / state.lengthMs)
    let incoming = 1 - state.outgoing
    decks[state.outgoing].setGain(state.outgoingBase * cos(x * .pi / 2))
    decks[incoming].setGain(state.incomingBase * sin(x * .pi / 2))
  }

  /// La mi-fondu : l'entrant passe DEVANT (état, écran verrouillé), la page avance sa file.
  private func passMid() {
    guard let arriving = next, let state = fade else { return }
    let fromKey = current?.track.key
    current = arriving
    next = nil
    nextPreloaded = false
    playedDurationMs = nil
    front = 1 - state.outgoing
    pendingPositionMs = nil
    stalled = false
    publishMeta()
    send(["type": "advanced", "fromKey": fromKey ?? NSNull(), "toKey": arriving.track.key])
    emitState()
  }

  private func endFade() {
    guard let state = fade else { return }
    // Garée, jamais arrêtée : sa sortie reste ouverte sous l'entrant (`AudioDeck.park`).
    decks[state.outgoing].park()
    fade = nil
    applyGains()
    // Un suivant donné pendant le fondu (à fondre lui aussi) s'ouvre maintenant sur la platine libérée.
    if let next, next.crossfadeMs > 0, !nextPreloaded { preloadNext() }
    ensureTicker()
  }

  /// Un saut pendant un fondu : on le termine d'un coup, l'entrant seul.
  func finishFadeNow() {
    guard var state = fade else { return }
    state.elapsedMs = state.lengthMs
    if !state.passedMid {
      state.passedMid = true
      fade = state
      passMid()
    }
    fade = state
    endFade()
  }

  /// Un geste (titre choisi) coupe tout fondu net : le sortant est garé, le titre choisi part devant.
  func cancelFade() {
    guard let state = fade else { return }
    fade = nil
    decks[state.outgoing].park()
    ensureTicker()
  }
}
