package com.tentacletv.focus

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.uimanager.PixelUtil
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManager
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.views.view.ReactViewGroup
import com.facebook.react.views.view.ReactViewManager

/**
 * La vue `TentacleFocusSection` côté React Native : une `View` (toutes ses
 * props, `TVFocusGuideView` compris) et celles de la section — les mêmes noms
 * que sur Apple TV (`TentacleFocusSectionManager`, `TentacleFocusSection.m`),
 * plus `tvPacing`, la cadence d'une flèche maintenue (tv-core), propre aux
 * télécommandes qui répètent.
 */
class TentacleFocusSectionManager : ReactViewManager() {
  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): ReactViewGroup = TentacleFocusSection(context)

  @ReactProp(name = "revealMode")
  fun setRevealMode(view: TentacleFocusSection, mode: String?) {
    view.revealMode = mode ?: "none"
  }

  @ReactProp(name = "revealMargin", defaultFloat = 56f)
  fun setRevealMargin(view: TentacleFocusSection, margin: Float) {
    view.revealMarginPx = PixelUtil.toPixelFromDIP(margin)
  }

  @ReactProp(name = "revealTop", defaultFloat = 72f)
  fun setRevealTop(view: TentacleFocusSection, top: Float) {
    view.revealTopPx = PixelUtil.toPixelFromDIP(top)
  }

  @ReactProp(name = "revealResponse", defaultFloat = 0.5f)
  fun setRevealResponse(view: TentacleFocusSection, response: Float) {
    view.revealResponse = response
  }

  @ReactProp(name = "revealDamping", defaultFloat = 1f)
  fun setRevealDamping(view: TentacleFocusSection, damping: Float) {
    view.revealDamping = damping
  }

  @ReactProp(name = "lineList")
  fun setLineList(view: TentacleFocusSection, lineList: Boolean) {
    view.lineList = lineList
  }

  @ReactProp(name = "holdInside")
  fun setHoldInside(view: TentacleFocusSection, enabled: Boolean) {
    view.holdInside = enabled
  }

  @ReactProp(name = "tvNeighbors")
  fun setTvNeighbors(view: TentacleFocusSection, enabled: Boolean) {
    view.tvNeighbors = enabled
  }

  @ReactProp(name = "tvEntry", defaultInt = 0)
  fun setTvEntry(view: TentacleFocusSection, tag: Int) {
    view.tvEntry = if (tag > 0) tag else null
  }

  @ReactProp(name = "tvPacing")
  fun setTvPacing(view: TentacleFocusSection, pacing: ReadableMap?) {
    HoldPacer.configure(pacing)
  }

  companion object {
    const val NAME = "TentacleFocusSection"
  }
}

class TentacleFocusPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> = emptyList()

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    listOf(TentacleFocusSectionManager())
}
