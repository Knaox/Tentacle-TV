import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Arriver sur `/admin/services#publicurl` mène À la section — et au champ
 * qu'on vient y remplir.
 *
 * Ni le routeur ni le navigateur ne le faisaient : la page arrive en
 * chargement différé, bien après que le navigateur a cherché l'ancre, et une
 * navigation interne ne la cherche jamais. Le lien « Configurer maintenant »
 * du verrou de jumelage TV ouvrait donc la page tout en haut.
 *
 * On attend que les sections aient leur hauteur finale (`ready`), sinon la
 * cible glisse pendant que celles du dessus se remplissent. Une fois par
 * navigation (`location.key`) : revenir sur la même tuile y ramène aussi.
 */
export function useHashTarget(ready: boolean): void {
  const location = useLocation();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    const id = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (!id || !ready || handled.current === location.key) return;
    const target = document.getElementById(id);
    if (!target) return;
    handled.current = location.key;
    // Un saut, comme une ancre native : un défilement « doux » se joue image
    // par image, et reste en plan dans un onglet que le navigateur met au repos.
    target.scrollIntoView({ block: "start" });
    // Le champ que la section désigne (la clé Jellyfin, l'adresse publique).
    target.querySelector<HTMLElement>("[data-hash-focus]")?.focus({ preventScroll: true });
  }, [location.key, location.hash, ready]);
}
