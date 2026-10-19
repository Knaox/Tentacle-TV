package com.tentacletv.render

import android.content.Context
import android.graphics.Outline
import android.view.View
import android.view.ViewOutlineProvider
import com.facebook.react.uimanager.PixelUtil
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.views.view.ReactViewGroup
import com.facebook.react.views.view.ReactViewManager

/**
 * Une vue qui rogne tout ce qu'elle contient en RECTANGLE ARRONDI, par son
 * contour (`clipToOutline`) : le GPU découpe son nœud de rendu entier, enfants
 * natifs compris, lissé, transformations des parents comprises.
 *
 * Pourquoi : sur Android (React Native 0.80, ancienne architecture),
 * `overflow: "hidden"` + `borderRadius` rogne ses enfants en RECTANGLE dans
 * l'ouverture du démarrage — le cadre et l'écran du poulpe sortaient carrés
 * (relevé de Damien du 19/10, revu à l'émulateur) ; un dégradé natif
 * (`LinearGradient`) y échappe aussi (lot A2). La vue JS
 * `redesign/render/RoundClip` la pose sur Android, une vue arrondie ailleurs.
 *
 * `cornerRadius` (points) ; `clip` faux : plus aucun rognage (l'écran arrivé).
 */
class TentacleRoundClipView(context: Context) : ReactViewGroup(context) {
  private var radiusPx = 0f
  private var clipping = true

  init {
    outlineProvider = object : ViewOutlineProvider() {
      override fun getOutline(view: View, outline: Outline) {
        outline.setRoundRect(0, 0, view.width, view.height, radiusPx)
      }
    }
    clipToOutline = true
  }

  fun setCornerRadius(points: Float) {
    radiusPx = PixelUtil.toPixelFromDIP(points)
    invalidateOutline()
  }

  fun setClip(enabled: Boolean) {
    if (clipping == enabled) return
    clipping = enabled
    clipToOutline = enabled
  }
}

class TentacleRoundClipManager : ReactViewManager() {
  override fun getName(): String = "TentacleRoundClip"

  override fun createViewInstance(context: ThemedReactContext): ReactViewGroup = TentacleRoundClipView(context)

  @ReactProp(name = "cornerRadius", defaultFloat = 0f)
  fun setCornerRadius(view: ReactViewGroup, radius: Float) {
    (view as? TentacleRoundClipView)?.setCornerRadius(radius)
  }

  @ReactProp(name = "clip", defaultBoolean = true)
  fun setClip(view: ReactViewGroup, enabled: Boolean) {
    (view as? TentacleRoundClipView)?.setClip(enabled)
  }
}
