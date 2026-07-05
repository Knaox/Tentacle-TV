import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAuth, type JellyfinUser } from "../middleware/auth";
import { getJellyfinApiKey, getJellyfinUrl } from "../services/configStore";
import {
  addMember,
  createInvite,
  getRoom,
  getRoomOf,
  invitesFor,
  takeInvite,
} from "../services/watchTogether/roomStore";
import { bumpEpoch, removeMemberAndSync } from "../services/watchTogether/sync";
import {
  broadcastRoom,
  inviteToDto,
  notifyInvite,
  notifyInviteResult,
  roomToDto,
} from "../services/watchTogether/broadcast";
import { getJellyfinUsers, getUserBasic } from "../services/watchTogether/usersCache";
import { WT_MAX_INVITES_PER_REQUEST } from "../services/watchTogether/protocol";

/** Nom d'un item Jellyfin (clé admin, best-effort — contexte d'invitation). */
async function fetchItemName(itemId: string): Promise<string | null> {
  const jellyfinUrl = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!jellyfinUrl || !apiKey) return null;
  try {
    const res = await fetch(`${jellyfinUrl}/Items/${encodeURIComponent(itemId)}`, {
      headers: { "X-Emby-Token": apiKey },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const item = (await res.json()) as { Name?: string; SeriesName?: string };
    return item.SeriesName ?? item.Name ?? null;
  } catch {
    return null;
  }
}

/** Watch Together — invitations (REST, même préfixe /api/watch-together). */
export const watchTogetherInviteRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  /** POST /group/invites — invite des utilisateurs existants (hôte uniquement).
   *  Les cibles connectées reçoivent wt:invite immédiatement ; les autres à
   *  leur prochaine connexion WS (délivrance différée par le gateway). */
  app.post("/group/invites", async (request, reply) => {
    const user = (request as any).user as JellyfinUser;
    const { userIds } = z.object({
      userIds: z.array(z.string().min(1)).min(1).max(WT_MAX_INVITES_PER_REQUEST),
    }).parse(request.body);

    const room = getRoomOf(user.userId);
    if (!room) return reply.status(404).send({ code: "not_in_group" });
    if (room.hostUserId !== user.userId) {
      return reply.status(403).send({ code: "not_host", message: "Seul l'hôte peut inviter" });
    }

    const allUsers = await getJellyfinUsers();
    const contextItemId = room.itemId ?? room.contextItemId;
    const itemName = contextItemId ? await fetchItemName(contextItemId) : null;

    const invited: string[] = [];
    for (const targetId of new Set(userIds)) {
      if (targetId === user.userId || room.members.has(targetId)) continue;
      const target = allUsers?.find((u) => u.id === targetId);
      if (!target || target.isDisabled) continue;
      const invite = createInvite(
        room,
        { userId: user.userId, username: user.username },
        targetId,
        contextItemId,
        itemName,
      );
      notifyInvite(invite);
      invited.push(targetId);
    }
    request.log.info({ groupId: room.groupId, count: invited.length }, "[wt] invitations envoyées");
    return { invited };
  });

  /** GET /invites — invitations pendantes de l'utilisateur (boot du panneau). */
  app.get("/invites", async (request) => {
    const user = (request as any).user as JellyfinUser;
    return invitesFor(user.userId).map(inviteToDto);
  });

  /** POST /invites/:inviteId/respond — accepte ou refuse une invitation. */
  app.post("/invites/:inviteId/respond", async (request, reply) => {
    const user = (request as any).user as JellyfinUser;
    const { inviteId } = request.params as { inviteId: string };
    const { accept } = z.object({ accept: z.boolean() }).parse(request.body);

    const invite = takeInvite(inviteId, user.userId);
    if (!invite) return reply.status(404).send({ code: "invite_gone" });

    const room = getRoom(invite.groupId);
    if (!room) return reply.status(404).send({ code: "group_gone" });

    if (!accept) {
      notifyInviteResult(invite, user.username, false);
      return { success: true };
    }

    const profile = await getUserBasic(user.userId);
    let member = addMember(room, {
      userId: user.userId,
      username: user.username,
      hasAvatar: profile?.hasAvatar ?? false,
    });
    if (!member) {
      // Membre d'un AUTRE groupe : accepter = le quitter (transfert d'hôte/GC
      // + broadcast aux anciens co-membres) et rejoindre le nouveau.
      const removal = removeMemberAndSync(user.userId);
      if (removal && !removal.dissolved) {
        broadcastRoom(removal.room, "leave", user.userId);
      }
      member = addMember(room, {
        userId: user.userId,
        username: user.username,
        hasAvatar: profile?.hasAvatar ?? false,
      });
      if (!member) return reply.status(409).send({ code: "already_in_group" });
    }
    bumpEpoch(room);
    broadcastRoom(room, "join", user.userId);
    notifyInviteResult(invite, user.username, true);
    request.log.info({ groupId: room.groupId, user: user.username }, "[wt] invitation acceptée");
    return roomToDto(room);
  });
};
