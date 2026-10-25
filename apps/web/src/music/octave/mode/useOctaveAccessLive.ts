/**
 * Octave — « Accès à Octave » suivi en direct DEPUIS TENTACLE (`octave.rights`).
 * Dans Octave, `useOctaveEvents` écoute déjà `music:*` ; hors d'Octave, rien ne
 * l'écoutait : une coupe ou un rétablissement par l'administration ne se
 * voyait qu'au rechargement. Le serveur envoie `music:provider` au compte (et
 * à ses invités) ; `useMusicEvents` vide alors les requêtes `["music"]` — le
 * statut se relit, la bascule et le réglage de démarrage suivent.
 *
 * Une souscription au socket PARTAGÉ (aucune connexion de plus), seulement face
 * à un serveur qui déclare le droit : un serveur d'avant, rien de nouveau.
 */

import { useJellyfinClient, useMusicCapability, useMusicEvents, useServerCapability } from "@tentacle-tv/api-client";

export function useOctaveAccessLive(enabled: boolean): void {
  const client = useJellyfinClient();
  const musical = useMusicCapability();
  const rights = useServerCapability("octave.rights");
  // Comme Octave : le jeton de la page (bureau), le cookie sinon (web).
  const token = client.getAccessToken() || readStoredToken();
  useMusicEvents({ enabled: enabled && musical && rights, token });
}

function readStoredToken(): string | null {
  try {
    return localStorage.getItem("tentacle_token");
  } catch {
    return null;
  }
}
