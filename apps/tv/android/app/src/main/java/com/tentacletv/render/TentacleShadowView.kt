package com.tentacletv.render

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.view.View
import com.facebook.react.uimanager.PixelUtil
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import kotlin.math.roundToInt

/**
 * L'ombre portée d'une vue de la refonte, là où Android ne dessine pas celle
 * de ses styles iOS (`shadowColor`, `shadowRadius`… : ancienne architecture).
 * Posée en PREMIER enfant de la vue qui projette (`DropShadow`), elle en
 * déborde de toute l'étendue du flou (`extent`) — ses bornes couvrent son
 * dessin, la région repeinte quand elle bouge aussi — et dessine autour de la
 * boîte, jamais dessus : la boîte est exclue du dessin, son fond reste intact.
 *
 * Le flou se calcule UNE fois par géométrie (`ShadowMasks`) — un masque
 * alpha, réduit, mis en cache et partagé par toutes les cartes de même taille
 * — puis le GPU l'agrandit et le teinte à chaque dessin : ni flou par image,
 * ni ombre animée (l'opacité du parent la fait paraître). Mêmes formules que
 * tv-core (`render/dropShadow.ts`).
 */
class TentacleShadowView(context: Context) : View(context) {
  private val paint = Paint(Paint.FILTER_BITMAP_FLAG)
  private val dst = RectF()
  private val hole = Path()
  private val holeRect = RectF()

  init {
    isFocusable = false
    importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
  }

  override fun hasOverlappingRendering(): Boolean = false

  var color = Color.BLACK
    set(value) { field = value; invalidate() }
  var opacity = 0f
    set(value) { field = value; invalidate() }
  var blur = 0f
    set(value) { field = value; invalidate() }
  var offsetX = 0f
    set(value) { field = value; invalidate() }
  var offsetY = 0f
    set(value) { field = value; invalidate() }
  var cornerRadius = 0f
    set(value) { field = value; invalidate() }
  var outset = 0f
    set(value) { field = value; invalidate() }
  /** Le débord de la vue autour de la boîte qui projette (posé par le JS). */
  var extent = 0f
    set(value) { field = value; invalidate() }

  override fun onDraw(canvas: Canvas) {
    val alpha = (Color.alpha(color) * opacity).roundToInt().coerceIn(0, 255)
    // La boîte qui projette, dans la vue qui déborde d'elle de `extent` ;
    // bordure comprise (le JS mesure dans la bordure de son parent).
    val left = extent - outset
    val top = extent - outset
    val right = width - extent + outset
    val bottom = height - extent + outset
    if (alpha == 0 || right <= left || bottom <= top) return
    val mask = ShadowMasks.get((right - left).roundToInt(), (bottom - top).roundToInt(), cornerRadius, blur)
    val m = mask.margin
    dst.set(left - m + offsetX, top - m + offsetY, right + m + offsetX, bottom + m + offsetY)
    holeRect.set(left, top, right, bottom)
    hole.rewind()
    hole.addRoundRect(holeRect, cornerRadius, cornerRadius, Path.Direction.CW)
    paint.color = color
    paint.alpha = alpha
    canvas.save()
    canvas.clipOutPath(hole)
    canvas.drawBitmap(mask.bitmap, null, dst, paint)
    canvas.restore()
  }
}

class TentacleShadowViewManager : SimpleViewManager<TentacleShadowView>() {
  override fun getName(): String = "TentacleShadowView"

  override fun createViewInstance(reactContext: ThemedReactContext): TentacleShadowView = TentacleShadowView(reactContext)

  // Des props à plat (React ne renvoie que celles qui changent) ; les
  // invalidations d'une même transaction ne font qu'un dessin.
  @ReactProp(name = "maskColor", customType = "Color", defaultInt = Color.BLACK)
  fun setMaskColor(view: TentacleShadowView, color: Int) { view.color = color }

  @ReactProp(name = "maskOpacity", defaultFloat = 0f)
  fun setMaskOpacity(view: TentacleShadowView, opacity: Float) { view.opacity = opacity }

  @ReactProp(name = "maskBlur", defaultFloat = 0f)
  fun setMaskBlur(view: TentacleShadowView, blur: Float) { view.blur = PixelUtil.toPixelFromDIP(blur) }

  @ReactProp(name = "maskOffsetX", defaultFloat = 0f)
  fun setMaskOffsetX(view: TentacleShadowView, x: Float) { view.offsetX = PixelUtil.toPixelFromDIP(x) }

  @ReactProp(name = "maskOffsetY", defaultFloat = 0f)
  fun setMaskOffsetY(view: TentacleShadowView, y: Float) { view.offsetY = PixelUtil.toPixelFromDIP(y) }

  @ReactProp(name = "maskRadius", defaultFloat = 0f)
  fun setMaskRadius(view: TentacleShadowView, radius: Float) { view.cornerRadius = PixelUtil.toPixelFromDIP(radius) }

  @ReactProp(name = "maskOutset", defaultFloat = 0f)
  fun setMaskOutset(view: TentacleShadowView, outset: Float) { view.outset = PixelUtil.toPixelFromDIP(outset) }

  @ReactProp(name = "maskExtent", defaultFloat = 0f)
  fun setMaskExtent(view: TentacleShadowView, extent: Float) { view.extent = PixelUtil.toPixelFromDIP(extent) }
}
