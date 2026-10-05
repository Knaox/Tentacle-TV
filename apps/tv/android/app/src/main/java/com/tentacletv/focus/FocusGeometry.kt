package com.tentacletv.focus

import android.graphics.RectF
import android.view.View
import android.view.ViewGroup
import com.facebook.react.views.view.ReactViewGroup
import java.lang.reflect.Field

/**
 * La géométrie et la portée du focus, lues dans la fenêtre au moment du geste.
 */
internal object FocusGeometry {
  private val location = IntArray(2)

  /** Le cadre d'une vue dans sa fenêtre, transformations comprises (une carte
   *  agrandie au focus), comme `convertRect:toView:nil` sur Apple TV. */
  fun box(view: View): RectF {
    view.getLocationInWindow(location)
    val left = location[0].toFloat()
    val top = location[1].toFloat()
    return RectF(left, top, left + view.width * view.scaleX, top + view.height * view.scaleY)
  }

  fun isDescendant(view: View, ancestor: View): Boolean {
    var v: Any? = view.parent
    while (v is View) {
      if (v === ancestor) return true
      v = v.parent
    }
    return false
  }

  private const val SCREEN_CLASS = "com.swmansion.rnscreens.Screen"

  /** L'écran (react-native-screens) qui porte la vue — le pendant du
   *  `reactViewController` d'Apple TV : une section d'un écran empilé dessous
   *  n'est jamais visée. Null hors d'une pile d'écrans. */
  fun screenOf(view: View): View? {
    var v: Any? = view.parent
    while (v is View) {
      if (v.javaClass.name == SCREEN_CLASS) return v
      v = v.parent
    }
    return null
  }

  private val guideFields: Pair<Field?, Field?> by lazy {
    fun field(name: String): Field? =
      runCatching { ReactViewGroup::class.java.getDeclaredField(name).apply { isAccessible = true } }.getOrNull()
    field("focusDestinations") to field("autoFocus")
  }

  /** Un guide de focus (`TVFocusGuideView` : des `destinations`, ou `autoFocus`) —
   *  la règle de `ReactViewGroup.isTVFocusGuide`, qui n'est pas publique. */
  fun isFocusGuide(view: View): Boolean {
    if (view !is ReactViewGroup) return false
    val (destinations, autoFocus) = guideFields
    val targets = runCatching { destinations?.get(view) as? IntArray }.getOrNull()
    return (targets != null && targets.isNotEmpty()) || runCatching { autoFocus?.getBoolean(view) }.getOrNull() == true
  }

  private val trapFields: Map<Int, Field?> by lazy {
    fun field(name: String): Field? =
      runCatching { ReactViewGroup::class.java.getDeclaredField(name).apply { isAccessible = true } }.getOrNull()
    mapOf(
      View.FOCUS_UP to field("trapFocusUp"),
      View.FOCUS_DOWN to field("trapFocusDown"),
      View.FOCUS_LEFT to field("trapFocusLeft"),
      View.FOCUS_RIGHT to field("trapFocusRight"),
    )
  }

  /** Le conteneur le plus proche qui RETIENT le focus dans cette direction
   *  (`TVFocusGuideView trapFocus*`, un panneau) : la règle n'en sort pas
   *  plus que le moteur d'Android. */
  fun trapOf(view: View, direction: Int): View? {
    val field = trapFields[direction] ?: return null
    var v: Any? = view.parent
    while (v is View) {
      if (v is ReactViewGroup && runCatching { field.getBoolean(v) }.getOrDefault(false)) return v
      v = v.parent
    }
    return null
  }

  /** La section la plus proche au-dessus de `view` (elle-même comprise). */
  fun innermostSection(view: View): TentacleFocusSection? {
    var v: Any? = view
    while (v is View) {
      if (v is TentacleFocusSection) return v
      v = v.parent
    }
    return null
  }

  /** La section de VOISINAGE la plus proche au-dessus de `view`. */
  fun innermostNeighborSection(view: View): TentacleFocusSection? {
    var v: Any? = view
    while (v is View) {
      if (v is TentacleFocusSection && v.tvNeighbors) return v
      v = v.parent
    }
    return null
  }

  /** Le premier ancêtre de `view` de la classe voulue, sans dépasser `stop`. */
  inline fun <reified T : ViewGroup> ancestor(view: View, stop: View? = null): T? {
    var v: Any? = view.parent
    while (v is View && v !== stop) {
      if (v is T) return v
      v = v.parent
    }
    return null
  }
}
