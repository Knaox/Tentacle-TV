package expo.modules.mpvplayer

import android.os.Build
import android.util.Log
import android.view.Surface

/**
 * Le vote de fréquence de la surface de mpv (Android ≥ 11).
 *
 * Réglage « Adapter la fréquence de l'écran » activé : JS demande la fréquence
 * la plus haute de l'écran (120 Hz), la même que la fenêtre
 * (`preferredDisplayModeId`, `DisplayModeBridge`) — mesuré sur ColorOS 14 :
 * toute vidéo y tombe à 60 Hz si personne ne demande rien. 0 veut dire « ne
 * rien demander » (réglage coupé : le téléphone décide). `CHANGE_FRAME_RATE_ALWAYS`
 * (Android ≥ 12) : un téléphone change de fréquence sans écran noir, et le
 * lecteur n'est jamais sur un téléviseur HDMI (app TV à part).
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
