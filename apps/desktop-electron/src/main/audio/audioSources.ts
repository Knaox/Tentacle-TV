/**
 * Les sources que le moteur accepte, et laquelle servir. Pur
 * (`audioSources.test.ts`).
 *
 * # Une seule origine, et seulement HTTP
 *
 * mpv ouvre bien plus que des URL web : `file://`, `lavfi://`, `av://`,
 * `fd://`… Une source qui pointerait ailleurs que sur le serveur Tentacle
 * ferait lire au moteur un fichier local, ou parler à un hôte que l'en-tête
 * d'authentification n'a pas à connaître. Le contrat le dit
 * (`PlaybackSource.url` est TOUJOURS un chemin du serveur Tentacle) ; le
 * principal le TIENT, puisque c'est lui qui pose le jeton sur chaque requête.
 *
 * ⚠️ Le jeton est un en-tête de l'INSTANCE (`http-header-fields`) : admettre
 * une autre origine ici (un flux googlevideo lu en direct) l'enverrait à cet
 * hôte. D'abord limiter le jeton aux requêtes du serveur (test « garde-fou »).
 */

import type { AudioBridgeSource } from "./audioBridgeContract";

/** L'origine `scheme://hôte[:port]` d'une adresse http(s), ou `null`. */
export function httpOrigin(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username !== "" || url.password !== "") return null;
  return url.origin;
}

/** Motif du refus d'une source, ou `null` si elle vient bien du serveur. */
export function refuseSource(url: string, serverOrigin: string | null): string | null {
  if (serverOrigin === null) return "moteur audio non démarré";
  const origin = httpOrigin(url);
  if (origin === null) return "source refusée : seulement http(s)";
  if (origin !== httpOrigin(serverOrigin)) return "source refusée : hors du serveur Tentacle";
  return null;
}

/** Une source qui expire bientôt est redemandée d'avance (`needSource`). */
export function expiresSoon(source: AudioBridgeSource, now: number, marginMs: number): boolean {
  return source.expiresAt !== null && source.expiresAt - now < marginMs;
}

/**
 * La source à servir pour un titre : une bascule reçue D'AVANCE (le titre
 * n'était alors ni courant ni suivant) l'emporte, sauf à reculer de la
 * bibliothèque vers une extension.
 */
export function servedSource(overrides: Map<string, AudioBridgeSource>, trackKey: string, given: AudioBridgeSource): AudioBridgeSource {
  const override = overrides.get(trackKey);
  if (override === undefined) return given;
  overrides.delete(trackKey);
  return override.origin === "library" || given.origin !== "library" ? override : given;
}
