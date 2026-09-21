// Dérivé de Streamyfin — https://github.com/streamyfin/streamyfin
// (modules/mpv-player/android/src/main/java/expo/modules/mpvplayer/MpvPlayerView.kt,
// révision 4faddc5f du 2026-09-12), publié sous Mozilla Public License 2.0. Ce
// fichier reste couvert par la MPL-2.0 (https://mozilla.org/MPL/2.0/) ;
// adaptation Tentacle TV : contrat d'événements commun aux deux plateformes.
package expo.modules.mpvplayer

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.Context
import android.graphics.Color
import android.os.Build
import android.util.Rational
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.view.ViewGroup
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

/**
 * La vue native du lecteur avancé sur Android : une `SurfaceView` (la surface
 * va droit au compositeur, ce qui tient l'image dans l'image) et le rendu
 * libmpv. Même contrat d'événements que `MpvPlayerView.swift`.
 */
class MpvPlayerView(context: Context, appContext: AppContext) :
    ExpoView(context, appContext), MpvRendererDelegate, SurfaceHolder.Callback {

    val onLoad by EventDispatcher()
    val onProgress by EventDispatcher()
    val onBuffering by EventDispatcher()
    val onEnd by EventDispatcher()
    val onError by EventDispatcher()
    val onTracksChanged by EventDispatcher()
    val onVideoParams by EventDispatcher()
    val onPipChanged by EventDispatcher()
    val onPlaybackStateChange by EventDispatcher()
    val onAirPlayRoute by EventDispatcher()

    private val surfaceView: SurfaceView
    internal val renderer = MpvRenderer(context)
    private var currentConfig: MpvLoadConfig? = null
    private var pendingConfig: MpvLoadConfig? = null
    private var surfaceReady = false
    private var videoWidth = 0
    private var videoHeight = 0
    var pipAutoStart = true

    init {
        setBackgroundColor(Color.BLACK)
        surfaceView = SurfaceView(context).apply {
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }
        surfaceView.holder.addCallback(this)
        addView(surfaceView)
        // Chaque changement de taille est poussé à mpv : le passage en image
        // dans l'image redimensionne la surface avant le prochain rendu.
        surfaceView.addOnLayoutChangeListener { _, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom ->
            val width = right - left
            val height = bottom - top
            if (width > 0 && height > 0 && (width != oldRight - oldLeft || height != oldBottom - oldTop)) {
                renderer.updateSurfaceSize(width, height)
            }
        }
        renderer.delegate = this
        renderer.start()
    }

    // MARK: - SurfaceHolder.Callback

    override fun surfaceCreated(holder: SurfaceHolder) {
        surfaceReady = true
        renderer.attachSurface(holder.surface)
        if (surfaceView.width > 0 && surfaceView.height > 0) renderer.updateSurfaceSize(surfaceView.width, surfaceView.height)
        pendingConfig?.let { load(it) }
        pendingConfig = null
    }

    override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
        if (width > 0 && height > 0) renderer.updateSurfaceSize(width, height)
    }

    override fun surfaceDestroyed(holder: SurfaceHolder) {
        surfaceReady = false
        // Pas de `stop` : la lecture continue sur le démuxeur et reprend à la surface suivante.
        renderer.detachSurface()
    }

    // MARK: - Source et transport

    fun load(config: MpvLoadConfig) {
        currentConfig?.let { if (it.isSameMedia(config)) return }
        if (!surfaceReady) {
            pendingConfig = config
            return
        }
        // Après un `stop`, le handle est mort : on en refait un et on lui
        // redonne la surface avant de charger.
        if (!renderer.isRunning) {
            if (!renderer.start()) return
            renderer.attachSurface(surfaceView.holder.surface)
            if (surfaceView.width > 0 && surfaceView.height > 0) renderer.updateSurfaceSize(surfaceView.width, surfaceView.height)
        }
        currentConfig = config
        renderer.load(config)
    }

    fun setPaused(paused: Boolean) = if (paused) renderer.pause() else renderer.play()
    fun seekTo(seconds: Double) = renderer.seekTo(seconds)
    fun getPosition(): Double = renderer.cachedPosition

    /** Arrête et lâche l'instance mpv ; la vue reste utilisable (`load` refait un handle). */
    fun stop() {
        renderer.stop()
        currentConfig = null
        pendingConfig = null
    }

    /** Destruction par React Native : plus rien ne remonte, le handle meurt. */
    fun destroy() {
        renderer.delegate = null
        renderer.stop()
        surfaceReady = false
        pendingConfig = null
        currentConfig = null
    }

    // MARK: - Image dans l'image (minimale : le système la gère, on lui donne le format)

    private fun activity(): Activity? = appContext.currentActivity

    fun isPictureInPictureSupported(): Boolean =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            context.packageManager.hasSystemFeature(android.content.pm.PackageManager.FEATURE_PICTURE_IN_PICTURE)

    fun isPictureInPictureActive(): Boolean =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && (activity()?.isInPictureInPictureMode ?: false)

    fun startPictureInPicture() {
        val act = activity() ?: return
        if (!isPictureInPictureSupported()) return
        val ratio = if (videoWidth > 0 && videoHeight > 0) Rational(videoWidth, videoHeight) else Rational(16, 9)
        val params = PictureInPictureParams.Builder().setAspectRatio(ratio).build()
        // L'activité ne déclare pas `supportsPictureInPicture` : hors périmètre
        // de cette version, l'appel refuse sans faire tomber l'app.
        val entered = try { act.enterPictureInPictureMode(params) } catch (e: IllegalStateException) { false }
        onPipChanged(mapOf("active" to entered))
    }

    fun stopPictureInPicture() {
        // Android n'a pas de sortie programmée : l'utilisateur agrandit la fenêtre.
        onPipChanged(mapOf("active" to isPictureInPictureActive()))
    }

    // MARK: - MpvRendererDelegate (les `onX` ci-dessous sont les événements JS)

    override fun rendererDidLoad(info: Map<String, Any>) {
        videoWidth = (info["width"] as? Int) ?: 0
        videoHeight = (info["height"] as? Int) ?: 0
        onLoad(info)
    }

    override fun rendererDidUpdateTracks(tracks: List<Map<String, Any>>) {
        onTracksChanged(mapOf("tracks" to tracks))
    }

    override fun rendererDidUpdateVideoParams(params: Map<String, Any>) {
        videoWidth = (params["width"] as? Int) ?: videoWidth
        videoHeight = (params["height"] as? Int) ?: videoHeight
        onVideoParams(params)
    }

    override fun rendererDidProgress(position: Double, duration: Double, cacheSeconds: Double) {
        onProgress(mapOf("position" to position, "duration" to duration, "cacheSeconds" to cacheSeconds))
    }

    override fun rendererDidChangePause(isPaused: Boolean) {
        onPlaybackStateChange(mapOf("paused" to isPaused))
    }

    override fun rendererDidChangeBuffering(isBuffering: Boolean) {
        onBuffering(mapOf("buffering" to isBuffering))
    }

    override fun rendererDidFail(message: String) {
        onError(mapOf("message" to message))
    }

    override fun rendererDidEnd() {
        onEnd(emptyMap())
    }
}
