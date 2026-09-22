package com.tentacletv.mpv

import android.util.Log
import android.view.SurfaceHolder
import android.view.SurfaceView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter

/**
 * La vue mpv du téléviseur — le moteur du TRANSCODAGE (ExoPlayer reste le moteur
 * principal). libmpv-android 1.0 : API par instance, un handle par vue
 * (`MPVLib.create`), détruit sur un thread à nous dans l'ordre que le mobile a
 * mesuré (`vo=null` → `force-window=no` → `stop` → détacher → `destroy`).
 */
class MpvPlayerView(
    private val reactContext: ThemedReactContext
) : SurfaceView(reactContext),
    SurfaceHolder.Callback, MPVLib.EventObserver {

    companion object {
        private const val TAG = "MpvPlayerView"
    }

    private var mpv: MPVLib? = null
    private var initialized = false
    private var destroyed = false
    private var currentUrl: String? = null
    private var lastLoadedUrl: String? = null
    private var pendingPaused: Boolean? = null
    private var lastProgressEmit = 0L
    var progressInterval = 1000L

    // Dimensions vidéo pour l'évènement de format
    private var videoParamsW = 0
    private var videoParamsH = 0

    init {
        holder.addCallback(this)
    }

    // --- Cycle de vie de la surface ---

    override fun surfaceCreated(holder: SurfaceHolder) {
        Log.w(TAG, ">>> surfaceCreated destroyed=$destroyed initialized=$initialized")
        if (destroyed) return
        initMpv()
        val handle = mpv ?: return
        try {
            handle.attachSurface(holder.surface)
            handle.setOptionString("force-window", "yes")
        } catch (e: Exception) {
            Log.e(TAG, ">>> surfaceCreated attachSurface FAILED", e)
            return
        }
        currentUrl?.let { loadFile(it) }
        pendingPaused?.let { setPaused(it) }
    }

    override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
        Log.d(TAG, ">>> surfaceChanged ${width}x$height")
    }

    override fun surfaceDestroyed(holder: SurfaceHolder) {
        val handle = mpv ?: return
        try {
            handle.setOptionString("force-window", "no")
            handle.detachSurface()
        } catch (e: Exception) {
            Log.e(TAG, ">>> surfaceDestroyed FAILED", e)
        }
    }

    // --- Initialisation mpv ---

    private fun initMpv() {
        if (initialized) return
        try {
            val appCtx = reactContext.applicationContext
            val handle = MPVLib.create(appCtx)
            MpvOptions.apply(handle, appCtx)
            handle.initialize()
            handle.addObserver(this)
            handle.observeProperty("time-pos", MPVLib.MPV_FORMAT_DOUBLE)
            handle.observeProperty("duration", MPVLib.MPV_FORMAT_DOUBLE)
            handle.observeProperty("pause", MPVLib.MPV_FORMAT_FLAG)
            handle.observeProperty("eof-reached", MPVLib.MPV_FORMAT_FLAG)
            handle.observeProperty("demuxer-cache-duration", MPVLib.MPV_FORMAT_DOUBLE)
            handle.observeProperty("demuxer-cache-time", MPVLib.MPV_FORMAT_DOUBLE)
            handle.observeProperty("track-list/count", MPVLib.MPV_FORMAT_INT64)
            handle.observeProperty("video-params/w", MPVLib.MPV_FORMAT_INT64)
            handle.observeProperty("video-params/h", MPVLib.MPV_FORMAT_INT64)
            mpv = handle
            initialized = true
            Log.w(TAG, ">>> initMpv OK")
        } catch (e: Exception) {
            Log.e(TAG, ">>> initMpv FAILED", e)
            emitEvent("error", Arguments.createMap().apply {
                putString("error", "MPV init failed: ${e.message}")
            })
        }
    }

    // --- API publique ---

    fun loadFile(url: String) {
        currentUrl = url
        keepScreenOn = pendingPaused != true // anti-veille : une lecture démarre
        val handle = mpv ?: run { Log.w(TAG, ">>> loadFile DEFERRED"); return }
        if (url == lastLoadedUrl) return
        lastLoadedUrl = url
        try {
            // `#tnt-start=<seconds>` (posé côté JS) : démarrer DIRECTEMENT à la
            // position via l'option start de loadfile — un seek post-chargement
            // sur un HLS en cours de transcodage était parfois avalé (retour à 0).
            val marker = "#tnt-start="
            val idx = url.indexOf(marker)
            val cleanUrl = if (idx >= 0) url.substring(0, idx) else url
            val startSec = if (idx >= 0) url.substring(idx + marker.length).toDoubleOrNull() ?: 0.0 else 0.0
            // mpv ≥ 0.38 : loadfile <url> <flags> <index> <options> — les
            // options sont le 5ᵉ argument (le 4ᵉ est l'index de playlist).
            val cmd = if (startSec > 0)
                arrayOf("loadfile", cleanUrl, "replace", "-1", "start=+$startSec")
            else
                arrayOf("loadfile", cleanUrl, "replace")
            Log.w(TAG, ">>> loadFile start=$startSec url=${cleanUrl.take(120)}")
            handle.command(cmd)
        } catch (e: Exception) {
            Log.e(TAG, ">>> loadFile FAILED", e)
            emitEvent("error", Arguments.createMap().apply {
                putString("error", "Load failed: ${e.message}")
            })
        }
    }

    fun seekTo(seconds: Double) {
        try { mpv?.command(arrayOf("seek", seconds.toString(), "absolute")) } catch (e: Exception) { Log.e(TAG, ">>> seekTo FAILED", e) }
    }

    fun setPaused(paused: Boolean) {
        // Anti-veille : suit l'intention de lecture (JS = source de vérité) —
        // écran éveillé en lecture, veille système rendue en pause (OLED).
        keepScreenOn = !paused
        val handle = mpv ?: run { pendingPaused = paused; return }
        pendingPaused = null
        try { handle.setPropertyBoolean("pause", paused) } catch (e: Exception) { Log.e(TAG, ">>> setPaused FAILED", e) }
    }

    fun setAudioTrack(id: Int) {
        try { mpv?.setPropertyInt("aid", id) } catch (e: Exception) { Log.e(TAG, ">>> setAudioTrack FAILED", e) }
    }

    fun addSubtitleTrack(url: String) {
        try { mpv?.command(arrayOf("sub-add", url, "auto")) } catch (e: Exception) { Log.e(TAG, ">>> addSubtitleTrack FAILED", e) }
    }

    fun setSubtitleTrack(id: Int) {
        try {
            if (id <= 0) mpv?.setPropertyString("sid", "no") else mpv?.setPropertyInt("sid", id)
        } catch (e: Exception) {
            Log.e(TAG, ">>> setSubtitleTrack FAILED", e)
        }
    }

    /**
     * Arrête la lecture et détruit le handle, sur un thread d'arrière-plan : le
     * `stop` libère le décodeur MediaCodec et `destroy` attend le thread
     * d'événements — du JNI synchrone qui peut bloquer des centaines de
     * millisecondes, jamais sur le principal. Le handle est oublié AVANT : plus
     * personne ne lui parle pendant qu'il meurt. `vo=null` d'abord, puis
     * `force-window=no` avant `stop` : sinon mpv garde le VO vivant et tente une
     * reconfiguration sur une surface détachée — « Missing surface pointer »,
     * fatal (mesuré par Streamyfin).
     */
    fun destroy() {
        if (destroyed) return
        destroyed = true
        keepScreenOn = false // anti-veille : la vue meurt, la veille reprend ses droits
        val handle = mpv ?: return
        mpv = null
        initialized = false
        val observer = this
        Thread {
            try { handle.setPropertyString("vo", "null") } catch (e: Exception) { Log.w(TAG, "vo=null : ${e.message}") }
            try { handle.setOptionString("force-window", "no") } catch (e: Exception) { Log.w(TAG, "force-window : ${e.message}") }
            try { handle.command(arrayOf("stop")) } catch (e: Exception) { Log.w(TAG, "stop : ${e.message}") }
            try { handle.removeObserver(observer) } catch (e: Exception) { Log.w(TAG, "observer : ${e.message}") }
            try { handle.detachSurface() } catch (e: Exception) { Log.w(TAG, "detachSurface : ${e.message}") }
            try { handle.destroy() } catch (e: Throwable) { Log.w(TAG, "destroy : ${e.message}") }
            Log.w(TAG, ">>> destroy DONE")
        }.also { it.isDaemon = true }.start()
    }

    // --- Observateur mpv ---

    override fun eventProperty(property: String) {}

    override fun eventProperty(property: String, value: String) {}

    override fun eventProperty(property: String, value: Long) {
        if (destroyed) return
        when (property) {
            "track-list/count" -> sendTrackList()
            "video-params/w" -> { videoParamsW = value.toInt(); emitVideoSizeIfReady() }
            "video-params/h" -> { videoParamsH = value.toInt(); emitVideoSizeIfReady() }
        }
    }

    override fun eventProperty(property: String, value: Boolean) {
        if (destroyed) return
        if (property == "eof-reached" && value) {
            Log.w(TAG, ">>> EOF reached")
            emitEvent("end", Arguments.createMap())
        }
    }

    override fun eventProperty(property: String, value: Double) {
        if (destroyed) return
        when (property) {
            "time-pos" -> {
                val now = System.currentTimeMillis()
                if (now - lastProgressEmit >= progressInterval) {
                    lastProgressEmit = now
                    val cacheDuration = mpv?.getPropertyDouble("demuxer-cache-duration") ?: 0.0
                    val cacheEnd = mpv?.getPropertyDouble("demuxer-cache-time") ?: 0.0
                    // La plus haute des deux positions tamponnées
                    val bufferedAbs = if (cacheEnd > value) cacheEnd else value + cacheDuration
                    emitEvent("progress", Arguments.createMap().apply {
                        putDouble("currentTime", value)
                        putDouble("bufferedTime", bufferedAbs)
                    })
                }
            }
            "duration" -> emitEvent("load", Arguments.createMap().apply { putDouble("duration", value) })
        }
    }

    override fun event(eventId: Int) {
        // END_FILE n'est pas fiable — il part aussi aux transitions (loadfile qui
        // remplace) ; la vraie fin vient de la propriété eof-reached.
    }

    // --- Liste des pistes ---

    private fun sendTrackList() {
        val handle = mpv ?: return
        try {
            val count = handle.getPropertyInt("track-list/count") ?: return
            val tracks = Arguments.createArray()
            for (i in 0 until count) {
                val id = handle.getPropertyInt("track-list/$i/id") ?: continue
                tracks.pushMap(Arguments.createMap().apply {
                    putInt("id", id)
                    putString("type", handle.getPropertyString("track-list/$i/type") ?: "")
                    putString("lang", handle.getPropertyString("track-list/$i/lang") ?: "")
                    putString("title", handle.getPropertyString("track-list/$i/title") ?: "")
                    putString("codec", handle.getPropertyString("track-list/$i/codec") ?: "")
                    putBoolean("default", handle.getPropertyBoolean("track-list/$i/default") ?: false)
                    putBoolean("selected", handle.getPropertyBoolean("track-list/$i/selected") ?: false)
                })
            }
            emitEvent("tracks", Arguments.createMap().apply { putArray("tracks", tracks) })
            Log.w(TAG, ">>> sendTrackList emitted $count tracks")
        } catch (e: Exception) {
            Log.e(TAG, ">>> sendTrackList FAILED", e)
        }
    }

    // --- Format vidéo ---

    private fun emitVideoSizeIfReady() {
        if (videoParamsW > 0 && videoParamsH > 0) {
            emitEvent("videoSize", Arguments.createMap().apply {
                putInt("videoWidth", videoParamsW)
                putInt("videoHeight", videoParamsH)
                putDouble("pixelRatio", 1.0)
            })
        }
    }

    // --- Émission d'évènements ---

    private fun emitEvent(type: String, data: WritableMap) {
        data.putString("type", type)
        UiThreadUtil.runOnUiThread {
            if (destroyed) return@runOnUiThread
            try {
                reactContext.getJSModule(RCTEventEmitter::class.java)
                    .receiveEvent(id, "onMpvEvent", data)
            } catch (e: Exception) {
                Log.e(TAG, ">>> emitEvent FAILED for $type", e)
            }
        }
    }
}
