package com.tentacletv.focus

import android.graphics.RectF
import android.view.View
import android.view.ViewGroup
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/**
 * La règle de voisinage vertical, traduite de `@tentacle-tv/tv-core`
 * (`packages/tv-core/src/focus/sections.ts`) — mêmes étapes, mêmes
 * constantes, comme sa jumelle d'Apple TV (`ios/TentacleTV/TentacleFocusNeighbors.m`) ;
 * les tests de tv-core sont le cahier des charges des trois :
 *
 * 0. dans la section qu'on quitte : en descendant, sa ligne suivante ; en
 *    remontant, ce qui est à l'APLOMB seulement, sauf dans une LISTE de
 *    lignes (`lineList`) — la ligne la plus proche, puis au centre ;
 * 1. sinon, les sections AU-DELÀ, dans la direction, qui partagent une
 *    abscisse avec elle et ont un élément focalisable ;
 * 2. la plus proche, et celles qui sont à sa hauteur (côte à côte) ;
 * 3. dans chacune, les éléments qui FONT FACE, puis le centre le plus proche ;
 * 4. l'entrée déclarée de la section retenue l'emporte, si elle est là.
 *
 * Toute la géométrie est lue dans la fenêtre au moment du geste (la rangée
 * quittée a pu défiler depuis que son élément a pris le focus).
 */
internal object FocusNeighbors {
  private const val STACK_SLACK = 24f // STACK_SLACK (points → pixels au geste)
  private const val SAME_EDGE = 8f // SAME_EDGE
  private const val FRONTIER_SLACK = 2f // FRONTIER_SLACK

  private class Item(val view: View, val box: RectF)

  private fun overlapX(a: RectF, b: RectF) = min(a.right, b.right) - max(a.left, b.left)

  /** `isBeyond` : `to` est au-delà de `from` dans la direction. */
  private fun isBeyond(from: RectF, to: RectF, up: Boolean, density: Float): Boolean {
    val slack = min(STACK_SLACK * density, min(from.height(), to.height()) / 4)
    return if (up) to.bottom <= from.top + slack else to.top >= from.bottom - slack
  }

  /** Une vue affichée : visible et opaque jusqu'à la fenêtre (le moteur
   *  d'Apple TV ignore ce qui est à moins de 0,01 d'opacité : même règle). */
  fun isShown(view: View): Boolean {
    if (!view.isAttachedToWindow) return false
    var v: View? = view
    while (v != null) {
      if (v.visibility != View.VISIBLE || v.alpha <= 0.01f) return false
      v = v.parent as? View
    }
    return true
  }

  private fun canTakeFocus(view: View) = view.isFocusable && view.isEnabled && view.width > 0 && view.height > 0

  /** Les éléments focalisables d'une section, sans descendre dans une autre
   *  section de voisinage ni sous un `tvFocusable={false}`. */
  private fun collect(view: View, items: MutableList<View>, root: Boolean) {
    if (view.visibility != View.VISIBLE || view.alpha <= 0.01f) return
    if (!root && view is TentacleFocusSection && view.tvNeighbors) return
    if (!root && canTakeFocus(view)) {
      items.add(view)
      return
    }
    if (view !is ViewGroup || view.descendantFocusability == ViewGroup.FOCUS_BLOCK_DESCENDANTS) return
    for (i in 0 until view.childCount) collect(view.getChildAt(i), items, false)
  }

  /** `facingItems` : rien de leur section au-dessus (en descendant) ou au-dessous (en remontant), dans leur colonne. */
  private fun facing(items: List<Item>, up: Boolean, density: Float): List<Item> {
    val slack = FRONTIER_SLACK * density
    return items.filter { item ->
      items.none { other ->
        other !== item && overlapX(item.box, other.box) > 0 &&
          (if (up) other.box.top >= item.box.bottom - slack else other.box.bottom <= item.box.top + slack)
      }
    }
  }

  /** `nearestByCenter` : le centre le plus proche ; à égalité, le moins loin, puis le plus à gauche. */
  private fun isNearer(item: Item, kept: Item, from: RectF, up: Boolean, density: Float): Boolean {
    val tie = 0.5f * density
    val center = from.centerX()
    val gap = abs(item.box.centerX() - center) - abs(kept.box.centerX() - center)
    if (gap < -tie) return true
    if (gap > tie) return false
    val further = advance(item.box, from, up) - advance(kept.box, from, up)
    return further < -tie || (further <= tie && item.box.left < kept.box.left)
  }

  private fun advance(box: RectF, from: RectF, up: Boolean) = if (up) from.top - box.bottom else box.top - from.bottom

  /** `onSameRow` (geometry.ts) : plus de la moitié de la plus petite hauteur en commun. */
  private fun onSameRow(a: RectF, b: RectF): Boolean {
    val overlap = min(a.bottom, b.bottom) - max(a.top, b.top)
    return overlap > 0 && overlap * 2 > min(a.height(), b.height())
  }

  /** `inLineWithin` : au-delà de `from` dans sa section — à l'aplomb en remontant, sauf dans une liste. */
  private fun inLineWithin(from: RectF, siblings: List<View>, up: Boolean, list: Boolean, density: Float): View? {
    val beyond = siblings.map { Item(it, FocusGeometry.box(it)) }.filter { item ->
      !(up && !list && overlapX(from, item.box) <= 0) && advance(item.box, from, up) >= -FRONTIER_SLACK * density
    }
    val closest = beyond.minByOrNull { advance(it.box, from, up) } ?: return null
    var kept: Item? = null
    for (item in beyond) {
      if (onSameRow(closest.box, item.box) && (kept == null || isNearer(item, kept, from, up, density))) kept = item
    }
    return kept?.view
  }

  private class Candidate(val section: TentacleFocusSection, val edge: Float)

  /** Les sections au-delà de `from`, dans sa colonne et son écran, la plus proche d'abord. */
  private fun candidatesBeyond(from: TentacleFocusSection, up: Boolean, density: Float): List<Candidate> {
    val fromBox = FocusGeometry.box(from)
    val window = from.rootView
    val scope = FocusGeometry.screenOf(from)
    val trap = FocusGeometry.trapOf(from, up)
    return TentacleFocusSection.attached()
      .asSequence()
      .filter { it !== from && it.tvNeighbors && it.rootView === window && FocusGeometry.screenOf(it) === scope }
      .filter { trap == null || FocusGeometry.isDescendant(it, trap) }
      .filter { !FocusGeometry.isDescendant(it, from) && !FocusGeometry.isDescendant(from, it) && isShown(it) }
      .mapNotNull { section ->
        val box = FocusGeometry.box(section)
        if (overlapX(fromBox, box) <= 0 || !isBeyond(fromBox, box, up, density)) null
        else Candidate(section, if (up) -box.bottom else box.top)
      }
      .sortedBy { it.edge }
      .toList()
  }

  /** L'élément visé par HAUT (`up`) ou BAS depuis `focused`, élément de `from` — null : rien au-delà. */
  fun target(from: TentacleFocusSection, focused: View, up: Boolean): View? {
    if (!from.isAttachedToWindow) return null
    val density = from.resources.displayMetrics.density
    val itemBox = FocusGeometry.box(focused)

    // 0. À l'aplomb, dans la section qu'on quitte.
    val siblings = mutableListOf<View>().also { collect(from, it, true) }.apply { remove(focused) }
    inLineWithin(itemBox, siblings, up, from.lineList, density)?.let { return it }

    // 1-3. La plus proche des sections au-delà qui a un élément, et celles à sa hauteur.
    var keptSection: TentacleFocusSection? = null
    var keptItems: List<View> = emptyList()
    var kept: Item? = null
    var groupEdge = Float.MAX_VALUE
    for (candidate in candidatesBeyond(from, up, density)) {
      if (keptSection != null && candidate.edge - groupEdge > SAME_EDGE * density) break
      val views = mutableListOf<View>().also { collect(candidate.section, it, true) }
      if (views.isEmpty()) continue
      groupEdge = min(groupEdge, candidate.edge)
      for (item in facing(views.map { Item(it, FocusGeometry.box(it)) }, up, density)) {
        if (kept == null || isNearer(item, kept, itemBox, up, density)) {
          kept = item
          keptSection = candidate.section
          keptItems = views
        }
      }
    }
    val section = keptSection ?: return null

    // 4. L'entrée déclarée, si elle est là et focalisable.
    val entry = section.entryView()
    return if (entry != null && keptItems.contains(entry)) entry else kept?.view
  }
}
