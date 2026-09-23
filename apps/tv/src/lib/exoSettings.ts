import { useSyncExternalStore } from "react";
import { createBooleanStore } from "@tentacle-tv/shared";
import { tvStorage } from "../storage/RNStorageAdapter";

/**
 * Réglages d'APPAREIL du lecteur ExoPlayer (Android TV) — pas de compte : ils
 * dépendent du décodeur de CE téléviseur et n'ont aucun sens sur un autre.
 * Clé traversée par une chaîne — ne jamais renommer (cf. CLAUDE.md).
 */
export const EXO_TUNNELING_KEY = "tentacle_exo_tunneling";

/**
 * Lecture tunnelisée (décodeur et affichage en prise directe), ÉTEINTE par
 * défaut : avec un défaut à faux, seule la chaîne « true » l'allume. Elle casse
 * des choses réelles sur certains boîtiers (image noire, image figée au seek en
 * pause) — c'est à l'utilisateur de l'essayer.
 */
export const exoTunnelingStore = createBooleanStore(tvStorage, EXO_TUNNELING_KEY, false);

export function useExoTunneling(): boolean {
  return useSyncExternalStore(
    exoTunnelingStore.subscribe,
    exoTunnelingStore.readSnapshot,
    exoTunnelingStore.readSnapshot,
  );
}
