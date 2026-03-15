package com.tentacletv.mpv

import android.util.Log
import android.view.SurfaceHolder
import android.view.SurfaceView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter
import com.facebook.react.bridge.UiThreadUtil
import dev.jdtech.mpv.MPVLib

class MpvPlayerView(
    private val reactContext: ThemedReactContext
) : SurfaceView(reactContext),
    SurfaceHolder.Callback, MPVLib.EventObserver {

    companion object {
        private const val TAG = "MpvPlayerView"
    }

    private var initialized = false
    private var destroyed = false
    private var currentUrl: String? = null
    private var lastLoadedUrl: String? = null
    private var pendingPaused: Boolean? = null
    private var lastProgressEmit = 0L
    var progressInterval = 1000L

    // Video dimensions for aspect ratio event
    private var videoParamsW = 0
    private var videoParamsH = 0

    init {
        Log.w(TAG, ">>> CONSTRUCTOR viewId=$id context=${reactContext.javaClass.simpleName} appCtx=${reactContext.applicationContext.javaClass.simpleName}")
        holder.addCallback(this)
        Log.w(TAG, ">>> CONSTRUCTOR done, holder callback registered")
    }

    // --- Surface lifecycle ---

    override fun surfaceCreated(holder: SurfaceHolder) {
        Log.w(TAG, ">>> surfaceCreated viewId=$id destroyed=$destroyed initialized=$initialized surface=${holder.surface} isValid=${holder.surface.isValid}")
        if (destroyed) {
            Log.w(TAG, ">>> surfaceCreated SKIPPED (destroyed)")
            return
        }
        initMpv()
        if (!initialized) {
            Log.e(TAG, ">>> surfaceCreated ABORT — initMpv failed, not attaching surface")
            return
        }
        Log.w(TAG, ">>> surfaceCreated attaching surface...")
        try {
            MPVLib.attachSurface(holder.surface)
            Log.w(TAG, ">>> surfaceCreated attachSurface OK")
        } catch (e: Exception) {
            Log.e(TAG, ">>> surfaceCreated attachSurface FAILED", e)
            return
        }
        try {
            MPVLib.setOptionString("force-window", "yes")
            Log.w(TAG, ">>> surfaceCreated force-window=yes OK")
        } catch (e: Exception) {
            Log.e(TAG, ">>> surfaceCreated force-window FAILED", e)
        }
        currentUrl?.let {
            Log.w(TAG, ">>> surfaceCreated has pending URL, calling loadFile")
            loadFile(it)
        }
        pendingPaused?.let {
            Log.w(TAG, ">>> surfaceCreated has pendingPaused=$it, calling setPaused")
            setPaused(it)
        }
        Log.w(TAG, ">>> surfaceCreated DONE")
    }

    override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
        Log.w(TAG, ">>> surfaceChanged format=$format width=$width height=$height initialized=$initialized")
    }

    override fun surfaceDestroyed(holder: SurfaceHolder) {
        Log.w(TAG, ">>> surfaceDestroyed viewId=$id initialized=$initialized destroyed=$destroyed")
        if (!initialized) return
        try {
            MPVLib.setOptionString("force-window", "no")
            MPVLib.detachSurface()
            Log.w(TAG, ">>> surfaceDestroyed detached OK")
        } catch (e: Exception) {
            Log.e(TAG, ">>> surfaceDestroyed FAILED", e)
        }
    }

    // --- MPV init ---

    private fun initMpv() {
        Log.w(TAG, ">>> initMpv START initialized=$initialized destroyed=$destroyed")
        if (initialized) {
            Log.w(TAG, ">>> initMpv SKIP (already initialized)")
            return
        }
        try {
            val appCtx = reactContext.applicationContext
            Log.w(TAG, ">>> initMpv calling MPVLib.create(${appCtx.javaClass.simpleName})...")
            MPVLib.create(appCtx)
            Log.w(TAG, ">>> initMpv MPVLib.create OK")

            // Video output
            Log.w(TAG, ">>> initMpv setting video options...")
            MPVLib.setOptionString("vo", "gpu")
            MPVLib.setOptionString("gpu-context", "android")
            MPVLib.setOptionString("hwdec", "mediacodec-copy")
            MPVLib.setOptionString("hwdec-codecs", "h264,hevc,av1,vp9,vp8")
            MPVLib.setOptionString("keepaspect", "yes")
            MPVLib.setOptionString("panscan", "0.0")
            Log.w(TAG, ">>> initMpv video options OK")

            // Audio output — decode to PCM (no passthrough to avoid A/V sync issues)
            Log.w(TAG, ">>> initMpv setting audio options...")
            MPVLib.setOptionString("ao", "opensles,audiotrack")
            MPVLib.setOptionString("audio-channels", "auto-safe")
            // audio-spdif removed: passthrough causes latency on receivers that
            // don't support the codec; MPV decodes to multi-channel PCM instead
            MPVLib.setOptionString("audio-stream-silence", "yes")  // Keep audio pipeline open, avoids re-init desync on DTS-HD
            Log.w(TAG, ">>> initMpv audio options OK")

            // Cache / buffer
            Log.w(TAG, ">>> initMpv setting cache options...")
            MPVLib.setOptionString("cache", "yes")
            MPVLib.setOptionString("cache-secs", "300")
            MPVLib.setOptionString("demuxer-max-bytes", "150MiB")
            MPVLib.setOptionString("demuxer-max-back-bytes", "75MiB")
            Log.w(TAG, ">>> initMpv cache options OK")

            // Subtitles
            MPVLib.setOptionString("sub-ass-override", "no")
            MPVLib.setOptionString("sub-auto", "no")

            // Disable OSD (we use our own overlay)
            MPVLib.setOptionString("osc", "no")
            MPVLib.setOptionString("osd-level", "0")

            // Enable verbose logging for MPV itself to diagnose crashes
            MPVLib.setOptionString("terminal", "yes")
            MPVLib.setOptionString("msg-level", "all=v")
            Log.w(TAG, ">>> initMpv all options set, calling MPVLib.init()...")

            MPVLib.init()
            Log.w(TAG, ">>> initMpv MPVLib.init() OK")

            MPVLib.addObserver(this)
            Log.w(TAG, ">>> initMpv observer added")

            // Observe properties
            Log.w(TAG, ">>> initMpv observing properties...")
            MPVLib.observeProperty("time-pos", MPVLib.MPV_FORMAT_DOUBLE)
            MPVLib.observeProperty("duration", MPVLib.MPV_FORMAT_DOUBLE)
            MPVLib.observeProperty("pause", MPVLib.MPV_FORMAT_FLAG)
            MPVLib.observeProperty("eof-reached", MPVLib.MPV_FORMAT_FLAG)
            MPVLib.observeProperty("demuxer-cache-duration", MPVLib.MPV_FORMAT_DOUBLE)
            MPVLib.observeProperty("demuxer-cache-time", MPVLib.MPV_FORMAT_DOUBLE)
            MPVLib.observeProperty("track-list/count", MPVLib.MPV_FORMAT_INT64)
            MPVLib.observeProperty("video-params/w", MPVLib.MPV_FORMAT_INT64)
            MPVLib.observeProperty("video-params/h", MPVLib.MPV_FORMAT_INT64)
            Log.w(TAG, ">>> initMpv properties observed OK")

            initialized = true
            Log.w(TAG, ">>> initMpv SUCCESS — MPV fully initialized")
        } catch (e: Exception) {
            Log.e(TAG, ">>> initMpv FAILED with exception", e)
            Log.e(TAG, ">>> initMpv exception class: ${e.javaClass.name} message: ${e.message}")
            Log.e(TAG, ">>> initMpv stacktrace:", e)
            emitEvent("error", Arguments.createMap().apply {
                putString("error", "MPV init failed: ${e.message}")
            })
        }
    }

    // --- Public API ---

    fun loadFile(url: String) {
        Log.w(TAG, ">>> loadFile url=${url.take(120)}... initialized=$initialized destroyed=$destroyed")
        currentUrl = url
        if (!initialized) {
            Log.w(TAG, ">>> loadFile DEFERRED (not initialized yet, saved to currentUrl)")
            return
        }
        if (url == lastLoadedUrl) {
            Log.w(TAG, ">>> loadFile SKIP (same URL already loaded)")
            return
        }
        lastLoadedUrl = url
        try {
            val cmd = arrayOf("loadfile", url, "replace")
            Log.w(TAG, ">>> loadFile calling MPVLib.command(loadfile)...")
            MPVLib.command(cmd)
            Log.w(TAG, ">>> loadFile MPVLib.command OK")
        } catch (e: Exception) {
            Log.e(TAG, ">>> loadFile FAILED", e)
            emitEvent("error", Arguments.createMap().apply {
                putString("error", "Load failed: ${e.message}")
            })
        }
    }

    fun seekTo(seconds: Double) {
        Log.w(TAG, ">>> seekTo seconds=$seconds initialized=$initialized")
        if (!initialized) return
        try {
            MPVLib.command(arrayOf("seek", seconds.toString(), "absolute"))
            Log.w(TAG, ">>> seekTo OK")
        } catch (e: Exception) {
            Log.e(TAG, ">>> seekTo FAILED", e)
        }
    }

    fun setPaused(paused: Boolean) {
        Log.w(TAG, ">>> setPaused paused=$paused initialized=$initialized")
        if (!initialized) {
            pendingPaused = paused
            Log.w(TAG, ">>> setPaused DEFERRED (pendingPaused=$paused)")
            return
        }
        pendingPaused = null
        try {
            MPVLib.setPropertyBoolean("pause", paused)
            Log.w(TAG, ">>> setPaused OK")
        } catch (e: Exception) {
            Log.e(TAG, ">>> setPaused FAILED", e)
        }
    }

    fun setAudioTrack(id: Int) {
        Log.w(TAG, ">>> setAudioTrack id=$id initialized=$initialized")
        if (!initialized) return
        try {
            MPVLib.setPropertyInt("aid", id)
            Log.w(TAG, ">>> setAudioTrack OK")
        } catch (e: Exception) {
            Log.e(TAG, ">>> setAudioTrack FAILED", e)
        }
    }

    fun setSubtitleTrack(id: Int) {
        Log.w(TAG, ">>> setSubtitleTrack id=$id initialized=$initialized")
        if (!initialized) return
        try {
            if (id <= 0) {
                MPVLib.setPropertyString("sid", "no")
            } else {
                MPVLib.setPropertyInt("sid", id)
            }
            Log.w(TAG, ">>> setSubtitleTrack OK")
        } catch (e: Exception) {
            Log.e(TAG, ">>> setSubtitleTrack FAILED", e)
        }
    }

    fun destroy() {
        Log.w(TAG, ">>> destroy START viewId=$id destroyed=$destroyed initialized=$initialized")
        if (destroyed) {
            Log.w(TAG, ">>> destroy SKIP (already destroyed)")
            return
        }
        destroyed = true
        if (!initialized) {
            Log.w(TAG, ">>> destroy SKIP MPV teardown (never initialized)")
            return
        }
        try {
            Log.w(TAG, ">>> destroy removing observer...")
            MPVLib.removeObserver(this)
            Log.w(TAG, ">>> destroy calling MPVLib.destroy()...")
            MPVLib.destroy()
            initialized = false
            Log.w(TAG, ">>> destroy SUCCESS — MPV destroyed")
        } catch (e: Exception) {
            Log.e(TAG, ">>> destroy FAILED", e)
        }
    }

    // --- MPV event observer ---

    override fun eventProperty(property: String) {
        Log.d(TAG, ">>> eventProperty(no-value) property=$property")
    }

    override fun eventProperty(property: String, value: String) {
        Log.d(TAG, ">>> eventProperty(string) property=$property value=$value")
    }

    override fun eventProperty(property: String, value: Long) {
        if (destroyed) return
        Log.d(TAG, ">>> eventProperty(long) property=$property value=$value")
        when (property) {
            "track-list/count" -> {
                Log.w(TAG, ">>> track-list/count changed to $value, sending track list")
                sendTrackList()
            }
            "video-params/w" -> {
                videoParamsW = value.toInt()
                emitVideoSizeIfReady()
            }
            "video-params/h" -> {
                videoParamsH = value.toInt()
                emitVideoSizeIfReady()
            }
        }
    }

    override fun eventProperty(property: String, value: Boolean) {
        if (destroyed) return
        Log.d(TAG, ">>> eventProperty(bool) property=$property value=$value")
        when (property) {
            "eof-reached" -> {
                if (value) {
                    Log.w(TAG, ">>> EOF reached!")
                    emitEvent("end", Arguments.createMap())
                }
            }
        }
    }

    override fun eventProperty(property: String, value: Double) {
        if (destroyed) return
        when (property) {
            "time-pos" -> {
                val now = System.currentTimeMillis()
                if (now - lastProgressEmit >= progressInterval) {
                    lastProgressEmit = now
                    val cacheDuration = try {
                        MPVLib.getPropertyDouble("demuxer-cache-duration") ?: 0.0
                    } catch (_: Exception) { 0.0 }
                    val cacheEnd = try {
                        MPVLib.getPropertyDouble("demuxer-cache-time") ?: 0.0
                    } catch (_: Exception) { 0.0 }
                    // Use whichever gives a higher buffered position
                    val bufferedAbs = if (cacheEnd > value) cacheEnd else value + cacheDuration
                    Log.d(TAG, "[Buffer] time=${String.format("%.1f", value)} cacheDur=${String.format("%.1f", cacheDuration)} cacheEnd=${String.format("%.1f", cacheEnd)} bufferedAbs=${String.format("%.1f", bufferedAbs)}")
                    emitEvent("progress", Arguments.createMap().apply {
                        putDouble("currentTime", value)
                        putDouble("bufferedTime", bufferedAbs)
                    })
                }
            }
            "duration" -> {
                Log.w(TAG, ">>> duration changed to $value")
                emitEvent("load", Arguments.createMap().apply {
                    putDouble("duration", value)
                })
            }
        }
    }

    override fun event(eventId: Int) {
        // END_FILE is unreliable — fires on file transitions (loadfile replacing previous),
        // not just real end of playback. Real end is handled by eof-reached property observer.
        Log.d(TAG, ">>> event eventId=$eventId destroyed=$destroyed")
    }

    // --- Track list ---

    private fun sendTrackList() {
        try {
            val count = MPVLib.getPropertyInt("track-list/count") ?: return
            Log.w(TAG, ">>> sendTrackList count=$count")
            val tracks = Arguments.createArray()
            for (i in 0 until count) {
                val track = Arguments.createMap()
                track.putInt("id", MPVLib.getPropertyInt("track-list/$i/id") ?: continue)
                track.putString("type", MPVLib.getPropertyString("track-list/$i/type") ?: "")
                track.putString("lang", MPVLib.getPropertyString("track-list/$i/lang") ?: "")
                track.putString("title", MPVLib.getPropertyString("track-list/$i/title") ?: "")
                track.putString("codec", MPVLib.getPropertyString("track-list/$i/codec") ?: "")
                track.putBoolean("default", MPVLib.getPropertyBoolean("track-list/$i/default") ?: false)
                track.putBoolean("selected", MPVLib.getPropertyBoolean("track-list/$i/selected") ?: false)
                val type = MPVLib.getPropertyString("track-list/$i/type") ?: ""
                val lang = MPVLib.getPropertyString("track-list/$i/lang") ?: ""
                val codec = MPVLib.getPropertyString("track-list/$i/codec") ?: ""
                Log.w(TAG, ">>> track[$i] type=$type lang=$lang codec=$codec")
                tracks.pushMap(track)
            }
            emitEvent("tracks", Arguments.createMap().apply {
                putArray("tracks", tracks)
            })
            Log.w(TAG, ">>> sendTrackList emitted $count tracks")
        } catch (e: Exception) {
            Log.e(TAG, ">>> sendTrackList FAILED", e)
        }
    }

    // --- Video size emission ---

    private fun emitVideoSizeIfReady() {
        if (videoParamsW > 0 && videoParamsH > 0) {
            Log.w(TAG, ">>> emitVideoSize ${videoParamsW}x${videoParamsH}")
            emitEvent("videoSize", Arguments.createMap().apply {
                putInt("videoWidth", videoParamsW)
                putInt("videoHeight", videoParamsH)
                putDouble("pixelRatio", 1.0)
            })
        }
    }

    // --- Event emission ---

    private fun emitEvent(type: String, data: WritableMap) {
        data.putString("type", type)
        UiThreadUtil.runOnUiThread {
            if (destroyed) {
                Log.w(TAG, ">>> emitEvent SKIP $type (destroyed)")
                return@runOnUiThread
            }
            try {
                reactContext.getJSModule(RCTEventEmitter::class.java)
                    .receiveEvent(id, "onMpvEvent", data)
            } catch (e: Exception) {
                Log.e(TAG, ">>> emitEvent FAILED for $type", e)
            }
        }
    }
}
