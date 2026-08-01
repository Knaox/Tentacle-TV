/**
 * Un SEUL observateur d'intersection pour toutes les cellules d'une surface.
 *
 * # Pourquoi pas `useInViewport` par cellule
 *
 * Il crée un `IntersectionObserver` **et** un écouteur `visibilitychange` sur
 * `document` par instance. Sur une grille de trois cents titres, cela fait trois
 * cents observateurs et trois cents écouteurs — dont chacun déclenche un rendu
 * à la moindre perte de focus de la fenêtre. C'est le problème qu'on vient de
 * retirer des cartes de rangée, il n'y a aucune raison de le réintroduire dans
 * les grilles.
 *
 * Ici : un observateur par grille, une entrée par cellule, un rappel direct sans
 * état partagé. Le coût d'une cellule de plus est une entrée dans une `WeakMap`.
 */

type Rappel = (proche: boolean) => void;

export interface RevealObserver {
  /**
   * Commence à surveiller un élément. Rend la fonction de désabonnement.
   *
   * Il n'y a volontairement PAS de `disconnect()` global : chaque cellule se
   * désabonne elle-même, et un retrait de toutes les cibles d'un coup pouvait
   * s'exécuter après que les cellules se soient réabonnées — l'observateur ne
   * livrait alors plus rien (cf. `RevealScope`).
   */
  observe(el: Element, rappel: Rappel): () => void;
}

/**
 * `rootMargin` généreux par défaut : une cellule doit être montée AVANT
 * d'entrer dans le champ, sinon on voit son contenu apparaître. 600 px valent
 * environ un écran et demi de marge sur une grille d'affiches — largement le
 * temps qu'une image sorte du cache HTTP et se décode.
 */
export function creerRevealObserver(rootMargin = "600px"): RevealObserver {
  const rappels = new WeakMap<Element, Rappel>();

  // Sans `IntersectionObserver` (environnement de test, très vieux moteur), tout
  // est déclaré proche : mieux vaut tout monter que tout laisser vide.
  if (typeof IntersectionObserver !== "function") {
    return {
      observe(_el, rappel) {
        rappel(true);
        return () => {};
      },
    };
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        rappels.get(entry.target)?.(entry.isIntersecting);
      }
    },
    { rootMargin },
  );

  return {
    observe(el, rappel) {
      rappels.set(el, rappel);
      observer.observe(el);
      return () => {
        observer.unobserve(el);
        rappels.delete(el);
      };
    },
  };
}
