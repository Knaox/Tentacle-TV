/**
 * Le focus de la FENÊTRE, tel que le processus principal le voit — tenu dans le
 * preload pour une lecture synchrone (`window.tentacle.windowFocus`).
 *
 * `document.hasFocus()` ne suffit pas : mesuré au banc par lg-chrome, il vaut
 * faux au chargement sans qu'aucun `blur` vienne le corriger, puis VRAI dès
 * qu'un outil pilote la page alors que la fenêtre, elle, n'a pas le focus. Or
 * la fenêtre inactive se ternit, à la façon de macOS (`data-window-inactive`) :
 * il lui faut la vérité d'AppKit, que seul le principal connaît.
 *
 * ⚠️ Importé par le preload (bundlé, bac à sable) : ne dépend de rien.
 */

/** Canal principal → page : le nouveau focus, à chaque `focus` / `blur` de la fenêtre. */
export const WINDOW_FOCUS_CHANNEL = "tentacle:window-focus";
/** Canal synchrone page → principal : le focus courant, lu une fois au chargement du preload. */
export const WINDOW_FOCUS_GET_CHANNEL = "tentacle:window-focus-get";

export interface WindowFocusBridge {
  isFocused(): boolean;
  /** Rappelé à chaque CHANGEMENT ; rend le désabonnement. */
  subscribe(listener: (focused: boolean) => void): () => void;
}

/**
 * @param initial valeur lue au chargement (le principal la rend par `sendSync`).
 * @param listen  branche le rappel sur les messages du principal.
 */
export function createWindowFocusBridge(
  initial: boolean,
  listen: (onChange: (focused: unknown) => void) => void,
): WindowFocusBridge {
  let focused = initial;
  const listeners = new Set<(focused: boolean) => void>();
  listen((value) => {
    if (typeof value !== "boolean" || value === focused) return;
    focused = value;
    for (const listener of listeners) {
      // Un abonné de la page qui lève ne prive pas les autres de la nouvelle.
      try {
        listener(value);
      } catch {
        /* rien : l'erreur appartient à la page */
      }
    }
  });
  return {
    isFocused: () => focused,
    subscribe(listener) {
      if (typeof listener !== "function") return () => undefined;
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
