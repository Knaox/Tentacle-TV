import { getDirectStreamingConfig, getPublicUrl } from "../services/configStore";
import { choosePairingUrl, type PairingRequestView } from "./pairingAddress";
import { readRemoteAccessSettings } from "./remoteAccessSettings";

/**
 * Ce qui est RÉGLÉ est publié — comme en 1.23.0. Le lien public de Tentacle
 * (`public_url`, sinon `TENTACLE_PUBLIC_URL`) et l'adresse publique de
 * Jellyfin (lecture directe) sont donnés aux applications dès qu'ils
 * existent ; une adresse vide n'est pas publiée. Plus d'interrupteur
 * « Accès depuis l'extérieur » entre les deux : il retenait des adresses déjà
 * en service chez qui passait de 1.23.0 à 1.24.0, et l'accès à distance
 * cessait de marcher sans que rien n'ait changé chez lui.
 */
export function publishedPublicUrl(): string | null {
  return getPublicUrl();
}

/**
 * L'adresse que `/api/config` → `publicUrl` donne aux clients : le mobile et
 * le web n'offrent le jumelage d'une TV que s'ils en ont une, et la TV la
 * grave. Le lien public s'il est réglé (1.23.0 ne donnait que lui), sinon
 * l'adresse privée réglée ; rien de réglé, celle par laquelle CE client du
 * réseau local nous joint (`pairingAddress.ts`). Un serveur sans lien public
 * se jumelle à la maison.
 */
export function pairingUrl(view?: PairingRequestView): string | null {
  return choosePairingUrl({ publicUrl: getPublicUrl(), localUrl: readRemoteAccessSettings().localUrl, view });
}

/** L'adresse publique de Jellyfin, si la lecture directe s'en sert. */
export function publishedJellyfinPublicUrl(): string | null {
  const direct = getDirectStreamingConfig();
  return direct.enabled ? direct.publicUrl : null;
}

/**
 * L'adresse de Jellyfin qu'un client lira en direct, ou `null` (il lit par
 * Tentacle) : la privée sur le réseau local — elle seule suffit à allumer la
 * lecture directe — la publique ailleurs, si elle est réglée. Avec les deux
 * adresses (le seul cas que 1.23.0 connaissait), le résultat est le même
 * qu'avant.
 */
export function directMediaBaseUrl(clientIsPrivate: boolean): string | null {
  const direct = getDirectStreamingConfig();
  if (!direct.enabled || !direct.privateUrl) return null;
  return clientIsPrivate ? direct.privateUrl : publishedJellyfinPublicUrl();
}
