package com.tentacletv.perf

import android.os.Handler
import android.os.HandlerThread
import android.os.Process
import android.os.SystemClock
import android.util.Log
import android.view.FrameMetrics
import android.view.Window
import java.lang.ref.WeakReference

/**
 * Le relevé des images du mode de mesure (`PerfConfig`) : chaque image que
 * la fenêtre de l'app dessine (`Window.OnFrameMetricsAvailableListener`, sur
 * un fil à part), regroupée en FENÊTRES (`FrameWindow`) — une fenêtre se ferme
 * après 300 ms sans image, et s'écrit dans le journal (`TentaclePerf`).
 *
 * Les MARQUES viennent du JS (`platform/perf`) : le geste (« tenu:bas »),
 * l'écran (« écran:Home »), un écran prêt (« prêt:accueil »). Une marque
 * reçue hors d'une fenêtre nomme la suivante ; les validations React aussi
 * (elles précèdent les images qu'elles provoquent).
 *
 * Tout se passe sur le fil « TentaclePerf » ; rien n'existe tant que le mode
 * est éteint (créé au premier appel).
 */
internal object FrameWindows {
  private const val TAG = "TentaclePerf"
  /** Le repos qui ferme une fenêtre. */
  private const val IDLE_CLOSE_MS = 300L

  private val handler: Handler by lazy { Handler(HandlerThread("TentaclePerf").also { it.start() }.looper) }

  private var intervalNs = 16_666_667L
  private var window: FrameWindow? = null
  private val pendingLabels = LinkedHashMap<String, Int>()
  private val pendingReact = IntArray(4)
  private var screenMarkAtMs = 0L
  private var screenName: String? = null
  private var startupReported = false
  private var attached: WeakReference<Window>? = null

  private val closer = Runnable { close() }

  /** La mesure de `FrameMetrics` de chaque phase, dans l'ordre de `FrameWindow.Phase`. */
  private val METRIC_OF = intArrayOf(
    FrameMetrics.TOTAL_DURATION, FrameMetrics.UNKNOWN_DELAY_DURATION, FrameMetrics.INPUT_HANDLING_DURATION,
    FrameMetrics.ANIMATION_DURATION, FrameMetrics.LAYOUT_MEASURE_DURATION, FrameMetrics.DRAW_DURATION,
    FrameMetrics.SYNC_DURATION, FrameMetrics.COMMAND_ISSUE_DURATION, FrameMetrics.SWAP_BUFFERS_DURATION,
  )

  private val listener = Window.OnFrameMetricsAvailableListener { _, metrics, dropCount -> onFrame(metrics, dropCount) }

  /** Écoute les images de `target` (sur le fil principal). */
  fun attach(target: Window, refreshRate: Float) {
    if (attached?.get() === target) return
    detach()
    if (refreshRate > 1f) intervalNs = (1e9 / refreshRate).toLong()
    target.addOnFrameMetricsAvailableListener(listener, handler)
    attached = WeakReference(target)
    Log.i(TAG, "[perf] mode de mesure allumé — affichage à ${"%.2f".format(refreshRate)} Hz, image ratée au-delà de ${"%.1f".format(intervalNs / 1e6)} ms")
  }

  fun detach() {
    val previous = attached?.get() ?: return
    try {
      previous.removeOnFrameMetricsAvailableListener(listener)
    } catch (_: IllegalArgumentException) {
      // déjà retiré avec la fenêtre
    }
    attached = null
  }

  fun mark(label: String) {
    val at = SystemClock.uptimeMillis()
    UiStallMonitor.lastLabel = label
    handler.post {
      reportReady(label, at)
      // L'écran courant nomme chaque fenêtre qui s'ouvre ; un changement
      // d'écran PENDANT une fenêtre (une transition) s'y inscrit.
      val screen = label.startsWith("écran:")
      val open = window
      if (open != null) open.label(if (screen) "→ $label" else label)
      else if (!screen) pendingLabels[label] = (pendingLabels[label] ?: 0) + 1
    }
  }

  fun commit(components: Int, mounts: Int, updates: Int) {
    handler.post {
      val open = window
      if (open != null) {
        open.react(components, mounts, updates)
      } else {
        pendingReact[0]++
        pendingReact[1] += components
        pendingReact[2] += mounts
        pendingReact[3] += updates
      }
    }
  }

  /** Un écran affiché (« écran:… ») ou prêt (« prêt:… ») : le temps du chargement. */
  private fun reportReady(label: String, atMs: Long) {
    if (label.startsWith("écran:")) {
      screenMarkAtMs = atMs
      screenName = label.removePrefix("écran:")
      return
    }
    if (!label.startsWith("prêt:")) return
    val what = label.removePrefix("prêt:")
    if (!startupReported) {
      startupReported = true
      Log.i(TAG, "[perf] démarrage — « $what » prêt ${atMs - Process.getStartUptimeMillis()} ms après le lancement du processus")
      Log.i(TAG, "[perf-json] {\"ready\":\"$what\",\"sinceProcessMs\":${atMs - Process.getStartUptimeMillis()}}")
    } else if (screenMarkAtMs > 0) {
      Log.i(TAG, "[perf] chargement — « $what » prêt ${atMs - screenMarkAtMs} ms après l'arrivée sur « $screenName »")
      Log.i(TAG, "[perf-json] {\"ready\":\"$what\",\"sinceScreenMs\":${atMs - screenMarkAtMs}}")
    }
  }

  private fun onFrame(metrics: FrameMetrics, dropCount: Int) {
    val now = SystemClock.uptimeMillis()
    val phases = LongArray(FrameWindow.Phase.values().size)
    for (phase in FrameWindow.Phase.values()) phases[phase.ordinal] = metrics.getMetric(METRIC_OF[phase.ordinal])
    val open = window ?: open(now)
    open.dropped += dropCount
    open.add(phases, now)
    handler.removeCallbacks(closer)
    handler.postDelayed(closer, IDLE_CLOSE_MS)
  }

  private fun open(now: Long): FrameWindow {
    val opened = FrameWindow(now, intervalNs)
    screenName?.let { opened.label("écran:$it") }
    for ((name, n) in pendingLabels) repeat(n) { opened.label(name) }
    pendingLabels.clear()
    if (pendingReact[0] > 0) {
      opened.commits += pendingReact[0]
      opened.components += pendingReact[1]
      opened.mounts += pendingReact[2]
      opened.updates += pendingReact[3]
      pendingReact.fill(0)
    }
    window = opened
    return opened
  }

  private fun close() {
    val done = window ?: return
    window = null
    Log.i(TAG, done.describe())
    Log.i(TAG, done.json())
  }
}
