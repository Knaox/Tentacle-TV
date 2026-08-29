import { useEffect, useRef, type RefObject } from "react";

/**
 * Marquer ce que le client web a rendu, sans le re-rendre.
 *
 * Le portage a besoin de poser des attributs — `data-tv-piste`,
 * `data-tv-zone-entree` — sur des nœuds qu'il n'écrit pas : ceux d'`apps/web`,
 * qui ignore l'existence du téléviseur. Un `useEffect` simple ne suffit pas,
 * car ces nœuds arrivent avec leurs DONNÉES, plusieurs rendus après le nôtre —
 * les tuiles d'extras avec leur requête, le bouton de lecture avec l'état de
 * visionnage — sans que l'enveloppe soit re-rendue. D'où l'observation.
 *
 * `mark` doit être IDEMPOTENT : il est appelé à chaque mutation de sa
 * racine, et il peut lui-même en produire une. Les attributs ne sont pas
 * observés, ce qui coupe la boucle la plus évidente, mais une écriture
 * inconditionnelle resterait du travail inutile à chaque image d'une
 * animation. Écrire seulement quand la valeur change est la règle.
 */
export function useMarker<T extends HTMLElement>(
  mark: (racine: T) => void,
): RefObject<T | null> {
  const racine = useRef<T>(null);
  // La fonction est relue à chaque appel plutôt que capturée : l'appelant peut
  // la redéfinir à chaque rendu — c'est le cas courant d'une fermeture sur des
  // propriétés — sans que l'observateur soit débranché puis rebranché.
  const last = useRef(mark);
  last.current = mark;

  useEffect(() => {
    const target = racine.current;
    if (!target) return;

    const apply = () => last.current(target);
    apply();

    const observer = new MutationObserver(apply);
    observer.observe(target, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return racine;
}
