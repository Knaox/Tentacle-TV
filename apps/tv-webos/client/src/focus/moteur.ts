import { lireIntention, estHorizontale, type Direction } from "./touches";
import { recenser, conteneurPiegeant } from "./candidats";
import { boiteDepuisRectangle, meilleur } from "./geometrie";
import { amenerEnVue, defilerAveuglement } from "./defilement";
import { reviserApresMontage } from "./attente";
import { pointeurActif, surveillerCurseur } from "./curseur";
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

function surLecteur(): boolean {
  return window.location.pathname.startsWith(`/tv${CHEMIN_LECTEUR}`);
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

  // Un déplacement horizontal reste dans sa rangée. Sans cela, la dernière
  // carte d'une piste voit à sa droite les éléments des rangées voisines — la
  // géométrie ne dit rien de l'appartenance — et le focus part au hasard, ce
  // qu'aucune interface de salon ne fait.
  // Un déplacement horizontal reste dans sa rangée — tant qu'il y a une carte
  // à atteindre. Au bout de la piste, on n'immobilise pas le focus : « gauche »
  // depuis la première carte doit pouvoir rejoindre la navigation, sans quoi
  // il n'y aurait aucun moyen d'y retourner.
  const piste = estHorizontale(direction) ? depart.closest("[data-tv-piste]") : null;
  if (piste) {
    const dansLaPiste = candidats.filter((candidat) => piste.contains(candidat.element));
    const depuis = boiteDepuisRectangle(depart.getBoundingClientRect());
    if (meilleur(depuis, dansLaPiste, direction)) candidats = dansLaPiste;
  }

  // Le rail ne s'atteint que par la gauche. Il couvre toute la hauteur de
  // l'écran : sans cette règle, « bas » depuis une carte y remonte au lieu de
  // descendre d'une rangée, parce que la géométrie seule y voit un candidat
  // parfaitement valable. On sort du contenu vers la navigation par un geste
  // délibéré, jamais par accident.
  if (!depart.closest(SELECTEUR_RAIL) && direction !== "gauche") {
    candidats = candidats.filter((candidat) => !candidat.element.closest(SELECTEUR_RAIL));
  }

  const choisi = meilleur(
    boiteDepuisRectangle(depart.getBoundingClientRect()),
    candidats,
    direction,
  );
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
