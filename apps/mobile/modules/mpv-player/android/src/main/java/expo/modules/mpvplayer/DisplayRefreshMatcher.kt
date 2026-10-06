package expo.modules.mpvplayer

import android.os.Build
import android.util.Log
import android.view.Surface

/**
 * Le vote de cadence de la surface de mpv (Android ≥ 11).
 *
 * Un film à 23,976 i/s sur un écran à 60 Hz, c'est du pulldown 3:2 : une image
 * sur deux reste un tiers de plus à l'écran, et les travellings saccadent.
 * `Surface.setFrameRate(…, FIXED_SOURCE)` dit au compositeur la cadence EXACTE
 * de ce qu'on y dessine : il choisit lui-même le mode (24 → 120 Hz sur un écran
 * 60/90/120), en respectant les réglages de l'utilisateur et la batterie.
 * `CHANGE_FRAME_RATE_ALWAYS` (Android ≥ 12) : sur un téléphone, 60 ↔ 120 Hz
 * n'est pas toujours annoncé « sans coupure », et le seuil « sans coupure
 * seulement » laissait l'écran à 60 Hz. Un téléphone change de mode sans
 * écran noir ; le lecteur n'est jamais sur un téléviseur HDMI (app TV à part).
 * ExoPlayer (le lecteur système) vote ainsi sur SA
 * surface de lui-même ; mpv ne le fait pas, d'où ce module.
 *
 * Le mode de la FENÊTRE (`preferredDisplayModeId`), valable pour les deux
 * moteurs et pour tout Android, se décide en JS (`pickDisplayMode`, shared)
 * et s'applique par `DisplayModeBridge`. La cadence vient de JS (Jellyfin
 * `RealFrameRate`, exacte) ; 0 veut dire « ne rien demander ».
 */
class DisplayRefreshMatcher {

    companion object {
        private const val TAG = "TntDisplayRefresh"
    }

    /** La cadence demandée par JS (0 = rien). */
    private var contentFps = 0f
    /** La surface qui porte NOTRE vote — seule à effacer. */
    private var votedSurface: Surface? = null

    /** La cadence change (prop `frameRate`) : on vote, ou l'on efface le vote. */
    fun setContentFrameRate(surface: Surface?, fps: Float) {
        val next = if (fps.isFinite() && fps > 0f) fps else 0f
        if (next == contentFps) return
        contentFps = next
        if (next == 0f) clearVote() else vote(surface)
    }

    /** Une surface neuve (création, retour au premier plan) : le vote se repose dessus. */
    fun onSurfaceAvailable(surface: Surface?) {
        if (contentFps > 0f) vote(surface)
    }

    /** La surface meurt : son vote part avec elle, rien à effacer. */
    fun onSurfaceLost() {
        votedSurface = null
    }

    /** Sortie du lecteur : le vote effacé, l'écran rendu au système. */
    fun reset() {
        contentFps = 0f
        clearVote()
    }

    private fun vote(surface: Surface?) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return
        if (surface == null || !surface.isValid) return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                surface.setFrameRate(contentFps, Surface.FRAME_RATE_COMPATIBILITY_FIXED_SOURCE, Surface.CHANGE_FRAME_RATE_ALWAYS)
            } else {
                surface.setFrameRate(contentFps, Surface.FRAME_RATE_COMPATIBILITY_FIXED_SOURCE)
            }
            votedSurface = surface
            Log.i(TAG, "setFrameRate($contentFps, FIXED_SOURCE) sur la surface de mpv")
        } catch (e: Exception) {
            Log.w(TAG, "setFrameRate($contentFps) : ${e.message}")
        }
    }

    private fun clearVote() {
        val surface = votedSurface ?: return
        votedSurface = null
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R || !surface.isValid) return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) surface.clearFrameRate()
            else surface.setFrameRate(0f, Surface.FRAME_RATE_COMPATIBILITY_DEFAULT)
            Log.i(TAG, "vote de la surface effacé")
        } catch (e: Exception) {
            Log.w(TAG, "clearFrameRate : ${e.message}")
        }
    }
}
