package com.tentacletv

import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.KeyEvent
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.modules.core.DeviceEventManagerModule

class MainActivity : ReactActivity() {

  companion object {
    private const val TAG = "MainActivity"
    /** Plus aucun down OK pendant cette fenêtre → le maintien est terminé.
     *  Les répétitions réelles arrivent à ~30 ms (clavier hôte d'émulateur) :
     *  200 ms couvre large, tout en gardant la fin de maintien réactive. */
    private const val HOLD_END_SILENCE_MS = 200L
    private val CENTER_KEYCODES = setOf(
      KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_NUMPAD_ENTER,
    )
  }

  override fun getMainComponentName(): String = "TentacleTV"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  // ---------------------------------------------------------------------------
  // Coalesceur de MAINTIEN du bouton OK — certains canaux d'entrée (clavier
  // d'émulateur via qemu, télécommandes IR/CEC) livrent un maintien physique en
  // PAIRES down/up complètes en rafale : côté JS, la file du bridge se draine
  // avec des secondes de retard et la fin du maintien devient indétectable.
  // Ici (thread UI, zéro backlog) : premier down → "start" ; plus aucun down
  // pendant HOLD_END_SILENCE_MS → "end" + timestamp du dernier down (pour
  // recaler la position exacte du relâchement côté JS). Les événements ne sont
  // PAS consommés : navigation et press continuent normalement.
  // ---------------------------------------------------------------------------
  private val holdHandler = Handler(Looper.getMainLooper())
  private var holdActive = false
  private var lastCenterDownAt = 0L
  private val holdEndRunnable = Runnable {
    holdActive = false
    emitCenterHold("end")
  }

  private fun onCenterKey(event: KeyEvent) {
    if (event.action == KeyEvent.ACTION_DOWN) {
      lastCenterDownAt = System.currentTimeMillis()
      holdHandler.removeCallbacks(holdEndRunnable)
      if (!holdActive) {
        holdActive = true
        emitCenterHold("start")
      }
    } else if (event.action == KeyEvent.ACTION_UP) {
      holdHandler.removeCallbacks(holdEndRunnable)
      holdHandler.postDelayed(holdEndRunnable, HOLD_END_SILENCE_MS)
    }
  }

  private fun emitCenterHold(phase: String) {
    val ctx = (application as? ReactApplication)
      ?.reactNativeHost?.reactInstanceManager?.currentReactContext ?: return
    val payload = Arguments.createMap().apply {
      putString("phase", phase)
      putDouble("lastDownAt", lastCenterDownAt.toDouble())
    }
    try {
      ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("tntCenterHold", payload)
    } catch (e: Exception) {
      Log.w(TAG, "emitCenterHold failed", e)
    }
  }

  /**
   * Remap NVIDIA Shield remote key codes to standard DPAD events
   * so React Native TVOS focus system can handle them.
   */
  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    val remapped = when (event.keyCode) {
      // Shield remote sends BUTTON_A for center/OK press
      KeyEvent.KEYCODE_BUTTON_A -> KeyEvent(event.action, KeyEvent.KEYCODE_DPAD_CENTER)
      // Shield gamepad B button → back
      KeyEvent.KEYCODE_BUTTON_B -> KeyEvent(event.action, KeyEvent.KEYCODE_BACK)
      // Media FF/REW keys (Shield, Mi Box remotes) → D-pad for seek handling
      KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> KeyEvent(event.action, KeyEvent.KEYCODE_DPAD_RIGHT)
      KeyEvent.KEYCODE_MEDIA_REWIND -> KeyEvent(event.action, KeyEvent.KEYCODE_DPAD_LEFT)
      else -> null
    }
    val effective = remapped ?: event
    if (effective.keyCode in CENTER_KEYCODES) {
      onCenterKey(effective)
    }
    return super.dispatchKeyEvent(effective)
  }
}
