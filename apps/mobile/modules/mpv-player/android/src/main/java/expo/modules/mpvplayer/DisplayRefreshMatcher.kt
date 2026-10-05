package expo.modules.mpvplayer

import android.app.Activity
import android.os.Build
import android.util.Log
import android.view.Display
import android.view.Surface
import kotlin.math.abs

/**
 * Cale la fréquence de l'écran du téléphone sur la cadence du film.
 *
 * Un film à 23,976 i/s sur un écran à 60 Hz, c'est du pulldown 3:2 : une image
 * sur deux reste un tiers de plus à l'écran, et les travellings saccadent. Un
 * écran à 120 Hz montre au contraire chaque image cinq fois, à l'identique.
 * La cadence vient de JS (Jellyfin `RealFrameRate`, exacte — règle partagée
 * `contentFrameRate`) ; 0 veut dire « ne rien demander ».
 *
 * Deux mécanismes, selon le niveau d'API :
 *  - Android ≥ 11 : `Surface.setFrameRate(…, FIXED_SOURCE)` sur la surface de
 *    mpv. Le système choisit lui-même le mode (24 → 120 Hz sur un écran
 *    60/90/120), respecte les réglages de l'utilisateur et la batterie, et
 *    rend la main dès que la surface meurt ou que le vote est effacé. Sans
 *    coupure seulement (Android ≥ 12) : un téléphone bascule toujours sans
 *    écran noir, un téléviseur branché en HDMI ne doit pas renégocier ici.
 *  - Android 8 à 10 : `preferredDisplayModeId` sur la fenêtre de l'activité,
 *    vers un mode de même définition dont la fréquence vaut la cadence ou l'un
 *    de ses multiples. Jamais « le plus proche » : pour 23,976 sur un écran
 *    50/60, ce serait 50 Hz — pire que le pulldown.
 *
 * Jumeau de `DisplayModeSwitcher.kt` de l'Android TV (apps/tv), sans l'attente
 * de la renégociation HDMI : un écran de téléphone change de mode sans couper
 * l'image. Le retour à l'état d'origine est `reset` : sortie du lecteur,
 * destruction de la vue, réglage coupé.
 */
class DisplayRefreshMatcher {

    companion object {
        private const val TAG = "TntDisplayRefresh"
        /** Tolérance d'un mode « exact » (24 Hz vaut pour 23,976 : Δ 0,024). */
        private const val EXACT_TOLERANCE = 0.05f
    }

    /** La cadence demandée par JS (0 = rien). */
    private var contentFps = 0f
    /** La surface qui porte NOTRE vote — seule à effacer. */
    private var votedSurface: Surface? = null
    /** Le mode que NOUS avons écrit sur la fenêtre (0 = rien). */
    private var appliedModeId = 0

    /** La cadence change (prop `frameRate`) : on vote, ou l'on rend la main. */
    fun setContentFrameRate(activity: Activity?, surface: Surface?, fps: Float) {
        val next = if (fps.isFinite() && fps > 0f) fps else 0f
        if (next == contentFps) return
        contentFps = next
        if (next == 0f) { reset(activity); return }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) vote(surface) else applyWindowMode(activity)
    }

    /** Une surface neuve (création, retour au premier plan) : le vote se repose dessus. */
    fun onSurfaceAvailable(surface: Surface?) {
        if (contentFps <= 0f || Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return
        vote(surface)
    }

    /** La surface meurt : son vote part avec elle, rien à effacer. */
    fun onSurfaceLost() {
        votedSurface = null
    }

    /** Retour à la fréquence d'origine : le vote effacé, le mode de la fenêtre rendu. */
    fun reset(activity: Activity?) {
        contentFps = 0f
        clearVote()
        if (appliedModeId == 0) return
        appliedModeId = 0
        val window = activity?.window ?: run { log("reset : activité morte, le mode part avec la fenêtre"); return }
        val params = window.attributes
        params.preferredDisplayModeId = 0
        window.attributes = params
        log("reset → mode par défaut de l'écran")
    }

    // --- Internes ---

    private fun vote(surface: Surface?) {
        if (surface == null || !surface.isValid) return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                surface.setFrameRate(contentFps, Surface.FRAME_RATE_COMPATIBILITY_FIXED_SOURCE, Surface.CHANGE_FRAME_RATE_ONLY_IF_SEAMLESS)
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                surface.setFrameRate(contentFps, Surface.FRAME_RATE_COMPATIBILITY_FIXED_SOURCE)
            }
            votedSurface = surface
            log("setFrameRate($contentFps, FIXED_SOURCE) sur la surface vidéo")
        } catch (e: Exception) {
            Log.w(TAG, "setFrameRate($contentFps) : ${e.message}")
        }
    }

    private fun clearVote() {
        val surface = votedSurface ?: return
        votedSurface = null
        if (!surface.isValid) return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) surface.clearFrameRate()
            else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) surface.setFrameRate(0f, Surface.FRAME_RATE_COMPATIBILITY_DEFAULT)
            log("vote effacé")
        } catch (e: Exception) {
            Log.w(TAG, "clearFrameRate : ${e.message}")
        }
    }

    private fun applyWindowMode(activity: Activity?) {
        val window = activity?.window ?: return
        val display = window.decorView.display ?: return
        val current = display.mode
        val target = pickMode(display, contentFps)
        if (target == null) {
            log("fps=$contentFps : aucun mode exact ni multiple en ${current.physicalWidth}×${current.physicalHeight} → rien")
            return
        }
        if (target.modeId == current.modeId) { log("fps=$contentFps : déjà en ${current.refreshRate} Hz"); return }
        val params = window.attributes
        params.preferredDisplayModeId = target.modeId
        window.attributes = params
        appliedModeId = target.modeId
        log("fps=$contentFps → mode ${target.modeId} ${target.refreshRate} Hz (depuis ${current.refreshRate} Hz)")
    }

    /**
     * Même règle que l'Android TV : même définition physique ; exact (± 0,05 Hz)
     * d'abord, puis le plus petit multiple entier k = 2..5 (23,976 → 48 | 72 |
     * 96 | 120 ; 25 → 50 | 75 | 100 ; 29,97 → 60 | 90 | 120) ; sinon rien.
     */
    private fun pickMode(display: Display, fps: Float): Display.Mode? {
        val current = display.mode
        val candidates = display.supportedModes.filter {
            it.physicalWidth == current.physicalWidth && it.physicalHeight == current.physicalHeight
        }
        candidates.filter { abs(it.refreshRate - fps) <= EXACT_TOLERANCE }
            .minByOrNull { abs(it.refreshRate - fps) }?.let { return it }
        for (k in 2..5) {
            candidates.filter { abs(it.refreshRate - k * fps) <= EXACT_TOLERANCE * k }
                .minByOrNull { abs(it.refreshRate - k * fps) }?.let { return it }
        }
        return null
    }

    private fun log(message: String) = Log.i(TAG, message)
}
