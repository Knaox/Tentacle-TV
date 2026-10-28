package expo.modules.octaveaudio

import android.util.Log
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import kotlin.math.min

// Les passages d'un titre au suivant (et la source changée en route), pour `PlaybackCore` :
// - SANS BLANC (`crossfadeMs` 0) : le suivant est dans la file de la platine
//   devant ; ExoPlayer enchaîne seul, `onMediaItemTransition(AUTO)` → `advanced`,
//   puis le titre passé quitte la file.
// - FONDU (`crossfadeMs` > 0) : le suivant attend en pause à 0 sur l'autre
//   platine ; à `durée − crossfadeMs` il démarre, les gains suivent la courbe
//   (`CrossfadeRun`), `advanced` à mi-fondu (l'entrant passe devant), le sortant
//   s'arrête à la fin. `audio_play` coupe tout fondu net.
// Après `advanced`, le moteur n'a plus de suivant tant que le JS n'en redonne pas.

private const val TAG = "OctaveAudio"

/** `audio_set_next` : le suivant remplace l'ancien (`null` le retire). */
internal fun PlaybackCore.replaceNext(entry: DeckEntry?, crossfadeMs: Long) {
    // Un autre suivant avant la mi-fondu : le fondu vers l'ancien n'a plus d'objet.
    fade?.let { if (!it.passedMid) abortFade(it, rearm = false) }
    clearNext()
    if (entry == null) return
    if (!SourcePolicy.allows(entry.source)) {
        Log.w(TAG, "suivant refusé : origine inconnue")
        return
    }
    val plan = NextPlan(entry, crossfadeMs.coerceAtLeast(0))
    // Après la mi-fondu, la platine arrière joue encore la fin du sortant : un fondu attend qu'elle se libère.
    if (fade != null && plan.fades) {
        pendingNext = plan
        return
    }
    arm(plan)
}

/** Pose le suivant : dans la file de la platine devant (sans blanc) ou sur l'arrière, en pause à 0 (fondu). */
internal fun PlaybackCore.arm(plan: NextPlan) {
    if (plan.fades) {
        val deck = back
        deck.load(plan.entry, 0, play = false)
        deck.fadeGain = 0f
    } else {
        front.queueGapless(plan.entry)
    }
    next = plan
    applyVolumes()
    scheduleTick()
}

internal fun PlaybackCore.clearNext() {
    pendingNext = null
    val plan = next ?: return
    next = null
    if (plan.fades) backOrNull?.clear() else frontOrNull?.removeQueued()
}

/** Tout fondu coupé net, le suivant oublié (`audio_play`, `stop`). */
internal fun PlaybackCore.cancelTransitions() {
    fade = null
    next = null
    pendingNext = null
    backOrNull?.clear()
    frontOrNull?.let {
        it.removeQueued()
        it.fadeGain = 1f
    }
    applyVolumes()
}

/** Le signal du fondu : la platine devant joue et `durée − crossfadeMs` est atteint. */
internal fun PlaybackCore.maybeStartFade() {
    val plan = next?.takeIf { it.fades } ?: return
    val deck = frontOrNull ?: return
    if (!deck.player.isPlaying) return
    val until = CrossfadeRun.msUntilStart(deck, plan) ?: return
    if (until > 0) return
    val remaining = (deck.durationMs() ?: 0L) - deck.player.currentPosition
    startFade(plan, min(plan.crossfadeMs, remaining).coerceAtLeast(1))
}

internal fun PlaybackCore.startFade(plan: NextPlan, durationMs: Long) {
    next = null
    val run = CrossfadeRun(front, back, durationMs, plan, front.currentEntry?.trackKey)
    fade = run
    run.applyCurve(0.0)
    applyVolumes()
    run.incoming.player.play()
    scheduleTick()
}

/** Un pas d'horloge du fondu : gains, mi-fondu, fin. */
internal fun PlaybackCore.stepFade(run: CrossfadeRun) {
    val x = run.progress()
    run.applyCurve(x)
    applyVolumes()
    if (!run.passedMid && x >= 0.5) passMid(run)
    if (x >= 1.0) finishFade(run)
}

/** Mi-fondu : l'entrant passe devant (état, session, écran verrouillé), `advanced` part. */
internal fun PlaybackCore.passMid(run: CrossfadeRun) {
    run.passedMid = true
    if (frontOrNull === run.outgoing) frontIndex = 1 - frontIndex
    host.onFrontChanged(front.player)
    host.emit(BridgeJson.advancedEvent(run.fromKey, run.toKey))
    queueState()
}

/** Fin du fondu : le sortant s'arrête, l'entrant garde tout son gain, un suivant en attente est posé. */
internal fun PlaybackCore.finishFade(run: CrossfadeRun) {
    if (fade !== run) return
    if (!run.passedMid) passMid(run)
    fade = null
    run.outgoing.clear()
    run.incoming.fadeGain = 1f
    applyVolumes()
    pendingNext?.let {
        pendingNext = null
        arm(it)
    }
    queueState()
}

/** Fondu défait avant la mi-fondu : le sortant reprend tout son gain ; l'entrant revient en attente à 0, ou s'en va. */
internal fun PlaybackCore.abortFade(run: CrossfadeRun, rearm: Boolean) {
    fade = null
    run.outgoing.fadeGain = 1f
    if (rearm) {
        run.incoming.player.pause()
        run.incoming.player.seekTo(0)
        run.incoming.fadeGain = 0f
        next = run.plan
    } else {
        run.incoming.clear()
    }
    applyVolumes()
}

/** Un déplacement pendant un fondu : avant la mi-fondu, le fondu se défait (et reste armé) ; après, il se termine. */
internal fun PlaybackCore.settleFadeForSeek() {
    val run = fade ?: return
    if (run.passedMid) finishFade(run) else abortFade(run, rearm = true)
}

/**
 * Une nouvelle source en route (`audio_swap_source`) : le courant est relu à la
 * même position, le suivant (préchargé, en attente d'un fondu, ou à poser après
 * le fondu) la prend. Vrai si un titre de cette clé l'a reçue.
 */
internal fun PlaybackCore.swapSource(trackKey: String, source: BridgeSource): Boolean {
    if (!SourcePolicy.allows(source)) return false
    var swapped = false
    for (deck in loadedDecks) {
        deck.currentEntry?.takeIf { it.trackKey == trackKey }?.let {
            it.source = source
            if (deck === frontOrNull) clearError()
            deck.reloadCurrent(it)
            swapped = true
        }
        deck.queuedEntry?.takeIf { it.trackKey == trackKey }?.let {
            it.source = source
            deck.replaceQueued(it)
            swapped = true
        }
    }
    pendingNext?.entry?.takeIf { it.trackKey == trackKey }?.let {
        it.source = source
        swapped = true
    }
    if (swapped) {
        applyVolumes()
        queueState()
    }
    return swapped
}

internal fun PlaybackCore.handleDeckEnded(deck: AudioDeck) {
    val run = fade
    if (run != null && deck === run.outgoing) {
        // Le sortant s'est tu avant la fin du fondu : l'entrant passe devant et finit sa montée.
        if (!run.passedMid) passMid(run)
        return
    }
    if (run != null && deck === run.incoming) finishFade(run)
    if (deck !== frontOrNull) return
    val plan = next
    if (plan != null && plan.fades) {
        // Le signal n'a pas pu tomber (durée inconnue) : le suivant part tout de suite, sans fondu.
        startFade(plan, 0)
        fade?.let { finishFade(it) }
        return
    }
    // Fin du dernier titre, rien de suivant : `ended`, le focus est rendu.
    focus.release()
    queueState()
}

internal fun PlaybackCore.handleDeckTransition(deck: AudioDeck, previous: DeckEntry?, reason: Int) {
    if (deck !== frontOrNull) return
    if (reason == Player.MEDIA_ITEM_TRANSITION_REASON_AUTO && previous !== deck.currentEntry) {
        // Enchaînement sans blanc : le suivant est devenu le courant.
        next = null
        handler.post { deck.dropPlayed() }
        applyVolumes()
        host.emit(BridgeJson.advancedEvent(previous?.trackKey, deck.currentEntry?.trackKey))
    }
    queueState()
}

internal fun PlaybackCore.handleDeckError(deck: AudioDeck, error: PlaybackException) {
    val message = "${error.errorCodeName}: ${error.message ?: ""}"
    Log.w(TAG, "lecture en échec : $message", error)
    val run = fade
    // Un flux direct refusé (URL expirée, liée à une autre adresse) : le serveur le relit, à la même position.
    val failing = deck.currentEntry
    val fallback = failing?.source?.serverFallback()
    if (failing != null && fallback != null) {
        Log.w(TAG, "flux direct refusé : le serveur reprend")
        failing.source = fallback
        if (deck === frontOrNull) clearError()
        deck.reloadCurrent(failing)
        applyVolumes()
        queueState()
        return
    }
    when {
        deck === frontOrNull -> {
            val key = deck.currentEntry?.trackKey
            cancelTransitions()
            fail(message, key)
        }
        // L'entrant ne s'ouvre pas : le sortant finit seul, à plein gain.
        run != null && deck === run.incoming -> abortFade(run, rearm = false)
        // Le suivant préparé (fondu) ne s'ouvre pas : la file s'arrêtera à la fin du courant.
        else -> {
            if (next?.fades == true) next = null
            deck.clear()
        }
    }
}
