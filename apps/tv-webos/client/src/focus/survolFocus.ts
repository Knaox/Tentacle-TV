import { SELECTEUR_FOCUSABLE, cibleAtteignable } from "./candidats";

/**
 * Le pointeur déplace le focus — il ne fait rien d'autre.
 *
 * Un téléviseur LG a un pointeur : la Magic Remote en fait apparaître un dès
 * qu'on agite la télécommande, et une souris branchée en donne un aussi. Sans
 * ce module, ce pointeur ne servait à rien d'autre qu'à cliquer : le survol
 * était éteint des deux côtés — les règles `:hover` retirées de la feuille par
 * la passe PostCSS, les gestionnaires `onMouseEnter` neutralisés par
 * `shims/survolInerte.ts` — et viser une carte à la main ne la désignait pas.
 *
 * **Ce n'est pas un retour du survol du client web**, et la distinction est
 * tout le sujet. Le survol du web ouvre un panneau d'aperçu, bascule
 * `data-hovered`, révèle des commandes : un second état visuel, concurrent du
 * focus. Ici il n'y a toujours qu'UN état — celui du focus — et le pointeur
 * devient un moyen de plus de le déplacer, au même titre qu'une flèche. Ce que
 * la carte montre alors est exactement ce qu'elle montre au D-pad.
 *
 * `mouseover` et non `mousemove` : l'événement ne part qu'au changement
 * d'élément survolé. Balayer l'écran ne coûte donc pas un traitement par image,
 * et il n'y a rien à étrangler.
 */

/**
 * Les champs de saisie sont exclus, et pour une raison qu'on ne voit pas au
 * navigateur : webOS ouvre son clavier système dès qu'un `<input>` reçoit le
 * focus. Un pointeur qui traverse un champ de recherche ferait donc surgir un
 * clavier plein écran que personne n'a demandé. On les laisse au clic et au
 * D-pad, qui sont des gestes intentionnels.
 */
function estUnChampDeSaisie(element: HTMLElement): boolean {
  const balise = element.tagName;
  if (balise === "TEXTAREA" || balise === "SELECT") return true;
  if (balise !== "INPUT") return false;
  const type = (element as HTMLInputElement).type;
  return type !== "checkbox" && type !== "radio" && type !== "button" && type !== "submit";
}

/**
 * Branche l'écoute et rend la fonction de débranchement.
 *
 * Un seul écouteur, délégué au document : une rangée de quarante cartes ne doit
 * pas coûter quarante abonnements, et les cartes vont et viennent au gré du
 * fenêtrage — un gestionnaire par composant serait posé et retiré sans arrêt.
 *
 * `suspendu` est fourni par l'appelant plutôt que déduit ici : c'est le moteur
 * qui sait quand les flèches ne lui appartiennent pas — commandes du lecteur
 * masquées, curseur fantôme en cours — et le survol doit se taire aux mêmes
 * moments. Dupliquer la condition, c'est la laisser diverger.
 */
export function surveillerSurvol(suspendu: () => boolean): () => void {
  const surSurvol = (evenement: MouseEvent) => {
    if (suspendu()) return;

    const cible = evenement.target;
    if (!(cible instanceof HTMLElement)) return;

    const focusable = cible.closest<HTMLElement>(SELECTEUR_FOCUSABLE);
    if (!focusable) return;
    if (focusable === document.activeElement) return;
    if (estUnChampDeSaisie(focusable)) return;

    // Même juge que le recensement du D-pad. Il ne s'agit pas de prudence de
    // principe : une commande à `opacity: 0` reçoit les événements de souris
    // sans rien montrer, et le focus s'y poserait sans anneau visible —
    // exactement le trou noir que le moteur évite déjà de son côté.
    if (!cibleAtteignable(focusable)) return;

    focusable.focus();
  };

  document.addEventListener("mouseover", surSurvol, true);

  return () => {
    document.removeEventListener("mouseover", surSurvol, true);
  };
}
