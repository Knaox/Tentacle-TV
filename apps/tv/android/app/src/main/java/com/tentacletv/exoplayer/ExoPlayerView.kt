package com.tentacletv.exoplayer

import android.graphics.Color
import android.graphics.Typeface
import android.util.Log
import android.view.View
import android.widget.FrameLayout
import androidx.media3.common.C
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.text.TextRenderer
import androidx.media3.ui.CaptionStyleCompat
import androidx.media3.ui.PlayerView
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.uimanager.ThemedReactContext

@UnstableApi
class ExoPlayerView(
    private val reactContext: ThemedReactContext,
) : FrameLayout(reactContext) {

    companion object {
        private const val TAG = "ExoPlayerView"
    }

    // PlayerView handles SurfaceView + SubtitleView internally (VoidTV pattern)
    private val playerView: PlayerView

    private var player: ExoPlayer? = null
    private var destroyed = false
    private var currentUrl: String? = null
    private var lastLoadedUrl: String? = null
    private var pendingPaused: Boolean? = null
    var progressInterval = 1000L
    var audioPassthrough = true

    // Évènements, listener et sondeur — hors de la vue (ExoEvents.kt,
    // ExoPlaybackListener.kt) ; la vue ne garde que la machine d'état.
    private val emitter = ExoEventEmitter(reactContext) { id }
    private val listener = ExoPlaybackListener(emitter, { player }) { keepScreenOn = false }
    private val poller = ExoProgressPoller(this, { player }, emitter) { progressInterval }

    // Pistes texte side-loadées (VTT Jellyfin) fournies par la prop `textTracks`.
    // Chargées dans le MediaItem au prepare initial → rendu natif par le
    // subtitleView, switch via setSubtitleTrack SANS re-prepare.
    private var pendingTextTracks: List<TextTrackConfig> = emptyList()

    init {
        Log.w(TAG, ">>> CONSTRUCTOR viewId=$id")

        playerView = PlayerView(reactContext).apply {
            useController = false // We use our own React Native overlay
            subtitleView?.apply {
                setApplyEmbeddedStyles(true)
                setApplyEmbeddedFontSizes(true)
                setStyle(CaptionStyleCompat(
                    Color.WHITE,
                    Color.TRANSPARENT,
                    Color.TRANSPARENT,
                    CaptionStyleCompat.EDGE_TYPE_DROP_SHADOW,
                    Color.BLACK,
                    Typeface.SANS_SERIF,
                ))
                setFractionalTextSize(0.0533f)
                visibility = View.VISIBLE
            }
        }
        addView(playerView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    }

    // PlayerView handles surface lifecycle internally — init player on first attach
    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        if (!destroyed && player == null) {
            initPlayer()
            currentUrl?.let { loadFile(it) }
            pendingPaused?.let { setPaused(it) }
        }
    }

    // --- ExoPlayer init ---

    private fun initPlayer() {
        if (player != null) return
        Log.w(TAG, ">>> initPlayer START")

        val preferredMimeTypes = ExoPlayerFactory.preferredAudioMimeTypes(reactContext, audioPassthrough)
        player = ExoPlayer.Builder(reactContext)
            .setRenderersFactory(ExoPlayerFactory.createRenderersFactory(reactContext, audioPassthrough))
            .setMediaSourceFactory(ExoPlayerFactory.createMediaSourceFactory(reactContext))
            .setTrackSelector(ExoPlayerFactory.createTrackSelector(reactContext, preferredMimeTypes, tunneling = false))
            .setLoadControl(ExoPlayerFactory.createLoadControl())
            .build()
            .also { exo ->
                exo.setAudioAttributes(ExoPlayerFactory.mediaAudioAttributes, false)
                exo.addListener(listener)

                // Attach player to PlayerView — handles video surface + subtitle rendering
                playerView.player = exo

                // Force legacy subtitle decoding DIRECTLY on the TextRenderer instances
                // (buildTextRenderers override may not fire — this is guaranteed to work)
                for (i in 0 until exo.rendererCount) {
                    val renderer = exo.getRenderer(i)
                    if (renderer is TextRenderer) {
                        renderer.experimentalSetLegacyDecodingEnabled(true)
                        Log.w(TAG, ">>> TextRenderer[$i] legacy decoding ENABLED")
                    }
                }
            }

        poller.start()
        Log.w(TAG, ">>> initPlayer DONE")
    }

    // --- Public API ---

    private var currentSubtitleUrl: String? = null

    fun loadFile(url: String) {
        Log.w(TAG, ">>> loadFile url=${url.take(120)}...")
        currentUrl = url
        val p = player ?: run { Log.w(TAG, ">>> loadFile DEFERRED"); return }
        // La clé d'idempotence inclut les pistes texte : un changement de
        // `textTracks` à URL identique doit re-charger (sinon SKIP → pas de subs).
        val tracksKey = pendingTextTracks.joinToString("|") { it.uri }
        val loadKey = "$url##$tracksKey"
        if (loadKey == lastLoadedUrl && currentSubtitleUrl == null) {
            Log.w(TAG, ">>> loadFile SKIP (same URL+tracks)")
            return
        }
        lastLoadedUrl = loadKey
        listener.loadEmitted = false
        currentSubtitleUrl = null
        // Start playback AT the requested position (resume / track-change
        // reload) — no frame from 0:00 is ever decoded, unlike a post-prepare
        // seek which briefly shows the beginning of the media.
        val (item, startMs) = ExoMediaSource.buildMediaItem(url, pendingTextTracks)
        if (pendingTextTracks.isNotEmpty()) Log.w(TAG, ">>> loadFile with ${pendingTextTracks.size} text track(s)")
        if (startMs > 0) p.setMediaItem(item, startMs) else p.setMediaItem(item)
        p.prepare()
        p.playWhenReady = pendingPaused != true
        // Anti-veille : l'écran reste éveillé tant que la LECTURE est active
        // (keepScreenOn, aucune permission requise). La pause rend la main à la
        // veille système — protection des dalles OLED, arbitrage produit.
        keepScreenOn = p.playWhenReady
    }

    /** Pistes texte VTT (prop `textTracks`) — mémorisées puis appliquées au
     *  prochain loadFile. Si la source est déjà chargée, re-applique. */
    fun setTextTracks(tracks: ReadableArray?) {
        val list = ExoMediaSource.parseTextTracks(tracks)
        if (list.map { it.uri } == pendingTextTracks.map { it.uri }) return
        pendingTextTracks = list
        currentUrl?.let { loadFile(it) }
    }

    /** Load a subtitle track from Jellyfin VTT URL. Rebuilds MediaItem, seeks back. */
    fun loadSubtitle(subtitleUrl: String?) {
        val p = player ?: return
        val videoUrl = currentUrl ?: return
        val posMs = p.currentPosition
        val wasPlaying = p.playWhenReady
        currentSubtitleUrl = subtitleUrl
        lastLoadedUrl = null // Force reload
        listener.loadEmitted = false
        poller.lastSubtitleText = ""

        if (subtitleUrl != null && subtitleUrl.isNotEmpty()) Log.w(TAG, ">>> loadSubtitle url=${subtitleUrl.take(120)}")
        else Log.w(TAG, ">>> loadSubtitle DISABLED")
        val item = ExoMediaSource.buildSubtitleItem(videoUrl, subtitleUrl)

        // Flag to enable text tracks AFTER prepare completes (onTracksChanged)
        listener.pendingSubtitleEnable = subtitleUrl != null && subtitleUrl.isNotEmpty()

        // Re-prepare AT the current position (Media3 requires a new MediaItem
        // for side-loaded subtitles) — a post-prepare seekTo briefly showed
        // frames from 0:00.
        p.setMediaItem(item, posMs)
        p.prepare()
        p.playWhenReady = wasPlaying
        keepScreenOn = wasPlaying // anti-veille : reprend l'état d'avant le re-prepare
    }

    fun seekTo(seconds: Double) {
        player?.seekTo((seconds * 1000).toLong())
    }

    fun setPaused(paused: Boolean) {
        keepScreenOn = !paused // anti-veille : suit l'intention de lecture
        val p = player
        if (p == null) { pendingPaused = paused; return }
        pendingPaused = null
        p.playWhenReady = !paused
    }

    fun setAudioTrack(id: Int) {
        val p = player ?: return
        val track = listener.trackList.find { it.id == id && it.type == "audio" } ?: return
        val groups = p.currentTracks.groups
        if (track.groupIndex < groups.size) {
            val group = groups[track.groupIndex]
            p.trackSelectionParameters = p.trackSelectionParameters.buildUpon()
                .setOverrideForType(TrackSelectionOverride(group.mediaTrackGroup, track.trackIndex))
                .build()
        }
    }

    fun setSubtitleTrack(id: Int) {
        Log.w(TAG, ">>> setSubtitleTrack id=$id")
        val p = player ?: return
        if (id <= 0) {
            p.trackSelectionParameters = p.trackSelectionParameters.buildUpon()
                .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
                .build()
            return
        }
        val track = listener.trackList.find { it.id == id && it.type == "sub" } ?: run {
            Log.w(TAG, ">>> setSubtitleTrack FAILED — track id=$id not found in trackList")
            return
        }
        val groups = p.currentTracks.groups
        if (track.groupIndex < groups.size) {
            val group = groups[track.groupIndex]
            // Single atomic update: enable text + select track (avoids race condition)
            p.trackSelectionParameters = p.trackSelectionParameters.buildUpon()
                .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
                .setOverrideForType(TrackSelectionOverride(group.mediaTrackGroup, track.trackIndex))
                .build()
            Log.w(TAG, ">>> setSubtitleTrack OK group=${track.groupIndex} trackIndex=${track.trackIndex}")
        } else {
            Log.w(TAG, ">>> setSubtitleTrack FAILED — groupIndex=${track.groupIndex} >= groups.size=${groups.size}")
        }
    }

    fun destroy() {
        Log.w(TAG, ">>> destroy START viewId=$id")
        if (destroyed) return
        destroyed = true
        keepScreenOn = false // anti-veille : la vue meurt, la veille reprend ses droits
        emitter.enabled = false
        poller.stop()
        playerView.player = null
        player?.release()
        player = null
    }
}
