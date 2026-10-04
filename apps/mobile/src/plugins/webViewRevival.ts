/**
 * La page d'une extension perd parfois son processus de rendu sans y être
 * pour rien : iOS reprend la mémoire d'une WebView cachée (un autre onglet,
 * l'app en arrière-plan), Android tue son moteur de rendu. Sans réponse, la
 * page restait NOIRE pour toujours — et, si l'un de ses panneaux était ouvert,
 * le voile du chrome restait posé : plus de barre d'onglets, plus d'issue que
 * de tuer l'app.
 *
 * La règle, pure (sans React ni React Native) :
 *   - perdue alors qu'elle s'était affichée (`ready`), ou perdue CACHÉE : la
 *     page renaîtra au retour à l'écran — pas avant, une WebView cachée n'a
 *     rien à recharger (et la mémoire vient d'être reprise) ;
 *   - perdue sous les yeux avant d'avoir pu s'afficher : c'est elle qui
 *     plante. On le dit (« Réessayer ») plutôt que de la relancer en boucle.
 */

export interface RevivalState {
  /** Une WebView neuve à chaque renaissance : la clé de son montage. */
  generation: number;
  /** La page a dit READY depuis son dernier chargement. */
  ready: boolean;
  /** Processus perdu : la WebView n'est plus montée, elle attend d'être revue. */
  lost: boolean;
  /** Perdue avant de s'afficher, sous les yeux : on ne relance plus seul. */
  crashed: boolean;
}

export type RevivalEvent =
  | { type: "ready" }
  | { type: "lost"; visible: boolean }
  /** La page est (de nouveau) à l'écran. */
  | { type: "shown" }
  | { type: "retry" };

export const INITIAL_REVIVAL: RevivalState = { generation: 0, ready: false, lost: false, crashed: false };

export function revivalReducer(state: RevivalState, event: RevivalEvent): RevivalState {
  switch (event.type) {
    case "ready":
      return state.ready ? state : { ...state, ready: true };
    case "lost":
      if (state.lost || state.crashed) return state;
      if (!state.ready && event.visible) return { ...state, crashed: true };
      return { ...state, lost: true, ready: false };
    case "shown":
      return state.lost ? { ...state, lost: false, generation: state.generation + 1 } : state;
    case "retry":
      return { generation: state.generation + 1, ready: false, lost: false, crashed: false };
  }
}
