package com.tentacletv

import android.util.Log
import android.view.KeyEvent
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  companion object {
    private const val TAG = "MainActivity"
  }

  override fun getMainComponentName(): String = "TentacleTV"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  /**
   * Remap NVIDIA Shield remote key codes to standard DPAD events
   * so React Native TVOS focus system can handle them.
   */
  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    Log.d(TAG, "[KeyEvent] code=${event.keyCode} action=${event.action} name=${KeyEvent.keyCodeToString(event.keyCode)}")
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
    if (remapped != null) {
      Log.d(TAG, "[KeyEvent] REMAPPED → ${KeyEvent.keyCodeToString(remapped.keyCode)}")
    }
    return if (remapped != null) {
      super.dispatchKeyEvent(remapped)
    } else {
      super.dispatchKeyEvent(event)
    }
  }
}
