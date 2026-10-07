import { getDirectStreamingConfig, getPublicUrl } from "../services/configStore";
import { readRemoteAccessSettings } from "./remoteAccessSettings";

/**
 * « Accès depuis l'extérieur » : la seule porte entre ce qui est RÉGLÉ et ce
 * qui est PUBLIÉ. Coupé, rien de public ne sort — ni le lien public de
 * Tentacle, ni l'adresse publique de Jellyfin — et la lecture hors de la
 * maison passe par Tentacle (qui joint Jellyfin par son adresse privée). Les
 * réglages restent, rien d'autre n'est touché : rallumé, tout revient.
 */
export function isExposed(): boolean {
  return readRemoteAccessSettings().enabled;
}

/** Le lien public de Tentacle, s'il est publié. */
export function publishedPublicUrl(): string | null {
  return isExposed() ? getPublicUrl() : null;
}

/** L'adresse publique de Jellyfin, si la lecture directe s'en sert ET que l'accès extérieur est allumé. */
export function publishedJellyfinPublicUrl(): string | null {
  const direct = getDirectStreamingConfig();
  return direct.enabled && isExposed() ? direct.publicUrl : null;
}

/**
 * L'adresse de Jellyfin qu'un client lira en direct, ou `null` (il lit par
 * Tentacle) : la privée sur le réseau local — elle seule suffit à allumer la
 * lecture directe — la publique ailleurs, si elle est réglée et publiée.
 */
export function directMediaBaseUrl(clientIsPrivate: boolean): string | null {
  const direct = getDirectStreamingConfig();
  if (!direct.enabled || !direct.privateUrl) return null;
  return clientIsPrivate ? direct.privateUrl : publishedJellyfinPublicUrl();
}
