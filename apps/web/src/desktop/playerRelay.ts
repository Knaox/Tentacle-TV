/**
 * Le relais natif du LECTEUR : `PlaybackInfo` et `ActiveEncodings`.
 *
 * Même doctrine que `sessionPost.ts` : ces appels visent Jellyfin EN DIRECT —
 * `PlaybackInfo` ouvre la session de transcodage, qui doit tourner sous le
 * jeton UTILISATEUR (le proxy y substitue la clé admin) — mais la page vit
 * sous l'origine applicative `tentacle://app`, qu'aucun Jellyfin n'a de raison
 * d'autoriser. Mesuré le 28.08 : le préflight échoue, et l'échec coupait le
 * direct streaming pour TOUTE la session client — URLs médias du lecteur natif
 * comprises. Le processus principal, lui, n'est pas soumis au CORS.
 */

import { invoke } from "./bridge";
import { desktopKind } from "./detect";

/** La coquille porte-t-elle le relais du lecteur ? (Electron seulement.) */
export function supportsNativePlayerRelay(): boolean {
  const capabilities = window.tentacle?.capabilities;
  return (
    desktopKind() === "electron" &&
    (capabilities?.includes("jellyfin_playback_info") ?? false) &&
    (capabilities?.includes("jellyfin_kill_encodings") ?? false)
  );
}

/**
 * `POST /Items/{id}/PlaybackInfo` par le processus principal.
 *
 * ⚠️ Un échec doit LEVER, jamais rendre un statut inventé : l'appelant
 * distingue une réponse du serveur (le direct fonctionne) d'une panne de
 * transport (qui coupe le direct pour la session).
 */
export function nativePlaybackInfo(
  baseUrl: string,
  itemId: string,
  query: string,
  token: string,
  authHeader: string,
  body: string,
): Promise<{ status: number; body: string }> {
  return invoke<{ status: number; body: string }>("jellyfin_playback_info", {
    baseUrl,
    itemId,
    query,
    token,
    authHeader,
    body,
  });
}

/** `DELETE /Videos/ActiveEncodings` par le processus principal. */
export async function nativeKillEncodings(
  baseUrl: string,
  deviceId: string,
  playSessionId: string,
  token: string,
  authHeader: string,
): Promise<number> {
  const { status } = await invoke<{ status: number }>("jellyfin_kill_encodings", {
    baseUrl,
    deviceId,
    playSessionId,
    token,
    authHeader,
  });
  return status;
}
