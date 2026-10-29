/**
 * Octave — la session du lecteur gardée sur l'appareil et reprise en pause : la règle PARTAGÉE
 * (`attachPlayerResume`, api-client) sur le `localStorage` de la page, sauvée aussi à la sortie de page.
 * Reprise DANS LE MÊME LANCEMENT seulement : le lancement est celui de l'onglet, ou de la fenêtre du bureau
 * (`sessionStorage` : gardé à un rechargement, perdu quand l'onglet se ferme ou que l'application est quittée) —
 * au démarrage, rien n'est restauré.
 * Clés de stockage : elles ne se renomment jamais.
 */

import { attachPlayerResume as attachSharedResume, OCTAVE_PLAYER_KEY } from "@tentacle-tv/api-client";
import type { OctavePlayer } from "@tentacle-tv/shared/octave";
import { octaveOwner } from "./octaveOwner";

export { OCTAVE_PLAYER_KEY };

export function forgetOctavePlayer(): void {
  try {
    localStorage.removeItem(OCTAVE_PLAYER_KEY);
  } catch {
    /* rien à oublier */
  }
}

const LAUNCH_KEY = "tentacle_octave_run";
let fallbackLaunch: string | null = null;

/** Le lancement de cet onglet (fenêtre du bureau) : créé au premier appel, gardé jusqu'à sa fermeture. */
export function octaveLaunchId(): string {
  try {
    const known = sessionStorage.getItem(LAUNCH_KEY);
    if (known) return known;
    const fresh = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(LAUNCH_KEY, fresh);
    return fresh;
  } catch {
    // Stockage de session bloqué : un lancement par chargement de la page.
    fallbackLaunch ??= `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    return fallbackLaunch;
  }
}

/** Reprend la session gardée de cette identité, puis la tient à jour (rend le détachement). */
export function attachPlayerResume(player: OctavePlayer, owner: string | null): () => void {
  return attachSharedResume(player, owner, {
    storage: localStorage,
    ownerNow: octaveOwner,
    launchId: octaveLaunchId,
    onHide: (save) => {
      const onHidden = () => {
        if (document.visibilityState === "hidden") save();
      };
      window.addEventListener("pagehide", save);
      document.addEventListener("visibilitychange", onHidden);
      return () => {
        window.removeEventListener("pagehide", save);
        document.removeEventListener("visibilitychange", onHidden);
      };
    },
  });
}
