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
 *
 * Module pur : il n'importe que les adresses du moteur, jamais le moteur.
 */

import { elementSourceUrl, type MusicEngineAuth } from "../../engine/engineShared";

export function artworkSrcOf(url: string | null, auth: MusicEngineAuth): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return elementSourceUrl(url, auth);
}
