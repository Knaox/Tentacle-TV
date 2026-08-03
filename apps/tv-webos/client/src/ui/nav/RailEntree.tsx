import { useCallback, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Home, Bookmark, Heart, Library, Settings, Eye } from "lucide-react";
import { creerAppuiLong } from "../../focus/appuiLong";
import { ouvrirRecherche } from "../recherche/etatRecherche";
import { useEpinglageRail } from "./epinglageTv";
import type { EntreeRail, IconeRail } from "./entreesRail";

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
 * `preventDefault` de `creerAppuiLong` — sans quoi le maintien navi­guerait ET
 * masquerait.
 */

const ICONES: Record<IconeRail, typeof Home> = {
  recherche: Search,
  accueil: Home,
  liste: Bookmark,
  favoris: Heart,
  bibliotheque: Library,
  reglages: Settings,
  restaurer: Eye,
};

interface ProprietesRailEntree {
  entree: EntreeRail;
  active: boolean;
  deploye: boolean;
}

export function RailEntree({ entree, active, deploye }: ProprietesRailEntree) {
  const Icone = ICONES[entree.icone];
  const navigate = useNavigate();
  const lien = useRef<HTMLAnchorElement>(null);
  const epinglage = useEpinglageRail();

  const actionCourte = useCallback(() => {
    if (entree.cherche) {
      ouvrirRecherche();
      return;
    }
    if (entree.restaure) {
      epinglage.toutAfficher();
      return;
    }
    navigate(entree.chemin);
  }, [entree.chemin, entree.cherche, entree.restaure, epinglage, navigate]);

  /**
   * Masquer l'entrée la retire du document, donc emporte le focus avec elle.
   * On vise le voisin AVANT de basculer — le nœud survit au rendu, React le
   * garde par sa clé — puis on lui donne le focus au tour de boucle suivant,
   * quand la liste a été redessinée.
   */
  const actionLongue = useCallback(() => {
    const item = lien.current?.closest("li");
    const voisin = item?.nextElementSibling ?? item?.previousElementSibling ?? null;
    const cible = voisin ? voisin.querySelector<HTMLElement>(".rail-entree") : null;

    epinglage.basculer(entree.cle);
    if (cible) window.setTimeout(() => cible.focus(), 0);
  }, [entree.cle, epinglage]);

  const appui = useMemo(
    () =>
      creerAppuiLong({
        court: actionCourte,
        long: entree.masquable ? actionLongue : undefined,
      }),
    [actionCourte, actionLongue, entree.masquable],
  );

  return (
    <Link
      ref={lien}
      to={entree.chemin}
      className="rail-entree"
      data-active={active}
      data-masquable={entree.masquable || undefined}
      aria-current={active ? "page" : undefined}
      /* Le pointeur de la Magic Remote passe par le clic, pas par les touches :
         sans cette interception, viser « Rechercher » suivrait le `href` au lieu
         d'ouvrir la surcouche. Tout passe par la même action, quelle que soit
         l'entrée employée. */
      onClick={(evenement) => {
        evenement.preventDefault();
        actionCourte();
      }}
      onKeyDown={appui.onKeyDown}
      onKeyUp={appui.onKeyUp}
      onBlur={appui.onBlur}
    >
      <span className="rail-entree-icone" aria-hidden>
        <Icone size={26} strokeWidth={2} />
      </span>
      <span className="rail-entree-libelle" data-deploye={deploye}>
        {entree.libelle}
      </span>
    </Link>
  );
}
