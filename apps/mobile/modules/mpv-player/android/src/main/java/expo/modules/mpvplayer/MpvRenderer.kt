// Dérivé de Streamyfin — https://github.com/streamyfin/streamyfin
// (modules/mpv-player/android/src/main/java/expo/modules/mpvplayer/MPVLayerRenderer.kt,
// révision 4faddc5f du 2026-09-12), publié sous Mozilla Public License 2.0. Ce
// fichier reste couvert par la MPL-2.0 (https://mozilla.org/MPL/2.0/) ;
// adaptation Tentacle TV : découpage en extensions, contrat d'événements.
package expo.modules.mpvplayer

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Surface

/** Ce que le rendu remonte à la vue. Tous les appels arrivent sur le thread principal. */
interface MpvRendererDelegate {
    fun onLoad(info: Map<String, Any?>)
    fun onTracksChanged(tracks: List<Map<String, Any?>>)
    fun onVideoParams(params: Map<String, Any?>)
    fun onPosition(position: Double, duration: Double, cacheSeconds: Double)
    fun onPauseChanged(isPaused: Boolean)
    fun onBufferingChanged(isBuffering: Boolean)
    fun onError(message: String)
    fun onEnd()
}

/**
 * libmpv sur une `Surface` Android (`vo=gpu-next`, `gpu-context=android`).
 * Le handle mpv est par instance ; on ne le détruit jamais explicitement
 * (voir [MPVLib]). Les extensions (`MpvRendererOptions`, `MpvRendererTracks`,
 * `MpvRendererEvents`) partagent les membres `internal`.
 */
class MpvRenderer(internal val context: Context) : MPVLib.EventObserver {

    companion object {
        internal const val TAG = "MpvRenderer"
    }

    var delegate: MpvRendererDelegate? = null

    internal val mainHandler = Handler(Looper.getMainLooper())
    internal var mpv: MPVLib? = null
    @Volatile internal var isRunning = false

    /** La demande de chargement en cours, lue par FILE_LOADED. */
    internal var pendingConfig: MpvLoadConfig? = null
    internal var fileLoaded = false
    internal var suspendedVideoTrack: String? = null
    internal var lastBufferingReported = false

    internal var cachedPosition = 0.0
    internal var cachedDuration = 0.0
    internal var cachedCacheSeconds = 0.0
    internal var isPaused = true
    internal var isLoading = false
    internal var pausedForCache = false
    internal var isSeeking = false
    internal var lastProgressUpdateTime = 0L

    /** Crée le handle, pose les options, initialise. Idempotent. */
    fun start() {
        if (isRunning) return
        try {
            val handle = MPVLib.create(context)
            mpv = handle
            handle.addObserver(this)
            applyInitOptions(handle)
            handle.initialize()
            observeProperties(handle)
            isRunning = true
            Log.i(TAG, "rendu mpv démarré")
        } catch (e: Exception) {
            Log.e(TAG, "démarrage du rendu impossible : ${e.message}")
            mpv = null
            notify { it.onError("démarrage du rendu impossible : ${e.message}") }
        }
    }

    /**
     * Arrête la lecture et lâche le handle. Le `stop` mpv libère le décodeur
     * MediaCodec : travail JNI synchrone qui peut bloquer des centaines de
     * millisecondes — sur un thread d'arrière-plan, jamais sur le principal.
     */
    fun stop() {
        val handle = mpv ?: return
        mpv = null
        isRunning = false
        fileLoaded = false
        pendingConfig = null
        Thread {
            // `force-window=no` AVANT `stop` : avec `keep-open=always`, mpv
            // garde le VO vivant et tente une reconfiguration sur une surface
            // détachée — « Missing surface pointer », fatal (mesuré par Streamyfin).
            try { handle.setOptionString("force-window", "no") } catch (e: Exception) { Log.w(TAG, "force-window : ${e.message}") }
            try { handle.command(arrayOf("stop")) } catch (e: Exception) { Log.w(TAG, "stop : ${e.message}") }
            try { handle.removeObserver(this) } catch (e: Exception) { Log.w(TAG, "observer : ${e.message}") }
            try { handle.detachSurface() } catch (e: Exception) { Log.w(TAG, "detachSurface : ${e.message}") }
        }.also { it.isDaemon = true }.start()
    }

    // MARK: - Surface

    /** La surface arrive (création, retour de PiP) : le VO reste vivant, on la rattache. */
    fun attachSurface(surface: Surface) {
        val handle = mpv ?: return
        if (!isRunning) return
        handle.attachSurface(surface)
        handle.setOptionString("force-window", "yes")
    }

    /** La surface disparaît : les images sont simplement ignorées jusqu'à la suivante. */
    fun detachSurface() {
        val handle = mpv ?: return
        if (!isRunning) return
        handle.detachSurface()
    }

    fun updateSurfaceSize(width: Int, height: Int) {
        if (!isRunning) return
        mpv?.setPropertyString("android-surface-size", "${width}x$height")
    }

    // MARK: - Transport

    fun load(config: MpvLoadConfig) {
        val handle = mpv ?: return
        pendingConfig = config
        fileLoaded = false
        suspendedVideoTrack = null
        isSeeking = false
        setLoading(true)
        handle.command(arrayOf("stop"))
        updateHttpHeaders(handle, config.headers)
        val start = config.startPosition
        handle.setPropertyString("start", if (start != null && start > 0) String.format(java.util.Locale.US, "%.3f", start) else "0")
        // Aucun sous-titre avant la sélection explicite de FILE_LOADED.
        handle.setPropertyString("sid", "no")
        handle.setPropertyString("aid", "auto")
        handle.command(arrayOf("loadfile", config.url, "replace"))
    }

    fun play() { mpv?.setPropertyBoolean("pause", false) }
    fun pause() { mpv?.setPropertyBoolean("pause", true) }

    fun seekTo(seconds: Double) {
        val clamped = maxOf(0.0, seconds)
        cachedPosition = clamped
        mpv?.command(arrayOf("seek", clamped.toString(), "absolute"))
    }

    fun setSpeed(speed: Double) { mpv?.setPropertyDouble("speed", speed) }
    fun setAudioDelay(seconds: Double) { mpv?.setPropertyDouble("audio-delay", seconds) }
    fun setSubtitleDelay(seconds: Double) { mpv?.setPropertyDouble("sub-delay", seconds) }
    fun setSubtitleScale(scale: Double) { mpv?.setPropertyDouble("sub-scale", scale) }
    fun setSubtitlePosition(position: Int) { mpv?.setPropertyInt("sub-pos", position) }

    /** Arrière-plan : la vidéo se coupe, l'audio continue ; au retour, la piste est rétablie. */
    fun setVideoEnabled(enabled: Boolean) {
        val handle = mpv ?: return
        if (enabled) {
            val suspended = suspendedVideoTrack ?: return
            suspendedVideoTrack = null
            handle.setPropertyString("vid", suspended)
        } else {
            val current = handle.getPropertyString("vid") ?: return
            if (current == "no" || current == "auto") return
            suspendedVideoTrack = current
            handle.setPropertyString("vid", "no")
        }
    }

    internal fun setLoading(loading: Boolean) {
        isLoading = loading
        reportBuffering()
    }

    internal fun reportBuffering() {
        val buffering = isLoading || pausedForCache
        if (buffering == lastBufferingReported) return
        lastBufferingReported = buffering
        notify { it.onBufferingChanged(buffering) }
    }

    internal fun notify(block: (MpvRendererDelegate) -> Unit) {
        mainHandler.post { delegate?.let(block) }
    }

    // MARK: - MPVLib.EventObserver (le détail vit dans MpvRendererEvents)

    override fun eventProperty(property: String) {}
    override fun eventProperty(property: String, value: Long) = MpvRendererEvents.onLong(this, property, value)
    override fun eventProperty(property: String, value: Boolean) = MpvRendererEvents.onBoolean(this, property, value)
    override fun eventProperty(property: String, value: String) = MpvRendererEvents.onString(this, property, value)
    override fun eventProperty(property: String, value: Double) = MpvRendererEvents.onDouble(this, property, value)
    override fun event(eventId: Int) = MpvRendererEvents.onEvent(this, eventId)
}
