package expo.modules.octaveaudio

import android.net.Uri
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.util.UnstableApi
import java.util.concurrent.atomic.AtomicLong
import kotlin.math.log10
import kotlin.math.min
import kotlin.math.pow

/**
 * Un titre posé sur une platine : ce que le JS en a dit (titre, source) et le
 * `MediaItem` qui le joue. L'entrée voyage DANS le `MediaItem` (son `tag`) :
 * la platine sait toujours quel titre elle joue, même après un enchaînement.
 * La source peut changer (`audio_swap_source`) : on refait alors un `MediaItem`.
 */
internal class DeckEntry(val track: BridgeTrack, var source: BridgeSource) {
    val trackKey: String get() = track.trackKey

    /** La durée annoncée par la bibliothèque, faute de celle du décodeur. */
    fun knownDurationMs(): Long? = track.durationMs ?: source.durationMs

    fun gain(mode: String): Float = ReplayGainMath.linear(source.replayGain, mode)

    @OptIn(UnstableApi::class)
    fun mediaItem(): MediaItem {
        val meta = track.meta
        val metadata = MediaMetadata.Builder()
            .setTitle(meta?.title)
            .setArtist(meta?.artist)
            .setAlbumTitle(meta?.album)
            .setArtworkUri(meta?.artworkUrl?.let(Uri::parse))
            .setDurationMs(knownDurationMs())
            .setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC)
            .setIsPlayable(true)
            .setIsBrowsable(false)
            .build()
        return MediaItem.Builder()
            // Un identifiant NEUF par `MediaItem` : le même titre peut se suivre lui-même (répétition).
            .setMediaId("octave-${SEQUENCE.incrementAndGet()}")
            .setUri(source.url)
            .setMediaMetadata(metadata)
            .setTag(this)
            .build()
    }

    private companion object {
        val SEQUENCE = AtomicLong()
    }
}

/** L'entrée que porte un `MediaItem` posé par ce moteur (`null` pour tout autre). */
internal val MediaItem.entry: DeckEntry? get() = localConfiguration?.tag as? DeckEntry

/**
 * ReplayGain : le gain LINÉAIRE d'une source pour un mode, comme le bureau
 * (`apps/desktop-electron/src/main/audio/replayGain.ts`) : `off` → 1 ; `track` →
 * gain du titre (sinon de l'album) ; `album` / `auto` → gain d'album s'il existe,
 * sinon du titre. Borné à [−30, +12] dB, et rabattu par la crête : jamais
 * d'écrêtage (crête × gain ≤ 1).
 *
 * ⚠️ ExoPlayer borne son volume à 1 : un gain POSITIF ne remonte pas le son au-delà
 * du volume réglé (il est appliqué, puis plafonné). Les gains négatifs — le cas
 * courant des masters modernes — passent en entier.
 */
internal object ReplayGainMath {
    private const val MIN_GAIN_DB = -30.0
    private const val MAX_GAIN_DB = 12.0

    fun linear(rg: BridgeReplayGain?, mode: String): Float {
        if (rg == null || mode == "off") return 1f
        val album = mode == "album" || mode == "auto"
        val gainDb = (if (album) rg.albumGainDb ?: rg.trackGainDb else rg.trackGainDb ?: rg.albumGainDb) ?: return 1f
        val peak = if (album) rg.albumPeak ?: rg.trackPeak else rg.trackPeak ?: rg.albumPeak
        var db = gainDb
        if (peak != null && peak > 0) db = min(db, -20 * log10(peak))
        db = db.coerceIn(MIN_GAIN_DB, MAX_GAIN_DB)
        return 10.0.pow(db / 20).toFloat()
    }
}
