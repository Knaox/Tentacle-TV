package com.tentacletv.exoplayer

import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View.MeasureSpec
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.facebook.react.bridge.Arguments
import com.facebook.react.uimanager.ThemedReactContext
import com.tentacletv.R

/**
 * Le lecteur de l'APERÇU au focus d'une carte (Android TV) — à la place de
 * react-native-video, dont la vue gonflait à chaque aperçu une `PlayerView`
 * AVEC son contrôleur (une trentaine de vues) : un blocage du fil UI mesuré
 * à ~+540 ms de chaque pas qui démarre un aperçu (lot ba1016, 16/10), et un
 * bouton Lecture qui volait le focus de la carte.
 *
 * Ici : la `PlayerView` sans contrôleur du lecteur principal
 * (`tentacle_exo_player_frame`), une `TextureView` qui suit l'opacité et
 * l'arrondi de la grande carte, l'image qui remplit le cadre, aucun focus
 * possible (`FOCUS_BLOCK_DESCENDANTS`), le focus audio laissé au système.
 * Le lecteur ne naît qu'au premier chargement, après la vue.
 *
 * Elle ne décide de rien : elle charge la source (une fois toutes les props
 * posées, `commit`), joue ou se met en pause, et dit au JS (`onExoEvent`,
 * comme le lecteur principal) sa première image, sa durée, où elle en est, sa
 * fin et son échec.
 */
@UnstableApi
class PreviewVideoView(private val reactContext: ThemedReactContext) : FrameLayout(reactContext) {
    private val playerView: PlayerView =
        LayoutInflater.from(reactContext).inflate(R.layout.tentacle_preview_player, this, false) as PlayerView
    private val emitter = ExoEventEmitter(reactContext) { id }
    private val handler = Handler(Looper.getMainLooper())
    private var player: ExoPlayer? = null
    private var released = false

    private var uri: String? = null
    private var hls = false
    private var startMs = 0L
    private var loadedKey: String? = null
    private var paused = true
    private var muted = false
    private var volume = 1f
    private var loadSent = false
    var progressIntervalMs = 1_000L

    /** React Native ne remet pas en page ce que la vue change d'elle-même (le cadre qui suit le format). */
    private var relayoutPending = false

    private val progressTick = object : Runnable {
        override fun run() {
            val exo = player ?: return
            emitter.emit("progress", Arguments.createMap().apply {
                putDouble("currentTime", exo.currentPosition / 1000.0)
                putDouble("duration", seconds(exo.duration))
            })
            if (exo.isPlaying) handler.postDelayed(this, progressIntervalMs)
        }
    }

    private val listener = object : Player.Listener {
        override fun onRenderedFirstFrame() {
            emitter.emit("firstFrame", Arguments.createMap())
        }

        override fun onPlaybackStateChanged(playbackState: Int) {
            val exo = player ?: return
            if (playbackState == Player.STATE_READY && !loadSent) {
                loadSent = true
                emitter.emit("load", Arguments.createMap().apply { putDouble("duration", seconds(exo.duration)) })
            }
            if (playbackState == Player.STATE_ENDED) emitter.emit("end", Arguments.createMap())
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) {
            handler.removeCallbacks(progressTick)
            if (isPlaying) handler.postDelayed(progressTick, progressIntervalMs)
        }

        override fun onPlayerError(error: PlaybackException) {
            emitter.emit("error", Arguments.createMap().apply { putString("error", error.errorCodeName) })
        }
    }

    init {
        descendantFocusability = ViewGroup.FOCUS_BLOCK_DESCENDANTS
        isFocusable = false
        addView(playerView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    }

    override fun requestLayout() {
        super.requestLayout()
        if (relayoutPending) return
        relayoutPending = true
        post {
            relayoutPending = false
            measure(MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY))
            layout(left, top, right, bottom)
        }
    }

    fun setSource(uri: String?, hls: Boolean, startMs: Long) {
        this.uri = uri
        this.hls = hls
        this.startMs = startMs
    }

    fun setPaused(value: Boolean) {
        paused = value
        player?.playWhenReady = !value
    }

    fun setMuted(value: Boolean) {
        muted = value
        applyVolume()
    }

    fun setVolume(value: Float) {
        volume = value
        applyVolume()
    }

    /** Toutes les props posées : la source se charge — une fois par source. */
    fun commit() {
        if (released) return
        val target = uri ?: return
        val key = "$target#$hls#$startMs"
        if (key == loadedKey) return
        loadedKey = key
        val exo = player ?: buildPlayer().also { player = it }
        loadSent = false
        val item = MediaItem.Builder().setUri(target).apply { if (hls) setMimeType(MimeTypes.APPLICATION_M3U8) }.build()
        exo.setMediaItem(item, startMs)
        exo.prepare()
        exo.playWhenReady = !paused
        applyVolume()
    }

    fun release() {
        if (released) return
        released = true
        emitter.enabled = false
        handler.removeCallbacks(progressTick)
        playerView.player = null
        player?.release()
        player = null
    }

    private fun buildPlayer(): ExoPlayer =
        ExoPlayer.Builder(reactContext)
            // Un aperçu : démarrer vite (1 s en tampon suffit), sans précharger toute la bande-annonce.
            .setLoadControl(DefaultLoadControl.Builder().setBufferDurationsMs(15_000, 30_000, 1_000, 2_000).build())
            .build()
            .also { exo ->
                exo.setAudioAttributes(ExoPlayerFactory.mediaAudioAttributes, false)
                exo.addListener(listener)
                playerView.player = exo
            }

    private fun applyVolume() {
        player?.volume = if (muted) 0f else volume
    }

    private fun seconds(ms: Long): Double = if (ms == C.TIME_UNSET || ms < 0) 0.0 else ms / 1000.0
}
