package com.tentacletv

import android.view.KeyEvent
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "TentacleTV"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  /** Remap en préservant repeatCount : la détection long-press RN en dépend. */
  private fun remapKey(event: KeyEvent, keyCode: Int): KeyEvent = KeyEvent(
    event.downTime, event.eventTime, event.action, keyCode, event.repeatCount,
    event.metaState, event.deviceId, event.scanCode, event.flags, event.source,
  )

  /**
   * Remap NVIDIA Shield gamepad key codes to standard events so the React
   * Native TVOS focus system can handle them. Les touches media FF/RW ne sont
   * PLUS remappées en D-pad : react-native-tvos les émet telles quelles
   * ("fastForward"/"rewind") → mode scrub direct (useScrubController).
   */
  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    val remapped = when (event.keyCode) {
      // Shield remote sends BUTTON_A for center/OK press
      KeyEvent.KEYCODE_BUTTON_A -> remapKey(event, KeyEvent.KEYCODE_DPAD_CENTER)
      // Shield gamepad B button → back
      KeyEvent.KEYCODE_BUTTON_B -> remapKey(event, KeyEvent.KEYCODE_BACK)
      else -> null
    }
    return super.dispatchKeyEvent(remapped ?: event)
  }
}
