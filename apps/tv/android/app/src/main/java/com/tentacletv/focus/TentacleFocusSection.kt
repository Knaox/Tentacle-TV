package com.tentacletv.focus

import android.content.Context
import android.view.FocusFinder
import android.view.KeyEvent
import android.view.View
import android.widget.EditText
import com.facebook.react.views.scroll.ReactHorizontalScrollView
import com.facebook.react.views.view.ReactViewGroup
import java.util.Collections
import java.util.WeakHashMap

/**
 * Une SECTION d'une page de la refonte — une rangée, une ligne de grille, un
 * réglage, l'en-tête d'une fiche —, montée par `FocusSection`
 * (`apps/tv/src/redesign/focus/FocusSection.tsx`) : la jumelle Android de
 * `ios/TentacleTV/TentacleFocusSection.m`, aux mêmes props.
 *
 * - le VOISINAGE (`tvNeighbors`) : HAUT / BAS depuis un de ses éléments vise
 *   la section voisine, au centre le plus proche (`FocusNeighbors`) ; son
 *   entrée déclarée (`tvEntry`) l'emporte. Sur Android, la section prend la
 *   flèche AVANT que la ScrollView ne cherche elle-même (elle ne consulte pas
 *   `focusSearch`) : le moteur d'Android ne garde la main que là où la règle
 *   n'a rien au-delà — comme tvOS et ses guides ;
 * - la RANGÉE : GAUCHE / DROITE dans une rangée défilante — la carte voisine,
 *   par le moteur géométrique d'Android, borné à la rangée (ce que fait
 *   `HorizontalScrollView`), mais sans son saut : la rangée suit en un
 *   mouvement (`RevealScroller`). Rien dans la rangée : le moteur cherche
 *   au-delà (le rail), sans le « saut de page » de `HorizontalScrollView` ;
 * - le SUIVI de la page (`reveal*`) : `RevealScroller`, au focus ;
 * - la CADENCE d'une flèche maintenue (`tvPacing`) : `RepeatPacer`.
 *
 * Ce qui décide est dans tv-core (`focus/sections.ts`, `focus/reveal.ts`,
 * `focus/revealMotion.ts`, `focus/burstFollow.ts`, `input/repeatPacing.ts`) ;
 * ces fichiers l'appliquent au geste, pas à pas.
 */
class TentacleFocusSection(context: Context) : ReactViewGroup(context) {
  var revealMode: String = "none"
  var revealMarginPx: Float = 0f
  var revealTopPx: Float = 0f
  var revealResponse: Float = 0.5f
  var revealDamping: Float = 1f
  var lineList: Boolean = false
  var tvNeighbors: Boolean = false
  /** L'entrée déclarée : le numéro natif (l'identifiant de vue, ancienne architecture) d'un de ses éléments. */
  var tvEntry: Int? = null

  /** L'élément d'entrée, résolu à la demande (null s'il n'est pas monté ici). */
  fun entryView(): View? {
    val tag = tvEntry ?: return null
    val view = findViewById<View>(tag)
    return if (view != null && view !== this) view else null
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    registry.add(this)
  }

  override fun onDetachedFromWindow() {
    registry.remove(this)
    super.onDetachedFromWindow()
  }

  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    val direction = DIRECTIONS[event.keyCode] ?: return super.dispatchKeyEvent(event)
    val focused = findFocus()
    // La section la plus proche de l'élément décide, elle seule ; un champ garde ses flèches.
    if (focused == null || focused === this || focused is EditText || FocusGeometry.innermostSection(focused) !== this) {
      return super.dispatchKeyEvent(event)
    }
    if (event.action == KeyEvent.ACTION_UP) {
      if (RepeatPacer.release(event.keyCode)) RevealFollower.settleAll()
      return super.dispatchKeyEvent(event)
    }
    if (event.action != KeyEvent.ACTION_DOWN) return super.dispatchKeyEvent(event)
    val decision = RepeatPacer.pace(event.keyCode, event.repeatCount > 0, event.eventTime)
    // Une répétition en avance sur la cadence : absorbée, le focus ne bouge pas
    // (le JS l'a déjà vue passer : `ReactRootView` la lui donne avant nous).
    if (!decision.accept) return true
    RevealScroller.currentStep = RevealScroller.Step(decision.burst, decision.intervalMs)
    try {
      val handled = when (direction) {
        View.FOCUS_UP, View.FOCUS_DOWN -> moveVertically(focused, direction)
        else -> moveInRow(focused, direction)
      }
      return handled ?: super.dispatchKeyEvent(event)
    } finally {
      RevealScroller.currentStep = null
    }
  }

  /** HAUT / BAS : la règle des sections ; null — rien au-delà, Android garde la main. */
  private fun moveVertically(focused: View, direction: Int): Boolean? {
    val from = FocusGeometry.innermostNeighborSection(focused) ?: return null
    val target = FocusNeighbors.target(from, focused, direction == View.FOCUS_UP) ?: return null
    return if (target.requestFocus(direction)) true else null
  }

  /** GAUCHE / DROITE dans une rangée défilante ; null hors d'une rangée. */
  private fun moveInRow(focused: View, direction: Int): Boolean? {
    val row = FocusGeometry.ancestor<ReactHorizontalScrollView>(focused, stop = this) ?: return null
    val next = FocusFinder.getInstance().findNextFocus(row, focused, direction)
    if (next != null) return if (next.requestFocus(direction)) true else null
    // Rien dans la rangée : pas de saut de page, le moteur d'Android cherche au-delà.
    return false
  }

  override fun requestChildFocus(child: View, focused: View) {
    // La section la plus proche relève les défilements AVANT qu'Android ne saute.
    val plan = if (FocusGeometry.innermostSection(focused) === this) RevealScroller.capture(this, focused) else null
    super.requestChildFocus(child, focused)
    plan?.apply()
  }

  companion object {
    private val registry: MutableSet<TentacleFocusSection> = Collections.newSetFromMap(WeakHashMap())

    /** Les sections attachées à une fenêtre. */
    fun attached(): List<TentacleFocusSection> = registry.toList()

    private val DIRECTIONS = mapOf(
      KeyEvent.KEYCODE_DPAD_UP to View.FOCUS_UP,
      KeyEvent.KEYCODE_DPAD_DOWN to View.FOCUS_DOWN,
      KeyEvent.KEYCODE_DPAD_LEFT to View.FOCUS_LEFT,
      KeyEvent.KEYCODE_DPAD_RIGHT to View.FOCUS_RIGHT,
    )
  }
}
