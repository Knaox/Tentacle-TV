import { useCallback, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Home, Bookmark, Heart, Library, Settings, Eye } from "lucide-react";
import { createLongPress } from "../../focus/longPress";
import { primeFocus } from "../../focus/entry";
import { openSearch } from "../search/searchState";
import { useRailPinning } from "./pinningTv";
import type { EntreeRail, RailIcon } from "./railEntries";

/**
 * Une entrée du rail : une icône, et un libellé qui n'apparaît qu'au déploiement.
 *
 * L'icône seule ne suffit jamais à identifier une destination — c'est le
 * reproche fait à toutes les navigations en icônes —, mais elle suffit à s'y
 * retrouver une fois qu'on connaît la place. D'où le rail : replié il rappelle
 * la position, déployé il nomme.
 *
 * Le libellé n'est pas retiré du document au repli : il est masqué par
 * `opacity` et `clip`, ce qui le laisse lisible aux lecteurs d'écran et évite
 * un reflux de mise en page au déploiement.
 *
 * **Le maintien de OK retire l'entrée du rail.** C'est le même geste que sur
 * une carte, et il reste un `<a href>` : le moteur de navigation le recense
 * comme n'importe quel lien, et `aria-current` continue de dire où l'on est.
 * L'activation native d'Entrée sur un lien est neutralisée par le
 * `preventDefault` de `createLongPress` — sans quoi le maintien navi­guerait ET
 * masquerait.
 */

const ICONS: Record<RailIcon, typeof Home> = {
  recherche: Search,
  accueil: Home,
  liste: Bookmark,
  favoris: Heart,
  bibliotheque: Library,
  reglages: Settings,
  restaurer: Eye,
};

interface RailEntryProps {
  entree: EntreeRail;
  active: boolean;
  expanded: boolean;
}

export function RailEntree({ entree, active, expanded }: RailEntryProps) {
  const Icon = ICONS[entree.icon];
  const navigate = useNavigate();
  const lien = useRef<HTMLAnchorElement>(null);
  const pinning = useRailPinning();

  /**
   * Activer une entrée referme le rail.
   *
   * Il ne se repliait jamais : le repli n'a qu'une cause, un `blur` non suivi
   * d'un `focus`, et il n'y en avait pas. `RailTv` vit hors de l'`<Outlet>`,
   * donc la navigation ne le démonte pas ; le `<a>` survit à la réconciliation
   * grâce à sa clé stable, `document.activeElement` ne change pas. On restait
   * donc sur l'écran d'arrivée avec la navigation ouverte par-dessus.
   *
   * On rend donc la main explicitement, en deux temps. Le `blur` referme le
   * rail immédiatement — c'est la partie qui doit être certaine. Puis
   * `primeFocus` pose le focus sur le premier élément de l'écran d'arrivée,
   * au tour de boucle suivant pour lui laisser le temps de se monter ; s'il
   * n'est pas encore là, le focus reste sur le document et le premier appui sur
   * une flèche l'y amènera de toute façon. Aucune des deux étapes ne dépend de
   * l'autre pour que le rail se referme.
   */
  const shortAction = useCallback(() => {
    if (entree.searching) {
      openSearch();
      return;
    }
    if (entree.restored) {
      pinning.showAll();
      return;
    }
    navigate(entree.path);
    lien.current?.blur();
    window.setTimeout(() => primeFocus(), 0);
  }, [entree.path, entree.searching, entree.restored, pinning, navigate]);

  /**
   * Masquer l'entrée la retire du document, donc emporte le focus avec elle.
   * On vise le voisin AVANT de basculer — le nœud survit au rendu, React le
   * garde par sa clé — puis on lui donne le focus au tour de boucle suivant,
   * quand la liste a été redessinée.
   */
  const longAction = useCallback(() => {
    const item = lien.current?.closest("li");
    const neighbor = item?.nextElementSibling ?? item?.previousElementSibling ?? null;
    const target = neighbor ? neighbor.querySelector<HTMLElement>(".rail-entree") : null;

    pinning.toggle(entree.key);
    if (target) window.setTimeout(() => target.focus(), 0);
  }, [entree.key, pinning]);

  const press = useMemo(
    () =>
      createLongPress({
        short: shortAction,
        long: entree.hideable ? longAction : undefined,
      }),
    [shortAction, longAction, entree.hideable],
  );

  return (
    <Link
      ref={lien}
      to={entree.path}
      className="rail-entree"
      data-active={active}
      data-hideable={entree.hideable || undefined}
      aria-current={active ? "page" : undefined}
      /* Le pointeur de la Magic Remote passe par le clic, pas par les touches :
         sans cette interception, viser « Rechercher » suivrait le `href` au lieu
         d'ouvrir la surcouche. Tout passe par la même action, quelle que soit
         l'entrée employée. */
      onClick={(event) => {
        event.preventDefault();
        shortAction();
      }}
      onKeyDown={press.onKeyDown}
      onKeyUp={press.onKeyUp}
      onBlur={press.onBlur}
    >
      <span className="rail-entree-icone" aria-hidden>
        <Icon size={26} strokeWidth={2} />
      </span>
      <span className="rail-entree-libelle" data-expanded={expanded}>
        {entree.label}
      </span>
    </Link>
  );
}
