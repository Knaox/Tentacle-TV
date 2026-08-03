import { Link } from "react-router-dom";
import { Search, Home, Bookmark, Heart, Library, Settings } from "lucide-react";
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
 */

const ICONES: Record<IconeRail, typeof Home> = {
  recherche: Search,
  accueil: Home,
  liste: Bookmark,
  favoris: Heart,
  bibliotheque: Library,
  reglages: Settings,
};

interface ProprietesRailEntree {
  entree: EntreeRail;
  active: boolean;
  deploye: boolean;
}

export function RailEntree({ entree, active, deploye }: ProprietesRailEntree) {
  const Icone = ICONES[entree.icone];

  return (
    <Link
      to={entree.chemin}
      className="rail-entree"
      data-active={active}
      aria-current={active ? "page" : undefined}
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
