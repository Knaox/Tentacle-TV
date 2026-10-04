package com.tentacletv.render

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/** Les vues de RENDU de la refonte sur Android TV (grisé, ombre portée, halo). */
class RenderPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> = emptyList()

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    listOf(TentacleDesaturateViewManager(), TentacleShadowViewManager(), TentacleHaloViewManager())
}
