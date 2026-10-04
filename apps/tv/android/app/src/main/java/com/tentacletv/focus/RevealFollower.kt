package com.tentacletv.focus

import android.animation.ValueAnimator
import android.view.Choreographer
import android.view.ViewGroup
import java.util.WeakHashMap
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sign
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Le MOUVEMENT d'une page (ScrollView verticale) ou d'une rangée (horizontale)
 * qui suit le focus — un seul par vue, à la place du saut d'Android :
 *
 * - un pas ISOLÉ : le ressort de la section (`TV_MOTION.spring.scroll`),
 *   repris en vol avec sa vitesse — `revealMotion.ts` (`springAt`,
 *   `springSettled`, `revealMove`), comme `TentacleRevealMotion.m` ;
 * - un pas de RAFALE (flèche maintenue) : de là où la vue est à la cible, à
 *   vitesse constante, en l'intervalle réel entre deux pas — `burstFollow.ts`
 *   (`burstSegmentMs`, `linearAt`) ; la rafale finie, le ressort reprend sans
 *   dépasser (`settleVelocity`).
 *
 * Un défilement qui n'est pas le sien (le `scrollTo` du JS, un doigt) l'arrête.
 * « Supprimer les animations » d'Android : la vue se pose.
 */
internal class RevealFollower private constructor(private val scroll: ViewGroup, private val horizontal: Boolean) :
  Choreographer.FrameCallback {

  private enum class Mode { IDLE, SPRING, LINEAR }

  private var mode = Mode.IDLE
  private var target = 0f
  private var startNanos = 0L
  // Ressort : écart et vitesse au départ ; segment : origine et durée.
  private var x0 = 0f
  private var v0 = 0f
  private var from = 0f
  private var durationMs = 0f
  private var response = 0.5f
  private var damping = 1f
  private var lastSet = Int.MIN_VALUE

  private fun position(): Int = if (horizontal) scroll.scrollX else scroll.scrollY

  private fun set(value: Float) {
    val px = value.roundToInt()
    lastSet = px
    if (horizontal) scroll.scrollTo(px, scroll.scrollY) else scroll.scrollTo(scroll.scrollX, px)
  }

  val moving: Boolean get() = mode != Mode.IDLE

  /** Là où la vue va (la cible d'un mouvement en cours), sinon là où elle est. */
  fun base(): Float = if (moving) target else position().toFloat()

  /** L'état du mouvement à `now` : position et vitesse (pixels par seconde). */
  private fun stateAt(now: Long): Pair<Float, Float> {
    val elapsed = (now - startNanos) / 1e6f
    return when (mode) {
      Mode.IDLE -> position().toFloat() to 0f
      Mode.LINEAR ->
        if (durationMs <= 0f || elapsed >= durationMs) target to 0f
        else (from + (target - from) * (elapsed / durationMs)) to ((target - from) * 1000f / durationMs)
      Mode.SPRING -> {
        val (x, v) = springAt(elapsed / 1000f, x0, v0)
        (target + x) to v
      }
    }
  }

  /** `springAt` (revealMotion.ts) : critique à amortissement 1, sinon sous-amorti. */
  private fun springAt(t: Float, x0: Float, v0: Float): Pair<Float, Float> {
    val omega = (2 * PI / response).toFloat()
    if (damping >= 0.999f) {
      val c = v0 + omega * x0
      val decay = exp(-omega * t)
      return decay * (x0 + c * t) to decay * (v0 - omega * c * t)
    }
    val a = damping * omega
    val b = omega * sqrt(1 - damping * damping)
    val bb = (v0 + a * x0) / b
    val decay = exp(-a * t)
    return decay * (x0 * cos(b * t) + bb * sin(b * t)) to decay * (v0 * cos(b * t) - (a * bb + b * x0) * sin(b * t))
  }

  /** Va à `to` : un pas isolé (`segmentMs` null) sur le ressort, ou un segment de rafale. */
  fun moveTo(to: Float, spring: Pair<Float, Float>, segmentMs: Float?) {
    val now = System.nanoTime()
    val (x, v) = stateAt(now)
    response = max(0.05f, spring.first)
    damping = min(1f, max(0.1f, spring.second))
    if (!ValueAnimator.areAnimatorsEnabled()) {
      stop()
      if (abs(to - position()) >= 0.5f) set(to)
      return
    }
    // `revealMove` : déjà là, ou déjà en route vers là.
    if (mode != Mode.IDLE && abs(to - target) < 0.5f) return
    if (mode == Mode.IDLE && abs(to - x) < 0.5f) return
    target = to
    startNanos = now
    if (segmentMs != null) {
      mode = Mode.LINEAR
      from = x
      durationMs = segmentMs
    } else {
      mode = Mode.SPRING
      x0 = x - to
      v0 = v
    }
    lastSet = position()
    Choreographer.getInstance().removeFrameCallback(this)
    Choreographer.getInstance().postFrameCallback(this)
  }

  /** La rafale finie : un segment en vol finit sur le ressort, sans dépasser (`settleVelocity`). */
  fun settle() {
    if (mode != Mode.LINEAR) return
    val now = System.nanoTime()
    val (x, v) = stateAt(now)
    val dx = x - target
    val omega = (2 * PI / response).toFloat()
    val towards = -sign(dx)
    mode = Mode.SPRING
    startNanos = now
    x0 = dx
    v0 = if (dx == 0f || sign(v) != towards) 0f else towards * min(abs(v), omega * abs(dx))
  }

  fun stop() {
    mode = Mode.IDLE
    Choreographer.getInstance().removeFrameCallback(this)
  }

  override fun doFrame(frameTimeNanos: Long) {
    if (mode == Mode.IDLE || !scroll.isAttachedToWindow) return stop()
    // Un défilement qui n'est pas le nôtre : on ne le dispute pas.
    if (lastSet != Int.MIN_VALUE && abs(position() - lastSet) > 1) return stop()
    val (x, v) = stateAt(max(frameTimeNanos, startNanos))
    val done = when (mode) {
      Mode.LINEAR -> x == target && v == 0f
      // `springSettled` : moins d'un demi-point de la cible, et lent.
      else -> abs(x - target) < 0.5f && abs(v) < 8f
    }
    set(if (done) target else x)
    if (done) {
      mode = Mode.IDLE
      return
    }
    Choreographer.getInstance().postFrameCallback(this)
  }

  companion object {
    private val vertical = WeakHashMap<ViewGroup, RevealFollower>()
    private val rows = WeakHashMap<ViewGroup, RevealFollower>()

    fun of(scroll: ViewGroup, horizontal: Boolean): RevealFollower {
      val map = if (horizontal) rows else vertical
      return map.getOrPut(scroll) { RevealFollower(scroll, horizontal) }
    }

    /** La rafale est finie : tout segment en vol finit sur le ressort. */
    fun settleAll() {
      for (follower in vertical.values) follower.settle()
      for (follower in rows.values) follower.settle()
    }
  }
}
