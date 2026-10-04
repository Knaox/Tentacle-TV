package com.tentacletv.render

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.Shader
import android.view.View
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

/**
 * Une LUMIÈRE ronde ou elliptique (le fond vivant, la lueur derrière un
 * motif) : un dégradé radial d'une couleur, du cœur au bord, qui remplit
 * l'ellipse inscrite dans la vue. Le GPU l'évalue au dessin — aucun bitmap,
 * rien à rastériser quand la couleur change (le fond vivant change de lumière
 * à chaque pas du focus). Pendant Android des disques SVG de l'Apple TV
 * (`AmbientBackdrop`, `Glow`), mêmes arrêts.
 *
 * Le tramage (`DITHER_FLAG`) casse l'effet d'escalier d'une lumière faible
 * étalée sur une grande surface sombre.
 */
class TentacleGlowView(context: Context) : View(context) {
  var color = Color.TRANSPARENT
    set(value) { field = value; shader = null; invalidate() }
  var offsets: FloatArray = FloatArray(0)
    set(value) { field = value; shader = null; invalidate() }
  var alphas: FloatArray = FloatArray(0)
    set(value) { field = value; shader = null; invalidate() }

  private val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.DITHER_FLAG)
  private var shader: Shader? = null

  init {
    isFocusable = false
    importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
  }

  override fun hasOverlappingRendering(): Boolean = false

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    shader = null
  }

  private fun shaderOf(): Shader? {
    shader?.let { return it }
    if (offsets.size < 2 || offsets.size != alphas.size || width <= 0 || height <= 0) return null
    val base = Color.alpha(color) / 255f
    val colors = IntArray(offsets.size) {
      Color.argb((base * alphas[it] * 255f).toInt().coerceIn(0, 255), Color.red(color), Color.green(color), Color.blue(color))
    }
    // Un cercle unité, étiré en ellipse : le dégradé suit la forme de la vue.
    val gradient = RadialGradient(0f, 0f, 1f, colors, offsets, Shader.TileMode.CLAMP)
    gradient.setLocalMatrix(Matrix().apply { setScale(width / 2f, height / 2f); postTranslate(width / 2f, height / 2f) })
    shader = gradient
    return gradient
  }

  override fun onDraw(canvas: Canvas) {
    paint.shader = shaderOf() ?: return
    canvas.drawOval(0f, 0f, width.toFloat(), height.toFloat(), paint)
  }
}

class TentacleGlowViewManager : SimpleViewManager<TentacleGlowView>() {
  override fun getName(): String = "TentacleGlowView"

  override fun createViewInstance(reactContext: ThemedReactContext): TentacleGlowView = TentacleGlowView(reactContext)

  @ReactProp(name = "glowColor", customType = "Color", defaultInt = Color.TRANSPARENT)
  fun setGlowColor(view: TentacleGlowView, color: Int) { view.color = color }

  /** Les positions des arrêts, du cœur (0) au bord (1). */
  @ReactProp(name = "glowOffsets")
  fun setGlowOffsets(view: TentacleGlowView, offsets: ReadableArray?) { view.offsets = floats(offsets) }

  /** L'opacité de la couleur à chaque arrêt. */
  @ReactProp(name = "glowAlphas")
  fun setGlowAlphas(view: TentacleGlowView, alphas: ReadableArray?) { view.alphas = floats(alphas) }

  private fun floats(array: ReadableArray?): FloatArray =
    if (array == null) FloatArray(0) else FloatArray(array.size()) { array.getDouble(it).toFloat() }
}
