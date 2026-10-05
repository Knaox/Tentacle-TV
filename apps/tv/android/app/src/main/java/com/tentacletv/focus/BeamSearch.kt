package com.tentacletv.focus

import android.graphics.RectF
import android.view.View
import android.view.ViewGroup
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/**
 * Le moteur de la plateforme, quand la règle des sections n'a rien à dire —
 * mais tenu au FAISCEAU, comme celui de tvOS.
 *
 * Le moteur de tvOS ne vise que ce qui CHEVAUCHE l'élément quitté dans l'axe
 * du geste (« pas de chevauchement, pas de voisin » : c'est toute la raison
 * d'être de ses guides). Celui d'Android (`FocusFinder`) prend, faute de
 * mieux, une cible EN DIAGONALE : au bout d'une rangée, DROITE sautait sur une
 * carte de la rangée d'en dessous ; depuis « Ma liste » du héros, sur une
 * vignette. Ici :
 *
 * - `focusSearch` du focalisé d'abord (pièges, guides, `nextFocus*`) — une
 *   cible imposée par `nextFocus*` est prise telle quelle, une cible dans le
 *   faisceau aussi, sauf si un GUIDE du faisceau est plus proche sur l'axe du
 *   geste (le choix de tvOS) ;
 * - sinon, le plus proche dans le faisceau, s'il y en a un (le moteur
 *   d'Android lui a préféré une diagonale plus proche) — dans le piège de la
 *   direction s'il y en a un ;
 * - sinon, rien : le focus reste, comme sur Apple TV.
 */
internal object BeamSearch {
  fun target(focused: View, direction: Int): View? {
    val next = focused.focusSearch(direction)
    if (next != null && userSpecified(focused, direction)) return next
    val from = FocusGeometry.box(focused)
    val nextInBeam = next != null && inBeam(from, FocusGeometry.box(next), direction)
    // Un GUIDE dans le faisceau, plus proche sur l'axe du geste que ce
    // qu'a choisi `FocusFinder`, l'emporte — comme sur tvOS. `FocusFinder`
    // pondère l'écart CROISÉ : un guide haut (le pont du rail, toute la
    // hauteur de l'écran) perdait contre une entrée du rail alignée sur la
    // carte, plus loin pourtant ; GAUCHE depuis une rangée visait « Séries »
    // au lieu de l'entrée active (nav-golden `socle/rail#rail-03`).
    val guide = nearestInBeam(focused, direction) { FocusGeometry.isFocusGuide(it) }
    if (guide != null && guide !== next &&
      (!nextInBeam || majorDistance(from, FocusGeometry.box(guide), direction) < majorDistance(from, FocusGeometry.box(next!!), direction))
    ) {
      return guide
    }
    if (nextInBeam) return next
    return nearestInBeam(focused, direction)
  }

  private fun userSpecified(focused: View, direction: Int): Boolean = when (direction) {
    View.FOCUS_UP -> focused.nextFocusUpId != View.NO_ID
    View.FOCUS_DOWN -> focused.nextFocusDownId != View.NO_ID
    View.FOCUS_LEFT -> focused.nextFocusLeftId != View.NO_ID
    View.FOCUS_RIGHT -> focused.nextFocusRightId != View.NO_ID
    else -> false
  }

  private fun horizontal(direction: Int) = direction == View.FOCUS_LEFT || direction == View.FOCUS_RIGHT

  /** Ce qui chevauche `from` dans l'axe CROISÉ du geste. */
  private fun inBeam(from: RectF, to: RectF, direction: Int): Boolean =
    if (horizontal(direction)) min(from.bottom, to.bottom) - max(from.top, to.top) > 0
    else min(from.right, to.right) - max(from.left, to.left) > 0

  /** `to` est-il au-delà de `from` dans la direction (la règle de `FocusFinder.isCandidate`) ? */
  private fun beyond(from: RectF, to: RectF, direction: Int): Boolean = when (direction) {
    View.FOCUS_LEFT -> (from.right > to.right || from.left >= to.right) && from.left > to.left
    View.FOCUS_RIGHT -> (from.left < to.left || from.right <= to.left) && from.right < to.right
    View.FOCUS_UP -> (from.bottom > to.bottom || from.top >= to.bottom) && from.top > to.top
    else -> (from.top < to.top || from.bottom <= to.top) && from.bottom < to.bottom
  }

  private fun majorDistance(from: RectF, to: RectF, direction: Int): Float = max(0f, when (direction) {
    View.FOCUS_LEFT -> from.left - to.right
    View.FOCUS_RIGHT -> to.left - from.right
    View.FOCUS_UP -> from.top - to.bottom
    else -> to.top - from.bottom
  })

  private fun minorDistance(from: RectF, to: RectF, direction: Int): Float =
    if (horizontal(direction)) abs(from.centerY() - to.centerY()) else abs(from.centerX() - to.centerX())

  private fun nearestInBeam(focused: View, direction: Int, accept: (View) -> Boolean = { true }): View? {
    val root = (FocusGeometry.trapOf(focused, direction) ?: focused.rootView) as? ViewGroup ?: return null
    val candidates = ArrayList<View>()
    root.addFocusables(candidates, direction)
    val from = FocusGeometry.box(focused)
    var best: View? = null
    var bestMajor = Float.MAX_VALUE
    var bestMinor = Float.MAX_VALUE
    for (candidate in candidates) {
      if (candidate === focused || FocusGeometry.isDescendant(focused, candidate) || !FocusNeighbors.isShown(candidate) || !accept(candidate)) continue
      val box = FocusGeometry.box(candidate)
      if (!beyond(from, box, direction) || !inBeam(from, box, direction)) continue
      val major = majorDistance(from, box, direction)
      val minor = minorDistance(from, box, direction)
      if (major < bestMajor || (major == bestMajor && minor < bestMinor)) {
        best = candidate
        bestMajor = major
        bestMinor = minor
      }
    }
    return best
  }
}
