package com.tentacletv.exoplayer

import android.net.Uri
import android.util.Log
import android.view.SurfaceHolder
import android.view.SurfaceView
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.util.UnstableApi
import androidx.media3.common.MimeTypes
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.audio.AudioCapabilities
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.audio.DefaultAudioSink
import androidx.media3.exoplayer.mediacodec.MediaCodecSelector
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter

@UnstableApi
class ExoPlayerView(
    private val reactContext: ThemedReactContext,
) : SurfaceView(reactContext), SurfaceHolder.Callback {

    companion object {
        private const val TAG = "ExoPlayerView"
    }

    private var player: ExoPlayer? = null
    private var destroyed = false
    private var currentUrl: String? = null
    private var lastLoadedUrl: String? = null
    private var pendingPaused: Boolean? = null
    private var lastProgressEmit = 0L
    private var loadEmitted = false
    var progressInterval = 1000L
    var audioPassthrough = true

    // Track info for RN — maps group index to track metadata
    private data class TrackInfo(
        val id: Int,
        val type: String,
        val lang: String,
        val title: String,
        val codec: String,
        val isDefault: Boolean,
        val isSelected: Boolean,
        val groupIndex: Int,
        val trackIndex: Int,
    )

    private var trackList = mutableListOf<TrackInfo>()

    init {
        Log.w(TAG, ">>> CONSTRUCTOR viewId=$id")
        holder.addCallback(this)
    }

    // --- Surface lifecycle ---

    override fun surfaceCreated(holder: SurfaceHolder) {
        Log.w(TAG, ">>> surfaceCreated viewId=$id destroyed=$destroyed")
        if (destroyed) return
        initPlayer()
        player?.setVideoSurfaceHolder(holder)
        currentUrl?.let { loadFile(it) }
        pendingPaused?.let { setPaused(it) }
    }

    override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
        Log.w(TAG, ">>> surfaceChanged ${width}x$height")
    }

    override fun surfaceDestroyed(holder: SurfaceHolder) {
        Log.w(TAG, ">>> surfaceDestroyed")
        player?.clearVideoSurfaceHolder(holder)
    }

    // --- ExoPlayer init ---

    private fun initPlayer() {
        if (player != null) return
        Log.w(TAG, ">>> initPlayer START")

        // Detect device audio capabilities for bitstream passthrough (VoidTV pattern)
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

            // Custom AudioSink — passes surround bitstream (AC3/DTS/TrueHD) to receiver
            // instead of decoding to PCM. Required for real passthrough.
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

            // Add DV Profile 7→8.1 compat renderer for Dolby Vision
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
                // DvCompatRenderer first — rewrites P7→P8.1 for device compatibility
                out.add(
                    DvCompatRenderer(
                        context,
                        mediaCodecSelector,
                        enableDecoderFallback,
                        eventHandler,
                        eventListener,
                        allowedVideoJoiningTimeMs,
                    )
                )
                // Default MediaCodecVideoRenderer as fallback
                super.buildVideoRenderers(
                    context, extensionRendererMode, mediaCodecSelector,
                    enableDecoderFallback, eventHandler, eventListener,
                    allowedVideoJoiningTimeMs, out,
                )
            }
        }

        // Detect device audio passthrough capabilities (VoidTV pattern)
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
            .setBufferDurationsMs(
                50_000,     // minBufferMs
                300_000,    // maxBufferMs (300s, matches MPV cache-secs)
                2_500,      // bufferForPlaybackMs
                5_000       // bufferForPlaybackAfterRebufferMs
            )
            .build()

        player = ExoPlayer.Builder(reactContext)
            .setRenderersFactory(renderersFactory)
            .setTrackSelector(trackSelector)
            .setLoadControl(loadControl)
            .build()
            .also { exo ->
                exo.setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(C.USAGE_MEDIA)
                        .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
                        .build(),
                    false, // Don't manage audio focus on TV
                )

                exo.addListener(object : Player.Listener {
                    override fun onPlaybackStateChanged(playbackState: Int) {
                        val stateStr = when (playbackState) {
                            Player.STATE_IDLE -> "IDLE"
                            Player.STATE_BUFFERING -> "BUFFERING"
                            Player.STATE_READY -> "READY"
                            Player.STATE_ENDED -> "ENDED"
                            else -> "UNKNOWN($playbackState)"
                        }
                        Log.w(TAG, ">>> playbackState=$stateStr playWhenReady=${exo.playWhenReady} isPlaying=${exo.isPlaying}")

                        when (playbackState) {
                            Player.STATE_READY -> {
                                if (!loadEmitted) {
                                    loadEmitted = true
                                    val durationSec = exo.duration.toDouble() / 1000.0
                                    Log.w(TAG, ">>> STATE_READY (first) duration=${durationSec}s → emitting load")
                                    emitEvent("load", Arguments.createMap().apply {
                                        putDouble("duration", durationSec)
                                    })
                                }
                            }
                            Player.STATE_ENDED -> {
                                Log.w(TAG, ">>> STATE_ENDED")
                                emitEvent("end", Arguments.createMap())
                            }
                        }
                    }

                    override fun onPlayerError(error: PlaybackException) {
                        Log.e(TAG, ">>> onPlayerError: ${error.errorCodeName} ${error.message}", error)
                        emitEvent("error", Arguments.createMap().apply {
                            putString("error", "${error.errorCodeName}: ${error.message}")
                        })
                    }

                    override fun onTracksChanged(tracks: Tracks) {
                        Log.w(TAG, ">>> onTracksChanged groups=${tracks.groups.size}")
                        sendTrackList(tracks)
                    }

                    override fun onVideoSizeChanged(videoSize: androidx.media3.common.VideoSize) {
                        Log.w(TAG, ">>> onVideoSizeChanged ${videoSize.width}x${videoSize.height} pixelRatio=${videoSize.pixelWidthHeightRatio}")
                        emitEvent("videoSize", Arguments.createMap().apply {
                            putInt("videoWidth", videoSize.width)
                            putInt("videoHeight", videoSize.height)
                            putDouble("pixelRatio", videoSize.pixelWidthHeightRatio.toDouble())
                        })
                    }
                })
            }

        // Start progress polling
        startProgressPoller()
        Log.w(TAG, ">>> initPlayer DONE")
    }

    // --- Progress polling ---

    private val progressRunnable = object : Runnable {
        override fun run() {
            if (destroyed) return
            val p = player ?: return
            val now = System.currentTimeMillis()
            if (now - lastProgressEmit >= progressInterval) {
                lastProgressEmit = now
                val currentTime = p.currentPosition.toDouble() / 1000.0
                val buffered = p.bufferedPosition.toDouble() / 1000.0
                emitEvent("progress", Arguments.createMap().apply {
                    putDouble("currentTime", currentTime)
                    putDouble("bufferedTime", buffered)
                })
            }
            postDelayed(this, 250)
        }
    }

    private fun startProgressPoller() {
        removeCallbacks(progressRunnable)
        post(progressRunnable)
    }

    // --- Public API (mirrors MpvPlayerView) ---

    fun loadFile(url: String) {
        Log.w(TAG, ">>> loadFile url=${url.take(120)}...")
        currentUrl = url
        val p = player
        if (p == null) {
            Log.w(TAG, ">>> loadFile DEFERRED (player not ready)")
            return
        }
        if (url == lastLoadedUrl) {
            Log.w(TAG, ">>> loadFile SKIP (same URL)")
            return
        }
        lastLoadedUrl = url
        loadEmitted = false
        val mediaItem = MediaItem.fromUri(Uri.parse(url))
        p.setMediaItem(mediaItem)
        p.prepare()
        p.playWhenReady = pendingPaused != true
        Log.w(TAG, ">>> loadFile prepared")
    }

    fun seekTo(seconds: Double) {
        Log.w(TAG, ">>> seekTo seconds=$seconds")
        player?.seekTo((seconds * 1000).toLong())
    }

    fun setPaused(paused: Boolean) {
        Log.w(TAG, ">>> setPaused paused=$paused")
        val p = player
        if (p == null) {
            pendingPaused = paused
            return
        }
        pendingPaused = null
        p.playWhenReady = !paused
    }

    fun setAudioTrack(id: Int) {
        Log.w(TAG, ">>> setAudioTrack id=$id")
        val p = player ?: return
        val track = trackList.find { it.id == id && it.type == "audio" } ?: return
        val groups = p.currentTracks.groups
        if (track.groupIndex < groups.size) {
            val group = groups[track.groupIndex]
            p.trackSelectionParameters = p.trackSelectionParameters.buildUpon()
                .setOverrideForType(
                    TrackSelectionOverride(group.mediaTrackGroup, track.trackIndex)
                )
                .build()
            Log.w(TAG, ">>> setAudioTrack OK group=${track.groupIndex}")
        }
    }

    fun setSubtitleTrack(id: Int) {
        Log.w(TAG, ">>> setSubtitleTrack id=$id")
        val p = player ?: return
        if (id <= 0) {
            // Disable subtitles
            p.trackSelectionParameters = p.trackSelectionParameters.buildUpon()
                .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
                .build()
            Log.w(TAG, ">>> setSubtitleTrack DISABLED")
            return
        }
        // Re-enable subtitle track type
        p.trackSelectionParameters = p.trackSelectionParameters.buildUpon()
            .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
            .build()
        val track = trackList.find { it.id == id && it.type == "sub" } ?: return
        val groups = p.currentTracks.groups
        if (track.groupIndex < groups.size) {
            val group = groups[track.groupIndex]
            p.trackSelectionParameters = p.trackSelectionParameters.buildUpon()
                .setOverrideForType(
                    TrackSelectionOverride(group.mediaTrackGroup, track.trackIndex)
                )
                .build()
            Log.w(TAG, ">>> setSubtitleTrack OK group=${track.groupIndex}")
        }
    }

    fun destroy() {
        Log.w(TAG, ">>> destroy START viewId=$id")
        if (destroyed) return
        destroyed = true
        removeCallbacks(progressRunnable)
        player?.release()
        player = null
        Log.w(TAG, ">>> destroy DONE")
    }

    // --- Track list ---

    private fun sendTrackList(tracks: Tracks) {
        trackList.clear()
        val tracksArray = Arguments.createArray()

        var audioId = 1
        var subId = 1

        for ((groupIndex, group) in tracks.groups.withIndex()) {
            val trackGroup = group.mediaTrackGroup
            for (trackIndex in 0 until trackGroup.length) {
                val format = trackGroup.getFormat(trackIndex)
                val isSelected = group.isTrackSelected(trackIndex)

                val type = when {
                    trackGroup.type == C.TRACK_TYPE_AUDIO -> "audio"
                    trackGroup.type == C.TRACK_TYPE_TEXT -> "sub"
                    trackGroup.type == C.TRACK_TYPE_VIDEO -> "video"
                    else -> continue
                }

                val id = when (type) {
                    "audio" -> audioId++
                    "sub" -> subId++
                    else -> 0
                }

                val info = TrackInfo(
                    id = id,
                    type = type,
                    lang = format.language ?: "",
                    title = format.label ?: "",
                    codec = format.codecs ?: format.sampleMimeType ?: "",
                    isDefault = group.isTrackSelected(trackIndex),
                    isSelected = isSelected,
                    groupIndex = groupIndex,
                    trackIndex = trackIndex,
                )
                trackList.add(info)

                val trackMap = Arguments.createMap().apply {
                    putInt("id", info.id)
                    putString("type", info.type)
                    putString("lang", info.lang)
                    putString("title", info.title)
                    putString("codec", info.codec)
                    putBoolean("default", info.isDefault)
                    putBoolean("selected", info.isSelected)
                }
                tracksArray.pushMap(trackMap)

                Log.w(TAG, ">>> track[$groupIndex/$trackIndex] type=$type lang=${info.lang} codec=${info.codec} selected=$isSelected")
            }
        }

        emitEvent("tracks", Arguments.createMap().apply {
            putArray("tracks", tracksArray)
        })
        Log.w(TAG, ">>> sendTrackList emitted ${trackList.size} tracks")
    }

    // --- Event emission (same format as MpvPlayerView) ---

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
