package com.tentacletv.render

import android.animation.ObjectAnimator
import android.view.View
import android.view.ViewGroup
import android.view.animation.PathInterpolator
import com.facebook.react.uimanager.util.ReactFindViewUtil
import java.util.WeakHashMap

/**
 * Le RECUL des voisines d'une carte focalisée, joué par la piste native
 * (`TentacleCullTrack`, Android TV) — la règle de tv-core (`render/rowRecede`)
 * et les jetons du thème, reçus en props : les autres cartes de la rangée
 * passent à `opacity` en `durationMs`, sur la courbe `curve` ; le focus parti
 * de la rangée, elles reviennent après `releaseMs`.
 *
 * Reanimated l'animait carte par carte : à chaque pas vertical, une vingtaine
 * de cartes, chacune évaluée, convertie et appliquée par le gestionnaire de
 * vues à chaque image — ~4 ms de fil d'interface par image sur la Shield. Ici,
 * un `ObjectAnimator` par cadre ne pose que son opacité (`setAlpha`), et une
 * carte HORS de l'écran (`DrawCulling`) prend sa valeur d'un coup — elle n'est
 * pas dessinée. Interrompu (un pas de plus avant la fin), le recul repart de
 * l'opacité où il en est, comme celui de Reanimated. On anime le cadre de la
 * carte (sa vue `nativeID` = `FRAME_ID`, `CardFrame`), comme son style animé.
 */
internal class RowRecede(
    private val track: ViewGroup,
) {
    var opacity = 0.72f
    var durationMs = 260L
    var releaseMs = 32L
    var curve: PathInterpolator = PathInterpolator(0.45f, 0f, 0.25f, 1f)

    private var focused = -1
    private val frames = WeakHashMap<View, View>()
    private val targets = WeakHashMap<View, Float>()
    private val running = WeakHashMap<View, ObjectAnimator>()
    private val release = Runnable { if (!hasFocusInside()) setFocused(-1) }

    private fun hasFocusInside(): Boolean = track.findFocus() != null

    /** Un élément de la carte `child` (enfant direct de la piste) prend le focus. */
    fun onChildFocused(child: View) {
        track.removeCallbacks(release)
        setFocused(track.indexOfChild(child))
    }

    /** Le focus de la fenêtre a bougé : sorti de la piste, les voisines reviennent un instant après. */
    fun onFocusMoved() {
        if (focused >= 0 && !hasFocusInside()) {
            track.removeCallbacks(release)
            track.postDelayed(release, releaseMs)
        }
    }

    /** Une carte arrive (montage échelonné) : elle prend d'emblée l'état de la rangée. */
    fun onChildAdded() = apply(animate = false)

    fun reset() {
        track.removeCallbacks(release)
        running.values.forEach { it.cancel() }
        running.clear()
        focused = -1
    }

    private fun setFocused(index: Int) {
        if (index == focused) return
        focused = index
        apply(animate = true)
    }

    private fun apply(animate: Boolean) {
        for (index in 0 until track.childCount) {
            val child = track.getChildAt(index)
            val frame = frameOf(child) ?: continue
            val target = if (focused >= 0 && index != focused) opacity else 1f
            if (targets[frame] == target) continue
            targets[frame] = target
            running.remove(frame)?.cancel()
            if (!animate || DrawCulling.isFar(child)) {
                frame.alpha = target
            } else {
                running[frame] =
                    ObjectAnimator.ofFloat(frame, View.ALPHA, frame.alpha, target).apply {
                        duration = durationMs
                        interpolator = curve
                        start()
                    }
            }
        }
    }

    private fun frameOf(child: View): View? {
        frames[child]?.let { if (it.isAttachedToWindow && isInside(it, child)) return it }
        val frame = ReactFindViewUtil.findView(child, FRAME_ID) ?: return null
        frames[child] = frame
        return frame
    }

    private fun isInside(view: View, ancestor: View): Boolean {
        var v: Any? = view
        while (v is View) {
            if (v === ancestor) return true
            v = v.parent
        }
        return false
    }

    companion object {
        /** Le `nativeID` du cadre d'une carte de rangée (`CardFrame`, `RECEDE_FRAME_ID`). */
        const val FRAME_ID = "tentacle:recede-frame"
    }
}
