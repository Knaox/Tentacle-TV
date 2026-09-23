package com.tentacletv.exoplayer

import android.util.Log
import android.view.View
import androidx.media3.common.C
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.VideoSize
import androidx.media3.common.text.CueGroup
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.HttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import com.facebook.react.bridge.Arguments

private const val TAG = "ExoPlayerView"

private fun stateStr(s: Int) = when (s) {
    Player.STATE_IDLE -> "IDLE"; Player.STATE_BUFFERING -> "BUFFERING"
    Player.STATE_READY -> "READY"; Player.STATE_ENDED -> "ENDED"
    else -> "UNKNOWN($s)"
}

/**
 * Ce qu'ExoPlayer raconte, traduit en évènements JS. La machine d'état reste
 * à la vue : le listener ne connaît le lecteur que par `playerProvider`, et ne
 * lui rend que ce qu'elle doit savoir (`onEnded` → anti-veille).
 */
@UnstableApi
class ExoPlaybackListener(
    private val emitter: ExoEventEmitter,
    private val playerProvider: () -> ExoPlayer?,
    private val onEnded: () -> Unit,
) : Player.Listener {

    /** Un seul `load` par source : remis à faux par la vue à chaque (re)chargement. */
    @Volatile var loadEmitted = false
    /** Après `loadSubtitle()` : activer le texte et forcer la VTT side-loadée au prochain onTracksChanged. */
    @Volatile var pendingSubtitleEnable = false
    /** Les pistes du flux courant, adressables par `setAudioTrack` / `setSubtitleTrack`. */
    @Volatile var trackList: List<TrackInfo> = emptyList()
        private set

    override fun onPlaybackStateChanged(playbackState: Int) {
        Log.w(TAG, ">>> playbackState=${stateStr(playbackState)}")
        val exo = playerProvider() ?: return
        when (playbackState) {
            Player.STATE_READY -> if (!loadEmitted) {
                loadEmitted = true
                emitter.emit("load", Arguments.createMap().apply {
                    putDouble("duration", exo.duration.toDouble() / 1000.0)
                })
            }
            Player.STATE_ENDED -> {
                onEnded()
                emitter.emit("end", Arguments.createMap())
            }
        }
    }

    override fun onPlayerError(error: PlaybackException) {
        Log.e(TAG, ">>> onPlayerError: ${error.errorCodeName}", error)
        // Code HTTP (401/403 = token direct-streaming mort, 404…) enfoui
        // dans la chaîne des causes — remonté en clair (` http=NNN`) pour
        // que le JS relance la lecture avec un token frais.
        var httpCode = 0
        var cause: Throwable? = error.cause
        while (cause != null && httpCode == 0) {
            if (cause is HttpDataSource.InvalidResponseCodeException) httpCode = cause.responseCode
            cause = cause.cause
        }
        emitter.emit("error", Arguments.createMap().apply {
            putString("error", buildString {
                append(error.errorCodeName)
                if (httpCode > 0) append(" http=").append(httpCode)
                append(": ").append(error.message)
            })
        })
    }

    override fun onTracksChanged(tracks: Tracks) {
        Log.w(TAG, ">>> onTracksChanged groups=${tracks.groups.size}")
        val (list, arr) = buildTrackList(tracks)
        trackList = list
        emitter.emit("tracks", Arguments.createMap().apply { putArray("tracks", arr) })
        // Après loadSubtitle() : activer le texte + forcer la VTT side-loadée.
        if (pendingSubtitleEnable) {
            pendingSubtitleEnable = false
            val exo = playerProvider() ?: return
            val builder = exo.trackSelectionParameters.buildUpon()
                .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
            // Le DERNIER groupe texte (= la VTT ajoutée via SubtitleConfiguration).
            for (group in tracks.groups.reversed()) {
                if (group.type == C.TRACK_TYPE_TEXT) {
                    builder.setOverrideForType(TrackSelectionOverride(group.mediaTrackGroup, 0))
                    Log.w(TAG, ">>> pendingSubtitle: selected VTT track (last text group)")
                    break
                }
            }
            exo.trackSelectionParameters = builder.build()
        }
    }

    override fun onVideoSizeChanged(videoSize: VideoSize) {
        emitter.emit("videoSize", Arguments.createMap().apply {
            putInt("videoWidth", videoSize.width)
            putInt("videoHeight", videoSize.height)
            putDouble("pixelRatio", videoSize.pixelWidthHeightRatio.toDouble())
        })
    }

    // Les cues de sous-titres vers React Native, rendues au-dessus de l'overlay.
    override fun onCues(cueGroup: CueGroup) {
        val lines = cueGroup.cues.mapNotNull { it.text?.toString() }
        val text = lines.joinToString("\n")
        Log.w(TAG, ">>> onCues count=${cueGroup.cues.size} text='${text.take(100)}'")
        emitter.emit("subtitles", Arguments.createMap().apply { putString("text", text) })
    }
}

/**
 * Sondeur à 250 ms : la progression (au rythme `progressInterval`) et les cues
 * courantes — `onCues()` ne se déclenche pas toujours dans le nouveau pipeline
 * de Media3 1.8, le sondage est la ceinture.
 */
@UnstableApi
class ExoProgressPoller(
    private val view: View,
    private val playerProvider: () -> ExoPlayer?,
    private val emitter: ExoEventEmitter,
    private val intervalMs: () -> Long,
) : Runnable {
    private var lastProgressEmit = 0L
    /** Dernier texte émis ; remis à vide par la vue à un rechargement de sous-titre. */
    @Volatile var lastSubtitleText = ""
    @Volatile private var stopped = false

    override fun run() {
        if (stopped) return
        val p = playerProvider() ?: return
        val now = System.currentTimeMillis()
        if (now - lastProgressEmit >= intervalMs()) {
            lastProgressEmit = now
            emitter.emit("progress", Arguments.createMap().apply {
                putDouble("currentTime", p.currentPosition.toDouble() / 1000.0)
                putDouble("bufferedTime", p.bufferedPosition.toDouble() / 1000.0)
            })
        }
        try {
            val cues = p.currentCues
            val text = cues.cues.mapNotNull { it.text?.toString() }.joinToString("\n")
            if (text != lastSubtitleText) {
                lastSubtitleText = text
                Log.w(TAG, ">>> subtitle poll: '${text.take(80)}'")
                emitter.emit("subtitles", Arguments.createMap().apply { putString("text", text) })
            }
        } catch (_: Exception) {}
        view.postDelayed(this, 250)
    }

    fun start() {
        stopped = false
        view.removeCallbacks(this)
        view.post(this)
    }

    fun stop() {
        stopped = true
        view.removeCallbacks(this)
    }
}
