package com.tentacletv.render

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.os.SystemClock
import android.view.View
import com.facebook.react.uimanager.PixelUtil
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * L'INDICATEUR D'ACTIVITÉ de l'Apple TV, redessiné sur Android TV : huit
 * rayons en gélule, l'éclairage qui tourne d'un rayon toutes les 100 ms, un
 * rayon qui s'éteint en 400 ms, une image toutes les 50 ms. La règle et le
 * relevé sont dans tv-core (`render/activitySpinner.ts`) ; ces constantes en
 * sont la copie, tenue par son test de miroir.
 *
 * L'indicateur système d'Android (une `ProgressBar`) dessinait un autre motif,
 * rastérisé petit puis agrandi, et l'animait sur le RenderThread : toute la
 * fenêtre redessinée à chaque image tant qu'il était monté. Ici, la vue
 * s'invalide elle-même, calée sur la prochaine image de 50 ms, et seulement
 * attachée, affichée, fenêtre visible : rien ne tourne pour rien. Son dessin
 * est enregistré (huit gélules), pas un bitmap : net à toute échelle.
 *
 * Le cadre de la vue est celui du DESSIN (64 ou 40 points) : la mise en page
 * le ramène à celui de React Native par des marges (`ActivitySpinner`), et
 * une invalidation couvre bien tout ce qui change.
 */
class TentacleSpinnerView(context: Context) : View(context) {
  var color: Int = Color.WHITE
    set(value) { field = value; invalidate() }
  var large: Boolean = true
    set(value) { field = value; invalidate() }

  private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
  private val spoke = RectF()
  private var startedAt = SystemClock.uptimeMillis()
  private var running = false
  private val tick = Runnable {
    invalidate()
    schedule()
  }

  init {
    isFocusable = false
    importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
  }

  override fun hasOverlappingRendering(): Boolean = false

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    startedAt = SystemClock.uptimeMillis()
    update()
  }

  override fun onDetachedFromWindow() {
    running = false
    removeCallbacks(tick)
    super.onDetachedFromWindow()
  }

  override fun onVisibilityChanged(changedView: View, visibility: Int) {
    super.onVisibilityChanged(changedView, visibility)
    update()
  }

  override fun onWindowVisibilityChanged(visibility: Int) {
    super.onWindowVisibilityChanged(visibility)
    update()
  }

  private fun update() {
    val visible = isAttachedToWindow && isShown && windowVisibility == VISIBLE
    if (visible == running) return
    running = visible
    if (visible) {
      invalidate()
      schedule()
    } else {
      removeCallbacks(tick)
    }
  }

  /** La prochaine image : à la frontière des 50 ms, sur l'horloge du départ. */
  private fun schedule() {
    if (!running) return
    val elapsed = SystemClock.uptimeMillis() - startedAt
    postDelayed(tick, FRAME_MS - elapsed % FRAME_MS)
  }

  override fun onDraw(canvas: Canvas) {
    val frame = max(0L, SystemClock.uptimeMillis() - startedAt) / FRAME_MS
    val step = frame / FRAMES_PER_STEP
    val inner = PixelUtil.toPixelFromDIP(if (large) LARGE_INNER else SMALL_INNER)
    val outer = PixelUtil.toPixelFromDIP(if (large) LARGE_OUTER else SMALL_OUTER)
    val half = PixelUtil.toPixelFromDIP(if (large) LARGE_SPOKE else SMALL_SPOKE) / 2f
    val cx = width / 2f
    val cy = height / 2f
    spoke.set(cx + inner, cy - half, cx + outer, cy + half)
    paint.color = color
    val base = Color.alpha(color)
    for (index in 0 until SPOKES) {
      // Le dernier allumage de ce rayon, et ce qu'il s'en est éteint depuis.
      val litStep = step - Math.floorMod(step - index, SPOKES.toLong())
      val age = frame - litStep * FRAMES_PER_STEP
      val level = max(0L, LEVELS - age) / LEVELS.toFloat()
      paint.alpha = (base * (REST_ALPHA + (LIT_ALPHA - REST_ALPHA) * level)).roundToInt().coerceIn(0, 255)
      canvas.save()
      canvas.rotate(index * 360f / SPOKES, cx, cy)
      canvas.drawRoundRect(spoke, half, half, paint)
      canvas.restore()
    }
  }

  companion object {
    // Copie de tv-core `ACTIVITY_SPINNER` (test de miroir).
    const val SPOKES = 8
    const val STEP_MS = 100L
    const val FRAME_MS = 50L
    const val FADE_MS = 400L
    const val REST_ALPHA = 69f / 255f
    const val LIT_ALPHA = 217f / 255f
    const val LARGE_SPOKE = 9f
    const val LARGE_INNER = 9f
    const val LARGE_OUTER = 32f
    const val SMALL_SPOKE = 5f
    const val SMALL_INNER = 6f
    const val SMALL_OUTER = 20f
    private const val FRAMES_PER_STEP = STEP_MS / FRAME_MS
    private const val LEVELS = FADE_MS / FRAME_MS
  }
}

class TentacleSpinnerViewManager : SimpleViewManager<TentacleSpinnerView>() {
  override fun getName(): String = "TentacleSpinnerView"

  override fun createViewInstance(reactContext: ThemedReactContext): TentacleSpinnerView = TentacleSpinnerView(reactContext)

  @ReactProp(name = "spinnerColor", customType = "Color", defaultInt = Color.WHITE)
  fun setSpinnerColor(view: TentacleSpinnerView, color: Int) { view.color = color }

  /** `large` (64 points) ou `small` (40), comme `ActivityIndicator`. */
  @ReactProp(name = "spinnerSize")
  fun setSpinnerSize(view: TentacleSpinnerView, size: String?) { view.large = size != "small" }
}
