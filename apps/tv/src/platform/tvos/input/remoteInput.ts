import { Platform, TVEventHandler, type HWEvent } from "react-native";
import { createRemoteInput, readTvosEvent, TVOS_BINDINGS, type IntentEvent } from "@tentacle-tv/tv-core";

/**
 * L'ENTRÉE UNIQUE de la télécommande d'Apple TV — le seul abonnement à
 * `TVEventHandler` du chemin refondu.
 *
 * Chaque événement natif est lu en signal (`readTvosEvent`) et donné à
 * l'entrée commune de tv-core (`createRemoteInput`), qui le traduit par la
 * table de la Siri Remote (`TVOS_BINDINGS`) en intention, la montre à ses
 * observateurs puis la fait résoudre par la pile des contextes. Rien ne se
 * décide ici : ce module lit, et les comportements de tv-core décident
 * (`docs/TV-NAVIGATION.md`).
 *
 * Menu n'arrive pas par `TVEventHandler` (l'app n'active pas
 * `enableTVMenuKey`) : ses sources — `MenuPressInterceptor`,
 * `Modal.onRequestClose` — le rendent par `receiveMenu`.
 *
 * L'abonnement natif naît avec le premier écouteur (observateur ou contexte)
 * et part avec le dernier. Apple TV seulement : ailleurs, rien ne s'abonne et
 * rien n'arrive.
 */

export const TVOS_REMOTE_SUPPORTED = Platform.OS === "ios";

/** L'entrée commune, nourrie par la Siri Remote. Une seule pour l'app. */
export const tvosInput = createRemoteInput(TVOS_BINDINGS);

let subscription: { remove(): void } | null = null;

function dispatch(event: HWEvent): void {
  tvosInput.receive(readTvosEvent(event, Date.now()));
}

function sync(needed: boolean): void {
  if (!TVOS_REMOTE_SUPPORTED) return;
  if (needed && !subscription) {
    subscription = TVEventHandler.addListener(dispatch) ?? null;
  } else if (!needed && subscription) {
    subscription.remove();
    subscription = null;
  }
}

tvosInput.onDemand(sync);

/**
 * Menu, rendu par une source à part (`MenuPressInterceptor.onMenuPress`,
 * `Modal.onRequestClose`) : il entre dans l'entrée commune sous le nom
 * `menu`, que la table traduit en `retour`. Rend l'intention, résolue par la
 * pile des contextes au passage.
 */
export function receiveMenu(): IntentEvent | null {
  return tvosInput.receive({ name: "menu", phase: "up", at: Date.now() });
}

/**
 * Pour `Modal.onRequestClose` (Menu dans une modale, qui a son propre
 * contrôleur) : Menu passe d'abord par l'entrée unique, puis la modale se
 * ferme comme avant — `onRequestClose={withMenuIntent(close)}`.
 */
export function withMenuIntent(close: () => void): () => void {
  return () => {
    receiveMenu();
    close();
  };
}
