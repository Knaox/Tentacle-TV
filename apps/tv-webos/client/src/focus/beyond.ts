import { FOCUSABLE_SELECTOR, reachableTarget } from "./candidates";

/**
 * « Reste-t-il quelque chose à viser au-delà ? » — la question du bord.
 *
 * La seule que le recensement ne sache pas poser : il s'arrête à un demi-écran
 * de marge, par principe — un voisin lointain n'est pas un voisin, et le faire
 * entrer dans le calcul ferait bondir le focus hors de vue. Mais pour savoir
 * si l'on est au BOUT d'une page, il faut regarder au-delà de la fenêtre :
 * c'est ce qui distingue « la cible n'est pas montée, un pas la révélera » de
 * « il n'y a plus rien, l'appui demande à voir le bord ».
 *
 * Module à part parce que `candidates.ts` est au plafond des trois cents
 * lignes, et parce que ces deux fonctions répondent à une question qui n'est
 * pas la sienne : lui recense des VOISINS, celles-ci mesurent une fin.
 */

/** La tolérance de la géométrie : deux éléments d'une même rangée ne sont pas
 *  alignés au pixel, et l'un d'eux ne doit pas passer pour « au-delà ». */
const TOLERANCE = 4;

/**
 * Trois précautions, chacune payée par un contre-exemple :
 *
 * - **les calques fixes sont écartés**. Le rail couvre toute la hauteur de
 *   l'écran et ne défile pas : ses huit entrées — mesurées — répondraient « il
 *   y a un candidat au-dessus » et « il y en a un en dessous » depuis
 *   n'importe où, et la règle du bord ne s'armerait jamais.
 * - **le départ et sa parenté sont écartés** : une carte enveloppe des
 *   boutons, et un bouton n'est pas au-delà de la carte qui le contient.
 * - **on s'arrête au premier trouvé**. La réponse est un booléen ; parcourir
 *   la suite ne changerait rien et le document en compte plusieurs dizaines.
 *
 * N'a lieu que sur le chemin rare où aucun voisin n'a été trouvé — jamais à
 * chaque appui.
 */
export function candidateBeyond(start: HTMLElement, towardsEnd: boolean, vertical: boolean): boolean {
  const startBox = start.getBoundingClientRect();
  const startEdge = edgeOf(startBox, towardsEnd, vertical, true);

  // Les filtres sont indépendants : leur ordre ne change pas la réponse, seul
  // leur coût compte. La géométrie d'abord — une fois la mise en page à jour,
  // un rectangle ne coûte presque rien et écarte la plupart des éléments —,
  // puis le calque fixe, qui relit des styles d'ancêtres, mémorisés le temps
  // de l'appel : toutes les cartes d'une page partagent les mêmes. Touche
  // maintenue au bas de l'accueil, la fonction tourne à chaque répétition, et
  // relisait les styles de tous les ancêtres de chaque élément du document.
  const fixedAncestors = new Map<Element, boolean>();

  for (const node of document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) {
    if (node === start || start.contains(node) || node.contains(start)) continue;

    const box = node.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;

    const edge = edgeOf(box, towardsEnd, vertical, false);
    const beyond = towardsEnd ? edge > startEdge + TOLERANCE : edge < startEdge - TOLERANCE;
    if (!beyond) continue;

    if (inFixedLayer(node, fixedAncestors)) continue;

    // L'atteignabilité en dernier : c'est le test le plus coûteux — il lit des
    // styles calculés — et la géométrie vient de trancher pour presque tous.
    if (reachableTarget(node)) return true;
  }

  return false;
}

/**
 * Le bord qui compte. Pour le DÉPART, celui par lequel on sort ; pour un
 * candidat, celui par lequel il entre. Comparer deux fois le même bord ferait
 * passer pour « au-delà » un élément qui ne fait que dépasser.
 */
function edgeOf(box: DOMRect, towardsEnd: boolean, vertical: boolean, start: boolean): number {
  if (vertical) {
    return towardsEnd === start ? box.bottom : box.top;
  }
  return towardsEnd === start ? box.right : box.left;
}

/**
 * Un élément d'un calque FIXE ne suit pas le défilement de la page.
 *
 * Deux appelants, pour deux raisons qui n'en font qu'une. Le cadrage s'interdit
 * de « corriger » un tel élément par la fenêtre — on écrivait un défilement
 * qu'il ne suivait pas, et la page dérivait de quelques pixels à chaque focus
 * dans le rail, sans jamais converger. Et la question du bord les écarte, pour
 * ne pas prendre le rail pour un bout de page.
 */
export function inFixedLayer(element: HTMLElement, memo?: Map<Element, boolean>): boolean {
  const visited: Element[] = [];
  let answer = false;
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    const known = memo?.get(current);
    if (known !== undefined) {
      answer = known;
      break;
    }
    visited.push(current);
    if (window.getComputedStyle(current).position === "fixed") {
      answer = true;
      break;
    }
  }
  // Tout le chemin parcouru partage la réponse : un ancêtre fixe rend fixe tout
  // ce qu'il contient, et aucun ancêtre fixe jusqu'au sommet vaut pour chacun.
  if (memo) for (const node of visited) memo.set(node, answer);
  return answer;
}
