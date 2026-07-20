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
 */

import { useEffect, useRef, useState } from "react";

export function useNearViewport<T extends HTMLElement>(rootMargin = "600px") {
  const ref = useRef<T | null>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    if (near) return;
    const el = ref.current;
    if (!el) return;
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
    observer.observe(el);
    return () => observer.disconnect();
  }, [near, rootMargin]);

  return { ref, near };
}
