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
      else -> null
    }
    return if (remapped != null) {
      super.dispatchKeyEvent(remapped)
    } else {
      super.dispatchKeyEvent(event)
    }
  }
}
