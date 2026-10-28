/**
 * Octave — la session du lecteur gardée sur l'appareil et reprise en pause : la règle PARTAGÉE
 * (`attachPlayerResume`, api-client) sur le `localStorage` de la page, sauvée aussi à la sortie de page.
 * Clé de stockage : elle ne se renomme jamais.
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

/** Reprend la session gardée de cette identité, puis la tient à jour (rend le détachement). */
export function attachPlayerResume(player: OctavePlayer, owner: string | null): () => void {
  return attachSharedResume(player, owner, {
    storage: localStorage,
    ownerNow: octaveOwner,
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
