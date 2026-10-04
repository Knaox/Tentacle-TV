package com.tentacletv.focus

import android.graphics.Rect
import android.view.View
import android.view.ViewTreeObserver
import com.facebook.react.views.scroll.ReactScrollView
import java.lang.ref.WeakReference
import java.util.WeakHashMap
import kotlin.math.abs

/**
 * V10 — la section MONTRÉE reste en place quand un montage la déplace dans la
 * page (une rangée qui arrive au-dessus, un logo lu) : la page la suit
 * d'autant AVANT l'image (`OnGlobalLayoutListener` : après la mise en page,
 * avant le dessin), puis la montre de nouveau si sa taille l'exige. Le pendant
 * de `keepShownInPlace` (`TentacleRevealMotion.m`) ; la règle : tv-core
 * `layoutShift` (`reveal.ts`) — une AUTRE section montrée entre-temps, ou un
 * défilement d'un autre, et rien n'est compensé.
 *
 * Seulement après un pas isolé : pendant une rafale, rien n'est « montré ».
 */
internal class ShownKeeper private constructor(private val page: ReactScrollView) :
  ViewTreeObserver.OnGlobalLayoutListener, View.OnAttachStateChangeListener {

  private var shown: WeakReference<TentacleFocusSection>? = null
  private var top = Float.NaN
  private val rect = Rect()
  private var reveal: ((TentacleFocusSection) -> Unit)? = null

  init {
    page.addOnAttachStateChangeListener(this)
    if (page.isAttachedToWindow) page.viewTreeObserver.addOnGlobalLayoutListener(this)
    RevealFollower.of(page, horizontal = false).onForeign = { show(null, null) }
  }

  private fun topOf(section: View): Float {
    section.getDrawingRect(rect)
    page.offsetDescendantRectToMyCoords(section, rect)
    return rect.top.toFloat()
  }

  /** La section que la page montre désormais (null : aucune), et comment la remontrer. */
  fun show(section: TentacleFocusSection?, again: ((TentacleFocusSection) -> Unit)?) {
    shown = section?.let { WeakReference(it) }
    top = section?.let { topOf(it) } ?: Float.NaN
    reveal = again
  }

  override fun onGlobalLayout() {
    val section = shown?.get() ?: return
    if (!section.isAttachedToWindow || !FocusGeometry.isDescendant(section, page)) return show(null, null)
    val after = topOf(section)
    val delta = after - top
    top = after
    if (!delta.isNaN() && abs(delta) >= 0.5f) RevealFollower.of(page, horizontal = false).shift(delta)
    reveal?.invoke(section)
  }

  override fun onViewAttachedToWindow(v: View) {
    page.viewTreeObserver.addOnGlobalLayoutListener(this)
  }

  override fun onViewDetachedFromWindow(v: View) {
    page.viewTreeObserver.removeOnGlobalLayoutListener(this)
  }

  companion object {
    private val keepers = WeakHashMap<ReactScrollView, ShownKeeper>()

    fun of(page: ReactScrollView): ShownKeeper = keepers.getOrPut(page) { ShownKeeper(page) }
  }
}
