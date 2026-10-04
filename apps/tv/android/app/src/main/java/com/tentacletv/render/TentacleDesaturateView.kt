package com.tentacletv.render

import android.content.Context
import android.graphics.BlendMode
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.os.Build
import android.view.View
import androidx.annotation.RequiresApi
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext

/**
 * Le pendant Android de `ios/TentacleTV/TentacleDesaturateView.m` : ce qui est
 * SOUS cette vue passe en niveaux de gris — l'affiche d'un titre absent
 * (`GreyscaleImage`), le gris dosé d'une demande en cours (`ArrivalArtwork`,
 * par l'opacité de la vue).
 *
 * Un rectangle gris dessiné en mode de fusion SATURATION (API 29) : le
 * résultat garde la teinte et la luminosité de ce qu'il couvre et prend la
 * saturation du gris — nulle. Le GPU compose ; rien ne se calcule sur le
 * processeur, ni au montage ni à chaque image.
 *
 * `hasOverlappingRendering` faux : l'opacité de la vue se multiplie dans son
 * unique dessin au lieu d'ouvrir un calque hors écran — le gris DOSÉ suit
 * l'opacité en ligne droite, comme sur tvOS. Avant Android 10, la vue n'est
 * pas annoncée (`supported`) : le JS garde son filtre SVG.
 */
@RequiresApi(Build.VERSION_CODES.Q)
class TentacleDesaturateView(context: Context) : View(context) {
  private val paint = Paint().apply {
    color = Color.GRAY
    blendMode = BlendMode.SATURATION
  }

  init {
    isFocusable = false
    importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
  }

  override fun hasOverlappingRendering(): Boolean = false

  override fun onDraw(canvas: Canvas) {
    canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)
  }
}

class TentacleDesaturateViewManager : SimpleViewManager<View>() {
  override fun getName(): String = "TentacleDesaturateView"

  override fun createViewInstance(reactContext: ThemedReactContext): View =
    if (SUPPORTED) TentacleDesaturateView(reactContext) else View(reactContext)

  override fun getExportedViewConstants(): Map<String, Any> = mapOf("supported" to SUPPORTED)

  companion object {
    val SUPPORTED: Boolean = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
  }
}
