import { lireIntention, estHorizontale, type Direction } from "./touches";
import { recenser, conteneurPiegeant } from "./candidats";
import { boiteDepuisRectangle, meilleur } from "./geometrie";
import { amenerEnVue, defilerAveuglement } from "./defilement";
import { reviserApresMontage } from "./attente";
import { pointeurActif, surveillerCurseur } from "./curseur";

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
 * Le lecteur fait exception : `usePlayerHotkeys` y traite les flèches comme un
 * déplacement dans le flux, ce qui est exactement le comportement attendu
 * d'une télécommande. Le moteur s'y suspend au lieu de s'y imposer.
 */

/** Route sur laquelle le moteur laisse la main aux raccourcis du lecteur. */
const CHEMIN_LECTEUR = "/watch";

export function installerMoteurFocus(): () => void {
  const arreterCurseur = surveillerCurseur();

  const surTouche = (evenement: KeyboardEvent) => {
    if (pointeurActif()) return;
    if (surLecteur()) return;

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
  const candidats = recenser(racine).filter((candidat) => candidat.element !== depart);
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
  const candidats = recenser(racine);
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
