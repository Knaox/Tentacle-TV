package com.tentacletv

import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.KeyEvent
import android.view.ViewConfiguration
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
  // PAIRES down/up complètes en rafale, d'autres (BT) en répétitions ACTION_DOWN,
  // d'autres enfin (BUTTON_A gamepad) sans aucune répétition.
  // Un maintien est ENGAGÉ quand : down répété (repeatCount > 0), nouveau down
  // pendant la fenêtre de silence post-up (pluie de paires), ou down tenu
  // getLongPressTimeout() sans up (canaux sans répétition).
  // Engagé : « start » est émis et TOUS les événements center suivants sont
  // CONSOMMÉS — le bridge ne voit que start/end (aucun backlog possible, l'arrêt
  // de la boucle JS est immédiat) et le up final n'atteint jamais la
  // Pressability (pas de press parasite au relâchement).
  // Un press court (down + up sans engagement) passe intégralement → press normal.
  // ---------------------------------------------------------------------------
  private val holdHandler = Handler(Looper.getMainLooper())
  private var holdActive = false   // touche OK « enfoncée » (jusqu'à 200 ms de silence)
  private var holdEngaged = false  // maintien confirmé : start émis, events consommés
  private var lastCenterEventAt = 0L // dernier down/up réel → point de relâchement (rollback JS)

  private val holdEngageRunnable = Runnable {
    if (holdActive && !holdEngaged) {
      holdEngaged = true
      emitCenterHold("start")
    }
  }
  private val holdEndRunnable = Runnable {
    holdActive = false
    if (holdEngaged) {
      holdEngaged = false
      emitCenterHold("end")
    }
  }

  /** @return true si l'événement doit être consommé (maintien engagé). */
  private fun onCenterKey(event: KeyEvent): Boolean {
    lastCenterEventAt = System.currentTimeMillis()
    if (event.action == KeyEvent.ACTION_DOWN) {
      holdHandler.removeCallbacks(holdEndRunnable)
      // Répétition matérielle OU down pendant la fenêtre de silence (pluie de paires).
      val engage = event.repeatCount > 0 || holdActive
      if (!holdActive) {
        holdActive = true
        holdHandler.postDelayed(holdEngageRunnable, ViewConfiguration.getLongPressTimeout().toLong())
      }
      if (engage && !holdEngaged) {
        holdHandler.removeCallbacks(holdEngageRunnable)
        holdEngaged = true
        emitCenterHold("start")
      }
      return holdEngaged
    }
    if (event.action == KeyEvent.ACTION_UP) {
      holdHandler.removeCallbacks(holdEndRunnable)
      holdHandler.postDelayed(holdEndRunnable, HOLD_END_SILENCE_MS)
      // Press court : le up annule l'armement du maintien (le press JS part normalement).
      if (!holdEngaged) holdHandler.removeCallbacks(holdEngageRunnable)
      return holdEngaged // up final d'un maintien engagé : consommé → pas de press au relâchement
    }
    return holdEngaged
  }

  private fun emitCenterHold(phase: String) {
    val ctx = (application as? ReactApplication)
      ?.reactNativeHost?.reactInstanceManager?.currentReactContext ?: return
    val payload = Arguments.createMap().apply {
      putString("phase", phase)
      // Nom historique : côté JS c'est le point de RELÂCHEMENT réel (dernier
      // down OU up vu) — le rollback y recale la position figée.
      putDouble("lastDownAt", lastCenterEventAt.toDouble())
    }
    try {
      ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("tntCenterHold", payload)
    } catch (e: Exception) {
      Log.w(TAG, "emitCenterHold failed", e)
    }
  }

  /** Remap en préservant repeatCount : la détection d'engagement en dépend. */
  private fun remapKey(event: KeyEvent, keyCode: Int): KeyEvent = KeyEvent(
    event.downTime, event.eventTime, event.action, keyCode, event.repeatCount,
    event.metaState, event.deviceId, event.scanCode, event.flags, event.source,
  )

  /**
   * Remap NVIDIA Shield remote key codes to standard DPAD events
   * so React Native TVOS focus system can handle them.
   */
  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    val remapped = when (event.keyCode) {
      // Shield remote sends BUTTON_A for center/OK press
      KeyEvent.KEYCODE_BUTTON_A -> remapKey(event, KeyEvent.KEYCODE_DPAD_CENTER)
      // Shield gamepad B button → back
      KeyEvent.KEYCODE_BUTTON_B -> remapKey(event, KeyEvent.KEYCODE_BACK)
      // Media FF/REW keys (Shield, Mi Box remotes) → D-pad for seek handling
      KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> remapKey(event, KeyEvent.KEYCODE_DPAD_RIGHT)
      KeyEvent.KEYCODE_MEDIA_REWIND -> remapKey(event, KeyEvent.KEYCODE_DPAD_LEFT)
      else -> null
    }
    val effective = remapped ?: event
    if (effective.keyCode in CENTER_KEYCODES && onCenterKey(effective)) {
      return true // maintien engagé : consommé (le bridge ne voit que start/end)
    }
    return super.dispatchKeyEvent(effective)
  }
}
