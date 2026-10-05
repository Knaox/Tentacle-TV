package com.tentacletv.perf

import java.util.Locale
import kotlin.math.ceil

/**
 * Une FENÊTRE de mesure : les images dessinées d'affilée (sans 300 ms de
 * repos entre deux), ce qui les a provoquées (les marques du JS : geste,
 * écran) et ce que React a validé pendant ce temps.
 *
 * Par image, les phases de `FrameMetrics` (`Phase`) :
 * - `total` : de la vsync visée à l'image rendue — au-delà d'un intervalle
 *   d'affichage (16,7 ms à 60 Hz), l'image est RATÉE ; au-delà de deux, GRAVE ;
 * - le fil UI : l'attente avant l'image (le fil était pris), l'entrée,
 *   l'animation (les opérations de React Native et de Reanimated), la mise en
 *   page, l'enregistrement du dessin ;
 * - le RenderThread : la synchronisation (dont l'envoi des textures), les
 *   commandes GPU, l'échange des tampons.
 */
internal class FrameWindow(val startedAtMs: Long, private val intervalNs: Long) {
  enum class Phase(val key: String) { TOTAL("total"), DELAY("delay"), INPUT("input"), ANIM("anim"), LAYOUT("layout"), DRAW("draw"), SYNC("sync"), ISSUE("issue"), SWAP("swap") }

  private val samples = ArrayList<LongArray>(128)
  /** Les images dont le travail PROCESSEUR (fil UI + synchronisation, sans
   *  le GPU) dépasse 2, 4, 8 ms et un intervalle : ce qui se transpose d'un
   *  appareil à l'autre — le processeur de l'émulateur va ~8 fois plus vite
   *  qu'un cœur de la Shield, 2 ms y valent un intervalle là-bas. */
  private val cpuLimitsNs = longArrayOf(2_000_000L, 4_000_000L, 8_000_000L, intervalNs)
  private val cpuOver = IntArray(cpuLimitsNs.size)
  private var janky = 0
  private var severe = 0
  var dropped = 0
  var lastFrameAtMs = startedAtMs
  val labels = LinkedHashMap<String, Int>()
  var commits = 0
  var components = 0
  var mounts = 0
  var updates = 0
  /** Les vues que Reanimated a mises à jour, et en combien d'images (son rappel par image). */
  var reaUpdates = 0
  var reaFlushes = 0

  val frames: Int get() = samples.size

  /** `phases` : une durée en nanosecondes par `Phase`, dans l'ordre. */
  fun add(phases: LongArray, atMs: Long) {
    samples.add(phases)
    val total = phases[Phase.TOTAL.ordinal]
    if (total > intervalNs) janky++
    if (total > 2 * intervalNs) severe++
    val cpu = ui(phases) + phases[Phase.SYNC.ordinal]
    for (i in cpuLimitsNs.indices) if (cpu > cpuLimitsNs[i]) cpuOver[i]++
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

  private fun series(pick: (LongArray) -> Long): List<Long> = samples.map(pick).sorted()

  private fun ui(s: LongArray) = s[Phase.DELAY.ordinal] + s[Phase.INPUT.ordinal] + s[Phase.ANIM.ordinal] + s[Phase.LAYOUT.ordinal] + s[Phase.DRAW.ordinal]

  private fun render(s: LongArray) = s[Phase.SYNC.ordinal] + s[Phase.ISSUE.ordinal] + s[Phase.SWAP.ordinal]

  /** Le centile `p` d'une série triée, en millisecondes. */
  private fun percentile(sorted: List<Long>, p: Double): Double {
    if (sorted.isEmpty()) return 0.0
    val index = (ceil(p * sorted.size).toInt() - 1).coerceIn(0, sorted.size - 1)
    return sorted[index] / 1e6
  }

  private fun labelText(): String =
    if (labels.isEmpty()) "(sans geste)" else labels.entries.joinToString(" + ") { (name, n) -> if (n > 1) "$name ×$n" else name }

  /** La ligne lisible du journal. */
  fun describe(): String {
    fun ms(value: Double) = String.format(Locale.FRANCE, "%.1f", value)
    val totals = series { it[Phase.TOTAL.ordinal] }
    val react = if (commits > 0) " · React : $commits validations, $components composants, $mounts vues créées, $updates mises à jour" else ""
    val rea = if (reaFlushes > 0) String.format(Locale.FRANCE, " · Reanimated : %d vues mises à jour en %d images (%.1f par image)", reaUpdates, reaFlushes, reaUpdates.toDouble() / reaFlushes) else ""
    val drops = if (dropped > 0) " ($dropped non relevées)" else ""
    val cpuJank = if (cpuOver[3] > 0) " (${cpuOver[3]} par le processeur)" else ""
    return "[perf] ${labelText()} — $frames images$drops, $janky ratée${if (janky > 1) "s" else ""}$cpuJank, $severe grave${if (severe > 1) "s" else ""}" +
      " · durée p50 ${ms(percentile(totals, 0.5))} · p95 ${ms(percentile(totals, 0.95))} · max ${ms(percentile(totals, 1.0))} ms" +
      " · fil UI p95 ${ms(percentile(series(::ui), 0.95))} (animations p95 ${ms(percentile(series { it[Phase.ANIM.ordinal] }, 0.95))})" +
      " · rendu p95 ${ms(percentile(series(::render), 0.95))} ms$react$rea"
  }

  /** La même mesure, détaillée, pour le banc (`apps/tv/harness/android-perf`). */
  fun json(): String {
    fun num(value: Double) = String.format(Locale.US, "%.2f", value)
    val out = StringBuilder("[perf-json] {\"labels\":{")
    out.append(labels.entries.joinToString(",") { (name, n) -> "\"${name.replace("\"", "'")}\":$n" })
    out.append("},\"frames\":$frames,\"dropped\":$dropped,\"janky\":$janky,\"severe\":$severe,\"durationMs\":${lastFrameAtMs - startedAtMs}")
    val all = Phase.values().map { phase -> phase.key to series { it[phase.ordinal] } } + listOf("ui" to series(::ui), "render" to series(::render))
    for ((key, sorted) in all) {
      out.append(",\"$key\":{\"p50\":${num(percentile(sorted, 0.5))},\"p95\":${num(percentile(sorted, 0.95))},\"max\":${num(percentile(sorted, 1.0))},\"sum\":${num(sorted.sum() / 1e6)}}")
    }
    out.append(",\"cpuOver\":{\"2\":${cpuOver[0]},\"4\":${cpuOver[1]},\"8\":${cpuOver[2]},\"interval\":${cpuOver[3]}}")
    out.append(",\"reaUpdates\":$reaUpdates,\"reaFlushes\":$reaFlushes")
    out.append(",\"commits\":$commits,\"components\":$components,\"mounts\":$mounts,\"updates\":$updates}")
    return out.toString()
  }
}
