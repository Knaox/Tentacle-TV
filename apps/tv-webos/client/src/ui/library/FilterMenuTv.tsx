import { useRef, type ComponentProps } from "react";
import { FilterMenu as MenuWeb } from "@/components/library/FilterMenu";
import { useMarqueur } from "../marker";
import { ATTRIBUT_ENTREE, destinationEntreeDeZone } from "../../focus/zones";
import { donnerFocus } from "../../focus/active";
import { reviserApresMontage } from "../../focus/wait";

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
 * **On entre par l'option en cours, et on y entre TOUT DE SUITE.** Ouvrir un
 * menu laissait le focus sur la pastille : il fallait un appui de plus pour
 * atteindre la première ligne, et rien à l'écran ne le disait — on croyait le
 * menu inerte. Le moteur ne pouvait pas s'en charger : il ne déplace le focus
 * qu'aux appuis directionnels, et ses deux repose-focus renoncent dès qu'un
 * élément est focalisé, ce qui est le cas de la pastille. C'est donc à
 * l'enveloppe de le faire — et c'est sa place, deux des quatre surfaces
 * piégeantes du portage posant déjà le leur, chacune mieux qu'une règle
 * générale ne saurait : le panneau de choix vise la valeur en cours, l'écran
 * de recherche vise son champ EXPRÈS, pour faire monter le clavier.
 *
 * **Sauf quand la zone n'offre que des champs de saisie.** Le menu des années
 * n'a que deux champs numériques : y entrer ferait surgir le pavé du
 * téléviseur sans qu'on ait rien demandé. Rien ne doit faire monter un clavier
 * sans un geste explicite — une flèche en est un, l'ouverture d'un menu n'en
 * est pas un. Le curseur de la note, lui, n'est pas un clavier : on y entre.
 *
 * Le reste — l'entrée transversale, la sortie par « haut », la fermeture par
 * Retour — appartient au moteur et vaut pour tous les pièges.
 *
 * Ce qu'on ne change pas : choisir une option ne referme pas le menu. C'est ce
 * qu'il faut pour les genres et les plateformes, où l'on coche plusieurs
 * lignes ; et la sortie est désormais à un seul appui.
 */

/** Largeur minimale d'un panneau, à trois mètres. */
const LARGEUR_MINIMALE = 380;

export function FilterMenu(proprietes: ComponentProps<typeof MenuWeb>) {
  // Le panneau déjà servi. `useMarqueur` ne dit pas « il vient d'apparaître »,
  // il dit « quelque chose a bougé » — et il tire à chaque frappe dans le champ
  // des genres. Sans cette mémoire, on reprendrait le focus à l'utilisateur en
  // train de saisir.
  const servi = useRef<HTMLElement | null>(null);
  const cadre = useMarqueur<HTMLDivElement>((element) => equiperPanneau(element, servi));

  return (
    <div ref={cadre}>
      <MenuWeb {...proprietes} width={Math.max(proprietes.width ?? 0, LARGEUR_MINIMALE)} />
    </div>
  );
}

/** Idempotent : chaque écriture est gardée par la valeur qu'elle poserait. */
function equiperPanneau(cadre: HTMLElement, servi: { current: HTMLElement | null }): void {
  const declencheur = cadre.querySelector<HTMLElement>('[aria-haspopup="true"]');
  const panneau = declencheur?.nextElementSibling;
  if (!(panneau instanceof HTMLElement)) {
    servi.current = null;
    return;
  }

  if (panneau.getAttribute("role") !== "menu") {
    panneau.setAttribute("role", "menu");
    panneau.setAttribute("data-tv-zone", "menu-filtre");
  }

  for (const interne of panneau.querySelectorAll<HTMLElement>('[role="menu"]')) {
    if (interne !== panneau) interne.removeAttribute("role");
  }

  marquerEntree(panneau);

  if (servi.current === panneau) return;
  servi.current = panneau;
  entrerDansLePanneau(panneau);
}

/**
 * La cible d'entrée : l'option cochée, sinon la première cochable.
 *
 * Le repli est ce qui manquait aux genres et aux plateformes, où rien n'est
 * coché au départ : la cascade tombait alors à son dernier rang, l'ordre du
 * document, et désignait le champ de recherche.
 */
function marquerEntree(panneau: HTMLElement): void {
  const cible =
    panneau.querySelector<HTMLElement>('[aria-checked="true"]') ??
    panneau.querySelector<HTMLElement>('[role="menuitemcheckbox"]');
  const actuelle = panneau.querySelector<HTMLElement>(`[${ATTRIBUT_ENTREE}]`);
  if (actuelle === cible) return;

  actuelle?.removeAttribute(ATTRIBUT_ENTREE);
  cible?.setAttribute(ATTRIBUT_ENTREE, "");
}

function entrerDansLePanneau(panneau: HTMLElement): void {
  if (panneau.contains(document.activeElement)) return;

  // Les lignes arrivent avec leurs données — les genres après un aller-retour
  // réseau — et un rectangle de taille nulle n'est pas recensé. On attend le
  // montage plutôt que de viser dans le vide.
  reviserApresMontage(() => {
    const cible = destinationEntreeDeZone(panneau);
    if (!cible) return false;
    // Un panneau qui n'offre que de la SAISIE — les deux années — garde son
    // entrée explicite : pas de clavier système sans geste de l'utilisateur.
    if (faitMonterLeClavier(cible)) return true;
    donnerFocus(cible);
    return true;
  });
}

/**
 * Ce qui fait surgir le clavier du téléviseur.
 *
 * Plus étroit que « champ de saisie » du moteur, et il le faut : celui-ci
 * range le curseur de la note parmi les champs, parce que gauche et droite
 * doivent y aller à la valeur plutôt qu'au focus voisin. Mais un curseur
 * n'ouvre aucun clavier — on peut y entrer sans rien faire surgir, et c'est
 * même la seule chose qu'on vienne faire dans ce menu-là.
 */
function faitMonterLeClavier(element: HTMLElement): boolean {
  if (element.tagName === "TEXTAREA") return true;
  if (element.tagName !== "INPUT") return false;
  const type = (element as HTMLInputElement).type;
  return type !== "range" && type !== "checkbox" && type !== "radio" && type !== "color";
}
