package com.tentacletv.render

import android.content.Context
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.view.View
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.uimanager.PixelUtil
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import kotlin.math.roundToInt

/**
 * Le halo d'une œuvre (`ArtworkHalo`) sur Android : le même dessin que le SVG
 * de l'Apple TV — un rectangle arrondi au dégradé de la marque, flouté —
 * sans rien flouter quand l'œuvre change.
 *
 * Le flou d'un dégradé lisse vaut le dégradé posé sur le flou de sa forme :
 * la FORME floutée est un masque alpha (`ShadowMasks`, calculé une fois par
 * géométrie et partagé par toutes les œuvres de même cadre), que le GPU
 * teinte à chaque dessin d'un `LinearGradient` — mêmes arrêts (0 · 0,3 ·
 * 0,62 · 1) et même direction ((0, 0) → (1, 0,2) dans le cadre du rectangle)
 * que le SVG. Le dessin est rogné à la région de filtre du SVG (−20 % / −30 %
 * autour du rectangle, 140 % × 160 %), comme sur Apple TV.
 *
 * La vue couvre tout le halo ; le rectangle est posé à `inset` de ses bords.
 */
class TentacleHaloView(context: Context) : View(context) {
  var colors: IntArray = IntArray(0)
    set(value) { field = value; shader = null; invalidate() }
  var blur = 0f
    set(value) { field = value; invalidate() }
  var inset = 0f
    set(value) { field = value; shader = null; invalidate() }
  var cornerRadius = 0f
    set(value) { field = value; invalidate() }

  private val paint = Paint(Paint.FILTER_BITMAP_FLAG)
  private val dst = RectF()
  private val region = RectF()
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

  private fun shaderFor(left: Float, top: Float, w: Float, h: Float): Shader? {
    if (colors.size < 3) return null
    shader?.let { return it }
    val (a, b, c) = colors
    val gradient = LinearGradient(0f, 0f, 1f, 0.2f, intArrayOf(a, b, c, c), floatArrayOf(0f, 0.3f, 0.62f, 1f), Shader.TileMode.CLAMP)
    gradient.setLocalMatrix(Matrix().apply { setScale(w, h); postTranslate(left, top) })
    shader = gradient
    return gradient
  }

  override fun onDraw(canvas: Canvas) {
    val left = inset
    val top = inset
    val w = width - 2 * inset
    val h = height - 2 * inset
    if (w <= 0f || h <= 0f) return
    paint.shader = shaderFor(left, top, w, h) ?: return
    val mask = ShadowMasks.get(w.roundToInt(), h.roundToInt(), cornerRadius, blur)
    val m = mask.margin
    dst.set(left - m, top - m, left + w + m, top + h + m)
    region.set(left - 0.2f * w, top - 0.3f * h, left + 1.2f * w, top + 1.3f * h)
    canvas.save()
    canvas.clipRect(region)
    canvas.drawBitmap(mask.bitmap, null, dst, paint)
    canvas.restore()
  }
}

class TentacleHaloViewManager : SimpleViewManager<TentacleHaloView>() {
  override fun getName(): String = "TentacleHaloView"

  override fun createViewInstance(reactContext: ThemedReactContext): TentacleHaloView = TentacleHaloView(reactContext)

  /** Les trois couleurs du dégradé, déjà converties par `processColor`. */
  @ReactProp(name = "haloColors")
  fun setHaloColors(view: TentacleHaloView, colors: ReadableArray?) {
    view.colors = if (colors == null) IntArray(0) else IntArray(colors.size()) { colors.getDouble(it).toLong().toInt() }
  }

  @ReactProp(name = "haloBlur", defaultFloat = 0f)
  fun setHaloBlur(view: TentacleHaloView, blur: Float) { view.blur = PixelUtil.toPixelFromDIP(blur) }

  @ReactProp(name = "haloInset", defaultFloat = 0f)
  fun setHaloInset(view: TentacleHaloView, inset: Float) { view.inset = PixelUtil.toPixelFromDIP(inset) }

  @ReactProp(name = "haloRadius", defaultFloat = 0f)
  fun setHaloRadius(view: TentacleHaloView, radius: Float) { view.cornerRadius = PixelUtil.toPixelFromDIP(radius) }
}
