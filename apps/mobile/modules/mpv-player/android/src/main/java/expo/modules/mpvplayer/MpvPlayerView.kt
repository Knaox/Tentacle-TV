// Dérivé de Streamyfin — https://github.com/streamyfin/streamyfin
// (modules/mpv-player/android/src/main/java/expo/modules/mpvplayer/MpvPlayerView.kt,
// révision 4faddc5f du 2026-09-12), publié sous Mozilla Public License 2.0. Ce
// fichier reste couvert par la MPL-2.0 (https://mozilla.org/MPL/2.0/) ;
// adaptation Tentacle TV : contrat d'événements commun aux deux plateformes,
// cycle de vie de la surface selon mpv-android, pause en arrière-plan, focus audio.
package expo.modules.mpvplayer

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.Context
import android.graphics.Color
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
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
 * va droit au compositeur) et le rendu libmpv. Même contrat d'événements que
 * `MpvPlayerView.swift`. La surface commande le VO (mpv ne lit `wid` qu'à sa
 * création) et la lecture : sans surface — l'app en fond —, mpv se met en
 * pause, comme le lecteur système Android ; elle reprend avec la surface si
 * JS ne l'a pas mise en pause entre-temps.
 */
class MpvPlayerView(context: Context, appContext: AppContext) :
    ExpoView(context, appContext), MpvRendererDelegate, SurfaceHolder.Callback, AudioManager.OnAudioFocusChangeListener {

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
    /** L'intention de JS (la prop `paused`) : la reprise après une perte de surface s'y réfère. */
    private var jsPaused = false
    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private var hasAudioFocus = false
    /**
     * UNE requête pour toute la vie de la vue. En refaire une à chaque reprise
     * faisait perdre le focus à la précédente : Android annonçait la perte à
     * l'instant même où l'on relançait, et la lecture se remettait en pause
     * (mesuré à l'émulateur, après un appel entrant).
     */
    private val focusRequest: AudioFocusRequest by lazy {
        val attributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MOVIE)
            .build()
        AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(attributes)
            .setOnAudioFocusChangeListener(this)
            .build()
    }

    init {
        setBackgroundColor(Color.BLACK)
        surfaceView = SurfaceView(context).apply {
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }
        surfaceView.holder.addCallback(this)
        addView(surfaceView)
        renderer.delegate = this
        renderer.start()
    }

    // MARK: - SurfaceHolder.Callback

    override fun surfaceCreated(holder: SurfaceHolder) {
        surfaceReady = true
        renderer.attachSurface(holder.surface)
        if (surfaceView.width > 0 && surfaceView.height > 0) renderer.updateSurfaceSize(surfaceView.width, surfaceView.height)
        val pending = pendingConfig
        if (pending != null) {
            pendingConfig = null
            load(pending)
            return
        }
        // Surface recréée (retour au premier plan) : le VO renaît dessus, et la
        // lecture reprend si c'est nous qui l'avions suspendue.
        renderer.restoreVideoOutput()
        if (!jsPaused) resumePlayback()
    }

    override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
        if (width > 0 && height > 0) renderer.updateSurfaceSize(width, height)
    }

    override fun surfaceDestroyed(holder: SurfaceHolder) {
        surfaceReady = false
        renderer.suspendPlayback()
        renderer.releaseVideoOutput()
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
        if (!jsPaused) requestAudioFocus()
        renderer.load(config)
    }

    fun setPaused(paused: Boolean) {
        jsPaused = paused
        surfaceView.keepScreenOn = !paused
        if (paused) renderer.pause() else resumePlayback()
    }

    private fun resumePlayback() {
        requestAudioFocus()
        renderer.play()
    }

    fun seekTo(seconds: Double) = renderer.seekTo(seconds)
    fun getPosition(): Double = renderer.cachedPosition

    /** Arrête et lâche l'instance mpv ; la vue reste utilisable (`load` refait un handle). */
    fun stop() {
        renderer.stop()
        currentConfig = null
        pendingConfig = null
        abandonAudioFocus()
    }

    /** Destruction par React Native : plus rien ne remonte, le handle meurt. */
    fun destroy() {
        renderer.delegate = null
        renderer.stop()
        surfaceReady = false
        pendingConfig = null
        currentConfig = null
        surfaceView.keepScreenOn = false
        abandonAudioFocus()
    }

    // MARK: - Focus audio (une autre app qui joue, un appel : on se tait ; on ne reprend pas seul)

    private fun requestAudioFocus() {
        if (hasAudioFocus) return
        hasAudioFocus = audioManager.requestAudioFocus(focusRequest) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    }

    private fun abandonAudioFocus() {
        audioManager.abandonAudioFocusRequest(focusRequest)
        hasAudioFocus = false
    }

    override fun onAudioFocusChange(change: Int) {
        when (change) {
            // Perte : pause, annoncée à JS par l'observation de `pause` — c'est
            // l'utilisateur qui relance. Un simple « duck » (notification) passe
            // par-dessus sans rien changer.
            AudioManager.AUDIOFOCUS_LOSS, AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                hasAudioFocus = false
                renderer.pause()
            }
        }
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
