/**
 * Le clavier système du téléviseur, et pourquoi le moteur doit s'écarter.
 *
 * Sur webOS, focaliser un `<input>` fait monter le clavier virtuel — seul, en
 * plein écran, et **sans qu'on puisse l'en empêcher** : c'est le guide officiel
 * qui le dit, l'application n'a rien à demander ni à dessiner. Tant qu'il est
 * là, les flèches lui appartiennent : elles déplacent la sélection sur ses
 * touches, pas le focus dans la page.
 *
 * Or le moteur les consomme en capture, `preventDefault` compris. LG documente
 * le symptôme exact — le focus « cascade » à travers la navigation spatiale
 * après une validation au clavier — et le fil est clos sans contournement. La
 * seule chose à faire est de se taire : `keyboardStateChange` est un événement
 * DOM ordinaire, il n'exige pas `webOSTV.js` (que le CSP du client interdit de
 * toute façon), et son `detail.visibility` dit tout.
 *
 * **Ce qu'il ne faut SURTOUT pas faire**, et le guide le souligne : retirer le
 * focus du champ quand `visibility` repasse à faux. La séquence d'une dictée
 * est vrai → faux → vrai — le clavier s'efface pendant que l'interface vocale
 * s'affiche, puis revient. Blurrer sur le faux casserait la saisie vocale, la
 * seule qui existe sur cette plateforme : le téléviseur transcrit lui-même et
 * écrit le texte dans le champ, l'application ne reçoit jamais l'audio.
 *
 * Sur un navigateur de bureau, l'événement n'existe pas : la porte reste
 * ouverte et rien ne change.
 */

import { estUnChampDeSaisie } from "./candidats";

let clavierMonte = false;

/**
 * Le clavier système occupe-t-il l'écran ?
 *
 * Deux conditions, et la seconde est un filet.
 *
 * Le drapeau seul rendait le moteur définitivement muet si le `visibility:
 * false` n'arrivait jamais — un événement manquant, et plus une flèche n'était
 * traitée nulle part dans l'application, sans erreur ni trace. C'est un point
 * de défaillance unique posé sur une notification de plateforme, et une
 * notification de plateforme finit toujours par manquer à l'appel.
 *
 * La seconde condition n'en dépend pas : **le clavier de webOS n'existe que pour
 * un champ de saisie.** Si le focus n'y est plus, il n'est plus là, quel que
 * soit le dernier événement reçu.
 *
 * Elle ne casse pas la dictée, et c'est ce qui la rend utilisable : la séquence
 * vrai → faux → vrai que LG documente se déroule sans que le champ perde le
 * focus. On reste donc suspendu du début à la fin, comme il le faut.
 */
export function clavierSystemeVisible(): boolean {
  if (!clavierMonte) return false;
  if (typeof document === "undefined") return false;
  return estUnChampDeSaisie(document.activeElement as HTMLElement | null);
}

export function surveillerClavierSysteme(): () => void {
  const surChangement = (evenement: Event) => {
    const detail = (evenement as CustomEvent<{ visibility?: boolean }>).detail;
    clavierMonte = detail?.visibility === true;
  };

  document.addEventListener("keyboardStateChange", surChangement);
  return () => {
    document.removeEventListener("keyboardStateChange", surChangement);
    clavierMonte = false;
  };
}
