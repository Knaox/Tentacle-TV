package com.tentacletv.focus

import com.facebook.react.bridge.ReadableMap
import kotlin.math.max
import kotlin.math.min

/**
 * La CADENCE du focus sous une flèche maintenue — traduite de
 * `@tentacle-tv/tv-core` (`packages/tv-core/src/input/repeatPacing.ts`),
 * pas à pas ; ses tests sont le cahier des charges des deux.
 *
 * Native parce qu'une répétition se décide AVANT qu'Android ne déplace le
 * focus. Les constantes viennent de tv-core (prop `tvPacing` des sections,
 * posée par `platform/androidtv/focus/sectionNeighbors.ts`) : aucune ici.
 * Un seul focus dans l'application : un seul état.
 */
internal object RepeatPacer {
  class Spec(val startIntervalMs: Double, val minIntervalMs: Double, val rampMs: Double, val jitterMs: Double)

  class Decision(val accept: Boolean, val burst: Boolean, val intervalMs: Double)

  /** Sans constantes reçues : chaque répétition passe (le défaut d'Android). */
  @Volatile private var spec: Spec? = null

  private var key: Int? = null
  private var burstAt = 0L
  private var lastStepAt = 0L

  fun configure(map: ReadableMap?) {
    if (map == null) return
    fun num(name: String) = if (map.hasKey(name)) map.getDouble(name) else null
    val start = num("startIntervalMs") ?: return
    val floor = num("minIntervalMs") ?: return
    val ramp = num("rampMs") ?: return
    val jitter = num("jitterMs") ?: return
    spec = Spec(start, floor, ramp, jitter)
  }

  /** `repeatInterval` */
  private fun interval(spec: Spec, elapsedMs: Double): Double {
    val progress = if (spec.rampMs > 0) min(1.0, max(0.0, elapsedMs / spec.rampMs)) else 1.0
    return spec.startIntervalMs - (spec.startIntervalMs - spec.minIntervalMs) * progress
  }

  /** `paceArrow` : une flèche enfoncée (premier appui ou répétition), `now` en ms. */
  fun pace(keyCode: Int, repeat: Boolean, now: Long): Decision {
    val spec = this.spec
    if (!repeat || key != keyCode) {
      key = keyCode
      burstAt = 0L
      lastStepAt = now
      return Decision(accept = true, burst = false, intervalMs = 0.0)
    }
    if (spec == null) return Decision(accept = true, burst = true, intervalMs = (now - lastStepAt).toDouble())
    val elapsed = (now - lastStepAt).toDouble()
    val wanted = interval(spec, if (burstAt > 0) (now - burstAt).toDouble() else 0.0)
    if (elapsed < wanted - spec.jitterMs) return Decision(accept = false, burst = true, intervalMs = 0.0)
    if (burstAt == 0L) burstAt = now
    lastStepAt = now
    return Decision(accept = true, burst = true, intervalMs = elapsed)
  }

  /** `releaseArrow` : la flèche relâchée finit la rafale. Vrai si c'était la sienne. */
  fun release(keyCode: Int): Boolean {
    if (key != keyCode) return false
    key = null
    burstAt = 0L
    lastStepAt = 0L
    return true
  }
}
