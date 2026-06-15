export interface PlaystateRewrite {
  /** Nouveau wildcard path (sans slash initial), query string incluse. */
  path: string;
  method: "POST" | "DELETE";
}

const SESSION_PLAYSTATE = /^Sessions\/Playing(?:\/(Progress|Stopped))?$/;

/**
 * Réécrit un report de lecture `/Sessions/Playing*` vers l'endpoint scopé par
 * userId (`/Users/{userId}/PlayingItems/{itemId}*`).
 *
 * Les endpoints `/Sessions/Playing*` attribuent l'état de lecture au compte du
 * TOKEN porteur : envoyés avec la clé admin (cas d'un device jumelé SANS token
 * Jellyfin stocké), ils enregistrent la progression sur le compte admin et la
 * perdent pour l'utilisateur. Les endpoints `/Users/{userId}/PlayingItems/*`
 * portent l'userId dans l'URL → la clé admin attribue correctement la lecture
 * à l'utilisateur. Ces endpoints prennent leurs paramètres en QUERY (pas de
 * body).
 *
 * Retourne `null` si la route n'est pas un report de lecture, ou si le corps ne
 * contient pas d'`ItemId`.
 */
export function buildPlaystateRewrite(
  userId: string,
  wildcardPath: string,
  body: unknown,
): PlaystateRewrite | null {
  const m = SESSION_PLAYSTATE.exec(wildcardPath);
  if (!m) return null;

  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const itemId = typeof b.ItemId === "string" ? b.ItemId : undefined;
  if (!itemId) return null;

  const kind = m[1]; // undefined (start) | "Progress" | "Stopped"
  const q = new URLSearchParams();
  const set = (k: string, v: unknown) => {
    if (v !== undefined && v !== null) q.set(k, String(v));
  };
  set("mediaSourceId", b.MediaSourceId ?? itemId);
  set("playSessionId", b.PlaySessionId);

  const base = `Users/${userId}/PlayingItems/${itemId}`;

  if (kind === "Stopped") {
    set("positionTicks", b.PositionTicks);
    return { path: `${base}?${q.toString()}`, method: "DELETE" };
  }

  // start + progress : champs communs
  set("playMethod", b.PlayMethod);
  set("audioStreamIndex", b.AudioStreamIndex);
  set("subtitleStreamIndex", b.SubtitleStreamIndex);
  set("canSeek", b.CanSeek);
  set("positionTicks", b.PositionTicks);
  if (kind === "Progress") {
    set("isPaused", b.IsPaused);
    return { path: `${base}/Progress?${q.toString()}`, method: "POST" };
  }
  return { path: `${base}?${q.toString()}`, method: "POST" };
}
