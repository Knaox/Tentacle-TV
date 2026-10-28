/**
 * L'adresse AFFICHABLE d'une pochette — la règle unique d'Octave, reprise
 * telle quelle par la carte d'une écoute dans les sessions en cours de
 * l'administration (jamais une règle à part).
 *
 * - Une adresse d'un autre hôte (https) reste telle quelle, SANS le jeton : il
 *   ne quitte jamais le serveur Tentacle.
 * - Un chemin du serveur suit la règle du moteur (`elementSourceUrl`) : tel quel
 *   avec une session par cookie (le web), le jeton en `api_key` sinon (le
 *   bureau) — une `<img>` ne pose pas d'en-tête.
 * - Une image GARDÉE sur l'appareil (origine locale de la coquille,
 *   `tentacle://local/…`, « Sur cet appareil ») : telle quelle, sans jeton — un
 *   schéma autre que http(s) n'est jamais le serveur.
 *
 * - Au BUREAU (`artCache`), toute adresse http(s) passe par le cache disque
 *   des pochettes de la coquille (`tentacle://art`, processus principal) :
 *   demandée une fois, puis servie du disque — hors ligne compris. L'identité
 *   range l'entrée ; l'adresse d'origine voyage telle qu'elle (le jeton
 *   seulement vers le serveur Tentacle, jamais vers un autre hôte).
 *
 * Module pur : il n'importe que les adresses du moteur, jamais le moteur.
 */

import { elementSourceUrl, type MusicEngineAuth } from "../../engine/engineShared";

/** Le cache disque des pochettes de la coquille de bureau. */
export const ART_CACHE_ORIGIN = "tentacle://art";

export interface ArtCacheTarget {
  /** L'identité (serveur + compte) qui range l'entrée. */
  owner: string | null;
}

export function artworkSrcOf(url: string | null, auth: MusicEngineAuth, artCache?: ArtCacheTarget): string | null {
  if (!url) return null;
  // Une image gardée en mémoire par l'appareil (copie d'une jaquette, `keptCovers/`) : telle quelle.
  if (/^(blob|data):/i.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url) && !/^https?:\/\//i.test(url)) return url;
  const direct = /^https?:\/\//i.test(url) ? url : elementSourceUrl(url, auth);
  if (!artCache || !/^https?:\/\//i.test(direct)) return direct;
  return `${ART_CACHE_ORIGIN}/?o=${encodeURIComponent(artCache.owner ?? "")}&u=${encodeURIComponent(direct)}`;
}
