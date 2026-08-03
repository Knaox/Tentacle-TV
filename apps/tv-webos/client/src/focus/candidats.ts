import { boiteDepuisRectangle, type Boite } from "./geometrie";

/**
 * Ce que le D-pad peut atteindre.
 *
 * Le moteur ne demande rien aux composants : il lit le document tel qu'il est.
 * C'est ce qui permet à `apps/web` d'ignorer l'existence du téléviseur — un
 * bouton ajouté demain sera navigable sans que personne ait à l'enregistrer.
 *
 * En contrepartie, le filtrage doit être sérieux : un élément techniquement
 * focusable mais invisible est un trou noir, l'anneau y disparaît et
 * l'utilisateur ne sait plus où il est.
 */

const SELECTEUR_FOCUSABLE = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "video[controls]",
  "[tabindex]",
].join(",");

export interface Candidat {
  element: HTMLElement;
  boite: Boite;
}

/**
 * Recense les cibles atteignables dans la zone visible.
 *
 * Limité au viewport, et volontairement : une carte à trois écrans de
 * distance n'est pas un voisin, et la faire entrer dans le calcul ferait
 * bondir le focus hors de vue. Ce qui se trouve au-delà est atteint par le
 * défilement, un pas à la fois.
 */
export function recenser(racine: ParentNode = document): Candidat[] {
  const candidats: Candidat[] = [];
  const hauteurVue = window.innerHeight;
  const largeurVue = window.innerWidth;

  for (const noeud of racine.querySelectorAll<HTMLElement>(SELECTEUR_FOCUSABLE)) {
    if (!estAtteignable(noeud)) continue;

    const rectangle = noeud.getBoundingClientRect();
    if (rectangle.width === 0 || rectangle.height === 0) continue;

    // Une marge d'un demi-écran : ce qui affleure le bord reste un voisin
    // légitime, on le fera défiler en vue après l'avoir choisi.
    const marge = 0.5;
    if (rectangle.bottom < -hauteurVue * marge) continue;
    if (rectangle.top > hauteurVue * (1 + marge)) continue;
    if (rectangle.right < -largeurVue * marge) continue;
    if (rectangle.left > largeurVue * (1 + marge)) continue;

    candidats.push({ element: noeud, boite: boiteDepuisRectangle(rectangle) });
  }

  return candidats;
}

/** Visible, actif, et pas explicitement retiré du parcours. */
function estAtteignable(element: HTMLElement): boolean {
  if (element.hasAttribute("disabled")) return false;
  if (element.getAttribute("aria-hidden") === "true") return false;
  if (element.getAttribute("tabindex") === "-1") return false;

  // `offsetParent` nul signale `display: none` sur l'élément ou un ancêtre —
  // le test le plus court et le moins coûteux. Il répond aussi nul pour un
  // élément en `position: fixed`, d'où la seconde branche.
  if (element.offsetParent === null) {
    const style = window.getComputedStyle(element);
    if (style.position !== "fixed") return false;
    if (style.display === "none") return false;
  }

  const style = window.getComputedStyle(element);
  if (style.visibility === "hidden" || style.opacity === "0") return false;
  if (style.pointerEvents === "none") return false;

  return true;
}

/**
 * Le conteneur qui piège le focus, s'il y en a un.
 *
 * Une boîte de dialogue ouverte doit contenir le déplacement : sans cela le
 * D-pad s'échappe vers la page qui la porte, l'anneau passe derrière le calque
 * et devient invisible. Reconnue par son rôle, pas par un marqueur ajouté —
 * `role="dialog"` est déjà là pour les lecteurs d'écran.
 */
export function conteneurPiegeant(): ParentNode | null {
  const dialogues = document.querySelectorAll<HTMLElement>(
    '[role="dialog"],[role="alertdialog"],dialog[open]',
  );
  for (let index = dialogues.length - 1; index >= 0; index--) {
    const dialogue = dialogues[index];
    if (estAtteignable(dialogue) || dialogue.getBoundingClientRect().height > 0) return dialogue;
  }
  return null;
}
