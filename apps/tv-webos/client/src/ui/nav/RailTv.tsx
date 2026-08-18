import { useCallback, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TentacleLogo } from "@/components/ui/TentacleLogo";
import { useEntreesRail, entreeActive } from "./railEntries";
import { RailEntree } from "./RailEntry";

/**
 * Navigation principale du téléviseur.
 *
 * Un rail d'icônes en permanence à gauche, qui se déploie et nomme ses
 * destinations dès que le focus y entre. C'est le patron des interfaces de
 * salon, et il tient à deux propriétés :
 *
 * - **il est toujours là**, donc on sait qu'il existe et par où y aller — une
 *   navigation qu'il faut deviner est une navigation qu'on n'utilise pas ;
 * - **il passe par-dessus**, il ne pousse pas. Décaler le contenu à chaque
 *   entrée du focus ferait bouger toutes les rangées, c'est-à-dire la
 *   géométrie sur laquelle le moteur de navigation vient de calculer.
 *
 * Le déploiement est piloté par `onFocus`/`onBlur` React et **non** par
 * `:focus-within` : cette pseudo-classe arrive avec Chrome 60 et la garde de
 * compatibilité la refuse. Les événements de focus remontent dans le système
 * synthétique de React, un seul gestionnaire sur le conteneur suffit donc.
 */
export function RailTv() {
  const { pathname } = useLocation();
  const { t } = useTranslation("nav");
  const entrees = useEntreesRail();
  const active = entreeActive(entrees, pathname);
  const [deploye, setDeploye] = useState(false);
  const sortie = useRef<ReturnType<typeof setTimeout> | null>(null);

  const surFocus = useCallback(() => {
    if (sortie.current !== null) clearTimeout(sortie.current);
    setDeploye(true);
  }, []);

  /**
   * Le repli attend un tour de boucle.
   *
   * Passer d'une entrée à l'autre produit un `blur` immédiatement suivi d'un
   * `focus` : replier sur le premier ferait clignoter le rail à chaque
   * déplacement vertical.
   */
  const surBlur = useCallback(() => {
    if (sortie.current !== null) clearTimeout(sortie.current);
    sortie.current = setTimeout(() => setDeploye(false), 0);
  }, []);

  return (
    <nav
      className="rail-tv"
      data-deploye={deploye}
      aria-label={t("railLabel")}
      onFocus={surFocus}
      onBlur={surBlur}
    >
      {/* Le panneau qui porte les libellés, posé derrière les entrées.
          `aria-hidden` et sans événements : il ne doit ni recevoir le focus ni
          intercepter un clic du pointeur de la télécommande. */}
      <span className="rail-panneau" data-deploye={deploye} aria-hidden />

      {/* La marque, en haut du rail — c'est la place qu'elle occupe sur Android
          TV, et la seule qui soit visible en permanence sans rien prendre au
          contenu. Le poulpe seul quand le rail est replié, le nom en plus
          quand le focus le déploie : il déborde alors sur le panneau, comme les
          libellés des entrées.

          Pas focusable, et ce n'est pas un oubli : il ne mène nulle part, et la
          discipline du parcours veut qu'on ne vise que ce qui agit. */}
      {/* `lg` (56 px) et non `md` (32) : le canevas du téléviseur est celui de
          la dalle, 1920, alors que le `md` du web est dimensionné pour un
          écran regardé à cinquante centimètres. À trois mètres, les tentacules
          du poulpe tombaient sous la taille d'un détail lisible et la marque
          se lisait comme une tache. C'est le seul élément du rail qui portait
          encore une taille de bureau. */}
      <div className="rail-marque">
        <TentacleLogo size="lg" variant="bare" />
        <span className="rail-marque-nom" data-deploye={deploye}>
          Tentacle TV
        </span>
      </div>

      <ul className="rail-liste">
        {entrees.map((entree) => (
          <li key={entree.cle}>
            <RailEntree entree={entree} active={entree.cle === active} deploye={deploye} />
          </li>
        ))}
      </ul>

      {/* Le geste ne se devine pas, et un rail qu'on ne sait pas tailler reste
          tel qu'on l'a reçu. L'indice n'apparaît qu'au déploiement, et sa place
          est réservée dans les deux états : la géométrie sur laquelle le moteur
          de navigation vient de calculer ne doit pas bouger sous lui. */}
      <p className="rail-indice" data-deploye={deploye}>
        {t("railHint")}
      </p>
    </nav>
  );
}
