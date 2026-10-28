/**
 * Octave — les routes d'une playlist PARTAGÉE entre comptes (capacité `music.playlistMembers`, contrat
 * `musicPlaylistMembers.ts`), sous `/api/music` (session exigée) :
 *
 * - `GET /playlists/:id/members` : le partage, pour le propriétaire ou un membre ;
 * - `PUT /playlists/:id/members` { userId, right } et `PATCH|DELETE /playlists/:id/members/:userId` : le
 *   propriétaire ajoute, change le droit, retire ;
 * - `DELETE /playlists/:id/membership` : un membre la QUITTE ;
 * - `GET /playlist-members/candidates` : les comptes à qui partager.
 *
 * Jamais « voir en tant que », jamais un invité de la Famille (qui n'a aucun partage) : 403 avant tout travail.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { capabilityGate } from "../../serverCapabilities/declaredCapabilities";
import { isFamilyGuest } from "../../services/family/familyGuestMarkers";
import { MUSIC_PLAYLIST_MEMBERS_MAX, parseMemberRight } from "../contract/musicPlaylistMembers";
import { isJellyfinId, normalizeId } from "../jellyfin/musicJellyfin";
import { userOf } from "../routes/requestView";
import { dropMember, membersOf, membershipOf, putMember } from "./memberStore";
import { mayReceive, shareCandidates } from "./memberPeople";
import { tellAccountsAbout, tellPlaylistPeople } from "./memberEvents";
import { sharingFor } from "./memberViews";
import { playlistAccess } from "./playlistAccess";
import { noticeShared } from "./memberNotice";

const gate = capabilityGate("music.playlistMembers");

/** Une vraie session d'un compte qui peut partager ? Sinon la réponse est envoyée. */
async function personal(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  const user = userOf(request);
  if (user.session === "impersonation" || (await isFamilyGuest(user.userId).catch(() => true))) {
    void reply.status(403).send({ error: "forbidden" });
    return false;
  }
  return true;
}

/** La playlist et son partage, tels que ce compte les voit ; `null` : 404 déjà envoyé. */
async function sharingView(request: FastifyRequest, reply: FastifyReply, playlistId: string) {
  const access = isJellyfinId(playlistId) ? await playlistAccess(userOf(request).userId, playlistId) : null;
  if (!access || access.right === null) {
    void reply.status(404).send({ error: "not_found" });
    return null;
  }
  return access;
}

/** Le partage tel que ce compte le voit maintenant (le propriétaire : même sans membre, sa feuille de partage). */
async function answer(request: FastifyRequest, reply: FastifyReply, playlistId: string) {
  const access = await playlistAccess(userOf(request).userId, playlistId);
  const sharing = access ? await sharingFor(access, playlistId, { evenUnshared: true }) : undefined;
  return sharing ?? reply.status(404).send({ error: "not_found" });
}

export function musicPlaylistMemberRoutes(app: FastifyInstance): void {
  app.get("/playlist-members/candidates", { onRequest: gate }, async (request, reply) => {
    if (!(await personal(request, reply))) return;
    reply.header("cache-control", "private, no-store");
    return (await shareCandidates(userOf(request).userId)) ?? reply.status(503).send({ error: "unavailable" });
  });

  app.get<{ Params: { id: string } }>("/playlists/:id/members", { onRequest: gate }, async (request, reply) => {
    reply.header("cache-control", "private, no-store");
    if (!(await sharingView(request, reply, request.params.id))) return;
    return answer(request, reply, request.params.id);
  });

  app.put<{ Params: { id: string }; Body: { userId?: unknown; right?: unknown } }>(
    "/playlists/:id/members",
    { onRequest: gate, config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      if (!(await personal(request, reply))) return;
      const right = parseMemberRight(request.body?.right);
      const memberId = request.body?.userId;
      if (!right || typeof memberId !== "string" || !isJellyfinId(memberId)) return reply.status(400).send({ error: "invalid_input" });
      const access = await sharingView(request, reply, request.params.id);
      if (!access) return;
      if (access.right !== "owner") return reply.status(403).send({ error: "forbidden" });
      const me = userOf(request).userId;
      // Ni soi, ni un invité, ni un compte désactivé ou sans Octave : la règle de la liste des candidats.
      if (!(await mayReceive(me, memberId))) return reply.status(404).send({ error: "not_found" });
      const before = await membersOf(request.params.id);
      if (!before.some((m) => m.memberId === normalizeId(memberId)) && before.length >= MUSIC_PLAYLIST_MEMBERS_MAX) return reply.status(400).send({ error: "too_many_members" });
      const fresh = await putMember(request.params.id, access.readerId, memberId, right);
      tellAccountsAbout(request.params.id, [me, memberId]);
      void tellPlaylistPeople(request.params.id, [me, memberId]);
      if (fresh) void noticeShared(normalizeId(memberId), userOf(request).username, access.playlist.Name ?? "", request.params.id);
      return answer(request, reply, request.params.id);
    },
  );

  app.patch<{ Params: { id: string; userId: string }; Body: { right?: unknown } }>("/playlists/:id/members/:userId", { onRequest: gate }, async (request, reply) => {
    if (!(await personal(request, reply))) return;
    const right = parseMemberRight(request.body?.right);
    if (!right || !isJellyfinId(request.params.userId)) return reply.status(400).send({ error: "invalid_input" });
    const access = await sharingView(request, reply, request.params.id);
    if (!access) return;
    if (access.right !== "owner") return reply.status(403).send({ error: "forbidden" });
    if (!(await membershipOf(request.params.id, request.params.userId))) return reply.status(404).send({ error: "not_found" });
    await putMember(request.params.id, access.readerId, request.params.userId, right);
    tellAccountsAbout(request.params.id, [userOf(request).userId, request.params.userId]);
    return answer(request, reply, request.params.id);
  });

  app.delete<{ Params: { id: string; userId: string } }>("/playlists/:id/members/:userId", { onRequest: gate }, async (request, reply) => {
    if (!(await personal(request, reply))) return;
    if (!isJellyfinId(request.params.userId)) return reply.status(400).send({ error: "invalid_input" });
    const access = await sharingView(request, reply, request.params.id);
    if (!access) return;
    if (access.right !== "owner") return reply.status(403).send({ error: "forbidden" });
    await dropMember(request.params.id, request.params.userId);
    void tellPlaylistPeople(request.params.id, [userOf(request).userId]);
    tellAccountsAbout(request.params.id, [userOf(request).userId, request.params.userId]);
    return answer(request, reply, request.params.id);
  });

  app.delete<{ Params: { id: string } }>("/playlists/:id/membership", { onRequest: gate }, async (request, reply) => {
    if (!(await personal(request, reply))) return;
    if (!isJellyfinId(request.params.id)) return reply.status(404).send({ error: "not_found" });
    const me = userOf(request).userId;
    if (!(await dropMember(request.params.id, me))) return reply.status(404).send({ error: "not_found" });
    void tellPlaylistPeople(request.params.id, [me]);
    tellAccountsAbout(request.params.id, [me]);
    return { ok: true };
  });
}
