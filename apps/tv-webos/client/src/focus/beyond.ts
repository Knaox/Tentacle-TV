import { SELECTEUR_FOCUSABLE, cibleAtteignable } from "./candidates";

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
export function candidatAuDela(depart: HTMLElement, versLaFin: boolean, vertical: boolean): boolean {
  const boiteDepart = depart.getBoundingClientRect();
  const bordDepart = bordDe(boiteDepart, versLaFin, vertical, true);

  for (const noeud of document.querySelectorAll<HTMLElement>(SELECTEUR_FOCUSABLE)) {
    if (noeud === depart || depart.contains(noeud) || noeud.contains(depart)) continue;
    if (dansUnCalqueFixe(noeud)) continue;

    const boite = noeud.getBoundingClientRect();
    if (boite.width === 0 || boite.height === 0) continue;

    const bord = bordDe(boite, versLaFin, vertical, false);
    const auDela = versLaFin ? bord > bordDepart + TOLERANCE : bord < bordDepart - TOLERANCE;
    if (!auDela) continue;

    // L'atteignabilité en dernier : c'est le test le plus coûteux — il lit des
    // styles calculés — et la géométrie vient de trancher pour presque tous.
    if (cibleAtteignable(noeud)) return true;
  }

  return false;
}

/**
 * Le bord qui compte. Pour le DÉPART, celui par lequel on sort ; pour un
 * candidat, celui par lequel il entre. Comparer deux fois le même bord ferait
 * passer pour « au-delà » un élément qui ne fait que dépasser.
 */
function bordDe(boite: DOMRect, versLaFin: boolean, vertical: boolean, depart: boolean): number {
  if (vertical) {
    return versLaFin === depart ? boite.bottom : boite.top;
  }
  return versLaFin === depart ? boite.right : boite.left;
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
export function dansUnCalqueFixe(element: HTMLElement): boolean {
  for (let courant: HTMLElement | null = element; courant; courant = courant.parentElement) {
    if (window.getComputedStyle(courant).position === "fixed") return true;
  }
  return false;
}
