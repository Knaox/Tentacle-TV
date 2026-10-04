/**
 * Ce qu'un jeton d'APPAREIL (TV jumelée, session de profil d'une TV) peut
 * ÉCRIRE à travers le proxy.
 *
 * # Le problème
 *
 * Pour un appareil, le proxy remplace son jeton par la CLÉ D'ADMINISTRATION
 * de Jellyfin (`sessionRouting.ts`). La liste blanche des chemins
 * (`patterns.ts`) ne regardait pas la méthode : un appareil pouvait donc
 * supprimer ou modifier un titre, ses images ou ses métadonnées, avec les
 * pleins pouvoirs derrière.
 *
 * # La règle
 *
 * Un appareil LIT tout ce que la liste blanche ouvre (GET, HEAD) ; il
 * n'ÉCRIT que ce qui suit — relevé le 2026-10-04 dans l'Apple TV, l'Android
 * TV (toutes les versions livrées depuis tv-v1.0.0) et la LG : ses reports de
 * lecture, la négociation de lecture, ses données de lecture, « vu »,
 * favori, Ma liste, et l'arrêt de son transcodage. Évaluée sur le chemin
 * TEL QUE LE CLIENT L'ENVOIE (avant toute traduction), sans la query, en
 * toute casse (les `TranscodingUrl` arrivent en `videos/…`).
 *
 * Ce fichier n'importe rien et se teste seul.
 */

export interface DeviceWriteRoute {
  name: string;
  methods: readonly string[];
  pattern: RegExp;
}

export const DEVICE_WRITE_ROUTES: readonly DeviceWriteRoute[] = [
  /** La négociation de lecture (corps : le profil de l'appareil). */
  { name: "playbackInfo", methods: ["POST"], pattern: /^Items\/[^/]+\/PlaybackInfo$/i },
  /** Début, progression et arrêt de lecture (HTTP et `sendBeacon`). */
  { name: "playbackReport", methods: ["POST"], pattern: /^Sessions\/Playing(\/Progress|\/Stopped)?$/i },
  /** La position et l'état « vu » d'un titre (reprise, garde d'arrêt récent). */
  { name: "userData", methods: ["POST"], pattern: /^UserItems\/[^/]+\/UserData$/i },
  { name: "played", methods: ["POST", "DELETE"], pattern: /^Users\/[^/]+\/PlayedItems\/[^/]+$/i },
  { name: "favorite", methods: ["POST", "DELETE"], pattern: /^Users\/[^/]+\/FavoriteItems\/[^/]+$/i },
  /** Ma liste : les « j'aime » de Jellyfin (`likes=true`). */
  { name: "watchlist", methods: ["POST", "DELETE"], pattern: /^Users\/[^/]+\/Items\/[^/]+\/Rating$/i },
  /** L'arrêt de son propre transcodage (`deviceId`, `playSessionId`). */
  { name: "stopTranscode", methods: ["DELETE"], pattern: /^Videos\/ActiveEncodings$/i },
];

/** Cette requête d'appareil est-elle permise ? Toute lecture l'est (la liste
 *  blanche des chemins a déjà tranché) ; une écriture, seulement si elle est
 *  dans la liste ci-dessus. */
export function isDeviceWriteAllowed(method: string, path: string): boolean {
  const verb = method.toUpperCase();
  if (verb === "GET" || verb === "HEAD") return true;
  return DEVICE_WRITE_ROUTES.some((route) => route.methods.includes(verb) && route.pattern.test(path));
}
