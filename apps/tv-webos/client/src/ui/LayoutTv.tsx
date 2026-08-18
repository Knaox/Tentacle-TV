import { Outlet } from "react-router-dom";
import { RailTv } from "./nav/RailTv";
import { FondFocusTv } from "./hero/FocusBackdropTv";
import { EcranRechercheTv } from "./search/SearchScreenTv";

/**
 * Disposition du client téléviseur.
 *
 * Substituée à `AppLayout`. Trois choses disparaissent, et chacune parce
 * qu'elle n'a pas de sens à trois mètres :
 *
 * - **la barre horizontale**, dont les huit commandes de droite — recherche,
 *   notifications, visionnage synchronisé, avatar — obligeaient à traverser
 *   tout l'écran pour changer de section ;
 * - **la barre d'onglets mobile**, qui se déclenchait sous 768 px de large ;
 * - **la bannière de version**, qui appartient à un poste d'administration.
 *
 * Reste le rail, et le contenu. Le contenu n'est pas décalé pour lui : le rail
 * passe par-dessus au déploiement, ce qui laisse la géométrie des rangées
 * stable sous le focus.
 *
 * Le `brand-ambient` est conservé — c'est le dégradé de fond de l'application,
 * il coûte une passe de composition à l'ouverture et rien ensuite.
 */
export function AppLayout() {
  return (
    <div className="min-h-screen bg-surface-0">
      <div className="brand-ambient" aria-hidden />
      {/* L'affiche de la carte visée, floutée en fond. Ne rend rien tant
          qu'aucune carte n'a le focus depuis un quart de seconde. */}
      <FondFocusTv />
      <RailTv />
      {/* La marge gauche vaut la largeur du rail replié : le contenu commence
          après les icônes, et ne bouge plus quand elles se déploient. */}
      <div className="pl-[var(--rail-largeur-repli)]">
        <Outlet />
      </div>

      {/* La recherche est une surcouche, pas une route : `App.tsx` n'est pas
          modifié, et le client web ne fait pas autrement — la sienne est un
          portail ouvert par un raccourci. Montée ici plutôt que dans le rail,
          elle survit à un changement d'écran et ne dépend pas de qui l'a
          ouverte. Elle ne rend rien tant qu'elle est fermée. */}
      <EcranRechercheTv />
    </div>
  );
}
