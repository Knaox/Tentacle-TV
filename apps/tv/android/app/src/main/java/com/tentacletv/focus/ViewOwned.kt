package com.tentacletv.focus

import android.view.View
import java.util.Collections
import java.util.WeakHashMap

/**
 * Un objet par vue, TENU PAR LA VUE (une étiquette `View.setTag(int, …)`) :
 * il vit et meurt avec elle.
 *
 * Pourquoi pas un `WeakHashMap<View, Objet>` : si l'objet garde sa vue (ce
 * que font un suiveur de défilement ou un gardien de section), la valeur
 * retient la clé, et l'entrée ne part JAMAIS — la vue, toute sa descendance
 * (les vues retirées que `mTransitioningViews` garde encore) et leurs images
 * restaient en mémoire après le démontage de leur écran. Mesuré à
 * l'émulateur (tâche L6, 07/10) : ~1 200 vues détachées de plus à chaque tour
 * d'endurance, 2 794 au 3e tour, presque toutes retenues par les tables de
 * `ShownKeeper` et `RevealFollower`.
 *
 * Ici, la table des vues connues (`views`) n'a pas de valeur : rien ne retient
 * ses clés. Elle sert seulement à parcourir les objets vivants (`each`).
 */
internal class ViewOwned<V : View, T : Any>(private val tagKey: Int, private val create: (V) -> T) {
  private val views: MutableSet<V> = Collections.newSetFromMap(WeakHashMap())

  fun of(view: V): T {
    @Suppress("UNCHECKED_CAST")
    (view.getTag(tagKey) as? T)?.let { return it }
    val owned = create(view)
    view.setTag(tagKey, owned)
    views.add(view)
    return owned
  }

  /** Chaque objet encore vivant (sa vue n'est pas ramassée). */
  fun each(action: (T) -> Unit) {
    for (view in views.toList()) {
      @Suppress("UNCHECKED_CAST")
      (view.getTag(tagKey) as? T)?.let(action)
    }
  }
}
