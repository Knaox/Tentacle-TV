import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAuth, type JellyfinUser } from "../middleware/auth";
import { getJellyfinApiKey, getJellyfinUrl } from "../services/configStore";
import { addMember } from "../services/watchTogether/roomStore";
import { getRoom, getRoomOf } from "../services/watchTogether/roomRegistry";
import { createInvite, invitesFor, takeInvite } from "../services/watchTogether/roomInvites";
import { bumpEpoch, removeMemberAndSync } from "../services/watchTogether/sync";
import {
  broadcastRoom,
  inviteToDto,
  notifyInvite,
  notifyDissolved,
  notifyInviteGone,
  notifyInviteResult,
  roomToDto,
} from "../services/watchTogether/broadcast";
import { getJellyfinUsers, getUserBasic } from "../services/watchTogether/usersCache";
import { withoutFamilyGuests } from "../services/family/familyGuestMarkers";
import { sendChatHistory } from "../services/watchTogether/chat";
import { refreshHostSettings } from "../services/watchTogether/hostSettings";
import { WT_MAX_INVITES_PER_REQUEST } from "../services/watchTogether/protocol";
import { seesRoomItem } from "../services/watchTogether/itemRights";
import { jellyfinAuthHeaders } from "../services/jellyfinAuth";
import { accessIn, wtAccessOf } from "../services/watchTogether/accountAccess";
import { WT_ACCESS_DENIED, wtMayCreate, wtMayJoin } from "../services/watchTogether/watchTogetherAccess";
import { deviceKeyOf } from "../services/watchTogether/requestDevice";
import { watchBoundDevice } from "../services/watchTogether/gatewayPresence";
import { isDeviceBound } from "../services/watchTogether/memberDevices";
import { beginArrival } from "../services/watchTogether/arrival";

/**
 * Nom d'un item Jellyfin (clé admin, best-effort — contexte d'invitation), vu
 * par la cible (404 : un titre que ses droits lui cachent → `null`). Sans `userId`, Jellyfin répond 400 à une clé d'API (mesuré de
 * 10.10.7 à 12.1.0) : le titre n'apparaissait jamais dans l'invitation.
 */
async function fetchItemName(itemId: string, userId: string): Promise<string | null> {
  const jellyfinUrl = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!jellyfinUrl || !apiKey) return null;
  try {
    const res = await fetch(`${jellyfinUrl}/Items/${encodeURIComponent(itemId)}?userId=${encodeURIComponent(userId)}`, {
      headers: jellyfinAuthHeaders(apiKey),
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
    const self = room?.members.get(user.userId);
    if (!room || !self || !isDeviceBound(self, deviceKeyOf(request))) return reply.status(404).send({ code: "not_in_group" });
    if (room.hostUserId !== user.userId) {
      return reply.status(403).send({ code: "not_host", message: "Seul l'hôte peut inviter" });
    }

    // Un invité de la Famille n'est jamais invitable (il n'apparaît dans aucune liste).
    const jellyfinUsers = await getJellyfinUsers();
    // Inviter, c'est « Créer et rejoindre » : un hôte qui l'a perdu garde son salon, sans plus inviter.
    if (!wtMayCreate(accessIn(jellyfinUsers, user.userId))) {
      return reply.status(403).send({ code: WT_ACCESS_DENIED, message: "Watch Together : invitation non autorisée" });
    }
    const allUsers = jellyfinUsers ? await withoutFamilyGuests(jellyfinUsers, (u) => u.id).catch(() => null) : null;
    const contextItemId = room.itemId ?? room.contextItemId;

    const invited: string[] = [];
    for (const targetId of new Set(userIds)) {
      if (targetId === user.userId || room.members.has(targetId)) continue;
      const target = allUsers?.find((u) => u.id === targetId);
      // Un compte sans Watch Together (« Interdit ») n'est ni invité ni prévenu.
      if (!target || target.isDisabled || !wtMayJoin(accessIn(allUsers, targetId))) continue;
      // Le titre EN LECTURE caché à la cible par ses droits : pas d'invitation
      // (docs/DROITS-UTILISATEURS.md § 5). Le nom, lui, est lu au nom de la
      // CIBLE : un titre de contexte qu'elle ne voit pas ne lui est pas nommé.
      if (!(await seesRoomItem(room, targetId))) continue;
      const itemName = contextItemId ? await fetchItemName(contextItemId, targetId) : null;
      const invite = createInvite(
        room,
        { userId: user.userId, username: user.username },
        targetId,
        itemName ? contextItemId : null,
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
    if (!wtMayJoin(await wtAccessOf(user.userId))) return [];
    return invitesFor(user.userId).map(inviteToDto);
  });

  /** POST /invites/:inviteId/respond — accepte ou refuse une invitation. */
  app.post("/invites/:inviteId/respond", async (request, reply) => {
    const user = (request as any).user as JellyfinUser;
    const { inviteId } = request.params as { inviteId: string };
    const { accept } = z.object({ accept: z.boolean() }).parse(request.body);

    const invite = takeInvite(inviteId, user.userId);
    if (!invite) return reply.status(404).send({ code: "invite_gone" });
    notifyInviteGone(invite);

    const room = getRoom(invite.groupId);
    if (!room) return reply.status(404).send({ code: "group_gone" });
    // « Rejoindre » est un droit : « Interdit » n'entre dans aucun salon.
    if (accept && !wtMayJoin(await wtAccessOf(user.userId))) {
      return reply.status(403).send({ code: WT_ACCESS_DENIED, message: "Watch Together : non autorisé" });
    }
    // Le salon est passé à un titre que ses droits lui cachent : l'invitation ne vaut plus.
    if (accept && !(await seesRoomItem(room, user.userId))) return reply.status(404).send({ code: "invite_gone" });

    if (!accept) {
      notifyInviteResult(invite, user.username, false);
      return { success: true };
    }

    const profile = await getUserBasic(user.userId);
    // L'appareil qui accepte entre dans la salle — lui seul (adhésion par appareil).
    const deviceKey = deviceKeyOf(request);
    let member = addMember(room, {
      userId: user.userId,
      username: user.username,
      hasAvatar: profile?.hasAvatar ?? false,
    }, deviceKey);
    if (!member) {
      // Membre d'un AUTRE groupe : accepter = le quitter (transfert d'hôte/GC
      // + broadcast aux anciens co-membres) et rejoindre le nouveau.
      const removal = removeMemberAndSync(user.userId);
      // Ses appareils liés à l'ancien groupe en sortent aussi : ils l'apprennent.
      if (removal) notifyDissolved(removal.removed, removal.room.groupId, "dissolved");
      if (removal && !removal.dissolved) {
        // L'ancien groupe change d'hôte : ses réglages avant la diffusion.
        if (removal.newHostId) await refreshHostSettings(removal.room);
        broadcastRoom(removal.room, "leave", user.userId);
      }
      member = addMember(room, {
        userId: user.userId,
        username: user.username,
        hasAvatar: profile?.hasAvatar ?? false,
      }, deviceKey);
      if (!member) return reply.status(409).send({ code: "already_in_group" });
    }
    watchBoundDevice(user.userId, deviceKey);
    // La salle a un titre : elle se met en pause AU CLIC et attend cet appareil.
    beginArrival(room, member, deviceKey ?? null, Date.now());
    bumpEpoch(room);
    broadcastRoom(room, "join", user.userId);
    sendChatHistory(user.userId, room);
    notifyInviteResult(invite, user.username, true);
    request.log.info({ groupId: room.groupId, user: user.username }, "[wt] invitation acceptée");
    return roomToDto(room);
  });
};
