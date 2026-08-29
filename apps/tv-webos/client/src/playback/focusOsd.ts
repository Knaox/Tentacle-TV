import { reviewAfterMount } from "../focus/wait";
import { giveFocus } from "../focus/active";
import { ENTRY_ATTRIBUTE, destinationEntreeDeZone } from "../focus/zones";

/**
 * Où se pose le focus dans le lecteur, et quand.
 *
 * Sorti de `ControlsTv`, qui approchait les trois cents lignes et dont ce
 * n'est pas le sujet : lui orchestre les modes, ici on ne fait que viser.
 */

/** Le panneau ouvert, s'il y en a un. */
function panelOpen(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".panneau-tv");
}

/**
 * Combien de temps on attend la liste avant de renoncer à l'affiner.
 *
 * Plus généreux que le budget d'un déplacement (250 ms) : la liste des épisodes
 * arrive avec une requête réseau. On peut se le permettre parce que le focus
 * est posé AVANT d'attendre — l'utilisateur n'est jamais sans anneau, et ce
 * budget-ci ne décide que du raffinement.
 */
const PANEL_BUDGET_MS = 2000;

/**
 * Entrer dans un panneau qui vient de s'ouvrir.
 *
 * **En deux temps, et c'est ce qui manquait.** Un panneau paraît avant ses
 * données : à la première image, la liste des épisodes est vide et la cascade
 * d'entrée n'a rien de mieux à proposer que la croix de fermeture. Poser le
 * focus là et s'arrêter — ce que faisait la version précédente — le laissait
 * sur la croix pour de bon, les lignes arrivant une requête plus tard sans que
 * rien ne relance la pose.
 *
 * On pose donc tout de suite ce qu'on a, puis on affine dès que l'enveloppe a
 * désigné l'option active (`data-tv-zone-entree`, cf. `panelEntry.ts`).
 *
 * **On ne reprend pas le focus à quelqu'un qui s'en sert.** Si l'utilisateur a
 * bougé entre-temps, le raffinement se tait : rien n'est plus désagréable
 * qu'un anneau qui saute alors qu'on vient de le déplacer soi-même.
 */
export function enterPanel(): void {
  const panel = panelOpen();
  if (!panel) return;
  if (panel.contains(document.activeElement)) return;

  const provisional = destinationEntreeDeZone(panel);
  if (provisional) giveFocus(provisional);

  reviewAfterMount(
    () => {
      const current = panelOpen();
      // Refermé entre-temps : il n'y a plus rien à affiner.
      if (!current) return true;

      const marquee = current.querySelector<HTMLElement>(`[${ENTRY_ATTRIBUTE}]`);
      if (!marquee) return false;
      if (document.activeElement === marquee) return true;
      if (document.activeElement !== provisional) return true;

      giveFocus(marquee);
      return true;
    },
    { budgetMs: PANEL_BUDGET_MS },
  );
}

/**
 * Rendre le focus à ce qui avait ouvert le panneau, ou au centre de l'habillage.
 *
 * Le déclencheur d'abord : refermer les réglages doit ramener sur le bouton
 * « Pistes », et non au milieu de la rangée. S'il a disparu — un changement
 * d'épisode démonte l'habillage — on retombe sur le bouton par défaut.
 */
export function exitPanel(trigger: HTMLElement | null, racine: HTMLElement | null): void {
  if (trigger && trigger.isConnected) {
    giveFocus(trigger);
    return;
  }
  poserFocusOsd(racine);
}

/**
 * Le dernier bouton de l'habillage qu'on ait visé, pour l'y retrouver.
 *
 * L'habillage s'éteint au bout de cinq secondes et se démonte avec. Le
 * rallumer reposait le focus sur Lecture, quel que soit ce qu'on faisait juste
 * avant : régler trois fois de suite le volume d'une piste demandait de
 * retraverser la rangée à chaque fois. L'Apple TV rend le dernier bouton
 * utilisé, et c'est ce qui fait qu'une rangée de sept boutons reste praticable.
 *
 * La mémoire ne survit pas au lecteur : `forgetOsdButton` est appelé à son
 * démontage. Rouvrir un film repart de Lecture, comme une première fois.
 */
let lastButton: string | null = null;

/** Appelé quand le focus entre dans un bouton de la rangée. */
export function rememberOsdButton(key: string | null): void {
  if (key) lastButton = key;
}

export function forgetOsdButton(): void {
  lastButton = null;
}

/**
 * Poser le focus au centre de gravité de l'habillage.
 *
 * L'habillage n'est pas un écran : le moteur ne repose pas le focus quand il
 * paraît, puisque la route ne change pas. La rangée dépend en outre de
 * l'épisode suivant, qui arrive après une requête — d'où la révision.
 */
export function poserFocusOsd(racine: HTMLElement | null): void {
  reviewAfterMount(() => {
    if (!racine) return false;
    if (racine.contains(document.activeElement)) return true;

    // Le dernier bouton visé d'abord — mais il peut avoir disparu depuis :
    // « épisode suivant » n'existe pas sur le dernier de la saison.
    const memory = lastButton
      ? racine.querySelector<HTMLElement>(`[data-osd-bouton="${lastButton}"]`)
      : null;
    const target = memory ?? racine.querySelector<HTMLElement>("[data-osd-defaut]");
    if (!target) return false;
    giveFocus(target);
    return true;
  });
}
