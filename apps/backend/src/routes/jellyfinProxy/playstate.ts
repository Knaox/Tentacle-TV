export interface PlaystateRewrite {
  /** Nouveau wildcard path (sans slash initial), query string incluse. */
  path: string;
  method: "POST" | "DELETE";
  /** Corps JSON à envoyer à la place de celui du client. */
  body?: string;
}

const SESSION_PLAYSTATE = /^Sessions\/Playing(?:\/(Progress|Stopped))?$/;

/**
 * Réécrit un report de lecture `/Sessions/Playing*` d'un appareil jumelé SANS
 * jeton Jellyfin en une écriture de ses DONNÉES UTILISATEUR :
 * `POST /UserItems/{itemId}/UserData?userId=…`, position et date de lecture.
 *
 * Les endpoints `/Sessions/Playing*` attribuent la lecture au compte du jeton
 * porteur : avec la clé admin, la progression était perdue pour l'utilisateur.
 * L'ancienne réécriture visait `/Users/{userId}/PlayingItems/*` : mesuré de
 * 10.10.7 à 12.1.0, ces routes (et `/PlayingItems/{id}?userId=`) répondent 204
 * mais n'écrivent RIEN sur le compte visé — et la 12.1 les retire de son
 * document OpenAPI. `UserItems/{id}/UserData`, documenté partout, écrit bien la
 * position sur le compte passé en query (même mesure).
 *
 * On y perd la session « en cours de lecture » du tableau de bord Jellyfin ;
 * on y gagne la reprise au bon endroit, qui est ce que l'utilisateur voit.
 *
 * Retourne `null` si la route n'est pas un report de lecture, ou si le corps ne
 * contient pas d'`ItemId`.
 */
export function buildPlaystateRewrite(
  userId: string,
  wildcardPath: string,
  body: unknown,
  now: Date = new Date(),
): PlaystateRewrite | null {
  if (!SESSION_PLAYSTATE.test(wildcardPath)) return null;

  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const itemId = typeof b.ItemId === "string" ? b.ItemId : undefined;
  if (!itemId) return null;

  const data: Record<string, unknown> = { LastPlayedDate: now.toISOString() };
  if (typeof b.PositionTicks === "number" && b.PositionTicks >= 0) data.PlaybackPositionTicks = b.PositionTicks;
  const query = new URLSearchParams({ userId });
  return {
    path: `UserItems/${encodeURIComponent(itemId)}/UserData?${query.toString()}`,
    method: "POST",
    body: JSON.stringify(data),
  };
}
