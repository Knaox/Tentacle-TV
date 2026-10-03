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
 * L'abonnement natif naît avec le premier écouteur (observateur, contexte, ou
 * écouteur brut de la transition) et part avec le dernier. Apple TV
 * seulement : ailleurs, rien ne s'abonne et rien n'arrive.
 */

export const TVOS_REMOTE_SUPPORTED = Platform.OS === "ios";

/** L'entrée commune, nourrie par la Siri Remote. Une seule pour l'app. */
export const tvosInput = createRemoteInput(TVOS_BINDINGS);

/** L'événement natif tel quel, et son arrivée dans le JS (`Date.now()`). */
export type NativeRemoteListener = (event: HWEvent, at: number) => void;

const nativeListeners = new Set<NativeRemoteListener>();
let subscription: { remove(): void } | null = null;

function dispatch(event: HWEvent): void {
  const at = Date.now();
  for (const listener of [...nativeListeners]) listener(event, at);
  tvosInput.receive(readTvosEvent(event, at));
}

function sync(): void {
  if (!TVOS_REMOTE_SUPPORTED) return;
  const needed = nativeListeners.size > 0 || tvosInput.needed();
  if (needed && !subscription) {
    subscription = TVEventHandler.addListener(dispatch) ?? null;
  } else if (!needed && subscription) {
    subscription.remove();
    subscription = null;
  }
}

tvosInput.onDemand(sync);

/**
 * L'événement natif BRUT, avant traduction — pour la transition seulement :
 * les écouteurs d'avant l'extraction (`redesignWiring/remote/remoteEvents.ts`)
 * le lisent ici le temps de migrer vers les intentions. Un nouvel écouteur
 * observe les intentions (`useRemoteIntents`) ou inscrit un contexte
 * (`useRemoteContext`).
 */
export function subscribeNativeRemote(listener: NativeRemoteListener): () => void {
  if (!TVOS_REMOTE_SUPPORTED) return () => {};
  nativeListeners.add(listener);
  sync();
  return () => {
    if (!nativeListeners.delete(listener)) return;
    sync();
  };
}

/**
 * Menu, rendu par une source à part (`MenuPressInterceptor.onMenuPress`,
 * `Modal.onRequestClose`) : il entre dans l'entrée commune sous le nom
 * `menu`, que la table traduit en `retour`. Rend l'intention, résolue par la
 * pile des contextes au passage. Les écouteurs bruts ne le voient pas : ils
 * ne l'ont jamais vu.
 */
export function receiveMenu(): IntentEvent | null {
  return tvosInput.receive({ name: "menu", phase: "up", at: Date.now() });
}
