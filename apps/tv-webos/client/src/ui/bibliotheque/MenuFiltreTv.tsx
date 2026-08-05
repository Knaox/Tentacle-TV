import type { ComponentProps } from "react";
import { FilterMenu as MenuWeb } from "@/components/library/FilterMenu";
import { useMarqueur } from "../marqueur";
import { ATTRIBUT_ENTREE } from "../../focus/zones";

/**
 * Les menus de filtres d'une bibliothèque, pilotables à la télécommande.
 *
 * L'original est écrit pour une souris, et trois de ses choix ne survivent pas
 * au salon. L'enveloppe les reprend sans le forker — elle marque ce qu'il a
 * rendu, comme les autres enveloppes du portage.
 *
 * **Le rôle passe du contenu au PANNEAU.** Trois menus sur cinq posaient
 * `role="menu"` sur un conteneur intérieur ; années et note n'en posaient
 * aucun. Or c'est ce rôle que `conteneurPiegeant` reconnaît : ces deux-là ne
 * confinaient donc rien, le D-pad s'en échappait vers la grille et le panneau
 * restait déployé derrière. En le posant sur le panneau lui-même, les cinq
 * piègent, et le champ de recherche des genres — frère du conteneur intérieur,
 * donc jusqu'ici hors du piège et inatteignable — y entre enfin. Le rôle
 * intérieur est retiré : `conteneurPiegeant` retient le DERNIER en ordre de
 * document, et le laisser ferait du sous-ensemble le piège, ce qu'on vient de
 * défaire.
 *
 * **Le panneau s'élargit par sa propriété**, pas par la feuille. `min-width`
 * sur un conteneur à largeur en ligne et `overflow-hidden` ne l'élargit pas :
 * il déborde à l'intérieur et se fait couper. Mesuré à quatre-vingts pixels de
 * contenu perdus à droite, anneau de focus compris.
 *
 * **On entre par l'option en cours.** Le reste — l'entrée transversale, la
 * sortie par « haut », la fermeture par Retour — appartient au moteur et vaut
 * pour tous les pièges.
 *
 * Ce qu'on ne change pas : choisir une option ne referme pas le menu. C'est ce
 * qu'il faut pour les genres et les plateformes, où l'on coche plusieurs
 * lignes ; et la sortie est désormais à un seul appui.
 */

/** Largeur minimale d'un panneau, à trois mètres. */
const LARGEUR_MINIMALE = 380;

export function FilterMenu(proprietes: ComponentProps<typeof MenuWeb>) {
  const cadre = useMarqueur<HTMLDivElement>(equiperPanneau);

  return (
    <div ref={cadre}>
      <MenuWeb {...proprietes} width={Math.max(proprietes.width ?? 0, LARGEUR_MINIMALE)} />
    </div>
  );
}

/** Idempotent : chaque écriture est gardée par la valeur qu'elle poserait. */
function equiperPanneau(cadre: HTMLElement): void {
  const declencheur = cadre.querySelector<HTMLElement>('[aria-haspopup="true"]');
  const panneau = declencheur?.nextElementSibling;
  if (!(panneau instanceof HTMLElement)) return;

  if (panneau.getAttribute("role") !== "menu") {
    panneau.setAttribute("role", "menu");
    panneau.setAttribute("data-tv-zone", "menu-filtre");
  }

  for (const interne of panneau.querySelectorAll<HTMLElement>('[role="menu"]')) {
    if (interne !== panneau) interne.removeAttribute("role");
  }

  const cochee = panneau.querySelector<HTMLElement>('[aria-checked="true"]');
  const actuelle = panneau.querySelector<HTMLElement>(`[${ATTRIBUT_ENTREE}]`);
  if (actuelle === cochee) return;

  actuelle?.removeAttribute(ATTRIBUT_ENTREE);
  cochee?.setAttribute(ATTRIBUT_ENTREE, "");
}
