package com.tentacletv.focus

import android.graphics.Rect
import android.view.View
import android.view.ViewGroup
import com.facebook.react.views.scroll.ReactHorizontalScrollView
import com.facebook.react.views.scroll.ReactScrollView
import kotlin.math.max
import kotlin.math.min

/**
 * La page — et la rangée — qui SUIVENT le focus, en un seul mouvement.
 *
 * Android fait défiler une ScrollView d'un SAUT quand un de ses descendants
 * prend le focus (`ReactScrollView.requestChildFocus` → `scrollBy`). La
 * section la plus proche de l'élément focalisé, appelée AVANT elles sur ce
 * chemin, relève leurs positions (`capture`), les laisse sauter, puis les
 * remet où elles étaient et les fait aller à NOS cibles (`apply`) — dans le
 * même message, avant toute image : le saut ne se voit jamais. C'est le
 * pendant de `TentacleRevealScroller.m`, qui rend sa position à tvOS.
 *
 * - la PAGE (la ScrollView verticale la plus proche) va à la cible de la
 *   section qui RÉVÈLE l'élément (la plus proche dont le mode n'est pas
 *   `none`) — `reveal.ts` (`revealOffset`, `clampRevealOffset`) ; sans
 *   section qui révèle, la cible d'Android (le moins pour montrer
 *   l'élément), mais en un mouvement — comme le défilement propre de tvOS ;
 * - la RANGÉE (la ScrollView horizontale entre l'élément et sa section) va à
 *   `rowRevealOffset` (`burstFollow.ts`) : la carte montrée aussi loin des
 *   bords que les bouts de la rangée le sont de son contenu.
 *
 * Un pas de rafale (`FocusStep`) les fait aller à vitesse constante ; un pas
 * isolé, sur le ressort de la section.
 */
internal object RevealScroller {
  /** Le pas du focus en cours, posé par la section qui l'a décidé ; sinon un pas isolé. */
  class Step(val burst: Boolean, val intervalMs: Double)

  var currentStep: Step? = null

  class Plan(
    private val page: ReactScrollView?,
    private val pageAt: Int,
    private val row: ReactHorizontalScrollView?,
    private val rowAt: Int,
    private val focused: View,
    private val revealing: TentacleFocusSection?,
  ) {
    fun apply() {
      val step = currentStep
      val segment = if (step?.burst == true) burstSegmentMs(step.intervalMs) else null
      if (page != null) {
        val follower = RevealFollower.of(page, horizontal = false)
        // Sans section qui révèle : la cible d'Android (là où il vient de sauter), animée.
        val jumped = page.scrollY.toFloat()
        // Android vient de sauter : on rend la position d'avant, puis on y va.
        if (page.scrollY != pageAt) page.scrollTo(page.scrollX, pageAt)
        val spring = (revealing ?: FocusGeometry.innermostSection(focused))?.let { it.revealResponse to it.revealDamping }
          ?: (DEFAULT_RESPONSE to 1f)
        val target = if (revealing != null) pageTarget(page, revealing, follower.base()) else if (jumped != pageAt.toFloat()) jumped else null
        if (target != null) follower.moveTo(target, spring, segment)
      }
      if (row != null) {
        val follower = RevealFollower.of(row, horizontal = true)
        if (row.scrollX != rowAt) row.scrollTo(rowAt, row.scrollY)
        val spring = (revealing ?: FocusGeometry.innermostSection(focused))?.let { it.revealResponse to it.revealDamping }
          ?: (DEFAULT_RESPONSE to 1f)
        follower.moveTo(rowTarget(row, focused, follower.base()), spring, segment)
      }
    }
  }

  private const val DEFAULT_RESPONSE = 0.5f

  /** `burstSegmentMs` (burstFollow.ts) : bornes 40 et 200 ms. */
  private fun burstSegmentMs(intervalMs: Double): Float = min(200.0, max(40.0, intervalMs)).toFloat()

  /** Relève, avant que les ScrollView ne sautent, ce que le focus de `focused` fera défiler. */
  fun capture(section: TentacleFocusSection, focused: View): Plan? {
    val revealing = revealingSection(focused)
    val page = FocusGeometry.ancestor<ReactScrollView>(revealing ?: focused)
    val row = FocusGeometry.ancestor<ReactHorizontalScrollView>(focused, stop = section)
    if (page == null && row == null) return null
    return Plan(page, page?.scrollY ?: 0, row, row?.scrollX ?: 0, focused, revealing)
  }

  /** V1 : la section qui RÉVÈLE `item` — la plus proche de lui, dans sa page. */
  private fun revealingSection(item: View): TentacleFocusSection? {
    var v: Any? = item
    while (v is View) {
      if (v is ReactScrollView) return null
      if (v is TentacleFocusSection && v.revealMode != "none") return v
      v = v.parent
    }
    return null
  }

  private val rect = Rect()

  /** `revealOffset` (reveal.ts), dans le repère du contenu de la page. */
  private fun pageTarget(page: ReactScrollView, section: TentacleFocusSection, base: Float): Float {
    section.getDrawingRect(rect)
    page.offsetDescendantRectToMyCoords(section, rect)
    val viewport = (page.height - page.paddingTop - page.paddingBottom).toFloat()
    val content = (page.getChildAt(0)?.height ?: 0).toFloat()
    val max = max(0f, content - viewport)
    val target = when (section.revealMode) {
      "start" -> 0f
      "anchor" -> rect.top - section.revealTopPx
      else -> {
        val margin = section.revealMarginPx
        val top = rect.top - margin
        val bottom = rect.bottom + margin - viewport
        if (bottom > base) min(bottom, top) else if (top < base) top else base
      }
    }
    return min(max(target, 0f), max)
  }

  /** `rowRevealOffset` (burstFollow.ts), dans le repère du contenu de la rangée. */
  private fun rowTarget(row: ReactHorizontalScrollView, focused: View, base: Float): Float {
    val content = row.getChildAt(0) as? ViewGroup ?: return base
    focused.getDrawingRect(rect)
    row.offsetDescendantRectToMyCoords(focused, rect)
    val viewport = (row.width - row.paddingLeft - row.paddingRight).toFloat()
    val width = content.width.toFloat()
    val first = content.getChildAt(0)
    val last = content.getChildAt(content.childCount - 1)
    val leading = first?.left?.toFloat() ?: 0f
    // Une liste virtualisée n'a pas monté sa dernière carte : jamais plus que le retrait.
    val trailing = min(width - (last?.right?.toFloat() ?: width), leading)
    val start = rect.left - leading
    val end = rect.right + trailing - viewport
    val target = if (end > base) min(end, start) else if (start < base) start else base
    return min(max(target, 0f), max(0f, width - viewport))
  }
}
