package expo.modules.mpvplayer

import android.app.Activity
import android.hardware.display.DisplayManager
import android.os.Build
import android.util.Log
import android.view.Display

/**
 * Le mode d'affichage de la FENÊTRE, pour les deux moteurs du lecteur : la
 * liste des modes de l'écran (pour `pickDisplayMode`, shared, qui décide), et
 * `preferredDisplayModeId` posé ou rendu. Un écran de téléphone change de mode
 * sans couper l'image ; le système garde le dernier mot (économie d'énergie,
 * « Affichage fluide » coupé, température) : c'est une préférence, pas un ordre.
 */
object DisplayModeBridge {
    private const val TAG = "TntDisplayRefresh"

    /** Le mode que NOUS avons posé (0 = rien) — seul cas où le rendre a un sens. */
    private var appliedModeId = 0

    /**
     * L'écran de l'activité : son mode courant, ses modes, et la préférence
     * système « Adapter la fréquence » (Android 12+ ; « always » avant).
     */
    fun snapshot(activity: Activity?): Map<String, Any?> {
        val display = activity?.window?.decorView?.display ?: return mapOf("sdk" to Build.VERSION.SDK_INT, "modes" to emptyList<Any>())
        val modes = display.supportedModes.map {
            mapOf("id" to it.modeId, "width" to it.physicalWidth, "height" to it.physicalHeight, "refreshRate" to it.refreshRate.toDouble())
        }
        // Les fréquences joignables SANS coupure depuis le mode courant (Android 12+).
        val seamless = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            display.mode.alternativeRefreshRates.map { it.toDouble() }
        } else null
        return mapOf(
            "sdk" to Build.VERSION.SDK_INT,
            "currentModeId" to display.mode.modeId,
            "modes" to modes,
            "seamlessRefreshRates" to seamless,
            "matchPreference" to matchPreference(activity),
        )
    }

    /** Pose le mode voulu (0 = rendre l'écran à son mode par défaut). À appeler sur le thread principal. */
    fun apply(activity: Activity?, modeId: Int) {
        val window = activity?.window ?: return
        if (modeId == 0 && appliedModeId == 0) return
        val params = window.attributes
        if (params.preferredDisplayModeId == modeId) { appliedModeId = modeId; return }
        params.preferredDisplayModeId = modeId
        window.attributes = params
        appliedModeId = modeId
        val display: Display? = window.decorView.display
        Log.i(TAG, if (modeId == 0) "fenêtre rendue au mode par défaut" else "fenêtre → mode $modeId (écran en ${display?.mode?.refreshRate} Hz)")
    }

    private fun matchPreference(activity: Activity): String {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return "always"
        val manager = activity.getSystemService(DisplayManager::class.java) ?: return "always"
        return when (manager.matchContentFrameRateUserPreference) {
            DisplayManager.MATCH_CONTENT_FRAMERATE_NEVER -> "never"
            DisplayManager.MATCH_CONTENT_FRAMERATE_SEAMLESSS_ONLY -> "seamless"
            else -> "always"
        }
    }
}
