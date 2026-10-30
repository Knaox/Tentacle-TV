package expo.modules.octaveaudio

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player

/**
 * Les deux platines et ce qu'elles jouent : le courant (platine DEVANT), le
 * suivant (dans sa file pour un enchaînement sans blanc, sur l'autre platine pour
 * un fondu), les réglages (volume, sourdine, ReplayGain, canard) et l'horloge qui
 * publie l'état et fait avancer les fondus. Rien ne décide ici de la file : le JS
 * donne le courant et le suivant, le moteur EXÉCUTE (README du module).
 *
 * Enchaînements et fondus : `PlaybackTransitions.kt` ; ce que fait le système
 * (focus, session média) : `RemoteControls.kt`. Tout se passe sur le fil
 * principal : commandes du pont (`Queues.MAIN`), rappels d'ExoPlayer, du focus
 * audio et de la session média.
 */
internal class PlaybackCore(context: Context, internal val host: Host) : AudioDeck.Listener {
    interface Host {
        /** Un `AudioBridgeEvent` sérialisé, vers le JS. */
        fun emit(json: String)

        /** La platine devant a changé (mi-fondu) : la session média suit. */
        fun onFrontChanged(player: Player)

        /** Une lecture va commencer : le service de la session doit tourner. */
        fun onPlaybackRequested()
    }

    private val appContext = context.applicationContext
    internal val handler = Handler(Looper.getMainLooper())
    private val decks = arrayOfNulls<AudioDeck>(2)
    internal var frontIndex = 0

    /** Le système (focus, session média) : ses commandes, ce que le JS en apprend. */
    val remote = RemoteControls(this)
    internal val focus = AudioFocusKeeper(appContext, handler, remote)

    /** Le suivant armé (file de la platine devant, ou platine arrière en pause à 0). */
    internal var next: NextPlan? = null

    /** Un suivant À FONDU donné après la mi-fondu : posé quand la platine arrière sera libre. */
    internal var pendingNext: NextPlan? = null
    internal var fade: CrossfadeRun? = null

    private var error: String? = null
    private var errorKey: String? = null
    private var volume = 1.0
    private var muted = false
    private var replayGain = "off"
    private var ducked = false

    private var ticking = false
    private var stateQueued = false
    private var lastStateAt = 0L
    private val tickRunnable = Runnable { tick() }
    private val stateRunnable = Runnable {
        stateQueued = false
        emitState()
    }

    /** La platine devant (créée au besoin) : celle qu'on entend, celle que montre la session. */
    val front: AudioDeck get() = deckAt(frontIndex)
    internal val back: AudioDeck get() = deckAt(1 - frontIndex)
    internal val frontOrNull: AudioDeck? get() = decks[frontIndex]
    internal val backOrNull: AudioDeck? get() = decks[1 - frontIndex]
    internal val loadedDecks: List<AudioDeck> get() = decks.filterNotNull()

    private fun deckAt(index: Int): AudioDeck =
        decks[index] ?: LevelMeter().let { meter -> AudioDeck(DeckPlayers.create(appContext, meter), this, meter) }.also {
            decks[index] = it
            applyVolumes()
        }

    fun configure(volume: Double, muted: Boolean, replayGain: String) {
        this.volume = volume.coerceIn(0.0, 1.0)
        this.muted = muted
        this.replayGain = replayGain
        applyVolumes()
        queueState()
    }

    fun setVolume(value: Double) = configure(value, muted, replayGain)

    fun setMuted(value: Boolean) = configure(volume, value, replayGain)

    fun setReplayGain(mode: String) = configure(volume, muted, mode)

    fun setDucked(value: Boolean) {
        ducked = value
        applyVolumes()
    }

    // ── Commandes du pont ───────────────────────────────────────────────────

    /** `audio_play` : tout fondu coupé net, le suivant oublié, `entry` joué à `startMs`. */
    fun play(entry: DeckEntry, startMs: Long) {
        cancelTransitions()
        clearError()
        if (!SourcePolicy.allows(entry.source)) {
            frontOrNull?.clear()
            fail("octave-audio: source refusée (origine inconnue)", entry.trackKey)
            return
        }
        val deck = front
        deck.fadeGain = 1f
        deck.load(entry, startMs, play = true)
        applyVolumes()
        host.onPlaybackRequested()
        if (!focus.acquire()) {
            deck.player.pause()
            host.emit(BridgeJson.remoteEvent("pause"))
        }
        queueState()
        scheduleTick()
    }

    fun setNext(entry: DeckEntry?, crossfadeMs: Long) = replaceNext(entry, crossfadeMs)

    /** `audio_swap_source` : vrai si un titre de cette clé a reçu la source (courant, suivant). */
    fun swap(trackKey: String, source: BridgeSource): Boolean = swapSource(trackKey, source)

    fun pause() {
        focus.cancelResume()
        pauseDecks()
        queueState()
    }

    /** Reprendre (les deux platines d'un fondu). Faux si rien n'est chargé, ou si le focus est refusé. */
    fun resume(): Boolean {
        val player = frontOrNull?.takeIf { it.hasMedia }?.player ?: return false
        if (!focus.acquire()) {
            host.emit(BridgeJson.remoteEvent("pause"))
            queueState()
            return false
        }
        host.onPlaybackRequested()
        // Fin de la file : on repart du début (comme le bureau) ; après une erreur : nouvel essai.
        if (player.playbackState == Player.STATE_ENDED) player.seekTo(0)
        if (player.playbackState == Player.STATE_IDLE) {
            clearError()
            player.prepare()
        }
        player.play()
        fade?.let {
            it.outgoing.player.play()
            it.incoming.player.play()
        }
        queueState()
        scheduleTick()
        return true
    }

    fun stop() {
        cancelTransitions()
        frontOrNull?.clear()
        clearError()
        focus.release()
        queueState()
    }

    /** Un déplacement dans le courant ; pendant un fondu, celui-ci se défait ou se termine d'abord. */
    fun seek(positionMs: Long) {
        if (frontOrNull?.hasMedia != true) return
        settleFadeForSeek()
        front.player.seekTo(positionMs.coerceAtLeast(0))
        queueState()
    }

    /** Quelque chose joue ou veut jouer : le service ne s'arrête pas quand l'application est balayée. */
    fun isPlaying(): Boolean {
        if (decks.any { it?.player?.isPlaying == true }) return true
        val deck = frontOrNull ?: return false
        return deck.hasMedia && deck.player.playWhenReady && deck.player.playbackState != Player.STATE_ENDED
    }

    /** `audio_engine_stop` : tout s'arrête, les lecteurs sont libérés, le focus rendu. */
    fun release() {
        handler.removeCallbacks(tickRunnable)
        handler.removeCallbacks(stateRunnable)
        ticking = false
        stateQueued = false
        fade = null
        next = null
        pendingNext = null
        focus.release()
        for (i in decks.indices) {
            decks[i]?.release()
            decks[i] = null
        }
    }

    // ── Platines, volume, état ──────────────────────────────────────────────

    internal fun pauseDecks() {
        frontOrNull?.player?.pause()
        fade?.let {
            it.outgoing.player.pause()
            it.incoming.player.pause()
        }
    }

    /**
     * Le volume de chaque platine : volume réglé (courbe cubique, celle du volume
     * de mpv sur le bureau et l'iPhone : le même curseur sonne pareil partout) ×
     * sourdine × canard × ReplayGain du titre que joue la platine × courbe du fondu.
     */
    internal fun applyVolumes() {
        val base = if (muted) 0.0 else volume * volume * volume * (if (ducked) DUCK_GAIN else 1.0)
        for (deck in decks) {
            if (deck == null) continue
            val gain = deck.currentEntry?.gain(replayGain) ?: 1f
            deck.player.volume = (base * gain * deck.fadeGain).toFloat().coerceIn(0f, 1f)
        }
    }

    internal fun fail(message: String, trackKey: String?) {
        error = message
        errorKey = trackKey
        queueState()
    }

    internal fun clearError() {
        error = null
        errorKey = null
    }

    /** Un état part au prochain tour du fil principal (plusieurs changements d'un coup = un seul état). */
    internal fun queueState() {
        if (stateQueued) return
        stateQueued = true
        handler.post(stateRunnable)
    }

    private fun emitState() {
        lastStateAt = SystemClock.elapsedRealtime()
        val deck = frontOrNull?.takeIf { it.hasMedia }
        val state = BridgeState(
            status = if (error != null) "error" else deck?.bridgeStatus() ?: "idle",
            trackKey = deck?.currentEntry?.trackKey ?: errorKey,
            positionMs = deck?.player?.currentPosition?.coerceAtLeast(0) ?: 0,
            durationMs = deck?.durationMs(),
            volume = volume,
            muted = muted,
            error = error,
        )
        host.emit(BridgeJson.stateEvent(state, System.currentTimeMillis()))
    }

    /** L'horloge : fondus (pas fin), signal de départ du fondu, état toutes les 250 ms. Tourne tant que ça joue. */
    internal fun scheduleTick() {
        if (ticking) return
        ticking = true
        handler.post(tickRunnable)
    }

    private fun tick() {
        ticking = false
        val run = fade
        if (run != null) stepFade(run) else maybeStartFade()
        val active = fade != null || decks.any { it?.player?.isPlaying == true }
        if (!active) return
        if (SystemClock.elapsedRealtime() - lastStateAt >= STATE_EVERY_MS) emitState()
        ticking = true
        handler.postDelayed(tickRunnable, tickDelay())
    }

    private fun tickDelay(): Long {
        if (fade != null) return CrossfadeRun.FINE_TICK_MS
        val plan = next?.takeIf { it.fades } ?: return CrossfadeRun.COARSE_TICK_MS
        val until = frontOrNull?.let { CrossfadeRun.msUntilStart(it, plan) } ?: return CrossfadeRun.COARSE_TICK_MS
        return if (until <= CrossfadeRun.APPROACH_MS) CrossfadeRun.FINE_TICK_MS else CrossfadeRun.COARSE_TICK_MS
    }

    // ── Rappels des platines ────────────────────────────────────────────────

    override fun onDeckChanged(deck: AudioDeck) {
        if (deck === frontOrNull) queueState()
        scheduleTick()
    }

    override fun onDeckEnded(deck: AudioDeck) = handleDeckEnded(deck)

    override fun onDeckTransition(deck: AudioDeck, previous: DeckEntry?, reason: Int) = handleDeckTransition(deck, previous, reason)

    override fun onDeckError(deck: AudioDeck, error: PlaybackException) = handleDeckError(deck, error)

    private companion object {
        /** « Baisser le son » d'Android : le volume × 0,2 le temps de l'interruption. */
        const val DUCK_GAIN = 0.2

        /** Un état toutes les 250 ms en lecture (marge pour la gigue de l'horloge). */
        const val STATE_EVERY_MS = 240L
    }
}
