package com.tentacletv.perf

import android.os.SystemClock
import android.util.Log
import android.view.Choreographer

/**
 * Les BLOCAGES du fil UI, pour toutes les fenêtres du processus : FrameMetrics
 * ne voit que la fenêtre de l'activité, et une `Modal` (le grand panneau, les
 * feuilles) est une fenêtre à part — mais elles partagent le fil UI et son
 * Choreographer. Tant que le mode de mesure est allumé, un rappel par vsync
 * mesure l'écart entre deux images : au-delà de deux intervalles, le fil
 * était pris (un montage, la création d'une fenêtre) et toute animation à
 * l'écran a sauté des images — écrit dans le journal avec le dernier geste.
 *
 * Seulement en mode de mesure (`PerfConfig`) : un rappel par vsync, c'est le
 * fil UI réveillé 60 fois par seconde.
 */
internal object UiStallMonitor : Choreographer.FrameCallback {
  private const val TAG = "TentaclePerf"
  /** Un blocage en dessous de ce seuil n'est pas écrit (trois images). */
  private const val REPORT_MS = 48L

  private var intervalNs = 16_666_667L
  private var lastFrameNs = 0L
  private var started = false
  @Volatile var lastLabel: String = "(aucun geste)"

  /** Sur le fil UI. */
  fun start(refreshRate: Float) {
    if (refreshRate > 1f) intervalNs = (1e9 / refreshRate).toLong()
    if (started) return
    started = true
    lastFrameNs = 0L
    Choreographer.getInstance().postFrameCallback(this)
  }

  /** Sur le fil UI : l'app passe à l'arrière-plan (plus d'image attendue). */
  fun stop() {
    if (!started) return
    started = false
    Choreographer.getInstance().removeFrameCallback(this)
  }

  override fun doFrame(frameTimeNanos: Long) {
    if (!started) return
    val previous = lastFrameNs
    lastFrameNs = frameTimeNanos
    if (previous != 0L) {
      val gapNs = frameTimeNanos - previous
      val gapMs = gapNs / 1_000_000
      if (gapNs > 2 * intervalNs && gapMs >= REPORT_MS) {
        val skipped = gapNs / intervalNs - 1
        Log.i(TAG, "[perf] fil UI bloqué $gapMs ms ($skipped images sautées) — après « $lastLabel »")
        Log.i(TAG, "[perf-json] {\"stallMs\":$gapMs,\"skipped\":$skipped,\"after\":\"${lastLabel.replace("\"", "'")}\",\"at\":${SystemClock.uptimeMillis()}}")
      }
    }
    Choreographer.getInstance().postFrameCallback(this)
  }
}
