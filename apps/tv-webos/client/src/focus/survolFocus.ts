import { SELECTEUR_FOCUSABLE, cibleAtteignable, estUnChampDeSaisie } from "./candidats";
import { pointeurActif } from "./curseur";

/**
 * Le survol : capté avant React, et rendu au focus.
 *
 * Un téléviseur LG a un pointeur — la Magic Remote en fait apparaître un dès
 * qu'on agite la télécommande, et une souris branchée en donne un aussi. Ce
 * module en fait un moyen de déplacer le FOCUS, et il empêche tout le reste.
 *
 * **Pourquoi il faut couper les événements et pas seulement les hooks.** Le
 * survol du client web a été éteint par deux voies : la passe PostCSS retire
 * les règles `:hover` de la feuille — il n'en reste aucune, c'est vérifiable —
 * et `shims/survolInerte.ts` remplace `useHoverPreview`, `useHoverGuard` et
 * `useHoverMount`. Ce n'était pas assez. Dix composants d'`apps/web` tiennent
 * leur PROPRE état de survol, sans passer par aucun de ces hooks :
 * `EpisodeCard` et `PosterCard` posent un `hovered` local qui écrit un
 * `z-index` en style en ligne, `HorizontalScrollRow` et `MediaRow` suivent la
 * carte survolée, `HeroBillboard` met sa rotation en pause. Les substituer un
 * par un serait dix forks à maintenir, pour un défaut qui a une seule cause.
 *
 * Cette cause est que les événements de survol arrivent jusqu'à React. On les
 * arrête donc avant : un écouteur en phase de CAPTURE sur `document` s'exécute
 * avant que l'événement n'atteigne la racine React, et `stopPropagation` fait
 * le reste. Aucun `onMouseEnter` du client web ne se déclenche plus, quel que
 * soit le composant, y compris ceux qu'on n'a pas lus.
 *
 * `stopPropagation` et non `stopImmediatePropagation` : les autres écouteurs
 * posés sur `document` — le mode pointeur de `curseur.ts`, notamment —
 * continuent de recevoir ce qui leur revient. On coupe la descente vers l'arbre,
 * pas le voisinage.
 *
 * **Ce qui reste actif : le clic.** `mousedown`, `mouseup` et `click` ne sont
 * pas touchés. On retire la sélection au survol, pas le pointeur.
 *
 * `mouseover` et non `mousemove` : l'événement ne part qu'au changement
 * d'élément survolé. Balayer l'écran ne coûte donc pas un traitement par image,
 * et il n'y a rien à étrangler.
 */

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
  const surSurvol = (evenement: Event) => {
    // Barré dans tous les cas, y compris quand le moteur est suspendu : le
    // lecteur n'a pas plus besoin du survol du web que le reste, et son
    // habillage est piloté par `lecture/masquageAutoTv.ts`.
    evenement.stopPropagation();
    if (suspendu()) return;

    // Un `mouseover` n'est pas la preuve qu'on a bougé le pointeur.
    //
    // Après un défilement, le navigateur refait son test de collision et
    // signale l'élément qui se trouve DÉSORMAIS sous un pointeur resté
    // immobile. Le focus partait alors dans le sens du défilement, au lieu de
    // rester où la flèche l'avait mis — et le défaut était asymétrique, donc
    // incompréhensible à l'usage : en descendant le vol suivait l'intention,
    // en remontant il la contredisait.
    //
    // Le mode d'entrée tranche sans rien supposer : `curseur.ts` bascule en
    // `dpad` sur `keydown` EN CAPTURE, donc avant que le déplacement n'ait
    // commencé, a fortiori avant le `mouseover` qu'il provoquera. Et un vrai
    // pointeur qui vient se poser sur un élément a nécessairement traversé
    // l'écran — donc émis `mousemove`, donc rétabli le mode.
    if (!pointeurActif()) return;

    const cible = evenement.target;
    if (!(cible instanceof HTMLElement)) return;

    const focusable = cible.closest<HTMLElement>(SELECTEUR_FOCUSABLE);
    if (!focusable) return;
    if (focusable === document.activeElement) return;
    // Un pointeur qui traverse un champ de recherche ferait surgir le clavier
    // système plein écran de webOS. On laisse les champs au clic et au D-pad,
    // qui sont des gestes intentionnels — traverser n'en est pas un.
    if (estUnChampDeSaisie(focusable)) return;

    // Même juge que le recensement du D-pad. Il ne s'agit pas de prudence de
    // principe : une commande à `opacity: 0` reçoit les événements de souris
    // sans rien montrer, et le focus s'y poserait sans anneau visible —
    // exactement le trou noir que le moteur évite déjà de son côté.
    if (!cibleAtteignable(focusable)) return;

    focusable.focus();
  };

  // Les trois autres n'ont rien à désigner : ils ne servent qu'à DÉFAIRE ce
  // qu'un survol a fait, et il n'y a plus rien à défaire. On les barre pour que
  // React ne synthétise ni `onMouseEnter` ni `onMouseLeave` — il les déduit de
  // `mouseover` et `mouseout`, et `mouseenter`/`mouseleave` se propagent en
  // capture même s'ils ne remontent pas.
  const barrer = (evenement: Event) => evenement.stopPropagation();
  const BARRES = ["mouseout", "mouseenter", "mouseleave"];

  document.addEventListener("mouseover", surSurvol, true);
  BARRES.forEach((type) => document.addEventListener(type, barrer, true));

  return () => {
    document.removeEventListener("mouseover", surSurvol, true);
    BARRES.forEach((type) => document.removeEventListener(type, barrer, true));
  };
}
