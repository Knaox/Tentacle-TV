/**
 * Octave — le partage d'une playlist (capacité `music.playlistShare`, contrat `musicShare.ts`).
 *
 * - Au nom du compte (sous `/api/music`, session exigée) : `GET|POST|DELETE /playlists/:id/share` — lire, créer
 *   (ou rendre) et révoquer LE lien de cette playlist. Il faut le droit « Partage public » (le même que Ma
 *   liste), une playlist que le compte voit, et une vraie session : ni « voir en tant que », ni un invité de la
 *   Famille (qui n'a aucun lien de partage).
 * - Sans compte (`musicSharePublicRoutes`, hors de `/api/music`) : le document du lien et sa page.
 */

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";
import { capabilityGate } from "../../serverCapabilities/declaredCapabilities";
import { PUBLIC_SHARING_DENIED } from "../../services/share/publicSharingRight";
import { publishedPublicUrl } from "../../remoteAccess/exposure";
import { isShareToken, playlistShareUrl, type MusicPlaylistShare, type MusicPlaylistShareState } from "../contract/musicShare";
import { isJellyfinId } from "../jellyfin/musicJellyfin";
import { playlistFor } from "../playlists/playlistJellyfin";
import { userOf } from "../routes/requestView";
import { loadShareDocument } from "./shareDocument";
import { ensureShare, revokeShare, shareOf, type ShareRecord } from "./shareStore";
import { sendMusicSharePage, sendShareImportRedirect } from "./sharePage";
import { mayUsePlaylistShares } from "./shareRight";

const gate = capabilityGate("music.playlistShare");
const PUBLIC_RATE_LIMIT = { rateLimit: { max: 60, timeWindow: "1 minute" } };

/** L'adresse du lien : le lien public du serveur, sinon celle par laquelle CE client le joint. */
function linkOf(request: FastifyRequest, share: ShareRecord): MusicPlaylistShare {
  const published = publishedPublicUrl();
  const origin = published ?? `${request.protocol}://${request.host}`;
  return { url: playlistShareUrl(origin, share.token), token: share.token, createdAt: share.createdAt, reach: published ? "public" : "local" };
}

/** Une vraie session personnelle qui a le droit de partager ? Sinon le refus à rendre. */
async function refusal(request: FastifyRequest): Promise<{ status: number; body: object } | null> {
  const user = userOf(request);
  if (user.session === "impersonation") return { status: 403, body: { error: "forbidden" } };
  return (await mayUsePlaylistShares(user)) ? null : { status: 403, body: PUBLIC_SHARING_DENIED };
}

export function musicShareOwnerRoutes(app: FastifyInstance): void {
  app.get<{ Params: { id: string } }>("/playlists/:id/share", { onRequest: gate }, async (request, reply) => {
    reply.header("cache-control", "private, no-store");
    if (!isJellyfinId(request.params.id)) return reply.status(404).send({ error: "not_found" });
    const share = await shareOf(userOf(request).userId, request.params.id);
    const state: MusicPlaylistShareState = { share: share ? linkOf(request, share) : null };
    return state;
  });

  app.post<{ Params: { id: string } }>("/playlists/:id/share", { onRequest: gate, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
    const refused = await refusal(request);
    if (refused) return reply.status(refused.status).send(refused.body);
    const user = userOf(request);
    if (!isJellyfinId(request.params.id) || !(await playlistFor(user.userId, request.params.id))) return reply.status(404).send({ error: "not_found" });
    const share = await ensureShare(user.userId, user.username, request.params.id);
    const state: MusicPlaylistShareState = { share: linkOf(request, share) };
    return state;
  });

  app.delete<{ Params: { id: string } }>("/playlists/:id/share", { onRequest: gate }, async (request, reply) => {
    if (userOf(request).session === "impersonation") return reply.status(403).send({ error: "forbidden" });
    if (!isJellyfinId(request.params.id)) return reply.status(404).send({ error: "not_found" });
    // Révoquer reste permis sans le droit : on peut toujours retirer un lien qu'on a donné.
    await revokeShare(userOf(request).userId, request.params.id);
    const state: MusicPlaylistShareState = { share: null };
    return state;
  });
}

/** Le document et la page d'un lien, SANS compte (enregistrées hors de `/api/music` et de sa session). */
export const musicSharePublicRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { token: string } }>("/api/music/share/:token", { onRequest: gate, config: PUBLIC_RATE_LIMIT }, async (request, reply) => {
    reply.header("cache-control", "no-store").header("x-robots-tag", "noindex, nofollow");
    if (!isShareToken(request.params.token)) return reply.status(404).send({ error: "share_unavailable" });
    const result = await loadShareDocument(request.params.token).catch(() => ({ ok: false as const, reason: "unavailable" as const }));
    return result.ok ? result.document : reply.status(404).send({ error: "share_unavailable" });
  });

  app.get<{ Params: { token: string } }>("/octave/share/:token", { onRequest: gate, config: PUBLIC_RATE_LIMIT }, async (request, reply) =>
    sendMusicSharePage(request, reply, request.params.token),
  );

  app.get<{ Params: { token: string }; Querystring: { server?: string } }>(
    "/octave/share/:token/import",
    { onRequest: gate, config: PUBLIC_RATE_LIMIT },
    async (request, reply) => sendShareImportRedirect(request, reply, request.params.token, request.query.server),
  );
};
