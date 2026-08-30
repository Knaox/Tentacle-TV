/**
 * « La cible approche-t-elle du viewport ? » — verrou à sens unique : une fois
 * vrai, il le reste (on ne veut pas décharger ce qu'on a déjà chargé).
 *
 * Sert à différer des REQUÊTES, pas seulement du rendu : `MediaRow` sait déjà
 * ne pas peindre une rangée hors écran, mais ses données étaient téléchargées
 * quand même.
 *
 * `rootMargin` volontairement généreuse : on déclenche AVANT que la rangée
 * entre dans le viewport, pour que les données arrivent pendant le scroll et
 * non après — sinon on remplacerait une économie par une attente visible.
 *
 * ⚠️ `ref` est un CALLBACK, pas un `useRef` : l'ancienne version lisait
 * `ref.current` dans son effet et rendait la main s'il était nul — une cible
 * absente au premier passage (ou remplacée ensuite) n'était plus JAMAIS
 * observée : le rail restait figé en squelette, sa requête jamais lancée.
 * L'élément vit désormais dans un état, et l'effet se rejoue quand il change.
 */

import { useCallback, useEffect, useState } from "react";

export function useNearViewport<T extends HTMLElement>(rootMargin = "600px") {
  const [element, setElement] = useState<T | null>(null);
  const ref = useCallback((el: T | null) => setElement(el), []);
  const [near, setNear] = useState(false);

  useEffect(() => {
    if (near || !element) return;
    // Pas d'IntersectionObserver (environnement de test, moteur ancien) : on
    // débloque tout de suite. Ne jamais retenir du contenu par défaut.
    if (typeof IntersectionObserver !== "function") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setNear(true);
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [near, element, rootMargin]);

  return { ref, near };
}
