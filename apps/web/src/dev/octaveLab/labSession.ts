/**
 * Labo d'Octave — la SESSION factice : un client Jellyfin qui ne joint personne (le faux serveur
 * répond à sa place), et la garde de ce que le vrai Octave tient sur l'appareil.
 *
 * Ouvert DANS l'application de développement, le labo tourne sous le compte connecté : le lecteur
 * d'Octave y écrirait sa session (dernier titre, file) à la place de la vraie. `protectDeviceState`
 * la met de côté au montage et la rend au démontage.
 */

import { JellyfinClient, OCTAVE_PLAYER_KEY, WebStorageAdapter, WebUuidGenerator, type TentacleConfig } from "@tentacle-tv/api-client";

export interface LabSession {
  config: TentacleConfig;
  client: JellyfinClient;
}

export function createLabSession(): LabSession {
  const storage = new WebStorageAdapter();
  const uuid = new WebUuidGenerator();
  const client = new JellyfinClient("/api/jellyfin", storage, uuid, "Web", "Tentacle TV - Labo", "0.0.0");
  // Comme le web : session par cookie, aucun jeton dans la page (les pochettes gardent leur adresse telle quelle).
  client.useCredentials = true;
  return { config: { storage, uuid }, client };
}

/** Ce que le lecteur d'Octave écrit sur l'appareil pendant une scène. ⚠️ Clés de stockage : jamais renommées. */
const PROTECTED_KEYS: readonly string[] = [OCTAVE_PLAYER_KEY];

let mounted = 0;
let kept: Map<string, string | null> | null = null;

/** Met de côté l'état d'appareil du vrai Octave ; rend de quoi le remettre (après le démontage du lecteur). */
export function protectDeviceState(): () => void {
  if (mounted === 0 && kept === null) {
    kept = new Map();
    for (const key of PROTECTED_KEYS) {
      try {
        kept.set(key, localStorage.getItem(key));
        localStorage.removeItem(key);
      } catch {
        /* stockage refusé : rien à garder */
      }
    }
  }
  mounted += 1;
  return () => {
    mounted -= 1;
    // Après la validation en cours : le lecteur garde sa session en se démontant, APRÈS ce nettoyage.
    setTimeout(() => {
      if (mounted > 0 || kept === null) return;
      for (const [key, value] of kept) {
        try {
          if (value === null) localStorage.removeItem(key);
          else localStorage.setItem(key, value);
        } catch {
          /* stockage refusé */
        }
      }
      kept = null;
    }, 0);
  };
}
