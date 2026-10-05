package com.tentacletv.perf

import android.app.Activity
import android.os.Build
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

/**
 * Le module JS du mode de mesure (`TentaclePerf`, `platform/perf` côté JS).
 * Sa constante `enabled` dit au JS s'il doit mesurer ; éteint, le JS ne
 * l'appelle jamais et ce module ne pose rien (`PerfConfig`).
 */
class PerfModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), LifecycleEventListener {
  init {
    if (PerfConfig.enabled) {
      reactContext.addLifecycleEventListener(this)
      reactContext.currentActivity?.let(::watch)
    }
  }

  override fun getName(): String = "TentaclePerf"

  override fun getConstants(): Map<String, Any> = mapOf("enabled" to PerfConfig.enabled)

  /** Une marque : le geste, l'écran, un écran prêt (`FrameWindows`). */
  @ReactMethod
  fun mark(label: String) {
    if (PerfConfig.enabled) FrameWindows.mark(label)
  }

  /** Ce qu'une validation React a coûté (tv-core `countCommit`). */
  @ReactMethod
  fun commit(components: Int, mounts: Int, updates: Int) {
    if (PerfConfig.enabled) FrameWindows.commit(components, mounts, updates)
  }

  /** Ce que Reanimated a envoyé au natif depuis le dernier relevé : vues mises à jour, images. */
  @ReactMethod
  fun reanimated(updates: Int, flushes: Int) {
    if (PerfConfig.enabled) FrameWindows.reanimated(updates, flushes)
  }

  override fun onHostResume() {
    reactApplicationContext.currentActivity?.let(::watch)
  }

  override fun onHostPause() {
    UiThreadUtil.runOnUiThread { UiStallMonitor.stop() }
  }

  override fun onHostDestroy() {
    UiThreadUtil.runOnUiThread {
      FrameWindows.detach()
      UiStallMonitor.stop()
    }
  }

  private fun watch(activity: Activity) {
    UiThreadUtil.runOnUiThread {
      @Suppress("DEPRECATION")
      val rate = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) activity.display?.refreshRate ?: 60f else activity.windowManager.defaultDisplay.refreshRate
      FrameWindows.attach(activity.window, rate)
      UiStallMonitor.start(rate)
    }
  }
}
