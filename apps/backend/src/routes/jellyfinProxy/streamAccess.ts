/**
 * Un FLUX ne part que vers un compte qui voit son titre.
 *
 * # Le problème
 *
 * Jellyfin ne garde pas ses flux : `/Videos/{id}/stream` (206) et
 * `/Videos/{id}/master.m3u8` (200) sont servis pour un titre que la politique
 * du compte lui interdit — avec SON propre jeton, avec la clé prêtée à un
 * appareil, et même sans jeton pour le fichier tel quel (mesuré sur 10.11.11,
 * docs/DROITS-UTILISATEURS.md § 7). Connaître l'identifiant suffisait.
 *
 * # La règle
 *
 * Sur un chemin de flux qui nomme son titre, le proxy demande d'abord à
 * Jellyfin si le compte de la requête le voit (`isItemVisibleTo`, verdict
 * gardé 30 s : les segments HLS d'une même lecture n'en coûtent qu'un). Non :
 * 404, comme Jellyfin pour une fiche interdite. Le compte est celui de
 * l'appareil, de « voir en tant que » ou du jeton Jellyfin ; sans compte
 * identifiable, Jellyfin décide seul (le refus n'y changerait rien : sa porte
 * directe sert le fichier à l'anonyme).
 *
 * Images et vignettes ne sont pas des flux : Jellyfin les sert sans jeton.
 */

import { isItemVisibleTo } from "../../services/itemAccess/itemVisibility";
import { validateToken } from "../../middleware/auth";

/** Évalués sur le chemin du CLIENT, en toute casse. `$1` est le titre. */
const STREAM_ROUTES: readonly RegExp[] = [
  /^Videos\/([^/]+)\/(stream|stream\.mp4|master\.m3u8|main\.m3u8|hls1\/|Subtitles\/)/i,
  /^Videos\/([^/]+)\/[^/]+\/(master\.m3u8|main\.m3u8|Subtitles\/)/i,
  /^Audio\/([^/]+)\//i,
];

/** Le titre d'un chemin de flux, ou `null` si ce n'en est pas un. */
export function streamItemId(path: string): string | null {
  for (const pattern of STREAM_ROUTES) {
    const id = pattern.exec(path)?.[1];
    if (id && id.toLowerCase() !== "activeencodings") return id;
  }
  return null;
}

/**
 * `true` : ce flux est refusé. `knownUserId` : le compte déjà établi par le
 * proxy (appareil, « voir en tant que ») ; sinon celui du jeton Jellyfin.
 */
export async function streamRefused(
  path: string,
  token: string | undefined,
  knownUserId: string | null,
): Promise<boolean> {
  const itemId = streamItemId(path);
  if (!itemId) return false;
  let userId = knownUserId;
  if (!userId && token) {
    const validation = await validateToken(token);
    userId = validation.ok ? validation.user.userId : null;
  }
  if (!userId) return false;
  return !(await isItemVisibleTo(userId, itemId));
}
