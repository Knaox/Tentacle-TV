package com.tentacletv.exoplayer

import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.util.Log
import android.view.View
import android.widget.FrameLayout
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.text.CueGroup
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.Renderer
import androidx.media3.exoplayer.audio.AudioCapabilities
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.audio.DefaultAudioSink
import androidx.media3.exoplayer.mediacodec.MediaCodecSelector
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.text.TextOutput
import androidx.media3.exoplayer.text.TextRenderer
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import androidx.media3.ui.CaptionStyleCompat
import androidx.media3.ui.PlayerView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter

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
    private var pendingSubtitleEnable = false
    private var pendingPaused: Boolean? = null
    private var lastProgressEmit = 0L
    private var loadEmitted = false
    var progressInterval = 1000L
    var audioPassthrough = true

    private data class TrackInfo(
        val id: Int, val type: String, val lang: String, val title: String,
        val codec: String, val isDefault: Boolean, val isSelected: Boolean,
        val groupIndex: Int, val trackIndex: Int,
    )

    private var trackList = mutableListOf<TrackInfo>()

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

        val audioCapabilities = if (audioPassthrough) {
            AudioCapabilities.getCapabilities(reactContext)
        } else {
            AudioCapabilities.DEFAULT_AUDIO_CAPABILITIES
        }

        val renderersFactory = object : DefaultRenderersFactory(reactContext) {
            init {
                setExtensionRendererMode(EXTENSION_RENDERER_MODE_ON)
                setEnableDecoderFallback(true)
            }

            override fun buildAudioSink(
                context: android.content.Context,
                enableFloatOutput: Boolean,
                enableAudioTrackPlaybackParams: Boolean,
            ): AudioSink {
                return DefaultAudioSink.Builder(context)
                    .setAudioCapabilities(audioCapabilities)
                    .setEnableFloatOutput(enableFloatOutput)
                    .setEnableAudioTrackPlaybackParams(enableAudioTrackPlaybackParams)
                    .build()
            }

            override fun buildVideoRenderers(
                context: android.content.Context,
                extensionRendererMode: Int,
                mediaCodecSelector: MediaCodecSelector,
                enableDecoderFallback: Boolean,
                eventHandler: android.os.Handler,
                eventListener: androidx.media3.exoplayer.video.VideoRendererEventListener,
                allowedVideoJoiningTimeMs: Long,
                out: java.util.ArrayList<androidx.media3.exoplayer.Renderer>,
            ) {
                out.add(DvCompatRenderer(
                    context, mediaCodecSelector, enableDecoderFallback,
                    eventHandler, eventListener, allowedVideoJoiningTimeMs,
                ))
                super.buildVideoRenderers(
                    context, extensionRendererMode, mediaCodecSelector,
                    enableDecoderFallback, eventHandler, eventListener,
                    allowedVideoJoiningTimeMs, out,
                )
            }

            // Force legacy subtitle decoding — TextRenderer actively decodes SSA/ASS
            // instead of relying on extraction-time parsing (broken for onCues in 1.8)
            override fun buildTextRenderers(
                context: android.content.Context,
                output: TextOutput,
                outputLooper: android.os.Looper,
                extensionRendererMode: Int,
                out: java.util.ArrayList<Renderer>,
            ) {
                super.buildTextRenderers(context, output, outputLooper, extensionRendererMode, out)
                for (renderer in out) {
                    if (renderer is TextRenderer) {
                        renderer.experimentalSetLegacyDecodingEnabled(true)
                        Log.w(TAG, ">>> TextRenderer legacy decoding ENABLED")
                    }
                }
            }
        }

        // Disable extraction-time subtitle parsing (pair with TextRenderer legacy mode)
        val mediaSourceFactory = DefaultMediaSourceFactory(reactContext)
            .experimentalParseSubtitlesDuringExtraction(false)

        val preferredMimeTypes = mutableListOf<String>()
        if (audioPassthrough) {
            val caps = AudioCapabilities.getCapabilities(reactContext)
            val candidates = mapOf(
                MimeTypes.AUDIO_TRUEHD to android.media.AudioFormat.ENCODING_DOLBY_TRUEHD,
                MimeTypes.AUDIO_DTS_HD to android.media.AudioFormat.ENCODING_DTS_HD,
                MimeTypes.AUDIO_E_AC3 to android.media.AudioFormat.ENCODING_E_AC3,
                MimeTypes.AUDIO_AC3 to android.media.AudioFormat.ENCODING_AC3,
                MimeTypes.AUDIO_DTS to android.media.AudioFormat.ENCODING_DTS,
            )
            for ((mime, encoding) in candidates) {
                if (caps.supportsEncoding(encoding)) preferredMimeTypes.add(mime)
            }
            Log.w(TAG, ">>> Audio passthrough: $preferredMimeTypes")
        }

        val trackSelector = DefaultTrackSelector(reactContext).apply {
            parameters = buildUponParameters()
                .setPreferredAudioLanguage("und")
                .setPreferredAudioMimeTypes(*preferredMimeTypes.toTypedArray())
                .build()
        }

        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(50_000, 300_000, 2_500, 5_000)
            .build()

        player = ExoPlayer.Builder(reactContext)
            .setRenderersFactory(renderersFactory)
            .setMediaSourceFactory(mediaSourceFactory)
            .setTrackSelector(trackSelector)
            .setLoadControl(loadControl)
            .build()
            .also { exo ->
                exo.setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(C.USAGE_MEDIA)
                        .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
                        .build(),
                    false,
                )

                exo.addListener(object : Player.Listener {
                    override fun onPlaybackStateChanged(playbackState: Int) {
                        Log.w(TAG, ">>> playbackState=${stateStr(playbackState)}")
                        when (playbackState) {
                            Player.STATE_READY -> if (!loadEmitted) {
                                loadEmitted = true
                                emitEvent("load", Arguments.createMap().apply {
                                    putDouble("duration", exo.duration.toDouble() / 1000.0)
                                })
                            }
                            Player.STATE_ENDED -> emitEvent("end", Arguments.createMap())
                        }
                    }

                    override fun onPlayerError(error: PlaybackException) {
                        Log.e(TAG, ">>> onPlayerError: ${error.errorCodeName}", error)
                        emitEvent("error", Arguments.createMap().apply {
                            putString("error", "${error.errorCodeName}: ${error.message}")
                        })
                    }

                    override fun onTracksChanged(tracks: Tracks) {
                        Log.w(TAG, ">>> onTracksChanged groups=${tracks.groups.size}")
                        sendTrackList(tracks)
                        // After loadSubtitle(): enable text + force-select the sideloaded VTT track
                        if (pendingSubtitleEnable) {
                            pendingSubtitleEnable = false
                            val builder = exo.trackSelectionParameters.buildUpon()
                                .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
                            // Select the LAST text group (= the VTT we added via SubtitleConfiguration)
                            for (group in tracks.groups.reversed()) {
                                if (group.type == C.TRACK_TYPE_TEXT) {
                                    builder.setOverrideForType(
                                        TrackSelectionOverride(group.mediaTrackGroup, 0)
                                    )
                                    Log.w(TAG, ">>> pendingSubtitle: selected VTT track (last text group)")
                                    break
                                }
                            }
                            exo.trackSelectionParameters = builder.build()
                        }
                    }

                    override fun onVideoSizeChanged(videoSize: androidx.media3.common.VideoSize) {
                        emitEvent("videoSize", Arguments.createMap().apply {
                            putInt("videoWidth", videoSize.width)
                            putInt("videoHeight", videoSize.height)
                            putDouble("pixelRatio", videoSize.pixelWidthHeightRatio.toDouble())
                        })
                    }

                    // Emit subtitle cues to React Native for rendering above the overlay
                    override fun onCues(cueGroup: CueGroup) {
                        val lines = cueGroup.cues.mapNotNull { it.text?.toString() }
                        val text = lines.joinToString("\n")
                        Log.w(TAG, ">>> onCues count=${cueGroup.cues.size} text='${text.take(100)}'")
                        emitEvent("subtitles", Arguments.createMap().apply {
                            putString("text", text)
                        })
                    }
                })

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

        startProgressPoller()
        Log.w(TAG, ">>> initPlayer DONE")
    }

    private fun stateStr(s: Int) = when (s) {
        Player.STATE_IDLE -> "IDLE"; Player.STATE_BUFFERING -> "BUFFERING"
        Player.STATE_READY -> "READY"; Player.STATE_ENDED -> "ENDED"
        else -> "UNKNOWN($s)"
    }

    // --- Progress + subtitle polling ---

    private var lastSubtitleText = ""

    private val progressRunnable = object : Runnable {
        override fun run() {
            if (destroyed) return
            val p = player ?: return
            val now = System.currentTimeMillis()
            if (now - lastProgressEmit >= progressInterval) {
                lastProgressEmit = now
                emitEvent("progress", Arguments.createMap().apply {
                    putDouble("currentTime", p.currentPosition.toDouble() / 1000.0)
                    putDouble("bufferedTime", p.bufferedPosition.toDouble() / 1000.0)
                })
            }
            // Poll subtitle cues directly — onCues() may not fire in Media3 1.8 new pipeline
            try {
                val cues = p.currentCues
                val lines = cues.cues.mapNotNull { it.text?.toString() }
                val text = lines.joinToString("\n")
                if (text != lastSubtitleText) {
                    lastSubtitleText = text
                    Log.w(TAG, ">>> subtitle poll: '${text.take(80)}'")
                    emitEvent("subtitles", Arguments.createMap().apply {
                        putString("text", text)
                    })
                }
            } catch (_: Exception) {}
            postDelayed(this, 250)
        }
    }

    private fun startProgressPoller() {
        removeCallbacks(progressRunnable)
        post(progressRunnable)
    }

    // --- Public API ---

    private var currentSubtitleUrl: String? = null

    fun loadFile(url: String) {
        Log.w(TAG, ">>> loadFile url=${url.take(120)}...")
        currentUrl = url
        val p = player ?: run { Log.w(TAG, ">>> loadFile DEFERRED"); return }
        if (url == lastLoadedUrl && currentSubtitleUrl == null) {
            Log.w(TAG, ">>> loadFile SKIP (same URL)")
            return
        }
        lastLoadedUrl = url
        loadEmitted = false
        currentSubtitleUrl = null
        p.setMediaItem(MediaItem.fromUri(Uri.parse(url)))
        p.prepare()
        p.playWhenReady = pendingPaused != true
    }

    /** Load a subtitle track from Jellyfin VTT URL. Rebuilds MediaItem, seeks back. */
    fun loadSubtitle(subtitleUrl: String?) {
        val p = player ?: return
        val videoUrl = currentUrl ?: return
        val posMs = p.currentPosition
        val wasPlaying = p.playWhenReady
        currentSubtitleUrl = subtitleUrl
        lastLoadedUrl = null // Force reload
        loadEmitted = false
        lastSubtitleText = ""

        val builder = MediaItem.Builder().setUri(Uri.parse(videoUrl))
        if (subtitleUrl != null && subtitleUrl.isNotEmpty()) {
            Log.w(TAG, ">>> loadSubtitle url=${subtitleUrl.take(120)}")
            builder.setSubtitleConfigurations(listOf(
                MediaItem.SubtitleConfiguration.Builder(Uri.parse(subtitleUrl))
                    .setMimeType(MimeTypes.TEXT_VTT)
                    .setSelectionFlags(C.SELECTION_FLAG_DEFAULT)
                    .build()
            ))
        } else {
            Log.w(TAG, ">>> loadSubtitle DISABLED")
            builder.setSubtitleConfigurations(emptyList())
        }

        // Flag to enable text tracks AFTER prepare completes (onTracksChanged)
        pendingSubtitleEnable = subtitleUrl != null && subtitleUrl.isNotEmpty()

        p.setMediaItem(builder.build())
        p.prepare()
        p.seekTo(posMs)
        p.playWhenReady = wasPlaying
    }

    fun seekTo(seconds: Double) {
        player?.seekTo((seconds * 1000).toLong())
    }

    fun setPaused(paused: Boolean) {
        val p = player
        if (p == null) { pendingPaused = paused; return }
        pendingPaused = null
        p.playWhenReady = !paused
    }

    fun setAudioTrack(id: Int) {
        val p = player ?: return
        val track = trackList.find { it.id == id && it.type == "audio" } ?: return
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
        val track = trackList.find { it.id == id && it.type == "sub" } ?: run {
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
        removeCallbacks(progressRunnable)
        playerView.player = null
        player?.release()
        player = null
    }

    // --- Track list ---

    private fun sendTrackList(tracks: Tracks) {
        trackList.clear()
        val arr = Arguments.createArray()
        var audioId = 1; var subId = 1

        for ((gi, group) in tracks.groups.withIndex()) {
            val tg = group.mediaTrackGroup
            for (ti in 0 until tg.length) {
                val fmt = tg.getFormat(ti)
                val sel = group.isTrackSelected(ti)
                val type = when (tg.type) {
                    C.TRACK_TYPE_AUDIO -> "audio"
                    C.TRACK_TYPE_TEXT -> "sub"
                    C.TRACK_TYPE_VIDEO -> "video"
                    else -> continue
                }
                val id = when (type) { "audio" -> audioId++; "sub" -> subId++; else -> 0 }
                val info = TrackInfo(id, type, fmt.language ?: "", fmt.label ?: "",
                    fmt.codecs ?: fmt.sampleMimeType ?: "", sel, sel, gi, ti)
                trackList.add(info)
                arr.pushMap(Arguments.createMap().apply {
                    putInt("id", info.id); putString("type", info.type)
                    putString("lang", info.lang); putString("title", info.title)
                    putString("codec", info.codec)
                    putBoolean("default", info.isDefault); putBoolean("selected", info.isSelected)
                })
                Log.w(TAG, ">>> track[$gi/$ti] type=$type lang=${info.lang} codec=${info.codec} sel=$sel")
            }
        }
        emitEvent("tracks", Arguments.createMap().apply { putArray("tracks", arr) })
    }

    // --- Event emission ---

    private fun emitEvent(type: String, data: WritableMap) {
        data.putString("type", type)
        UiThreadUtil.runOnUiThread {
            if (destroyed) return@runOnUiThread
            try {
                reactContext.getJSModule(RCTEventEmitter::class.java)
                    .receiveEvent(id, "onExoEvent", data)
            } catch (e: Exception) {
                Log.e(TAG, ">>> emitEvent FAILED for $type", e)
            }
        }
    }
}
