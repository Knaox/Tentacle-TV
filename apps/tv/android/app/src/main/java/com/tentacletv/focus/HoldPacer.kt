package com.tentacletv.focus

import android.os.SystemClock
import android.view.Choreographer
import android.view.View
import com.facebook.react.bridge.ReadableMap
import java.lang.ref.WeakReference
import kotlin.math.max
import kotlin.math.min

/**
 * La CADENCE du focus sous une flèche MAINTENUE — traduite de
 * `@tentacle-tv/tv-core` (`packages/tv-core/src/input/repeatPacing.ts` :
 * `holdRepeat`, `holdTick`, `holdRelease`), pas à pas ; ses tests sont le
 * cahier des charges des deux.
 *
 * La première répétition d'Android ouvre la tenue ; ensuite les pas tombent
 * sur l'horloge des images (Choreographer), à l'intervalle qui accélère, et
 * les répétitions sont absorbées — elles ne disent plus que « toujours
 * tenue ». Native parce qu'une répétition se décide AVANT qu'Android ne
 * déplace le focus. Les constantes viennent de tv-core (prop `tvPacing` des
 * sections, posée par `platform/androidtv/focus/sectionNeighbors.ts`) : aucune
 * ici ; sans elles, Android garde sa répétition. Un seul focus : un seul état.
 */
internal object HoldPacer : Choreographer.FrameCallback {
  private class Spec(val startIntervalMs: Double, val minIntervalMs: Double, val rampMs: Double, val silentReleaseMs: Double)

  @Volatile private var spec: Spec? = null

  private var key: Int? = null
  private var direction = View.FOCUS_DOWN
  private var root: WeakReference<View>? = null
  private var holdAt = 0L
  private var nextStepAt = 0.0
  private var lastRepeatAt = 0L

  fun configure(map: ReadableMap?) {
    if (map == null) return
    fun num(name: String) = if (map.hasKey(name)) map.getDouble(name) else null
    spec = Spec(
      num("startIntervalMs") ?: return,
      num("minIntervalMs") ?: return,
      num("rampMs") ?: return,
      num("silentReleaseMs") ?: return,
    )
  }

  /** `repeatInterval` */
  private fun interval(spec: Spec, elapsedMs: Double): Double {
    val progress = if (spec.rampMs > 0) min(1.0, max(0.0, elapsedMs / spec.rampMs)) else 1.0
    return spec.startIntervalMs - (spec.startIntervalMs - spec.minIntervalMs) * progress
  }

  /**
   * `holdRepeat` : une répétition de `keyCode`. Vrai : absorbée (la tenue fait
   * ses pas elle-même, le premier tout de suite) ; faux : pas de cadence
   * reçue, Android garde la main.
   */
  fun repeat(keyCode: Int, direction: Int, root: View): Boolean {
    spec ?: return false
    val now = SystemClock.uptimeMillis()
    if (key != keyCode) {
      key = keyCode
      this.direction = direction
      this.root = WeakReference(root)
      holdAt = now
      nextStepAt = now.toDouble()
      lastRepeatAt = now
      Choreographer.getInstance().removeFrameCallback(this)
      tick(now)
    } else {
      lastRepeatAt = now
    }
    return true
  }

  /** `holdRelease` : la flèche relâchée finit la tenue. Vrai si c'était la sienne. */
  fun release(keyCode: Int): Boolean {
    if (key != keyCode) return false
    cancel()
    return true
  }

  /** Un appui neuf (ou plus de section) : plus de tenue. */
  fun cancel() {
    key = null
    root = null
    Choreographer.getInstance().removeFrameCallback(this)
  }

  override fun doFrame(frameTimeNanos: Long) {
    tick(SystemClock.uptimeMillis())
  }

  /** `holdTick` : une image de la tenue. */
  private fun tick(now: Long) {
    val spec = this.spec
    val view = root?.get()
    if (spec == null || key == null || view == null || !view.isAttachedToWindow) return cancel()
    // Plus aucune répétition : le relâchement est parti ailleurs (le focus a quitté les sections).
    if (now - lastRepeatAt > spec.silentReleaseMs) {
      cancel()
      RevealFollower.settleAll()
      return
    }
    if (now >= nextStepAt) {
      val intervalMs = interval(spec, nextStepAt - holdAt)
      val scheduled = nextStepAt + intervalMs
      // En retard d'un intervalle entier : on repart d'ici, sans rattraper.
      nextStepAt = if (scheduled > now) scheduled else now + intervalMs
      if (!TentacleFocusSection.heldStep(view, direction, intervalMs)) return cancel()
    }
    Choreographer.getInstance().postFrameCallback(this)
  }
}
