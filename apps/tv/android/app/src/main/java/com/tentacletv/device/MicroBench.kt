package com.tentacletv.device

import android.os.Process
import android.os.SystemClock

/**
 * Le MICRO-TEST de performance : un travail court et fixe, mêlé comme celui
 * d'une interface (calcul entier sur un petit tableau, virgule flottante,
 * petites allocations, un tri), répété par tranches de ~8 ms pendant au plus
 * `BUDGET_MS`. Le score est le débit de la MEILLEURE tranche (unités par
 * milliseconde) : les premières chauffent le JIT, une tranche coupée par
 * l'ordonnanceur ne compte pas — c'est la capacité de la machine qu'on lit,
 * pas sa charge du moment.
 *
 * Il tourne HORS du fil d'interface, une fois (`DeviceModule`), et ne décide
 * rien : tv-core compare le score à son seuil (`liteBenchBelow`, barème de
 * `VERSION`). Changer le travail, c'est changer de barème : `VERSION` + 1,
 * ici ET dans `RENDER_TIER_THRESHOLDS.benchVersion` (test miroir).
 */
internal object MicroBench {
  const val VERSION = 1
  const val BUDGET_MS = 250L
  private const val SLICE_MS = 8L
  private const val WARMUP_SLICES = 3

  data class Result(val score: Double, val durationMs: Long, val slices: Int)

  private val ints = IntArray(2048) { it * 2654435761L.toInt() }
  private val doubles = DoubleArray(256) { it * 0.37 }
  @Volatile private var sink = 0

  /** Une unité de travail (~20 à 60 µs selon la machine). */
  private fun unit(seed: Int): Int {
    var h = seed
    for (i in ints.indices) {
      h = h * 31 + ints[i]
      ints[i] = h xor (h ushr 7)
    }
    var d = 0.0
    for (i in doubles.indices) {
      d += Math.sqrt(doubles[i] + i) * 1.0001
      doubles[i] = d % 97.0
    }
    val boxes = ArrayList<IntArray>(24)
    repeat(24) { boxes.add(IntArray(12) { k -> k + h }) }
    val sorted = ints.copyOf(192)
    sorted.sort()
    return h + d.toInt() + boxes[boxes.size - 1][3] + sorted[96]
  }

  /** Bloquant : à appeler hors du fil d'interface. */
  fun run(): Result {
    Process.setThreadPriority(Process.THREAD_PRIORITY_DEFAULT)
    val start = SystemClock.elapsedRealtimeNanos()
    val deadline = start + BUDGET_MS * 1_000_000
    var best = 0.0
    var slices = 0
    var seed = 17
    while (SystemClock.elapsedRealtimeNanos() < deadline) {
      val sliceStart = SystemClock.elapsedRealtimeNanos()
      val sliceEnd = minOf(sliceStart + SLICE_MS * 1_000_000, deadline)
      var units = 0
      var now = sliceStart
      while (now < sliceEnd) {
        seed = unit(seed)
        units++
        now = SystemClock.elapsedRealtimeNanos()
      }
      slices++
      val elapsedMs = (now - sliceStart) / 1_000_000.0
      if (slices > WARMUP_SLICES && elapsedMs > 0) best = maxOf(best, units / elapsedMs)
    }
    sink = seed
    return Result(best, (SystemClock.elapsedRealtimeNanos() - start) / 1_000_000, slices)
  }
}
