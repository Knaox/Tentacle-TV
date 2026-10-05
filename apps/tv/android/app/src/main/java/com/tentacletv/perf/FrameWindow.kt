package com.tentacletv.perf

import java.util.Locale
import kotlin.math.ceil

/**
 * Une FENÊTRE de mesure : les images dessinées d'affilée (sans 300 ms de
 * repos entre deux), ce qui les a provoquées (les marques du JS : geste,
 * écran) et ce que React a validé pendant ce temps.
 *
 * Par image, trois durées lues dans `FrameMetrics` :
 * - `total` : de la vsync visée à l'image rendue — au-delà d'un intervalle
 *   d'affichage (16,7 ms à 60 Hz), l'image est RATÉE ; au-delà de deux, GRAVE ;
 * - `ui` : le fil principal (attente, entrée, animation — les opérations de
 *   React Native et de Reanimated —, mise en page, enregistrement du dessin) ;
 * - `render` : le RenderThread (synchronisation et envois de textures,
 *   commandes GPU, échange des tampons).
 */
internal class FrameWindow(val startedAtMs: Long, private val intervalNs: Long) {
  private val totals = ArrayList<Long>(128)
  private val uis = ArrayList<Long>(128)
  private val anims = ArrayList<Long>(128)
  private val renders = ArrayList<Long>(128)
  private var janky = 0
  private var severe = 0
  var dropped = 0
  var lastFrameAtMs = startedAtMs
  val labels = LinkedHashMap<String, Int>()
  var commits = 0
  var components = 0
  var mounts = 0
  var updates = 0

  val frames: Int get() = totals.size

  fun add(totalNs: Long, uiNs: Long, animNs: Long, renderNs: Long, atMs: Long) {
    totals.add(totalNs)
    uis.add(uiNs)
    anims.add(animNs)
    renders.add(renderNs)
    if (totalNs > intervalNs) janky++
    if (totalNs > 2 * intervalNs) severe++
    lastFrameAtMs = atMs
  }

  fun label(name: String) {
    labels[name] = (labels[name] ?: 0) + 1
  }

  fun react(components: Int, mounts: Int, updates: Int) {
    commits++
    this.components += components
    this.mounts += mounts
    this.updates += updates
  }

  private fun percentile(values: List<Long>, p: Double): Double {
    if (values.isEmpty()) return 0.0
    val sorted = values.sorted()
    val index = (ceil(p * sorted.size).toInt() - 1).coerceIn(0, sorted.size - 1)
    return sorted[index] / 1e6
  }

  private fun labelText(): String =
    if (labels.isEmpty()) "(sans geste)" else labels.entries.joinToString(" + ") { (name, n) -> if (n > 1) "$name ×$n" else name }

  /** La ligne lisible du journal. */
  fun describe(): String {
    val fr = Locale.FRANCE
    fun ms(value: Double) = String.format(fr, "%.1f", value)
    val react = if (commits > 0) " · React : $commits validations, $components composants, $mounts vues créées, $updates mises à jour" else ""
    val drops = if (dropped > 0) " ($dropped non relevées)" else ""
    return "[perf] ${labelText()} — $frames images$drops, $janky ratée${if (janky > 1) "s" else ""}, $severe grave${if (severe > 1) "s" else ""}" +
      " · durée p50 ${ms(percentile(totals, 0.5))} · p95 ${ms(percentile(totals, 0.95))} · max ${ms(percentile(totals, 1.0))} ms" +
      " · fil UI p95 ${ms(percentile(uis, 0.95))} (animations p95 ${ms(percentile(anims, 0.95))}) · rendu p95 ${ms(percentile(renders, 0.95))} ms$react"
  }

  /** La même mesure, pour le banc (`apps/tv/harness/android-perf`). */
  fun json(): String {
    fun num(value: Double) = String.format(Locale.US, "%.2f", value)
    val labelJson = labels.entries.joinToString(",") { (name, n) -> "\"${name.replace("\"", "'")}\":$n" }
    return "[perf-json] {\"labels\":{$labelJson},\"frames\":$frames,\"dropped\":$dropped,\"janky\":$janky,\"severe\":$severe," +
      "\"durationMs\":${lastFrameAtMs - startedAtMs}," +
      "\"p50\":${num(percentile(totals, 0.5))},\"p95\":${num(percentile(totals, 0.95))},\"max\":${num(percentile(totals, 1.0))}," +
      "\"uiP50\":${num(percentile(uis, 0.5))},\"uiP95\":${num(percentile(uis, 0.95))},\"uiMax\":${num(percentile(uis, 1.0))}," +
      "\"animP95\":${num(percentile(anims, 0.95))},\"animMax\":${num(percentile(anims, 1.0))}," +
      "\"renderP50\":${num(percentile(renders, 0.5))},\"renderP95\":${num(percentile(renders, 0.95))},\"renderMax\":${num(percentile(renders, 1.0))}," +
      "\"commits\":$commits,\"components\":$components,\"mounts\":$mounts,\"updates\":$updates}"
  }
}
