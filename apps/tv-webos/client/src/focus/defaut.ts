import { recenser, estUnChampDeSaisie, type Candidat } from "./candidats";

/**
 * Où le focus se pose en arrivant sur un écran.
 *
 * Le moteur ne connaît pas les écrans, et ne doit pas les connaître : c'est ce
 * qui permet à `apps/web` d'ignorer l'existence du téléviseur. Une table
 * « route → sélecteur » l'y obligerait par la bande, et vieillirait à chaque
 * refonte d'un écran.
 *
 * On procède donc par ordre de priorité, du plus explicite au plus général :
 *
 * 1. **Ce qu'un composant du téléviseur a désigné** — `data-tv-focus-defaut`.
 *    Les enveloppes que nous écrivons savent, elles, quelle est leur cible
 *    d'entrée : la première carte d'une grille, « Reprendre » sur une fiche,
 *    l'épisode en cours d'une saison. C'est le seul endroit où cette
 *    connaissance a sa place.
 * 2. **La première carte du contenu**, quand aucune n'est désignée. Sur un
 *    écran de catalogue, c'est presque toujours la bonne réponse.
 * 3. **Le premier candidat en ordre de lecture**, hors rail et hors champ de
 *    saisie.
 *
 * L'exclusion du rail est reprise du comportement d'origine, et pour la même
 * raison : arriver sur un écran avec le focus dans la navigation oblige à le
 * déplacer avant même de regarder quoi que ce soit.
 *
 * **L'exclusion des champs de saisie est le correctif d'un défaut mesuré.** En
 * arrivant sur une bibliothèque, l'élément le plus haut à gauche est le champ
 * de recherche — et sur une dalle, un `<input>` qui reçoit le focus fait surgir
 * le clavier système en plein écran. On ouvrait donc chaque bibliothèque sur un
 * clavier.
 */

/** Marqueur qu'un composant du téléviseur pose sur sa cible d'entrée. */
export const ATTRIBUT_DEFAUT = "data-tv-focus-defaut";

const SELECTEUR_RAIL = ".rail-tv";
const SELECTEUR_CONTENU = "[data-tv-piste], [data-tv-grille]";

/**
 * L'appel à l'action principal d'un écran.
 *
 * `cta-primary` est un jeton du système de design, pas une classe utilitaire :
 * il désigne LE bouton qui fait ce pour quoi l'écran existe — « Lecture » ou
 * « Reprendre » sur une fiche, sur la bannière d'accueil. S'y accrocher donne
 * un focus par défaut juste sans écrire nulle part une table « route →
 * sélecteur », qui obligerait le téléviseur à connaître les écrans du web et
 * vieillirait à chaque refonte.
 *
 * Sans lui, l'ordre de lecture désignait le bouton « Retour » de la fiche : le
 * plus haut, le plus à gauche, et la seule chose qu'on ne veuille pas viser en
 * arrivant.
 */
const SELECTEUR_ACTION_PRINCIPALE = '[class*="cta-primary"]';

export function focusParDefaut(
  racine: ParentNode = document,
  candidats: Candidat[] = recenser(racine),
): HTMLElement | null {
  if (candidats.length === 0) return null;

  return ciblePreferee(racine, candidats) ?? premierEnOrdreDeLecture(candidats);
}

/**
 * La cible d'entrée quand elle existe : désignée, ou première carte du contenu.
 *
 * Séparée parce qu'elle arrive TARD. Un écran de catalogue affiche ses filtres
 * en un rendu et ses cartes après un aller-retour réseau : au moment où l'on
 * doit poser l'anneau, la grille n'existe pas encore, et le repli en ordre de
 * lecture désignait le premier filtre. Mesuré sur une bibliothèque, le focus
 * arrivait sur « Tous » au lieu de la première affiche.
 *
 * Le moteur pose donc l'anneau tout de suite — un écran sans anneau est pire
 * que tout — puis remonte vers cette cible-ci dès qu'elle paraît, tant que
 * l'utilisateur n'a pas pris la main.
 */
export function ciblePreferee(
  racine: ParentNode = document,
  candidats: Candidat[] = recenser(racine),
): HTMLElement | null {
  const designe = candidats.find((candidat) => candidat.element.hasAttribute(ATTRIBUT_DEFAUT));
  if (designe) return designe.element;

  const principale = candidats.find((candidat) =>
    candidat.element.matches(SELECTEUR_ACTION_PRINCIPALE),
  );
  if (principale) return principale.element;

  // Puis l'élément COURANT, quand l'écran en désigne un.
  //
  // `aria-current` est déjà là pour les lecteurs d'écran, et il dit exactement
  // ce qu'on cherche : la section affichée, l'onglet actif, la page en cours.
  // Sans cette règle, l'ordre de lecture décidait — et sur les réglages il
  // désignait « Oublier ce jumelage », une action destructive, simplement parce
  // que le panneau se montait avant la liste des sections.
  //
  // Le rail en est exclu comme partout : on n'entre jamais dans un écran par sa
  // navigation.
  const courante = candidats.find(
    (candidat) =>
      !candidat.element.closest(SELECTEUR_RAIL) &&
      candidat.element.matches('[aria-current]:not([aria-current="false"])'),
  );
  if (courante) return courante.element;

  const contenu = racine.querySelector(SELECTEUR_CONTENU);
  if (!contenu) return null;

  const carte = candidats.find(
    (candidat) =>
      contenu.contains(candidat.element) && candidat.element.hasAttribute("data-tv-carte"),
  );
  return carte ? carte.element : null;
}

/** L'élément est-il déjà une cible d'entrée légitime ? */
export function estCiblePreferee(element: HTMLElement): boolean {
  if (element.hasAttribute(ATTRIBUT_DEFAUT)) return true;
  if (element.matches(SELECTEUR_ACTION_PRINCIPALE)) return true;
  if (
    !element.closest(SELECTEUR_RAIL) &&
    element.matches('[aria-current]:not([aria-current="false"])')
  ) {
    return true;
  }
  return element.hasAttribute("data-tv-carte") && !!element.closest(SELECTEUR_CONTENU);
}

/**
 * Le plus haut, puis le plus à gauche.
 *
 * La tolérance verticale évite qu'une différence d'un pixel entre deux boutons
 * d'une même barre décide de l'ordre à la place de l'abscisse.
 */
const TOLERANCE_LIGNE = 4;

function premierEnOrdreDeLecture(candidats: Candidat[]): HTMLElement | null {
  // Les champs de saisie sont écartés d'abord, et pour de bon.
  //
  // Le relâchement ci-dessous les reprenait, et c'était la porte par laquelle
  // la recherche devenait un piège. La surcouche est un `role="dialog"`, donc
  // le recensement s'y confine ; sitôt que le champ perdait le focus, le filet
  // « il y a toujours exactement un élément focalisé » repassait ici, ne
  // trouvait plus rien d'admissible et se rabattait sur le champ. webOS y
  // rouvrait son clavier, `moteurSuspendu()` redevenait vrai, et plus une
  // flèche n'était traitée : ni pour descendre vers les résultats, ni pour
  // remonter au champ. Les deux symptômes n'en faisaient qu'un.
  //
  // Mesuré sur l'émulateur webOS 4, puis reproduit sur le Simulator 26 : un
  // `blur()` sur le champ est suivi d'un unique appel à `focus()` qui l'y
  // ramène, et le clavier remonte dans la foulée.
  const sansChamp = candidats.filter((candidat) => !estUnChampDeSaisie(candidat.element));
  const recevables = sansChamp.filter((candidat) => !candidat.element.closest(SELECTEUR_RAIL));

  // Un écran qui n'offre que le rail vaut mieux qu'un écran sans anneau du
  // tout : ce relâchement-là reste. Un écran qui n'offre qu'un champ, non —
  // mieux vaut pas d'anneau qu'un anneau dont on ne peut plus sortir. Le champ
  // reste atteignable à la flèche et par la pose explicite de l'écran de
  // recherche ; c'est l'automatisme, et lui seul, qui s'en écarte.
  const retenus = recevables.length > 0 ? recevables : sansChamp;
  if (retenus.length === 0) return null;

  let meilleur = retenus[0];
  for (const candidat of retenus) {
    if (candidat.boite.haut < meilleur.boite.haut - TOLERANCE_LIGNE) {
      meilleur = candidat;
    } else if (
      Math.abs(candidat.boite.haut - meilleur.boite.haut) <= TOLERANCE_LIGNE &&
      candidat.boite.gauche < meilleur.boite.gauche
    ) {
      meilleur = candidat;
    }
  }

  return meilleur.element;
}
