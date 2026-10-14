/**
 * Le COMPAGNON d'un survol : un élément rendu AILLEURS dans le document (un
 * portail sur <body>) qui compte comme la carte qui l'a ouvert. Le pointeur
 * posé sur la mini-carte d'aperçu n'a quitté ni sa carte ni sa rangée : React
 * le sait (son arbre de composants les relie), `useHoverGuard`, qui interroge
 * l'arbre du DOCUMENT après chaque défilement, ne le sait que par ici.
 *
 * Un seul à la fois : il n'y a jamais qu'une mini-carte d'aperçu. Inerte là où
 * personne ne s'inscrit (le client des téléviseurs LG ne monte pas d'aperçu).
 */

interface HoverCompanion {
  /** L'élément de la carte qui a ouvert le compagnon (son visuel). */
  anchor: Element;
  /** Le compagnon lui-même. */
  element: Element;
}

let current: HoverCompanion | null = null;

/** Inscrit un compagnon ; rend de quoi le retirer — sans effacer celui qui l'aurait remplacé. */
export function setHoverCompanion(anchor: Element, element: Element): () => void {
  const companion = { anchor, element };
  current = companion;
  return () => {
    if (current === companion) current = null;
  };
}

/** `hit` est-il dans le compagnon d'une carte que `el` contient ? */
export function withinHoverCompanion(el: Element, hit: Element): boolean {
  return current !== null && current.element.contains(hit) && el.contains(current.anchor);
}
