package com.tentacletv.render

import android.content.Context
import android.graphics.Canvas
import android.view.View
import android.view.ViewTreeObserver
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.views.view.ReactViewGroup
import com.facebook.react.views.view.ReactViewManager

/**
 * Une PISTE de cartes (une rangée défilante) qui ne met dans sa liste
 * d'affichage que les cartes à l'écran, marge comprise (`DrawCulling`) :
 * une rangée de l'accueil en monte une vingtaine, l'écran en montre six.
 * Toutes restent montées et focalisables ; seul le RenderThread ne parcourt
 * plus les autres. Avant chaque image, la piste compare l'ensemble des cartes
 * proches à celui de son dernier dessin, et se redessine s'il a changé (la
 * rangée a défilé, une carte est arrivée).
 *
 * Une `View` de React Native pour tout le reste (`ReactViewGroup`) : mêmes
 * props, même ordre de dessin (`zIndex` : la carte focalisée passe devant).
 */
class TentacleCullTrack(context: Context) : ReactViewGroup(context) {
  private val origin = IntArray(2)
  private var screenWidth = 0
  private var screenHeight = 0
  private var margin = 0
  /** L'empreinte des cartes proches au dernier dessin. */
  private var drawnSet = 0L

  private val cullCheck = ViewTreeObserver.OnPreDrawListener {
    if (nearSet() != drawnSet) invalidate()
    true
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    viewTreeObserver.addOnPreDrawListener(cullCheck)
  }

  override fun onDetachedFromWindow() {
    viewTreeObserver.removeOnPreDrawListener(cullCheck)
    super.onDetachedFromWindow()
  }

  /** La géométrie du moment : l'origine de la piste dans la fenêtre, l'écran, la marge. */
  private fun measureWindow(): Boolean {
    val root = rootView ?: return false
    screenWidth = root.width
    screenHeight = root.height
    if (!isAttachedToWindow || screenWidth <= 0 || screenHeight <= 0) return false
    getLocationInWindow(origin)
    margin = DrawCulling.margin()
    return true
  }

  private fun isFar(child: View): Boolean {
    val left = origin[0] + child.left + child.translationX.toInt()
    val top = origin[1] + child.top + child.translationY.toInt()
    return DrawCulling.isFar(left, top, left + child.width, top + child.height, screenWidth, screenHeight, margin)
  }

  /** L'empreinte de l'ensemble des cartes proches (dans l'ordre des enfants). */
  private fun nearSet(): Long {
    if (!measureWindow()) return 0L
    var hash = 1L
    for (index in 0 until childCount) {
      if (!isFar(getChildAt(index))) hash = hash * 31 + index + 1
    }
    return hash
  }

  override fun dispatchDraw(canvas: Canvas) {
    drawnSet = nearSet()
    super.dispatchDraw(canvas)
  }

  override fun drawChild(canvas: Canvas, child: View, drawingTime: Long): Boolean {
    if (screenWidth > 0 && isFar(child)) return false
    return super.drawChild(canvas, child, drawingTime)
  }
}

class TentacleCullTrackManager : ReactViewManager() {
  override fun getName(): String = "TentacleCullTrack"

  override fun createViewInstance(context: ThemedReactContext): ReactViewGroup = TentacleCullTrack(context)
}
