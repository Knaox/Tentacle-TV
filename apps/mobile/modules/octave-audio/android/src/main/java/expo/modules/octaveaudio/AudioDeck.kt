package expo.modules.octaveaudio

import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer

/**
 * Une platine : UN ExoPlayer et sa file de un ou deux titres — le courant, et le
 * suivant quand il s'enchaîne SANS BLANC (préchargé par ExoPlayer dans sa file).
 * Pour un fondu, le suivant est sur l'AUTRE platine (`PlaybackCore`).
 *
 * La platine ne décide rien : elle charge, retire, rend compte au moteur
 * (`Listener`). Son `fadeGain` est le gain de la courbe du fondu (1 hors fondu),
 * que le moteur multiplie au volume et au ReplayGain. Fil principal seulement.
 */
internal class AudioDeck(val player: ExoPlayer, private val listener: Listener, val meter: LevelMeter) : Player.Listener {
    interface Listener {
        fun onDeckChanged(deck: AudioDeck)
        fun onDeckEnded(deck: AudioDeck)
        fun onDeckTransition(deck: AudioDeck, previous: DeckEntry?, reason: Int)
        fun onDeckError(deck: AudioDeck, error: PlaybackException)
    }

    /** Gain de la courbe du fondu : cos/sin pendant une transition douce, 1 sinon. */
    var fadeGain = 1f

    /** Prêt au moins une fois depuis le dernier chargement : distingue « ouverture » et « attente de données ». */
    var everReady = false
        private set

    /** Le titre courant tel que vu au dernier changement : l'origine d'un enchaînement (`advanced.fromKey`). */
    private var lastEntry: DeckEntry? = null

    init {
        player.addListener(this)
    }

    val currentEntry: DeckEntry? get() = player.currentMediaItem?.entry

    val hasMedia: Boolean get() = player.mediaItemCount > 0

    /** Le titre préchargé à la suite du courant (enchaînement sans blanc), s'il y en a un. */
    val queuedEntry: DeckEntry?
        get() {
            val index = player.currentMediaItemIndex + 1
            return if (index < player.mediaItemCount) player.getMediaItemAt(index).entry else null
        }

    /** La durée du décodeur, sinon celle de la bibliothèque. */
    fun durationMs(): Long? = player.duration.takeIf { it != C.TIME_UNSET && it > 0 } ?: currentEntry?.knownDurationMs()

    /** Le `status` du pont pour cette platine (hors erreur, que tient le moteur). */
    fun bridgeStatus(): String {
        if (!hasMedia) return "idle"
        return when (player.playbackState) {
            Player.STATE_IDLE -> "idle"
            Player.STATE_ENDED -> "ended"
            Player.STATE_BUFFERING -> when {
                !everReady -> "loading"
                player.playWhenReady -> "buffering"
                else -> "paused"
            }
            else -> {
                val playing = player.playWhenReady && player.playbackSuppressionReason == Player.PLAYBACK_SUPPRESSION_REASON_NONE
                if (playing) "playing" else "paused"
            }
        }
    }

    /** Pose un titre seul, à `startMs`, en lecture ou en pause (le suivant d'un fondu attend en pause à 0). */
    fun load(entry: DeckEntry, startMs: Long, play: Boolean) {
        everReady = false
        lastEntry = entry
        player.setMediaItem(entry.mediaItem(), startMs.coerceAtLeast(0))
        player.playWhenReady = play
        player.prepare()
    }

    /** Le suivant SANS BLANC : un seul à la fois derrière le courant. */
    fun queueGapless(entry: DeckEntry) {
        removeQueued()
        player.addMediaItem(entry.mediaItem())
    }

    fun removeQueued() {
        val from = player.currentMediaItemIndex + 1
        if (from < player.mediaItemCount) player.removeMediaItems(from, player.mediaItemCount)
    }

    /** Après un enchaînement : le titre passé quitte la file. */
    fun dropPlayed() {
        val index = player.currentMediaItemIndex
        if (index > 0) player.removeMediaItems(0, index)
    }

    /** Nouvelle source du COURANT : relue à la même position, le suivant préchargé gardé, lecture ou pause gardées. */
    fun reloadCurrent(entry: DeckEntry) {
        val index = player.currentMediaItemIndex
        val position = player.currentPosition
        val items = mutableListOf<MediaItem>(entry.mediaItem())
        for (i in index + 1 until player.mediaItemCount) items.add(player.getMediaItemAt(i))
        lastEntry = entry
        player.setMediaItems(items, 0, position)
        player.prepare()
    }

    /** Nouvelle source du suivant préchargé. */
    fun replaceQueued(entry: DeckEntry) {
        val index = player.currentMediaItemIndex + 1
        if (index < player.mediaItemCount) player.replaceMediaItem(index, entry.mediaItem())
    }

    /** Rien ne joue plus ici : la platine se vide (le lecteur reste, prêt à resservir). */
    fun clear() {
        player.stop()
        player.clearMediaItems()
        fadeGain = 1f
        everReady = false
        lastEntry = null
    }

    fun release() {
        player.removeListener(this)
        player.release()
    }

    override fun onPlaybackStateChanged(playbackState: Int) {
        if (playbackState == Player.STATE_READY) everReady = true
        listener.onDeckChanged(this)
        if (playbackState == Player.STATE_ENDED) listener.onDeckEnded(this)
    }

    override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) = listener.onDeckChanged(this)

    override fun onIsPlayingChanged(isPlaying: Boolean) = listener.onDeckChanged(this)

    override fun onPositionDiscontinuity(oldPosition: Player.PositionInfo, newPosition: Player.PositionInfo, reason: Int) =
        listener.onDeckChanged(this)

    override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
        val previous = lastEntry
        lastEntry = mediaItem?.entry
        listener.onDeckTransition(this, previous, reason)
    }

    override fun onPlayerError(error: PlaybackException) = listener.onDeckError(this, error)
}
