/**
 * Octave — la porte des droits du COMPTE, après `requireAuth`, devant toute
 * route musique du cœur :
 *
 * - « Accès à Octave » (`octave.rights`, droit Tentacle) : sans lui,
 *   `/api/music/status` répond « indisponible » (`octaveAccess: false`) — le
 *   client range alors Octave sans erreur — et toute autre route 403
 *   `octave_access_denied`, avant le moindre travail.
 * - « Lecture des médias » (`EnableMediaPlayback`, Jellyfin) : sans elle, ni
 *   source ni flux (403 `playback_not_allowed`, le code du proxy vidéo). Une
 *   politique illisible ne refuse rien d'elle-même, comme pour la vidéo.
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { MUSIC_ROUTES, type MusicStatus } from "../contract/musicCoreApi";
import { syncState } from "../index/indexSync";
import { OCTAVE_ACCESS_DENIED } from "../../octaveRights/octaveRightsContract";
import { hasOctaveAccess } from "../../services/octaveRights/octaveAccess";
import { getAccountPlaybackPolicy } from "../../services/playbackRights";
import type { JellyfinUser } from "../../middleware/auth";

const PLAYBACK_ROUTES: ReadonlySet<string> = new Set([
  MUSIC_ROUTES.source,
  MUSIC_ROUTES.stream,
]);

/** Le statut d'un compte sans « Accès à Octave » : rien n'est offert, rien n'est trahi. */
export function deniedStatus(): MusicStatus {
  return { available: false, libraryId: null, indexReady: syncState().ready, trackCount: 0, octaveAccess: false };
}

export async function octaveAccessGate(request: FastifyRequest, reply: FastifyReply): Promise<unknown> {
  if (reply.sent) return;
  const user = (request as FastifyRequest & { user?: JellyfinUser }).user;
  if (!user) return;
  const route = request.routeOptions.url ?? "";
  if (!(await hasOctaveAccess(user.userId))) {
    if (route === MUSIC_ROUTES.status) {
      reply.header("cache-control", "private, no-store");
      return reply.send(deniedStatus());
    }
    return reply.status(403).send({ error: OCTAVE_ACCESS_DENIED });
  }
  if (PLAYBACK_ROUTES.has(route)) {
    const policy = await getAccountPlaybackPolicy(user.userId);
    if (policy && !policy.enableMediaPlayback) return reply.status(403).send({ code: "playback_not_allowed", error: "Forbidden" });
  }
}
