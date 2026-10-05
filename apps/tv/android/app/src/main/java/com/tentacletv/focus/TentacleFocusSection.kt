package com.tentacletv.focus

import android.content.Context
import android.graphics.Canvas
import android.view.FocusFinder
import android.view.KeyEvent
import android.view.View
import android.view.ViewTreeObserver
import android.widget.EditText
import com.facebook.react.views.scroll.ReactHorizontalScrollView
import com.facebook.react.views.view.ReactViewGroup
import com.tentacletv.render.DrawCulling
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
 *   mouvement (`RevealScroller`) ;
 * - ailleurs, ou rien au-delà : le moteur de la plateforme tenu au FAISCEAU,
 *   comme celui de tvOS (`BeamSearch`) — ni cible en diagonale, ni « saut de
 *   page » d'une ScrollView qui ne trouve rien ;
 * - le SUIVI de la page (`reveal*`) : `RevealScroller`, au focus ;
 * - la CADENCE d'une flèche maintenue (`tvPacing`) : `HoldPacer` ;
 * - le DESSIN : loin de l'écran, ses enfants sortent de sa liste d'affichage
 *   (`DrawCulling`) — montés et focalisables, le RenderThread ne les parcourt
 *   plus.
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
  /** Les pas d'une flèche TENUE ne sortent pas de la section (le rail : l'Apple
   *  TV s'arrête sur l'entrée, une tenue ne file pas au profil ni au contenu). */
  var holdInside: Boolean = false
  /** L'entrée déclarée : le numéro natif (l'identifiant de vue, ancienne architecture) d'un de ses éléments. */
  var tvEntry: Int? = null

  /** L'élément d'entrée, résolu à la demande (null s'il n'est pas monté ici). */
  fun entryView(): View? {
    val tag = tvEntry ?: return null
    val view = findViewById<View>(tag)
    return if (view != null && view !== this) view else null
  }

  /** Ses enfants sont hors de sa liste d'affichage (loin de l'écran, `DrawCulling`). */
  private var drawCulled = false

  /** Avant chaque image : revenue près de l'écran (ou partie loin), elle se redessine. */
  private val cullCheck = ViewTreeObserver.OnPreDrawListener {
    if (DrawCulling.isFar(this) != drawCulled) invalidate()
    true
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    registry.add(this)
    ReparentGuard.install(this)
    viewTreeObserver.addOnPreDrawListener(cullCheck)
  }

  override fun onDetachedFromWindow() {
    viewTreeObserver.removeOnPreDrawListener(cullCheck)
    registry.remove(this)
    super.onDetachedFromWindow()
  }

  override fun dispatchDraw(canvas: Canvas) {
    drawCulled = DrawCulling.isFar(this)
    if (!drawCulled) super.dispatchDraw(canvas)
  }

  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    val direction = DIRECTIONS[event.keyCode] ?: return super.dispatchKeyEvent(event)
    val focused = findFocus()
    // La section la plus proche de l'élément décide, elle seule ; un champ garde ses flèches.
    if (focused == null || focused === this || focused is EditText || FocusGeometry.innermostSection(focused) !== this) {
      return super.dispatchKeyEvent(event)
    }
    if (event.action == KeyEvent.ACTION_UP) {
      if (HoldPacer.release(event.keyCode)) RevealFollower.settleAll()
      return super.dispatchKeyEvent(event)
    }
    if (event.action != KeyEvent.ACTION_DOWN) return super.dispatchKeyEvent(event)
    if (event.repeatCount > 0) {
      // La flèche TENUE : ses pas sur l'horloge de la tenue, ses répétitions
      // absorbées (le JS les a déjà vues passer : `ReactRootView` les lui donne
      // avant nous).
      if (HoldPacer.repeat(event.keyCode, direction, rootView)) return true
    } else {
      HoldPacer.cancel()
    }
    return move(focused, direction, null)
  }

  /**
   * Un pas : isolé (`holdIntervalMs` null, le ressort) ou de tenue. HAUT / BAS :
   * la règle des sections ; GAUCHE / DROITE dans une rangée défilante : le
   * moteur géométrique d'Android borné à la rangée (ce que fait
   * `HorizontalScrollView`, sans son saut). Sinon — rien au-delà, ou pas de
   * rangée —, le moteur de la plateforme tenu au faisceau (`BeamSearch`) ; rien
   * dans le faisceau : le focus reste. La touche est prise dans tous les cas :
   * ni le « saut de page » d'une ScrollView qui ne trouve rien, ni une cible en
   * diagonale.
   */
  private fun move(focused: View, direction: Int, holdIntervalMs: Double?): Boolean {
    RevealScroller.currentStep = holdIntervalMs?.let { RevealScroller.Step(burst = true, intervalMs = it) }
    try {
      val target = when (direction) {
        View.FOCUS_UP, View.FOCUS_DOWN -> FocusGeometry.innermostNeighborSection(focused)?.let { FocusNeighbors.target(it, focused, direction == View.FOCUS_UP) }
        else -> FocusGeometry.ancestor<ReactHorizontalScrollView>(focused, stop = this)?.let { FocusFinder.getInstance().findNextFocus(it, focused, direction) }
      } ?: BeamSearch.target(focused, direction)
      // Une tenue qui sortirait d'une section qui la retient : le focus reste.
      if (holdIntervalMs != null && holdInside && target != null && !FocusGeometry.isDescendant(target, this)) return true
      target?.requestFocus(direction)
      return true
    } finally {
      RevealScroller.currentStep = null
    }
  }

  override fun requestChildFocus(child: View, focused: View) {
    // La section la plus proche relève les défilements AVANT qu'Android ne saute.
    val plan = if (FocusGeometry.innermostSection(focused) === this) RevealScroller.capture(this, focused) else null
    super.requestChildFocus(child, focused)
    plan?.apply()
  }

  companion object {
    /**
     * Un pas de TENUE (`HoldPacer`), depuis le focus du moment — il a pu
     * changer de section. Faux : plus de section sous le focus, la tenue
     * s'arrête (Android reprend la main).
     */
    internal fun heldStep(root: View, direction: Int, intervalMs: Double): Boolean {
      val focused = root.findFocus() ?: return false
      if (focused is EditText) return false
      val section = FocusGeometry.innermostSection(focused) ?: return false
      section.move(focused, direction, intervalMs)
      return true
    }

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
