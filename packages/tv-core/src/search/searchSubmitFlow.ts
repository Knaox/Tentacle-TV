import { SEARCH_SUBMIT_WAIT_MS, type SearchSubmitAnswer } from "./searchSubmit";

/**
 * Le DÉROULÉ d'une validation au clavier système — ce qui se passe entre
 * « Rechercher » et le focus posé sur le premier résultat. Module pur : le
 * temps arrive dans les évènements (`at`), les minuteries et la pose du focus
 * sont des EFFETS que la plateforme applique.
 *
 * tvOS referme son clavier plein écran à la validation et rend ensuite le
 * focus à la barre de recherche : les résultats sont là, derrière. La règle
 * (celle de la LG, `searchSubmitAnswer`) : au premier résultat si la réponse
 * à ce qui est tapé est affichée ; celle qui arrive dans `SEARCH_SUBMIT_WAIT_MS`
 * y mène encore, tant qu'aucune touche n'a été pressée depuis ; sinon le focus
 * reste où la plateforme le rend.
 *
 * Le MOMENT compte : une pose de focus pendant que le clavier se retire est
 * perdue (la plateforme rend ensuite le focus à ce qui l'avait). On attend
 * donc que le clavier soit PARTI — la barre a repris le focus (`gone`), ou le
 * filet de `KEYBOARD_GONE_MS` après l'annonce de sa fermeture.
 *
 * Et Menu, qui referme le clavier SANS valider, rend le focus au clavier à
 * l'écran (`keyboardClosedWithoutSubmit`) — sauf si une validation date de
 * moins de `CLOSE_AFTER_SUBMIT_MS` : la fermeture en est alors la suite.
 */

/** Filet : le clavier est parti sans que la barre ait signalé le focus rendu. */
export const KEYBOARD_GONE_MS = 800;

/** Une fermeture qui suit une validation de si près en est la suite, pas un Menu. */
export const CLOSE_AFTER_SUBMIT_MS = 1000;

export interface SearchSubmitFlowState {
  /** La validation en cours : son heure, et si le clavier est parti. */
  readonly pending: { readonly since: number; readonly gone: boolean } | null;
  /** L'heure de la dernière validation (0 : aucune). */
  readonly lastSubmit: number;
}

export const SEARCH_SUBMIT_IDLE: SearchSubmitFlowState = { pending: null, lastSubmit: 0 };

export type SearchSubmitEvent =
  /** « Rechercher » au clavier système. */
  | { type: "submit"; at: number }
  /** Le clavier annonce sa fermeture (validation ou Menu). */
  | { type: "closed"; at: number }
  /** Le clavier est parti : la barre a repris le focus, ou le filet a expiré. */
  | { type: "gone"; at: number; answer: SearchSubmitAnswer }
  /** La réponse à la saisie a changé (et au premier rendu). */
  | { type: "answer"; at: number; answer: SearchSubmitAnswer }
  /** Une touche pressée : l'utilisateur a pris la main. */
  | { type: "press" };

export type SearchSubmitEffect =
  /** Menu a fermé le clavier sans valider : le focus au clavier à l'écran. */
  | { type: "keyboardClosedWithoutSubmit" }
  /** (Ré)armer le filet : un évènement `gone` dans `ms`, le précédent annulé. */
  | { type: "armGoneTimer"; ms: number }
  /** Le filet n'a plus lieu d'être. */
  | { type: "cancelGoneTimer" }
  /** Poser le focus sur le premier résultat (la pose précédente annulée). */
  | { type: "focusFirstResult" };

export interface SearchSubmitStep {
  state: SearchSubmitFlowState;
  effects: SearchSubmitEffect[];
}

const NOTHING: SearchSubmitEffect[] = [];

/** La réponse est là (ou trop tard) : on conclut la validation partie. */
function land(state: SearchSubmitFlowState, at: number, answer: SearchSubmitAnswer): SearchSubmitStep {
  const pending = state.pending;
  if (!pending?.gone) return { state, effects: NOTHING };
  const late = at - pending.since > SEARCH_SUBMIT_WAIT_MS;
  if (answer === "pending" && !late) return { state, effects: NOTHING };
  const settled = { ...state, pending: null };
  if (answer !== "results" || late) return { state: settled, effects: NOTHING };
  return { state: settled, effects: [{ type: "focusFirstResult" }] };
}

export function searchSubmitStep(state: SearchSubmitFlowState, event: SearchSubmitEvent): SearchSubmitStep {
  switch (event.type) {
    case "submit":
      return { state: { pending: { since: event.at, gone: false }, lastSubmit: event.at }, effects: NOTHING };
    case "closed": {
      const pending = state.pending;
      if (!pending) {
        const menu = event.at - state.lastSubmit > CLOSE_AFTER_SUBMIT_MS;
        return { state, effects: menu ? [{ type: "keyboardClosedWithoutSubmit" }] : NOTHING };
      }
      if (pending.gone) return { state, effects: NOTHING };
      return { state, effects: [{ type: "armGoneTimer", ms: KEYBOARD_GONE_MS }] };
    }
    case "gone": {
      const pending = state.pending;
      if (!pending || pending.gone) return { state, effects: NOTHING };
      const landed = land({ ...state, pending: { ...pending, gone: true } }, event.at, event.answer);
      return { state: landed.state, effects: [{ type: "cancelGoneTimer" }, ...landed.effects] };
    }
    case "answer":
      return land(state, event.at, event.answer);
    case "press":
      return state.pending?.gone ? { state: { ...state, pending: null }, effects: NOTHING } : { state, effects: NOTHING };
  }
}
