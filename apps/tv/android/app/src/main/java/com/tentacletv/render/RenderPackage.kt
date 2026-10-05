package com.tentacletv.render

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.tentacletv.perf.PerfModule

/** Les vues de RENDU de la refonte sur Android TV (grisé, ombre portée, halo,
 *  lumière, indicateur d'activité, piste élaguée) et le mode de MESURE de ce
 *  rendu (`perf/`, éteint par défaut). */
class RenderPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> = listOf(PerfModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    listOf(TentacleDesaturateViewManager(), TentacleShadowViewManager(), TentacleHaloViewManager(), TentacleGlowViewManager(), TentacleSpinnerViewManager(), TentacleCullTrackManager())
}
