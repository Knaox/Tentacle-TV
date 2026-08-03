import { Outlet } from "react-router-dom";
import { RailTv } from "./nav/RailTv";

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
      <RailTv />
      {/* La marge gauche vaut la largeur du rail replié : le contenu commence
          après les icônes, et ne bouge plus quand elles se déploient. */}
      <div className="pl-[var(--rail-largeur-repli)]">
        <Outlet />
      </div>
    </div>
  );
}
