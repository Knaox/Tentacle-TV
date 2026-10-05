package com.tentacletv.focus

import android.view.View
import java.lang.ref.WeakReference
import java.util.WeakHashMap

/**
 * Le filet du RE-PARENTAGE (Android, ancienne architecture).
 *
 * React Native aplatit une `View` qui n'a que des props de mise en page ; si
 * une prop d'affichage (un `zIndex` posé au focus…) lui arrive, il la crée et
 * y re-parente ses enfants : retirés puis remis, dans le même lot. Le
 * focalisé retiré perd le focus, qu'Android rend aussitôt au PREMIER
 * focalisable de la fenêtre (`rootViewRequestFocus` : le héros) — un BAS
 * remontait au héros. Les enveloppes connues ne s'aplatissent plus
 * (`collapsable={false}` : `CardShell`, `MorphCard`, `ProfileTile`) ; ce filet
 * couvre les autres : le focus perdu par un élément DÉTACHÉ, que le même lot
 * a remis à sa place, lui revient — à moins que le focus ait été repris
 * ailleurs entre-temps. Un élément vraiment démonté reste démonté : rien.
 *
 * Aucune décision de navigation ici : seulement rendre ce que la plateforme a
 * retiré par accident. Un écouteur par fenêtre.
 */
internal object ReparentGuard {
  private val roots = WeakHashMap<View, Boolean>()

  fun install(anyView: View) {
    val root = anyView.rootView ?: return
    if (roots.containsKey(root)) return
    roots[root] = true
    var last: WeakReference<View>? = null
    root.viewTreeObserver.addOnGlobalFocusChangeListener { old, new ->
      val previous = last?.get()
      last = new?.let { WeakReference(it) }
      // `old` nul : le focus a été effacé (élément retiré), puis rendu au premier focalisable.
      if (old != null || previous == null || previous === new || previous.isAttachedToWindow) return@addOnGlobalFocusChangeListener
      val lost = WeakReference(previous)
      val taken = new?.let { WeakReference(it) }
      root.post {
        val view = lost.get() ?: return@post
        if (view.isAttachedToWindow && view.isShown && view.isFocusable && root.findFocus() === taken?.get()) view.requestFocus()
      }
    }
  }
}
