package com.tentacletv.device

import android.util.Log
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Le module JS `TentacleDevice` (`platform/androidtv/renderTier` côté JS) :
 * les SIGNAUX de l'appareil, le micro-test gardé, le réglage et les propriétés
 * de débogage, en CONSTANTES — lues de façon synchrone au chargement du JS,
 * avant la première image. La décision est celle de tv-core
 * (`device/renderTier`) ; ce module lit, garde et recharge, il ne décide rien.
 *
 * Débogage (puis relancer l'app) :
 *   adb shell setprop debug.tentacle.lite 1|0              forcer Lite / normal
 *   adb shell setprop debug.tentacle.lite.signals netplus  simuler un appareil
 *   adb shell setprop debug.tentacle.lite.bench now|0      micro-test aussitôt / jamais
 *   adb logcat -s TentacleLite                             signaux, micro-test, décision
 */
class DeviceModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  private val store = RenderTierStore(reactContext)

  override fun getName(): String = "TentacleDevice"

  override fun getConstants(): Map<String, Any> {
    val snapshot = DeviceSignals.get(reactApplicationContext)
    val bench = store.bench
    scheduleBench(snapshot.signature)
    return compact(mapOf(
      "signals" to compact(snapshot.toMap()),
      "bench" to bench?.let { mapOf("score" to it.score, "version" to it.version, "durationMs" to it.durationMs.toDouble()) },
      "benchStale" to store.benchNeeded(snapshot.signature),
      "mode" to store.mode,
      "forcedTier" to SystemProps.get(PROP_FORCED),
      "signalOverride" to SystemProps.get(PROP_SIGNALS),
      "returnState" to store.takeReturnState(),
    ))
  }

  /** La décision prise par le JS : gardée (diagnostic) et journalisée. */
  @ReactMethod
  fun report(tier: String, reason: String, detail: String?) {
    store.saveDecision(tier, reason)
    Log.i(DeviceSignals.TAG, "niveau $tier ($reason${detail?.let { ", $it" } ?: ""}), réglage ${store.mode}")
  }

  /**
   * Le réglage change : il est écrit, l'écran à rouvrir avec lui, puis
   * l'interface est RECHARGÉE (un nouveau contexte React, la même activité) —
   * le niveau se relit avant la première image, comme au lancement. La
   * session vit dans le stockage de l'app : elle reste.
   */
  @ReactMethod
  fun setModeAndReload(mode: String, returnState: String?) {
    if (mode !in MODES) return
    store.saveModeForReload(mode, returnState)
    Log.i(DeviceSignals.TAG, "réglage → $mode : rechargement de l'interface")
    val app = reactApplicationContext.applicationContext as? ReactApplication ?: return
    UiThreadUtil.runOnUiThread { app.reactNativeHost.reactInstanceManager.recreateReactContextInBackground() }
  }

  /** Le micro-test, tout de suite, sans rien garder : pour le banc. */
  @ReactMethod
  fun benchmarkNow(promise: Promise) {
    Thread({
      val result = MicroBench.run()
      promise.resolve(Arguments.createMap().apply {
        putDouble("score", result.score)
        putDouble("durationMs", result.durationMs.toDouble())
        putInt("slices", result.slices)
        putInt("version", MicroBench.VERSION)
      })
    }, "TentacleMicroBench").start()
  }

  /**
   * Le micro-test, UNE fois par processus et seulement s'il manque pour cette
   * signature : après le premier affichage (`BENCH_DELAY_MS`), sur un fil à
   * part. Son score ne sert qu'au lancement SUIVANT — jamais de bascule en
   * pleine session.
   */
  private fun scheduleBench(signature: String) {
    val prop = SystemProps.get(PROP_BENCH)?.trim()
    if (prop == "0") return
    val now = prop == "now"
    if (!now && !store.benchNeeded(signature)) return
    if (!benchScheduled.compareAndSet(false, true)) return
    Thread({
      try {
        if (!now) Thread.sleep(BENCH_DELAY_MS)
        val result = MicroBench.run()
        store.saveBench(result, signature)
        Log.i(DeviceSignals.TAG, "micro-test v${MicroBench.VERSION} : score %.0f en ${result.durationMs} ms (${result.slices} tranches)".format(result.score))
      } catch (_: InterruptedException) {
        // Le processus s'en va : le micro-test se refera.
      }
    }, "TentacleMicroBench").apply { isDaemon = true }.start()
  }

  private companion object {
    const val PROP_FORCED = "debug.tentacle.lite"
    const val PROP_SIGNALS = "debug.tentacle.lite.signals"
    const val PROP_BENCH = "debug.tentacle.lite.bench"
    /** Après l'accueil chargé, même sur une box lente. */
    const val BENCH_DELAY_MS = 8_000L
    val MODES = setOf("auto", "on", "off")
    val benchScheduled = AtomicBoolean(false)

    /** Les valeurs nulles disparaissent : `undefined` côté JS, la forme de tv-core. */
    @Suppress("UNCHECKED_CAST")
    fun compact(map: Map<String, Any?>): Map<String, Any> = map.filterValues { it != null } as Map<String, Any>
  }
}
