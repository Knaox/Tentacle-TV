import { lireIntention, estHorizontale, type Direction } from "./touches";
import { recenser, conteneurPiegeant } from "./candidats";
import { boiteDepuisRectangle, meilleur, surLaMemeLigne } from "./geometrie";
import { amenerEnVue, defilerAveuglement } from "./defilement";
import { reviserApresMontage } from "./attente";
import { pointeurActif, surveillerCurseur } from "./curseur";
import { surveillerSurvol } from "./survolFocus";
import { navigationOsdActive } from "../lecture/etatLecteurTv";

/**
 * Navigation spatiale à la télécommande.
 *
 * Le moteur écoute les touches, calcule le voisin géométriquement le plus
 * proche parmi ce que le document offre, et lui donne le focus. Aucun
 * composant n'est enregistré, aucun n'est modifié : `apps/web` ignore
 * l'existence du téléviseur, et un bouton ajouté demain sera navigable sans
 * que personne y pense.
 *
 * **Écoute en capture, et c'est délibéré.** Les rangées du client web posent
 * un `tabIndex` sur leur section et interceptent les flèches pour défiler
 * elles-mêmes ; sur un téléviseur ce comportement entrerait en conflit avec le
 * déplacement du focus. En capturant, le moteur voit l'événement avant elles
 * et l'arrête net.
 *
 * Le lecteur fait exception, mais à moitié : quand ses commandes sont
 * déployées, ce sont des boutons comme les autres et le moteur les parcourt
 * sans qu'on écrive une ligne. Le reste du temps — habillage masqué, ou
 * curseur fantôme en cours —, les flèches appartiennent au déplacement dans le
 * flux, et le moteur se retire. La condition se lit dans l'état du lecteur,
 * jamais dans le chemin seul.
 */

/** Route sur laquelle le moteur laisse la main aux raccourcis du lecteur. */
const CHEMIN_LECTEUR = "/watch";

/** La navigation latérale, qui obéit à des règles d'accès particulières. */
const SELECTEUR_RAIL = ".rail-tv";

export function installerMoteurFocus(): () => void {
  const arreterCurseur = surveillerCurseur();
  // Le pointeur déplace le focus, sous la même condition de suspension que les
  // flèches : ce qui vaut pour un mode d'entrée vaut pour l'autre.
  const arreterSurvol = surveillerSurvol(moteurSuspendu);

  const surTouche = (evenement: KeyboardEvent) => {
    if (pointeurActif()) return;
    if (moteurSuspendu()) return;

    const intention = lireIntention(evenement);
    if (!intention || intention.type !== "deplacer") return;

    // Dans un champ de texte, gauche et droite déplacent le curseur de saisie —
    // les lui prendre rendrait la correction d'une frappe impossible. Haut et
    // bas, qu'un champ d'une seule ligne n'utilise pas, restent au moteur :
    // c'est par eux qu'on sort du champ. Sans cette distinction, entrer dans un
    // formulaire à la télécommande serait un aller sans retour.
    if (estHorizontale(intention.direction) && saisieEnCours(evenement.target)) return;

    evenement.preventDefault();
    evenement.stopPropagation();
    deplacer(intention.direction);
  };

  document.addEventListener("keydown", surTouche, true);

  return () => {
    document.removeEventListener("keydown", surTouche, true);
    arreterSurvol();
    arreterCurseur();
  };
}

/** L'événement vient-il d'un champ où le curseur de texte se déplace ? */
function saisieEnCours(cible: EventTarget | null): boolean {
  const element = cible as HTMLElement | null;
  if (!element) return false;
  const balise = element.tagName;
  if (balise === "TEXTAREA") return true;
  if (balise !== "INPUT") return false;
  const type = (element as HTMLInputElement).type;
  return type !== "checkbox" && type !== "radio" && type !== "button" && type !== "submit";
}

/**
 * Le préfixe doit s'arrêter à une frontière de segment.
 *
 * `startsWith("/tv/watch")` répondait vrai sur **`/tv/watchlist`** : le moteur
 * s'y croyait dans le lecteur, se suspendait faute d'habillage à piloter, et
 * Ma liste devenait entièrement impilotable — aucune flèche n'y faisait quoi que
 * ce soit. Le défaut ne se voyait pas au premier essai : on arrive sur cet écran
 * par le rail, dont les entrées gardent le focus, et tout semble normal jusqu'à
 * ce qu'on tente d'en descendre.
 */
function surLecteur(): boolean {
  const chemin = window.location.pathname;
  const base = `/tv${CHEMIN_LECTEUR}`;
  return chemin === base || chemin.startsWith(`${base}/`);
}

/** Le moteur ne rend la main que lorsque les commandes du lecteur sont là. */
function moteurSuspendu(): boolean {
  return surLecteur() && !navigationOsdActive();
}

/**
 * Un déplacement, en trois temps : viser, défiler si rien n'est visé, viser à
 * nouveau une fois les cartes montées.
 */
function deplacer(direction: Direction): void {
  if (viser(direction)) return;

  // Aucun voisin : soit on est au bord, soit la cible n'est pas montée. Le
  // fenêtrage des rangées vide une rangée entière dès qu'elle sort de l'écran,
  // et une carte non montée ne peut pas recevoir le focus.
  const depart = elementActif();
  if (!defilerAveuglement(depart, direction)) return;

  reviserApresMontage(() => viser(direction));
}

/** Cherche un voisin et lui donne le focus. Rend vrai s'il en a trouvé un. */
function viser(direction: Direction): boolean {
  const depart = elementActif();
  if (!depart) return viserPremier();

  const racine = conteneurPiegeant() ?? document;
  let candidats = recenser(racine).filter((candidat) => candidat.element !== depart);

  const depuis = boiteDepuisRectangle(depart.getBoundingClientRect());

  // Un déplacement horizontal reste dans sa rangée. Sans cela, la dernière
  // carte d'une piste voit à sa droite les éléments des rangées voisines — la
  // géométrie ne dit rien de l'appartenance — et le focus part au hasard, ce
  // qu'aucune interface de salon ne fait.
  //
  // Dans une PISTE, le confinement se lève au bout : la piste défile, ce qui
  // suit est atteint par `defilerAveuglement`. Dans une GRILLE, il ne se lève
  // pas — une ligne de grille est une fin, et « droite » depuis la dernière
  // carte ne doit pas descendre en diagonale sur la première de la suivante.
  // Une grille n'ayant aucun conteneur par ligne, la ligne se reconnaît aux
  // ordonnées.
  if (estHorizontale(direction)) {
    const piste = depart.closest("[data-tv-piste]");
    if (piste) {
      const dansLaPiste = candidats.filter((candidat) => piste.contains(candidat.element));
      if (meilleur(depuis, dansLaPiste, direction)) candidats = dansLaPiste;
    } else if (depart.closest("[data-tv-grille]")) {
      candidats = candidats.filter((candidat) => surLaMemeLigne(depuis, candidat.boite));
    }
  }

  // Le rail s'atteint par la gauche, mais pas depuis le contenu.
  //
  // Il couvre toute la hauteur de l'écran : sans règle, « bas » depuis une carte
  // y remonterait au lieu de descendre d'une rangée, la géométrie seule y voyant
  // un candidat parfaitement valable. Et « gauche » depuis la première carte
  // d'une rangée s'en échappait — on ne veut pas quitter le catalogue en
  // longeant une ligne.
  //
  // La porte reste le chrome de la page : retour, filtres, onglets, champ de
  // recherche. Ils sont déjà en haut à gauche, donc le geste ne change pas —
  // Haut jusqu'au chrome, puis Gauche — et aucune touche n'est inventée.
  const dansLeContenu = depart.closest("[data-tv-piste], [data-tv-grille]");
  const railAtteignable = direction === "gauche" && !dansLeContenu;
  if (!depart.closest(SELECTEUR_RAIL) && !railAtteignable) {
    candidats = candidats.filter((candidat) => !candidat.element.closest(SELECTEUR_RAIL));
  }

  const choisi = meilleur(depuis, candidats, direction);
  if (!choisi) return false;

  donnerFocus(choisi.element);
  return true;
}

/**
 * Aucun élément actif : au premier appui après un chargement d'écran, ou
 * quand l'élément qui portait le focus a été démonté sous nos pieds — ce qui
 * arrive précisément quand une rangée se vide.
 */
function viserPremier(): boolean {
  const racine = conteneurPiegeant() ?? document;
  const tous = recenser(racine);
  // Le contenu d'abord : arriver sur un écran avec le focus dans la navigation
  // demande de le déplacer avant même de commencer à regarder. Le rail se
  // rejoint par la gauche quand on en a besoin.
  const horsRail = tous.filter((candidat) => !candidat.element.closest(SELECTEUR_RAIL));
  const candidats = horsRail.length > 0 ? horsRail : tous;
  if (candidats.length === 0) return false;

  // Le plus haut, puis le plus à gauche : l'ordre de lecture.
  let retenu = candidats[0];
  for (const candidat of candidats) {
    if (candidat.boite.haut < retenu.boite.haut - 4) retenu = candidat;
    else if (
      Math.abs(candidat.boite.haut - retenu.boite.haut) <= 4 &&
      candidat.boite.gauche < retenu.boite.gauche
    ) {
      retenu = candidat;
    }
  }

  donnerFocus(retenu.element);
  return true;
}

function donnerFocus(element: HTMLElement): void {
  element.focus();
  amenerEnVue(element);
}

/** L'élément qui porte le focus, ou `null` si c'est le document lui-même. */
function elementActif(): HTMLElement | null {
  const actif = document.activeElement;
  if (!actif || actif === document.body || actif === document.documentElement) return null;
  return actif as HTMLElement;
}

/**
 * Pose le focus au chargement d'un écran, sans attendre un premier appui.
 *
 * Sans cela l'utilisateur voit une page sans anneau et doit appuyer une fois
 * « pour rien » — un défaut qui passe inaperçu au clavier et saute aux yeux à
 * la télécommande.
 */
export function amorcerFocus(): void {
  reviserApresMontage(() => {
    if (elementActif()) return true;
    return viserPremier();
  });
}
