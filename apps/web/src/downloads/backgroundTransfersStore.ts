/**
 * « Continuer en arrière-plan » (bureau) vu par la page : un réglage de CET appareil, tenu par le processus
 * principal (base locale, clé `background_transfers`) qui le lit à la fermeture de la fenêtre. Lu une fois,
 * puis tenu en mémoire : Réglages › Téléchargements et les Réglages d'Octave montrent la même valeur.
 * Sans la commande (web, coquille d'avant) : `null`, et la ligne n'existe pas.
 */

import { useEffect, useSyncExternalStore } from "react";
import { invoke } from "../desktop/bridge";
import { supportsBackgroundTransfers } from "../desktop/capabilities";

let value: boolean | null = null;
let loading = false;
const listeners = new Set<() => void>();

const publish = (next: boolean): void => {
  value = next;
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const read = (): boolean | null => value;

function load(): void {
  if (value !== null || loading || !supportsBackgroundTransfers()) return;
  loading = true;
  void invoke<boolean>("downloads_background_get")
    .then(publish)
    .catch(() => undefined)
    .finally(() => {
      loading = false;
    });
}

/** Change le réglage ; la valeur affichée suit la réponse du processus principal (jamais une valeur supposée). */
export async function setBackgroundTransfers(on: boolean): Promise<void> {
  if (!supportsBackgroundTransfers()) return;
  try {
    publish(await invoke<boolean>("downloads_background_set", { on }));
  } catch {
    // Refusé : la valeur d'avant reste affichée.
  }
}

/** La valeur, `null` tant qu'elle n'est pas lue ou hors de la coquille. */
export function useBackgroundTransfers(): boolean | null {
  useEffect(load, []);
  return useSyncExternalStore(subscribe, read, read);
}
