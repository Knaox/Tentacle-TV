package com.tentacletv.exoplayer

import android.app.Activity
import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Display
import android.view.Surface
import android.view.SurfaceHolder
import android.view.SurfaceView
import kotlin.math.abs

/**
 * Cale la fréquence d'affichage du téléviseur sur la cadence du film.
 *
 * Un film à 23,976 i/s sur un panneau à 60 Hz, c'est du pulldown 3:2 et un
 * judder permanent. ExoPlayer sait demander une fréquence, mais il DEVINE la
 * cadence depuis des horodatages que Matroska arrondit à la milliseconde : il
 * demande 24,39 ou 23,81, jamais 23,976, et le mode choisi est faux. Ici la
 * cadence vient de Jellyfin (`RealFrameRate`), exacte.
 *
 * Deux mécanismes, complémentaires :
 *  - `preferredDisplayModeId` sur la fenêtre de l'activité : le vrai changement
 *    de mode (HDMI renégocié, 1 à 3 s d'écran noir), sur tout Android ≥ 6 ;
 *  - `Surface.setFrameRate(…, FIXED_SOURCE, ONLY_IF_SEAMLESS)` sur la surface
 *    vidéo : le raffinement SANS coupure (23,976 exact dans la famille du mode
 *    choisi), Android ≥ 11.
 * L'estimateur d'ExoPlayer est coupé par la vue (`VIDEO_CHANGE_FRAME_RATE_STRATEGY_OFF`)
 * pour qu'il ne repasse pas derrière avec sa valeur fausse.
 *
 * Deux pièges documentés chez jellyfin-androidtv, traités d'emblée :
 *  - #3114 : revenir au mode d'origine à l'arrêt (`reset`), sinon le lanceur
 *    reste saccadé en 24 Hz ;
 *  - #4067 : la renégociation HDMI rend transitoirement les capacités audio
 *    PCM seul. La bascule se fait donc AVANT la construction du lecteur, et
 *    on attend qu'elle soit effective (`onDisplayChanged`, plafond 1,5 s) ;
 *    la liste de codecs préférés suit par ailleurs le branchement (cf.
 *    `AudioCapabilitiesReceiver` dans la vue).
 *
 * Aucun repli « fréquence la plus proche » : pour 23,976 sur un panneau 50/60,
 * la plus proche est 50 Hz — pire que le pulldown qu'on a déjà. Sans mode
 * exact ni multiple, on ne change rien. Sur Android 12+, la préférence
 * système « Adapter la fréquence » est respectée (jamais → rien ; sans
 * coupure seulement → seulement une bascule seamless).
 */
class DisplayModeSwitcher(context: Context) {

    companion object {
        private const val TAG = "TntDisplayMode"
        /** Tolérance d'un mode « exact » (24 Hz vaut pour 23,976 : Δ 0,024). */
        private const val EXACT_TOLERANCE = 0.05f
        /** Plafond d'attente d'une bascule non seamless. */
        private const val SWITCH_CAP_MS = 1500L
    }

    private val displayManager = context.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
    private val mainHandler = Handler(Looper.getMainLooper())
    /** Le mode que NOUS avons écrit (0 = rien) — seul cas où `reset` a un sens. */
    private var appliedModeId = 0
    private var surfaceCallback: SurfaceHolder.Callback? = null
    private var attachedView: SurfaceView? = null

    /**
     * Cale l'affichage sur `fps` puis appelle `onReady` — SYNCHRONEMENT s'il n'y
     * a rien à faire (cadence inconnue, préférence système « jamais », mode déjà
     * bon, aucun mode candidat) : le comportement d'avant est alors conservé à
     * l'identique. À appeler sur le thread principal.
     */
    fun prepareFor(activity: Activity?, fps: Float, onReady: () -> Unit) {
        if (activity == null || fps <= 0f) { onReady(); return }
        val display = activity.window?.decorView?.display
            ?: displayManager.getDisplay(Display.DEFAULT_DISPLAY)
            ?: run { onReady(); return }
        val preference = userPreference()
        if (preference == DisplayManager.MATCH_CONTENT_FRAMERATE_NEVER) {
            log("fps=$fps : préférence système « jamais » → aucune bascule")
            onReady(); return
        }
        val current = display.mode
        val target = pickMode(display, fps)
        if (target == null) {
            log("fps=$fps : aucun mode exact ni multiple en ${current.physicalWidth}×${current.physicalHeight} → on ne change rien")
            onReady(); return
        }
        val seamless = isSeamless(current, target)
        if (preference == DisplayManager.MATCH_CONTENT_FRAMERATE_SEAMLESSS_ONLY && !seamless) {
            log("fps=$fps : ${target.refreshRate} Hz exigerait une coupure, préférence « sans coupure seulement » → rien")
            onReady(); return
        }
        if (target.modeId == current.modeId || abs(target.refreshRate - current.refreshRate) < 0.01f) {
            log("fps=$fps : déjà en ${current.refreshRate} Hz")
            onReady(); return
        }
        log("fps=$fps → mode ${target.modeId} ${target.refreshRate} Hz (depuis ${current.refreshRate} Hz, seamless=$seamless, préférence=$preference)")
        val params = activity.window.attributes
        params.preferredDisplayModeId = target.modeId
        activity.window.attributes = params
        appliedModeId = target.modeId
        if (seamless) { onReady(); return }
        awaitDisplayChange(display, target.refreshRate, onReady)
    }

    /**
     * Le raffinement sans coupure, dès que la surface vidéo existe : la cadence
     * EXACTE, en source fixe, seulement si le panneau sait la servir sans
     * renégocier. Sans effet là où `setFrameRate` n'existe pas (Android < 11).
     */
    fun attachSurface(surfaceView: SurfaceView?, fps: Float) {
        if (surfaceView == null || fps <= 0f || Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return
        detachSurface()
        val callback = object : SurfaceHolder.Callback {
            override fun surfaceCreated(holder: SurfaceHolder) = hint(holder.surface, fps)
            override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) = hint(holder.surface, fps)
            override fun surfaceDestroyed(holder: SurfaceHolder) {}
        }
        surfaceView.holder.addCallback(callback)
        surfaceCallback = callback
        attachedView = surfaceView
        val surface = surfaceView.holder.surface
        if (surface != null && surface.isValid) hint(surface, fps)
    }

    /** Piège #3114 : sans ça, le lanceur reste à 24 Hz après la lecture. */
    fun reset(activity: Activity?) {
        detachSurface()
        if (appliedModeId == 0) return
        appliedModeId = 0
        val window = activity?.window
        if (window == null) { log("reset : activité morte, le mode part avec la fenêtre"); return }
        val params = window.attributes
        params.preferredDisplayModeId = 0
        window.attributes = params
        log("reset → mode par défaut du panneau")
    }

    // --- Internes ---

    /** Préférence système Android 12+ ; avant, rien à lire → tout est permis. */
    private fun userPreference(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) displayManager.matchContentFrameRateUserPreference
        else DisplayManager.MATCH_CONTENT_FRAMERATE_ALWAYS

    private fun isSeamless(current: Display.Mode, target: Display.Mode): Boolean =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
            && current.alternativeRefreshRates.any { abs(it - target.refreshRate) < 0.01f }

    /**
     * Candidats de MÊME résolution physique (jamais de changement de définition :
     * un re-layout de la surface React, et un risque de recréation d'activité).
     * Palier 0 : exact (± 0,05 Hz) ; palier 1 : multiple entier k = 2..5, le plus
     * petit k d'abord (23,976 → 23,976 | 24 | 47,952 | 48 | 119,88 | 120 ;
     * 25 → 25 | 50 | 100 ; 29,97 → 29,97 | 30 | 59,94 | 60) ; sinon rien.
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

    /**
     * Attend que le panneau ait réellement basculé (`onDisplayChanged` avec la
     * fréquence cible), plafonné : un panneau dont la bascule ne s'observe pas ne
     * doit pas retenir la lecture. Désinscription UNIQUE — le listener et le
     * plafond font la course.
     */
    private fun awaitDisplayChange(display: Display, targetHz: Float, onReady: () -> Unit) {
        var finished = false
        val started = System.currentTimeMillis()
        lateinit var listener: DisplayManager.DisplayListener
        val finish: (String) -> Unit = { reason ->
            if (!finished) {
                finished = true
                displayManager.unregisterDisplayListener(listener)
                log("bascule $reason après ${System.currentTimeMillis() - started} ms (panneau à ${display.mode.refreshRate} Hz)")
                onReady()
            }
        }
        listener = object : DisplayManager.DisplayListener {
            override fun onDisplayAdded(displayId: Int) {}
            override fun onDisplayRemoved(displayId: Int) {}
            override fun onDisplayChanged(displayId: Int) {
                if (displayId == display.displayId && abs(display.mode.refreshRate - targetHz) < EXACT_TOLERANCE) {
                    finish("effective")
                }
            }
        }
        displayManager.registerDisplayListener(listener, mainHandler)
        mainHandler.postDelayed({ finish("non observée (plafond ${SWITCH_CAP_MS} ms)") }, SWITCH_CAP_MS)
    }

    private fun hint(surface: Surface?, fps: Float) {
        if (surface == null || !surface.isValid) return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                surface.setFrameRate(fps, Surface.FRAME_RATE_COMPATIBILITY_FIXED_SOURCE, Surface.CHANGE_FRAME_RATE_ONLY_IF_SEAMLESS)
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                surface.setFrameRate(fps, Surface.FRAME_RATE_COMPATIBILITY_FIXED_SOURCE)
            }
        } catch (e: Exception) {
            Log.w(TAG, "setFrameRate($fps) : ${e.message}")
        }
    }

    private fun detachSurface() {
        val callback = surfaceCallback
        val view = attachedView
        surfaceCallback = null
        attachedView = null
        if (callback == null || view == null) return
        view.holder.removeCallback(callback)
        val surface = view.holder.surface
        if (surface == null || !surface.isValid) return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) surface.clearFrameRate()
            else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) surface.setFrameRate(0f, Surface.FRAME_RATE_COMPATIBILITY_DEFAULT)
        } catch (e: Exception) {
            Log.w(TAG, "clearFrameRate : ${e.message}")
        }
    }

    private fun log(message: String) = Log.w(TAG, message)
}
