/**
 * Revenir à la recherche depuis une ÉTAGÈRE (Parcourir : une personne, un
 * genre, un studio ouverts depuis la recherche) : la recherche rend sa BARRE,
 * pas la carte qu'on avait quittée (RE-7). Module pur : la plateforme pose le
 * focus et compte les minuteries.
 *
 * Sur tvOS, le retour se pose À LA FIN de la transition (`arrive`, non
 * `closing`) : la plateforme restaure d'elle-même la carte quittée une fois
 * le fondu fini, et défaisait une pose partie avant. Et le retour peut ARRIVER
 * deux fois (mesuré : la seconde 0,7 s après la première) : toute arrivée
 * dans la fenêtre `SEARCH_SHELF_RETURN_MS` reprend la barre.
 *
 * Poser la barre se fait en DEUX temps (`SEARCH_BAR_CLAIMS_MS`) : quand le
 * focus est dans la navigation, la première pose ne fait que rendre à l'écran
 * sa dernière cible ; la seconde atteint la barre. C'est aussi ce que fait
 * « Rechercher », rechoisi dans la navigation, depuis la recherche (RE-8).
 */

/** Les deux poses de la barre, en millisecondes après le geste. */
export const SEARCH_BAR_CLAIMS_MS: readonly number[] = [0, 400];

/** La fenêtre pendant laquelle une arrivée reprend encore la barre. */
export const SEARCH_SHELF_RETURN_MS = 1500;

export interface ShelfReturnState {
  /** Une étagère a été ouverte depuis la recherche : son retour rend la barre. */
  readonly browsing: boolean;
}

export const SHELF_RETURN_IDLE: ShelfReturnState = { browsing: false };

export type ShelfReturnEvent =
  /** On part vers une étagère. */
  | { type: "leave" }
  /** Une transition de l'écran de la recherche a fini (`closing` : il part). */
  | { type: "arrive"; closing: boolean }
  /** La fenêtre du retour est passée. */
  | { type: "settle" };

export type ShelfReturnEffect =
  /** Poser la barre (`SEARCH_BAR_CLAIMS_MS`). */
  | { type: "focusBar" }
  /** (Ré)armer la fin de la fenêtre : un `settle` dans `ms`, le précédent annulé. */
  | { type: "armSettle"; ms: number };

export interface ShelfReturnStep {
  state: ShelfReturnState;
  effects: ShelfReturnEffect[];
}

export function shelfReturnStep(state: ShelfReturnState, event: ShelfReturnEvent): ShelfReturnStep {
  switch (event.type) {
    case "leave":
      return { state: { browsing: true }, effects: [] };
    case "arrive":
      if (event.closing || !state.browsing) return { state, effects: [] };
      return { state, effects: [{ type: "focusBar" }, { type: "armSettle", ms: SEARCH_SHELF_RETURN_MS }] };
    case "settle":
      return { state: { browsing: false }, effects: [] };
  }
}
