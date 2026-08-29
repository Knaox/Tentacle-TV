import type { Box } from "@tentacle-tv/tv-core";
import { navBox } from "./measure";

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

export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "video[controls]",
  "[tabindex]",
].join(",");

export interface Candidate {
  element: HTMLElement;
  box: Box;
}

/**
 * Recense les cibles atteignables dans la zone visible.
 *
 * Limité au viewport, et volontairement : une carte à trois écrans de
 * distance n'est pas un voisin, et la faire entrer dans le calcul ferait
 * bondir le focus hors de vue. Ce qui se trouve au-delà est atteint par le
 * défilement, un pas à la fois.
 */
export function collect(root: ParentNode = document): Candidate[] {
  const candidates: Candidate[] = [];
  const viewHeight = window.innerHeight;
  const viewWidth = window.innerWidth;
  // Les styles des ancêtres sont relus pour chaque candidat d'une même rangée.
  // Le cache vit le temps d'un recensement — donc d'un appui sur la
  // télécommande — et rend une trentaine d'appels là où il en faudrait quelques
  // centaines, sur un processeur qui n'en a pas les moyens.
  const styles = new Map<Element, CSSStyleDeclaration>();

  for (const node of root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) {
    if (!isReachable(node)) continue;
    if (!visibleAncestors(node, styles)) continue;

    const rect = node.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    // Une marge d'un demi-écran : ce qui affleure le bord reste un voisin
    // légitime, on le fera défiler en vue après l'avoir choisi.
    const margin = 0.5;
    if (rect.bottom < -viewHeight * margin) continue;
    if (rect.top > viewHeight * (1 + margin)) continue;
    if (rect.right < -viewWidth * margin) continue;
    if (rect.left > viewWidth * (1 + margin)) continue;

    // La boîte de NAVIGATION, débarrassée de l'agrandissement au focus : la
    // fenêtre ci-dessus juge la position à l'écran, le rect brut lui suffit.
    candidates.push({ element: node, box: navBox(node, rect) });
  }

  return withoutWrappers(candidates);
}

/**
 * Une enveloppe invisible rend son contenu invisible — pas ses styles.
 *
 * `opacity` ne s'hérite pas au sens de la cascade : un bouton marqué
 * `pointer-events-auto` dans une enveloppe à `opacity: 0` a bien, lui, une
 * opacité calculée de 1. `isReachable` le déclarait donc atteignable, et le
 * D-pad s'y posait — anneau invisible, utilisateur perdu. Le cas n'est pas
 * théorique : c'est `CardMoreInfoButton`, monté sur chaque vignette d'épisode.
 *
 * **La remontée s'arrête à la structure**, et c'est essentiel. Remonter jusqu'au
 * `<body>` faisait dépendre la navigation de l'animation d'entrée de page —
 * `tv.css` pose `#root > * { animation: tv-apparition 180ms both }`, dont l'état
 * initial est une opacité nulle. Pendant ces 180 ms, plus aucune carte n'était
 * atteignable : appuyer sur une flèche juste après avoir changé d'écran ne
 * faisait rien. On ne cherche pas une page cachée — le moteur ne tourne pas sur
 * une page cachée — mais une COMMANDE cachée dans sa carte. La question s'arrête
 * donc au bord de la carte.
 */
const STRUCTURE_BOUNDS = "[data-tv-carte],[data-tv-piste],[data-tv-grille]";

function visibleAncestors(
  element: HTMLElement,
  cache: Map<Element, CSSStyleDeclaration>,
): boolean {
  // Hors d'une carte, d'une piste ou d'une grille, il n'y a rien à examiner :
  // le chrome de page ne dissimule pas ses commandes derrière une enveloppe
  // transparente, et remonter plus haut ne rencontrerait que les calques de
  // transition de la page.
  const bound = element.closest(STRUCTURE_BOUNDS);
  if (!bound) return true;

  let parent = element.parentElement;
  while (parent) {
    let style = cache.get(parent);
    if (!style) {
      style = window.getComputedStyle(parent);
      cache.set(parent, style);
    }
    if (style.opacity === "0") return false;
    if (style.visibility === "hidden") return false;
    if (parent === bound) return true;
    parent = parent.parentElement;
  }
  return true;
}

/**
 * Le plus intérieur gagne.
 *
 * Un conteneur focusable qui en contient un autre n'est jamais la cible voulue :
 * sa boîte couvre celles de ses enfants, son désalignement est donc nul quel que
 * soit le point de départ, et il remporte le score contre chacun d'eux. C'est ce
 * qui faisait prendre au focus la bande entière d'un sélecteur de saison au lieu
 * d'un onglet — `HorizontalScrollRow` pose `tabIndex={0}` sur son conteneur de
 * défilement.
 *
 * `RowTv` documente le même défaut pour la `<section>` de `MediaRow` et le
 * corrige à la main, en retirant l'attribut. Le traiter ici le corrige partout,
 * y compris pour ce que personne n'a encore écrit.
 */
/**
 * Sauf quand l'enveloppe est, elle, un vrai contrôle.
 *
 * La règle du plus intérieur se retourne contre nous dans un cas précis : une
 * pastille de filtre de bibliothèque est un `<button>` qui OUVRE son menu, et
 * dès qu'un filtre est posé elle se met à contenir une petite affordance
 * d'effacement — un `<span role="button" tabindex="0">` de seize pixels. Le
 * plus intérieur l'emportait, et la pastille cessait d'être ouvrable : il ne
 * restait qu'une cible minuscule qui efface.
 *
 * On départage donc par la NATURE. Un `<button>` ou un `<a>` est un contrôle à
 * part entière, jamais un simple conteneur ; ce qu'il enveloppe est une
 * affordance secondaire, et c'est elle qui cède. Dans tous les autres cas —
 * un `<div>` de défilement, une `<section>` de rangée — l'enveloppe cède comme
 * avant.
 */
const NATIVE_CONTROLS = new Set(["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"]);

function isNativeControl(element: HTMLElement): boolean {
  return NATIVE_CONTROLS.has(element.tagName);
}

function withoutWrappers(candidates: Candidate[]): Candidate[] {
  if (candidates.length < 2) return candidates;

  const spread = new Set<HTMLElement>();
  for (const candidate of candidates) {
    for (const other of candidates) {
      if (other === candidate) continue;
      if (!candidate.element.contains(other.element)) continue;

      if (isNativeControl(candidate.element) && !isNativeControl(other.element)) {
        spread.add(other.element);
      } else {
        spread.add(candidate.element);
      }
    }
  }

  return candidates.filter((candidate) => !spread.has(candidate.element));
}

/** Visible, actif, et pas explicitement retiré du parcours. */
function isReachable(element: HTMLElement): boolean {
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
 * Un champ où le curseur de texte se déplace.
 *
 * La question se pose à trois endroits qui doivent répondre pareil, sans quoi
 * un champ se comporterait autrement selon qu'on l'atteint à la flèche, au
 * pointeur ou à l'entrée d'un écran : le moteur laisse gauche et droite au
 * curseur de saisie, le survol s'interdit d'y poser le focus, et le focus par
 * défaut ne s'y pose jamais.
 *
 * Ce dernier point est propre au téléviseur et ne se voit pas au navigateur :
 * **webOS ouvre son clavier système dès qu'un `<input>` reçoit le focus.** Un
 * écran dont l'élément le plus haut à gauche est un champ de recherche
 * accueillerait donc l'utilisateur avec un clavier plein écran que personne n'a
 * demandé.
 */
export function isInputField(element: HTMLElement | null): boolean {
  if (!element) return false;
  const tag = element.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  const type = (element as HTMLInputElement).type;
  return type !== "checkbox" && type !== "radio" && type !== "button" && type !== "submit";
}

/**
 * Une cible isolée est-elle atteignable ? Même règle que le recensement.
 *
 * Le survol ne recense rien : il a déjà l'élément sous le pointeur et n'a
 * qu'une question à poser à son sujet. Il la pose au même juge, sinon les deux
 * modes d'entrée diraient des choses différentes du même bouton.
 *
 * Le cache est jetable, pour un seul élément — l'intérêt d'en tenir un ne
 * commence qu'à la trentaine de candidats d'une rangée.
 */
export function reachableTarget(element: HTMLElement): boolean {
  return isReachable(element) && visibleAncestors(element, new Map());
}

/**
 * Le conteneur qui piège le focus, s'il y en a un.
 *
 * Une boîte de dialogue ouverte doit contenir le déplacement : sans cela le
 * D-pad s'échappe vers la page qui la porte, l'anneau passe derrière le calque
 * et devient invisible. Reconnue par son rôle, pas par un marqueur ajouté —
 * `role="dialog"` est déjà là pour les lecteurs d'écran.
 *
 * **Un menu déployé piège tout autant.** Les menus de filtres d'une
 * bibliothèque déclarent `role="menu"` et leurs entrées `menuitemcheckbox` :
 * sans cette reconnaissance, une flèche sortait du menu ouvert et repartait
 * dans la grille, en laissant le panneau déployé par-dessus. Même rôle, même
 * conséquence, même traitement.
 */
export function trappingContainer(): ParentNode | null {
  const dialogs = document.querySelectorAll<HTMLElement>(
    '[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"],dialog[open]',
  );
  for (let index = dialogs.length - 1; index >= 0; index--) {
    const dialog = dialogs[index];
    if (isReachable(dialog) || dialog.getBoundingClientRect().height > 0) return dialog;
  }
  return null;
}
