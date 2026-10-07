package com.tentacletv.device

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Rect
import android.os.Process
import android.os.SystemClock
import java.util.zip.CRC32

/**
 * Le MICRO-TEST de performance : une unité de travail fixe, faite de code DÉJÀ
 * COMPILÉ — un tri d'entiers (bibliothèque du système, compilée d'avance dans
 * l'image de démarrage), une somme CRC32 (zlib, natif) et le dessin d'une
 * image filtrée par Skia sur le processeur (le raster d'une interface). Le
 * code de l'app lui-même n'est qu'une boucle : au premier lancement il est
 * encore interprété (aucun profil compilé), et un test écrit en Kotlin pur
 * mesurait l'interpréteur, pas la machine (relevé : 1,5 unité/ms à
 * l'émulateur, 8 tranches de 31 ms au lieu de 8).
 *
 * L'unité se répète par tranches de ~8 ms pendant au plus `BUDGET_MS` ; le
 * score est le débit de la MEILLEURE tranche (unités par milliseconde) — une
 * tranche coupée par l'ordonnanceur ne compte pas : c'est la capacité qu'on
 * lit, pas la charge du moment. Hors du fil d'interface, une fois
 * (`DeviceModule`) ; tv-core juge (`liteBenchBelow`, barème de `VERSION`).
 * Changer l'unité, c'est changer de barème : `VERSION` + 1, ici ET dans
 * `RENDER_TIER_THRESHOLDS.benchVersion` (test miroir).
 */
internal object MicroBench {
  const val VERSION = 2
  const val BUDGET_MS = 250L
  private const val SLICE_MS = 8L
  private const val WARMUP_SLICES = 2

  data class Result(val score: Double, val durationMs: Long, val slices: Int)

  private class Work {
    val ints = IntArray(4096) { (it * 2654435761L).toInt() }
    val bytes = ByteArray(32 * 1024) { (it * 31).toByte() }
    val crc = CRC32()
    val source: Bitmap = Bitmap.createBitmap(256, 256, Bitmap.Config.ARGB_8888).apply {
      for (y in 0 until height step 16) for (x in 0 until width step 16) setPixel(x, y, 0xff8b5cf6.toInt() xor (x * y))
    }
    val target: Bitmap = Bitmap.createBitmap(192, 192, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(target)
    val paint = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)
    val dst = Rect(0, 0, 192, 192)

    fun unit(seed: Int): Int {
      val sorted = ints.copyOf()
      sorted[seed and 4095] = seed
      sorted.sort()
      crc.reset()
      crc.update(bytes)
      paint.alpha = 128 + (seed and 127)
      canvas.drawBitmap(source, null, dst, paint)
      return sorted[2048] xor crc.value.toInt()
    }

    fun recycle() {
      source.recycle()
      target.recycle()
    }
  }

  /** Bloquant : à appeler hors du fil d'interface. */
  fun run(): Result {
    Process.setThreadPriority(Process.THREAD_PRIORITY_DEFAULT)
    val start = SystemClock.elapsedRealtimeNanos()
    val deadline = start + BUDGET_MS * 1_000_000
    val work = Work()
    var best = 0.0
    var slices = 0
    var seed = 17
    // L'unité TYPIQUE (moyenne glissante) : on ne commence pas celle qui
    // finirait après l'échéance. Pas la plus longue — un seul ramasse-miettes
    // coupait alors chaque tranche à une unité (relevé : 2,8 au lieu de 8,5).
    var typical = 0L
    try {
      while (SystemClock.elapsedRealtimeNanos() + typical < deadline) {
        val sliceStart = SystemClock.elapsedRealtimeNanos()
        val sliceEnd = minOf(sliceStart + SLICE_MS * 1_000_000, deadline - typical)
        var units = 0
        var now = sliceStart
        while (now < sliceEnd || units == 0) {
          val before = now
          seed = work.unit(seed)
          units++
          now = SystemClock.elapsedRealtimeNanos()
          typical = if (typical == 0L) now - before else (typical * 7 + (now - before)) / 8
        }
        slices++
        val elapsedMs = (now - sliceStart) / 1_000_000.0
        if (slices > WARMUP_SLICES && elapsedMs > 0) best = maxOf(best, units / elapsedMs)
      }
    } finally {
      work.recycle()
    }
    return Result(best, (SystemClock.elapsedRealtimeNanos() - start) / 1_000_000, slices)
  }
}
