/* ------------------------------------------------------------------ */
/*  La référence d'une vidéo relayée — YouTube ou Dailymotion          */
/*                                                                     */
/*  Le relais (`trailerRelay.ts`) range chaque vidéo sous UNE clé, qui */
/*  est aussi celle de son jeton (`relayToken.ts`) et de ses chemins   */
/*  (`relayPaths.ts`) :                                                */
/*   - YouTube : l'identifiant NU de 11 caractères, comme avant —      */
/*     l'aperçu, sa mémoire durable et les téléviseurs livrés n'en     */
/*     connaissent pas d'autre ; `yt:<id>` est accepté et ramené à lui ;*/
/*   - Dailymotion : `dm:<id>` (AlloCiné publie ses bandes-annonces    */
/*     sur sa chaîne Dailymotion).                                     */
/*  Jamais deux clés pour la même vidéo. Module pur.                   */
/* ------------------------------------------------------------------ */

/** Même contrainte que `parseYouTubeId` (@tentacle-tv/shared) : 11 caractères. */
const YT_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
/** Un identifiant Dailymotion : `x8e90ff`, `xa1ucfa` — lettres et chiffres, court. */
const DM_ID_RE = /^[a-zA-Z0-9]{5,16}$/;
const DM_PREFIX = "dm:";
const YT_PREFIX = "yt:";

export type VideoRef =
  | { kind: "youtube"; id: string; key: string }
  | { kind: "dailymotion"; id: string; key: string };

export const isYouTubeId = (value: unknown): value is string => typeof value === "string" && YT_ID_RE.test(value);
export const isDailymotionId = (value: unknown): value is string => typeof value === "string" && DM_ID_RE.test(value);

export function youtubeRef(id: string): VideoRef {
  return { kind: "youtube", id, key: id };
}

export function dailymotionRef(id: string): VideoRef {
  return { kind: "dailymotion", id, key: `${DM_PREFIX}${id}` };
}

/** La clé (ou `yt:<id>`) → la référence ; `null` pour tout le reste. */
export function parseVideoRef(value: unknown): VideoRef | null {
  if (typeof value !== "string") return null;
  if (YT_ID_RE.test(value)) return youtubeRef(value);
  const id = value.slice(3);
  if (value.startsWith(YT_PREFIX) && YT_ID_RE.test(id)) return youtubeRef(id);
  if (value.startsWith(DM_PREFIX) && DM_ID_RE.test(id)) return dailymotionRef(id);
  return null;
}

/**
 * La clé telle qu'elle s'écrit dans un chemin : le `:` encodé — un chemin
 * relayé ne porte que `[\w./?=&%-]` (la règle des téléviseurs, `trailerStream`),
 * et Fastify le décode à l'arrivée.
 */
export function refPathSegment(key: string): string {
  return encodeURIComponent(key);
}

/** La référence d'une requête : `ytId` ou `dmId` (un seul des deux). */
export function refOfQuery(query: { ytId?: unknown; dmId?: unknown }): VideoRef | null {
  if (query.ytId !== undefined && query.dmId !== undefined) return null;
  if (isYouTubeId(query.ytId)) return youtubeRef(query.ytId);
  if (isDailymotionId(query.dmId)) return dailymotionRef(query.dmId);
  return null;
}
